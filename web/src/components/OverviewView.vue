<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import SeasonWheel from './SeasonWheel.vue';
import SundialDiagram from './SundialDiagram.vue';
import SundialFallback from './SundialFallback.vue';
import { savedObservation } from '../state/observation.js';
import { noonPreview } from '../lib/astro/observation.js';
import YearSlider from './YearSlider.vue';
import HouSection from './HouSection.vue';
import HouIllustration from './HouIllustration.vue';
import LinkedRecords from './LinkedRecords.vue';
import UiIcon from './UiIcon.vue';
import { year } from '../state/year.js';
import { motionPreferences } from '../core/loop.js';

const props = defineProps({ term: Object, terms: Array, region: String, previewLongitude: { type: Number, default: null } });
const emit = defineEmits(['select-term', 'update:region', 'navigate', 'open-detail', 'open-source', 'preview', 'preview-end']);
const route = useRoute();
const actualNoon = computed(() => noonPreview(savedObservation.value,props.term.id));
const regions = computed(() => props.region === 'both' ? ['north', 'south'] : [props.region]);
const sheetHeading = ref(null);
const readButton = ref(null);
let sheetTrigger;
const chapters = [
  { id: 'farm', no: '贰', title: '循农事，看一年', sub: '沿时间追踪作物与地域', icon: 'book' },
  { id: 'sky', no: '叁', title: '观日影，识天时', sub: '拨动日晷，观察一日光影', icon: 'sun' },
  { id: 'ancient', no: '肆', title: '读古图，寻其源', sub: '从历史图像走入授时智慧', icon: 'book' },
];
watch(() => year.state.panelOpen, async open => {
  if (route.name !== 'overview') return;
  if (open) {
    sheetTrigger = document.activeElement;
    await nextTick();
    sheetHeading.value?.focus();
  } else {
    await nextTick();
    const target = sheetTrigger?.isConnected && !sheetTrigger.closest('[inert]') ? sheetTrigger : readButton.value;
    target?.focus();
  }
});
function readHou() {
  document.getElementById('overview-hou')?.scrollIntoView({ behavior: motionPreferences.reduced.value ? 'auto' : 'smooth', block: 'start' });
}
</script>

