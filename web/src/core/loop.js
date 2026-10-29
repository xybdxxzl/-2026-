import { computed, readonly, ref } from 'vue';

const subscribers = new Set();
const fps = ref(60);
const systemReduced = ref(false), manualReduced = ref(null);
const reducedMotion = computed(() => manualReduced.value === null ? systemReduced.value : manualReduced.value);
let frame = 0, previous = 0, count = 0, seconds = 0, initialized = false;
let media, handleMedia, handleVisibility;
function tick(now) {
  frame = 0;
  const dt = previous ? Math.min(.1, (now - previous) / 1000) : 0;
  previous = now;
  count++; seconds += dt;
  if (seconds >= 1) { fps.value = Math.round(count / seconds); count = 0; seconds = 0; }
  subscribers.forEach(callback => callback(dt, now));
  if (subscribers.size && !document.hidden) frame = requestAnimationFrame(tick);
}
function start() {
  if (!frame && subscribers.size && !document.hidden) { previous = 0; frame = requestAnimationFrame(tick); }
}
export function initializeLoop() {
  if (initialized) return;
  initialized = true;
  media = matchMedia('(prefers-reduced-motion: reduce)');
  systemReduced.value = media.matches;
  handleMedia = event => { systemReduced.value = event.matches; };
  media.addEventListener('change', handleMedia);
  handleVisibility = () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; previous = 0; }
    else start();
  };
  document.addEventListener('visibilitychange', handleVisibility);
}
export function subscribeFrame(callback) {
  subscribers.add(callback); start();
  return () => { subscribers.delete(callback); if (!subscribers.size) { cancelAnimationFrame(frame); frame = 0; } };
}
export const motionPreferences = { fps: readonly(fps), reduced: reducedMotion,
  systemReduced:readonly(systemReduced), mode:readonly(manualReduced), setManualReduced:value=>{manualReduced.value=value;} };
if (import.meta.hot) import.meta.hot.dispose(() => {
  cancelAnimationFrame(frame); subscribers.clear();
  media?.removeEventListener('change', handleMedia);
  document.removeEventListener('visibilitychange', handleVisibility);
});
