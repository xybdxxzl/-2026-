export const DIAL_RADIUS = 5;
export const STYLE_LENGTH = 1.75;
export const radians = degrees => degrees * Math.PI / 180;

export function sunDirection(altitude, azimuth) {
  const h = radians(altitude), a = radians(azimuth);
  return [Math.cos(h) * Math.sin(a), Math.cos(h) * Math.cos(a), Math.sin(h)];
}

export const toScene = ([east, north, up]) => [east, up, -north];

export function dialNeedle(latitude) {
  if (latitude === 0 || Math.abs(latitude) === 90) return null;
  const phi = radians(Math.abs(latitude));
  return [0, Math.sign(latitude) * STYLE_LENGTH * Math.cos(phi), STYLE_LENGTH * Math.sin(phi)];
}

export function projectShadow(tip, direction) {
  if (!tip || direction[2] <= 0.000001) return null;
  const t = tip[2] / direction[2];
  const point = [tip[0] - t * direction[0], tip[1] - t * direction[1], 0];
  const distance = Math.hypot(point[0], point[1]);
  const inside = distance <= DIAL_RADIUS;
  return { point, distance, inside, end: inside ? point : point.map(x => x * DIAL_RADIUS / distance) };
}

export function hourDirection(hour, latitude) {
  const h = radians(15 * (hour - 12));
  const e = Math.sin(radians(Math.abs(latitude))) * Math.sin(h);
  const n = Math.sign(latitude) * Math.cos(h);
  const length = Math.hypot(e, n);
  return length ? [e / length, n / length, 0] : [0, 0, 0];
}

export function hourMarks(latitude) {
  if (!dialNeedle(latitude)) return [];
  return Array.from({ length: 48 }, (_, i) => ({
    hour: i / 2,
    direction: hourDirection(i / 2, latitude),
    major: i % 2 === 0,
    label: i % 4 === 0 ? String(i / 2).padStart(2, '0') : '',
  }));
}
