import { DEMO_MODEL, normalizeLongitude } from '../astronomy.js';
import { degrees, radians } from './sundialGeometry.js';
import { solarHourAngle } from './sundialObservation.js';

const obliquity = radians(DEMO_MODEL.obliquity);

export function sunRightAscension(solarLongitude) {
  const longitude = radians(solarLongitude);
  return normalizeLongitude(degrees(Math.atan2(Math.cos(obliquity) * Math.sin(longitude), Math.cos(longitude))));
}

export function localSiderealAngle(solarLongitude, solarTime) {
  return normalizeLongitude(sunRightAscension(solarLongitude) + solarHourAngle(solarTime));
}

// Catalog right ascension in hours is converted to degrees by the caller.
export function equatorialVector(raDeg, decDeg) {
  const ra = radians(raDeg), dec = radians(decDeg);
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

// Matrix rows express local east, up, and south in the equatorial basis.
export function equatorialToLocalAxes(latitude, lstDeg) {
  const phi = radians(latitude), theta = radians(lstDeg);
  const sinLatitude = Math.sin(phi), cosLatitude = Math.cos(phi);
  const sinSidereal = Math.sin(theta), cosSidereal = Math.cos(theta);
  return [
    [-sinSidereal, cosSidereal, 0],
    [cosLatitude * cosSidereal, cosLatitude * sinSidereal, sinLatitude],
    [sinLatitude * cosSidereal, sinLatitude * sinSidereal, -cosLatitude],
  ];
}

export function eclipticVector(solarLongitude) {
  const longitude = radians(solarLongitude), sine = Math.sin(longitude);
  return [Math.cos(longitude), Math.cos(obliquity) * sine, Math.sin(obliquity) * sine];
}

export function starVisibility(solarAltitude) {
  const t = Math.max(0, Math.min(1, (solarAltitude + 12) / 12));
  return 1 - t * t * (3 - 2 * t);
}
