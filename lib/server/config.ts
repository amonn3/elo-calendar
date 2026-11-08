export class AppError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export function appOrigin() {
  const raw = process.env.APP_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:5173');
  if (!raw) throw new AppError('O endereço do app ainda não foi configurado no servidor.', 503);
  return new URL(raw).origin;
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const allowed = new Set([appOrigin()]);
  if (process.env.NODE_ENV !== 'production') { allowed.add('http://localhost:5173'); allowed.add('http://127.0.0.1:5173'); }
  if (!origin || !allowed.has(origin)) throw new AppError('Origem da solicitação inválida.', 403);
}
export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}
export function failure(error: unknown) {
  if (error instanceof AppError) return json({ error: error.message }, error.status);
  // Do not log database URLs, OAuth responses, passwords, or provider tokens.
  console.error('elo_request_failed', error instanceof Error ? error.name : 'UnknownError');
  return json({ error: 'Não foi possível concluir. Tente novamente em instantes.' }, 500);
}
export async function body(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new AppError('Envie os dados como JSON.', 415);
  const text = await request.text();
  if (text.length > 16_384) throw new AppError('Solicitação muito grande.', 413);
  try { const value = JSON.parse(text); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value; }
  catch { throw new AppError('Dados inválidos.'); }
}
