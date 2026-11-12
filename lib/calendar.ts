export type Account = { id: string; name: string; email: string; provider: 'Google' | 'Microsoft'; color: string; visible: boolean; connectionId?: string; calendarId?: string; writable?: boolean };
export type CalendarEvent = { id: string; title: string; date: string; start: string; end: string; accountId: string; location: string; description: string; allDay?: boolean; editable?: boolean };
export const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const minutes = (s: string) => Number(s.slice(0,2))*60 + Number(s.slice(3));
// The grid is laid out in this fixed zone (labelled GMT−3), so "now" must be read in it too, not in the server's or browser's zone.
export const CALENDAR_TIME_ZONE = 'America/Fortaleza';
export function zonedClock(at: Date, timeZone = CALENDAR_TIME_ZONE) {
 const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at).map(v=>[v.type,v.value]));
 return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour)*60 + Number(p.minute) };
}
// Local-midnight Date for a YYYY-MM-DD key, so dateKey() and the grid helpers round-trip it in any runtime zone.
export function dateFromKey(key: string) { const [y,m,d]=key.split('-').map(Number); return new Date(y,m-1,d); }
// "Today" as the calendar zone sees it: on a UTC server, 21:00–23:59 in GMT−3 is already tomorrow.
export const calendarToday = (at = new Date()) => dateFromKey(zonedClock(at).date);
// All-day entries (including holidays) provide context without reserving a meeting time.
export function overlaps(a: CalendarEvent,b: CalendarEvent) { return !a.allDay && !b.allDay && a.id !== b.id && a.date===b.date && minutes(a.start)<minutes(b.end) && minutes(b.start)<minutes(a.end); }
export function weekStart(d: Date) { const n = new Date(d.getFullYear(),d.getMonth(),d.getDate()); n.setDate(n.getDate() - (n.getDay()+6)%7); return n; }
export function addDays(d: Date,n: number) { const v=new Date(d); v.setDate(v.getDate()+n); return v; }
// Pack connected intervals into columns so three or more overlapping events stay inside the day.
export function eventPositions(events: CalendarEvent[]) {
 const result = new Map<string, { column: number; columns: number }>();
 const sorted = events.filter(e=>!e.allDay).sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
 let group: CalendarEvent[] = []; let groupEnd = -1;
 function flush() {
  const ends: number[] = []; const positions: {id:string;column:number}[] = [];
  for (const e of group) {
   let column = ends.findIndex(end=>end<=minutes(e.start));
   if (column<0) column=ends.length;
   ends[column]=minutes(e.end);positions.push({id:e.id,column});
  }
  for(const p of positions)result.set(p.id,{column:p.column,columns:ends.length});
 }
 for(const e of sorted) {
  if(group.length && minutes(e.start)>=groupEnd){flush();group=[];groupEnd=-1;}
  group.push(e);groupEnd=Math.max(groupEnd,minutes(e.end));
 }
 flush();return result;
}
