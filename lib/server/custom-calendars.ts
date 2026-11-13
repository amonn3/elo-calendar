import { randomUUID } from 'node:crypto';
import { calendarToday, type Account, type CalendarEvent } from '../calendar.ts';
import { parseReport, type ReportEvent } from '../report-parser.ts';
import { AppError } from './config.ts';
import { query, transaction } from './database.ts';
// Custom calendars live only in elo. Their account ids carry this prefix so event actions never confuse them with a provider connection (connection ids are UUIDs).
export const CUSTOM_PREFIX = 'custom:';
export const CUSTOM_COLORS = ['rose', 'teal', 'slate', 'olive'] as const;
export const customAccountId = (calendarId: string) => `${CUSTOM_PREFIX}${calendarId}`;
type CalendarRow = { id: string; user_id: string; name: string; color: string; created_at: number };
type EventRow = { id: string; calendar_id: string; title: string; event_date: string; start_time: string; end_time: string; location: string; description: string };
type Query = typeof query;
const toAccount = (c: CalendarRow): Account => ({ id: customAccountId(c.id), calendarId: c.id, name: c.name, email: 'Importada de relatório', provider: 'Importada', color: c.color, visible: true, writable: true });
const toEvent = (e: EventRow): CalendarEvent => ({ id: `${customAccountId(e.calendar_id)}::${e.id}`, accountId: customAccountId(e.calendar_id), title: e.title, date: e.event_date, start: e.start_time, end: e.end_time, location: e.location, description: e.description, editable: true });
export function validateName(value: unknown) {
  const name = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (!name || name.length > 60) throw new AppError('Dê à agenda um nome de até 60 caracteres.');
  return name;
}
export function validateColor(value: unknown) {
  if (typeof value !== 'string' || !(CUSTOM_COLORS as readonly string[]).includes(value)) throw new AppError('Escolha uma das cores disponíveis.');
  return value;
}
export function parseImport(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) throw new AppError('Cole o relatório ou envie um arquivo .md.');
  const report = parseReport(value, calendarToday().getFullYear());
  if (!report.events.length) throw new AppError(report.warnings[0] || 'Nenhuma reunião foi reconhecida no relatório.');
  return report;
}
export async function ownedCustomCalendar(userId: string, id: string, run: Query = query) {
  const [c] = await run<CalendarRow>('SELECT * FROM custom_calendars WHERE id=$1 AND user_id=$2', [id, userId]);
  if (!c) throw new AppError('Agenda não encontrada.', 404);
  return c;
}
async function insertEvents(run: Query, userId: string, calendarId: string, events: ReportEvent[]) {
  const now = Date.now();
  for (let i = 0; i < events.length; i += 100) {
    const chunk = events.slice(i, i + 100); const params: unknown[] = [];
    const rows = chunk.map(e => { const b = params.length; params.push(randomUUID(), calendarId, userId, e.title, e.date, e.start, e.end, '', '', now); return `(${Array.from({ length: 10 }, (_, k) => `$${b + k + 1}`).join(',')})`; });
    await run(`INSERT INTO custom_events (id,calendar_id,user_id,title,event_date,start_time,end_time,location,description,created_at) VALUES ${rows.join(',')}`, params);
  }
}
export async function listCustomCalendars(userId: string, from: string, to: string) {
  const calendars = await query<CalendarRow>('SELECT * FROM custom_calendars WHERE user_id=$1 ORDER BY created_at, id', [userId]);
  // `to` is exclusive, matching the provider queries.
  const events = calendars.length ? await query<EventRow>('SELECT * FROM custom_events WHERE user_id=$1 AND event_date>=$2 AND event_date<$3 ORDER BY event_date, start_time', [userId, from, to]) : [];
  return { accounts: calendars.map(toAccount), events: events.map(toEvent) };
}
export async function createCustomCalendar(userId: string, data: Record<string, unknown>) {
  const name = validateName(data.name); const color = validateColor(data.color); const report = parseImport(data.text);
  const id = randomUUID();
  await transaction(async run => {
    await run('INSERT INTO custom_calendars (id,user_id,name,color,created_at) VALUES ($1,$2,$3,$4,$5)', [id, userId, name, color, Date.now()]);
    await insertEvents(run, userId, id, report.events);
  });
  return { id, imported: report.events.length, warnings: report.warnings };
}
export async function updateCustomCalendar(userId: string, id: string, data: Record<string, unknown>) {
  const current = await ownedCustomCalendar(userId, id);
  const name = data.name === undefined ? current.name : validateName(data.name); const color = data.color === undefined ? current.color : validateColor(data.color);
  await query('UPDATE custom_calendars SET name=$1, color=$2 WHERE id=$3 AND user_id=$4', [name, color, id, userId]);
  return { id, name, color };
}
export async function deleteCustomCalendar(userId: string, id: string) {
  await ownedCustomCalendar(userId, id);
  // Its events go with it through ON DELETE CASCADE (SQLite runs with foreign_keys on).
  await query('DELETE FROM custom_calendars WHERE id=$1 AND user_id=$2', [id, userId]);
}
// A new report for the same calendar replaces every event inside its period (edits included) and keeps everything outside it.
export async function reimportCustomCalendar(userId: string, id: string, data: Record<string, unknown>) {
  const report = parseImport(data.text);
  const replaced = await transaction(async run => {
    await ownedCustomCalendar(userId, id, run);
    const removed = await run('DELETE FROM custom_events WHERE calendar_id=$1 AND user_id=$2 AND event_date>=$3 AND event_date<=$4 RETURNING id', [id, userId, report.from, report.to]);
    await insertEvents(run, userId, id, report.events);
    return removed.length;
  });
  return { id, imported: report.events.length, replaced, from: report.from, to: report.to, warnings: report.warnings };
}
export async function saveCustomEvent(userId: string, calendarId: string, event: CalendarEvent) {
  await ownedCustomCalendar(userId, calendarId);
  if (!event.id) {
    await query('INSERT INTO custom_events (id,calendar_id,user_id,title,event_date,start_time,end_time,location,description,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [randomUUID(), calendarId, userId, event.title, event.date, event.start, event.end, event.location, event.description, Date.now()]);
    return;
  }
  const updated = await query('UPDATE custom_events SET title=$1, event_date=$2, start_time=$3, end_time=$4, location=$5, description=$6 WHERE id=$7 AND calendar_id=$8 AND user_id=$9 RETURNING id', [event.title, event.date, event.start, event.end, event.location, event.description, localEventId(calendarId, event.id), calendarId, userId]);
  if (!updated.length) throw new AppError('Evento não encontrado.', 404);
}
export async function deleteCustomEvent(userId: string, calendarId: string, id: string) {
  const removed = await query('DELETE FROM custom_events WHERE id=$1 AND calendar_id=$2 AND user_id=$3 RETURNING id', [localEventId(calendarId, id), calendarId, userId]);
  if (!removed.length) throw new AppError('Evento não encontrado.', 404);
}
function localEventId(calendarId: string, id: string) {
  const prefix = `${customAccountId(calendarId)}::`;
  if (!id.startsWith(prefix) || !id.slice(prefix.length)) throw new AppError('Evento inválido.');
  return id.slice(prefix.length);
}
