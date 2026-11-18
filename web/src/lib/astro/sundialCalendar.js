import { Temporal } from '@js-temporal/polyfill';
import { assertDate, calendarTerms, dayBounds, localDate, MAX_DATE, MIN_DATE } from './observation.js';

function civilYearSlice(date) {
  const day = assertDate(date);
  const yearStart = `${day.year}-01-01`;
  const yearEnd = `${day.year}-12-31`;
  const first = Temporal.PlainDate.from(yearStart < MIN_DATE ? MIN_DATE : yearStart);
  const last = Temporal.PlainDate.from(yearEnd > MAX_DATE ? MAX_DATE : yearEnd);
  return { day, first, last, length: first.until(last).days + 1 };
}

// The 2029 ring wraps from Feb 10 back to Jan 1, the supported portion of that civil year.
export function stepCivilYearDay(date, delta) {
  if (!Number.isSafeInteger(delta)) throw new RangeError('日期步进须为整数天。');
  const { day, first, length } = civilYearSlice(date);
  const offset = first.until(day).days;
  const wrapped = (offset + delta % length + length) % length;
  return first.add({ days: wrapped }).toString();
}

function termsInSlice({ day, first, last }, zone) {
  const [start] = dayBounds(first.toString(), zone);
  const [, end] = dayBounds(last.toString(), zone);
  // The ephemeris indexes UTC years. The ring indexes the observer's local calendar.
  return [day.year - 1, day.year, day.year + 1].flatMap(year => calendarTerms(year))
    .filter(term => term.ms >= start && term.ms < end)
    .sort((left, right) => left.ms - right.ms)
    .map(({ id, ms }) => ({ id, date: localDate(ms, zone), ms }));
}

export function sundialCalendarTerms(date, zone) {
  return termsInSlice(civilYearSlice(date), zone);
}

export function stepCalendarTerm(date, zone, direction) {
  const terms = sundialCalendarTerms(date, zone);
  if (direction > 0) return terms.find(term => term.date > date) ?? terms[0] ?? null;
  if (direction < 0) return terms.findLast(term => term.date < date) ?? terms.at(-1) ?? null;
  return null;
}

export function snapCalendarTerm(date, zone, withinDays = 2) {
  if (!Number.isFinite(withinDays) || withinDays < 0) throw new RangeError('节气吸附范围须为非负天数。');
  const slice = civilYearSlice(date);
  let nearest = null;
  let nearestDistance = Infinity;
  for (const term of termsInSlice(slice, zone)) {
    const days = Math.abs(slice.day.until(Temporal.PlainDate.from(term.date)).days);
    const distance = Math.min(days, slice.length - days);
    if (distance <= withinDays && distance < nearestDistance) {
      nearest = term;
      nearestDistance = distance;
    }
  }
  return nearest;
}
