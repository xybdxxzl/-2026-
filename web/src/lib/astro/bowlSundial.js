import { DIAL_RADIUS, polarBasis, solarHourAngle, solarVector } from './sundialGeometry.js';

const LIMIT = 23.44;

export function bowlLocalPoint(sun, radius = DIAL_RADIUS) {
  return sun && sun[1] > 0 ? sun.map(value => -radius * value) : null;
}

// Polar-distance UVs have a single well-defined value at the bottom of the bowl.
export function bowlUV([x, y, z]) {
  const horizontal = Math.hypot(x, z);
  if (horizontal < 1e-10) return [.5, .5];
  const scale = Math.atan2(horizontal, -y) / (Math.PI * horizontal);
  return [.5 + x * scale, .5 + z * scale];
}

export function bowlAnchor(latitude) {
  return polarBasis(latitude).P.map(value => value * (latitude < 0 ? 1 : -1));
}

function daylightArcs(fn, lo, hi, steps) {
  const arcs = [];
  let start = lo, previous = fn(lo), arc = previous[1] > 0 ? [previous.map(v => -v)] : null;
  for (let i = 1; i <= steps; i++) {
    const end = lo + (hi - lo) * i / steps, next = fn(end);
    if ((previous[1] > 0) !== (next[1] > 0)) {
      let a = start, b = end;
      for (let k = 0; k < 18; k++) {
        const mid = (a + b) / 2;
        if ((fn(mid)[1] > 0) === (previous[1] > 0)) a = mid; else b = mid;
      }
      const edge = fn((a + b) / 2).map(v => -v);
      edge[1] = 0;
      if (arc) { arc.push(edge); arcs.push(arc); arc = null; }
      else arc = [edge];
    }
    if (arc) arc.push(next.map(v => -v));
    start = end; previous = next;
  }
  if (arc?.length > 1) arcs.push(arc);
  return arcs;
}

export function bowlEngravings(latitude) {
  const lines = [], letters = [];
  for (let hour = 0; hour < 24; hour++) {
    const H = solarHourAngle(hour);
    const sun = delta => solarVector(latitude, delta, H);
    const arcs = daylightArcs(sun, -LIMIT, LIMIT, 72);
    if (!arcs.length) continue;
    lines.push({ kind:hour % 2 ? 'hour' : 'branch', hour, arcs });
    if (hour % 2) continue;
    const labelPoint = [-31, 31].map(sun).find(s => s[1] > .10);
    if (labelPoint) letters.push({ hour, point:labelPoint.map(v => -v) });
    lines.push({ kind:'minor', hour, arcs:daylightArcs(d => solarVector(latitude,d,H+7.5), -LIMIT, -LIMIT+3, 12) });
  }
  for (const [kind, delta] of [['winter',-LIMIT],['equinox',0],['summer',LIMIT]]) {
    lines.push({kind, arcs:daylightArcs(h => solarVector(latitude,delta,solarHourAngle(h)), 0, 24, 240)});
  }
  return {lines, letters};
}
