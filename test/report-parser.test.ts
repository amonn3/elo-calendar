import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReport } from '../lib/report-parser.ts';
const report = `Relatório de reuniões: 13/11 a 13/12/2026

Semana 1
Sex 13/11

09h30–09h45 · Daily
15h00–15h30 · Review :: Fopag & Talent Management
15h30–16h00 · Retro :: Fopag & Talent Management
16h00–16h30 · Planning :: Fopag & Talent management

Semana 2
Seg 16/11

09h30–09h45 · Daily

Ter 17/11

09h30–09h45 · Daily

Qua 18/11

09h30–09h45 · Daily

Qui 19/11

09h30–09h45 · Daily

Sex 20/11

09h30–09h45 · Daily
15h00–15h30 · Review :: Fopag & Talent Management
15h30–16h00 · Retro :: Fopag & Talent Management
16h00–16h30 · Planning :: Fopag & Talent management

Semana 3
Seg 23/11

09h30–09h45 · Daily
14h30–15h00 · 1:1 - Amon e Ventrilho

Ter 24/11

09h30–09h45 · Daily

Qua 25/11

09h30–09h45 · Daily

Qui 26/11

09h00–11h30 · Improvement Day
09h30–09h45 · Daily
14h00–14h30 · 📌 Papo com o Presidente - Novembro

Sex 27/11

09h30–09h45 · Daily
15h00–15h30 · Review :: Fopag & Talent Management
15h30–16h00 · Retro :: Fopag & Talent Management
16h00–16h30 · Planning :: Fopag & Talent management

Sáb 28/11

08h00–13h00 · Convenção LG 2026 – Faça o extraordinário! ▶️

Semana 4
Seg 30/11

09h30–09h45 · Daily

Ter 01/12

09h30–09h45 · Daily

Qua 02/12

09h30–09h45 · Daily

Qui 03/12

09h30–09h45 · Daily

Sex 04/12

09h30–09h45 · Daily
15h00–15h30 · Review :: Fopag & Talent Management
15h30–16h00 · Retro :: Fopag & Talent Management
16h00–16h30 · Planning :: Fopag & Talent management

Semana 5
Seg 07/12

09h30–09h45 · Daily
14h30–15h00 · 1:1 - Amon e Ventrilho

Ter 08/12

09h30–09h45 · Daily

Qua 09/12

09h30–09h45 · Daily

Qui 10/12

09h00–11h30 · Improvement Day
09h30–09h45 · Daily

Sex 11/12

09h30–09h45 · Daily
15h00–15h30 · Review :: Fopag & Talent Management
15h30–16h00 · Retro :: Fopag & Talent Management
16h00–16h30 · Planning :: Fopag & Talent management

Total: 42 reuniões
`;
test('the monthly meeting report parses into 42 events matching its own total, with no warnings',()=>{
 const r=parseReport(report,2020);
 assert.equal(r.events.length,42);assert.equal(r.expectedTotal,42);assert.deepEqual(r.warnings,[]);
 assert.equal(r.title,'Relatório de reuniões');assert.equal(r.from,'2026-11-13');assert.equal(r.to,'2026-12-13');
 assert.deepEqual(r.events[0],{date:'2026-11-13',start:'09:30',end:'09:45',title:'Daily'});
 assert.deepEqual(r.events.find(e=>e.date==='2026-11-23'&&e.start==='14:30'),{date:'2026-11-23',start:'14:30',end:'15:00',title:'1:1 - Amon e Ventrilho'});
 assert.equal(r.events.find(e=>e.date==='2026-11-26'&&e.start==='14:00')?.title,'📌 Papo com o Presidente - Novembro');
 assert.equal(r.events.find(e=>e.date==='2026-11-28')?.title,'Convenção LG 2026 – Faça o extraordinário! ▶️');
 assert.equal(r.events.at(-1)?.date,'2026-12-11');
});
test('days without a year roll over from December to January, and Markdown decoration is ignored',()=>{
 const r=parseReport('# Relatório: 28/12/2026 a 05/01/2027\n\n## **Seg 28/12**\n- 10h–11h · Fechamento\n\n### Ter 05/01\n* 09:00 - 09:30 | Kickoff',2020);
 assert.deepEqual(r.warnings,[]);
 assert.deepEqual(r.events,[{date:'2026-12-28',start:'10:00',end:'11:00',title:'Fechamento'},{date:'2027-01-05',start:'09:00',end:'09:30',title:'Kickoff'}]);
});
test('a report without a header uses the reference year and derives its period from the events',()=>{
 const r=parseReport('Qui 12/11\n14h00–15h00 · Sync',2026);
 assert.equal(r.from,'2026-11-12');assert.equal(r.to,'2026-11-12');assert.equal(r.events.length,1);assert.deepEqual(r.warnings,[]);
});
test('bad lines become warnings instead of silently wrong events',()=>{
 const r=parseReport('Relatório: 01/11 a 30/11/2026\n10h00–11h00 · Órfão\nSeg 31/11\nTer 03/11\n11h00–10h00 · Invertido\n25h00–26h00 · Impossível\n10h00–11h00 · Ok\n10h00–11h00 · Ok\nalgo estranho\nTotal: 5',2026);
 assert.deepEqual(r.events,[{date:'2026-11-03',start:'10:00',end:'11:00',title:'Ok'}]);
 assert.equal(r.warnings.length,7);
 assert.match(r.warnings.join('\n'),/antes de qualquer dia/);assert.match(r.warnings.join('\n'),/não existe/);assert.match(r.warnings.join('\n'),/término/);
 assert.match(r.warnings.join('\n'),/horário inválido/);assert.match(r.warnings.join('\n'),/repetido/);assert.match(r.warnings.join('\n'),/não reconhecida/);assert.match(r.warnings.join('\n'),/informa 5 reuniões, mas 1/);
});
test('a weekday that does not match the date is flagged but the date wins',()=>{
 const r=parseReport('Relatório: 01/11 a 30/11/2026\nSeg 13/11\n09h30–09h45 · Daily',2026);
 assert.equal(r.events[0].date,'2026-11-13');assert.equal(r.warnings.length,1);assert.match(r.warnings[0],/não cai em Seg/);
});
