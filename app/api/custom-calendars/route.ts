import { requireSession } from '../../../lib/server/auth';
import { assertSameOrigin, body, failure, json } from '../../../lib/server/config';
import { createCustomCalendar } from '../../../lib/server/custom-calendars';
import { REPORT_MAX_LENGTH } from '../../../lib/report-parser';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try { assertSameOrigin(request); const { user } = await requireSession(request); return json(await createCustomCalendar(user.id, await body(request, REPORT_MAX_LENGTH + 4096)), 201); }
  catch (error) { return failure(error); }
}
