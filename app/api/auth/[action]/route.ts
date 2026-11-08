import { authAction } from '../../../../lib/server/auth';
export const runtime = 'nodejs';
export async function POST(request: Request, context: { params: Promise<{ action: string }> }) { return authAction(request, (await context.params).action); }
