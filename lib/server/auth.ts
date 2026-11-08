import { randomUUID } from 'node:crypto';
import { AppError, assertSameOrigin, body, failure, json } from './config.ts';
import { digest, hashPassword, randomToken, verifyPassword } from './crypto.ts';
import { query } from './database.ts';
const SESSION_AGE = 7 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-elo-session' : 'elo-session';
export type User = { id: string; email: string; name: string };
export function cookieValue(header: string | null, name: string) { return (header || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`))?.slice(name.length + 1) || ''; }
export function sessionCookie(token: string, maxAge = SESSION_AGE / 1000) { return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`; }
export async function getSession(cookie: string | null) {
  const token = cookieValue(cookie, SESSION_COOKIE);
  if (!/^[\w-]{43}$/.test(token)) return null;
  const [row] = await query<User & { token_hash: string }>(`SELECT u.id, u.email, u.name, s.token_hash FROM users u JOIN sessions s ON s.user_id = u.id WHERE s.token_hash = $1 AND s.expires_at > $2`, [digest(token), Date.now()]);
  return row ? { user: { id: row.id, name: row.name, email: row.email }, sessionHash: row.token_hash } : null;
}
export async function requireSession(request: Request) {
  const session = await getSession(request.headers.get('cookie'));
  if (!session) throw new AppError('Entre na sua conta para continuar.', 401);
  return session;
}
async function limit(key: string, maximum: number) {
  const now = Date.now(); const hashed = digest(key);
  await query('DELETE FROM rate_limits WHERE key = $1 AND expires_at <= $2', [hashed, now]);
  const [row] = await query<{ attempts: number }>('INSERT INTO rate_limits (key, attempts, expires_at) VALUES ($1, 1, $2) ON CONFLICT(key) DO UPDATE SET attempts = rate_limits.attempts + 1 RETURNING attempts', [hashed, now + 15 * 60_000]);
  if (Number(row.attempts) > maximum) throw new AppError('Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.', 429);
}
export async function authAction(request: Request, action: string) {
  try {
    assertSameOrigin(request);
    if (action === 'logout') {
      const token = cookieValue(request.headers.get('cookie'), SESSION_COOKIE);
      if (token) await query('DELETE FROM sessions WHERE token_hash = $1', [digest(token)]);
      const response = json({ ok: true }); response.headers.set('Set-Cookie', sessionCookie('', 0)); return response;
    }
    if (!['login', 'register'].includes(action)) throw new AppError('Ação desconhecida.', 404);
    const data = await body(request);
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    const password = typeof data.password === 'string' ? data.password : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 12 || password.length > 128) throw new AppError('Informe um e-mail válido e uma senha com 12 a 128 caracteres.');
    // Vercel overwrites x-vercel-forwarded-for; never trust a client-supplied x-forwarded-for.
    const ip = process.env.VERCEL ? request.headers.get('x-vercel-forwarded-for') || 'unknown' : 'local';
    await limit(`ip:${ip}`, 30); await limit(`email:${email}`, 8);
    let user: User;
    if (action === 'register') {
      const name = typeof data.name === 'string' ? data.name.trim() : '';
      if (name.length < 2 || name.length > 80) throw new AppError('Informe seu nome (2 a 80 caracteres).');
      const passwordHash = await hashPassword(password);
      const rows = await query<User>('INSERT INTO users (id,email,name,password_hash,created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT(email) DO NOTHING RETURNING id,email,name', [randomUUID(), email, name, passwordHash, Date.now()]);
      if (!rows[0]) throw new AppError('Não foi possível criar a conta com este e-mail. Tente entrar na sua conta.', 409);
      user = rows[0];
    } else {
      const [row] = await query<User & { password_hash: string }>('SELECT id,email,name,password_hash FROM users WHERE email = $1', [email]);
      // Run scrypt even for unknown emails to avoid a fast account-existence signal.
      const valid = row ? await verifyPassword(password, row.password_hash) : (await hashPassword(password), false);
      if (!row || !valid) throw new AppError('E-mail ou senha incorretos.', 401);
      user = { id: row.id, email: row.email, name: row.name };
    }
    const token = randomToken();
    await query('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES ($1,$2,$3)', [digest(token), user.id, Date.now() + SESSION_AGE]);
    await query('DELETE FROM sessions WHERE expires_at <= $1', [Date.now()]);
    const response = json({ user }, action === 'register' ? 201 : 200); response.headers.set('Set-Cookie', sessionCookie(token)); return response;
  } catch (error) { return failure(error); }
}
