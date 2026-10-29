<script setup>
import { computed, ref, watch } from 'vue'
import LinkedRecords from './LinkedRecords.vue';
import YearSlider from './YearSlider.vue';

const props = defineProps({
  term: { type: Object, required: true },
  terms: { type: Array, default: () => [] },
  region: { type: String, default: 'both' },
})

const emit = defineEmits(['select-term', 'update:region', 'open-detail', 'open-source'])

const filters = [
  { value: 'both', label: '南北并列' },
  { value: 'north', label: '只看北方' },
  { value: 'south', label: '只看南方' },
]
const tracks = [
  { id: 'north-1', region: 'north', label: '北方案例 一', group: '北方', number: '壹' },
  { id: 'north-2', region: 'north', label: '北方案例 二', group: '北方', number: '贰' },
  { id: 'south-1', region: 'south', label: '南方案例 一', group: '南方', number: '壹' },
  { id: 'south-2', region: 'south', label: '南方案例 二', group: '南方', number: '贰' },
]
const selectedTrackId = ref('north-1')
const visibleTracks = computed(() => tracks.filter(track => props.region === 'both' || track.region === props.region))
const selectedTrack = computed(() => visibleTracks.value.find(track => track.id === selectedTrackId.value) || visibleTracks.value[0])
const selectedIndex = computed(() => props.terms.findIndex(item => item.id === props.term.id))

watch(() => props.region, () => {
  if (!visibleTracks.value.some(track => track.id === selectedTrackId.value)) {
    selectedTrackId.value = visibleTracks.value[0]?.id || ''
  }
})

function moveTerm(offset) {
  if (!props.terms.length) return
  const index = (Math.max(selectedIndex.value, 0) + offset + props.terms.length) % props.terms.length
  emit('select-term', props.terms[index].id)
}
</script>

