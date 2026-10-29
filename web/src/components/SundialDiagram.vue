<script setup>
import { computed, useId, ref, onMounted, onBeforeUnmount, onActivated } from 'vue';
import { DEMO_MODEL, sundialModel, dialHourDirection, formatSolarTime } from '../lib/astronomy.js';
import { year } from '../state/year.js';
import { subscribeFrame, motionPreferences } from '../core/loop.js';
import { shortestDelta } from '../core/angle.js';

const props = defineProps({
  longitude: { type: Number, default: 315 },
  solarTime: { type: Number, default: 12 },
  compact: Boolean,
  showPaths: { type: Boolean, default: true },
});
const uid = `dial-${useId().replace(/[^a-z0-9-]/gi, '')}`;
const radius = 5;
const scale = 57;
const displayedLongitude = ref(props.longitude);
let unsubscribe;
onMounted(() => { unsubscribe = subscribeFrame(dt => {
  const delta = shortestDelta(displayedLongitude.value, props.longitude);
  if (Math.abs(delta) < .005 || motionPreferences.reduced.value) displayedLongitude.value = props.longitude;
  else displayedLongitude.value += delta * (1 - Math.exp(-dt / .09));
}); });
onActivated(() => { displayedLongitude.value = props.longitude; });
onBeforeUnmount(() => unsubscribe?.());
const model = computed(() => sundialModel(displayedLongitude.value, props.solarTime));
const project = (east, north, up = 0) => ({ x: 400 + scale * (east - .25 * north), y: 252 - scale * (.52 * north + .92 * up) });
const origin = project(0, 0);
const styleFoot = computed(() => project(0, model.value.styleNorth));
const styleTip = computed(() => project(0, model.value.styleNorth, 1));
const shadowTip = computed(() => model.value.shadow ? project(model.value.shadow.east, model.value.shadow.north) : null);
function circlePath(r) {
  return Array.from({ length: 97 }, (_, i) => {
    const angle = i / 96 * 2 * Math.PI;
    const p = project(r * Math.sin(angle), r * Math.cos(angle));
    return `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  }).join(' ') + 'Z';
}
const face = circlePath(radius);
const hours = Array.from({ length: 33 }, (_, i) => {
  const time = 4 + i / 2;
  const direction = dialHourDirection(time);
  const point = r => project(direction.east * r, direction.north * r);
  const major = i % 4 === 0;
  return { time, major, whole: i % 2 === 0, start: point(.48), end: point(4.12), tick: point(4.42), label: point(4.7), name: ({4:'寅正',6:'卯正',8:'辰正',10:'巳正',12:'午正',14:'未正',16:'申正',18:'酉正',20:'戌正'})[time] };
});
const tracks = [{ longitude: 90, name: '夏至', color: '#b19b66' }, { longitude: 0, name: '春秋分', color: '#718c82' }, { longitude: 270, name: '冬至', color: '#a57664' }].map(track => {
  let path = '', joined = false;
  for (let i = 0; i <= 720; i++) {
    const state = sundialModel(track.longitude, i / 30);
    if (!state.lit || state.altitude < .5) { joined = false; continue; }
    const p = project(state.shadow.east, state.shadow.north);
    path += `${joined ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)} `;
    joined = true;
  }
  return { ...track, path };
});
const shadowPath = computed(() => shadowTip.value ? `M${origin.x},${origin.y} L${styleFoot.value.x},${styleFoot.value.y} L${shadowTip.value.x},${shadowTip.value.y} Z` : '');
const inside = computed(() => model.value.lit && model.value.shadowDistance <= radius);
const ariaText = computed(() => `水平式日晷，真太阳时${formatSolarTime(props.solarTime)}，${model.value.lit ? `太阳高度${model.value.altitude.toFixed(1)}度` : '太阳在地平线下，无直射日影'}`);
</script>

<template>
  <div class="sundial-object" :class="{ 'is-compact': compact }">
    <svg viewBox="0 0 800 445" role="img" :aria-label="ariaText">
      <defs>
        <linearGradient :id="`${uid}-stone`" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#fbf8ef"/><stop offset=".45" stop-color="#eee9db"/><stop offset="1" stop-color="#d9d0bb"/></linearGradient>
        <linearGradient :id="`${uid}-edge`" x2="0" y2="1"><stop stop-color="#c0ad82"/><stop offset="1" stop-color="#756644"/></linearGradient>
        <linearGradient :id="`${uid}-needle`" x2="1" y2="0"><stop stop-color="#6d786b"/><stop offset=".55" stop-color="#a3ae98"/><stop offset="1" stop-color="#3f554a"/></linearGradient>
        <clipPath :id="`${uid}-clip`"><path :d="face"/></clipPath>
        <filter :id="`${uid}-blur`" x="-.2" y="-.5" width="1.4" height="2"><feGaussianBlur stdDeviation="7"/></filter>
      </defs>
      <ellipse cx="405" cy="282" rx="280" ry="143" fill="#53614d" opacity=".1" :filter="`url(#${uid}-blur)`"/>
      <path :d="face" transform="translate(0 15)" :fill="`url(#${uid}-edge)`" stroke="#8c7a54" stroke-width="1"/>
      <path :d="face" :fill="`url(#${uid}-stone)`" stroke="#b9ab8d" stroke-width="1.2"/>
      <path :d="circlePath(4.88)" fill="none" stroke="#d0c4a9" stroke-width=".7"/>
      <path :d="circlePath(4.35)" fill="none" stroke="#ad9d7a" stroke-width=".9"/>
      <path :d="circlePath(.38)" fill="none" stroke="#b4aa90" stroke-width=".8"/>

      <g v-for="hour in (compact ? hours.filter(item => item.whole) : hours)" :key="hour.time">
        <line :x1="hour.start.x" :y1="hour.start.y" :x2="hour.end.x" :y2="hour.end.y" :stroke="hour.time === 12 ? '#a6684f' : '#a6a28b'" :stroke-width="hour.whole ? .9 : .5" :opacity="hour.whole ? .7 : .45"/>
        <line :x1="hour.end.x" :y1="hour.end.y" :x2="hour.tick.x" :y2="hour.tick.y" stroke="#887f63" :stroke-width="hour.major ? 1.5 : .7"/>
        <text v-if="hour.major && (!compact || [6,12,18].includes(hour.time))" :x="hour.label.x" :y="hour.label.y+4" text-anchor="middle" :fill="hour.time === 12 ? '#a46048' : '#6e725d'" :font-size="compact ? 28 : 16" letter-spacing="2">{{ compact ? hour.name[0] : hour.name }}</text>
      </g>

      <g :clip-path="`url(#${uid}-clip)`">
        <path v-for="track in showPaths && !compact ? tracks : []" :key="track.longitude" :d="track.path" fill="none" :stroke="track.color" stroke-width="1.5" stroke-dasharray="3 5" opacity=".72"/>
        <path v-if="model.lit" :d="shadowPath" fill="#4b5745" opacity=".15"/>
        <line v-if="shadowTip" :x1="origin.x" :y1="origin.y" :x2="shadowTip.x" :y2="shadowTip.y" stroke="#4b5140" stroke-width="3.4" opacity=".72" stroke-linecap="round"/>
        <circle v-if="inside" :cx="shadowTip.x" :cy="shadowTip.y" r="5.5" fill="#ad6149" stroke="#fbf5e8" stroke-width="2"/>
        <circle v-if="inside && !compact" :key="`settled-${year.state.settled}`" class="shadow-settle-ring" :cx="shadowTip.x" :cy="shadowTip.y" r="7" fill="none" stroke="#ad6149" stroke-width="1.5"/>
      </g>

      <text x="430" y="324" text-anchor="middle" fill="#6a765f" :font-size="compact ? 36 : 26" letter-spacing="13">日晷</text>
      <text v-if="!compact" x="430" y="346" text-anchor="middle" fill="#8e907c" font-size="10" letter-spacing="3">水平式 · 演示纬度35°N</text>
      <path :d="`M${origin.x},${origin.y} L${styleFoot.x},${styleFoot.y} L${styleTip.x},${styleTip.y} Z`" :fill="`url(#${uid}-needle)`" stroke="#586654" stroke-width=".8"/>
      <path :d="`M${origin.x},${origin.y} L${styleTip.x},${styleTip.y} L${styleTip.x+5},${styleTip.y+3} Z`" fill="#c4c8b1" opacity=".9"/>
      <circle :cx="origin.x" :cy="origin.y" r="3" fill="#7d8069"/>
      <g v-if="!compact" class="dial-callouts" fill="#8c907b" font-size="11">
        <path :d="`M${styleTip.x-7},${styleTip.y} L260,70 H180`" fill="none" stroke="#aab09d" stroke-width=".7"/>
        <text x="171" y="74" text-anchor="end">晷针指向北天极</text>
        <text x="320" y="82" text-anchor="middle" font-size="10">北</text>
      </g>
      <text v-if="!model.lit" x="400" y="424" text-anchor="middle" fill="#8c7f6b" font-size="13">太阳在地平线下 · 日晷无直射日影</text>
      <text v-else-if="!inside && !compact" x="400" y="424" text-anchor="middle" fill="#8c7f6b" font-size="12">影端超出晷面，仍可沿影线读时</text>
    </svg>
    <div v-if="!compact && showPaths" class="dial-path-legend" aria-label="不同节气的影端轨迹">
      <span v-for="track in tracks" :key="track.longitude"><i :style="{ background: track.color }"></i>{{ track.name }}影端轨迹</span>
    </div>
  </div>
</template>

<style scoped>
.sundial-object{position:relative;width:100%;max-width:850px;margin:auto}.sundial-object svg{display:block;width:100%;height:auto;overflow:visible}.dial-path-legend{display:flex;justify-content:center;gap:22px;margin-top:-15px;color:#858c77;font-size:10px;letter-spacing:.04em}.dial-path-legend span{display:flex;gap:7px;align-items:center}.dial-path-legend i{width:15px;height:1px}.is-compact svg{margin-block:-8px -13px}.is-compact .dial-callouts{display:none}@media(max-width:650px){.dial-path-legend{gap:12px;font-size:9px;margin-top:-6px}}
.shadow-settle-ring{transform-box:fill-box;transform-origin:center;animation:shadow-ping .55s ease-out both}@keyframes shadow-ping{from{transform:scale(1);opacity:.65}to{transform:scale(4);opacity:0}}
</style>
