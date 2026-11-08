import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventPositions, overlaps, weekStart, addDays, dateKey } from '../lib/calendar.ts';
const event={id:'a',title:'A',date:'2026-11-07',start:'10:00',end:'11:00',accountId:'one',description:'',location:''};
test('conflicts are detected across accounts, but adjacent events do not conflict',()=>{
 assert.equal(overlaps(event,{...event,id:'b',accountId:'two',start:'10:30',end:'11:15'}),true);
 assert.equal(overlaps(event,{...event,id:'b',start:'11:00',end:'12:00'}),false);
 assert.equal(overlaps(event,{...event,id:'b',date:'2026-11-08'}),false);
 assert.equal(overlaps(event,event),false);
});
test('enclosing events conflict in both directions',()=>{
 const outer={...event,id:'b',start:'09:00',end:'12:00'};
 assert.equal(overlaps(event,outer),true);assert.equal(overlaps(outer,event),true);
});
test('all-day holidays do not conflict with each other or timed meetings',()=>{
 const holiday={...event,id:'holiday',title:'Proclamação da República',start:'00:00',end:'24:00',allDay:true};
 const otherHoliday={...holiday,id:'other-holiday',accountId:'two'};
 assert.equal(overlaps(holiday,otherHoliday),false);
 assert.equal(overlaps(holiday,event),false);
 assert.equal(overlaps(event,holiday),false);
});
test('all-day events do not take columns away from timed meetings',()=>{
 const holiday={...event,id:'holiday',start:'00:00',end:'24:00',allDay:true};
 const positions=eventPositions([holiday,event]);
 assert.deepEqual(positions.get(event.id),{column:0,columns:1});
 assert.equal(positions.has(holiday.id),false);
 assert.equal(eventPositions([holiday]).size,0);
});
test('week starts on Monday including Sunday and year boundaries',()=>{
 assert.equal(dateKey(weekStart(new Date(2026,10,8))),'2026-11-02');
 assert.equal(dateKey(weekStart(new Date(2027,0,1))),'2026-12-28');
 assert.equal(dateKey(addDays(new Date(2026,11,31),1)),'2027-01-01');
});

test('three overlaps use three columns and subsequent events reclaim the full width',()=>{
 const es=[event,{...event,id:'b',start:'10:15',end:'11:30'},{...event,id:'c',start:'10:30',end:'10:45'},{...event,id:'d',start:'12:00',end:'13:00'}];
 const positions=eventPositions(es);
 assert.deepEqual(positions.get('a'),{column:0,columns:3});
 assert.deepEqual(positions.get('c'),{column:2,columns:3});
 assert.deepEqual(positions.get('d'),{column:0,columns:1});
});
