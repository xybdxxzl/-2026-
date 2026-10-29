<script setup>
import { computed } from 'vue';
import { solarModel } from '../lib/astronomy.js';
const props = defineProps({ longitude: { type: Number, default: 315 }, compact: Boolean });
const model = computed(() => solarModel(props.longitude));
const x = 80, groundY = 166, scale = 10;
const shadowEnd = computed(() => x + (model.value.shadowChi || 0) * scale);
const sun = computed(() => ({ x: x - 60 * Math.cos(model.value.altitude * Math.PI / 180), y: groundY - 80 - 60 * Math.sin(model.value.altitude * Math.PI / 180) }));
</script>

<template>
  <svg class="shadow-diagram" :class="{ compact }" viewBox="0 0 300 210" role="img" :aria-label="`八尺表在演示纬度35度下的正午日影，太阳高度${model.altitude.toFixed(1)}度`">
    <defs><pattern id="ground-hatch" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0,6 L6,0" stroke="#c5c9b9" stroke-width=".5" /></pattern></defs>
    <path d="M20 170H280V178H20Z" fill="url(#ground-hatch)" />
    <path d="M20 166H280" stroke="#8b9688" stroke-width="1" />
    <path v-for="i in 20" :key="i" :d="`M${x+i*scale} 166v${i%5===0?8:4}`" stroke="#a2a99b" stroke-width=".65" />
    <path :d="`M${x} ${groundY}H${shadowEnd}`" stroke="#a95844" stroke-width="6" opacity=".6" />
    <path :d="`M${x} ${groundY}V${groundY-80}`" stroke="#304c43" stroke-width="5" />
    <path :d="`M${x} ${groundY-80}L${shadowEnd} ${groundY}`" stroke="#c09358" stroke-width="1.2" stroke-dasharray="4 3" />
    <circle :cx="sun.x" :cy="sun.y" r="9" fill="#c79352" opacity=".9" />
    <path :d="`M${x} ${groundY-80}L${sun.x} ${sun.y}`" stroke="#c09358" stroke-width="1.2" />
    <text x="60" y="121" text-anchor="end" fill="#68776b" font-size="12">表</text>
    <text x="274" y="194" text-anchor="end" fill="#68776b" font-size="11">圭</text>
    <text :x="(x+shadowEnd)/2" y="154" text-anchor="middle" fill="#a95844" font-size="11">日影</text>
    <text v-if="!compact" x="80" y="195" fill="#68776b" font-size="10">0</text>
  </svg>
</template>

<style scoped>
.shadow-diagram{display:block;width:100%;height:auto;overflow:visible}.compact{max-width:230px}
</style>
