import { TIMELINE_COLORS } from './sundialTheme.js';

const MINUTES_PER_DAY = 1440;
export const FINAL_MINUTE = MINUTES_PER_DAY - 1;

const { morning, evening } = TIMELINE_COLORS;

const mix = (a, b, t) => a.map((channel, i) => channel + (b[i] - channel) * t);

function paletteColor(altitude, palette) {
  const next = palette.findIndex(([height]) => height > altitude);
  if (next === -1) return palette.at(-1)[1];
  if (next === 0) return palette[0][1];
  const [a, start] = palette[next - 1];
  const [b, end] = palette[next];
  return mix(start, end, (altitude - a) / (b - a));
}

export function solarAltitudeColor(altitude, minute) {
  // Blend at noon so a low polar midday never produces a sharp color seam.
  const afterNoon = Math.max(0, Math.min(1, (minute - 690) / 60));
  const color = mix(paletteColor(altitude, morning), paletteColor(altitude, evening), afterNoon);
  return '#' + color.map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('');
}

export function timelinePercent(minute) {
  return (Math.max(0, Math.min(FINAL_MINUTE, minute)) / FINAL_MINUTE * 100).toFixed(3) + '%';
}

export function solarAltitudeGradient(samples) {
  const points = samples
    .filter(point => Number.isFinite(point.solarTime) && Number.isFinite(point.altitude))
    .map(({ solarTime, altitude }) => [solarTime * 60, altitude])
    .sort(([a], [b]) => a - b);
  if (points.length < 2) return null;
  const [first, firstAltitude] = points[0];
  const [last, lastAltitude] = points.at(-1);
  points.unshift([last - MINUTES_PER_DAY, lastAltitude]);
  points.push([first + MINUTES_PER_DAY, firstAltitude]);

  // Civil midnight can fall anywhere on the solar clock. Interpolate in sorted solar time.
  const minutes = Array.from({ length: 144 }, (_, i) => i * 10);
  minutes.push(FINAL_MINUTE);
  let next = 1;
  const stops = minutes.map(minute => {
    while (points[next][0] < minute) next++;
    const [a, altitudeA] = points[next - 1];
    const [b, altitudeB] = points[next];
    const altitude = a === b ? altitudeA : altitudeA + (altitudeB - altitudeA) * (minute - a) / (b - a);
    return solarAltitudeColor(altitude, minute) + ' ' + timelinePercent(minute);
  });
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}
