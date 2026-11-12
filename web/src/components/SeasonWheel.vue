<script setup>
import { computed, nextTick, onBeforeUnmount, onDeactivated, ref, useId } from 'vue';
import { year } from '../state/year.js';
import { normalize, shortestDelta } from '../core/angle.js';
import { TUNING } from '../core/tuning.js';
import { WHEEL, polarPoint as point, annularPath as ringPath, termRingLayout, houRingLayout, radialLabelAngle, seasonRingLayout } from '../core/wheelGeometry.js';
import { solarModel, DEMO_MODEL } from '../lib/astronomy.js';
import { SEASON_PALETTE } from '../data/seasonPalette.js';
import WheelSundial from './WheelSundial.vue';
import UiIcon from './UiIcon.vue';

const props=defineProps({term:Object,terms:{type:Array,default:()=>[]}});
const emit=defineEmits(['select-term','open-panel','open-sky']);
const uid=`wheel-${useId().replace(/[^a-z0-9-]/gi,'')}`;
const svgElement=ref(null), hovered=ref(null);
const rotation=computed(()=>-year.state.yearAngle);
const dragging=computed(()=>year.state.dragSource==='dial'&&year.state.phase==='drag');
const selectedIndex=computed(()=>year.term.value.index);
const currentModel=computed(()=>solarModel(year.longitude.value));
const seasons=SEASON_PALETTE.map((item,index)=>({...item,...seasonRingLayout(index)}));
const sectors=computed(()=>props.terms.map((term,index)=>({term,index,...termRingLayout(index)})));
const houLabels=computed(()=>props.terms.flatMap(term=>term.hou.map(hou=>({
  ...hou,term,...houRingLayout(term.index,hou.order,hou.name),
}))));
const visibleHouLabels=computed(()=>houLabels.value.filter(hou=>hou.term.index===selectedIndex.value));
const houPointerRotation=computed(()=>{
  const focused=year.focusedHou.value;
  if(!focused)return 0;
  const label=houLabels.value.find(hou=>hou.id===focused.id);
  return label?shortestDelta(year.state.yearAngle,label.angle):0;
});
const tooltip=computed(()=>{
  if(!hovered.value)return null;
  if(hovered.value.kind==='hou'){
    const hou=houLabels.value.find(item=>item.id===hovered.value.id);
    return hou?`${hou.term.name} · ${['初候','二候','三候'][hou.order]} / ${hou.name}`:null;
  }
  const term=props.terms.find(item=>item.id===hovered.value.id);
  return term?`${term.name} / 太阳黄经${term.longitude}°`:null;
});
function upright(position){return `rotate(${-rotation.value} ${position.x} ${position.y})`;}
function radialTransform(hou){return `translate(${hou.position.x} ${hou.position.y}) rotate(${radialLabelAngle(hou.angle,rotation.value)})`;}
function chooseHou(hou){year.selectHou(hou.term.id,hou.order);}
async function houKey(event,hou){
  const offsets={ArrowLeft:-1,ArrowUp:-1,ArrowRight:1,ArrowDown:1};
  if(event.key in offsets){
    event.preventDefault();event.stopPropagation();
    const index=houLabels.value.findIndex(item=>item.id===hou.id),target=houLabels.value[(index+offsets[event.key]+houLabels.value.length)%houLabels.value.length];
    chooseHou(target);await nextTick();svgElement.value.querySelector(`[data-hou-id="${target.id}"]`)?.focus();
  }
}
function selectTerm(item,open=true){if(!item)return;year.selectTerm(item.id);if(open){year.setPanel(true);emit('open-panel');}}
function stepTerm(direction){year.step(direction);}
let gesture=null,wheelSum=0,lastWheel=0;
function localPointer(event){
  if(!gesture)return null;
  const x=(event.clientX-gesture.cx)*gesture.scale,y=(event.clientY-gesture.cy)*gesture.scale;
  return {x,y,radius:Math.hypot(x,y),angle:Math.atan2(x,-y)*180/Math.PI};
}
function pointerDown(event){
  if(gesture||(event.pointerType==='mouse'&&event.button!==0))return;
  if(event.target.closest('.wheel-center'))return;
  const object=svgElement.value.parentElement;
  for(const animation of object.getAnimations())if(animation.transitionProperty==='transform'){animation.commitStyles();animation.cancel();}
  // 一个手势只读取一次几何位置；后续拖动不读布局。
  const rect=svgElement.value.getBoundingClientRect();
  gesture={pointerId:event.pointerId,cx:rect.left+rect.width/2,cy:rect.top+rect.height/2,scale:WHEEL.size/rect.width,
    startX:event.clientX,startY:event.clientY,startAngle:year.state.yearAngle,delta:0,moved:false,samples:[],last:performance.now(),
    houId:event.target.closest('[data-hou-id]')?.dataset.houId,
    termId:event.target.closest('[data-term-id]')?.dataset.termId};
  const p=localPointer(event);
  if(p.radius<WHEEL.houInner||p.radius>405){gesture=null;object.style.removeProperty('transform');return;}
  gesture.radius=p.radius;gesture.previousAngle=p.angle;gesture.samples.push({time:performance.now(),angle:year.state.yearAngle});
  year.beginDrag('dial');svgElement.value.setPointerCapture(event.pointerId);
  svgElement.value.focus({preventScroll:true});hovered.value=null;event.preventDefault();
}
function pointerMove(event){
  if(!gesture||gesture.pointerId!==event.pointerId)return;
  const p=localPointer(event);if(p.radius<35)return;
  gesture.delta+=shortestDelta(gesture.previousAngle,p.angle);gesture.previousAngle=p.angle;
  if(!gesture.moved&&Math.hypot(event.clientX-gesture.startX,event.clientY-gesture.startY)>4)gesture.moved=true;
  if(gesture.moved){
    const angle=gesture.startAngle-gesture.delta;year.dragTo(angle);const now=performance.now();
    gesture.samples.push({time:now,angle});gesture.samples=gesture.samples.filter(sample=>now-sample.time<=100);gesture.last=now;
  }
}
function pointerUp(event){
  if(!gesture||gesture.pointerId!==event.pointerId)return;
  const p=localPointer(event),g=gesture;gesture=null;svgElement.value.parentElement.style.removeProperty('transform');
  if(svgElement.value.hasPointerCapture(g.pointerId))svgElement.value.releasePointerCapture(g.pointerId);
  if(!g.moved){
    if(g.houId){chooseHou(houLabels.value.find(item=>item.id===g.houId));return;}
    const index=p?Math.round(normalize(p.angle+year.state.yearAngle)/15)%24:selectedIndex.value;
    selectTerm(g.termId?props.terms.find(item=>item.id===g.termId):props.terms[index]);return;
  }
  let weighted=0,total=0;
  if(performance.now()-g.last<85)for(let i=1;i<g.samples.length;i++){
    const a=g.samples[i-1],b=g.samples[i],dt=(b.time-a.time)/1000;
    if(dt>.001){weighted+=(b.angle-a.angle)/dt*i;total+=i;}
  }
  year.release(total?weighted/total:0);
}
function cancelGesture(event){
  if(!gesture||(event&&event.pointerId!==gesture.pointerId))return;
  const id=gesture.pointerId;gesture=null;svgElement.value?.parentElement.style.removeProperty('transform');
  if(svgElement.value?.hasPointerCapture(id))svgElement.value.releasePointerCapture(id);year.release(0);
}
function wheel(event){
  const now=performance.now();if(now-lastWheel>180)wheelSum=0;lastWheel=now;
  wheelSum+=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?500:1);
  if(Math.abs(wheelSum)>=TUNING.wheelThreshold){year.step(Math.max(-3,Math.min(3,Math.trunc(wheelSum/TUNING.wheelThreshold))));wheelSum=0;}
}
function key(event){
  if(!['ArrowLeft','ArrowRight','Home','Enter','Escape'].includes(event.key))return;
  event.preventDefault();event.stopPropagation();
  if(event.key==='ArrowLeft')year.step(-1);if(event.key==='ArrowRight')year.step(1);if(event.key==='Home')year.selectTerm('lichun');
  if(event.key==='Enter'){year.setPanel(true);emit('open-panel');}
  if(event.key==='Escape'){year.setPanel(false);year.clearFocus();}
}
onDeactivated(()=>cancelGesture());onBeforeUnmount(()=>cancelGesture());
</script>