<template>
  <section class="overview-page">
    <div class="overview-heading">
      <div><p class="eyebrow"><span class="eyebrow-line"></span>岁时流转 · 万物有序</p><h1>转动一年，<em>读懂天时。</em></h1><p class="hero-intro">从一轮节气出发，走进物候、田野与日影。</p></div>
      <div class="hero-index" aria-label="二十四节气，七十二候"><div><strong>二十四</strong><span>节气为序</span></div><i></i><div><strong>七十二</strong><span>观物知时</span></div></div>
    </div>

    <div class="overview-layout" :class="{ 'is-layer-open': year.state.panelOpen }">
      <section class="wheel-section" aria-label="二十四节气交互转盘">
        <div class="wheel-caption"><span><b>01</b> 授时转盘</span><span>立春开篇 · 一岁一周</span></div>
        <SeasonWheel :term="term" :terms="terms" @open-sky="emit('navigate', 'sky')" />
      </section>

      <aside class="term-panel" aria-label="当前节气札记">
        <div class="layer-summary" :class="{ 'is-covered': year.state.panelOpen }" :inert="year.state.panelOpen">
          <div class="panel-kicker"><span><i></i>当令札记</span><span>{{ term.season }}季 · 第{{ String(term.index + 1).padStart(2, '0') }}气</span></div>
          <div class="current-heading"><h2>{{ term.name }}</h2><span class="longitude-stamp">太阳黄经<strong>{{ term.longitude }}<small>°</small></strong></span></div>
          <div class="hou-summary-heading"><span>一气三候</span><small>候名初稿 · 底本待校</small></div>
          <div class="hou-row"><button v-for="(hou, i) in term.hou" :key="hou.id" :class="{ active: year.hou.value?.id === hou.id }" :aria-pressed="year.hou.value?.id === hou.id" @click="year.selectHou(term.id, i); year.setPanel(true)"><small>{{ ['初候', '二候', '三候'][i] }}</small><span>{{ hou.name }}</span><UiIcon name="arrow-up-right" /></button></div>

          <section class="farm-summary">
            <div class="panel-title"><h3>此时农事</h3><div class="region-switch" role="group" aria-label="农事区域"><button v-for="item in [{ id: 'both', label: '南北' }, { id: 'north', label: '北方' }, { id: 'south', label: '南方' }]" :key="item.id" :class="{ active: region === item.id }" :aria-pressed="region === item.id" @click="emit('update:region', item.id)">{{ item.label }}</button></div></div>
            <div class="region-summaries"><div v-for="item in regions" :key="item" class="region-summary"><span class="region-mark" :class="item">{{ item === 'north' ? '北' : '南' }}</span><div><strong>{{ item === 'north' ? '北方案例' : '南方案例' }}</strong><p>地域、作物与农事记录待补充</p></div></div></div>
            <button class="text-link" @click="emit('navigate', 'farm')">展开农事长卷 <UiIcon name="arrow-right" /></button>
          </section>

          <section class="shadow-preview">
            <div class="panel-title"><h3>日晷识时</h3><span class="pending-label">{{ year.moving.value ? '流转预览' : '正午预览' }}</span></div>
            <div class="overview-dial-row"><SundialFallback v-if="actualNoon" :solar="actualNoon" :latitude="savedObservation.place.latitude" compact /><SundialDiagram v-else-if="!savedObservation" :longitude="previewLongitude ?? term.longitude" :solar-time="12" compact :show-paths="false" /><div class="shadow-reading"><small>真太阳时 · 12:00</small><strong>午正预览</strong><span>{{ savedObservation ? savedObservation.place.name : '纬度35°N · 几何演示' }}</span><span v-if="savedObservation && !actualNoon?.shadow">此条件下无可读日影</span><button class="text-link" @click="emit('navigate', 'sky')">拨动一日时光 <UiIcon name="arrow-right" /></button></div></div>
          </section>
          <button ref="readButton" class="detail-link" :aria-expanded="year.state.panelOpen" aria-controls="term-reading-sheet" @click="year.setPanel(true)"><span>细读{{ term.name }}<small>候象 · 农谚 · 节气档案</small></span><UiIcon name="arrow-up-right" /></button>
        </div>

        <Transition name="term-sheet">
          <section v-if="year.state.panelOpen" id="term-reading-sheet" class="term-deep-layer" aria-label="当令候象与农谚">
            <div class="deep-layer-heading"><div><p class="eyebrow">当令细读 · {{ term.season }}季</p><h2 ref="sheetHeading" tabindex="-1">{{ term.name }}</h2></div><button class="quiet-button" @click="year.setPanel(false); year.clearFocus()">收起 <UiIcon name="close" /></button></div>
            <div class="deep-layer-hou"><HouIllustration :hou="year.hou.value" :playing="!year.moving.value" /><div><small>{{ ['初候', '二候', '三候'][year.hou.value?.order] }} · 候名初稿</small><strong>{{ year.hou.value?.name }}</strong><div class="deep-hou-choices"><button v-for="hou in term.hou" :key="hou.id" :aria-pressed="year.hou.value?.id === hou.id" @click="year.selectHou(term.id, hou.order)">{{ hou.name }}</button></div></div></div>
            <LinkedRecords compact />
            <div class="deep-layer-dial"><SundialDiagram :longitude="year.longitude.value" :solar-time="12" compact :show-paths="false" /><span>日晷随转盘联动<small>真太阳时 · 午正</small></span><button class="text-link" @click="emit('navigate', 'sky')">观天测影 <UiIcon name="arrow-right" /></button></div>
            <button class="detail-link" @click="emit('open-detail')"><span>进入{{ term.name }}的节气档案</span><UiIcon name="arrow-up-right" /></button>
          </section>
        </Transition>
      </aside>
    </div>

    <div class="overview-continuation"><span>转盘、候象与日影，共读同一个节气。</span><button class="text-link" @click="readHou">向下读三候 <UiIcon name="chevron-down" /></button></div>
    <YearSlider />
    <HouSection id="overview-hou" />
    <div class="chapter-links"><button v-for="item in chapters" :key="item.id" @click="emit('navigate', item.id)"><span class="chapter-number">{{ item.no }}</span><div><strong>{{ item.title }}</strong><p>{{ item.sub }}</p></div><UiIcon class="chapter-arrow" name="arrow-up-right" /></button></div>
  </section>
</template>

