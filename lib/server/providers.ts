import { AppError, appOrigin } from './config.ts';
export type Provider = 'google' | 'microsoft';
export function providerConfig(provider: string) {
  if (provider !== 'google' && provider !== 'microsoft') throw new AppError('Provedor inválido.');
  const google = provider === 'google';
  const id = process.env[google ? 'GOOGLE_CLIENT_ID' : 'MICROSOFT_CLIENT_ID'];
  const secret = process.env[google ? 'GOOGLE_CLIENT_SECRET' : 'MICROSOFT_CLIENT_SECRET'];
  if (!id || !secret) throw new AppError(`A integração com ${google ? 'Google' : 'Microsoft'} ainda não foi configurada.`, 503);
  const tenant = process.env.MICROSOFT_TENANT_ID || 'common';
  if (!/^[\w.-]+$/.test(tenant)) throw new AppError('Configuração Microsoft inválida.', 503);
  return {
    provider: provider as Provider, id, secret,
    authorization: google ? 'https://accounts.google.com/o/oauth2/v2/auth' : `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    token: google ? 'https://oauth2.googleapis.com/token' : `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    scope: google ? 'openid email profile https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events' : 'offline_access https://graph.microsoft.com/User.Read https://graph.microsoft.com/Calendars.ReadWrite',
    redirect: `${appOrigin()}/api/connections/${provider}/callback`,
  };
}
export function providerStatus() { return { google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), microsoft: Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) }; }
export type Tokens = { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
export async function exchangeToken(provider: Provider, params: Record<string, string>): Promise<Tokens> {
  const config = providerConfig(provider);
  const response = await fetch(config.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: config.id, client_secret: config.secret, ...params }), cache: 'no-store', signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new AppError('A autorização expirou ou foi recusada. Conecte a conta novamente.', 409);
  const tokens = await response.json();
  if (typeof tokens.access_token !== 'string' || !Number.isFinite(Number(tokens.expires_in))) throw new AppError('Resposta de autorização inválida.', 502);
  return tokens;
}
export async function providerFetch<T>(provider: Provider, token: string, url: string, init: RequestInit = {}): Promise<T> {
  const parsed = new URL(url);
  const allowed = provider === 'google' ? ['www.googleapis.com', 'openidconnect.googleapis.com'] : ['graph.microsoft.com'];
  if (parsed.protocol !== 'https:' || !allowed.includes(parsed.hostname) || parsed.port || parsed.username || parsed.password) throw new AppError('Endereço do provedor inválido.', 502);
  const headers = new Headers(init.headers); headers.set('Authorization', `Bearer ${token}`);
  if (provider === 'microsoft') headers.set('Prefer', 'outlook.timezone="UTC", outlook.body-content-type="text"');
  const response = await fetch(parsed, { ...init, headers, cache: 'no-store', signal: AbortSignal.timeout(20_000) });
  if (!response.ok) {
    const status = response.status;
    throw new AppError(status === 401 || status === 403 ? 'A conta precisa de autorização. Conecte-a novamente.' : status === 429 ? 'O provedor está limitando as consultas. Tente novamente em instantes.' : status === 404 ? 'Este evento ou calendário não está mais disponível.' : 'Não foi possível atualizar o calendário no provedor.', status === 401 || status === 403 ? 409 : status === 404 ? 404 : 502);
  }
  return response.status === 204 ? undefined as T : response.json();
}
