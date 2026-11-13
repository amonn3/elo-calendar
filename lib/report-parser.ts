// Parses a plain-text or Markdown meeting report ("Relatório de reuniões") into calendar-zone events.
// Pure and dependency-free: the browser uses it for the preview and the server re-parses before saving.
export type ReportEvent = { date: string; start: string; end: string; title: string };
export type ParsedReport = { title: string; from: string; to: string; events: ReportEvent[]; warnings: string[]; expectedTotal: number | null };
export const REPORT_MAX_LENGTH = 100_000;
export const REPORT_MAX_EVENTS = 1_000;
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const pad = (n: number) => String(n).padStart(2, '0');
const key = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
function validDate(y: number, m: number, d: number) { const v = new Date(Date.UTC(y, m - 1, d)); return v.getUTCFullYear() === y && v.getUTCMonth() === m - 1 && v.getUTCDate() === d; }
const fullYear = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));
// Markdown decoration (headings, bullets, quotes, bold/italic) never carries meaning in these reports.
const clean = (line: string) => line.replace(/^\s*(#{1,6}\s+|>\s*|[-*+]\s+(?=\S))+/, '').replace(/(\*\*|__)/g, '').replace(/\s+/g, ' ').trim();
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const HEADER = /(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?\s*(?:a|até|-|–|—)\s*(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})/i;
const DAY = /^([a-zà-ú]{3})[a-zà-ú-]*\.?,?\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?$/i;
const TIME = String.raw`(\d{1,2})(?:[h:](\d{2})?)`;
const EVENT = new RegExp(String.raw`^${TIME}\s*(?:–|—|-|a|às|até)\s*${TIME}\s*(?:·|•|\||-|–|—|:)\s*(.+)$`, 'i');
const time = (h: string, m = '0') => { const hh = Number(h), mm = Number(m); return hh <= 23 && mm <= 59 ? `${pad(hh)}:${pad(mm)}` : null; };

export function parseReport(text: string, referenceYear = new Date().getFullYear()): ParsedReport {
  const warnings: string[] = []; const events: ReportEvent[] = []; const seen = new Set<string>();
  let title = ''; let from = ''; let to = ''; let expectedTotal: number | null = null;
  let day = ''; let previous: { y: number; m: number } | null = null;
  if (text.length > REPORT_MAX_LENGTH) return { title, from, to, events, warnings: ['O relatório é grande demais. Divida-o em partes menores.'], expectedTotal };
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  for (const [index, raw] of lines.entries()) {
    const line = clean(raw); const n = index + 1;
    if (!line || /^semana\s+\d+$/i.test(line) || /^(-{3,}|\*{3,}|_{3,})$/.test(line)) continue;
    const header = !from && line.match(HEADER);
    if (header && !line.match(EVENT)) {
      const endYear = fullYear(header[6]); const [sd, sm, ed, em] = [header[1], header[2], header[4], header[5]].map(Number);
      const startYear = header[3] ? fullYear(header[3]) : sm > em ? endYear - 1 : endYear;
      if (validDate(startYear, sm, sd) && validDate(endYear, em, ed) && key(startYear, sm, sd) <= key(endYear, em, ed)) {
        from = key(startYear, sm, sd); to = key(endYear, em, ed); previous = { y: startYear, m: sm };
        title = line.slice(0, header.index).replace(/[\s:–—-]+$/, '').trim();
      } else warnings.push(`Linha ${n}: período inválido no cabeçalho.`);
      continue;
    }
    const total = line.match(/^total\s*:?\s*(\d+)\b/i);
    if (total) { expectedTotal = Number(total[1]); continue; }
    const d = line.match(DAY);
    if (d && WEEKDAYS.includes(fold(d[1]))) {
      const dd = Number(d[2]), mm = Number(d[3]);
      // Without an explicit year, follow the report period and roll over when the months wrap (December → January).
      let y = d[4] ? fullYear(d[4]) : previous ? (mm < previous.m ? previous.y + 1 : previous.y) : referenceYear;
      if (!d[4] && from && key(y, mm, dd) < from) y = Number(from.slice(0, 4)) + (Number(from.slice(5, 7)) > mm ? 1 : 0);
      if (!validDate(y, mm, dd)) { warnings.push(`Linha ${n}: a data ${line} não existe.`); day = ''; continue; }
      day = key(y, mm, dd); previous = { y, m: mm };
      const weekday = WEEKDAYS[new Date(Date.UTC(y, mm - 1, dd)).getUTCDay()];
      if (fold(d[1]) !== weekday) warnings.push(`Linha ${n}: ${line} não cai em ${d[1]} — conferi pela data.`);
      if (from && to && (day < from || day > to)) warnings.push(`Linha ${n}: ${line} está fora do período do relatório.`);
      continue;
    }
    const e = line.match(EVENT);
    if (e) {
      if (!day) { warnings.push(`Linha ${n}: evento antes de qualquer dia — ignorado.`); continue; }
      const start = time(e[1], e[2]); const end = time(e[3], e[4]); const name = e[5].trim().slice(0, 150);
      if (!start || !end) { warnings.push(`Linha ${n}: horário inválido — ignorado.`); continue; }
      if (end <= start) { warnings.push(`Linha ${n}: o término deve ser após o início — ignorado.`); continue; }
      const id = `${day}|${start}|${end}|${name}`;
      if (seen.has(id)) { warnings.push(`Linha ${n}: “${name}” repetido no mesmo horário — ignorado.`); continue; }
      if (events.length >= REPORT_MAX_EVENTS) { warnings.push(`O relatório passa de ${REPORT_MAX_EVENTS} eventos; os demais foram ignorados.`); break; }
      seen.add(id); events.push({ date: day, start, end, title: name }); continue;
    }
    if (!title && !events.length && !day) { title = line.slice(0, 150); continue; }
    warnings.push(`Linha ${n}: não reconhecida — “${line.slice(0, 60)}”.`);
  }
  if (!from && events.length) { const dates = events.map(e => e.date).sort(); from = dates[0]; to = dates[dates.length - 1]; }
  if (expectedTotal !== null && expectedTotal !== events.length) warnings.push(`O relatório informa ${expectedTotal} reuniões, mas ${events.length} foram reconhecidas.`);
  return { title, from, to, events, warnings, expectedTotal };
}
