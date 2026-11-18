import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  eclipticVector, equatorialToLocalAxes, equatorialVector, localSiderealAngle, starVisibility, sunRightAscension,
} from '../src/lib/astro/celestial.js';
import { dot, polarBasis, solarVector } from '../src/lib/astro/sundialGeometry.js';
import { solarDeclination, solarHourAngle } from '../src/lib/astro/sundialObservation.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} ≠ ${expected}`);
const sameVector = (actual, expected) => actual.forEach((value, index) => close(value, expected[index]));
const transform = (rows, point) => rows.map(row => dot(row, point));

test('ecliptic positions are equatorial unit vectors and include the equinox directions', () => {
  for (const longitude of [0, 90, 180, 270]) close(sunRightAscension(longitude), longitude);
  sameVector(eclipticVector(0), [1, 0, 0]);
  sameVector(eclipticVector(180), [-1, 0, 0]);
  sameVector(eclipticVector(360), eclipticVector(0));
  for (const longitude of [20, 115, 238, 317]) {
    const point = eclipticVector(longitude);
    close(Math.hypot(...point), 1);
    sameVector(point, equatorialVector(sunRightAscension(longitude), solarDeclination(longitude)));
  }
});

test('the single equatorial rotation aligns the dome Sun with the sundial Sun', () => {
  for (const latitude of [-33.87, 0, 34.4, 69.65]) {
    for (const longitude of [0, 53, 90, 180, 270, 337]) {
      for (const hour of [0, 6, 10, 12, 18, 23]) {
        const lst = localSiderealAngle(longitude, hour);
        assert.ok(lst >= 0 && lst < 360);
        const actual = transform(equatorialToLocalAxes(latitude, lst), eclipticVector(longitude));
        const expected = solarVector(latitude, solarDeclination(longitude), solarHourAngle(hour));
        sameVector(actual, expected);
      }
    }
  }
});

test('the celestial rotation is right-handed, preserves magnitude, and fixes the celestial poles', () => {
  const latitude = 34.4, star = equatorialVector(15 * 2.5303, 89.2641);
  close(Math.hypot(...star), 1);
  for (const lst of [0, 80, 180, 310]) {
    const rows = equatorialToLocalAxes(latitude, lst);
    rows.forEach((a, i) => rows.forEach((b, j) => close(dot(a, b), i === j ? 1 : 0)));
    const [[ex, ey, ez], [ux, uy, uz], south] = rows;
    sameVector([ey * uz - ez * uy, ez * ux - ex * uz, ex * uy - ey * ux], south);
    close(Math.hypot(...transform(rows, star)), 1);
    sameVector(transform(rows, [0, 0, 1]), polarBasis(latitude).P);
  }
});

test('stars move west with increasing sidereal angle and fade smoothly through twilight', () => {
  const star = equatorialVector(0, 0);
  sameVector(transform(equatorialToLocalAxes(0, localSiderealAngle(0, 12)), star), [0, 1, 0]);
  sameVector(transform(equatorialToLocalAxes(0, localSiderealAngle(90, 12)), star), [-1, 0, 0]);
  sameVector(transform(equatorialToLocalAxes(0, localSiderealAngle(0, 18)), star), [-1, 0, 0]);
  close(starVisibility(-18), 1);
  close(starVisibility(-12), 1);
  close(starVisibility(-9), 0.84375);
  close(starVisibility(-6), 0.5);
  close(starVisibility(-3), 0.15625);
  close(starVisibility(0), 0);
  close(starVisibility(18), 0);
});
