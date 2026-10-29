/**
 * A transparent ideal geometry demonstration, not historical measurement.
 * Latitude 35° is a deliberately chosen demonstration parameter, NOT a
 * verified identification of historical Yangcheng. No refraction or terrain.
 */
export const DEMO_MODEL = Object.freeze({ latitude: 35, heightChi: 8, obliquity: 23.44 });
const radians = degrees => degrees * Math.PI / 180;
const degrees = rad => rad * 180 / Math.PI;
const clamp = value => Math.min(1, Math.max(-1, value));
export const normalizeLongitude = value => ((value % 360) + 360) % 360;

export function solarModel(longitude, config = DEMO_MODEL) {
  const { latitude, heightChi, obliquity } = config;
  if (![longitude, latitude, heightChi, obliquity].every(Number.isFinite) || Math.abs(latitude) >= 90 || heightChi <= 0) {
    throw new RangeError('Invalid demonstration model parameters');
  }
  const delta = Math.asin(Math.sin(radians(obliquity)) * Math.sin(radians(normalizeLongitude(longitude))));
  const altitude = 90 - Math.abs(latitude - degrees(delta));
  const shadowChi = altitude > 0 ? heightChi / Math.tan(radians(altitude)) : null;
  const hourCos = -Math.tan(radians(latitude)) * Math.tan(delta);
  const daylightHours = hourCos <= -1 ? 24 : hourCos >= 1 ? 0 : 24 * Math.acos(clamp(hourCos)) / Math.PI;
  return { longitude: normalizeLongitude(longitude), declination: degrees(delta), altitude, shadowChi, daylightHours, nightHours: 24 - daylightHours };
}

export function formatShadow(value) {
  if (value === null || !Number.isFinite(value)) return '暂无日影';
  const tenths = Math.round(value * 10);
  return `${Math.floor(tenths / 10)}尺${tenths % 10}寸`;
}

export function formatHours(value) {
  const minutes = Math.round(value * 60);
  return `${Math.floor(minutes / 60)}时${String(minutes % 60).padStart(2, '0')}分`;
}

export function yearCurve() {
  return Array.from({ length: 361 }, (_, index) => ({ x: index, ...solarModel(315 + index) }));
}

/** Horizontal sundial, polar style; all lengths normalized to vertical style height.
 * East/north/up coordinates. Solar time, not civil/Beijing time.
 */
export function sundialModel(longitude, solarTime = 12, config = DEMO_MODEL) {
  if (!Number.isFinite(solarTime) || solarTime < 0 || solarTime > 24 || config.latitude <= 0) {
    throw new RangeError('Sundial requires solar time 0–24 and a northern latitude');
  }
  const noon = solarModel(longitude, config);
  const phi = radians(config.latitude), delta = radians(noon.declination);
  const hourAngle = radians((solarTime - 12) * 15);
  const east = -Math.cos(delta) * Math.sin(hourAngle);
  const north = Math.cos(phi) * Math.sin(delta) - Math.sin(phi) * Math.cos(delta) * Math.cos(hourAngle);
  const up = Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(hourAngle);
  const altitude = degrees(Math.asin(clamp(up)));
  const styleNorth = 1 / Math.tan(phi);
  const lit = up > 1e-6;
  const shadow = lit ? { east: -east / up, north: styleNorth - north / up } : null;
  return { ...noon, solarTime, altitude, lit, styleNorth, shadow,
    shadowDistance: shadow ? Math.hypot(shadow.east, shadow.north) : null };
}

export function dialHourDirection(solarTime, latitude = DEMO_MODEL.latitude) {
  const phi = radians(latitude), angle = radians((solarTime - 12) * 15);
  const east = Math.sin(phi) * Math.sin(angle), north = Math.cos(angle);
  const length = Math.hypot(east, north);
  return { east: east / length, north: north / length };
}

export function formatSolarTime(value) {
  const minutes = Math.round(value * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
