<script setup>
import { computed } from 'vue';
import { bowlAnchor, bowlEngravings, bowlLocalPoint } from '../lib/astro/bowlSundial.js';
import { branches, inscriptionFont, palette as p, SUNDIAL_SOLSTICES } from '../scene/sundial/sundialTheme.js';
const props=defineProps({latitude:Number,solar:Object,layers:Object,secondary:Object,tracks:Object,solsticeDriver:String});
const xy=([x,,z])=>[180+125*x,144+125*z];
const path=points=>points.map((v,i)=>(i?'L':'M')+xy(v).join(',')).join(' ');
const marks=computed(()=>bowlEngravings(props.latitude));
const dot=computed(()=>bowlLocalPoint(props.solar.polar.sun,1));
const peer=computed(()=>bowlLocalPoint(props.secondary?.polar?.sun,1));
const driverColor=computed(()=>SUNDIAL_SOLSTICES[props.solsticeDriver]?.color);
const peerColor=computed(()=>props.solsticeDriver ? SUNDIAL_SOLSTICES[props.solsticeDriver==='xiazhi' ? 'dongzhi' : 'xiazhi'].color : p.bronze);
const foot=computed(()=>xy(bowlAnchor(props.latitude)));
const track=computed(()=>props.tracks?.day?.map(([east,north,up])=>{
  const len=Math.hypot(east,north,up);return [-east/len,-up/len,north/len];
})??[]);
const color=mark=>mark.kind==='winter'?p.winter:mark.kind==='summer'||mark.hour===12?p.cinnabar:mark.kind==='branch'?p.ink:p.lightInk;
</script>

<template>
  <svg class="bowl-flat" viewBox="0 0 360 288" role="img" aria-label="半球碗式日晷俯视与珠影落点">
    <circle cx="180" cy="144" r="131" :fill="p.bronze"/><circle cx="180" cy="144" r="125" :fill="p.marble" :stroke="p.bronzeDark"/>
    <g v-for="(line,i) in marks.lines" :key="i" fill="none" :stroke="color(line)" :stroke-width="line.kind==='branch'?1.45:line.kind==='minor'||line.kind==='winter'?.65:1">
      <path v-for="(arc,j) in line.arcs" :key="j" :d="path(arc)"/>
    </g>
    <text v-for="{hour,point} in marks.letters" :key="hour" :x="xy(point)[0]" :y="xy(point)[1]"
      text-anchor="middle" dominant-baseline="middle" :font-family="inscriptionFont" font-size="14"
      paint-order="stroke" :stroke="p.marble" stroke-width="2.5" :fill="hour===12?p.cinnabar:p.ink">{{ branches[hour/2] }}</text>
    <path v-if="layers?.shadow && track.length" :d="track.map((v,i)=>(i%2?'L':'M')+xy(v).join(',')).join(' ')" fill="none" :stroke="p.cinnabar" stroke-width="1.3"/>
    <line :x1="foot[0]" :y1="foot[1]" x2="180" y2="144" :stroke="p.bronze" stroke-width="2.5"/>
    <circle cx="180" cy="144" r="3.4" :fill="p.bronze"/>
    <line v-if="dot && layers?.ray" x1="180" y1="144" :x2="xy(dot)[0]" :y2="xy(dot)[1]" :stroke="p.bronze" stroke-dasharray="4 3"/>
    <circle v-if="dot" :cx="xy(dot)[0]" :cy="xy(dot)[1]" r="3.5" :fill="driverColor ?? p.shadow"/>
    <circle v-if="peer" :cx="xy(peer)[0]" :cy="xy(peer)[1]" r="5" fill="none" :stroke="peerColor"/>
    <line x1="180" y1="13" x2="180" y2="19" :stroke="p.cinnabar" stroke-width="3"/>
    <line v-for="angle in [90,180,270]" :key="angle" x1="180" y1="13" x2="180" y2="19"
      :transform="'rotate('+angle+' 180 144)'" :stroke="p.bronzeDark" stroke-width="1.5"/>
  </svg>
</template>
<style scoped>.bowl-flat{width:100%;height:100%}</style>
