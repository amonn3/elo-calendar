export type Account = { id: string; name: string; email: string; provider: 'Google' | 'Microsoft'; color: string; visible: boolean; connectionId?: string; calendarId?: string; writable?: boolean };
export type CalendarEvent = { id: string; title: string; date: string; start: string; end: string; accountId: string; location: string; description: string; allDay?: boolean; editable?: boolean };
export const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const minutes = (s: string) => Number(s.slice(0,2))*60 + Number(s.slice(3));
export function overlaps(a: CalendarEvent,b: CalendarEvent) { return a.id !== b.id && a.date===b.date && minutes(a.start)<minutes(b.end) && minutes(b.start)<minutes(a.end); }
export function weekStart(d: Date) { const n = new Date(d.getFullYear(),d.getMonth(),d.getDate()); n.setDate(n.getDate() - (n.getDay()+6)%7); return n; }
export function addDays(d: Date,n: number) { const v=new Date(d); v.setDate(v.getDate()+n); return v; }
// Pack connected intervals into columns so three or more overlapping events stay inside the day.
export function eventPositions(events: CalendarEvent[]) {
 const result = new Map<string, { column: number; columns: number }>();
 const sorted = [...events].sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
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
