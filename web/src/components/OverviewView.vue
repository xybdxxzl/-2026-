<script setup>
import { computed } from 'vue';
import SeasonWheel from './SeasonWheel.vue';
import SundialDiagram from './SundialDiagram.vue';
import YearSlider from './YearSlider.vue';
import HouSection from './HouSection.vue';
import HouIllustration from './HouIllustration.vue';
import LinkedRecords from './LinkedRecords.vue';
import { year } from '../state/year.js';
const props = defineProps({ term: Object, terms: Array, region: String, previewLongitude: { type: Number, default: null } });
const emit = defineEmits(['select-term','update:region','navigate','open-detail','open-source','preview','preview-end']);
const regions = computed(() => props.region === 'both' ? ['north','south'] : [props.region]);
</script>

<template>
  <section class="overview-page">
    <div class="overview-heading"><div><p class="eyebrow">岁时流转 · 万物有序</p><h1>转动一年，<em>读懂天时。</em></h1></div><p class="heading-note">从一轮节气出发<br>走进物候、田野与日影</p></div>
    <div class="overview-layout" :class="{'is-layer-open':year.state.panelOpen}">
      <section class="wheel-section" aria-label="二十四节气交互转盘">
        <div class="wheel-caption"><span>二十四气 · 七十二候</span><span>一岁一周</span></div>
        <SeasonWheel :term="term" :terms="terms" />
      </section>

      <aside class="term-panel">
        <div class="layer-summary" :class="{'is-covered':year.state.panelOpen}" :inert="year.state.panelOpen">
        <div class="current-heading"><div><p class="eyebrow">{{ term.season }} · 第{{ String(term.index + 1).padStart(2,'0') }}气</p><h2>{{ term.name }}</h2></div><span class="longitude-stamp">太阳黄经<strong>{{ term.longitude }}<small>°</small></strong></span></div>
        <p class="term-description">节气释义与交节日期待补充</p>
        <div class="hou-row"><button v-for="(hou,i) in term.hou" :key="hou.id" @click="year.goToAngle(term.index*15+i*5);year.setPanel(true)"><small>{{ ['初候','二候','三候'][i] }}</small><span>{{ hou.name }}</span><i>0{{ i + 1 }}</i></button></div>

        <section class="farm-summary">
          <div class="panel-title"><h3>此时农事</h3><div class="region-switch" aria-label="农事区域"><button v-for="item in [{id:'both',label:'南北'},{id:'north',label:'北方'},{id:'south',label:'南方'}]" :key="item.id" :class="{active:region===item.id}" @click="emit('update:region',item.id)">{{ item.label }}</button></div></div>
          <div class="region-summaries"><div v-for="item in regions" :key="item" class="region-summary"><span class="region-mark" :class="item">{{ item === 'north' ? '北' : '南' }}</span><div><strong>{{ item === 'north' ? '北方案例' : '南方案例' }}</strong><p>地域、作物与农事记录待补充</p></div></div></div>
          <button class="text-link" @click="emit('navigate','farm')">展开一年的农事长卷 <span>→</span></button>
        </section>

        <section class="shadow-preview">
          <div class="panel-title"><h3>日晷识时</h3><span class="pending-label">{{ year.moving.value ? '流转预览' : '正午预览' }}</span></div>
          <div class="overview-dial-row"><SundialDiagram :longitude="previewLongitude ?? term.longitude" :solar-time="12" compact :show-paths="false" /><div class="shadow-reading"><small>真太阳时</small><strong>午正</strong><span>12:00 · 纬度35°N演示</span><button class="text-link" @click="emit('navigate','sky')">拨动一日时光 →</button></div></div>
        </section>
        <button class="detail-link" @click="year.setPanel(true)">展开{{ term.name }} · 候象与农谚 <span>↗</span></button>
        </div>
        <Transition name="term-sheet"><section v-if="year.state.panelOpen" class="term-deep-layer" aria-label="当令候象与农谚"><div class="deep-layer-heading"><div><p class="eyebrow">当令细读 · {{term.season}}</p><h2>{{term.name}}</h2></div><button class="quiet-button" @click="year.setPanel(false);year.clearFocus()">收起 ×</button></div><div class="deep-layer-hou"><HouIllustration :hou="year.hou.value" :playing="!year.moving.value"/><div><small>{{['初候','二候','三候'][year.hou.value?.order]}} · 候名初稿</small><strong>{{year.hou.value?.name}}</strong><div><button v-for="hou in term.hou" :key="hou.id" :aria-pressed="year.hou.value?.id===hou.id" @click="year.goToAngle(term.index*15+hou.order*5)">{{hou.name}}</button></div></div></div><LinkedRecords compact/><div class="deep-layer-dial"><SundialDiagram :longitude="year.longitude.value" :solar-time="12" compact :show-paths="false"/><span>日晷随转盘联动<br><small>真太阳时 · 午正</small></span><button class="text-link" @click="emit('navigate','sky')">观天测影 →</button></div><button class="detail-link" @click="emit('open-detail')">进入{{term.name}}的节气档案 <span>↗</span></button></section></Transition>
      </aside>
    </div>
    <YearSlider />
    <HouSection />
    <div class="chapter-links"><button v-for="item in [{id:'farm',no:'贰',title:'循农事，看一年',sub:'沿时间追踪作物与地域'},{id:'sky',no:'叁',title:'观日影，识天时',sub:'在日影长短中理解节气'},{id:'ancient',no:'肆',title:'读古图，寻其源',sub:'从历史图像走入授时智慧'}]" :key="item.id" @click="emit('navigate',item.id)"><span class="chapter-number">{{ item.no }}</span><div><strong>{{ item.title }}</strong><p>{{ item.sub }}</p></div><span class="chapter-arrow">↗</span></button></div>
  </section>
