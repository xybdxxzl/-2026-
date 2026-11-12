import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  DIAL_RADIUS, STYLE_LENGTH_RATIO, dialLocalPoint, dialLocalToWorld, dot, polarBasis,
  polarShadow, projectTipToDial, solarVector, sunriseSunset,
} from '../src/lib/astro/sundialGeometry.js';
import { dialQuaternion } from '../src/scene/sundial/dialOrientation.js';
import { createInstrument, disposeObject } from '../src/scene/sundial/instrument.js';

const close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≠ ${expected}`);

test('polar solar vectors are unit vectors and shadows satisfy plane and analytic projection', () => {
  for (const latitude of [-69.65, -33.87, 0, 34.4, 39.9, 69.65]) {
    for (const declination of [-23.44, -10, 10, 23.44]) {
      for (const time of [6, 10, 12, 16]) {
        const H = 15 * (time - 12), sun = solarVector(latitude, declination, H);
        close(Math.hypot(...sun), 1);
        const shadow = polarShadow(latitude, declination, time);
        if (!shadow.valid) continue;
        close(dot(shadow.point, shadow.normal), 0);
        close(shadow.distance, DIAL_RADIUS * STYLE_LENGTH_RATIO * Math.abs(1 / Math.tan(declination * Math.PI / 180)));
        const projected = projectTipToDial(shadow.tip, sun, shadow.normal);
        projected.forEach((value, index) => close(value, shadow.point[index]));
        close(Math.atan2(-shadow.local[0], -shadow.local[1]), H * Math.PI / 180);
      }
    }
  }
});

test('equinox is parallel, solstices have equal radius and opposite receiving faces', () => {
  assert.equal(polarShadow(34.4, 0, 10).status, 'parallel');
  const summer = polarShadow(34.4, 23.44, 10), winter = polarShadow(34.4, -23.44, 10);
  close(summer.distance, winter.distance);
  assert.equal(summer.face, 'front');
  assert.equal(winter.face, 'back');
  summer.point.forEach((value, index) => close(value, winter.point[index]));
  assert.equal(polarShadow(34.4, 23.44, 0).status, 'night');
});

test('overflow preserves direction and finite numerical distance', () => {
  const shadow = polarShadow(34.4, 2, 9);
  assert.equal(shadow.status, 'overflow');
  assert.ok(!shadow.inside && shadow.distance > DIAL_RADIUS);
  close(Math.hypot(...shadow.end), DIAL_RADIUS);
  close(Math.atan2(-shadow.local[0], -shadow.local[1]), Math.atan2(-shadow.localEnd[0], -shadow.localEnd[1]));
});

test('quaternion dial mapping agrees with analytical local and world coordinates', () => {
  for (const latitude of [-33.87, 0, 34.4, 69.65]) {
    const quaternion = dialQuaternion(latitude);
    for (const time of [0, 6, 10, 12, 18, 23]) {
      const local = dialLocalPoint(2.5, 15 * (time - 12), 0.05);
      const world = new THREE.Vector3(...local).applyQuaternion(quaternion).toArray();
      const analytic = dialLocalToWorld(local, latitude);
      world.forEach((value, index) => close(value, analytic[index]));
    }
    const { P, M, W } = polarBasis(latitude);
    for (const [axis, expected] of [[new THREE.Vector3(1,0,0),W],[new THREE.Vector3(0,1,0),M],[new THREE.Vector3(0,0,1),P]]) {
      axis.applyQuaternion(quaternion).toArray().forEach((value,index) => close(value,expected[index]));
    }
  }
});

test('the rendered stylus casts its tip shadow at the analytical point on both dial faces', () => {
  const texture = new THREE.Texture();
  const faceTextures = { map: texture, bump: texture };
  for (const latitude of [-35, 0, 34.4]) {
    const { group, dial } = createInstrument(latitude, { front: faceTextures, back: faceTextures }, texture, texture);
    group.updateMatrixWorld(true);
    for (const declination of [-23.44, 23.44]) {
      const shadow = polarShadow(latitude, declination, 10);
      const style = dial.getObjectByName(`${shadow.face}-style`);
      const face = dial.getObjectByName(`${shadow.face}-dial-face`);
      const sign = shadow.face === 'front' ? 1 : -1;
      const vertices = style.geometry.attributes.position;
      let tipIndex = 0;
      for (let i = 1; i < vertices.count; i++) {
        if (sign * vertices.getZ(i) > sign * vertices.getZ(tipIndex)) tipIndex = i;
      }
      const faceOrigin = face.getWorldPosition(new THREE.Vector3());
      const tip = style.localToWorld(new THREE.Vector3().fromBufferAttribute(vertices, tipIndex)).sub(faceOrigin);
      const actual = projectTipToDial(tip.toArray(), shadow.sun, shadow.normal);
      actual.forEach((value, index) => close(value, shadow.point[index], 1e-6));
    }
    disposeObject(group);
  }
});

test('geometric sunrise and sunset cover regular, polar day and polar night', () => {
  const regular = sunriseSunset(34.4, 23.44);
  close(Math.cos(regular.hourAngle * Math.PI / 180), -Math.tan(34.4 * Math.PI / 180) * Math.tan(23.44 * Math.PI / 180));
  close(regular.sunrise + regular.sunset, 24);
  assert.equal(sunriseSunset(80, 23.44).state, 'polar-day');
  assert.equal(sunriseSunset(80, -23.44).state, 'polar-night');
  assert.equal(sunriseSunset(0, 0).hourAngle, 90);
});
