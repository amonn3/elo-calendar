import { createHash, randomUUID } from 'node:crypto';
import { AppError, appOrigin, assertSameOrigin, failure, json } from './config.ts';
import { cookieValue, requireSession } from './auth.ts';
import { decrypt, digest, encrypt, randomToken } from './crypto.ts';
import { query } from './database.ts';
import { exchangeToken, providerConfig, providerFetch, type Provider } from './providers.ts';
export type Connection = { id: string; user_id: string; provider: Provider; provider_user_id: string; email: string; name: string; color: string; access_token: string; refresh_token: string; expires_at: number };
export const publicConnection = (c: Connection) => ({ id: c.id, name: c.name, email: c.email, provider: c.provider === 'google' ? 'Google' as const : 'Microsoft' as const, color: c.color });
export async function listConnections(userId: string) { return query<Connection>('SELECT * FROM calendar_connections WHERE user_id = $1 ORDER BY id', [userId]); }
export async function ownedConnection(userId: string, id: string) { const [c] = await query<Connection>('SELECT * FROM calendar_connections WHERE id = $1 AND user_id = $2', [id, userId]); if (!c) throw new AppError('Conta não encontrada.', 404); return c; }
const refreshing = new Map<string, Promise<string>>();
export async function accessToken(connection: Connection) {
  if (Number(connection.expires_at) > Date.now() + 60_000) return decrypt(connection.access_token);
  const existing = refreshing.get(connection.id); if (existing) return existing;
  const work = (async () => {
    const current = await ownedConnection(connection.user_id, connection.id);
    if (Number(current.expires_at) > Date.now() + 60_000) return decrypt(current.access_token);
    const refresh = decrypt(current.refresh_token);
    if (!refresh) throw new AppError('Conecte esta conta novamente para renovar a autorização.', 409);
    const tokens = await exchangeToken(current.provider, { grant_type: 'refresh_token', refresh_token: refresh });
    await query('UPDATE calendar_connections SET access_token=$1, refresh_token=$2, expires_at=$3 WHERE id=$4 AND user_id=$5', [encrypt(tokens.access_token), encrypt(tokens.refresh_token || refresh), Date.now() + Number(tokens.expires_in) * 1000, current.id, current.user_id]);
    return tokens.access_token;
  })().finally(() => refreshing.delete(connection.id));
  refreshing.set(connection.id, work); return work;
}
function flowCookie(provider: string, token: string, maxAge = 600) { return `elo-oauth-${provider}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`; }
export async function startConnection(request: Request, provider: string) {
  try {
    assertSameOrigin(request); const session = await requireSession(request); const config = providerConfig(provider);
    const state = randomToken(); const verifier = randomToken(); const browser = randomToken();
    // Check encryption configuration before redirecting the user to a consent screen.
    const protectedVerifier = encrypt(verifier);
    await query('DELETE FROM oauth_transactions WHERE expires_at <= $1', [Date.now()]);
    await query('INSERT INTO oauth_transactions (state_hash,user_id,session_hash,provider,verifier,browser_hash,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7)', [digest(state), session.user.id, session.sessionHash, provider, protectedVerifier, digest(browser), Date.now() + 600_000]);
    const url = new URL(config.authorization);
    const params: Record<string,string> = { client_id: config.id, redirect_uri: config.redirect, response_type: 'code', scope: config.scope, state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', prompt: config.provider === 'google' ? 'consent select_account' : 'select_account' };
    if (config.provider === 'google') params.access_type = 'offline';
    url.search = new URLSearchParams(params).toString();
    const response = json({ url: url.toString() }); response.headers.set('Set-Cookie', flowCookie(provider, browser)); return response;
  } catch (error) { return failure(error); }
}
export async function finishConnection(request: Request, provider: string) {
  let destination = '/?connection_error=authorization';
  try {
    const session = await requireSession(request); const config = providerConfig(provider); const url = new URL(request.url);
    const state = url.searchParams.get('state') || ''; const browser = cookieValue(request.headers.get('cookie'), `elo-oauth-${provider}`);
    if (!/^[\w-]{43}$/.test(state) || !browser) throw new AppError('Autorização inválida.');
    // Atomic delete prevents replay. The same signed-in browser and session must finish the flow.
    const [transaction] = await query<{ verifier: string }>('DELETE FROM oauth_transactions WHERE state_hash=$1 AND user_id=$2 AND session_hash=$3 AND provider=$4 AND browser_hash=$5 AND expires_at>$6 RETURNING verifier', [digest(state), session.user.id, session.sessionHash, provider, digest(browser), Date.now()]);
    if (!transaction || url.searchParams.has('error')) throw new AppError('Autorização cancelada.');
    const code = url.searchParams.get('code'); if (!code || code.length > 4096) throw new AppError('Código de autorização inválido.');
    const tokens = await exchangeToken(config.provider, { grant_type: 'authorization_code', code, redirect_uri: config.redirect, code_verifier: decrypt(transaction.verifier) });
    const identity = config.provider === 'google'
      ? await providerFetch<{sub:string;email:string;name?:string}>(config.provider, tokens.access_token, 'https://openidconnect.googleapis.com/v1/userinfo').then(p => ({ id: p.sub, email: p.email, name: p.name || p.email }))
      : await providerFetch<{id:string;mail?:string;userPrincipalName:string;displayName:string}>(config.provider, tokens.access_token, 'https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName,displayName').then(p => ({ id: p.id, email: p.mail || p.userPrincipalName, name: p.displayName }));
    if (!identity.id || !identity.email) throw new AppError('Não foi possível identificar a conta.');
    const all = await listConnections(session.user.id); const existing = all.find(c => c.provider === provider && c.provider_user_id === identity.id);
    const refresh = tokens.refresh_token || (existing ? decrypt(existing.refresh_token) : '');
    if (!refresh) throw new AppError('O provedor não concedeu acesso offline. Revogue o acesso ao elo e conecte novamente.');
    await query(`INSERT INTO calendar_connections (id,user_id,provider,provider_user_id,email,name,color,access_token,refresh_token,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(user_id,provider,provider_user_id) DO UPDATE SET email=excluded.email, name=excluded.name, access_token=excluded.access_token, refresh_token=excluded.refresh_token, expires_at=excluded.expires_at`, [existing?.id || randomUUID(), session.user.id, provider, identity.id, identity.email, identity.name, existing?.color || ['purple','blue','orange','green'][all.length % 4], encrypt(tokens.access_token), encrypt(refresh), Date.now() + Number(tokens.expires_in) * 1000]);
    destination = '/?connected=1';
  } catch { /* Detailed OAuth responses and tokens must never appear in the URL or logs. */ }
  return new Response(null, { status: 303, headers: { Location: `${appOrigin()}${destination}`, 'Set-Cookie': flowCookie(provider, '', 0), 'Cache-Control': 'no-store' } });
}
