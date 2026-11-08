import type { Account, CalendarEvent } from '../calendar.ts';
import { AppError } from './config.ts';
import { accessToken, type Connection } from './connections.ts';
import { providerFetch } from './providers.ts';
export const calendarKey = (connectionId: string, calendarId: string) => `${connectionId}:${encodeURIComponent(calendarId)}`;
export async function listCalendars(connection: Connection, token: string): Promise<Account[]> {
  const result: Account[] = [];
  if (connection.provider === 'google') {
    let pageToken = ''; let pages = 0;
    do {
      const url = new URL('https://www.googleapis.com/calendar/v3/users/me/calendarList'); url.searchParams.set('maxResults', '250'); if (pageToken) url.searchParams.set('pageToken', pageToken);
      const response = await providerFetch<{items?:{id:string;summary:string;accessRole:string;primary?:boolean}[];nextPageToken?:string}>('google', token, url.toString());
      for (const c of response.items || []) result.push({ id: calendarKey(connection.id,c.id), connectionId:connection.id, calendarId:c.id, name: c.summary || connection.name, email:connection.email, provider:'Google', color:connection.color, visible:true, writable:['owner','writer'].includes(c.accessRole) });
      pageToken=response.nextPageToken || ''; pages++;
    } while(pageToken && pages < 20);
    if(pageToken)throw new AppError('Esta conta possui agendas demais para carregar de uma vez.',502);
  } else {
    let url = 'https://graph.microsoft.com/v1.0/me/calendars?$top=100&$select=id,name,canEdit'; let pages=0;
    do {
      const response=await providerFetch<{value?:{id:string;name:string;canEdit:boolean}[];'@odata.nextLink'?:string}>('microsoft',token,url);
      for(const c of response.value||[])result.push({id:calendarKey(connection.id,c.id),connectionId:connection.id,calendarId:c.id,name:c.name,email:connection.email,provider:'Microsoft',color:connection.color,visible:true,writable:c.canEdit});
      url=response['@odata.nextLink']||'';pages++;
    }while(url&&pages<20);
    if(url)throw new AppError('Esta conta possui agendas demais para carregar de uma vez.',502);
  }
  return result;
}
export type ProviderEvent = { id:string; title:string; start:string; end:string; location?:string; description?:string; allDay?:boolean; editable:boolean };
const localParts=(iso:string)=>{
 const d=new Date(iso);if(Number.isNaN(d.getTime()))return null;
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Fortaleza',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d);
 const p=Object.fromEntries(parts.map(v=>[v.type,v.value]));return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};
};
export function normalizeEvent(raw:ProviderEvent,account:Account,from:string,to:string):CalendarEvent[]{
 if(!raw.id)return [];
 const allDay=Boolean(raw.allDay);const start=allDay?{date:raw.start.slice(0,10),time:'00:00'}:localParts(raw.start);const end=allDay?{date:raw.end.slice(0,10),time:'00:00'}:localParts(raw.end);
 if(!start||!end)return [];
 const result:CalendarEvent[]=[];let day=start.date;let count=0;
 while(day<=end.date&&day<to&&count++<370){
  const last=day===end.date;const endTime=last?end.time:'24:00';
  if(day>=from&&(!last||endTime!=='00:00'))result.push({id:`${account.id}::${encodeURIComponent(raw.id)}`,title:raw.title||'Sem título',date:day,start:day===start.date?start.time:'00:00',end:endTime,accountId:account.id,location:raw.location||'',description:raw.description||'',allDay,editable:raw.editable&&account.writable!==false&&!allDay&&start.date===end.date});
  const next=new Date(`${day}T12:00:00Z`);next.setUTCDate(next.getUTCDate()+1);day=next.toISOString().slice(0,10);
 }
 return result;
}
const graphDate=(s:string)=>/[zZ]|[+-]\d\d:\d\d$/.test(s)?s:`${s}Z`;
export async function listEvents(connection:Connection,account:Account,token:string,from:string,to:string){
 const result:CalendarEvent[]=[];
 if(connection.provider==='google'){
  let pageToken='';let pages=0;
  do{
   const url=new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(account.calendarId!)}/events`);
   Object.entries({singleEvents:'true',orderBy:'startTime',timeMin:`${from}T00:00:00-03:00`,timeMax:`${to}T00:00:00-03:00`,maxResults:'2500'}).forEach(([k,v])=>url.searchParams.set(k,v));if(pageToken)url.searchParams.set('pageToken',pageToken);
   const response=await providerFetch<{items?:{id:string;status?:string;summary?:string;description?:string;location?:string;start?:{date?:string;dateTime?:string};end?:{date?:string;dateTime?:string};eventType?:string}[];nextPageToken?:string}>('google',token,url.toString());
   for(const e of response.items||[]){if(e.status==='cancelled'||!e.start||!e.end)continue;result.push(...normalizeEvent({id:e.id,title:e.summary||'Sem título',start:e.start.dateTime||e.start.date!,end:e.end.dateTime||e.end.date!,allDay:Boolean(e.start.date),location:e.location,description:e.description,editable:!e.eventType||e.eventType==='default'},account,from,to));}
   pageToken=response.nextPageToken||'';pages++;
  }while(pageToken&&pages<10);
  if(pageToken)throw new AppError('Há eventos demais neste período. Selecione um período menor.',502);
 }else{
  const initial=new URL(`https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(account.calendarId!)}/calendarView`);
  initial.search=new URLSearchParams({startDateTime:`${from}T00:00:00-03:00`,endDateTime:`${to}T00:00:00-03:00`,'$top':'250','$select':'id,subject,start,end,location,body,isAllDay,isCancelled'}).toString();
  let url=initial.toString();let pages=0;
  do{
   const response=await providerFetch<{value?:{id:string;subject:string;start:{dateTime:string};end:{dateTime:string};location?:{displayName:string};body?:{content:string};isAllDay:boolean;isCancelled:boolean}[];'@odata.nextLink'?:string}>('microsoft',token,url);
   for(const e of response.value||[]){if(e.isCancelled)continue;result.push(...normalizeEvent({id:e.id,title:e.subject,start:graphDate(e.start.dateTime),end:graphDate(e.end.dateTime),allDay:e.isAllDay,location:e.location?.displayName,description:e.body?.content,editable:true},account,from,to));}
   url=response['@odata.nextLink']||'';pages++;
  }while(url&&pages<20);
  if(url)throw new AppError('Há eventos demais neste período. Selecione um período menor.',502);
 }
 return result;
}
export async function syncConnection(connection:Connection,from:string,to:string){
 const token=await accessToken(connection);const accounts=await listCalendars(connection,token);
 const events:CalendarEvent[]=[];const errors:string[]=[];
 // Bound provider traffic: one calendar at a time per connection.
 for(const account of accounts){try{events.push(...await listEvents(connection,account,token,from,to));}catch(error){errors.push(`${account.name}: ${error instanceof AppError?error.message:'Não foi possível carregar esta agenda.'}`);}}
 return {accounts,events,errors};
}