<template>
  <div class="season-wheel" :class="{'is-dragging':dragging}">
    <svg ref="svgElement" class="wheel-svg" :viewBox="`0 0 ${WHEEL.size} ${WHEEL.size}`" role="group" tabindex="0"
      aria-label="授时转盘：外圈二十四节气，中圈完整七十二候，圆心午正日晷；可拖动或用左右方向键选择节气"
      @keydown="key" @wheel.prevent="wheel" @pointerdown="pointerDown" @pointermove="pointerMove"
      @pointerup="pointerUp" @pointercancel="cancelGesture" @lostpointercapture="cancelGesture">
      <defs>
        <radialGradient :id="`${uid}-paper`"><stop stop-color="#fcf8ee"/><stop offset=".8" stop-color="#f7f2e6"/><stop offset="1" stop-color="#eee9d9"/></radialGradient>
        <pattern :id="`${uid}-fiber`" width="61" height="53" patternUnits="userSpaceOnUse"><path d="M6 8l10 2m25 7 8-1M12 36l13-2m20 13 9-2M30 10l-2 5" stroke="#776e52" stroke-width=".55" opacity=".14"/><circle cx="20" cy="19" r=".65" fill="#8f866c" opacity=".12"/><circle cx="49" cy="33" r=".5" fill="#9b9278" opacity=".12"/></pattern>
      </defs>
      <g v-once class="wheel-paper" aria-hidden="true">
        <circle :cx="WHEEL.center" :cy="WHEEL.center" :r="WHEEL.rim" :fill="`url(#${uid}-paper)`"/>
        <circle :cx="WHEEL.center" :cy="WHEEL.center" :r="WHEEL.rim-1" :fill="`url(#${uid}-fiber)`"/>
        <circle class="rim rim-outer" :cx="WHEEL.center" :cy="WHEEL.center" :r="WHEEL.rim"/>
        <circle class="rim rim-dashed" :cx="WHEEL.center" :cy="WHEEL.center" r="392"/>
      </g>

      <g class="rotating-layer" :transform="`rotate(${rotation} ${WHEEL.center} ${WHEEL.center})`">
        <g class="term-fields" aria-hidden="true">
          <path v-for="sector in sectors" :key="sector.term.id" class="sector-hit" :data-term-id="sector.term.id"
            :class="{'is-active':sector.index===selectedIndex,'is-related':year.state.relatedTermIds.includes(sector.term.id)}" :d="sector.path"
            @mouseenter="hovered={kind:'term',id:sector.term.id}" @mouseleave="hovered=null"/>
        </g>
        <g v-for="sector in sectors" :key="sector.term.id" class="term-sector" :data-term-id="sector.term.id"
          :class="{'is-active':sector.index===selectedIndex,'is-related':year.state.relatedTermIds.includes(sector.term.id)}"
          role="button" tabindex="0" :aria-label="`${sector.term.name}，太阳黄经${sector.term.longitude}度`" :aria-pressed="sector.index===selectedIndex"
          @mouseenter="hovered={kind:'term',id:sector.term.id}" @mouseleave="hovered=null" @focus="hovered={kind:'term',id:sector.term.id}" @blur="hovered=null"
          @click="$event.detail===0 && selectTerm(sector.term)" @keydown.enter.stop.prevent="selectTerm(sector.term)" @keydown.space.stop.prevent="selectTerm(sector.term)">
          <rect class="term-node-badge" :x="sector.label.x-27" :y="sector.label.y-15" width="54" height="30" rx="2" :transform="upright(sector.label)"/>
          <text class="term-label" :x="sector.label.x" :y="sector.label.y" :transform="upright(sector.label)">{{sector.term.name}}</text>
        </g>
        <g class="season-band" aria-label="春青绿、夏朱赭、秋金黄、冬青灰">
          <g v-for="season in seasons" :key="season.id">
            <path class="season-arc" :d="ringPath(WHEEL.seasonInner,WHEEL.seasonOuter,season.start+.35,season.end-.35)" :fill="season.color"/>
            <circle class="season-seal" :cx="point(339,season.middle).x" :cy="point(339,season.middle).y" r="11" :stroke="season.color"/>
            <text class="season-label" :x="point(339,season.middle).x" :y="point(339,season.middle).y" :transform="upright(point(339,season.middle))">{{season.name}}</text>
          </g>
        </g>
        <g class="hou-ring" aria-label="七十二候完整年轮，方向键依次选择候名">
          <g v-once class="hou-group-dividers" aria-hidden="true"><line v-for="sector in sectors" :key="sector.term.id" :x1="point(WHEEL.houInner+3,sector.start).x" :y1="point(WHEEL.houInner+3,sector.start).y" :x2="point(WHEEL.houOuter-1,sector.start).x" :y2="point(WHEEL.houOuter-1,sector.start).y"/></g>
          <g v-for="hou in houLabels" :key="hou.id" v-memo="[hou.term.index===selectedIndex,hou.id===year.hou.value?.id,radialLabelAngle(hou.angle,rotation)]" class="hou-entry" :data-hou-id="hou.id"
            :class="{'is-term':hou.term.index===selectedIndex,'is-current':hou.id===year.hou.value?.id}"
            :style="{'--hou-paper':SEASON_PALETTE[Math.floor(hou.term.index/6)].pale}"
            role="button" :tabindex="hou.id===year.hou.value?.id?0:-1" :aria-label="`${hou.term.name}·${['初候','二候','三候'][hou.order]}：${hou.name}，候名初稿`" :aria-pressed="hou.id===year.hou.value?.id"
            @mouseenter="hovered={kind:'hou',id:hou.id}" @mouseleave="hovered=null" @focus="hovered={kind:'hou',id:hou.id}" @blur="hovered=null"
            @click="$event.detail===0 && chooseHou(hou)" @keydown="houKey($event,hou)" @keydown.enter.stop.prevent="chooseHou(hou)" @keydown.space.stop.prevent="chooseHou(hou)">
            <title>{{hou.term.name}} · {{['初候','二候','三候'][hou.order]}} · {{hou.name}}（底本待校）</title>
            <path class="hou-hit" :d="hou.path"/>
            <circle v-if="hou.id===year.hou.value?.id" class="hou-dot" :cx="point(321,hou.angle).x" :cy="point(321,hou.angle).y" r="2.7"/>
            <g :transform="radialTransform(hou)">
              <rect class="hou-label-hit" :x="-hou.fontSize/2-2" :y="-hou.extent/2-2" :width="hou.fontSize+4" :height="hou.extent+4" rx="2"/>
              <text class="hou-name" :font-size="hou.fontSize"><tspan v-for="(letter,index) in hou.letters" :key="index" x="0" :y="letter.y">{{letter.letter}}</tspan></text>
            </g>
          </g>
        </g>
        <circle class="rim ring-divider" :cx="WHEEL.center" :cy="WHEEL.center" :r="WHEEL.houInner-3"/>
      </g>

      <g class="wheel-center" role="button" tabindex="0" :aria-label="`${year.term.value.name}午正日晷，太阳高度${currentModel.altitude.toFixed(1)}度；进入观天测影`"
        @click.stop="emit('open-sky')" @keydown.enter.stop.prevent="emit('open-sky')" @keydown.space.stop.prevent="emit('open-sky')">
        <circle class="center-disc" :cx="WHEEL.center" :cy="WHEEL.center" :r="WHEEL.centerRadius"/>
        <circle class="center-hairline" :cx="WHEEL.center" :cy="WHEEL.center" :r="WHEEL.centerRadius-6"/>
        <text class="center-eyebrow" x="410" y="257">{{year.term.value.season}}季 · 观象授时</text>
        <text class="center-term settle-label" :key="`label-${year.state.settled}`" x="410" y="301">{{year.term.value.name}}</text>
        <text class="center-longitude" x="410" y="335">太阳黄经 {{year.longitude.value.toFixed(1)}}°</text>
        <WheelSundial :longitude="year.longitude.value" />
        <text class="center-caption" x="410" y="553">午正 · 日高 {{currentModel.altitude.toFixed(1)}}°</text>
        <g class="center-link"><path d="M375 574h70"/><text x="410" y="583">观天测影 ↗</text></g>
      </g>
      <g class="selection-pointer" aria-hidden="true">
        <path d="M404 3 H416 V19 L410 30 L404 19 Z"/>
        <path class="pointer-read-line" d="M410 59 V63"/>
        <path class="pointer-read-line hou-pointer" d="M410 82 V86 M410 198 V211"
          :transform="`rotate(${houPointerRotation} ${WHEEL.center} ${WHEEL.center})`"/>
      </g>
    </svg>

    <Transition name="tooltip"><div v-if="tooltip&&!year.moving.value" class="wheel-tooltip" role="tooltip">{{tooltip}}</div></Transition>
    <div class="wheel-controls"><button class="step-button" aria-label="选择上一个节气" @click="stepTerm(-1)"><UiIcon name="arrow-left" /></button><div class="wheel-instruction"><span>拖动转盘 · 循一年天时</span><small>点候名读物候 · 点日晷观天影</small></div><button class="step-button" aria-label="选择下一个节气" @click="stepTerm(1)"><UiIcon name="arrow-right" /></button></div>
    <div class="hou-reader" role="group" :aria-label="`${year.term.value.name}三候放大阅读`">
      <p><span>{{year.term.value.name}} · 当令三候</span><small>放大阅读</small></p>
      <div><button v-for="hou in visibleHouLabels" :key="hou.id" :aria-pressed="hou.id===year.hou.value?.id" @click="chooseHou(hou)"><small>{{['初候','二候','三候'][hou.order]}}</small><span>{{hou.name}}</span></button></div>
    </div>
    <div class="wheel-data-key"><p><span class="key-dot"></span>全年七十二候 · 朱砂标记当前一候</p><p>水平式日晷 · 真太阳时 12:00 · {{DEMO_MODEL.latitude}}°N 演示</p><small>候名据团队初稿，底本待校 · 全年竖表影长见下方曲线</small></div>
  </div>
