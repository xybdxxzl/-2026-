<script setup>
import { computed } from 'vue';
import { solarModel, yearCurve } from '../lib/astronomy.js';
import { annualVerticalCurve } from '../lib/astro/observation.js';
const props = defineProps({ term: Object, terms: Array, observer: Object, cycle: Number });
const emit = defineEmits(['select-term']);
const chartX = x => 36 + x / 360 * 888;
const curve = computed(() => props.observer
  ? annualVerticalCurve(props.cycle,props.observer)
  : { values:yearCurve(), terms:props.terms.map(term => ({ ...term, x:term.index*15, ...solarModel(term.longitude) })) });
const maximum = computed(() => Math.max(18, ...curve.value.values.map(point => point.shadowChi ?? 0)));
const chartY = shadow => 170 - shadow / maximum.value * 142;
const ticks = computed(() => [0,1,2,3].map(i => maximum.value / 3 * i));
const path = computed(() => {
  let joined = false;
  return curve.value.values.map(point => {
    if (point.shadowChi == null) { joined=false; return ''; }
    const command = joined ? 'L' : 'M';
    joined = true;
    return `${command}${chartX(point.x).toFixed(2)},${chartY(point.shadowChi).toFixed(2)}`;
  }).join(' ');
});
const marker = computed(() => curve.value.terms.find(term => term.id === props.term.id));
</script>
<template>
  <section class="annual-chart" style="border:0">
    <div class="panel-title"><div><p class="eyebrow">{{ observer ? observer.name + ' · ' + cycle + '立春周期' : '固定参考 · 35°N' }}</p><h2>八尺竖表的全年影长</h2></div><span class="chart-legend">单位：尺 · 当地午正</span></div>
    <div class="annual-chart-scroll">
    <svg viewBox="0 0 960 224" role="group" aria-label="八尺竖表全年正午影长，点击节气选择">
      <g v-for="tick in ticks" :key="tick"><path :d="`M36 ${chartY(tick)}H924`" stroke="var(--line)" stroke-dasharray="3 5"/><text x="30" :y="chartY(tick)+4" text-anchor="end" fill="var(--muted)" font-size="10">{{ Number(tick.toPrecision(3)) }}</text></g>
      <path :d="path" fill="none" stroke="#4d7164" stroke-width="2"/>
      <g v-if="marker"><path :d="`M${chartX(marker.x)} 20V178`" stroke="#ae5544" stroke-dasharray="3 3"/><circle v-if="marker.shadowChi != null" :cx="chartX(marker.x)" :cy="chartY(marker.shadowChi)" r="5" fill="#ae5544"/></g>
      <g v-for="item in curve.terms" :key="item.id" class="chart-term" tabindex="0" role="button" :aria-label="`在曲线中选择${item.name}`" :aria-pressed="term.id===item.id" @click="emit('select-term',item.id)" @keydown.enter="emit('select-term',item.id)" @keydown.space.prevent="emit('select-term',item.id)"><rect :x="chartX(item.x)-16" y="176" width="32" height="35" fill="transparent"/><text :x="chartX(item.x)" y="196" text-anchor="middle" :fill="term.id===item.id?'var(--accent)':'var(--muted)'" font-size="12">{{ item.name }}</text></g>
    </svg>
    </div>
    <p class="fine-print">{{ observer ? '横轴按公历时间排列，无直射日影的日期断开。' : '横轴按太阳黄经排列。' }}该图显示八尺竖表的理论影长。</p>
  </section>
</template>

<style scoped>
.annual-chart-scroll { overflow-x: auto; padding: 5px; scrollbar-width: thin; scrollbar-color: #a7b39b var(--surface-muted); }
@media(max-width:800px) { .annual-chart-scroll svg { min-width: 800px; } }
</style>
