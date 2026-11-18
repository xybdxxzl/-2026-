import { DEMO_MODEL, solarModel } from '../astronomy.js';
import { degrees, solarHourAngle, solarVector, sunriseSunset } from './sundialGeometry.js';
import { scaledSun } from './tracks.js';

export const FACE_TRANSITION_DECLINATION = 0.5;
export const SUNRISE_ALTITUDE = -0.833;
export { solarHourAngle };

export function solarDeclination(solarLongitudeDeg) {
  return solarModel(solarLongitudeDeg).declination;
}

function altitudeFromDirection([east, up, south]) {
  return degrees(Math.atan2(up, Math.hypot(east, south)));
}

export function solarAltitude(latitudeDeg, declinationDeg, hourAngleDeg) {
  return altitudeFromDirection(solarVector(latitudeDeg, declinationDeg, hourAngleDeg));
}

export function noonSolarAltitude(latitudeDeg, declinationDeg) {
  return 90 - Math.abs(latitudeDeg - declinationDeg);
}

export function dialFaceForDeclination(declinationDeg) {
  if (Math.abs(declinationDeg) < FACE_TRANSITION_DECLINATION) return 'transition';
  return declinationDeg > 0 ? 'front' : 'back';
}

// Shadow of a vertical rod on level ground, in chi and Three.js coordinates.
export function verticalGnomonShadow([east, up, south], heightChi = DEMO_MODEL.heightChi) {
  if (up <= Number.EPSILON) return null;
  const groundPointChi = [-heightChi * east / up, 0, -heightChi * south / up];
  return { lengthChi: Math.hypot(groundPointChi[0], groundPointChi[2]), groundPointChi };
}

export function idealSundialObservation({ latitude, solarLongitude, solarTime = 12, heightChi = DEMO_MODEL.heightChi }) {
  const declination = solarDeclination(solarLongitude);
  const hourAngle = solarHourAngle(solarTime);
  const sun = solarVector(latitude, declination, hourAngle);
  return {
    declination, hourAngle, sun,
    altitude: altitudeFromDirection(sun),
    noonAltitude: noonSolarAltitude(latitude, declination),
    face: dialFaceForDeclination(declination),
    shadow: verticalGnomonShadow(sun, heightChi),
    daylight: sunriseSunset(latitude, declination, SUNRISE_ALTITUDE),
  };
}

export function equinoxDayArc(latitude) {
  if (Math.abs(latitude) === 90) return [];
  const firstMinute = 6 * 60, lastMinute = 18 * 60, stepMinutes = 5;
  return Array.from({ length: (lastMinute - firstMinute) / stepMinutes + 1 }, (_, index) => {
    const minute = firstMinute + index * stepMinutes;
    const [east, up, south] = solarVector(latitude, 0, solarHourAngle(minute / 60));
    const direction = minute === firstMinute || minute === lastMinute ? [Math.sign(east), 0, 0] : [east, -south, up];
    return { ms: minute * 60_000, point: scaledSun(direction) };
  });
}