<style scoped>
.overview-heading { margin: 34px 0 28px; }
.overview-heading .eyebrow { display: flex; align-items: center; gap: 10px; }
.eyebrow-line { width: 26px; height: 1px; background: var(--accent); }
.hero-intro { margin-top: 12px; color: var(--muted); font-size: 14px; letter-spacing: .07em; }
.hero-index { display: flex; align-items: center; gap: 24px; padding-bottom: 4px; }
.hero-index div { display: grid; gap: 6px; text-align: center; }
.hero-index strong { font: 26px var(--font-display); letter-spacing: .13em; }
.hero-index span { font-size: 12px; color: var(--muted); letter-spacing: .17em; }
.hero-index i { height: 34px; width: 1px; background: var(--line); }
.overview-layout { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(350px, 1fr); gap: clamp(24px, 4vw, 64px); align-items: start; }
.wheel-section { min-width: 0; padding-top: 44px; position: relative; }
.wheel-caption { position: absolute; inset: 0 8px auto; display: flex; justify-content: space-between; color: var(--muted); font-size: 12px; letter-spacing: .08em; }
.wheel-caption b { font: 12px var(--font-number); color: var(--accent); margin-right: 9px; }
.wheel-section .season-wheel { max-width: 760px; transition: transform .45s var(--ease-out); }
.term-panel { position: sticky; top: 24px; margin-top: 38px; padding: 26px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); min-width: 0; }
.panel-kicker { display: flex; justify-content: space-between; align-items: center; gap: 12px; color: var(--muted); font-size: 12px; }
.panel-kicker>span:first-child { display: flex; align-items: center; gap: 8px; letter-spacing: .12em; }
.panel-kicker i { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); }
.current-heading { display: flex; justify-content: space-between; align-items: center; margin: 22px 0 26px; }
.current-heading h2 { font-size: clamp(44px, 4vw, 60px); line-height: 1.15; letter-spacing: .12em; }
.longitude-stamp { color: var(--muted); font-size: 12px; text-align: right; }
.longitude-stamp strong { display: block; color: var(--ink); font: 34px/1.3 var(--font-number); margin-top: 3px; }
.longitude-stamp small { font-size: 20px; }
.hou-summary-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; font-size: 13px; }
.hou-summary-heading small { color: var(--muted); font-size: 11px; }
.hou-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.hou-row button { position: relative; min-height: 84px; text-align: left; padding: 11px 10px; background: var(--surface-muted); border: 1px solid transparent; border-radius: var(--radius-sm); }
.hou-row button.active { background: var(--accent-soft); border-color: var(--accent-line); }
.hou-row button:hover { border-color: var(--accent); }
.hou-row small { display: block; font-size: 11px; color: var(--accent); margin-bottom: 8px; }
.hou-row span { display: block; font: 14px/1.6 var(--font-display); overflow-wrap: anywhere; }
.hou-row .ui-icon { position: absolute; top: 11px; right: 8px; width: 13px; height: 13px; color: var(--muted); }
.farm-summary { margin-top: 24px; padding-bottom: 18px; border-bottom: 1px solid var(--line); }
.panel-title { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.panel-title h3 { font-size: 17px; }
.region-switch { display: flex; padding: 3px; gap: 2px; border-radius: var(--radius-sm); background: var(--surface-muted); }
.region-switch button { min-width: 40px; min-height: 32px; font-size: 12px; padding: 3px 7px; border-radius: 3px; color: var(--muted); }
.region-switch button.active { background: var(--surface); color: var(--green); box-shadow: 0 1px 4px #243e3614; }
.region-summaries { margin: 16px 0 10px; display: grid; gap: 14px; }
.region-summary { display: flex; gap: 12px; align-items: center; }
.region-mark { display: grid; place-items: center; width: 32px; height: 36px; border: 1px solid var(--line); color: #795e3e; font: 16px var(--font-display); flex: none; }
.region-mark.south { color: var(--green); }
.region-summary strong { font-size: 13px; font-weight: 500; }
.region-summary p { color: var(--muted); font-size: 11px; margin-top: 3px; }
.farm-summary>.text-link { width: 100%; justify-content: space-between; }
.shadow-preview { padding-top: 18px; }
.overview-dial-row { display: flex; align-items: center; gap: 12px; min-height: 110px; margin: 4px 0 12px; }
.overview-dial-row>.sundial-object { width: 53%; flex: none; }
.shadow-reading { display: grid; gap: 4px; min-width: 0; }
.shadow-reading>small, .shadow-reading>span { font-size: 11px; color: var(--muted); }
.shadow-reading strong { font: 27px var(--font-display); letter-spacing: .15em; }
.shadow-reading .text-link { font-size: 12px; white-space: nowrap; }
.term-panel .detail-link { display: flex; width: 100%; align-items: center; justify-content: space-between; padding: 13px 16px; min-height: 52px; background: var(--ink); color: var(--paper); border-radius: var(--radius-sm); text-align: left; font-size: 15px; }
.detail-link small { display: block; font-size: 10px; color: #dae1d7; margin-top: 3px; letter-spacing: .06em; }
.term-panel .detail-link:hover { background: var(--green); }
.layer-summary { transition: opacity .18s; }
.layer-summary.is-covered { opacity: 0; pointer-events: none; }
.term-deep-layer { position: absolute; inset: 0; display: flex; flex-direction: column; min-height: 100%; background: var(--surface); border-radius: var(--radius-lg); padding: 24px; z-index: 2; }
.deep-layer-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.deep-layer-heading h2 { font-size: 38px; }
.deep-layer-heading .eyebrow { margin-bottom: 4px; }
.deep-layer-hou { display: flex; gap: 12px; align-items: center; border-bottom: 1px solid var(--line); padding: 10px 0; }
.deep-layer-hou>.hou-art { width: 36%; flex: none; max-height: 112px; }
.deep-layer-hou>div { min-width: 0; }
.deep-layer-hou small { color: var(--muted); font-size: 11px; }
.deep-layer-hou strong { display: block; font: 21px/1.5 var(--font-display); margin: 6px 0; }
.deep-hou-choices { display: flex; flex-wrap: wrap; gap: 5px; }
.deep-hou-choices button { padding: 5px 8px; min-height: 34px; font-size: 11px; border: 1px solid var(--line); border-radius: 3px; }
.deep-hou-choices button[aria-pressed=true] { color: var(--accent); border-color: var(--accent-line); background: var(--accent-soft); }
.term-deep-layer>.linked-records { flex: 1; min-height: 150px; overflow: auto; margin: 14px 0; }
.deep-layer-dial { display: flex; align-items: center; gap: 10px; border-top: 1px solid var(--line); padding: 6px 0; }
.deep-layer-dial>.sundial-object { width: 38%; flex: none; max-height: 92px; }
.deep-layer-dial>span { font-size: 11px; }
.deep-layer-dial small { display: block; color: var(--muted); font-size: 10px; }
.deep-layer-dial>.text-link { margin-left: auto; font-size: 11px; white-space: nowrap; }
.term-sheet-enter-active { transition: opacity .2s, transform .3s var(--ease-out); }
.term-sheet-leave-active { transition: opacity .15s; }
.term-sheet-enter-from { opacity: 0; transform: translateX(16px); }
.term-sheet-leave-to { opacity: 0; }
.overview-continuation { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 24px 0 20px; font-size: 12px; color: var(--muted); }
.overview-page>.year-slider { margin: 0 0 40px; }
@media(min-width:1600px) { .term-panel { margin-top: 56px; padding: 30px; } }
@media(max-width:1100px) { .overview-layout { grid-template-columns: minmax(0, 1.25fr) minmax(320px, 1fr); gap: 24px; } .term-panel { padding: 20px; } .hero-index { gap: 16px; } .hero-index strong { font-size: 23px; } }
@media(max-width:800px) { .overview-heading { margin: 28px 0 24px; } .overview-layout { grid-template-columns: 1fr; gap: 20px; } .wheel-section { width: 100%; max-width: 700px; margin: auto; } .term-panel { position: relative; top: auto; margin-top: 0; padding: 24px; } .current-heading { margin: 20px 0; } .hero-index { display: none; } .term-deep-layer { padding: 24px; } }
@media(max-width:480px) { .hero-intro { font-size: 13px; letter-spacing: 0; } .wheel-section { padding-top: 38px; } .wheel-caption { font-size: 11px; inset-inline: 0; } .term-panel { padding: 20px; } .term-deep-layer { padding: 20px; } .overview-continuation { flex-wrap: wrap; gap: 4px; } .deep-layer-hou strong { font-size: 18px; } .deep-layer-dial { flex-wrap: wrap; } .deep-layer-dial>.text-link { margin-left: 0; } .hou-row span { font-size: 14px; } }
</style>
