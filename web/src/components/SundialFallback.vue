<script setup>
import { computed, useId } from 'vue';
import { DIAL_RADIUS, hourMarks } from '../lib/astro/geometry.js';
import { scaledSun } from '../lib/astro/tracks.js';

const props = defineProps({ solar: Object, tracks: Object, latitude: Number, layers: Object, compact: Boolean });
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
</script>

<template>
  <svg class="fallback" :viewBox="compact ? '135 140 370 167' : '0 0 640 345'" role="img"
    :aria-label="solar.shadow ? '水平日晷及晷针投影' : '水平日晷，当前无可读日影'">
    <defs><clipPath :id="clip"><polygon :points="circle(DIAL_RADIUS)" /></clipPath></defs>
    <g v-if="!compact && layers.sky">
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
      <path v-if="!compact && layers.shadow" :d="path(tracks?.shadow)" fill="none" stroke="#37685b" stroke-width="2" stroke-dasharray="4 4"/>
      <polygon v-if="shadow" :points="[point(origin),point(foot),point(shadow.point)].join(' ')" fill="#37433a" opacity=".30"/>
      <path v-if="shadow" :d="'M'+point(origin)+'L'+point(shadow.end)" fill="none" stroke="#2c4139" stroke-width="3"/>
    </g>
    <polygon v-if="tip" :points="[point(origin),point(foot),point(tip)].join(' ')" fill="#536b5c" stroke="#344b3e"/>
    <path v-if="!compact && layers.ray && shadow" :d="'M'+point(ray)+'L'+point(tip)+'L'+point(rayEnd)"
      fill="none" stroke="#a66a2d" stroke-width="1.6" stroke-dasharray="4 3"/>
    <circle v-if="shadow?.inside" :cx="at(shadow.point)[0]" :cy="at(shadow.point)[1]" r="4" fill="#9e4935" stroke="#fff4d7"/>
    <text v-if="!compact && layers.compass" x="319" y="306" text-anchor="middle" fill="#486052" font-size="12">东右 · 北向画面深处</text>
  </svg>
</template>
<style scoped>
.fallback { display:block; width:100%; height:100%; min-height:0; }
</style>
