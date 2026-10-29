<script setup>
import { computed, ref } from 'vue';
import { TERMS } from '../data/terms.js';
import { year } from '../state/year.js';
import { normalize, snapAngle } from '../core/angle.js';
import { solarModel, formatShadow, DEMO_MODEL } from '../lib/astronomy.js';
const props=defineProps({compact:Boolean});
const track=ref(null), dragging=ref(false), dragPosition=ref(null);
let gesture=null;
const x=angle => 32+angle/360*1136;
const axisY=props.compact?66:93;
const y=length => (props.compact?57:83)-length/16*(props.compact?42:62);
const samples=Array.from({length:361},(_,angle)=>({angle,shadow:solarModel(angle+315).shadowChi}));
const path=samples.map((p,i)=>`${i?'L':'M'}${x(p.angle)},${y(p.shadow)}`).join(' ');
const area=`${path} L1168,${axisY-1} L32,${axisY-1} Z`;
const position=computed(()=>dragPosition.value??year.normalized.value);
const model=computed(()=>solarModel(year.longitude.value));
const handle=computed(()=>({x:x(position.value),y:y(model.value.shadowChi)}));
const labels=[{angle:135,name:'夏至 · 最短',side:'start'},{angle:315,name:'冬至 · 最长',side:'end'}].map(item=>({...item,x:x(item.angle),y:y(solarModel(item.angle+315).shadowChi),text:formatShadow(solarModel(item.angle+315).shadowChi)}));
const ariaText=computed(()=>`${year.term.value.name}，太阳黄经${year.longitude.value.toFixed(1)}度，八尺竖表正午影长${formatShadow(model.value.shadowChi)}`);
function read(event) { return Math.max(0,Math.min(359.999,(event.clientX-gesture.rect.left)/gesture.rect.width*1200/1136*360-32/1136*360)); }
function down(event) {
  if(event.button!==0||gesture) return;
  // 每个手势只读一次布局，动画帧不读取。
  const rect=track.value.getBoundingClientRect();
  gesture={pointer:event.pointerId,rect,startX:event.clientX,startY:event.clientY,cycle:year.state.yearAngle-normalize(year.state.yearAngle),moved:false};
  track.value.setPointerCapture(event.pointerId); event.preventDefault();
}
function move(event) {
  if(!gesture||gesture.pointer!==event.pointerId) return;
  if(!gesture.moved && Math.hypot(event.clientX-gesture.startX,event.clientY-gesture.startY)>3) { gesture.moved=true; dragging.value=true; year.beginDrag('slider'); }
  if(gesture.moved) { dragPosition.value=read(event); year.dragTo(gesture.cycle+dragPosition.value); }
}
function up(event) {
  if(!gesture||gesture.pointer!==event.pointerId) return;
  const value=read(event), moved=gesture.moved, pointer=gesture.pointer;
  gesture=null; dragging.value=false; dragPosition.value=null;
  if(track.value.hasPointerCapture(pointer)) track.value.releasePointerCapture(pointer);
  if(moved) year.release(0); else year.goToAngle(snapAngle(value));
}
function cancel(event) {
  if(!gesture||gesture.pointer!==event.pointerId) return;
  gesture=null; dragging.value=false; dragPosition.value=null; year.release(0);
}
function key(event) {
  const directions={ArrowLeft:-5,ArrowDown:-5,ArrowRight:5,ArrowUp:5,PageDown:-15,PageUp:15};
  if(event.key in directions) { event.preventDefault(); year.goToAngle(year.state.yearAngle+directions[event.key]); }
  else if(event.key==='Home'||event.key==='End') { event.preventDefault(); year.goToAngle(event.key==='Home'?0:345); }
}
</script>