</template>

<style scoped>
.overview-dial-row{display:flex;align-items:center;gap:12px;min-height:114px}.overview-dial-row>.sundial-object{width:58%;margin:0;flex:none}.overview-dial-row>.shadow-reading{flex:1}.overview-dial-row .shadow-reading strong{font-size:24px}@media(min-width:1100px) and (max-height:800px){.overview-dial-row{min-height:108px}.overview-dial-row>.sundial-object{width:55%}}
.term-panel{position:relative;min-height:480px}.layer-summary{transition:opacity .2s,transform .35s}.layer-summary.is-covered{opacity:0;transform:translateX(15px);pointer-events:none}.wheel-section .season-wheel{transition:transform .56s cubic-bezier(.2,.7,.25,1)}.is-layer-open .wheel-section .season-wheel{transform:translateX(-2%) scale(.87)}.term-deep-layer{position:absolute;inset:0;background:#faf8efed;padding:18px;border:1px solid #c7cdb999;border-radius:3px;overflow:auto;max-height:670px}.deep-layer-heading{display:flex;justify-content:space-between;align-items:center}.deep-layer-heading h2{font-size:36px;letter-spacing:.15em}.deep-layer-heading .eyebrow{font-size:9px;margin-bottom:4px}.deep-layer-heading button{font-size:10px}.deep-layer-hou{display:flex;gap:13px;align-items:center;border-bottom:1px solid var(--line);padding-bottom:8px}.deep-layer-hou>.hou-art{width:43%;flex:none}.deep-layer-hou>div small{font-size:9px;color:#8c947d}.deep-layer-hou>div strong{display:block;font-size:20px;font-weight:400;letter-spacing:.06em;margin:4px 0 8px}.deep-layer-hou>div button{font-size:9px;display:block;text-align:left;padding:2px 0;color:#7b8e71}.deep-layer-hou>div button[aria-pressed=true]{color:#a65e44}.deep-layer-dial{display:flex;align-items:center;gap:10px}.deep-layer-dial>.sundial-object{width:45%;flex:none}.deep-layer-dial>span{font-size:11px;white-space:nowrap}.deep-layer-dial small{font-size:8px;color:#8a927b}.deep-layer-dial>.text-link{font-size:9px;margin-left:auto;white-space:nowrap}.term-sheet-enter-active,.term-sheet-leave-active{transition:transform .42s cubic-bezier(.2,.7,.25,1),opacity .25s}.term-sheet-enter-from,.term-sheet-leave-to{transform:translateX(35px);opacity:0}.overview-page>.year-slider{margin-top:28px}@media(min-width:1100px) and (max-height:800px){.term-panel{min-height:430px}.term-deep-layer{max-height:480px}}@media(max-width:800px){.term-panel{min-height:590px}.is-layer-open .wheel-section .season-wheel{transform:scale(.94)}.term-deep-layer{inset:20px 0 0;max-height:none}}
.term-deep-layer{display:flex;flex-direction:column;overflow:hidden}.deep-layer-heading,.deep-layer-hou,.deep-layer-dial,.term-deep-layer>.detail-link{flex:none}.deep-layer-hou{min-height:88px}.deep-layer-hou>.hou-art{max-height:100px}.term-deep-layer>.linked-records{flex:1;min-height:125px;overflow:auto;margin:10px 0;padding:12px}.deep-layer-dial{min-height:80px;border-top:1px solid var(--line)}.deep-layer-dial>.sundial-object{max-height:90px}.deep-layer-dial>.sundial-object svg{max-height:90px}.term-deep-layer>.detail-link{margin-top:4px}@media(max-width:800px){.term-deep-layer>.linked-records{min-height:220px}}
</style>
