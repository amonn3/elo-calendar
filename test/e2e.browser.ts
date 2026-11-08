// Optional browser verification: npm test -- --browser (requires the local server).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
test('real browser: login gate, signup, empty calendar, theme persistence, logout, and mobile layout', {timeout:90_000}, async()=>{
 const base='http://127.0.0.1:5173';const first=await fetch(base,{redirect:'manual'});assert.equal(first.status,307);assert.equal(new URL(first.headers.get('location')!,base).pathname,'/login');
 assert.equal((await fetch(`${base}/api/calendar?from=2026-11-01&to=2026-12-01`)).status,401);
 const cache=join(homedir(),'.cache/ms-playwright');const versions=existsSync(cache)?readdirSync(cache).filter(n=>/^chromium-\d+$/.test(n)).sort().reverse():[];
 const executable=process.env.ELO_CHROME_PATH||versions.map(v=>join(cache,v,'chrome-linux64/chrome')).find(existsSync);
 assert.ok(executable,'Provide ELO_CHROME_PATH to an installed Chrome executable.');
 const profile=mkdtempSync(join(tmpdir(),'elo-browser-'));const child=spawn(executable,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
 let ws:WebSocket|undefined;let sessionId='';let sequence=0;let testEmail='';const pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void}>();
 try{
  const endpoint=await new Promise<string>((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(new Error('Chrome startup timed out.')),15000);child.stderr.on('data',chunk=>{output+=chunk.toString();const match=output.match(/DevTools listening on (ws:\/\/\S+)/);if(match){clearTimeout(timer);resolve(match[1]);}});child.once('error',reject);child.once('exit',code=>reject(new Error(`Chrome exited: ${code}`)));});
  ws=new WebSocket(endpoint);await new Promise<void>((resolve,reject)=>{ws!.addEventListener('open',()=>resolve(),{once:true});ws!.addEventListener('error',()=>reject(new Error('CDP connection failed.')),{once:true});});
  ws.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(message.id){const call=pending.get(message.id);if(call){pending.delete(message.id);message.error?call.reject(new Error(message.error.message)):call.resolve(message.result);}}});
  const send=(method:string,params:Record<string,unknown>={},page=true):Promise<any>=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws!.send(JSON.stringify({id,method,params,...(page&&sessionId?{sessionId}:{})}));});
  const target=await send('Target.createTarget',{url:'about:blank'},false);sessionId=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},false)).sessionId;
  await send('Page.enable');await send('Runtime.enable');
  const evaluate=async(expression:string)=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value;};
  const waitFor=async(expression:string)=>{const deadline=Date.now()+25000;while(Date.now()<deadline){if(await evaluate(`Boolean(${expression})`))return;await new Promise(r=>setTimeout(r,100));}throw new Error(`Browser condition timed out: ${expression}`);};
  mkdirSync('outputs',{recursive:true});
  const screenshot=async(name:string)=>{const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`outputs/${name}.png`,Buffer.from(r.data,'base64'));};
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:`${base}/login`});await waitFor("document.querySelector('#email') && document.querySelector('.login-tabs')");
  await screenshot('login-light');
  await evaluate("[...document.querySelectorAll('.login-tabs button')].find(b=>b.textContent==='Criar conta').click()");await waitFor("document.querySelector('#name')");
  testEmail=`browser-${randomUUID()}@example.invalid`;
  const password=randomUUID()+randomUUID();
  await evaluate(`document.querySelector('#name').value='Browser QA';document.querySelector('#email').value=${JSON.stringify(testEmail)};document.querySelector('#password').value=${JSON.stringify(password)};document.querySelector('form').requestSubmit()`);
  await waitFor("location.pathname==='/' && document.querySelector('.onboarding-card')");
  assert.equal(await evaluate("document.querySelectorAll('.event').length"),0);
  await evaluate("document.querySelector('[role=switch]').click()");await waitFor("document.documentElement.dataset.theme==='dark'");await new Promise(r=>setTimeout(r,200));await screenshot('calendar-dark-empty');
  await send('Page.reload');await waitFor("document.querySelector('.onboarding-card') && document.querySelector('[role=switch]').getAttribute('aria-checked')==='true'");
  await evaluate("document.querySelector('[aria-label=\"Seu perfil\"]').click()");await waitFor("document.querySelector('.profile-email')");
  await evaluate("[...document.querySelectorAll('.modal button')].find(b=>b.textContent.includes('Sair da minha conta')).click()");await waitFor("location.pathname==='/login' && document.querySelector('#email')");
  const protectedResponse=await evaluate("fetch('/api/calendar?from=2026-11-01&to=2026-12-01').then(r=>r.status)");assert.equal(protectedResponse,401);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await screenshot('login-mobile-dark');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
 }finally{
  ws?.close();child.kill('SIGTERM');
  if(testEmail){const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync('.data/elo.sqlite');db.exec('PRAGMA foreign_keys=ON');db.prepare('DELETE FROM users WHERE email=?').run(testEmail);db.close();}
  await new Promise(r=>setTimeout(r,300));rmSync(profile,{recursive:true,force:true});
 }
});
