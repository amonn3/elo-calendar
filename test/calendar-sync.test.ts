import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvent, calendarKey } from '../lib/server/calendar-sync.ts';
import { validateEvent } from '../lib/server/event-actions.ts';
const account={id:calendarKey('connection','calendar@example.com'),calendarId:'calendar@example.com',connectionId:'connection',provider:'Google' as const,name:'Work',email:'person@example.com',color:'blue',visible:true,writable:true};
test('provider timestamps are normalized to Fortaleza without changing the event reference',()=>{
 const [e]=normalizeEvent({id:'remote/id',title:'Meeting',start:'2026-11-07T13:00:00Z',end:'2026-11-07T14:00:00Z',editable:true},account,'2026-11-01','2026-12-01');
 assert.equal(e.start,'10:00');assert.equal(e.end,'11:00');assert.equal(e.date,'2026-11-07');assert.equal(e.id,`${account.id}::remote%2Fid`);assert.equal(e.editable,true);
});
test('multi-day events split into daily segments and cannot be accidentally truncated by editing',()=>{
 const result=normalizeEvent({id:'long',title:'Travel',start:'2026-11-07T23:00:00-03:00',end:'2026-11-08T01:00:00-03:00',editable:true},account,'2026-11-01','2026-12-01');
 assert.equal(result.length,2);assert.equal(result[0].end,'24:00');assert.equal(result[1].start,'00:00');assert.ok(result.every(e=>!e.editable));
});
test('all-day end dates are exclusive and read-only provider calendars stay read-only',()=>{
 const result=normalizeEvent({id:'holiday',title:'Holiday',start:'2026-11-07',end:'2026-11-09',allDay:true,editable:true},account,'2026-11-01','2026-12-01');
 assert.deepEqual(result.map(e=>e.date),['2026-11-07','2026-11-08']);assert.ok(result.every(e=>e.allDay&&!e.editable));
 const [readOnly]=normalizeEvent({id:'x',title:'Meeting',start:'2026-11-07T10:00:00Z',end:'2026-11-07T11:00:00Z',editable:true},{...account,writable:false},'2026-11-01','2026-12-01');assert.equal(readOnly.editable,false);
});
test('event writes reject invalid dates and inverted or out-of-range times',()=>{
 const data={title:'Meeting',date:'2026-11-07',start:'10:00',end:'11:00',accountId:account.id,location:'',description:''};
 assert.equal(validateEvent(data).title,'Meeting');
 for(const bad of [{date:'2026-02-30'},{date:'bad-date'},{start:'24:00'},{end:'09:00'},{title:'   '}])assert.throws(()=>validateEvent({...data,...bad}));
});
