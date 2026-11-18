// Double-sided polar dial geometry in Three.js coordinates: X east, Y up, Z south.
export const DIAL_RADIUS = 5;
export const STYLE_LENGTH_RATIO = 0.25;
export const DEFAULT_NEEDLE_LENGTH = DIAL_RADIUS * STYLE_LENGTH_RATIO;
const EPSILON = 1e-8;

export const radians = degrees => degrees * Math.PI / 180;
export const degrees = radians => radians * 180 / Math.PI;
export const solarHourAngle = solarTimeHours => 15 * (solarTimeHours - 12);
const multiply = (vector, scalar) => vector.map(value => value * scalar);
const add = (a, b) => a.map((value, index) => value + b[index]);
export const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);

export function polarBasis(latitudeDeg) {
  const phi = radians(latitudeDeg);
  return {
    P: [0, Math.sin(phi), -Math.cos(phi)],
    M: [0, Math.cos(phi), Math.sin(phi)],
    W: [-1, 0, 0],
  };
}

export function solarVector(latitudeDeg, declinationDeg, hourAngleDeg) {
  const phi = radians(latitudeDeg), delta = radians(declinationDeg), H = radians(hourAngleDeg);
  return [
    -Math.cos(delta) * Math.sin(H),
    Math.cos(delta) * Math.cos(H) * Math.cos(phi) + Math.sin(delta) * Math.sin(phi),
    Math.cos(delta) * Math.cos(H) * Math.sin(phi) - Math.sin(delta) * Math.cos(phi),
  ];
}

export function dialLocalPoint(distance, hourAngleDeg, faceOffset = 0) {
  const H = radians(hourAngleDeg);
  return [-distance * Math.sin(H), -distance * Math.cos(H), faceOffset];
}

export function dialLocalToWorld(point, latitudeDeg) {
  const { M, W, P } = polarBasis(latitudeDeg);
  return add(add(multiply(W, point[0]), multiply(M, point[1])), multiply(P, point[2] ?? 0));
}

export function projectTipToDial(tip, sun, normal = [0, 0, 1]) {
  const denominator = dot(normal, sun);
  if (Math.abs(denominator) < EPSILON) return null;
  const distance = dot(normal, tip) / denominator;
  return tip.map((value, index) => value - distance * sun[index]);
}

export function polarShadow(latitudeDeg, declinationDeg, solarTimeHours, radius = DIAL_RADIUS) {
  const hourAngle = solarHourAngle(solarTimeHours);
  const { P, M, W } = polarBasis(latitudeDeg);
  const length = radius * STYLE_LENGTH_RATIO;
  const sun = solarVector(latitudeDeg, declinationDeg, hourAngle);
  const ratio = Math.abs(1 / Math.tan(radians(declinationDeg)));
  const base = { latitudeDeg, declinationDeg, solarTimeHours, hourAngle, sun, normal: P, basisM: M, basisW: W,
    needleLength: length, radius, ratio };
  if (sun[1] <= 0) return { ...base, valid: false, status: 'night', point: null, local: null, tip: null, face: null };
  if (Math.abs(Math.sin(radians(declinationDeg))) < EPSILON || !Number.isFinite(ratio)) {
    return { ...base, valid: false, status: 'parallel', point: null, local: null, tip: null, face: null };
  }
  const distance = length * ratio;
  const local = dialLocalPoint(distance, hourAngle);
  const point = dialLocalToWorld(local, latitudeDeg);
  const sign = declinationDeg > 0 ? 1 : -1;
  const tip = multiply(P, sign * length);
  const inside = distance <= radius + EPSILON;
  const scale = inside ? 1 : radius / distance;
  return {
    ...base, valid: true, status: inside ? 'normal' : 'overflow', distance, local, point, tip,
    face: sign > 0 ? 'front' : 'back', inside,
    end: multiply(point, scale), localEnd: multiply(local, scale),
  };
}

export function sunriseSunset(latitudeDeg, declinationDeg, horizonDeg = 0) {
  const latitude = radians(latitudeDeg), declination = radians(declinationDeg);
  const offset = Math.sin(latitude) * Math.sin(declination);
  const amplitude = Math.cos(latitude) * Math.cos(declination);
  const horizon = Math.sin(radians(horizonDeg));
  if (amplitude < Number.EPSILON) {
    const state = offset > horizon ? 'polar-day' : 'polar-night';
    return { state, sunrise: null, sunset: null, hourAngle: null };
  }
  const cosine = (horizon - offset) / amplitude;
  if (cosine < -1) return { state: 'polar-day', sunrise: null, sunset: null, hourAngle: null };
  if (cosine > 1) return { state: 'polar-night', sunrise: null, sunset: null, hourAngle: null };
  const hourAngle = degrees(Math.acos(Math.max(-1, Math.min(1, cosine))));
  return { state: 'regular', sunrise: 12 - hourAngle / 15, sunset: 12 + hourAngle / 15, hourAngle };
}
