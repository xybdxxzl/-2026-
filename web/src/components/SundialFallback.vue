<script setup>
import { computed, useId } from 'vue';
import { DIAL_RADIUS, hourMarks } from '../lib/astro/geometry.js';
import { DIAL_RADIUS as POLAR_RADIUS, STYLE_LENGTH_RATIO, dialLocalPoint, dialLocalToWorld, polarBasis } from '../lib/astro/sundialGeometry.js';
import { scaledSun } from '../lib/astro/tracks.js';

const props = defineProps({ solar: Object, tracks: Object, latitude: Number, layers: Object, compact: Boolean,
  polarMode: Boolean, face: String });
const clip = useId();
const at = ([e, n, u]) => [320 + (e - .30 * n) * 27, 235 - (.46 * n + u) * 27];
const point = v => at(v).map(x => x.toFixed(2)).join(',');
const circle = radius => Array.from({ length: 97 }, (_, i) => {
  const a = i / 96 * Math.PI * 2;
  return point([radius * Math.sin(a), radius * Math.cos(a), 0]);
}).join(' ');
const path = segments => (segments ?? []).map((v, i) => (i % 2 ? 'L' : 'M') + point(v)).join(' ');
const origin = [0, 0, 0];
const marks = computed(() => hourMarks(props.latitude).filter(mark => !props.compact || mark.major));
const shadow = computed(() => props.solar.shadow);
const tip = computed(() => props.solar.needle);
const foot = computed(() => tip.value && [tip.value[0], tip.value[1], 0]);
const sun = computed(() => scaledSun(props.solar.direction));
const ray = computed(() => tip.value?.map((value, i) => value + props.solar.direction[i] * 5));
const rayEnd = computed(() => {
  if (!shadow.value) return null;
  const portion = Math.min(1,DIAL_RADIUS / Math.max(1,shadow.value.distance));
  return tip.value.map((value,i) => value + (shadow.value.point[i] - value) * portion);
});

const project = ([x,y,z]) => {
  const side = props.face === 'back' ? -1 : 1;
  return [320 - (side * x * .82 + z * .57) * 23, 205 + (x * .28 - y * .90 - side * z * .43) * 23];
};
const worldPoint = v => project(v).map(value => value.toFixed(2)).join(',');
const localPoint = ([x,y,z=0]) => worldPoint(dialLocalToWorld([x,y,z],props.latitude));
const worldPath = segments => (segments ?? []).map((v,i) => (i%2?'L':'M') + worldPoint([v[0],v[2],-v[1]])).join(' ');
const localPath = (segments,faceName) => (segments ?? []).map((v,i) => (i%2?'L':'M') +
  localPoint([v[0],v[1],(faceName==='front'?1:-1)*.22])).join(' ');
const polarCircle = (offset=0) => Array.from({length:97},(_,i)=>{
  const a=i/96*Math.PI*2;
  return localPoint([Math.sin(a)*POLAR_RADIUS,Math.cos(a)*POLAR_RADIUS,offset]);
}).join(' ');
const polarMarks = computed(() => Array.from({length:24},(_,hour)=>({
  hour, label:['子','','丑','','寅','','卯','','辰','','巳','','午','','未','','申','','酉','','戌','','亥',''][hour],
  major:[0,6,12,18].includes(hour),
  angle: (hour - 12) * 15,
})));
const polarShadow = computed(() => props.solar.polar);
const showingShadow = computed(() => polarShadow.value.valid && polarShadow.value.face === props.face);
const basis = computed(() => polarBasis(props.latitude));
const needleA = computed(() => basis.value.P.map(value => -value*POLAR_RADIUS*STYLE_LENGTH_RATIO));
const needleB = computed(() => basis.value.P.map(value => value*POLAR_RADIUS*STYLE_LENGTH_RATIO));
const polarSun = computed(() => props.solar.polar?.sun.map(value => value*9));
const polarRayStart = computed(() => polarShadow.value?.tip?.map((value,i)=>value+polarShadow.value.sun[i]*8));
</script>

