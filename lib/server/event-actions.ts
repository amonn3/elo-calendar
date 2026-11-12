import { CALENDAR_TIME_ZONE, type CalendarEvent } from '../calendar.ts';
import { requireSession } from './auth.ts';
import { AppError, assertSameOrigin, body, failure, json } from './config.ts';
import { accessToken, ownedConnection } from './connections.ts';
import { listCalendars } from './calendar-sync.ts';
import { providerFetch } from './providers.ts';
export function validateEvent(data:Record<string,unknown>){
 const text=(key:string,max:number)=>{const v=data[key];if(typeof v!=='string'||v.length>max)throw new AppError('Dados do evento inválidos.');return v;};
 const event:CalendarEvent={id:typeof data.id==='string'?data.id:'',accountId:text('accountId',4096),title:text('title',150).trim(),date:text('date',10),start:text('start',5),end:text('end',5),description:text('description',8000),location:text('location',2000)};
 const parsedDate=new Date(`${event.date}T12:00:00Z`);
 if(!event.title||!Number.isFinite(parsedDate.getTime())||!/^\d{4}-\d{2}-\d{2}$/.test(event.date)||parsedDate.toISOString().slice(0,10)!==event.date||!/^([01]\d|2[0-3]):[0-5]\d$/.test(event.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(event.end)||event.end<=event.start)throw new AppError('Informe título, data e horários válidos. O término deve ser após o início.');
 return event;
}
export async function eventAction(request:Request){
 try{
  assertSameOrigin(request);const {user}=await requireSession(request);const data=await body(request);
  const accountId=typeof data.accountId==='string'?data.accountId:'';const connectionId=accountId.split(':')[0];
  const connection=await ownedConnection(user.id,connectionId);const token=await accessToken(connection);
  const account=(await listCalendars(connection,token)).find(a=>a.id===accountId);
  if(!account||!account.writable)throw new AppError('Esta agenda não permite alterações.',403);
  const id=typeof data.id==='string'?data.id:'';const prefix=`${accountId}::`;
  if(request.method!=='POST'&&(!id.startsWith(prefix)||!id.slice(prefix.length)))throw new AppError('Evento inválido.');
  let remoteId='';if(id){try{remoteId=decodeURIComponent(id.slice(prefix.length));}catch{throw new AppError('Evento inválido.');}}
  const base=connection.provider==='google'?`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(account.calendarId!)}/events`:`https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(account.calendarId!)}/events`;
  const url=request.method==='POST'?base:`${base}/${encodeURIComponent(remoteId)}`;
  if(request.method==='DELETE'){await providerFetch(connection.provider,token,url,{method:'DELETE'});return json({ok:true});}
  const e=validateEvent(data);const start=`${e.date}T${e.start}:00`;const end=`${e.date}T${e.end}:00`;
  const payload=connection.provider==='google'?{summary:e.title,description:e.description,location:e.location,start:{dateTime:`${start}-03:00`,timeZone:CALENDAR_TIME_ZONE},end:{dateTime:`${end}-03:00`,timeZone:CALENDAR_TIME_ZONE}}:{subject:e.title,body:{contentType:'text',content:e.description},location:{displayName:e.location},start:{dateTime:new Date(`${start}-03:00`).toISOString().slice(0,19),timeZone:'UTC'},end:{dateTime:new Date(`${end}-03:00`).toISOString().slice(0,19),timeZone:'UTC'}};
  await providerFetch(connection.provider,token,url,{method:request.method==='POST'?'POST':'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  return json({ok:true},request.method==='POST'?201:200);
 }catch(error){return failure(error);}
}
