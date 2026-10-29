<script setup>
import { computed, onBeforeUnmount, onDeactivated, ref } from 'vue';
import { year } from '../state/year.js';
import { normalize, shortestDelta } from '../core/angle.js';
import { TUNING } from '../core/tuning.js';
const props=defineProps({term:Object,terms:{type:Array,default:()=>[]}});
const emit=defineEmits(['select-term','open-panel']);
const CENTER=340,STEP=15;
const svgElement=ref(null),hoveredId=ref(null);
const rotation=computed(()=>-year.state.yearAngle);
const dragging=computed(()=>year.state.dragSource==='dial'&&year.state.phase==='drag');
const orderedTerms=computed(()=>props.terms);
const selectedIndex=computed(()=>year.term.value.index);
const activeIndex=selectedIndex;
const displayedTerm=year.term;
const displayedSeason=computed(()=>`${displayedTerm.value.season}季`);
const displayedLongitude=computed(()=>year.longitude.value.toFixed(1));
const hoveredTerm=computed(()=>props.terms.find(item=>item.id===hoveredId.value));
const seasons=[{name:'春',start:-7.5,end:82.5,middle:37.5},{name:'夏',start:82.5,end:172.5,middle:127.5},{name:'秋',start:172.5,end:262.5,middle:217.5},{name:'冬',start:262.5,end:352.5,middle:307.5}];
function point(radius,angle){const r=angle*Math.PI/180;return{x:CENTER+radius*Math.sin(r),y:CENTER-radius*Math.cos(r)};}
function ringPath(inner,outer,start,end){const a=point(outer,start),b=point(outer,end),c=point(inner,end),d=point(inner,start),large=end-start>180?1:0;return `M${a.x} ${a.y} A${outer} ${outer} 0 ${large} 1 ${b.x} ${b.y} L${c.x} ${c.y} A${inner} ${inner} 0 ${large} 0 ${d.x} ${d.y} Z`;}
const sectors=computed(()=>props.terms.map((term,index)=>({term,index,path:ringPath(249,301,index*15-7.1,index*15+7.1),label:point(275,index*15)})));
const houTicks=Array.from({length:72},(_,index)=>({index,from:point(index%3===0?222:231,index*5-7.5),to:point(242,index*5-7.5)}));
const longitudeTicks=computed(()=>props.terms.map((term,index)=>({id:term.id,longitude:term.longitude,major:term.longitude%90===0,from:point(term.longitude%90===0?152:163,index*15),to:point(173,index*15),label:point(137,index*15)})));
function upright(position){return `rotate(${-rotation.value} ${position.x} ${position.y})`;}
let gesture=null,wheelSum=0,lastWheel=0;
function selectTerm(item,open=true){if(!item)return;year.selectTerm(item.id);if(open){year.setPanel(true);emit('open-panel');}}
function stepTerm(direction){year.step(direction);}
function localPointer(event){if(!gesture)return null;const x=(event.clientX-gesture.cx)*gesture.scale,y=(event.clientY-gesture.cy)*gesture.scale;return{x,y,radius:Math.hypot(x,y),angle:Math.atan2(x,-y)*180/Math.PI};}
function pointerDown(event){
 if(gesture||(event.pointerType==='mouse'&&event.button!==0))return;
 const object=svgElement.value.parentElement; for(const animation of object.getAnimations()){if(animation.transitionProperty==='transform'){animation.commitStyles();animation.cancel();}}
 const rect=svgElement.value.getBoundingClientRect();
 gesture={pointerId:event.pointerId,cx:rect.left+rect.width/2,cy:rect.top+rect.height/2,scale:680/rect.width,startX:event.clientX,startY:event.clientY,startAngle:year.state.yearAngle,delta:0,moved:false,samples:[],last:performance.now()};
 const p=localPointer(event);if(p.radius<122||p.radius>324){gesture=null;object.style.removeProperty('transform');return;}
 gesture.previousAngle=p.angle;gesture.samples.push({time:performance.now(),angle:year.state.yearAngle});
 year.beginDrag('dial');svgElement.value.setPointerCapture(event.pointerId);svgElement.value.focus({preventScroll:true});hoveredId.value=null;event.preventDefault();
}
function pointerMove(event){
 if(!gesture||gesture.pointerId!==event.pointerId)return;const p=localPointer(event);if(p.radius<35)return;
 gesture.delta+=shortestDelta(gesture.previousAngle,p.angle);gesture.previousAngle=p.angle;
 if(!gesture.moved&&Math.hypot(event.clientX-gesture.startX,event.clientY-gesture.startY)>4)gesture.moved=true;
 if(gesture.moved){const angle=gesture.startAngle-gesture.delta;year.dragTo(angle);const now=performance.now();gesture.samples.push({time:now,angle});gesture.samples=gesture.samples.filter(s=>now-s.time<=100);gesture.last=now;}
}
function pointerUp(event){
 if(!gesture||gesture.pointerId!==event.pointerId)return;
 const p=localPointer(event),g=gesture;gesture=null;svgElement.value.parentElement.style.removeProperty('transform');
 if(svgElement.value.hasPointerCapture(g.pointerId))svgElement.value.releasePointerCapture(g.pointerId);
 if(!g.moved){const index=p?Math.round(normalize(p.angle+year.state.yearAngle)/15)%24:selectedIndex.value;selectTerm(props.terms[index]);return;}
 let weighted=0,total=0;
 if(performance.now()-g.last<85){for(let i=1;i<g.samples.length;i++){const a=g.samples[i-1],b=g.samples[i],dt=(b.time-a.time)/1000;if(dt>.001){weighted+=(b.angle-a.angle)/dt*i;total+=i;}}}
 year.release(total?weighted/total:0);
}
function cancelGesture(event){if(!gesture||(event&&event.pointerId!==gesture.pointerId))return;const id=gesture.pointerId;gesture=null;svgElement.value?.parentElement.style.removeProperty('transform');if(svgElement.value?.hasPointerCapture(id))svgElement.value.releasePointerCapture(id);year.release(0);}
function sectorClick(event,item){if(event.detail===0&&!gesture)selectTerm(item);}
function wheel(event){const now=performance.now();if(now-lastWheel>180)wheelSum=0;lastWheel=now;wheelSum+=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?500:1);if(Math.abs(wheelSum)>=TUNING.wheelThreshold){const steps=Math.max(-3,Math.min(3,Math.trunc(wheelSum/TUNING.wheelThreshold)));year.step(steps);wheelSum=0;}}
function key(event){if(['ArrowLeft','ArrowRight','Home','Enter','Escape'].includes(event.key)){event.preventDefault();event.stopPropagation();if(event.key==='ArrowLeft')year.step(-1);if(event.key==='ArrowRight')year.step(1);if(event.key==='Home')year.selectTerm('lichun');if(event.key==='Enter'){year.setPanel(true);emit('open-panel');}if(event.key==='Escape'){year.setPanel(false);year.clearFocus();}}}
onDeactivated(()=>cancelGesture());onBeforeUnmount(()=>cancelGesture());
</script>

