import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OBSERVERS, atSolarTime, calendarTerms, cycleTerm, dayBounds, localDate, parseClock, solarAt, termAt } from '../src/lib/astro/observation.js';
import { dialNeedle, hourDirection, projectShadow, sunDirection, toScene } from '../src/lib/astro/geometry.js';

test('101 calculated terms match the independent HKO and Taipei minute tables', () => {
  const events = [2025,2026,2027,2028].flatMap(calendarTerms);
  assert.equal(events.length,96);
  events.unshift(calendarTerms(2024).at(-1));
  events.push(...calendarTerms(2029).slice(0,4));
  assert.equal(events.length,101);
  for (const [i,event] of events.entries()) {
    assert.ok(event.source && event.differenceSeconds <= 60, event.name);
    assert.ok(!i || event.ms > events[i-1].ms);
    assert.notEqual(termAt(event.ms-1).active.id,event.id);
    assert.equal(termAt(event.ms).active.id,event.id);
  }
  assert.equal(termAt(cycleTerm(2028,'xiaohan').ms).cycle,2028);
  assert.equal(termAt(cycleTerm(2029,'lichun').ms).cycle,2029);
});

test('station azimuth agrees with the published SPA example', () => {
  // https://midcdmz.nlr.gov/spa/spa_tester.c uses the same north-clockwise convention.
  const place = { latitude:39.742476, longitude:-105.1786, elevation:1830.14 };
  const solar = solarAt(Date.parse('2003-10-17T19:30:30Z'),place);
  assert.ok(Math.abs(solar.azimuth - 194.340241) < .05);
  // Published zenith is refraction-corrected, so it is higher in altitude than the geometric value.
  assert.ok(solar.altitude < 90 - 50.111622 && solar.altitude > 39.8);
});

test('local clocks retain 23/25-hour dates and reject skipped/repeated clock input by default', () => {
  const zone = 'America/New_York';
  for (const [date,hours] of [['2026-03-08',23],['2026-11-01',25]]) {
    const [start,end] = dayBounds(date,zone);
    assert.equal((end-start)/3_600_000,hours);
  }
  assert.throws(() => parseClock('2026-03-08','02:30',zone,'later'));
  assert.throws(() => parseClock('2026-11-01','01:30',zone));
  assert.equal(parseClock('2026-11-01','01:30',zone,'later') -
    parseClock('2026-11-01','01:30',zone,'earlier'),3_600_000);
  assert.equal(new Date(parseClock('2026-06-21','06:00','Asia/Kathmandu')).toISOString(),
    '2026-06-21T00:15:00.000Z');
});

test('same apparent solar time aligns on the hour line in both hemispheres', () => {
  for (const place of [OBSERVERS[0],OBSERVERS.find(item => item.id==='sydney')]) {
    for (const date of ['2026-06-21','2026-12-21']) {
      const ms = atSolarTime(date,10,place);
      assert.ok(ms);
      assert.equal(localDate(ms,place.zone),date);
      const solar = solarAt(ms,place);
      assert.ok(Math.abs(solar.solarTime-10) < .001);
      const [e,n] = hourDirection(10,place.latitude);
      assert.ok(solar.shadow);
      const [east,north] = solar.shadow.point;
      assert.ok(Math.abs(e*north-n*east) < .001);
    }
  }
});

test('horizontal geometry keeps fixed scale and uses a right-handed render transform', () => {
  assert.deepEqual(toScene([0,1,0]),[0,0,-1]);
  const tip = dialNeedle(39.9);
  const morning = projectShadow(tip,sunDirection(5,90));
  assert.ok(morning.point[0]<0 && !morning.inside);
  assert.ok(morning.distance>Math.hypot(...morning.end));
  assert.equal(morning.point[2],0);
  assert.equal(projectShadow(tip,sunDirection(-1,90)),null);
  assert.equal(dialNeedle(0),null);
  assert.ok(dialNeedle(-33.8)[1] < 0);
});