<template>
  <section class="year-slider" :class="{'is-dragging':dragging}" aria-label="全年节气与日影联动">
    <div class="year-slider-heading"><div><span class="eyebrow">拨动一年</span><span class="year-slider-tip">拖动节气轴，保持同一时刻看日影</span></div><div class="year-live-reading"><strong>{{ year.term.value.name }}</strong><span>{{ year.longitude.value.toFixed(1) }}°</span><small>正午参考影长 {{ formatShadow(model.shadowChi) }}</small></div></div>
    <svg ref="track" class="year-track" :viewBox="`0 0 1200 ${compact?108:140}`" role="slider" tabindex="0" aria-label="节气滚动条" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="360" :aria-valuenow="Number(position.toFixed(2))" :aria-valuetext="ariaText" @keydown="key" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="cancel" @lostpointercapture="cancel">
      <path :d="area" fill="#708f6d" opacity=".10"/><path :d="path" fill="none" stroke="#6a8b73" stroke-width="1.6"/>
      <g v-for="label in labels" :key="label.angle" class="year-extreme"><circle :cx="label.x" :cy="label.y" r="3" fill="#6a8b73"/><text :x="label.x+(label.side==='start'?10:-10)" :y="label.y-9" :text-anchor="label.side">{{ label.name }} {{ label.text }}</text></g>
      <line x1="32" x2="1168" :y1="axisY" :y2="axisY" stroke="#9fae99" stroke-width=".7"/>
      <line v-for="i in 73" :key="i" :x1="x((i-1)*5)" :x2="x((i-1)*5)" :y1="axisY" :y2="axisY+((i-1)%3===0?9:4)" stroke="#9fae99" :stroke-width="(i-1)%3===0?1:.6"/>
      <g v-for="item in TERMS" :key="item.id" :class="{'year-active':year.term.value.id===item.id}"><text :x="x(item.index*15)" :y="axisY+29" text-anchor="middle" class="year-term-label">{{ item.name }}</text><circle v-if="year.state.relatedTermIds.includes(item.id)" :cx="x(item.index*15)" :cy="axisY+41" r="2.5" fill="#ae5544"/></g>
      <g class="year-thumb" :transform="`translate(${handle.x} ${handle.y})`"><line y1="0" :y2="axisY-handle.y" stroke="#ae5544" stroke-width="1" stroke-dasharray="2 3"/><circle r="10" fill="#ae5544" opacity=".12"/><circle r="5" fill="#ae5544" stroke="#fff9ed" stroke-width="2"/></g>
    </svg>
    <div class="year-slider-foot"><span>立春开篇 · 每小刻度为一候</span><span>曲线为八尺竖表正午影长 · {{ DEMO_MODEL.latitude }}°N演示 · 与日晷影端单位不同</span><span>方向键 ±5° · PageUp / Down ±1节气</span></div>
  </section>
</template>

<style scoped>
.year-slider{padding:17px 20px 12px;background:rgba(250,248,239,.87);border:1px solid #c5cbb980;border-radius:3px;position:relative}.year-slider-heading{display:flex;align-items:center;justify-content:space-between;gap:20px}.year-slider-heading>div{display:flex;align-items:center;gap:16px}.year-slider-heading .eyebrow{margin:0;color:#526c58}.year-slider-tip{font-size:10px;color:#727d70}.year-live-reading{font-variant-numeric:tabular-nums;white-space:nowrap}.year-live-reading strong{font-size:18px;font-weight:500;letter-spacing:.12em}.year-live-reading>span{font-size:11px;color:#8e604a}.year-live-reading small{font-size:10px;color:#75816e}.year-track{display:block;width:100%;overflow:visible;touch-action:none;cursor:ew-resize;user-select:none}.year-term-label{font-size:11px;fill:#667462;letter-spacing:1px}.year-active .year-term-label{fill:#a54d3b;font-weight:700}.year-extreme text{font-size:10px;fill:#7d876c}.year-slider-foot{display:flex;justify-content:space-between;gap:14px;color:#7c8475;font-size:9px}.is-dragging{cursor:grabbing}@media(max-width:900px){.year-slider-heading{align-items:flex-start}.year-slider-tip,.year-live-reading small,.year-slider-foot>span:last-child{display:none}.year-slider{padding-inline:10px}.year-slider-foot{font-size:8px}.year-track{min-height:90px}.year-live-reading{gap:8px!important}}
</style>