<template>
  <div class="season-wheel" :class="{ 'is-dragging': dragging }">
    <svg
      ref="svgElement"
      class="wheel-svg"
      viewBox="0 0 680 680"
      role="group" tabindex="0" @keydown="key" @wheel.prevent="wheel"
      aria-label="二十四节气授时转盘，可拖动旋转或使用下方前后按钮选择节气"
      @pointerdown="pointerDown"
      @pointermove="pointerMove"
      @pointerup="pointerUp"
      @pointercancel="cancelGesture"
      @lostpointercapture="cancelGesture"
    >
      <circle class="rim rim-outer" cx="340" cy="340" r="322" />
      <circle class="rim" cx="340" cy="340" r="315" />
      <circle class="rim rim-dashed" cx="340" cy="340" r="309" />

      <g class="rotating-layer" :transform="`rotate(${rotation} 340 340)`">
        <g
          v-for="sector in sectors"
          :key="sector.term.id"
          class="term-sector"
          :class="{ 'is-active': sector.index === activeIndex, 'is-related': year.state.relatedTermIds.includes(sector.term.id) }"
          role="button"
          tabindex="0"
          :aria-label="`${sector.term.name}，太阳黄经${sector.term.longitude}度`"
          :aria-pressed="sector.index === selectedIndex"
          @mouseenter="hoveredId = sector.term.id"
          @mouseleave="hoveredId = null"
          @focus="hoveredId = sector.term.id"
          @blur="hoveredId = null"
          @click="sectorClick($event, sector.term)"
          @keydown.enter.stop.prevent="selectTerm(sector.term)"
          @keydown.space.stop.prevent="selectTerm(sector.term)"
        >
          <title>{{ sector.term.name }} · 太阳黄经 {{ sector.term.longitude }}°</title>
          <path class="sector-hit" :d="sector.path" />
          <text
            class="term-label upright"
            :x="sector.label.x"
            :y="sector.label.y"
            :transform="upright(sector.label)"
          >{{ sector.term.name }}</text>
        </g>

        <circle class="rim" cx="340" cy="340" r="246" />
        <line
          v-for="tick in houTicks"
          :key="`hou-${tick.index}`"
          class="hou-tick"
          :class="{ 'hou-tick-major': tick.index % 3 === 0 }"
          :x1="tick.from.x"
          :y1="tick.from.y"
          :x2="tick.to.x"
          :y2="tick.to.y"
        />

        <g v-for="(season, index) in seasons" :key="season.name" class="season-band">
          <path :class="`season-tone-${index}`" :d="ringPath(200, 210, season.start + 1.5, season.end - 1.5)" />
          <text
            class="season-label upright"
            :x="point(184, season.middle).x"
            :y="point(184, season.middle).y"
            :transform="upright(point(184, season.middle))"
          >{{ season.name }}</text>
        </g>

        <circle class="rim" cx="340" cy="340" r="174" />
        <g v-for="tick in longitudeTicks" :key="tick.id">
          <line class="longitude-tick" :class="{ 'is-major': tick.major }" :x1="tick.from.x" :y1="tick.from.y" :x2="tick.to.x" :y2="tick.to.y" />
          <text
            v-if="tick.major"
            class="longitude-label upright"
            :x="tick.label.x"
            :y="tick.label.y"
            :transform="upright(tick.label)"
          >{{ tick.longitude }}°</text>
        </g>
      </g>

      <circle class="center-disc" cx="340" cy="340" r="114" />
      <circle class="center-hairline" cx="340" cy="340" r="105" />
      <path class="center-ornament" d="M 306 284 H 326 M 354 284 H 374 M 306 402 H 326 M 354 402 H 374" />
      <text class="center-eyebrow" x="340" y="285">{{ displayedSeason }} · 授时</text>
      <text class="center-term settle-label" :key="`label-${year.state.settled}`" x="340" y="343" aria-live="polite">{{ displayedTerm?.name || '授时图' }}</text>
      <text class="center-longitude" x="340" y="381">太阳黄经 {{ displayedLongitude }}°</text>
      <text class="center-caption" x="340" y="405">{{ year.hou.value?.name || '二十四节气 · 七十二候' }}</text>

      <g class="selection-pointer" :key="`pointer-${year.state.settled}`" aria-hidden="true">
        <path d="M 334 18 H 346 V 32 L 340 42 L 334 32 Z" />
        <line x1="340" y1="46" x2="340" y2="55" />
      </g>
      <g class="cardinal-marks" aria-hidden="true">
        <path d="M 10 340 H 21 M 659 340 H 670 M 340 659 V 670" />
        <circle cx="340" cy="340" r="3" />
      </g>
    </svg>

    <Transition name="tooltip">
      <div v-if="hoveredTerm && !year.moving.value" class="wheel-tooltip" role="tooltip">
        <span>{{ hoveredTerm.name }}</span>
        <span class="tooltip-divider">/</span>
        <span>太阳黄经 {{ hoveredTerm.longitude }}°</span>
      </div>
    </Transition>

    <div class="wheel-controls">
      <button type="button" class="step-button" aria-label="选择上一个节气" @click="stepTerm(-1)"><span aria-hidden="true">←</span></button>
      <div class="wheel-instruction"><span>拖动转盘 · 循一年天时</span><small>滚轮 / 方向键切换 · Enter 展开</small></div>
      <button type="button" class="step-button" aria-label="选择下一个节气" @click="stepTerm(1)"><span aria-hidden="true">→</span></button>
    </div>
  </div>
