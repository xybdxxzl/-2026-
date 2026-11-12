import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OBSERVERS, atSolarTime, calendarTerms, cycleTerm, dayBounds, dayTrack, formatLocal, localDate, parseClock, solarAt, termAt } from '../src/lib/astro/observation.js';
import { dialNeedle, hourDirection, projectShadow, sunDirection, toScene } from '../src/lib/astro/geometry.js';
import { splitTracks } from '../src/lib/astro/tracks.js';

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
      toScene(solar.direction).forEach((value,index) => assert.ok(Math.abs(value - solar.polar.sun[index]) < 1e-10));
      const [e,n] = hourDirection(10,place.latitude);
      assert.ok(solar.shadow);
      const [east,north] = solar.shadow.point;
      assert.ok(Math.abs(e*north-n*east) < .001);
    }
  }
});

test('solar-time search selects an occurrence within the local day and can preserve the nearby occurrence', () => {
  const place = { latitude:40.7, longitude:-74, elevation:0, zone:'America/New_York' };
  const longDay = '2026-11-01';
  const [start, end] = dayBounds(longDay,place.zone);
  const first = atSolarTime(longDay,23.5,place);
  const last = atSolarTime(longDay,23.5,place,end - 60_000);
  assert.ok(first >= start && last < end && last - first > 23 * 3_600_000);
  assert.equal(atSolarTime(longDay,23.5,place,start),first);
  assert.ok(Math.abs(solarAt(last,place).solarTime - 23.5) < .001);
  assert.equal(atSolarTime('2026-03-08',23.5,place),null);

  // A root just before local midnight must not hide the next root on the same local date.
  const midnightHour = solarAt(start - 500,place).solarTime;
  assert.ok(atSolarTime(longDay,midnightHour,place) > start + 23 * 3_600_000);
});

test('minute display rounds through a local date boundary', () => {
  const nearMidnight = Date.parse('2026-03-20T23:59:43+08:00');
  assert.equal(formatLocal(nearMidnight,'Asia/Shanghai'),formatLocal(Date.parse('2026-03-21T00:00:00+08:00'),'Asia/Shanghai'));
});

test('daily sky tracks mark crossings only where the sun meets the horizon', () => {
  const place = OBSERVERS[0];
  const normal = splitTracks(dayTrack('2026-06-21',place));
  assert.equal(normal.horizon.length,2);
  assert.equal(normal.solarArcs.length,1);
  assert.deepEqual(normal.solarCrossings.map(event => event.rising),[true,false]);
  for (const crossing of normal.horizon) {
    assert.equal(crossing[2],0);
    assert.ok(normal.day.includes(crossing) && normal.night.includes(crossing));
  }
  const arc = normal.solarArcs[0];
  for (const [i, sample] of [arc[0],arc.at(-1)].entries()) {
    const crossing = normal.solarCrossings[i];
    assert.equal(sample.point, crossing.point);
    assert.equal(sample.ms, crossing.ms);
    const sun = solarAt(sample.ms,place);
    assert.ok(Math.abs(sun.altitude)<.01);
    assert.ok(Math.abs(sun.solarTime-crossing.solarTime)<.001);
  }
  assert.ok(arc.every((sample,i) => !i || sample.ms > arc[i-1].ms));
  const tromso = OBSERVERS.find(place => place.id === 'tromso');
  const summer = splitTracks(dayTrack('2026-06-21',tromso));
  const winter = splitTracks(dayTrack('2026-12-21',tromso));
  assert.ok(summer.day.length && !summer.night.length && !summer.horizon.length);
  assert.ok(winter.night.length && !winter.day.length && !winter.horizon.length);
  assert.equal(summer.solarArcs.length,1);
  assert.equal(winter.solarArcs.length,0);
  assert.equal(summer.solarCrossings.length + winter.solarCrossings.length,0);
});

test('daylight arcs remain separate when a civil date starts and ends in sunlight', () => {
  const place = { ...OBSERVERS[0], zone:'UTC' };
  const date = '2026-06-21';
  const [start,end] = dayBounds(date,place.zone);
  const tracks = splitTracks(dayTrack(date,place));
  const [morning,evening] = tracks.solarArcs;
  assert.equal(tracks.solarArcs.length,2);
  assert.equal(morning[0].ms,start);
  assert.equal(evening.at(-1).ms,end);
  assert.ok(morning.at(-1).ms < evening[0].ms);
  assert.deepEqual(tracks.solarCrossings.map(event => event.rising),[false,true]);
});

test('horizon interpolation wraps apparent solar midnight', () => {
  const polar = { valid:false };
  const tracks = splitTracks([
    { direction:[1,0,-.1], ms:1_000, solarTime:23.99, polar },
    { direction:[1,0,.1], ms:3_000, solarTime:.01, polar },
  ]);
  assert.equal(tracks.solarCrossings[0].ms,2_000);
  assert.ok(Math.min(tracks.solarCrossings[0].solarTime,24-tracks.solarCrossings[0].solarTime)<1e-9);
  assert.equal(tracks.solarArcs[0][0].point,tracks.horizon[0]);
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
