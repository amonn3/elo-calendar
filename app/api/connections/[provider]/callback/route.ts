import { finishConnection } from '../../../../../lib/server/connections';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) { return finishConnection(request, (await context.params).provider); }
