import { startConnection } from '../../../../lib/server/connections';
export const runtime = 'nodejs';
export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) { return startConnection(request, (await context.params).provider); }
import { requireSession } from '../../../../lib/server/auth';
import { assertSameOrigin, failure, json } from '../../../../lib/server/config';
import { query } from '../../../../lib/server/database';
export async function DELETE(request: Request, context: { params: Promise<{ provider: string }> }) {
  try { assertSameOrigin(request); const { user } = await requireSession(request); const { provider: id } = await context.params; await query('DELETE FROM calendar_connections WHERE id=$1 AND user_id=$2', [id, user.id]); return json({ ok: true }); }
  catch(error) { return failure(error); }
}
