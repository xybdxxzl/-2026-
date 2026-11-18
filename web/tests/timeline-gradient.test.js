import assert from 'node:assert/strict';
import test from 'node:test';
import { solarAltitudeColor, solarAltitudeGradient, timelinePercent } from '../src/scene/sundial/timelineGradient.js';

test('timeline distinguishes dawn copper, evening bronze, and day gold by solar altitude', () => {
  assert.equal(solarAltitudeColor(-30, 120), solarAltitudeColor(-30, 1300));
  assert.notEqual(solarAltitudeColor(-6, 360), solarAltitudeColor(0, 360));
  assert.notEqual(solarAltitudeColor(0, 360), solarAltitudeColor(0, 1080));
  assert.equal(solarAltitudeColor(45, 480), solarAltitudeColor(45, 960));
});

test('timeline follows sampled apparent solar time and interpolates across midnight', () => {
  const gradient = solarAltitudeGradient([
    { solarTime: 23, altitude: -40 },
    { solarTime: 1, altitude: -20 },
    { solarTime: 12, altitude: 42 },
  ]);
  assert.ok(gradient.startsWith(`linear-gradient(90deg, ${solarAltitudeColor(-30, 0)} 0.000%`));
  assert.ok(gradient.includes(`${solarAltitudeColor(42, 720)} ${timelinePercent(720)}`));
  assert.ok(gradient.endsWith(' 100.000%)'));
  assert.equal(solarAltitudeGradient([]), null);
});
