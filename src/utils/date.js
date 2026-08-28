import { getEffectiveDate, getEventOccurrencesInRange, getYearlyOccurrenceInYear } from './event.js';

export function combineDateTime(dateStr, timeStr) { return new Date(`${dateStr}T${timeStr || '00:00'}:00`); }

export function addMonths(d, n) {
  const day = d.getDate();
  const r = new Date(d);
  r.setDate(1); // 先把日期歸零到 1 號，換月的當下才不會因為原本的日還在，觸發同一種溢位
  r.setMonth(r.getMonth() + n);
  const daysInTargetMonth = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(day, daysInTargetMonth));
  return r;
}

export function addYears(d, n) {
  // 同樣的溢位陷阱在「加年」也會發生，最典型的是閏年 2/29 加 1 年到平年——平年沒有 2/29，
  // 會被自動推到 3/1。修法同上：換年時先歸零到 1 號，再依目標年份「同一個月」實際天數夾回去。
  const month = d.getMonth();
  const day = d.getDate();
  const r = new Date(d);
  r.setDate(1);
  r.setFullYear(r.getFullYear() + n);
  const daysInTargetMonth = new Date(r.getFullYear(), month + 1, 0).getDate();
  r.setMonth(month, Math.min(day, daysInTargetMonth));
  return r;
}

export function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

export function isoDateStr(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

export function isDateBeforeToday(d, now) {
  const dOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return dOnly < nowOnly;
}

export function buildMonthCells(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ day: daysInPrevMonth - startWeekday + 1 + i, inMonth: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, inMonth: true });
  let trailing = 1;
  while (cells.length % 7 !== 0) cells.push({ day: trailing++, inMonth: false });
  return cells;
}

export function computeEventsByDayForMonth(events, year, month) {
  const map = {};
  const firstOfMonth = new Date(year, month, 1);
  events.forEach(ev => {
    const occ = ev.repeat && ev.repeatUnit === 'month'
      ? getEffectiveDate(ev, firstOfMonth)
      : getYearlyOccurrenceInYear(ev, year);
    if (occ.getFullYear() === year && occ.getMonth() === month) {
      const d = occ.getDate();
      (map[d] = map[d] || []).push(ev);
    }
  });
  return map;
}

export function shiftMonth(year, month, delta) {
  let m = month + delta;
  let y = year;
  while (m < 0) { m += 12; y -= 1; }
  while (m > 11) { m -= 12; y += 1; }
  return { y, m };
}

export function buildWeekDates(weekAnchor) {
  const start = new Date(weekAnchor.getFullYear(), weekAnchor.getMonth(), weekAnchor.getDate());
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function computeWeekEventsByDateKey(events, weekDates) {
  const map = {};
  if (!weekDates.length) return map;
  const weekStart = weekDates[0];
  const weekEnd = weekDates[weekDates.length - 1];
  getEventOccurrencesInRange(events, weekStart, weekEnd).forEach(({ ev, occ }) => {
    const key = `${occ.getFullYear()}-${occ.getMonth()}-${occ.getDate()}`;
    (map[key] = map[key] || []).push(ev);
  });
  return map;
}

export function computeMonthsHaveEvents(events, year) {
  const monthlyRepeatEvents = events.filter(ev => ev.repeat && ev.repeatUnit === 'month');
  const yearlyOrFixedOccurrences = events
    .filter(ev => !(ev.repeat && ev.repeatUnit === 'month'))
    .map(ev => getYearlyOccurrenceInYear(ev, year))
    .filter(occ => occ.getFullYear() === year);
  return Array.from({ length: 12 }, (_, m) => {
    if (yearlyOrFixedOccurrences.some(occ => occ.getMonth() === m)) return true;
    const ref = new Date(year, m, 1);
    return monthlyRepeatEvents.some(ev => {
      const occ = getEffectiveDate(ev, ref);
      return occ.getFullYear() === year && occ.getMonth() === m;
    });
  });
}
