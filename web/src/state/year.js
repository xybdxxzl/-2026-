import { computed, reactive, readonly } from 'vue';
import { TERMS, getTerm } from '../data/terms.js';
import { normalize, nearestTurn } from '../core/angle.js';
import { createMotion, advanceMotion, dragMotion, releaseMotion, springMotion, finishMotion } from '../core/physics.js';
import { initializeLoop, subscribeFrame, motionPreferences } from '../core/loop.js';
import { nearestTermIndex } from '../core/wheelGeometry.js';

const motion = createMotion();
const state = reactive({ yearAngle: 0, phase: 'idle', velocity: 0, target: 0, dragSource: null, settled: 0,
  focus: null, relatedTermIds: [], panelOpen: false, debug: false, atmosphere: true,
  particles: { rain: 0, snow: 0, leaf: 0 }, quality: 1, houFocus:null });
let initialized = false;
let unsubscribeFrame;
function sync() {
  state.yearAngle = motion.angle; state.phase = motion.phase; state.target = motion.target;
  state.velocity = motion.velocity;
  state.settled = motion.settled;
  if (motion.phase === 'idle') state.dragSource = null;
}
function initialize(id) {
  if (initialized) return;
  initialized = true;
  initializeLoop();
  const value = getTerm(id).index * 15;
  Object.assign(motion, createMotion(value)); sync();
  unsubscribeFrame = subscribeFrame(dt => {
    if (motionPreferences.reduced.value && ['spring', 'inertia'].includes(motion.phase)) finishMotion(motion);
    else advanceMotion(motion, dt);
    if (motion.phase !== 'drag') sync();
  });
}
function clearFocus() { state.focus = null; state.relatedTermIds = []; state.houFocus=null; }
function goToAngle(angle, { clear = true } = {}) {
  if (clear) clearFocus();
  state.dragSource = null;
  springMotion(motion, nearestTurn(motion.angle, angle), motionPreferences.reduced.value); sync();
}
function selectTerm(id, options) { goToAngle(getTerm(id).index * 15, options); }
function selectHou(id,order) {
  const term=getTerm(id);
  selectTerm(term.id);
  state.houFocus={termId:term.id,order:Math.max(0,Math.min(2,order))};
}
function beginDrag(source) {
  clearFocus(); state.dragSource = source;
  dragMotion(motion, motion.angle); sync();
}
function dragTo(angle) { dragMotion(motion, angle); sync(); }
function release(velocity = 0) { releaseMotion(motion, velocity, motionPreferences.reduced.value); sync(); }
function step(direction) {
  const base = ['spring', 'inertia'].includes(motion.phase) ? motion.target : motion.angle;
  goToAngle(Math.round(base / 15) * 15 + direction * 15);
}
function stop() {
  dragMotion(motion, motion.angle); motion.phase = 'idle'; state.dragSource = null; sync();
}
const longitude = computed(() => normalize(state.yearAngle + 315));
// 主针选择最近的节气中心；三候是该节气内的内容焦点，不另转主盘。
const currentTerm = computed(() => TERMS[nearestTermIndex(state.yearAngle)]);
const currentHou = computed(() => currentTerm.value.hou[state.houFocus?.termId===currentTerm.value.id?state.houFocus.order:0]);
export const year = {
  state: readonly(state), longitude, term: currentTerm, hou: currentHou,
  normalized: computed(() => normalize(state.yearAngle)),
  moving: computed(() => state.phase !== 'idle'),
  initialize, selectTerm, selectHou, goToAngle, beginDrag, dragTo, release, step, stop, clearFocus,
  setPanel: value => { state.panelOpen = value; },
  setDebug: value => { state.debug = value; },
  setAtmosphere: value => { state.atmosphere = value; },
  setFocus: (focus, termIds) => { state.focus = focus; state.relatedTermIds = termIds; },
  reportParticles: (counts, quality) => { state.particles = counts; state.quality = quality; },
};
if (import.meta.hot) import.meta.hot.dispose(() => unsubscribeFrame?.());
