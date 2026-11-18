<script setup>
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, useId, watch } from 'vue';
import { TERMS } from '../data/terms.js';
import { year } from '../state/year.js';
import { normalize, shortestDelta, snapAngle, termIndex } from '../core/angle.js';
import { solarModel, formatShadow, DEMO_MODEL } from '../lib/astronomy.js';

const props = defineProps({
  compact:Boolean, skyBand:Boolean, longitude:Number, date:String, activeTerm:String, reducedMotion:Boolean,
});
const emit = defineEmits(['day-step','term-step','select-term','finish']);
const rangeId = `year-range-${useId()}`;
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
  // Narrow touch screens scroll the chart; the native range controls time.
  if(event.pointerType==='touch' && matchMedia('(max-width:800px)').matches) return;
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
async function revealSelection() {
  if (props.skyBand) return;
  await nextTick();
  const viewport = track.value?.parentElement;
  if (!viewport || viewport.scrollWidth <= viewport.clientWidth) return;
  const selectedX = x(position.value) / 1200 * track.value.clientWidth;
  if (selectedX < viewport.scrollLeft + 32 || selectedX > viewport.scrollLeft + viewport.clientWidth - 32) {
    viewport.scrollLeft = selectedX - viewport.clientWidth / 2;
  }
}
watch(() => year.state.settled, revealSelection);
onMounted(revealSelection);
onActivated(revealSelection);

const band = ref(null), bandWidth = ref(840), bandDragging = ref(false);
const bandLongitude = computed(() => normalize(Number.isFinite(props.longitude) ? props.longitude : 315));
const bandActiveTerm = computed(() => TERMS.find(item => item.id===props.activeTerm) ?? TERMS[termIndex(bandLongitude.value-315)]);
const bandAriaText = computed(() => [props.date,bandActiveTerm.value.name,`当日中点太阳黄经 ${bandLongitude.value.toFixed(2)} 度`].filter(Boolean).join('，'));
const cellWidth = computed(() => {
  if(bandWidth.value>=672)return bandWidth.value/24;
  // An odd number of whole names leaves the active term in the middle on narrow screens.
  const pairs=Math.max(1,Math.floor((bandWidth.value/42-1)/2));
  return bandWidth.value/(2*pairs+1);
});
const bandUnit = computed(() => cellWidth.value/15);
const degreesPerDay = 360 / 365.2422;
const movingBand=ref(false);
let grabOffset=0;
const centerIndex=computed(()=>movingBand.value
  ? normalize(bandLongitude.value-315+grabOffset)/15 : bandActiveTerm.value.index);
