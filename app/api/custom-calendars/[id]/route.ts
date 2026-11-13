import { requireSession } from '../../../../lib/server/auth';
import { assertSameOrigin, body, failure, json } from '../../../../lib/server/config';
import { deleteCustomCalendar, updateCustomCalendar } from '../../../../lib/server/custom-calendars';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  try { assertSameOrigin(request); const { user } = await requireSession(request); return json(await updateCustomCalendar(user.id, (await context.params).id, await body(request))); }
  catch (error) { return failure(error); }
}
export async function DELETE(request: Request, context: Context) {
  try { assertSameOrigin(request); const { user } = await requireSession(request); await deleteCustomCalendar(user.id, (await context.params).id); return json({ ok: true }); }
  catch (error) { return failure(error); }
}
