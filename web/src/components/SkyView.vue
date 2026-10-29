<script setup>
import { computed, ref } from 'vue';
import ShadowDiagram from './ShadowDiagram.vue';
import { solarModel, yearCurve, formatShadow, formatHours } from '../lib/astronomy.js';
const props = defineProps({ term: Object, terms: Array });
const emit = defineEmits(['select-term','open-detail','open-source']);
const explanation = ref(false);
const model = computed(() => solarModel(props.term.longitude));
const points = yearCurve();
const chartX = x => 36 + x / 360 * 888;
const chartY = shadow => 170 - shadow / 18 * 142;
const path = points.map((point,index) => `${index ? 'L' : 'M'}${chartX(point.x).toFixed(2)},${chartY(point.shadowChi).toFixed(2)}`).join(' ');
const cursorX = computed(() => chartX(props.term.index * 15));
const keyTerms = computed(() => props.terms.filter(term => ['chunfen','xiazhi','qiufen','dongzhi'].includes(term.id)));
</script>

<template>
  <section class="sky-page">
    <div class="page-heading"><div><p class="eyebrow">第三篇 · 观天测影</p><h1>日影长短，<em>天时可见。</em></h1></div><p class="heading-note">八尺之表，度量一年的流转<br>当前为理想几何模型演示</p></div>
    <div class="model-disclaimer"><span class="pending-label">演示参数</span><span>纬度35°N · 表高八尺 · 阳城位置尚待核验</span><button class="text-link" @click="explanation=!explanation">{{ explanation ? '收起' : '查看' }}模型说明 {{ explanation ? '−' : '+' }}</button></div>
    <div class="sky-main"><section class="shadow-stage"><span class="eyebrow">{{ term.name }} · 正午日影</span><ShadowDiagram :longitude="term.longitude" /><p>在同一比例下观察影子伸缩</p></section><section class="model-readings"><div class="large-reading"><span>正午影长</span><strong>{{ formatShadow(model.shadowChi) }}</strong><small>理论计算 · 非历史实测</small></div><dl class="reading-grid"><div><dt>太阳黄经</dt><dd>{{ term.longitude }}<small>°</small></dd></div><div><dt>正午太阳高度</dt><dd>{{ model.altitude.toFixed(1) }}<small>°</small></dd></div><div><dt>理想昼长</dt><dd>{{ formatHours(model.daylightHours) }}</dd></div><div><dt>理想夜长</dt><dd>{{ formatHours(model.nightHours) }}</dd></div></dl></section></div>
    <section v-if="explanation" class="model-explanation"><h3>这个演示如何计算？</h3><p>太阳黄经 → 太阳赤纬 → 正午太阳高度 → 影长。这里采用固定黄赤交角23.44°、演示纬度35°N及八尺表，用简化几何关系展示周期变化，忽略大气折射、太阳视半径、地形与历史历元变化。</p><p>此处正午指当地太阳中天。尚未确定阳城坐标，当前数值不用于复原古代测量，也不用于准确预测日出日落。</p><button class="text-link" @click="emit('open-source','天文模型与历史测影资料')">历史记录待补 · 查看资料结构 ↗</button></section>
    <section class="annual-chart"><div class="panel-title"><div><p class="eyebrow">一年之中</p><h2>正午影长的周期</h2></div><span class="chart-legend"><i></i>同一地点 · 同一表高</span></div><svg viewBox="0 0 960 224" role="img" aria-label="一年中正午影长的模型曲线，横轴为节气黄经周期，纵轴单位尺"><g v-for="tick in [0,5,10,15]" :key="tick"><path :d="`M36 ${chartY(tick)}H924`" stroke="#d9d6ca" stroke-dasharray="3 5"/><text x="24" :y="chartY(tick)+4" text-anchor="end" fill="#798079" font-size="11">{{ tick }}</text></g><text x="14" y="16" fill="#798079" font-size="11">尺</text><path :d="`${path}L924 170H36Z`" fill="#e5e8dc"/><path :d="path" fill="none" stroke="#4d7164" stroke-width="2"/><path :d="`M${cursorX} 20V178`" stroke="#ae5544" stroke-width="1" stroke-dasharray="3 3"/><circle :cx="cursorX" :cy="chartY(model.shadowChi)" r="5" fill="#ae5544" stroke="#f5f1e8" stroke-width="2"/><g v-for="item in terms" :key="item.id" class="chart-term" tabindex="0" role="button" :aria-label="`在曲线中选择${item.name}`" @click="emit('select-term',item.id)" @keydown.enter="emit('select-term',item.id)" @keydown.space.prevent="emit('select-term',item.id)"><rect :x="chartX(item.index*15)-16" y="176" width="32" height="35" fill="transparent"/><text :x="chartX(item.index*15)" y="196" text-anchor="middle" :fill="term.id===item.id?'#ae5544':'#798079'" font-size="11">{{ item.name }}</text></g></svg><p class="fine-print">横轴为节气黄经顺序，各格不代表相等公历天数。点击节气名称可同步选择。</p></section>
    <section class="key-term-section"><div class="panel-title"><h2>两至两分，同尺度比较</h2><span class="fine-print">选择一项，查看对应日影</span></div><div class="key-term-grid"><button v-for="item in keyTerms" :key="item.id" :class="{active:term.id===item.id}" @click="emit('select-term',item.id)"><span>{{ item.name }} <small>{{ item.longitude }}°</small></span><ShadowDiagram :longitude="item.longitude" compact/><strong>{{ formatShadow(solarModel(item.longitude).shadowChi) }}</strong><small>历史测影记录待补</small></button></div></section>
  </section>
</template>