function beginBandMotion(){
  if(movingBand.value)return;
  grabOffset=shortestDelta(bandLongitude.value,bandActiveTerm.value.longitude);
  movingBand.value=true;
}
function centerBand(){
  if(!band.value||!bandWidth.value)return;
  const termX=(24+centerIndex.value+.5)*cellWidth.value;
  band.value.scrollLeft=termX-bandWidth.value/2;
}
function termLabelStyle(turn,index){
  const x=((turn-2)*24+index-centerIndex.value)*cellWidth.value+bandWidth.value/2;
  if(x<-.5||x>=bandWidth.value-.5)return {visibility:'hidden'};
  const offset=Math.max(9,Math.min(bandWidth.value-9,x))-x;
  return offset?{left:offset+'px'}:undefined;
}
watch([centerIndex,bandWidth],centerBand,{flush:'post'});
let bandObserver, bandGesture, inertiaFrame, wheelTimer, wheelDays = 0, wheelMoved = false;
function snapBand(){ movingBand.value=false;emit('finish',{snap:true}); }
function stopBandMotion() {
  const pending = Boolean(inertiaFrame || wheelMoved || bandGesture?.steps);
  cancelAnimationFrame(inertiaFrame);
  clearTimeout(wheelTimer);
  inertiaFrame = wheelTimer = undefined;
  wheelDays = 0;
  wheelMoved = false;
  movingBand.value=false;
  return pending;
}
function bandDown(event) {
  if (event.button!==0 || bandGesture) return;
  if (stopBandMotion()) emit('finish',{snap:false});
  bandGesture = {
    pointer:event.pointerId, startX:event.clientX, lastX:event.clientX, lastTime:event.timeStamp,
    pixelsPerDay:bandUnit.value*degreesPerDay, steps:0, velocity:0,
    term:event.target.closest('[data-band-term]')?.dataset.bandTerm,
  };
  event.currentTarget.focus({preventScroll:true});
  event.currentTarget.setPointerCapture(event.pointerId);
}
function bandMove(event) {
  const drag = bandGesture;
  if (!drag || drag.pointer!==event.pointerId) return;
  const dx = drag.startX-event.clientX;
  if (!bandDragging.value && Math.abs(dx)<4) return;
  beginBandMotion();
  bandDragging.value = true;
  const days = Math.round(dx/drag.pixelsPerDay);
  const elapsed = Math.max(1,event.timeStamp-drag.lastTime);
  const velocity = (drag.lastX-event.clientX)/drag.pixelsPerDay/elapsed;
  drag.velocity = drag.velocity*.35 + velocity*.65;
  drag.lastX = event.clientX;
  drag.lastTime = event.timeStamp;
  if (days!==drag.steps) {
    emit('day-step',days-drag.steps);
    drag.steps = days;
  }
}
function bandUp(event) {
  const drag = bandGesture;
  if (!drag || drag.pointer!==event.pointerId) return;
  const moved = bandDragging.value;
  bandGesture = undefined;
  bandDragging.value = false;
  if (!moved) {
    if (drag.term) emit('select-term',drag.term);
    return;
  }
  const extra = Math.max(-10,Math.min(10,Math.round(drag.velocity*85)));
  if (!extra || props.reducedMotion || event.timeStamp-drag.lastTime>85) {
    snapBand();
    return;
  }
  const started = performance.now();
  let steps = 0;
  function coast(time) {
    const progress = Math.min(1,(time-started)/210);
    const days = Math.round(extra*(1-(1-progress)**3));
    if (days!==steps) emit('day-step',days-steps);
    steps = days;
    if (progress<1) inertiaFrame = requestAnimationFrame(coast);
    else {
      inertiaFrame = undefined;
      snapBand();
    }
  }
  inertiaFrame = requestAnimationFrame(coast);
}
function bandCancel(event) {
  if (event.pointerId!==bandGesture?.pointer) return;
  const moved = bandGesture.steps!==0;
  movingBand.value=false;
  bandGesture = undefined;
  bandDragging.value = false;
  if (moved) emit('finish',{snap:false});
}
function bandWheel(event) {
  if (event.ctrlKey || event.metaKey) return;
  event.preventDefault();
  if (bandGesture) return;
  if (inertiaFrame) wheelMoved = true;
  cancelAnimationFrame(inertiaFrame);
  inertiaFrame = undefined;
  const delta = Math.abs(event.deltaX)>Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  const pixels = delta * (event.deltaMode===1 ? 16 : event.deltaMode===2 ? bandWidth.value : 1);
  wheelDays += Math.max(-10,Math.min(10,pixels/(bandUnit.value*2.6)));
  const days = Math.trunc(wheelDays);
  if (days) {
    beginBandMotion();
    emit('day-step',days);
    wheelDays -= days;
    wheelMoved = true;
  }
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(() => {
    if (wheelMoved) snapBand();
    wheelTimer = undefined;
    wheelDays = 0;
    wheelMoved = false;
  },160);
}
function bandKey(event) {
  const step = { ArrowLeft:-1, ArrowDown:-1, ArrowRight:1, ArrowUp:1 }[event.key];
  if (!step || event.altKey || event.ctrlKey || event.metaKey) return;
  event.preventDefault();
  if (stopBandMotion()) emit('finish',{snap:false});
  if (event.shiftKey) {
    emit('day-step',step);
    emit('finish',{snap:false});
  } else emit('term-step',step);
}
function observeBand() {
  if (!band.value || bandObserver) return;
  bandWidth.value = Math.max(1,band.value.clientWidth);
  bandObserver = new ResizeObserver(([entry]) => {
    if (entry.contentRect.width>0) bandWidth.value = entry.contentRect.width;
  });
  bandObserver.observe(band.value);
  nextTick(centerBand);
}
function disconnectBand() {
  bandObserver?.disconnect();
  bandObserver = undefined;
  if (stopBandMotion()) emit('finish',{snap:false});
  bandGesture = undefined;
  bandDragging.value = false;
}
watch(band, element => {
  if (element) observeBand();
  else disconnectBand();
},{flush:'post'});
watch(() => props.reducedMotion, reduced => {
  if (reduced && inertiaFrame) {
    cancelAnimationFrame(inertiaFrame);
    inertiaFrame = undefined;
    snapBand();
  }
});
onActivated(observeBand);
onDeactivated(disconnectBand);
onBeforeUnmount(disconnectBand);
</script>

