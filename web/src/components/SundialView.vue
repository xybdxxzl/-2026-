<script setup>
import { computed, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue';
import SundialDiagram from './SundialDiagram.vue';
import AnnualShadowChart from './AnnualShadowChart.vue';
import { solarModel, sundialModel, formatHours, formatSolarTime } from '../lib/astronomy.js';
import YearSlider from './YearSlider.vue';
import HouSection from './HouSection.vue';
import LinkedRecords from './LinkedRecords.vue';
import { year } from '../state/year.js';
import { subscribeFrame } from '../core/loop.js';

const props = defineProps({ term: Object, terms: Array });
const emit = defineEmits(['select-term']);
const explanation = ref(false);
const solarTime = ref(10);
const playing = ref(false);
let unsubscribe;
const noon = computed(() => solarModel(year.longitude.value));
const dial = computed(() => sundialModel(year.longitude.value, solarTime.value));
const shichen = computed(() => ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'][Math.floor((solarTime.value + 1) / 2) % 12]);
const keyTerms = computed(() => props.terms.filter(term => ['chunfen','xiazhi','qiufen','dongzhi'].includes(term.id)));

function pause() {
  playing.value = false;
}
function setTime(value) {
  pause();
  solarTime.value = Number(value);
}
function togglePlay() {
  if (playing.value) return pause();
  if (solarTime.value >= 20) solarTime.value = 4;
  playing.value = true;
}
onMounted(() => { unsubscribe = subscribeFrame(dt => { if (!playing.value) return; solarTime.value = Math.min(20, solarTime.value + dt); if (solarTime.value >= 20) pause(); }); });
onDeactivated(pause);
onBeforeUnmount(() => { pause(); unsubscribe?.(); });
</script>

<template>
  <section class="sky-page sundial-page">
    <div class="page-heading">
      <div><p class="eyebrow">第三篇 · 观天测影</p><h1>一晷日影，<em>读一日时光。</em></h1></div>
      <p class="heading-note">横向拨动一年，纵观季节日影<br>也可拨动一天，沿影线读时</p>
    </div>
    <div class="dial-toolbar">
      <span class="dial-type"><i></i>水平式日晷</span>
      <span class="fine-print">演示纬度35°N · 极轴式晷针</span>
      <button class="text-link" :aria-expanded="explanation" @click="explanation = !explanation">{{ explanation ? '收起' : '读晷' }}说明 {{ explanation ? '−' : '+' }}</button>
    </div>
    <YearSlider compact />
    <div class="dial-experience">
      <div class="dial-visual">
        <div class="dial-season"><span>{{ term.season }}</span><div><small>当前节气</small><strong>{{ term.name }}</strong></div></div>
        <SundialDiagram :longitude="year.longitude.value" :solar-time="solarTime" />
        <p class="dial-visual-note">晷面、晷针与绘图比例固定 · 比较同一时刻的影端位置</p>
      </div>
      <aside class="dial-time-panel">
        <p class="eyebrow">{{ shichen }}时 · 影线读时</p>
        <div class="solar-clock" aria-live="off">{{ formatSolarTime(solarTime) }}<span>真太阳时</span></div>
        <p class="clock-caption">按太阳的位置计时<br>不直接等同于北京时间</p>
        <div class="time-slider-block">
          <label for="solar-time">拨动一天 <span>{{ playing ? '正在演示' : '拖动滑块' }}</span></label>
          <input id="solar-time" type="range" min="4" max="20" step="0.08333333333333333" :value="solarTime" :aria-valuetext="`${formatSolarTime(solarTime)} 真太阳时`" @input="setTime($event.target.value)" />
          <div class="slider-hours"><span>04:00</span><span>12:00</span><span>20:00</span></div>
        </div>
        <div class="dial-actions"><button class="play-day" :aria-pressed="playing" @click="togglePlay"><span aria-hidden="true">{{ playing ? 'Ⅱ' : '▷' }}</span>{{ playing ? '暂停日行' : '看日影走一天' }}</button><button class="text-link" @click="setTime(12)">回到午正</button></div>
        <dl class="dial-readings">
          <div><dt>太阳高度</dt><dd>{{ dial.altitude.toFixed(1) }}<small>°</small></dd></div>
          <div><dt>太阳黄经</dt><dd>{{ year.longitude.value.toFixed(1) }}<small>°</small></dd></div>
          <div><dt>理想昼长</dt><dd>{{ formatHours(noon.daylightHours) }}</dd></div>
        </dl>
        <p class="dial-state-note" role="status">{{ !dial.lit ? '此时太阳尚未升起或已经落下，日晷没有直射日影。' : dial.shadowDistance > 5 ? '当前影端超出晷面，影线方向仍与时刻相对应。' : '朱砂点标记晷针尖端的投影，虚线展示季节轨迹。' }}</p>
      </aside>
    </div>
    <section class="dial-season-compare" aria-label="两至两分日晷对照">
      <div><p class="eyebrow">同一日晷 · 同一时刻</p><h2>换个节气，再看日影。</h2></div>
      <div class="season-choices"><button v-for="item in keyTerms" :key="item.id" :class="{active:term.id===item.id}" :aria-pressed="term.id===item.id" @click="emit('select-term',item.id)"><span>{{ item.name }}</span><small>{{ item.longitude }}°</small></button></div>
      <p>时刻决定影线方向；季节改变影端的位置。比较节气时，右侧时刻保持不变。</p>
    </section>
    <HouSection />
    <LinkedRecords />
    <section v-if="explanation" class="model-explanation dial-explanation">
      <h3>怎样读这座日晷？</h3>
      <p>这是水平式日晷的几何演示。晷面水平，晷针的计时边指向北天极，与水平面的夹角等于当地纬度。时线按该纬度计算，不把钟面简单分成相等角度。</p>
      <p>同一真太阳时的影线方向由时角与纬度决定；节气改变太阳赤纬，从而改变影端距离。三条虚线是夏至、春秋分、冬至的全天影端轨迹。晷面尺寸固定，太阳低于地平线时不画直射日影。</p>
      <p>当前纬度35°是演示值，尚未作为阳城位置确认；晷针垂直高度按1归一化，没有把晷针投影冒充八尺竖表影长。模型忽略折射、太阳视半径和地形，当前没有换算北京时间。</p>
      <a class="text-link" href="https://sundialsoc.org.uk/all-about-sundials/how-sundials-work/how-sundials-work-part-2/" target="_blank" rel="noopener noreferrer">水平式日晷原理 · British Sundial Society ↗</a>
    </section>
    <details class="gnomon-reference">
      <summary><span>展开全年影长原理</span><small>八尺竖表参考，与日晷分开阅读</small><span class="reference-plus">＋</span></summary>
      <AnnualShadowChart :term="term" :terms="terms" @select-term="emit('select-term',$event)" />
    </details>
  </section>
</template>

<style scoped>
.dial-toolbar{display:flex;align-items:center;gap:22px;padding:13px 0;border-block:1px solid var(--line)}
.dial-type{font-size:12px;display:flex;align-items:center;gap:9px}.dial-type i{width:5px;height:5px;border-radius:50%;background:#b9a475}.dial-toolbar>.text-link{margin-left:auto}
.dial-experience{display:grid;grid-template-columns:minmax(0,2.35fr) minmax(230px,1fr);gap:4%;align-items:center;padding:22px 0 28px}
.dial-visual{min-width:0;position:relative;padding-top:16px}.dial-season{display:flex;align-items:center;gap:11px;position:absolute;left:12px;top:13px;z-index:1}.dial-season>span{font-size:15px;border:1px solid #a8b49c;padding:3px 8px;color:#849176}.dial-season div{display:flex;gap:8px;align-items:center}.dial-season small{font-size:10px;color:var(--muted)}.dial-season strong{font-size:16px;font-weight:400;letter-spacing:.1em}.dial-visual-note{font-size:10px;color:#969b88;text-align:center;margin-top:20px;letter-spacing:.04em}
.dial-time-panel{padding:10px 0 10px 22px;border-left:1px solid #d9d6ca88}.dial-time-panel>.eyebrow{color:#a7735d;font-size:10px}.solar-clock{font-family:Georgia,'Times New Roman',serif;font-size:65px;line-height:1.2;color:#3b5348;letter-spacing:-.045em}.solar-clock span{display:block;font-size:11px;letter-spacing:.2em;margin-top:7px;color:#929780}.clock-caption{font-size:10px;color:var(--muted);margin-top:14px;line-height:1.8}
.time-slider-block{margin-top:27px}.time-slider-block label{display:flex;justify-content:space-between;font-size:12px}.time-slider-block label span{font-size:10px;color:var(--muted)}.time-slider-block input{display:block;width:100%;accent-color:#947b51;cursor:ew-resize;height:3px;margin:19px 0 12px}.slider-hours{display:flex;justify-content:space-between;font-size:9px;color:#989b88;font-family:Georgia,serif}
.dial-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:22px}.play-day{display:flex;align-items:center;gap:8px;border:1px solid #c7c6b4;padding:7px 11px;font-size:11px}.play-day span{font-size:17px;line-height:1}.play-day:hover{border-color:#7d927c;background:#e7e8dc}.dial-actions>.text-link{font-size:10px}.dial-readings{display:flex;gap:17px;margin:24px 0 0;padding-top:19px;border-top:1px solid var(--line);flex-wrap:wrap}.dial-readings dt{font-size:10px;color:#989b88}.dial-readings dd{margin:3px 0 0;font-size:15px;white-space:nowrap}.dial-readings dd small{font-size:11px}.dial-state-note{font-size:10px;line-height:1.8;color:#929782;min-height:36px;margin-top:16px}
.dial-season-compare{display:grid;grid-template-columns:1fr auto;column-gap:30px;padding:26px 0;border-block:1px solid var(--line)}.dial-season-compare h2{font-size:24px}.dial-season-compare .eyebrow{font-size:10px;margin-bottom:7px}.season-choices{display:flex;gap:10px;align-items:center}.season-choices button{display:grid;gap:4px;min-width:84px;padding:10px 14px;border:1px solid transparent;color:#8c957f}.season-choices button span{font-size:15px;letter-spacing:.1em}.season-choices button small{font-size:10px}.season-choices button.active{border-color:#aeb69e;background:#e7e9dc;color:#3c5848}.season-choices button:hover{background:#ebeade}.dial-season-compare>p{grid-column:1/-1;font-size:11px;color:var(--muted);margin-top:15px}.dial-explanation{margin-top:24px}.dial-explanation a{display:block;margin-top:15px}
.gnomon-reference{margin-top:26px;border-bottom:1px solid var(--line)}.gnomon-reference summary{display:flex;align-items:center;gap:20px;padding:17px 0;cursor:pointer;list-style:none;font-size:13px}.gnomon-reference summary::-webkit-details-marker{display:none}.gnomon-reference summary small{font-size:10px;color:var(--muted)}.reference-plus{margin-left:auto;color:#8d9782}.gnomon-reference[open] .reference-plus{transform:rotate(45deg)}
@media(max-width:1100px){.dial-experience{grid-template-columns:minmax(0,1.9fr) minmax(230px,1fr);gap:2%}.solar-clock{font-size:53px}.dial-time-panel{padding-left:18px}.dial-readings{gap:12px}.dial-season-compare{grid-template-columns:1fr}.season-choices{margin-top:18px}.season-choices button{flex:1}.dial-visual-note{margin-top:14px;font-size:9px}}
@media(max-width:760px){.dial-toolbar{flex-wrap:wrap;gap:9px 18px}.dial-toolbar>.fine-print{font-size:9px}.dial-experience{grid-template-columns:1fr;padding-top:25px}.dial-visual{padding-top:25px}.dial-season{top:0;left:0}.dial-time-panel{border-left:0;border-top:1px solid var(--line);padding:23px 0 0;margin-top:23px;display:grid;grid-template-columns:1fr 1fr;gap:0 22px}.dial-time-panel>.eyebrow,.solar-clock,.clock-caption{grid-column:1}.time-slider-block{grid-column:2;grid-row:1/4;align-self:center;margin:0}.dial-actions{grid-column:1/-1;margin-top:20px;justify-content:flex-start;gap:25px}.dial-readings{grid-column:1/-1}.dial-state-note{grid-column:1/-1;min-height:0}.solar-clock{font-size:48px}.dial-season-compare h2{font-size:22px}.season-choices{gap:3px}.season-choices button{min-width:0;padding:10px 7px}.gnomon-reference summary{gap:12px}.gnomon-reference summary small{max-width:155px;font-size:9px}}
</style>
