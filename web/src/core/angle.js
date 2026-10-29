export const normalize = angle => ((angle % 360) + 360) % 360;
export const shortestDelta = (from, to) => normalize(to - from + 180) - 180;
export const nearestTurn = (from, to) => from + shortestDelta(from, to);
export const termIndex = angle => Math.floor(normalize(angle + 1e-7) / 15) % 24;
export const houIndex = angle => Math.floor(normalize(angle + 1e-7) % 15 / 5);
export const snapAngle = angle => Math.round(angle / 15) * 15;
