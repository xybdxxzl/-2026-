import { DIAL_RADIUS } from './geometry.js';

export const SKY_RADIUS = 7.8;
export const scaledSun = direction => direction.map(value => value * SKY_RADIUS);

// Keep each segment independent so gaps at night never connect across the dial.
export function splitTracks(points) {
  const day = [], night = [], shadow = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const p = scaledSun(a.direction), q = scaledSun(b.direction);
    if (p[2] * q[2] < 0) {
      const fraction = p[2] / (p[2] - q[2]);
      const horizon = p.map((v, j) => v + (q[j] - v) * fraction);
      (p[2] > 0 ? day : night).push(p, horizon);
      (q[2] > 0 ? day : night).push(horizon, q);
    } else {
      (Math.max(p[2], q[2]) > 0 ? day : night).push(p, q);
    }
    if (!a.shadow || !b.shadow || (!a.shadow.inside && !b.shadow.inside)) continue;
    const from = a.shadow.point, to = b.shadow.point;
    if (a.shadow.inside && b.shadow.inside) shadow.push(from, to);
    else {
      const inside = a.shadow.inside ? from : to;
      const outside = a.shadow.inside ? to : from;
      let lo = 0, hi = 1;
      const at = t => inside.map((v, j) => v + (outside[j] - v) * t);
      for (let step = 0; step < 22; step++) {
        const mid = (lo + hi) / 2;
        if (Math.hypot(...at(mid)) <= DIAL_RADIUS) lo = mid;
        else hi = mid;
      }
      shadow.push(inside, at(lo));
    }
  }
  return { day, night, shadow };
}
