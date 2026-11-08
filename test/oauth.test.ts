import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authAction, getSession } from '../lib/server/auth.ts';
import { startConnection, finishConnection, listConnections, ownedConnection, accessToken } from '../lib/server/connections.ts';
import { eventAction } from '../lib/server/event-actions.ts';
import { calendarKey, listCalendars, listEvents } from '../lib/server/calendar-sync.ts';
import { query } from '../lib/server/database.ts';
import { decrypt } from '../lib/server/crypto.ts';
const base='http://127.0.0.1:5173';
const req=(path:string,cookie='',method='POST',data?:unknown)=>new Request(base+path,{method,headers:{origin:base,cookie,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
let cookie='';let userId='';let connectionId='';
const remoteFetch=globalThis.fetch;
test('OAuth requires authentication and reports missing provider configuration honestly',async()=>{
 delete process.env.GOOGLE_CLIENT_ID;delete process.env.GOOGLE_CLIENT_SECRET;
 assert.equal((await startConnection(req('/api/connections/google'),'google')).status,401);
 const response=await authAction(req('/api/auth/register','','POST',{email:'oauth@example.com',name:'OAuth Owner',password:'strong-oauth-password'}),'register');assert.equal(response.status,201);cookie=response.headers.get('set-cookie')!;userId=(await getSession(cookie))!.user.id;
 assert.equal((await startConnection(req('/api/connections/google',cookie),'google')).status,503);
});
test('PKCE authorization is bound to the browser/session, cannot be replayed, and encrypts tokens',async()=>{
 process.env.GOOGLE_CLIENT_ID='test-client';process.env.GOOGLE_CLIENT_SECRET='test-secret';
 const started=await startConnection(req('/api/connections/google',cookie),'google');assert.equal(started.status,200);
 const authUrl=new URL((await started.json()).url);assert.equal(authUrl.searchParams.get('code_challenge_method'),'S256');assert.ok(authUrl.searchParams.get('code_challenge'));assert.match(authUrl.searchParams.get('prompt')! ,/select_account/);
 const state=authUrl.searchParams.get('state')!;const callback=`/api/connections/google/callback?state=${state}&code=valid-code`;const browserCookie=started.headers.get('set-cookie')!.split(';')[0];
 const wrong=await finishConnection(req(callback,cookie,'GET'),'google');assert.match(wrong.headers.get('location')!,/connection_error/);assert.equal((await listConnections(userId)).length,0);
 globalThis.fetch=(async(input:RequestInfo|URL)=>{
  const url=String(input);if(url.includes('oauth2.googleapis.com/token'))return Response.json({access_token:'provider-access-token',refresh_token:'provider-refresh-token',expires_in:3600});
  if(url.includes('/userinfo'))return Response.json({sub:'provider-owner',email:'calendar@example.com',name:'Calendar Owner'});
  throw new Error('Unexpected test request');
 }) as typeof fetch;
 try{
  const response=await finishConnection(req(callback,`${cookie}; ${browserCookie}`,'GET'),'google');assert.match(response.headers.get('location')!,/connected=1/);
  const [connection]=await listConnections(userId);connectionId=connection.id;assert.notEqual(connection.access_token,'provider-access-token');assert.equal(decrypt(connection.refresh_token),'provider-refresh-token');
  const replay=await finishConnection(req(callback,`${cookie}; ${browserCookie}`,'GET'),'google');assert.match(replay.headers.get('location')!,/connection_error/);assert.equal((await listConnections(userId)).length,1);
 }finally{globalThis.fetch=remoteFetch;}
});
test('users cannot read or mutate another user’s connected calendar',async()=>{
 const response=await authAction(req('/api/auth/register','','POST',{email:'other@example.com',name:'Other User',password:'another-strong-password'}),'register');assert.equal(response.status,201);
 const otherCookie=response.headers.get('set-cookie')!;const otherId=(await getSession(otherCookie))!.user.id;
 assert.equal((await listConnections(otherId)).length,0);await assert.rejects(()=>ownedConnection(otherId,connectionId));
 const mutation=await eventAction(req('/api/events',otherCookie,'POST',{accountId:calendarKey(connectionId,'primary')}));assert.equal(mutation.status,404);
});
test('provider calendars, pagination, recurring instances and event writes use the owned calendar',async()=>{
 const connection=await ownedConnection(userId,connectionId);const calls:{url:string;method:string;body:string}[]=[];
 globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=String(input);calls.push({url,method:init?.method||'GET',body:String(init?.body||'')});
  if(url.includes('calendarList'))return Response.json({items:[{id:'team/calendar',summary:'Team',accessRole:'writer'},{id:'holidays',summary:'Holidays',accessRole:'reader'}]});
  if(init?.method==='POST'||init?.method==='PATCH')return Response.json({id:'created'});
  if(init?.method==='DELETE')return new Response(null,{status:204});
  if(url.includes('pageToken=next'))return Response.json({items:[{id:'instance-2',summary:'Next',start:{dateTime:'2026-11-08T13:00:00Z'},end:{dateTime:'2026-11-08T14:00:00Z'}}]});
  if(url.includes('/events'))return Response.json({items:[{id:'instance-1',summary:'Daily',start:{dateTime:'2026-11-07T13:00:00Z'},end:{dateTime:'2026-11-07T14:00:00Z'}}],nextPageToken:'next'});
  throw new Error('Unexpected test request');
 }) as typeof fetch;
 try{
  const accounts=await listCalendars(connection,'provider-access-token');assert.equal(accounts.length,2);assert.equal(accounts[0].writable,true);assert.equal(accounts[1].writable,false);
  const events=await listEvents(connection,accounts[0],'provider-access-token','2026-11-01','2026-12-01');assert.equal(events.length,2);assert.equal(events[0].start,'10:00');
  const data={title:'Meeting',date:'2026-11-07',start:'10:00',end:'11:00',accountId:accounts[0].id,description:'Notes',location:'Office'};
  const created=await eventAction(req('/api/events',cookie,'POST',data));assert.equal(created.status,201);assert.ok(calls.some(c=>c.method==='POST'&&c.url.includes('team%2Fcalendar/events')&&JSON.parse(c.body).start.timeZone==='America/Fortaleza'));
  const readOnly=await eventAction(req('/api/events',cookie,'POST',{...data,accountId:accounts[1].id}));assert.equal(readOnly.status,403);
  const mismatch=await eventAction(req('/api/events',cookie,'PATCH',{...data,id:'someone-elses-id'}));assert.equal(mismatch.status,400);
 }finally{globalThis.fetch=remoteFetch;}
});
test('expired access tokens are refreshed and rotated credentials stay encrypted',async()=>{
 await query('UPDATE calendar_connections SET expires_at=$1 WHERE id=$2',[0,connectionId]);
 globalThis.fetch=(async()=>Response.json({access_token:'renewed-access',refresh_token:'rotated-refresh',expires_in:3600})) as typeof fetch;
 try{assert.equal(await accessToken(await ownedConnection(userId,connectionId)),'renewed-access');assert.equal(decrypt((await ownedConnection(userId,connectionId)).refresh_token),'rotated-refresh');}finally{globalThis.fetch=remoteFetch;}
});
