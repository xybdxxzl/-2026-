import { DIAL_RADIUS } from './geometry.js';

export const SKY_RADIUS = 9;
export const scaledSun = direction => direction.map(value => value * SKY_RADIUS);

function horizonCrossing(a, b, p, q, fraction) {
  const point = [p[0] + (q[0] - p[0]) * fraction, p[1] + (q[1] - p[1]) * fraction, 0];
  const ms = Number.isFinite(a.ms) && Number.isFinite(b.ms) ? Math.round(a.ms + (b.ms - a.ms) * fraction) : null;
  let solarTime = null;
  if (Number.isFinite(a.solarTime) && Number.isFinite(b.solarTime)) {
    const elapsed = (b.solarTime - a.solarTime + 24) % 24;
    solarTime = (a.solarTime + elapsed * fraction) % 24;
  }
  return { ms, point, rising: q[2] > 0, solarTime };
}

function polarSegment(a, b) {
  if (!a.valid || !b.valid || a.face !== b.face || (!a.inside && !b.inside)) return null;
  if (a.inside && b.inside) return [a.local.slice(0, 2), b.local.slice(0, 2)];
  const inside = (a.inside ? a : b).local, outside = (a.inside ? b : a).local;
  let lo = 0, hi = 1;
  for (let step = 0; step < 20; step++) {
    const mid = (lo + hi) / 2;
    const point = inside.map((value, index) => value + (outside[index] - value) * mid);
    if (Math.hypot(point[0], point[1]) <= DIAL_RADIUS) lo = mid;
    else hi = mid;
  }
  const edge = inside.map((value, index) => value + (outside[index] - value) * lo).slice(0, 2);
  return a.inside ? [a.local.slice(0, 2), edge] : [edge, b.local.slice(0, 2)];
}

// Keep each segment independent so night, face changes and overflow never create false lines.
export function splitTracks(points) {
  const day = [], night = [], horizon = [], shadow = [], polar = { front: [], back: [] };
  const solarArcs = [], solarCrossings = [];
  let arc = null;
  function appendDay(start, end) {
    day.push(start.point, end.point);
    if (!arc) {
      arc = [start];
      solarArcs.push(arc);
    }
    arc.push(end);
  }
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const p = scaledSun(a.direction), q = scaledSun(b.direction);
    const start = { ms: a.ms ?? null, point: p }, end = { ms: b.ms ?? null, point: q };
    const litStart = p[2] > 0, litEnd = q[2] > 0;
    if (litStart !== litEnd) {
      const fraction = p[2] / (p[2] - q[2]);
      const crossing = horizonCrossing(a, b, p, q, fraction);
      const boundary = { ms: crossing.ms, point: crossing.point };
      const last = horizon.at(-1);
      if (!last || last[0] !== crossing.point[0] || last[1] !== crossing.point[1]) {
        horizon.push(crossing.point);
        solarCrossings.push(crossing);
      }
      if (litEnd) {
        if (fraction > 0) night.push(p, crossing.point);
        if (fraction < 1) appendDay(boundary, end);
      } else {
        if (fraction > 0) appendDay(start, boundary);
        if (fraction < 1) night.push(crossing.point, q);
      }
    } else if (litStart) {
      appendDay(start, end);
    } else {
      night.push(p, q);
    }
    if (!litEnd) arc = null;
    const segment = polarSegment(a.polar, b.polar);
    if (segment) polar[a.polar.face].push(...segment);
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
  return { day, night, horizon, shadow, polar, solarArcs, solarCrossings };
}