<template>
  <div v-if="skyBand" class="ruler-row year-row">
    <span class="ruler-label" aria-hidden="true">岁</span>
    <div class="year-field">
      <div ref="band" class="sky-band" :class="{ 'is-dragging':bandDragging }" role="slider" tabindex="0"
        aria-label="一年节气带" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="360"
        :aria-valuenow="Number(bandLongitude.toFixed(2))" :aria-valuetext="bandAriaText"
        aria-description="点击节气跳转，拖动或滚动移动日期，方向键切换节气，Shift 加方向键移动一天"
        @pointerdown="bandDown" @pointermove="bandMove" @pointerup="bandUp" @pointercancel="bandCancel"
        @lostpointercapture="bandCancel" @wheel="bandWheel" @keydown="bandKey">
        <div class="year-scroll" :style="{'--cell':cellWidth+'px'}" aria-hidden="true">
          <div v-for="turn in 3" :key="turn" class="year-cycle">
            <div class="year-wash"></div>
            <span v-for="item in TERMS" :key="item.id" :data-band-term="item.id" class="year-term"
              :class="{ cardinal:item.index%6===3, inception:item.index%6===0, current:item.id===bandActiveTerm.id }">
              <i></i><span :style="termLabelStyle(turn,item.index)">{{ item.name }}</span>
            </span>
          </div>
        </div>
      </div>
      <i class="year-pointer" aria-hidden="true"></i>
    </div>
  </div>
  <section v-else class="year-slider" :class="{'is-dragging':dragging}" aria-label="全年节气与日影联动">
    <div class="year-slider-heading"><div><span class="eyebrow">拨动一年</span><span class="year-slider-tip">拖动节气轴，保持同一时刻看日影</span></div><div class="year-live-reading"><strong>{{ year.term.value.name }}</strong><span>{{ year.longitude.value.toFixed(1) }}°</span><small>正午参考影长 {{ formatShadow(model.shadowChi) }}</small></div></div>
    <div class="mobile-year-control"><label :for="rangeId">选择一年中的位置</label><input :id="rangeId" type="range" min="0" max="345" step="15" :value="year.term.value.index*15" :aria-valuetext="ariaText" @input="year.goToAngle(Number($event.target.value))" /></div>
    <div class="year-track-scroll" aria-label="全年曲线，窄屏可左右滑动查看">
    <svg ref="track" class="year-track" :viewBox="`0 0 1200 ${compact?108:140}`" role="slider" tabindex="0" aria-label="节气滚动条" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="360" :aria-valuenow="Number(position.toFixed(2))" :aria-valuetext="ariaText" @keydown="key" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="cancel" @lostpointercapture="cancel">
      <path :d="area" fill="#708f6d" opacity=".10"/><path :d="path" fill="none" stroke="#6a8b73" stroke-width="1.6"/>
      <g v-for="label in labels" :key="label.angle" class="year-extreme"><circle :cx="label.x" :cy="label.y" r="3" fill="#6a8b73"/><text :x="label.x+(label.side==='start'?10:-10)" :y="label.y-9" :text-anchor="label.side">{{ label.name }} {{ label.text }}</text></g>
      <line x1="32" x2="1168" :y1="axisY" :y2="axisY" stroke="#9fae99" stroke-width=".7"/>
      <line v-for="i in 73" :key="i" :x1="x((i-1)*5)" :x2="x((i-1)*5)" :y1="axisY" :y2="axisY+((i-1)%3===0?9:4)" stroke="#9fae99" :stroke-width="(i-1)%3===0?1:.6"/>
      <g v-for="item in TERMS" :key="item.id" :class="{'year-active':year.term.value.id===item.id}"><text :x="x(item.index*15)" :y="axisY+29" text-anchor="middle" class="year-term-label">{{ item.name }}</text><circle v-if="year.state.relatedTermIds.includes(item.id)" :cx="x(item.index*15)" :cy="axisY+41" r="2.5" fill="#ae5544"/></g>
      <g class="year-thumb" :transform="`translate(${handle.x} ${handle.y})`"><line y1="0" :y2="axisY-handle.y" stroke="#ae5544" stroke-width="1" stroke-dasharray="2 3"/><circle r="10" fill="#ae5544" opacity=".12"/><circle r="5" fill="#ae5544" stroke="#fff9ed" stroke-width="2"/></g>
    </svg>
    </div>
    <p class="mobile-year-hint">左右滑动读全年曲线 · 用上方滑块选择节气</p>
    <div class="year-slider-foot"><span>立春开篇 · 每小刻度为一候</span><span>曲线为八尺竖表正午影长 · {{ DEMO_MODEL.latitude }}°N演示 · 与日晷影端单位不同</span><span>方向键 ±5° · PageUp / Down ±1节气</span></div>
  </section>
</template>

<style scoped>
.year-field { position:relative; min-width:0; }
.sky-band { position:relative; width:100%; overflow-x:auto; overflow-y:hidden; scrollbar-width:none;
  touch-action:pan-y; cursor:grab; user-select:none; overscroll-behavior-x:contain; }
.sky-band::-webkit-scrollbar { display:none; }
.sky-band.is-dragging { cursor:grabbing; }
.sky-band:focus-visible { outline:2px solid var(--dial-cinnabar); outline-offset:2px; }
.year-scroll,.year-cycle { display:flex; width:max-content; }
.year-cycle { position:relative; }
.year-wash { position:absolute; inset:8px 0 auto; height:15px; opacity:.45;
  background:linear-gradient(90deg,var(--dial-springWash) 0% 13%,var(--dial-summerWash) 25% 38%,var(--dial-autumnWash) 50% 63%,var(--dial-winterWash) 75% 88%,var(--dial-springWash) 100%); }
