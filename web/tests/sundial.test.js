import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_MODEL, sundialModel, solarModel, dialHourDirection, formatSolarTime } from '../src/lib/astronomy.js';

test('noon polar-style shadow points north, with season-dependent endpoint', () => {
  const summer = sundialModel(90, 12), winter = sundialModel(270, 12);
  assert.ok(Math.abs(summer.shadow.east) < 1e-10);
  assert.ok(summer.shadow.north > 0 && winter.shadow.north > summer.shadow.north);
  assert.ok(Math.abs(summer.shadow.north - summer.styleNorth - solarModel(90).shadowChi / DEMO_MODEL.heightChi) < 1e-10);
});

test('morning and afternoon shadows are symmetric and match calculated hour lines', () => {
  for (const longitude of [0, 75, 90, 180, 270]) {
    const morning = sundialModel(longitude, 9), afternoon = sundialModel(longitude, 15);
    assert.ok(morning.shadow.east < 0 && afternoon.shadow.east > 0);
    assert.ok(Math.abs(morning.shadow.east + afternoon.shadow.east) < 1e-10);
    assert.ok(Math.abs(morning.shadow.north - afternoon.shadow.north) < 1e-10);
    const direction = dialHourDirection(9);
    const crossProduct = morning.shadow.east * direction.north - morning.shadow.north * direction.east;
    assert.ok(Math.abs(crossProduct) < 1e-10);
  }
});

test('same solar time changes shadow endpoint but not its hour-line direction', () => {
  const spring = sundialModel(0, 10), summer = sundialModel(90, 10), winter = sundialModel(270, 10);
  for (const state of [spring, summer, winter]) {
    assert.ok(Math.abs(state.shadow.east / state.shadow.north - spring.shadow.east / spring.shadow.north) < 1e-10);
  }
  assert.ok(summer.shadowDistance < spring.shadowDistance && spring.shadowDistance < winter.shadowDistance);
});

test('night and equinox horizon do not create an infinite direct shadow', () => {
  for (const state of [sundialModel(270, 6), sundialModel(90, 0), sundialModel(0, 6)]) {
    assert.equal(state.lit, false);
    assert.equal(state.shadow, null);
    assert.equal(state.shadowDistance, null);
  }
  assert.ok(sundialModel(90, 6).lit);
  assert.throws(() => sundialModel(90, NaN), RangeError);
  assert.throws(() => sundialModel(90, 25), RangeError);
  assert.equal(formatSolarTime(11.9999), '12:00');
});
