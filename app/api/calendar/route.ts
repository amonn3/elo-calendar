import { requireSession } from '../../../lib/server/auth';
import { AppError, failure, json } from '../../../lib/server/config';
import { listConnections, publicConnection } from '../../../lib/server/connections';
import { syncConnection } from '../../../lib/server/calendar-sync';
import { listCustomCalendars } from '../../../lib/server/custom-calendars';
import { providerStatus } from '../../../lib/server/providers';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request:Request){
 try{
  const {user}=await requireSession(request);const url=new URL(request.url);const from=url.searchParams.get('from')||'';const to=url.searchParams.get('to')||'';
  const fromMs=Date.parse(from),toMs=Date.parse(to);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||!Number.isFinite(fromMs)||!Number.isFinite(toMs)||toMs<=fromMs||toMs-fromMs>45*86400000)throw new AppError('O período precisa ter entre 1 e 45 dias.');
  const [connections,custom]=await Promise.all([listConnections(user.id),listCustomCalendars(user.id,from,to)]);
  const results=await Promise.all(connections.map(async c=>{try{return await syncConnection(c,from,to);}catch(error){return {accounts:[],events:[],errors:[`${c.email}: ${error instanceof AppError?error.message:'Não foi possível carregar esta conta.'}`]};}}));
  return json({connections:connections.map(publicConnection),accounts:[...results.flatMap(r=>r.accounts),...custom.accounts],events:[...results.flatMap(r=>r.events),...custom.events],errors:results.flatMap(r=>r.errors),providers:providerStatus(),syncedAt:new Date().toISOString()});
 }catch(error){return failure(error);}
}