.year-cycle::after { content:''; position:absolute; inset:23px 0 auto; border-top:1px solid var(--dial-lightInk); pointer-events:none; }
.year-term { position:relative; display:block; width:var(--cell); height:67px; padding-top:29px; text-align:center; color:var(--dial-ink); font:14px/1.2 var(--ruler-font); }
.year-term i { position:absolute; left:50%; top:24px; transform:translateY(-100%); height:5px; border-left:1px solid currentColor; }
.year-term span {position:relative;display:inline-block;writing-mode:vertical-rl;text-orientation:upright;letter-spacing:.04em;padding-bottom:2px;border-bottom:1px solid transparent;}
.year-term.inception i { height:10px; }
.year-term.cardinal i { height:14px; }
.year-term.cardinal,.year-term.current { color:var(--dial-cinnabar); }
.year-term:hover span,.year-term.current span { border-bottom-color:currentColor; }
.year-pointer { position:absolute; z-index:1; top:1px; left:50%; width:1px; height:24px; transform:translateX(-50%); background:var(--dial-cinnabar); pointer-events:none; }
.year-pointer::before { content:''; position:absolute; left:50%; top:0; transform:translateX(-50%); border:solid transparent; border-width:6px 3.5px 0; border-top-color:var(--dial-cinnabar); }
</style>

<style scoped>
.year-slider{padding:17px 20px 12px;background:rgba(250,248,239,.87);border:1px solid #c5cbb980;border-radius:3px;position:relative}.year-slider-heading{display:flex;align-items:center;justify-content:space-between;gap:20px}.year-slider-heading>div{display:flex;align-items:center;gap:16px}.year-slider-heading .eyebrow{margin:0;color:#526c58}.year-slider-tip{font-size:10px;color:#727d70}.year-live-reading{font-variant-numeric:tabular-nums;white-space:nowrap}.year-live-reading strong{font-size:18px;font-weight:500;letter-spacing:.12em}.year-live-reading>span{font-size:11px;color:#8e604a}.year-live-reading small{font-size:10px;color:#75816e}.year-track{display:block;width:100%;overflow:visible;touch-action:none;cursor:ew-resize;user-select:none}.year-term-label{font-size:11px;fill:#667462;letter-spacing:1px}.year-active .year-term-label{fill:#a54d3b;font-weight:700}.year-extreme text{font-size:10px;fill:#7d876c}.year-slider-foot{display:flex;justify-content:space-between;gap:14px;color:#7c8475;font-size:9px}.is-dragging{cursor:grabbing}@media(max-width:900px){.year-slider-heading{align-items:flex-start}.year-slider-tip,.year-live-reading small,.year-slider-foot>span:last-child{display:none}.year-slider{padding-inline:10px}.year-slider-foot{font-size:8px}.year-track{min-height:90px}.year-live-reading{gap:8px!important}}
</style>

<style scoped>
.year-slider { padding: 22px 24px 16px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg); }
.year-slider-heading .eyebrow { font-size: 13px; color: var(--ink); }
.year-slider-tip, .year-live-reading small, .year-slider-foot { font-size: 11px; color: var(--muted); }
.year-live-reading>span { color: var(--accent); font-size: 13px; }
.year-term-label { font-size: 13px; fill: var(--muted); letter-spacing: 0; }
.year-extreme text { font-size: 12px; fill: var(--muted); }
.year-track-scroll { overflow-x: auto; padding: 12px 0 6px; scrollbar-color: #a7b39b var(--surface-muted); scrollbar-width: thin; }
.year-track { margin-block: 4px; }
.year-slider-foot { flex-wrap: wrap; gap: 4px 20px; }
.mobile-year-control, .mobile-year-hint { display: none; }
@media(max-width:800px) {
  .year-slider { padding: 18px 16px; min-width: 0; }
  .year-slider-heading>div { gap: 8px; }
  .year-live-reading strong { font-size: 17px; }
  .year-track { min-width: 900px; touch-action: pan-x pan-y; }
  .year-slider-foot { display: block; font-size: 11px; }
  .year-slider-foot>span { display: block; margin-top: 6px; }
  .mobile-year-control { display: block; margin-top: 18px; }
  .mobile-year-control label { display: block; font-size: 12px; color: var(--muted); }
  .mobile-year-control input { display: block; width: 100%; height: 32px; margin: 8px 0 0; accent-color: var(--accent); }
  .mobile-year-hint { display: block; margin: 10px 0; font-size: 11px; color: var(--muted); }
}
</style>
