import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TERMS, adjacentTerm, getTerm } from '../src/data/terms.js';
import { solarModel, formatShadow, formatHours, yearCurve } from '../src/lib/astronomy.js';

test('24 terms form a complete 15 degree cycle with correct key nodes', () => {
  assert.equal(new Set(TERMS.map(term => term.id)).size, 24);
  for (let i = 0; i < 24; i++) assert.equal((TERMS[(i + 1) % 24].longitude - TERMS[i].longitude + 360) % 360, 15);
  assert.equal(getTerm('chunfen').longitude, 0);
  assert.equal(getTerm('dongzhi').longitude, 270);
  assert.equal(adjacentTerm('dahan', 1).id, 'lichun');
});

test('at demonstration latitude summer shadow is shortest and winter longest', () => {
  const summer = solarModel(90), winter = solarModel(270), equinox = solarModel(0);
  assert.ok(summer.shadowChi < equinox.shadowChi && equinox.shadowChi < winter.shadowChi);
  assert.ok(summer.daylightHours > 12 && winter.daylightHours < 12);
  assert.ok(Math.abs(equinox.daylightHours - 12) < 1e-10);
  assert.ok(Math.abs(solarModel(180).shadowChi - equinox.shadowChi) < 1e-10);
});

test('one continuous cycle closes and day/night sums to 24 hours', () => {
  const curve = yearCurve();
  assert.equal(curve.length, 361);
  assert.ok(Math.abs(curve[0].shadowChi - curve[360].shadowChi) < 1e-10);
  for (const point of curve) assert.ok(Math.abs(point.daylightHours + point.nightHours - 24) < 1e-10);
  assert.equal(solarModel(-45).shadowChi, solarModel(315).shadowChi);
});

test('formatting normalizes rounding across unit boundaries', () => {
  assert.equal(formatShadow(1.98), '2尺0寸');
  assert.equal(formatShadow(null), '暂无日影');
  assert.equal(formatHours(12.9999), '13时00分');
  assert.throws(() => solarModel(NaN), RangeError);
});
