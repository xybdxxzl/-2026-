<script setup>
import { computed } from 'vue';
import { solarModel, yearCurve } from '../lib/astronomy.js';
const props = defineProps({ term: Object, terms: Array });
const emit = defineEmits(['select-term']);
const chartX = x => 36 + x / 360 * 888;
const chartY = shadow => 170 - shadow / 18 * 142;
const path = yearCurve().map((point,index) => `${index ? 'L' : 'M'}${chartX(point.x).toFixed(2)},${chartY(point.shadowChi).toFixed(2)}`).join(' ');
const cursorX = computed(() => chartX(props.term.index * 15));
const noon = computed(() => solarModel(props.term.longitude));
</script>
<template>
  <section class="annual-chart" style="border:0">
    <div class="panel-title"><div><p class="eyebrow">固定地点 · 正午观测</p><h2>八尺竖表的全年影长</h2></div><span class="chart-legend">单位：尺 · 理想模型</span></div>
    <svg viewBox="0 0 960 224" role="group" aria-label="八尺竖表全年正午影长，点击节气选择">
      <g v-for="tick in [0,5,10,15]" :key="tick"><path :d="`M36 ${chartY(tick)}H924`" stroke="#d9d6ca" stroke-dasharray="3 5"/><text x="24" :y="chartY(tick)+4" text-anchor="end" fill="#798079" font-size="11">{{ tick }}</text></g>
      <path :d="`${path}L924 170H36Z`" fill="#e5e8dc"/><path :d="path" fill="none" stroke="#4d7164" stroke-width="2"/>
      <path :d="`M${cursorX} 20V178`" stroke="#ae5544" stroke-dasharray="3 3"/><circle :cx="cursorX" :cy="chartY(noon.shadowChi)" r="5" fill="#ae5544"/>
      <g v-for="item in terms" :key="item.id" class="chart-term" tabindex="0" role="button" :aria-label="`在曲线中选择${item.name}`" @click="emit('select-term',item.id)" @keydown.enter="emit('select-term',item.id)" @keydown.space.prevent="emit('select-term',item.id)"><rect :x="chartX(item.index*15)-16" y="176" width="32" height="35" fill="transparent"/><text :x="chartX(item.index*15)" y="196" text-anchor="middle" :fill="term.id===item.id?'#ae5544':'#798079'" font-size="11">{{ item.name }}</text></g>
    </svg>
    <p class="fine-print">横轴按太阳黄经排列，并非等天数。该图使用八尺竖表，不是上方极轴式晷针的投影长度。历史测影资料仍待核验。</p>
  </section>
</template>