<template>
  <section class="farm-view" aria-labelledby="farm-heading">
    <header class="chapter-heading">
      <div>
        <p class="chapter-kicker">第二篇 · 田间的一年</p>
        <h1 id="farm-heading">农事长卷<span class="title-mark">时序</span></h1>
        <p class="chapter-intro">循着节气读农时，沿着作物看一年。每一条轨道，都将对应一处地域、一组可追溯的记载。</p>
      </div>
      <div class="chapter-number" aria-hidden="true">贰<span>卷</span></div>
    </header>

    <div class="reading-bar">
      <div class="current-time">
        <span class="small-label">时序定位</span>
        <button type="button" class="step-button" aria-label="上一节气" @click="moveTerm(-1)">‹</button>
        <strong>{{ term.name }}</strong>
        <button type="button" class="step-button" aria-label="下一节气" @click="moveTerm(1)">›</button>
      </div>
      <div class="region-filter" role="group" aria-label="农事地域筛选">
        <button v-for="filter in filters" :key="filter.value" type="button" :class="{ active: region === filter.value }" :aria-pressed="region === filter.value" @click="emit('update:region', filter.value)">{{ filter.label }}</button>
      </div>
    </div>

    <YearSlider />
    <LinkedRecords />
    <section class="scroll-sheet" aria-labelledby="annual-heading">
      <div class="sheet-heading">
        <div>
          <span class="small-label">全年农事索引</span>
          <h2 id="annual-heading">二十四节气，连缀田间时序</h2>
        </div>
        <span class="record-status"><i></i>案例资料待收录</span>
      </div>

      <div class="timeline-scroll" tabindex="0" aria-label="全年农事长卷，可横向滚动">
        <div class="timeline">
          <div class="timeline-head">
            <div class="track-label axis-label">地域 · 作物<span>点击节气选择时段</span></div>
            <div class="term-columns">
              <button v-for="item in terms" :key="item.id" type="button" class="term-column" :class="[{ selected: item.id === term.id }, item.season]" :aria-pressed="item.id === term.id" :aria-label="`选择${item.name}`" @click="emit('select-term', item.id)">
                <span>{{ item.name }}</span><i aria-hidden="true"></i>
              </button>
            </div>
          </div>

          <div v-for="track in visibleTracks" :key="track.id" class="track-row" :class="[track.region, { 'track-selected': selectedTrack?.id === track.id }]">
            <button type="button" class="track-label track-select" :aria-pressed="selectedTrack?.id === track.id" @click="selectedTrackId = track.id">
              <span class="track-region">{{ track.group }}<span>{{ track.number }}</span></span>
              <strong>{{ track.label }}</strong>
              <span class="track-subtitle">具体地域与作物待选</span>
            </button>
            <button type="button" class="track-plot" :aria-label="`查看${track.label}，案例资料待补充`" @click="selectedTrackId = track.id">
              <span v-for="item in terms" :key="item.id" class="plot-cell" :class="{ selected: item.id === term.id }" aria-hidden="true"></span>
              <span class="empty-track-label">尚未收录农事事件</span>
            </button>
          </div>

          <div class="timeline-foot">
            <span>立春开篇</span>
            <div><span>春</span><span>夏</span><span>秋</span><span>冬</span></div>
          </div>
        </div>
      </div>

      <p class="axis-note">横轴按节气次序等距排列，不表示相同的公历天数。留白表示资料尚未收录。</p>
    </section>

    <div class="farm-bottom">
      <section class="case-panel" aria-labelledby="case-heading">
        <div class="case-title">
          <div><p class="small-label">当前案例</p><h2 id="case-heading">{{ selectedTrack?.label || '选择一条轨道' }}</h2></div>
          <span class="outline-tag">待选题 · 待核验</span>
        </div>
        <p class="case-description">这里将呈现一处地域中，某种作物沿一年的农事过程。目前保留轨道，等待有来源的资料入卷。</p>
        <dl class="case-facts">
          <div><dt>具体地域</dt><dd>尚未选定</dd></div>
          <div><dt>作物与时期</dt><dd>尚未选定</dd></div>
          <div><dt>农事阶段</dt><dd>尚未收录</dd></div>
          <div><dt>文献依据</dt><dd>尚未核验</dd></div>
        </dl>
        <div class="case-actions">
          <button type="button" class="text-button" @click="emit('open-source', `${selectedTrack?.label || '农事案例'} · 资料依据`)">查看资料说明 <span aria-hidden="true">↗</span></button>
          <button type="button" class="text-button" @click="emit('open-detail')">阅读{{ term.name }} <span aria-hidden="true">→</span></button>
        </div>
      </section>

      <aside class="reading-note" aria-labelledby="reading-note-heading">
        <p class="small-label">读卷小引</p>
        <h2 id="reading-note-heading">横看一年，纵看一时</h2>
        <div class="note-item"><span>一</span><p><strong>按节气读</strong>点击上方节气，时间指针随之移动，其他篇章也保留这一选择。</p></div>
        <div class="note-item"><span>二</span><p><strong>按案例读</strong>选择一条轨道，查看其地域、作物与资料状态。后续事件将沿轨道逐步收录。</p></div>
        <p class="note-foot">农事有地域与年代之别，每条记载都将保留自己的适用范围。</p>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.farm-view { --north: #987957; --south: #4e7d72; color: var(--ink, #253d38); padding: 10px 0 30px; font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", SimSun, serif; }
.farm-view, .farm-view * { box-sizing: border-box; }
button { font: inherit; }
button:focus-visible, .timeline-scroll:focus-visible { outline: 2px solid var(--accent, #ae5544); outline-offset: 4px; }
.chapter-heading { display: flex; justify-content: space-between; gap: 32px; margin-bottom: 35px; }
.chapter-kicker, .small-label { color: var(--muted, #798079); font-size: 11px; letter-spacing: .18em; }
.chapter-kicker { margin: 0 0 14px; }
h1 { display: flex; align-items: center; gap: 18px; margin: 0; font-size: clamp(30px, 3.2vw, 43px); font-weight: 500; letter-spacing: .09em; }
.title-mark { padding: 5px 5px 4px; border: 1px solid var(--accent, #ae5544); color: var(--accent, #ae5544); font-size: 11px; line-height: 1.3; letter-spacing: .15em; writing-mode: vertical-rl; }
.chapter-intro { max-width: 720px; margin: 17px 0 0; font-size: 13px; line-height: 1.9; color: #69746c; }
.chapter-number { margin-right: 4px; font-size: 54px; line-height: 1; color: #d5d7cc; font-weight: 400; }
.chapter-number span { display: block; margin-top: 9px; text-align: center; font-size: 11px; letter-spacing: .3em; }
.reading-bar { display: flex; align-items: center; justify-content: space-between; gap: 20px; border-top: 1px solid var(--line, #d9d6ca); padding: 17px 0; }
.current-time { display: flex; align-items: center; gap: 15px; }
.current-time .small-label { margin-right: 10px; }
.current-time strong { font-size: 19px; font-weight: 500; letter-spacing: .15em; }
.step-button { width: 25px; height: 29px; border: 0; background: transparent; color: #748176; cursor: pointer; font-family: sans-serif; font-size: 23px; }
.step-button:hover { color: var(--accent, #ae5544); }
.region-filter { display: flex; gap: 3px; background: #eae9df; padding: 3px; }
.region-filter button { border: 0; padding: 8px 14px; background: transparent; color: #738075; font-size: 12px; cursor: pointer; }
.region-filter button.active { color: var(--ink, #253d38); background: #faf8f0; box-shadow: 0 1px 3px #253d380b; }
.scroll-sheet { border: 1px solid var(--line, #d9d6ca); background: #fbfaf575; }
.sheet-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 24px 25px 21px; }
.sheet-heading h2 { font-size: 18px; font-weight: 500; letter-spacing: .06em; margin: 9px 0 0; }
.record-status { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--muted, #798079); white-space: nowrap; }
.record-status i { display: inline-block; height: 5px; width: 5px; background: #b3b6a9; border-radius: 50%; }
.timeline-scroll { overflow-x: auto; }
.timeline { min-width: 850px; }
.timeline-head, .track-row { display: grid; grid-template-columns: 166px minmax(0, 1fr); }
.timeline-head { border-top: 1px solid var(--line, #d9d6ca); border-bottom: 1px solid var(--line, #d9d6ca); }
.track-label { padding: 17px 20px; text-align: left; border: 0; border-right: 1px solid var(--line, #d9d6ca); }
.axis-label { display: flex; justify-content: center; flex-direction: column; font-size: 12px; color: #68756b; }
.axis-label span { display: block; margin-top: 8px; font-size: 10px; color: #91968b; }
.term-columns { display: grid; grid-template-columns: repeat(24, minmax(0, 1fr)); }
.term-column { display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 10px; border: 0; border-right: 1px solid #d9d6ca70; padding: 15px 1px 9px; color: #6f7b70; background: transparent; cursor: pointer; }
.term-column span { writing-mode: vertical-rl; letter-spacing: .13em; font-size: 12px; }
.term-column i { height: 3px; width: 3px; background: #b9bfb0; border-radius: 50%; }
.term-column:hover { color: var(--accent, #ae5544); background: #ae554407; }
.term-column.selected { color: var(--accent, #ae5544); background: #ae55440d; }
.term-column.selected i { background: var(--accent, #ae5544); }
.track-row { border-bottom: 1px solid #d9d6ca8c; }
.track-select { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; background: transparent; cursor: pointer; min-height: 102px; }
.track-select:hover, .track-selected .track-select { background: #253d3805; }
.track-region { display: flex; gap: 8px; align-items: center; font-size: 10px; color: var(--north); letter-spacing: .14em; }
.south .track-region { color: var(--south); }
.track-region span { display: inline-block; border-left: 1px solid currentColor; padding-left: 8px; opacity: .65; }
.track-select strong { font-size: 13px; font-weight: 500; }
.track-subtitle { font-size: 10px; color: #90988e; }
.track-plot { position: relative; display: grid; grid-template-columns: repeat(24, minmax(0, 1fr)); align-items: stretch; border: 0; background: transparent; padding: 0; cursor: pointer; min-height: 102px; }
.plot-cell { border-right: 1px solid #d9d6ca56; }
.plot-cell.selected { background: #ae554407; border-left: 1px solid #ae554430; border-right: 1px solid #ae554430; }
.empty-track-label { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); padding: 7px 16px; background: #f7f6ef; color: #9a9f94; font-size: 11px; letter-spacing: .13em; white-space: nowrap; }
.track-selected .empty-track-label { color: #7b877b; }
.track-selected .track-select { box-shadow: inset 3px 0 var(--north); }
.track-selected.south .track-select { box-shadow: inset 3px 0 var(--south); }
.timeline-foot { display: grid; grid-template-columns: 166px minmax(0, 1fr); padding: 13px 0; color: #899181; font-size: 10px; letter-spacing: .2em; }
.timeline-foot > span { padding-left: 20px; }
.timeline-foot > div { display: grid; grid-template-columns: repeat(4, 1fr); text-align: center; }
.axis-note { margin: 0; padding: 14px 24px; border-top: 1px solid var(--line, #d9d6ca); font-size: 10px; line-height: 1.8; color: #899184; }
.farm-bottom { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 32px; margin-top: 32px; }
.case-panel { border: 1px solid var(--line, #d9d6ca); padding: 24px 26px; background: #fbfaf550; }
.case-title { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.case-title .small-label { margin: 0 0 9px; }
.case-title h2 { font-size: 21px; font-weight: 500; margin: 0; letter-spacing: .07em; }
.outline-tag { border: 1px solid #d3d7ca; color: #87907e; padding: 5px 8px; font-size: 10px; white-space: nowrap; }
.case-description { color: #7a8477; font-size: 12px; line-height: 1.9; margin: 18px 0; max-width: 540px; }
.case-facts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px 28px; margin: 0 0 22px; }
.case-facts div { border-bottom: 1px solid #d9d6ca8c; padding-bottom: 9px; }
.case-facts dt { color: #8a9386; font-size: 10px; margin-bottom: 7px; }
.case-facts dd { margin: 0; font-size: 12px; color: #69776a; }
.case-actions { display: flex; justify-content: space-between; gap: 16px; }
.text-button { border: 0; background: transparent; color: #647468; font-size: 11px; padding: 4px 0; cursor: pointer; text-align: left; }
.text-button:hover { color: var(--accent, #ae5544); }
.text-button span { margin-left: 8px; }
.reading-note { padding: 8px 4px 0; }
.reading-note > .small-label { margin: 0 0 11px; }
.reading-note h2 { margin: 0 0 24px; font-size: 23px; font-weight: 500; letter-spacing: .08em; }
.note-item { display: flex; align-items: flex-start; gap: 14px; margin: 0 0 17px; }
.note-item > span { width: 26px; height: 26px; flex: 0 0 26px; display: grid; place-items: center; border: 1px solid #c8cebd; color: #7c8a73; font-size: 12px; }
.note-item p { margin: 0; color: #7c8678; font-size: 12px; line-height: 1.9; }
.note-item strong { display: block; color: #4b6254; font-weight: 500; margin: 0 0 3px; }
.note-foot { margin: 22px 0 0 40px; color: #909889; font-size: 10px; line-height: 1.8; }
@media (max-width: 900px) {
  .farm-bottom { grid-template-columns: 1fr; gap: 24px; }
  .reading-note { padding: 0 4px; }
  .chapter-intro { max-width: 570px; }
}
@media (max-width: 600px) {
  .chapter-heading { gap: 14px; margin-bottom: 24px; }
  .chapter-number { font-size: 40px; }
  .chapter-intro { font-size: 12px; }
  .reading-bar { align-items: flex-start; flex-direction: column; gap: 12px; }
  .region-filter { align-self: stretch; }
  .region-filter button { flex: 1; }
  .sheet-heading { align-items: flex-start; flex-direction: column; gap: 14px; padding: 20px; }
  .sheet-heading h2 { font-size: 16px; }
  .case-panel { padding: 20px; }
  .case-title { align-items: flex-start; flex-direction: column; gap: 12px; }
  .case-facts { gap: 15px; }
}
</style>
