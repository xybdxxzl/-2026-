<script setup>
import { onMounted, onActivated, onDeactivated, onBeforeUnmount, ref, watch } from 'vue';
import { SundialScene as SundialRenderer } from '../scene/sundial/SundialScene.js';

const props = defineProps({ solar:Object, latitude:Number, tracks:Object, layers:Object, preset:String, face:String,
  instrumentKind:String, reset:Number, touchActive:Boolean, low:Boolean, xray:Boolean, secondary:Object, showBoth:Boolean,
  compare:Boolean, solstices:Array, solsticeDriver:String, equinox:Boolean, longitude:Number, reducedMotion:Boolean, debug:Boolean });
const emit = defineEmits(['unavailable','ready','view-change','face-visibility']);
const host = ref(null), sunEdge = ref(null);
let rig;
const state = () => ({ instrumentKind:props.instrumentKind, solar:props.solar, latitude:props.latitude, tracks:props.tracks, layers:props.layers,
  preset:props.preset, face:props.face, low:props.low, xray:props.xray, secondary:props.secondary,
  showBoth:props.showBoth, compare:props.compare, solstices:props.solstices, solsticeDriver:props.solsticeDriver,
  equinox:props.equinox, longitude:props.longitude, reducedMotion:props.reducedMotion, debug:props.debug });
function init() {
  if (rig || !host.value) return;
  try {
    rig = new SundialRenderer(host.value, {
      onReady:() => emit('ready'), onUnavailable:() => emit('unavailable'),
      onView:(preset,face) => emit('view-change',{preset,face}), onSunEdge:value => { sunEdge.value=value; },
      onFaceVisibility:value => emit('face-visibility',value),
    });
    rig.init(state());
  } catch (error) {
    console.warn('三维日晷初始化失败',error);
    rig?.dispose(); rig=null; emit('unavailable');
  }
}
function sync() { rig?.setState(state()); }
function destroy() { rig?.dispose(); rig=null; sunEdge.value=null; }
watch(() => [props.instrumentKind,props.solar,props.latitude,props.tracks,props.xray,props.secondary,props.showBoth,props.compare,
  props.solstices,props.solsticeDriver,props.equinox,props.longitude,props.reducedMotion,props.debug],sync);
watch(() => props.layers,value => rig?.setLayers(value),{deep:true});
watch(() => [props.preset,props.face,props.reset],() => rig?.setView(props.preset,props.face,!props.reducedMotion));
watch(() => props.low,() => { destroy(); init(); });
onMounted(init); onActivated(init); onDeactivated(destroy); onBeforeUnmount(destroy);
</script>

<template>
  <div ref="host" class="scene-host" :class="{'touch-active':touchActive}">
    <div v-if="layers.sky && !solstices?.length && sunEdge && solar.altitude > 0" class="sun-label"
      :class="{ 'at-edge':!sunEdge.visible, 'near-bottom':sunEdge.visible && sunEdge.y>86 }"
      :style="{left:`clamp(46px, ${sunEdge.x}%, calc(100% - 46px))`,top:sunEdge.y+'%'}" aria-hidden="true">
      <svg v-if="!sunEdge.visible" viewBox="0 0 24 24" :style="{transform:'rotate('+sunEdge.angle+'deg)'}"><path d="M4 12h14m-5-5 5 5-5 5" /></svg>
      <span>太阳 {{ sunEdge.altitude.toFixed(1) }}°</span>
    </div>
    <span v-if="preset==='side' && layers.ray" class="projection-note">侧视投影</span>
  </div>
</template>

<style scoped>
.scene-host { position:relative; width:100%; height:100%; overflow:hidden; }
.scene-host :deep(canvas) { width:100%; height:100%; display:block; cursor:grab; touch-action:none; }
.scene-host :deep(canvas:active) { cursor:grabbing; }
.sun-label {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 4px;
  z-index: 1;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--dial-bronzeDark);
  color: var(--dial-paper);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  transform: translate(-50%, 26px);
  pointer-events: none;
}
.sun-label.at-edge {
  border: 1px solid var(--dial-gold);
  transform: translate(-50%, -50%);
}
.sun-label.near-bottom {
  transform: translate(-50%, calc(-100% - 26px));
}
.sun-label svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
}
.projection-note {
  position: absolute;
  right: 12px;
  bottom: 12px;
  padding: 3px 7px;
  border-radius: 4px;
  background: var(--dial-bronzeDark);
  color: var(--dial-paper);
  font-size: 11px;
  pointer-events: none;
}
@media (pointer:coarse) {
  .scene-host:not(.touch-active) :deep(canvas) { pointer-events:none; touch-action:pan-y; }
}
</style>
