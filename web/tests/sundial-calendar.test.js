import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  snapCalendarTerm, stepCalendarTerm, stepCivilYearDay, sundialCalendarTerms,
} from '../src/lib/astro/sundialCalendar.js';

const zone = 'Asia/Shanghai';

test('day stepping follows local civil dates, including leap day and year wrap', () => {
  assert.equal(stepCivilYearDay('2026-02-28', 1), '2026-03-01');
  assert.equal(stepCivilYearDay('2028-02-28', 1), '2028-02-29');
  assert.equal(stepCivilYearDay('2028-03-01', -1), '2028-02-29');
  assert.equal(stepCivilYearDay('2028-12-31', 1), '2028-01-01');
  assert.equal(stepCivilYearDay('2028-01-01', -1), '2028-12-31');
  assert.equal(stepCivilYearDay('2028-01-01', 368), '2028-01-03');
  assert.equal(stepCivilYearDay('2028-01-01', -368), '2028-12-30');
});

test('term dates use the observer time zone, while the event instant stays the same', () => {
  const date = '2026-07-01';
  const chineseTerms = sundialCalendarTerms(date, zone);
  const utcTerms = sundialCalendarTerms(date, 'UTC');
  assert.equal(chineseTerms.length, 24);
  assert.ok(chineseTerms.every((term, index) => term.date.startsWith('2026-') && (!index || term.ms > chineseTerms[index - 1].ms)));
  const chineseWinter = chineseTerms.find(term => term.id === 'dongzhi');
  const utcWinter = utcTerms.find(term => term.id === 'dongzhi');
  assert.equal(chineseWinter.date, '2026-12-22');
  assert.equal(utcWinter.date, '2026-12-21');
  assert.equal(chineseWinter.ms, utcWinter.ms);
});

test('term stepping skips the selected date, and snaps only within the specified civil-day radius', () => {
  const date = '2026-01-01';
  const terms = sundialCalendarTerms(date, zone);
  assert.deepEqual(stepCalendarTerm(date, zone, -1), terms.at(-1));
  assert.deepEqual(stepCalendarTerm(terms[0].date, zone, -1), terms.at(-1));
  assert.deepEqual(stepCalendarTerm(terms[0].date, zone, 1), terms[1]);
  assert.deepEqual(stepCalendarTerm(terms.at(-1).date, zone, 1), terms[0]);
  assert.deepEqual(snapCalendarTerm('2026-01-07', zone), terms[0]);
  assert.equal(snapCalendarTerm('2026-01-08', zone), null);
  assert.equal(snapCalendarTerm('2026-12-31', zone), null);
  assert.deepEqual(snapCalendarTerm('2026-12-31', zone, 5), terms[0]);
});

test('2029 day and term navigation wraps within the supported January to February slice', () => {
  assert.equal(stepCivilYearDay('2029-02-10', 1), '2029-01-01');
  assert.equal(stepCivilYearDay('2029-01-01', -1), '2029-02-10');
  assert.equal(stepCivilYearDay('2029-01-01', 41), '2029-01-01');
  const terms = sundialCalendarTerms('2029-02-10', zone);
  assert.deepEqual(terms.map(term => term.id), ['xiaohan', 'dahan', 'lichun']);
  assert.deepEqual(stepCalendarTerm('2029-02-10', zone, 1), terms[0]);
  assert.deepEqual(stepCalendarTerm('2029-01-01', zone, -1), terms.at(-1));
  assert.equal(snapCalendarTerm('2029-02-10', zone), null);
  assert.deepEqual(snapCalendarTerm('2029-02-10', zone, 5), terms[0]);
});
