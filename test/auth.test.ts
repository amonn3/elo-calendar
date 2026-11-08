import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const directory = mkdtempSync(join(tmpdir(), 'elo-auth-'));
process.env.DATABASE_PATH = join(directory, 'test.sqlite');
process.env.APP_URL = 'http://127.0.0.1:5173';
process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
const { authAction, getSession } = await import('../lib/server/auth.ts');
const { query } = await import('../lib/server/database.ts');
const { decrypt, encrypt, hashPassword, verifyPassword } = await import('../lib/server/crypto.ts');
const request = (payload: unknown, cookie = '', origin = process.env.APP_URL!) => new Request(`${process.env.APP_URL}/api/auth/login`, { method: 'POST', headers: { origin, 'Content-Type': 'application/json', cookie }, body: JSON.stringify(payload) });
const payload = { email: 'person@example.com', name: 'Pessoa de teste', password: 'a-strong-test-password' };
after(() => rmSync(directory, { recursive: true, force: true }));
test('registration creates a real session, stores only password hashes, and logout revokes it', async () => {
  const response = await authAction(request(payload), 'register'); assert.equal(response.status, 201);
  const cookie = response.headers.get('set-cookie')!; assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/);
  const session = await getSession(cookie); assert.equal(session?.user.email, payload.email);
  const [row] = await query<{password_hash:string}>('SELECT password_hash FROM users WHERE email=$1', [payload.email]);
  assert.notEqual(row.password_hash, payload.password); assert.equal(await verifyPassword(payload.password, row.password_hash), true);
  const logout = await authAction(request({}, cookie), 'logout'); assert.equal(logout.status, 200);
  assert.equal(await getSession(cookie), null);
});
test('login rejects bad credentials and normalizes email, without creating another account', async () => {
  assert.equal((await authAction(request({ ...payload, password: 'the-wrong-password' }), 'login')).status, 401);
  const response = await authAction(request({ ...payload, email: ' PERSON@EXAMPLE.COM ' }), 'login'); assert.equal(response.status, 200);
  assert.ok(await getSession(response.headers.get('set-cookie')));
  assert.equal((await authAction(request(payload), 'register')).status, 409);
  assert.equal((await query('SELECT id FROM users')).length, 1);
});
test('CSRF, weak passwords, forged cookies, and expired sessions are rejected', async () => {
  assert.equal((await authAction(request(payload, '', 'https://attacker.example'), 'login')).status, 403);
  assert.equal((await authAction(request({ ...payload, password: 'short' }), 'register')).status, 400);
  assert.equal(await getSession('elo-session=forged'), null);
  const response = await authAction(request(payload), 'login');
  const cookie = response.headers.get('set-cookie'); assert.ok(cookie);
  await query('UPDATE sessions SET expires_at=$1', [0]); assert.equal(await getSession(cookie), null);
});
test('password salts differ and encrypted provider credentials reject tampering', async () => {
  assert.notEqual(await hashPassword(payload.password), await hashPassword(payload.password));
  const value = encrypt('private-provider-token'); assert.equal(decrypt(value), 'private-provider-token');
  const parts=value.split('.');parts[2]=Buffer.from('tampered').toString('base64url');assert.throws(()=>decrypt(parts.join('.')));
});
test('repeated credential failures are rate limited', async () => {
  const data={email:'nonexistent@example.com',password:'incorrect-password'};
  for(let i=0;i<8;i++)assert.equal((await authAction(request(data),'login')).status,401);
  assert.equal((await authAction(request(data),'login')).status,429);
});
