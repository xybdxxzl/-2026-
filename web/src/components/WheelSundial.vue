<script setup>
import { computed, useId } from 'vue';
import { dialHourDirection } from '../lib/astronomy.js';
import { WHEEL_DIAL, projectDial, dialCirclePath, wheelSundial } from '../core/wheelSundial.js';
import { savedObservation } from '../state/observation.js';
import { year } from '../state/year.js';
import { noonPreview } from '../lib/astro/observation.js';
import { hourDirection } from '../lib/astro/geometry.js';

const props=defineProps({longitude:{type:Number,required:true}});
const uid=`wheel-dial-${useId().replace(/[^a-z0-9-]/gi,'')}`;
const actual = computed(() => noonPreview(savedObservation.value,year.term.value.id));
const dial = computed(() => {
  if (!savedObservation.value) return wheelSundial(props.longitude);
  const sample = actual.value;
  return { origin:projectDial(0,0),
    foot:sample?.needle ? projectDial(...sample.needle.slice(0,2)) : null,
    tip:sample?.needle ? projectDial(...sample.needle) : null,
    shadow:sample?.shadow ? projectDial(...sample.shadow.end) : null,
    inside:sample?.shadow?.distance <= WHEEL_DIAL.radius };
});
const face=dialCirclePath(WHEEL_DIAL.radius);
const hours=computed(()=>!actual.value?.needle && savedObservation.value ? [] : Array.from({length:25},(_,index)=>{
  const time=6+index/2;
  const latitude=savedObservation.value?.place.latitude;
  const direction = latitude == null ? dialHourDirection(time) : (() => {
    const [east,north] = hourDirection(time,latitude);
    return {east,north};
  })();
  const at=radius=>projectDial(direction.east*radius,direction.north*radius);
  return {time,whole:index%2===0,major:index%4===0,start:at(.65),end:at(3.7),tick:at(4.02),label:at(4.3),
    name:({6:'卯',8:'辰',10:'巳',12:'午',14:'未',16:'申',18:'酉'})[time]};
}));
const perimeter=Array.from({length:72},(_,index)=>{
  const angle=index*5*Math.PI/180;
  const at=radius=>projectDial(radius*Math.sin(angle),radius*Math.cos(angle));
  return {start:at(index%3===0?4.37:4.43),end:at(4.5)};
});
</script>

<template>
  <g class="wheel-sundial" aria-hidden="true">
    <defs>
      <linearGradient :id="`${uid}-face`" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#efe0b8"/><stop offset=".48" stop-color="#dbc390"/><stop offset="1" stop-color="#c3a470"/></linearGradient>
      <linearGradient :id="`${uid}-edge`" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#a18450"/><stop offset=".55" stop-color="#806441"/><stop offset="1" stop-color="#b39762"/></linearGradient>
      <linearGradient :id="`${uid}-needle`" x1="0" y1="0" x2="1" y2=".4"><stop stop-color="#637b67"/><stop offset=".55" stop-color="#3e594a"/><stop offset="1" stop-color="#233c32"/></linearGradient>
      <filter :id="`${uid}-ground`" x="-.2" y="-.5" width="1.4" height="2"><feGaussianBlur stdDeviation="5"/></filter>
      <clipPath :id="`${uid}-clip`"><path :d="face"/></clipPath>
    </defs>
    <path :d="face" transform="translate(2 19)" fill="#4a4b32" opacity=".16" :filter="`url(#${uid}-ground)`"/>
    <path :d="face" transform="translate(0 12)" :fill="`url(#${uid}-edge)`" stroke="#806644" stroke-width="1.2"/>
    <path :d="face" transform="translate(0 8)" fill="none" stroke="#ddc48d" stroke-width=".7" opacity=".5"/>
    <path :d="face" :fill="`url(#${uid}-face)`" stroke="#a68b58" stroke-width="1.5"/>
    <path :d="dialCirclePath(4.53)" fill="none" stroke="#fff2cc" stroke-width="1.1"/>
    <path :d="dialCirclePath(4.17)" fill="none" stroke="#9b8050" stroke-width=".8"/>
    <path :d="dialCirclePath(3.78)" fill="none" stroke="#8c754e" stroke-width=".8"/>
    <line v-for="(tick,index) in perimeter" :key="index" :x1="tick.start.x" :y1="tick.start.y" :x2="tick.end.x" :y2="tick.end.y" stroke="#8b7047" stroke-width=".8"/>
    <g v-for="hour in hours" :key="hour.time">
      <line :x1="hour.start.x" :y1="hour.start.y" :x2="hour.end.x" :y2="hour.end.y" :stroke="hour.time===12?'#964831':'#8e744e'" :stroke-width="hour.whole?1:.65" :opacity="hour.whole?.65:.35"/>
      <line :x1="hour.end.x" :y1="hour.end.y" :x2="hour.tick.x" :y2="hour.tick.y" stroke="#705938" :stroke-width="hour.major?1.4:.8"/>
      <text v-if="hour.major" :x="hour.label.x" :y="hour.label.y" :fill="hour.time===12?'#873b2c':'#5b4a31'">{{hour.name}}</text>
    </g>
    <g :clip-path="`url(#${uid}-clip)`">
      <path v-if="dial.shadow" :d="`M${dial.origin.x} ${dial.origin.y} L${dial.foot.x} ${dial.foot.y} L${dial.shadow.x} ${dial.shadow.y} Z`" fill="#344139" opacity=".25"/>
      <line v-if="dial.shadow" class="dial-noon-shadow" :x1="dial.origin.x" :y1="dial.origin.y" :x2="dial.shadow.x" :y2="dial.shadow.y" stroke="#36463b" stroke-width="4" stroke-linecap="round" opacity=".8"/>
    <circle v-if="dial.shadow && (!savedObservation || dial.inside)" class="dial-shadow-tip" :cx="dial.shadow.x" :cy="dial.shadow.y" r="4" fill="#9e4935" stroke="#fff2cf" stroke-width="1.5"/>
    </g>
    <path v-if="dial.tip" :d="`M${dial.origin.x} ${dial.origin.y} L${dial.foot.x} ${dial.foot.y} L${dial.tip.x} ${dial.tip.y} Z`" :fill="`url(#${uid}-needle)`" stroke="#2c493b" stroke-width="1"/>
    <path v-if="dial.tip" :d="`M${dial.origin.x} ${dial.origin.y} L${dial.tip.x} ${dial.tip.y} L${dial.tip.x+4} ${dial.tip.y+1.5} Z`" fill="#b3bb91" stroke="#c5cba9" stroke-width=".4"/>
    <circle :cx="dial.origin.x" :cy="dial.origin.y" r="3" fill="#725734" stroke="#e8d4a2" stroke-width="1"/>
    <path d="M381 391h13m-6.5-6.5v13" fill="none" stroke="#9b8153" stroke-width=".8"/>
    <text class="dial-engraving" x="428" y="393">授时</text>
  </g>
</template>

<style scoped>
.wheel-sundial { pointer-events:none; }
.wheel-sundial text { font-family:var(--font-display); font-size:15px; text-anchor:middle; dominant-baseline:central; }
.wheel-sundial .dial-engraving { fill:#76603c; font-size:14px; letter-spacing:5px; }
</style>