<template>
  <svg v-if="polarMode" class="fallback polar-fallback" viewBox="0 0 640 430" role="img"
    :aria-label="showingShadow ? '极轴日晷及解析日影' : '极轴日晷，当前视图无可读日影'">
    <defs>
      <linearGradient :id="clip+'-face'" x1="0" x2="1" y1="0" y2="1">
        <stop stop-color="#efe0bd"/><stop offset="1" stop-color="#aaad86"/>
      </linearGradient>
      <radialGradient :id="clip+'-glow'">
        <stop stop-color="#f5ba6b" stop-opacity=".6"/><stop offset="1" stop-color="#f5ba6b" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <path v-if="layers?.sky" :d="worldPath(tracks?.day)" fill="none" stroke="#d7a56c" stroke-width="1.7"/>
    <g v-if="layers?.sky && solar.altitude>0" :transform="'translate('+worldPoint(polarSun)+')'">
      <circle r="28" :fill="'url(#'+clip+'-glow)'"/>
      <circle r="6" fill="#fff1c7" stroke="#d7a56c" stroke-width="2"/>
    </g>
    <ellipse cx="320" cy="344" rx="172" ry="20" fill="#0b1813" opacity=".7"/>
    <path d="M169 315h302l17 18H152z" fill="#647468"/>
    <path d="M152 333h336v13H152z" fill="#43574e"/>
    <path d="M263 315l28-105m86 105-28-105" fill="none" stroke="#a48050" stroke-width="6"/>
    <polygon :points="polarCircle(0)" fill="#806645" transform="translate(0 7)"/>
    <polygon :points="polarCircle(0)" :fill="'url(#'+clip+'-face)'" stroke="#c49b60" stroke-width="3"/>
    <g v-for="mark in polarMarks" :key="mark.hour">
      <path :d="'M'+localPoint(dialLocalPoint(.8,mark.angle))+'L'+localPoint(dialLocalPoint(4.4,mark.angle))"
        stroke="#425749" :stroke-width="mark.major?1.9:1"/>
      <text v-if="mark.label" :transform="'translate('+localPoint(dialLocalPoint(3.55,mark.angle))+')'"
        text-anchor="middle" dominant-baseline="central" font-size="14" paint-order="stroke" stroke="#d7ccaa" stroke-width="3"
        fill="#243e36">{{ mark.label }}</text>
    </g>
    <path v-if="layers?.shadow && tracks?.polar" :d="localPath(tracks.polar[face],face)" fill="none" stroke="#a66f5c" stroke-width="2"/>
    <path v-if="showingShadow" :d="'M'+localPoint([0,0,0])+'L'+localPoint(polarShadow.localEnd)" stroke="#25392f" stroke-width="5" stroke-linecap="round"/>
    <path v-if="showingShadow && !polarShadow.inside" :d="'M'+localPoint(polarShadow.localEnd)+'L'+localPoint(polarShadow.local)"
      stroke="#d3c7ad" stroke-width="1.7" stroke-dasharray="5 4"/>
    <path :d="'M'+worldPoint(origin)+'L'+worldPoint(face==='back'?needleA:needleB)" stroke="#715335" stroke-width="6" stroke-linecap="round"/>
    <circle v-if="showingShadow" :transform="'translate('+localPoint(polarShadow.local)+')'"
      r="5" fill="#a54a39" stroke="#fff4d7" stroke-width="2"/>
    <path v-if="layers?.ray && showingShadow" :d="'M'+worldPoint(polarRayStart)+'L'+worldPoint(polarShadow.tip)+'L'+worldPoint(polarShadow.point)"
      fill="none" stroke="#ffe2a2" stroke-width="2" stroke-dasharray="5 4"/>
    <text x="320" y="407" text-anchor="middle" font-size="12" fill="#b5c3b8">二维示意 · {{ face === 'back' ? '背面' : '正面' }}</text>
  </svg>
  <svg v-else class="fallback" :viewBox="compact ? '135 140 370 167' : '0 0 640 345'" role="img"
    :aria-label="solar.shadow ? '水平日晷及晷针投影' : '水平日晷，当前无可读日影'">
    <defs><clipPath :id="clip"><polygon :points="circle(DIAL_RADIUS)" /></clipPath></defs>
    <g v-if="!compact && layers?.sky">
      <path :d="path(tracks?.night)" fill="none" stroke="#a29d8b" stroke-dasharray="2 4"/>
      <path :d="path(tracks?.day)" fill="none" stroke="#b07b39" stroke-width="2.2"/>
    </g>
    <circle v-if="!compact && solar.altitude > 0" :cx="at(sun)[0]" :cy="at(sun)[1]" r="6" fill="#b77535"/>
    <polygon :points="circle(DIAL_RADIUS)" transform="translate(0 8)" fill="#8d734c"/>
    <polygon :points="circle(DIAL_RADIUS)" fill="#dfc595" stroke="#9d7c4c"/>
    <polygon :points="circle(4.68)" fill="none" stroke="#aa8c5f"/>
    <g v-for="mark in marks" :key="mark.hour">
      <path :d="'M'+point(mark.direction.map(v => v * .55))+'L'+point(mark.direction.map(v => v * 4.12))"
        :stroke="mark.hour === 12 ? '#9e4935' : '#8e7859'" :stroke-width="mark.major ? 1 : .5"/>
      <text v-if="mark.label && (!compact || [6,12,18].includes(mark.hour))"
        :x="at(mark.direction.map(v => v * 4.48))[0]" :y="at(mark.direction.map(v => v * 4.48))[1]"
        text-anchor="middle" dominant-baseline="central" fill="#44392b" font-size="9">{{ mark.label }}</text>
    </g>
    <g :clip-path="'url(#'+clip+')'">
      <path v-if="!compact && layers?.shadow" :d="path(tracks?.shadow)" fill="none" stroke="#37685b" stroke-width="2" stroke-dasharray="4 4"/>
      <polygon v-if="shadow" :points="[point(origin),point(foot),point(shadow.point)].join(' ')" fill="#37433a" opacity=".30"/>
      <path v-if="shadow" :d="'M'+point(origin)+'L'+point(shadow.end)" fill="none" stroke="#2c4139" stroke-width="3"/>
    </g>
    <polygon v-if="tip" :points="[point(origin),point(foot),point(tip)].join(' ')" fill="#536b5c" stroke="#344b3e"/>
    <path v-if="!compact && layers?.ray && shadow" :d="'M'+point(ray)+'L'+point(tip)+'L'+point(rayEnd)"
      fill="none" stroke="#a66a2d" stroke-width="1.6" stroke-dasharray="4 3"/>
    <circle v-if="shadow?.inside" :cx="at(shadow.point)[0]" :cy="at(shadow.point)[1]" r="4" fill="#9e4935" stroke="#fff4d7"/>
    <text v-if="!compact && layers?.compass" x="319" y="306" text-anchor="middle" fill="#486052" font-size="12">东右 · 北向画面深处</text>
  </svg>
</template>

<style scoped>
.fallback { display:block; width:100%; height:100%; min-height:0; }
</style>
