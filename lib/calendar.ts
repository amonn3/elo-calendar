export type Account = { id: string; name: string; email: string; provider: 'Google' | 'Microsoft'; color: string; visible: boolean };
export type CalendarEvent = { id: string; title: string; date: string; start: string; end: string; accountId: string; location: string; description: string };
export const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const minutes = (s: string) => Number(s.slice(0,2))*60 + Number(s.slice(3));
export function overlaps(a: CalendarEvent,b: CalendarEvent) { return a.id !== b.id && a.date===b.date && minutes(a.start)<minutes(b.end) && minutes(b.start)<minutes(a.end); }
export function weekStart(d: Date) { const n = new Date(d.getFullYear(),d.getMonth(),d.getDate()); n.setDate(n.getDate() - (n.getDay()+6)%7); return n; }
export function addDays(d: Date,n: number) { const v=new Date(d); v.setDate(v.getDate()+n); return v; }
export const initialAccounts: Account[] = [
 {id:'personal',name:'Pessoal',email:'amon@gmail.com',provider:'Google',color:'purple',visible:true},
 {id:'work',name:'Trabalho · CLT',email:'amon@empresa.com.br',provider:'Google',color:'blue',visible:true},
 {id:'international',name:'Contrato · PJ',email:'amon@international.co',provider:'Google',color:'orange',visible:true},
];
export function demoEvents(today: Date): CalendarEvent[] {
 const monday=weekStart(today); const rows: [number,string,string,string,string,string][] = [
 [0,'09:00','09:45','Weekly planning','international','Google Meet'],[0,'11:00','12:00','Alinhamento de produto','work','Google Meet'],[0,'14:00','15:00','Conversa com novo cliente','personal','Google Meet'],
 [1,'09:00','09:30','Daily com o time','work','Google Meet'],[1,'10:00','11:30','Deep work · Projeto Atlas','international',''],[1,'14:30','15:30','Discovery com cliente','personal','Google Meet'],
 [2,'09:00','09:45','Daily & sprint review','work','Google Meet'],[2,'10:00','11:00','Product sync','international','Google Meet'],[2,'10:30','11:30','Apresentação de proposta','personal','Google Meet'],[2,'14:00','15:30','Design review','work','Google Meet'],
 [3,'09:30','10:30','Planejamento da sprint','work','Google Meet'],[3,'13:00','14:00','Client check-in','international','Google Meet'],[3,'16:00','17:00','Café com Marina','personal','Café da esquina'],
 [4,'09:00','09:30','Daily com o time','work','Google Meet'],[4,'11:00','12:00','Demo & feedback','international','Google Meet'],[4,'15:00','16:00','Organizar a próxima semana','personal',''],
 [5,'10:00','11:00','Conversa com potencial cliente','personal','Google Meet'],[5,'10:30','11:15','Project handoff','international','Google Meet'],[5,'14:00','15:00','Tempo para você','personal',''],[6,'10:00','11:00','Café da manhã em família','personal','Em casa']];
 return rows.map(([day,start,end,title,accountId,location],i)=>({id:`demo-${i}`,title,date:dateKey(addDays(monday,day)),start,end,accountId,location,description:''}));
}

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