</template>

<style scoped>
.season-wheel { --paper: #f5f1e8; --ink: #253d38; --muted: #798079; --accent: #ae5544; --line: #d9d6ca; position: relative; width: 100%; max-width: 680px; margin-inline: auto; color: var(--ink); }
.wheel-svg { display: block; width: 100%; height: auto; aspect-ratio: 1; overflow: visible; touch-action: none; user-select: none; -webkit-user-select: none; cursor: grab; }
.is-dragging .wheel-svg { cursor: grabbing; }
.rim { fill: none; stroke: var(--line); stroke-width: .9; pointer-events: none; }
.rim-outer { stroke: #c0c5b6; stroke-width: 1.15; }
.rim-dashed { stroke-dasharray: 1 5; opacity: .8; }
.rotating-layer, .upright { transition: none; }
.is-dragging .rotating-layer, .is-dragging .upright { transition: none; }
.term-sector { outline: none; cursor: pointer; }
.sector-hit { fill: #eeeee3; fill-opacity: .52; stroke: transparent; stroke-width: 1.4; transition: fill 160ms, stroke 160ms; }
.term-sector:nth-child(2n) .sector-hit { fill: #e4e9df; fill-opacity: .4; }
.term-sector:hover .sector-hit, .term-sector:focus-visible .sector-hit { fill: #e5e9dc; fill-opacity: 1; stroke: #b2bbab; }
.term-sector.is-active .sector-hit { fill: var(--accent); fill-opacity: 1; stroke: var(--accent); }
.term-sector:focus-visible .sector-hit { stroke: var(--ink); stroke-width: 2; }
.term-label { fill: var(--ink); font: 18px 'Noto Serif SC', 'Songti SC', 'STSong', 'SimSun', serif; letter-spacing: 2px; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
.term-sector.is-active .term-label { fill: #fff9ee; font-weight: 600; }
.hou-tick { stroke: #b9beb0; stroke-width: 1; pointer-events: none; }
.hou-tick-major { stroke: #8f9d8e; stroke-width: 1.25; }
.season-band { pointer-events: none; }
.season-tone-0 { fill: #b4c4aa; opacity: .62; }
.season-tone-1 { fill: #bdc7a2; opacity: .55; }
.season-tone-2 { fill: #cdbba0; opacity: .62; }
.season-tone-3 { fill: #adc0bb; opacity: .62; }
.season-label { fill: #6c7c69; font: 16px 'Noto Serif SC', 'Songti SC', 'SimSun', serif; text-anchor: middle; dominant-baseline: central; }
.longitude-tick { stroke: #acb5a7; stroke-width: 1; pointer-events: none; }
.longitude-tick.is-major { stroke: #829282; stroke-width: 1.5; }
.longitude-label { fill: var(--muted); font: 10px 'Georgia', serif; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
.center-disc { fill: var(--paper); stroke: #bcc4b4; stroke-width: 1; pointer-events: none; }
.center-hairline { fill: none; stroke: var(--line); stroke-width: .7; pointer-events: none; }
.center-ornament { fill: none; stroke: #c2c6b9; stroke-width: .7; pointer-events: none; }
.center-eyebrow { fill: #7d8978; font: 10px 'Noto Serif SC', 'Songti SC', serif; letter-spacing: 3px; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
.center-term { fill: var(--ink); font: 49px 'Noto Serif SC', 'Songti SC', 'STSong', 'SimSun', serif; letter-spacing: 8px; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
.center-longitude { fill: #8d6655; font: 11px 'Noto Serif SC', 'Songti SC', serif; letter-spacing: 1.3px; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
.center-caption { fill: var(--muted); font: 9px 'Noto Serif SC', 'Songti SC', serif; letter-spacing: 1.1px; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
.selection-pointer { fill: var(--accent); pointer-events: none; }
.selection-pointer line { stroke: var(--accent); stroke-width: 1.2; }
.cardinal-marks { fill: var(--accent); stroke: #bdc5b6; stroke-width: 1; pointer-events: none; }
.wheel-controls { display: flex; align-items: center; justify-content: center; gap: 25px; margin-top: -1px; }
.step-button { display: grid; place-items: center; flex: 0 0 35px; width: 35px; height: 35px; padding: 0; border: 1px solid #c8cdbf; border-radius: 50%; color: #667961; background: transparent; font: 18px Georgia, serif; cursor: pointer; transition: color 150ms, border-color 150ms, background 150ms; }
.step-button:hover { color: var(--accent); border-color: var(--accent); background: #ede9de; }
.step-button:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
.wheel-instruction { display: grid; gap: 5px; text-align: center; color: #68795e; font-family: 'Noto Serif SC', 'Songti SC', 'SimSun', serif; font-size: 12px; letter-spacing: 2px; }
.wheel-instruction small { color: #929789; font-size: 9px; letter-spacing: 1px; }
.wheel-tooltip { position: absolute; left: 50%; bottom: 94px; display: flex; align-items: center; gap: 9px; width: max-content; max-width: 90%; padding: 8px 13px; border: 1px solid #d5d6c7; border-radius: 2px; color: var(--ink); background: #f8f5ed; box-shadow: 0 4px 16px #253d380a; transform: translateX(-50%); font-size: 11px; letter-spacing: .6px; pointer-events: none; }
.tooltip-divider { color: #c1c6b6; }
.tooltip-enter-active, .tooltip-leave-active { transition: opacity 120ms; }
.tooltip-enter-from, .tooltip-leave-to { opacity: 0; }
@media (max-width: 640px) { .wheel-controls { gap: 18px; } .wheel-instruction { font-size: 11px; letter-spacing: 1.2px; } .wheel-tooltip { bottom: 80px; font-size: 10px; } }
@media (prefers-reduced-motion: reduce) { .rotating-layer, .upright, .sector-hit, .step-button, .tooltip-enter-active, .tooltip-leave-active { transition: none; } }
.term-sector.is-related .sector-hit{stroke:#ae5544;stroke-width:3;fill-opacity:.6}.settle-label{transform-box:fill-box;transform-origin:center;animation:label-settle .3s ease-out}.selection-pointer{transform-origin:340px 25px;animation:pointer-settle .3s ease-out}@keyframes label-settle{50%{transform:scale(1.06)}}@keyframes pointer-settle{25%{transform:rotate(-3deg)}65%{transform:rotate(2deg)}}
</style>
