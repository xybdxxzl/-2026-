<script setup>
import { computed, ref } from 'vue';
import { branches, SUNDIAL_SOLSTICES } from '../scene/sundial/sundialTheme.js';
import { FINAL_MINUTE, solarAltitudeGradient, timelinePercent } from '../scene/sundial/timelineGradient.js';
import RulerSegments from './RulerSegments.vue';

const props=defineProps({
  value:Number, playing:Boolean, speed:Number, solar:Object, daylight:Object,
  samples:{type:Array,default:()=>[]}, comparison:{type:Array,default:()=>[]},
});
const emit=defineEmits(['input','commit','toggle-play','step','noon','update:speed']);
const DAY=FINAL_MINUTE+1;
const fmt=minutes=>`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
const minute=computed(()=>Math.max(0,Math.min(FINAL_MINUTE,Math.round(props.value))));
function periodName(value){
  const hour=Math.floor(value/60);
  return branches[Math.floor((hour+1)%24/2)]+(hour%2?'初':'正');
}
const period=computed(()=>periodName(minute.value));
const ariaText=computed(()=>{
  const altitude=props.solar?.altitude;
  const time='真太阳时 '+fmt(minute.value)+' · '+period.value;
  return Number.isFinite(altitude)?time+'，太阳高度 '+altitude.toFixed(1)+'°':time;
});
const speedOptions=[1,2,4].map(value=>({value,label:value+'×'}));
function crossingsFor(day){
  if(day?.state!=='regular'||!Number.isFinite(day.sunrise)||!Number.isFinite(day.sunset))return null;
  return {sunrise:day.sunrise*60,sunset:day.sunset*60};
}
const crossings=computed(()=>crossingsFor(props.daylight));
const gradient=computed(()=>solarAltitudeGradient(props.samples));
const comparisonBands=computed(()=>props.comparison.flatMap(({id,daylight})=>{
  const theme=SUNDIAL_SOLSTICES[id];
  if(!theme||!daylight)return [];
  const limits=crossingsFor(daylight);
  return [{id,name:theme.name,hasDaylight:Boolean(limits)||daylight.state==='polar-day',style:{
    '--comparison-color':theme.color,'--comparison-start':timelinePercent(limits?.sunrise??0),
    '--comparison-end':timelinePercent(limits?.sunset??FINAL_MINUTE),
  }}];
}));

const input=ref(null), rail=ref(null);
let gesture=null;
const ticks=Array.from({length:25},(_,hour)=>({
  hour,position:timelinePercent(hour*60),initial:hour%2===1,
  name:branches[Math.floor((hour+1)%24/2)],title:fmt(hour*60)+' · '+periodName(hour*60),
  clockLabel:hour%6===0?String(hour).padStart(2,'0'):null,
}));
const events=computed(()=>crossings.value?Object.entries(crossings.value).map(([key,value])=>({
  key,label:key==='sunrise'?'日出':'日落',time:fmt(Math.round(value)%DAY),minute:value,position:timelinePercent(value),
})):[]);
const crowded=computed(()=>events.value.length===2&&Math.abs(events.value[0].minute-events.value[1].minute)<DAY*.21);
function point(event){
  const fraction=Math.max(0,Math.min(1,(event.clientX-gesture.left)/gesture.width));
  emit('input',Math.round(fraction*FINAL_MINUTE));
}
function down(event){
  if(event.button!==0||gesture)return;
  const box=rail.value.getBoundingClientRect();
  gesture={id:event.pointerId,left:box.left,width:box.width};
  input.value.focus({preventScroll:true});rail.value.setPointerCapture(event.pointerId);
  point(event);
}
function move(event){if(gesture?.id===event.pointerId)point(event);}
function end(event){
  if(gesture?.id!==event.pointerId)return;
  if(event.type==='pointerup')point(event);
  gesture=null;
  emit('commit');
}
</script>

<template>
  <div class="time-axis" aria-label="一日真太阳时">
    <div class="ruler-heading">
      <h3>授时尺</h3>
      <div class="ruler-reading"><span>真太阳时</span><output>{{ fmt(minute) }}<b aria-hidden="true"> · </b><em>{{ period }}</em></output></div>
    </div>
    <slot/>
    <div class="ruler-row day-row">
      <span class="ruler-label day-label" aria-hidden="true">
        <span>日</span><small class="tick-key"><span>初</span><span>正</span></small>
      </span>
      <div ref="rail" class="day-field" :class="{crowded}" @pointerdown="down" @pointermove="move"
        @pointerup="end" @pointercancel="end" @lostpointercapture="end">
        <input ref="input" :value="minute" class="slider sr-only" type="range" min="0" :max="FINAL_MINUTE" step="1"
          aria-label="真太阳时" :aria-valuetext="ariaText" @input="emit('input',$event.target.valueAsNumber)" @change="emit('commit')"/>
        <div class="day-print" aria-hidden="true">
          <div class="day-wash" :class="{'all-day':daylight?.state==='polar-day'}" :style="{backgroundImage:gradient}">
            <i v-if="!gradient && crossings" class="fallback-daylight" :style="{left:timelinePercent(crossings.sunrise),right:'calc(100% - '+timelinePercent(crossings.sunset)+')'}"></i>
          </div>
          <span v-for="band in comparisonBands" :key="band.id" class="comparison-rail" :class="band.id" :style="band.style">
            <i v-if="band.hasDaylight"></i>
          </span>
          <span v-for="tick in ticks" :key="tick.hour" :class="['hour-tick',{initial:tick.initial,noon:tick.hour===12,'at-start':tick.hour===0,'at-end':tick.hour===24}]"
            :style="{left:tick.position}" :title="tick.title">
            <i></i><span v-if="!tick.initial">{{ tick.name }}<b>正</b></span><small v-else>初</small>
            <small v-if="tick.clockLabel" class="clock-tick">{{ tick.clockLabel }}</small>
          </span>
          <i v-for="event in events" :key="event.key" class="horizon-mark" :style="{left:event.position}"></i>
          <span v-for="event in events" :key="event.key+'-caption'" class="horizon-caption" :class="event.key"
            :style="{left:'clamp(36px,'+event.position+',calc(100% - 36px))'}">{{ event.label }} {{ event.time }}</span>
        </div>
        <i class="day-bead" :style="{left:timelinePercent(minute)}" aria-hidden="true"></i>
      </div>
    </div>
    <div class="axis-controls">
      <div class="time-buttons">
        <button type="button" class="play" :aria-pressed="playing" @click="emit('toggle-play')">{{ playing?'暂停':'播放一天' }}</button>
        <button type="button" aria-label="后退十五分钟" @click="emit('step',-15)">−15 分</button>
        <button type="button" aria-label="前进十五分钟" @click="emit('step',15)">+15 分</button>
        <button type="button" @click="emit('noon')">当地午正</button>
      </div>
      <div class="axis-info">
        <dl v-if="events.length" class="horizon-readout"><div v-for="event in events" :key="event.key"><dt>{{ event.label }}</dt><dd>{{ event.time }}</dd></div></dl>
        <span v-else-if="daylight?.state==='polar-day'">全天日照</span>
        <span v-else-if="daylight?.state==='polar-night'">全天无直射日光</span>
        <div class="speed"><span>{{ speed===.5?'速度 0.5×':'速度' }}</span>
          <RulerSegments label="播放速度" :model-value="speed" :options="speedOptions" @update:model-value="emit('update:speed',$event)"/>
        </div>
      </div>
    </div>
    <ul v-if="comparisonBands.length" class="comparison-key" aria-label="昼长对照">
      <li v-for="band in comparisonBands" :key="band.id" :style="band.style"><i></i>{{ band.name }}<template v-if="!band.hasDaylight">无日照</template></li>
    </ul>
  </div>
</template>

<style scoped>
.time-axis {font:14px/1.45 var(--ruler-font);color:var(--dial-ink);font-variant-numeric:tabular-nums;}
.ruler-heading,.ruler-reading,.axis-controls,.axis-info,.time-buttons,.speed,.horizon-readout,.horizon-readout div,.comparison-key {display:flex;align-items:center;}
.ruler-heading {justify-content:space-between;gap:12px;padding:10px var(--ruler-pad) 8px;border-bottom:1px solid var(--ruler-rule);}
.ruler-heading h3,.ruler-reading output {font:normal 20px/1.25 var(--ruler-font);margin:0;color:var(--dial-ink);font-variant-numeric:tabular-nums;}
.ruler-heading h3 {letter-spacing:.13em;}
.ruler-reading {gap:9px;}
.ruler-reading > span,.axis-info,.comparison-key {font-size:12px;color:var(--dial-lightInk);}
.ruler-reading b {font-weight:400;color:var(--dial-lightInk);}
.ruler-reading em {color:var(--dial-cinnabar);font-style:normal;}
.day-field {position:relative;min-width:0;height:89px;touch-action:pan-y;cursor:ew-resize;user-select:none;}
.tick-key {display:none;}
.day-field:focus-within:has(:focus-visible) {outline:2px solid var(--dial-cinnabar);outline-offset:2px;}
.day-print {position:absolute;inset:0;overflow:hidden;pointer-events:none;}
.day-wash {position:absolute;inset:30px 0 auto;height:17px;background-color:var(--dial-nightWash);}
.day-wash.all-day,.fallback-daylight {background-color:var(--dial-daylightWash);}
.fallback-daylight {position:absolute;inset-block:0;}
.day-print::after {content:'';position:absolute;top:47px;inset-inline:0;border-top:1px solid var(--ruler-mark);}
.hour-tick {position:absolute;top:48px;width:0;color:var(--dial-ink);font:12px/1 var(--ruler-font);white-space:nowrap;}
.hour-tick i {position:absolute;left:0;bottom:0;height:8px;border-left:1px solid var(--dial-ink);}
.hour-tick > span,.hour-tick small {position:absolute;top:7px;left:0;transform:translateX(-50%);}
.hour-tick.at-start > :not(i) {transform:none;}
.hour-tick.at-end > :not(i) {transform:translateX(-100%);}
.hour-tick b {font-weight:inherit;}
.hour-tick.initial i {height:16px;border-color:var(--ruler-mark);}
.hour-tick.noon {color:var(--dial-cinnabar);}
.hour-tick.noon i {border-color:var(--dial-ink);}
.hour-tick small {font:inherit;color:var(--dial-lightInk);}
.hour-tick .clock-tick {top:23px;font-variant-numeric:tabular-nums;}
.horizon-caption {position:absolute;top:5px;transform:translateX(-50%);font:12px/1.15 var(--ruler-font);font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--dial-cinnabar);}
.crowded .horizon-caption.sunset {top:17px;}
.horizon-mark {position:absolute;top:22px;height:8px;border-left:2px solid var(--dial-cinnabar);}
.day-bead {position:absolute;z-index:1;top:31.5px;width:14px;height:14px;border:1px solid var(--dial-bronzeDark);
  border-radius:50%;transform:translateX(-50%);background:radial-gradient(ellipse at 39% 35%,var(--dial-gold),var(--dial-bronze) 83%);pointer-events:none;}
.day-field:hover .day-bead,.day-field:focus-within:has(:focus-visible) .day-bead {border-width:2px;}
.comparison-rail {position:absolute;inset-inline:0;height:2px;}
.comparison-rail.xiazhi {top:30px;} .comparison-rail.dongzhi {top:44px;}
.comparison-rail i {position:absolute;inset:0 calc(100% - var(--comparison-end)) 0 var(--comparison-start);background:var(--comparison-color);}
.axis-controls {padding:9px var(--ruler-pad);border-top:1px solid var(--ruler-rule);justify-content:space-between;gap:8px 12px;flex-wrap:wrap;}
.time-buttons,.axis-info {gap:6px;flex-wrap:wrap;}
.time-buttons button {min-height:34px;padding:4px 10px;border:1px solid var(--dial-lightInk);background:transparent;color:var(--dial-ink);border-radius:2px;font:14px/1.2 var(--ruler-font);}
.time-buttons button:hover {border-color:var(--dial-cinnabar);color:var(--dial-cinnabar);}
.time-buttons button:focus-visible {outline:2px solid var(--dial-cinnabar);outline-offset:2px;}
.time-buttons .play {border-color:var(--dial-cinnabar);background:var(--dial-cinnabar);color:var(--dial-onCinnabar);min-width:78px;}
.time-buttons .play:hover {background:var(--dial-bronzeDark);border-color:var(--dial-bronzeDark);color:var(--dial-onCinnabar);}
.axis-info {margin-inline-start:auto;gap:14px;justify-content:flex-end;}
.horizon-readout {gap:10px;margin:0;white-space:nowrap;}
.horizon-readout div {gap:4px;} .horizon-readout dt,.horizon-readout dd {font:inherit;margin:0;} .horizon-readout dd {color:var(--dial-ink);}
.speed {gap:3px;white-space:nowrap;}
.comparison-key {gap:14px;padding:0 var(--ruler-pad) 8px;margin:0;list-style:none;}
.comparison-key i {display:inline-block;vertical-align:middle;width:14px;border-top:2px solid var(--comparison-color);margin-inline-end:4px;}
@container (max-width:650px){
  .hour-tick.initial small,.hour-tick:not(.noon) b {display:none;}
  .day-label {align-content:center;gap:4px;}
  .tick-key {display:grid;gap:2px;color:var(--dial-lightInk);font:12px/1 var(--ruler-font);}
  .tick-key span {display:flex;align-items:end;gap:3px;}
  .tick-key span::before {content:'';width:1px;height:10px;background:var(--ruler-mark);}
  .tick-key span:last-child::before {height:5px;}
}
@media(max-width:640px){
 .time-buttons button {min-height:44px;padding-inline:8px;font-size:12px;}
 .time-buttons .play {min-width:66px;}
 .axis-controls {row-gap:2px;}
 .axis-info {width:100%;justify-content:space-between;gap:4px;}
 .horizon-readout {gap:9px;}
 .time-buttons {gap:5px;}
}
@media(forced-colors:active){.day-bead{background:ButtonText;border-color:ButtonText;}.time-buttons .play{border:2px solid ButtonText;}}
</style>
