<script setup>
import { computed, ref } from 'vue';
import { year } from '../state/year.js';
import { TERMS } from '../data/terms.js';
import { ANIMATED_HOU, HOU_CAPTIONS } from '../data/hou.js';
import HouIllustration from './HouIllustration.vue';
const gallery=ref(false);
const items=computed(()=>year.term.value.hou);
const animated=TERMS.flatMap(term=>term.hou.filter(hou=>ANIMATED_HOU[hou.id]).map(hou=>({...hou,term})));
const currentKind=computed(()=>ANIMATED_HOU[year.hou.value?.id]);
function choose(term,hou){year.goToAngle(term.index*15+hou.order*5);}
</script>
<template>
  <section class="hou-section">
    <div class="hou-section-heading"><div><p class="eyebrow">一气三候 · 观物知时</p><h2>把时序，读成万物。</h2></div><button class="text-link" :aria-expanded="gallery" @click="gallery=!gallery">{{gallery?'收起':'浏览'}}十幅动态候象 {{gallery?'−':'+'}}</button></div>
    <div class="hou-cards"><button v-for="hou in items" :key="hou.id" class="hou-card" :class="{active:year.hou.value?.id===hou.id}" :aria-pressed="year.hou.value?.id===hou.id" @click="choose(year.term.value,hou)"><div class="hou-card-top"><small>{{['初候','二候','三候'][hou.order]}}</small><span>{{ANIMATED_HOU[hou.id]?'动态线描':'静态线描'}}</span></div><HouIllustration :hou="hou" :season="year.term.value.season" :playing="year.hou.value?.id===hou.id&&!year.moving.value"/><div class="hou-card-bottom"><strong>{{hou.name}}</strong><span>{{year.hou.value?.id===hou.id?'正在读候':'移到此候 →'}}</span></div></button></div>
    <p class="hou-footnote"><span>{{currentKind ? HOU_CAPTIONS[currentKind] : '以线描示意候象，点击三候卡片逐一观看。'}}</span><small>候名据团队初稿，底本待校 · 插画为艺术示意，非现代物种图鉴</small></p>
    <Transition name="hou-gallery"><div v-if="gallery" class="hou-gallery"><button v-for="item in animated" :key="item.id" @click="choose(item.term,item)"><span>{{item.name}}</span><small>{{item.term.name}} · {{['初候','二候','三候'][item.order]}}</small></button></div></Transition>
  </section>
</template>
<style scoped>
.hou-section{margin:28px 0;padding:25px 0;border-block:1px solid var(--line)}.hou-section-heading{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:20px}.hou-section-heading h2{font-size:23px}.hou-section-heading .eyebrow{font-size:10px;margin-bottom:4px}.hou-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.hou-card{min-width:0;border:1px solid #c5ceb780;border-radius:2px;background:#faf8efc9;text-align:left;padding:14px 20px;color:var(--ink);transition:transform .25s,background .25s}.hou-card:hover{transform:translateY(-3px)}.hou-card.active{border-color:#9aab8d;background:#fcfaf0}.hou-card-top,.hou-card-bottom{display:flex;align-items:center;justify-content:space-between;gap:10px}.hou-card-top small{font-size:10px;color:#a3654c;letter-spacing:.2em}.hou-card-top span{font-size:9px;color:#87927c}.hou-card-bottom strong{font-weight:400;font-size:20px;letter-spacing:.07em}.hou-card-bottom span{font-size:9px;color:#7c8a73;white-space:nowrap}.hou-footnote{display:flex;justify-content:space-between;gap:20px;margin-top:14px;font-size:11px;color:#6d7e67}.hou-footnote small{font-size:9px;color:#87907e}.hou-gallery{display:grid;grid-template-columns:repeat(5,1fr);margin-top:20px;border-top:1px solid var(--line);padding-top:12px;gap:10px}.hou-gallery button{text-align:left;padding:8px;background:#faf8ef88}.hou-gallery span{display:block;font-size:13px}.hou-gallery small{font-size:10px;color:#8c927d}.hou-gallery-enter-active,.hou-gallery-leave-active{transition:opacity .2s,transform .2s}.hou-gallery-enter-from,.hou-gallery-leave-to{opacity:0;transform:translateY(10px)}@media(max-width:900px){.hou-card{padding:10px}.hou-card-bottom{align-items:flex-start;flex-direction:column}.hou-card-bottom strong{font-size:17px}.hou-footnote{flex-direction:column;gap:6px}.hou-gallery{grid-template-columns:repeat(2,1fr)}}
</style>
