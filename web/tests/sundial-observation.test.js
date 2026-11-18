import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SUNRISE_ALTITUDE, dialFaceForDeclination, equinoxDayArc, idealSundialObservation, noonSolarAltitude,
  solarAltitude, solarDeclination, solarHourAngle, verticalGnomonShadow,
} from '../src/lib/astro/sundialObservation.js';
import { toScene } from '../src/lib/astro/geometry.js';
import { dot, polarBasis } from '../src/lib/astro/sundialGeometry.js';
import { SKY_RADIUS } from '../src/lib/astro/tracks.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);
const yangcheng = 34.4;

test('Yangcheng solstices reproduce noon altitude, eight-chi ground shadow, and receiving face', () => {
  const summer = idealSundialObservation({ latitude: yangcheng, solarLongitude: 90 });
  const winter = idealSundialObservation({ latitude: yangcheng, solarLongitude: 270 });
  close(summer.declination, 23.44);
  close(winter.declination, -23.44);
  close(summer.altitude, 79.04);
  close(winter.altitude, 32.16);
  close(summer.noonAltitude, summer.altitude);
  close(winter.noonAltitude, winter.altitude);
  assert.equal(summer.face, 'front');
  assert.equal(winter.face, 'back');
  assert.ok(summer.shadow.lengthChi >= 1.5 && summer.shadow.lengthChi <= 1.6);
  assert.ok(winter.shadow.lengthChi >= 12.5 && winter.shadow.lengthChi <= 13);
  for (const sample of [summer, winter]) {
    close(sample.shadow.lengthChi, 8 / Math.tan(sample.altitude * Math.PI / 180));
    close(sample.shadow.groundPointChi[0], 0);
    assert.ok(sample.shadow.groundPointChi[2] < 0, 'noon ground shadow points north in Yangcheng');
  }
});

test('equinox receiving-face transition is distinct from the ground shadow', () => {
  for (const solarLongitude of [0, 180]) {
    const equinox = idealSundialObservation({ latitude: yangcheng, solarLongitude });
    close(equinox.declination, 0);
    close(equinox.altitude, 55.6);
    assert.equal(equinox.face, 'transition');
    assert.ok(equinox.shadow.lengthChi > 0);
  }
  assert.equal(dialFaceForDeclination(0.49), 'transition');
  assert.equal(dialFaceForDeclination(-0.49), 'transition');
  assert.equal(dialFaceForDeclination(0.5), 'front');
  assert.equal(dialFaceForDeclination(-0.5), 'back');
});

test('ground projection points opposite the Sun across locations and hours', () => {
  const tropicalNoon = idealSundialObservation({ latitude: 0, solarLongitude: 90 });
  assert.ok(tropicalNoon.shadow.groundPointChi[2] > 0, 'a northern Sun casts a southward shadow');
  close(noonSolarAltitude(-yangcheng, solarDeclination(270)), 79.04);
  close(noonSolarAltitude(0, 0), 90);
  close(idealSundialObservation({ latitude: 0, solarLongitude: 0 }).shadow.lengthChi, 0);
  for (const solarTime of [9, 15]) {
    const sample = idealSundialObservation({ latitude: yangcheng, solarLongitude: 90, solarTime });
    close(sample.hourAngle, solarTime === 9 ? -45 : 45);
    close(sample.altitude, solarAltitude(yangcheng, sample.declination, solarHourAngle(solarTime)));
    assert.ok(sample.shadow.groundPointChi[0] * sample.sun[0] < 0);
  }
  assert.equal(verticalGnomonShadow([0, 0, 1]), null);
  assert.equal(idealSundialObservation({ latitude: yangcheng, solarLongitude: 90, solarTime: 0 }).shadow, null);
});

test('sunrise and sunset estimates use the apparent upper-limb threshold', () => {
  const model = idealSundialObservation({ latitude: yangcheng, solarLongitude: 90 });
  assert.equal(model.daylight.state, 'regular');
  for (const hour of [model.daylight.sunrise, model.daylight.sunset]) {
    close(solarAltitude(yangcheng, model.declination, solarHourAngle(hour)), SUNRISE_ALTITUDE);
  }
  close(model.daylight.sunrise + model.daylight.sunset, 24);
  assert.equal(idealSundialObservation({ latitude: 90, solarLongitude: 90 }).daylight.state, 'polar-day');
  assert.equal(idealSundialObservation({ latitude: 90, solarLongitude: 270 }).daylight.state, 'polar-night');
});

test('equinox reference arc stays above the horizon in the equatorial dial plane', () => {
  for (const latitude of [-69.65, -33.87, 0, yangcheng, 69.65]) {
    const arc = equinoxDayArc(latitude);
    const { P } = polarBasis(latitude);
    assert.deepEqual(arc[0], { ms: 6 * 3_600_000, point: [SKY_RADIUS, 0, 0] });
    assert.deepEqual(arc.at(-1), { ms: 18 * 3_600_000, point: [-SKY_RADIUS, 0, 0] });
    for (const [index, sample] of arc.entries()) {
      assert.equal(sample.ms, (6 * 60 + index * 5) * 60_000);
      assert.ok(sample.point[2] >= 0);
      close(Math.hypot(...sample.point), SKY_RADIUS);
      close(dot(P, toScene(sample.point)), 0);
    }
  }
  assert.deepEqual(equinoxDayArc(-90), []);
  assert.deepEqual(equinoxDayArc(90), []);
});
