import { shallowRef } from 'vue';
import { OBSERVERS, assertDate, localDate, validateObserver, MIN_CYCLE, MAX_CYCLE } from '../lib/astro/observation.js';
import { TERMS } from '../data/terms.js';

export const savedObservation = shallowRef(null);

export function encodeObservation(value) {
  const { ms, place, mode, cycle, selected, requested } = value;
  return JSON.stringify([ms, place.id === 'custom' ? place : place.id, mode, cycle, selected, requested]);
}

export function decodeObservation(value) {
  if (typeof value !== 'string' || value.length > 600) return null;
  try {
    const [ms, location, mode, cycle, selected, requested] = JSON.parse(value);
    if (!Number.isSafeInteger(ms) || !['date','compare'].includes(mode)
      || !Number.isInteger(cycle) || cycle < MIN_CYCLE || cycle > MAX_CYCLE
      || !TERMS.some(term => term.id === selected) || !Number.isFinite(requested) || requested < 0 || requested >= 24) return null;
    const place = typeof location === 'string' ? OBSERVERS.find(item => item.id === location)
      : validateObserver({ ...location, id:'custom' });
    if (!place) return null;
    assertDate(localDate(ms,place.zone));
    return { ms, place, mode, cycle, selected, requested };
  } catch { return null; }
}

export function restoreObservation(value) {
  const observation = decodeObservation(value);
  if (observation) savedObservation.value = observation;
  return observation;
}

try { restoreObservation(sessionStorage.getItem('shoushi-observation')); } catch { /* Optional persistence. */ }

export function saveObservation(value) {
  savedObservation.value = value;
  const encoded = encodeObservation(value);
  try { sessionStorage.setItem('shoushi-observation', encoded); } catch { /* Optional persistence. */ }
  return encoded;
}