</template>

<style scoped>
.season-wheel { --paper:#f8f4e9; --ink:#2a4238; --muted:#626e59; --accent:#9e4935; --line:#c4c9b5; position:relative; width:100%; max-width:760px; margin-inline:auto; color:var(--ink); container-type:inline-size; }
.season-wheel:before { content:""; position:absolute; top:0; left:1.45%; width:97.1%; aspect-ratio:1; transform:translateY(1.45%); border-radius:50%; box-shadow:0 7px 18px #3a4c391c; pointer-events:none; }
.wheel-svg { position:relative; display:block; width:100%; height:auto; aspect-ratio:1; overflow:visible; touch-action:none; user-select:none; cursor:grab; }
.is-dragging .wheel-svg { cursor:grabbing; }
.wheel-svg:focus-visible { outline:2px solid var(--accent); outline-offset:3px; border-radius:50%; }
.wheel-paper,.rim,.season-band,.hou-group-dividers,.selection-pointer { pointer-events:none; }
.rim { fill:none; stroke:var(--line); stroke-width:1.3; }
.rim-outer { stroke:#97a48d; stroke-width:1.5; }
.rim-dashed { stroke-dasharray:1 5; stroke-width:1.1; opacity:.85; }
.ring-divider { stroke:#adbba0; stroke-width:1.15; }
.rotating-layer { transition:none; }
.term-sector,.hou-entry { outline:none; cursor:pointer; }
.sector-hit { cursor:pointer; fill:#e6e9db; fill-opacity:.65; stroke:#d5dbc8; stroke-width:.7; }
.term-fields .sector-hit:nth-child(2n) { fill:#ede7d8; }
.term-fields .sector-hit.is-active { fill:var(--accent); fill-opacity:1; stroke:var(--accent); stroke-width:1.2; }
.term-fields .sector-hit.is-related { stroke:var(--accent); stroke-width:3; }
.term-node-badge { fill:transparent; stroke:none; }
.term-sector:not(.is-active):hover .term-node-badge,.term-sector:focus-visible .term-node-badge { stroke:#526d4e; stroke-width:1.5; }
.term-sector.is-active:focus-visible .term-node-badge { stroke:#fff9e9; }
.term-label { fill:var(--ink); font:500 22px var(--font-display); letter-spacing:1.3px; text-anchor:middle; dominant-baseline:central; pointer-events:none; }
.term-sector.is-active .term-label { fill:#fff9e9; font-weight:700; }
.season-arc { opacity:.95; }
.season-seal { fill:#faf5e9; stroke-width:1.2; }
.season-label { fill:#34503b; font:700 15px var(--font-display); text-anchor:middle; dominant-baseline:central; }
.hou-group-dividers line { stroke:#a8b293; stroke-width:.8; opacity:.6; }
.hou-hit { fill:#dedfcd; fill-opacity:.12; stroke:none; }
.hou-entry:nth-child(6n+2) .hou-hit,.hou-entry:nth-child(6n+3) .hou-hit,.hou-entry:nth-child(6n+4) .hou-hit { fill-opacity:.26; }
.hou-name { fill:#59634f; font-family:var(--font-display); font-weight:500; text-anchor:middle; dominant-baseline:central; pointer-events:none; }
.hou-entry.is-term .hou-hit { fill:var(--hou-paper); fill-opacity:1; stroke:#9baa8b; stroke-width:.8; }
.hou-entry.is-term .hou-name { fill:#294d3b; font-weight:700; }
.hou-entry.is-current .hou-hit { fill:#f1dfbc; fill-opacity:.8; stroke:#b89360; stroke-width:1; }
.hou-entry.is-current .hou-name { fill:#913e2d; font-weight:800; }
.hou-label-hit { fill:transparent; stroke:none; }
.hou-entry:hover .hou-hit,.hou-entry:focus-visible .hou-hit { fill:#fff2d5; fill-opacity:1; stroke:var(--accent); stroke-width:1.8; }
.hou-dot { fill:var(--accent); stroke:#fcf6e7; stroke-width:1; pointer-events:none; }
.wheel-center { cursor:pointer; outline:none; touch-action:pan-y; }
.center-disc { fill:#faf6eb; stroke:#afbb9e; stroke-width:1.4; transition:fill .18s,stroke .18s; }
.center-hairline { fill:none; stroke:#d0d4c0; stroke-width:.8; }
.wheel-center:hover .center-disc { fill:#fff9ed; stroke:#9d835a; }
.wheel-center:focus-visible .center-disc { stroke:var(--accent); stroke-width:3; }
.wheel-center>text,.center-link text { text-anchor:middle; dominant-baseline:central; font-family:var(--font-display); pointer-events:none; }
.center-eyebrow { fill:var(--muted); font-size:15px; letter-spacing:2px; }
.center-term { fill:var(--ink); font-size:49px; letter-spacing:7px; }
.center-longitude { fill:#796044; font-size:15px; letter-spacing:1px; }
.center-caption { fill:#5b684f; font-size:16px; letter-spacing:1px; }
.center-link { pointer-events:none; }
.center-link path { stroke:#c8b793; stroke-width:.8; transform:translateY(-6px); }
.center-link text { fill:var(--accent); font-size:15px; letter-spacing:1px; }
.selection-pointer { fill:var(--accent); transform-origin:410px 16px; }
.selection-pointer .pointer-read-line { fill:none; stroke:var(--accent); stroke-width:1.2; opacity:.65; }
.settle-label { transform-box:fill-box; transform-origin:center; animation:label-settle .3s ease-out; }
.wheel-controls { display:flex; align-items:center; justify-content:center; gap:20px; margin:20px 0 16px; }
.step-button { display:grid; place-items:center; width:44px; height:44px; flex:none; border:1px solid #9aa98f; border-radius:50%; color:var(--ink); background:#fcfaf3; transition:background .15s,border-color .15s; }
.step-button:hover { background:#efece0; color:var(--accent); border-color:var(--accent); }
.wheel-instruction { display:grid; gap:4px; text-align:center; color:#3d5a43; font-size:13px; letter-spacing:1px; }
.wheel-instruction small { font-size:11px; color:var(--muted); letter-spacing:.5px; }
.wheel-data-key { padding:14px 0 0; border-top:1px solid #b6c3a380; color:#52634c; font-size:12px; text-align:center; line-height:1.9; }
.wheel-data-key p { display:flex; align-items:center; justify-content:center; gap:7px; flex-wrap:wrap; }
.wheel-data-key p+p { font-size:11px; }
.key-dot { width:5px; height:5px; border-radius:50%; background:var(--accent); }
.wheel-data-key>small { color:var(--muted); font-size:11px; }
.hou-reader { display:none; }
.wheel-tooltip { position:absolute; left:50%; bottom:180px; transform:translateX(-50%); max-width:94%; width:max-content; padding:9px 14px; background:#fffaf0f5; border:1px solid #b9c4a8; border-radius:5px; box-shadow:0 4px 16px #253d3812; color:#425e44; font-size:12px; pointer-events:none; z-index:3; }
.tooltip-enter-active,.tooltip-leave-active { transition:opacity .12s; }
.tooltip-enter-from,.tooltip-leave-to { opacity:0; }
@keyframes label-settle { 50% { transform:scale(1.04); } }
@container (max-width:600px) {
  .hou-reader { display:block; padding:14px; margin:4px 0 16px; border:1px solid var(--line); border-radius:6px; background:#fcfaf3; }
  .hou-reader>p { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:10px; font-size:12px; }
  .hou-reader>p small { color:var(--muted); font-size:11px; }
  .hou-reader>div { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; }
  .hou-reader button { min-height:76px; padding:8px; border:1px solid transparent; border-radius:4px; background:#eeeee4; text-align:left; }
  .hou-reader button[aria-pressed=true] { border-color:#c6a180; background:#f4e8dc; color:var(--accent); }
  .hou-reader button:hover { border-color:var(--accent); }
  .hou-reader button small { display:block; font-size:11px; margin-bottom:5px; color:var(--muted); }
  .hou-reader button span { font:16px/1.6 var(--font-display); overflow-wrap:anywhere; }
  .wheel-tooltip { bottom:310px; }
}
@container (max-width:400px) {
  .wheel-controls { gap:14px; }
  .wheel-instruction { font-size:12px; letter-spacing:.5px; }
  .center-eyebrow,.center-longitude,.center-link text { font-size:20px; }
  .center-caption { font-size:21px; }
}
@media(prefers-reduced-motion:reduce) { .tooltip-enter-active,.tooltip-leave-active,.center-disc { transition:none; } .settle-label { animation:none; } }
</style>
