<script setup>
import { computed, ref } from 'vue'

defineProps({ term: { type: Object, required: true } })

const mode = ref('guide')
const selectedNote = ref('edition')
const modes = [
  { id: 'guide', label: '读图引导', description: '从底本、读法到图文关联，逐项建立读图线索。' },
  { id: 'explore', label: '自由探索', description: '原图接入并完成核验后，可放大局部、点击注解自由阅读。' },
  { id: 'compare', label: '古今对照', description: '分清历史原图的真实记载与本作品的现代解释。' },
]
const notes = [
  { id: 'edition', number: '一', title: '先识底本', subtitle: '图名 · 版本 · 所在卷页', body: '首先确定原图的准确图名、采用版本和所在卷页，再记录图像来源。底本尚未接入，这些信息暂留空。', fields: ['准确图名', '采用版本', '卷页与图像来源'] },
  { id: 'reading', number: '二', title: '再寻读法', subtitle: '次序 · 方向 · 图文组织', body: '依据实际原图，说明从哪里开始阅读、图文如何衔接。读图次序需经过查证，当前不预设原图的结构。', fields: ['起读位置', '阅读次序', '结构说明'] },
  { id: 'text', number: '三', title: '细读图文', subtitle: '原文 · 释读 · 不确定处', body: '原图文字将与清晰释读并列呈现。辨识不确定处会单独标注，原文与现代说明分别保留。', fields: ['原图局部', '原文释读', '核验依据'] },
  { id: 'season', number: '四', title: '联系时令', subtitle: '时序 · 节气 · 关联依据', body: '仅在原图确有对应内容并完成核验时，建立节气关联。尚未确认的对应关系不自动推定。', fields: ['对应内容', '关联节气', '对应依据'] },
]
const activeMode = computed(() => modes.find(item => item.id === mode.value))
const activeNote = computed(() => notes.find(item => item.id === selectedNote.value) || notes[0])
</script>

<template>
  <section class="ancient-view" aria-labelledby="ancient-heading">
    <header class="chapter-heading">
      <div>
        <p class="chapter-kicker">第四篇 · 图中的一年</p>
        <h1 id="ancient-heading">古图解读<span class="title-mark">溯源</span></h1>
        <p class="chapter-intro">回到作品所借鉴的历史图像。从一张图的底本、文字与读法，理解古人如何组织时序。</p>
      </div>
      <div class="chapter-number" aria-hidden="true">肆<span>卷</span></div>
    </header>

    <div class="mode-bar">
      <div class="mode-tabs" role="group" aria-label="选择古图阅读方式">
        <button v-for="item in modes" :key="item.id" type="button" :class="{ active: mode === item.id }" :aria-pressed="mode === item.id" @click="mode = item.id">{{ item.label }}</button>
      </div>
      <div class="context-label"><span>当前节气</span><strong>{{ term.name }}</strong><i></i><span>图文关联待核验</span></div>
    </div>

    <p class="mode-description" aria-live="polite">{{ activeMode.description }}</p>

    <div class="reader-layout">
      <section class="image-reader" aria-label="古图原图阅读区">
        <div class="reader-toolbar">
          <div class="viewer-label"><span class="small-label">原图阅读</span><span class="pending-label">底本待接入</span></div>
          <div class="zoom-tools" role="group" aria-label="原图缩放，接入原图后可用">
            <button type="button" disabled title="接入原图后可缩小" aria-label="缩小原图，原图接入后可用">−</button>
            <span aria-hidden="true">—</span>
            <button type="button" disabled title="接入原图后可放大" aria-label="放大原图，原图接入后可用">＋</button>
            <button type="button" class="fit-button" disabled title="接入原图后可适合窗口">适合窗口</button>
          </div>
        </div>

        <div class="image-space">
          <span class="mount-corner top-left" aria-hidden="true"></span><span class="mount-corner top-right" aria-hidden="true"></span>
          <span class="mount-corner bottom-left" aria-hidden="true"></span><span class="mount-corner bottom-right" aria-hidden="true"></span>
          <div class="image-placeholder">
            <div class="blank-folio" aria-hidden="true"><span></span></div>
            <p class="placeholder-kicker">原图留白</p>
            <h2>等待一张有据可查的原图</h2>
            <p>底本与图像来源核验完成后，<br>将在这里呈现可放大阅读的真实图像。</p>
            <span class="placeholder-foot">当前仅保留阅读位置</span>
          </div>
        </div>

        <div class="viewer-footer"><span>接入原图后可缩放、拖动与定位局部。</span><span>释读与原图分列呈现</span></div>
      </section>

      <aside class="notes-panel" aria-labelledby="notes-heading">
        <div class="notes-heading"><div><p class="small-label">释读札记</p><h2 id="notes-heading">{{ mode === 'explore' ? '局部探索' : mode === 'compare' ? '古今之间' : '循序读图' }}</h2></div><span class="note-count">{{ mode === 'explore' ? '热点待收录' : '四项待补' }}</span></div>

        <template v-if="mode !== 'compare'">
          <div class="note-list" role="group" aria-label="选择释读条目">
            <button v-for="note in notes" :key="note.id" type="button" class="note-select" :class="{ active: note.id === selectedNote }" :aria-pressed="note.id === selectedNote" @click="selectedNote = note.id">
              <span class="note-number">{{ note.number }}</span><span class="note-copy"><strong>{{ note.title }}</strong><small>{{ note.subtitle }}</small></span><span class="note-state">待补</span>
            </button>
          </div>
          <div class="note-detail" aria-live="polite">
            <span class="small-label">{{ mode === 'guide' ? '当前读图步骤' : '当前注解条目' }}</span>
            <h3>{{ activeNote.title }}</h3>
            <p>{{ activeNote.body }}</p>
            <dl><div v-for="field in activeNote.fields" :key="field"><dt>{{ field }}</dt><dd>待补充</dd></div></dl>
            <button v-if="mode === 'explore'" type="button" class="locate-button" disabled title="原图与注解核验后可定位">定位原图局部</button>
          </div>
        </template>

        <div v-else class="comparison-notes">
          <section class="compare-block"><span class="small-label">历史原图</span><h3>依原图，读原意</h3><p>图中实际记载的内容、组织结构与读法，将依据确定底本逐项说明。</p><span class="compare-state">等待底本与释读</span></section>
          <span class="compare-divider" aria-hidden="true">↓</span>
          <section class="compare-block modern-block"><span class="small-label">本作品的现代设计</span><h3>循节气，联结篇章</h3><p>以节气选择串联农事长卷、圭表日影与古图阅读，是本作品的交互设计。</p><p>与原图之间的具体对应，将在底本核验后补充。</p></section>
          <p class="comparison-foot">现代增加的色彩、图表与操作方式，将与历史图像本身清楚区分。</p>
        </div>
      </aside>
    </div>

    <footer class="edition-strip" aria-label="底本信息">
      <div class="edition-title"><span class="small-label">底本记</span><strong>资料尚待核验</strong></div>
      <dl><div><dt>图名</dt><dd>待收录</dd></div><div><dt>采用版本</dt><dd>待收录</dd></div><div><dt>所在卷页</dt><dd>待收录</dd></div><div><dt>图像来源</dt><dd>待收录</dd></div></dl>
    </footer>
  </section>
</template>

<style scoped>
.ancient-view { color: var(--ink, #253d38); padding: 10px 0 30px; font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", SimSun, serif; }
.ancient-view, .ancient-view * { box-sizing: border-box; }
button { font: inherit; }
button:focus-visible { outline: 2px solid var(--accent, #ae5544); outline-offset: 4px; }
.chapter-heading { display: flex; justify-content: space-between; gap: 32px; margin-bottom: 35px; }
.chapter-kicker, .small-label { color: var(--muted, #798079); font-size: 11px; letter-spacing: .18em; }
.chapter-kicker { margin: 0 0 14px; }
h1 { display: flex; align-items: center; gap: 18px; margin: 0; font-size: clamp(30px, 3.2vw, 43px); font-weight: 500; letter-spacing: .09em; }
.title-mark { padding: 5px 5px 4px; border: 1px solid var(--accent, #ae5544); color: var(--accent, #ae5544); font-size: 11px; line-height: 1.3; letter-spacing: .15em; writing-mode: vertical-rl; }
.chapter-intro { max-width: 720px; margin: 17px 0 0; font-size: 13px; line-height: 1.9; color: #69746c; }
.chapter-number { margin-right: 4px; font-size: 54px; line-height: 1; color: #d5d7cc; font-weight: 400; }
.chapter-number span { display: block; margin-top: 9px; text-align: center; font-size: 11px; letter-spacing: .3em; }
.mode-bar { display: flex; align-items: center; justify-content: space-between; gap: 20px; border-top: 1px solid var(--line, #d9d6ca); border-bottom: 1px solid var(--line, #d9d6ca); }
.mode-tabs { display: flex; gap: 26px; }
.mode-tabs button { position: relative; padding: 17px 1px; background: transparent; border: 0; color: #8c9588; font-size: 13px; letter-spacing: .08em; cursor: pointer; }
.mode-tabs button:hover { color: var(--ink, #253d38); }
.mode-tabs button.active { color: var(--accent, #ae5544); }
.mode-tabs button.active::after { content: ''; position: absolute; bottom: -1px; height: 2px; left: 0; right: 0; background: var(--accent, #ae5544); }
.context-label { display: flex; align-items: center; gap: 11px; font-size: 10px; color: #8d9489; }
.context-label strong { color: #667568; font-size: 12px; font-weight: 500; }
.context-label i { width: 1px; height: 11px; margin: 0 2px; background: var(--line, #d9d6ca); }
.mode-description { margin: 14px 0 21px; color: #859080; font-size: 11px; line-height: 1.8; min-height: 20px; }
.reader-layout { display: grid; grid-template-columns: minmax(0, 1fr) 330px; gap: 27px; align-items: start; }
.image-reader { border: 1px solid var(--line, #d9d6ca); background: #eeeee471; }
.reader-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 18px; border-bottom: 1px solid var(--line, #d9d6ca); }
.viewer-label { display: flex; gap: 12px; align-items: center; }
.pending-label { color: #949b8e; font-size: 10px; padding-left: 12px; border-left: 1px solid var(--line, #d9d6ca); }
.zoom-tools { display: flex; align-items: center; gap: 8px; }
.zoom-tools button { border: 1px solid #d8dace; background: transparent; width: 25px; height: 25px; padding: 0; color: #afb4a7; font-family: serif; font-size: 14px; cursor: not-allowed; }
.zoom-tools > span { color: #a3ac9b; font-size: 11px; padding: 0 3px; }
.zoom-tools .fit-button { width: auto; padding: 0 8px; font-size: 10px; margin-left: 5px; }
.image-space { position: relative; display: flex; min-height: 486px; align-items: center; justify-content: center; padding: 45px; background: radial-gradient(ellipse at center, #fbfaf47d 0, #e9eade12 75%); }
.mount-corner { position: absolute; width: 20px; height: 20px; border-color: #cdd1c0; border-style: solid; }
.top-left { top: 26px; left: 26px; border-width: 1px 0 0 1px; }
.top-right { top: 26px; right: 26px; border-width: 1px 1px 0 0; }
.bottom-left { bottom: 26px; left: 26px; border-width: 0 0 1px 1px; }
.bottom-right { bottom: 26px; right: 26px; border-width: 0 1px 1px 0; }
.image-placeholder { text-align: center; }
.blank-folio { position: relative; width: 67px; height: 85px; border: 1px solid #c8cebc; margin: 0 auto 25px; background: #f5f3e650; box-shadow: 5px 5px 0 -1px #f0f0e6, 5px 5px 0 0 #d5d9c9; }
.blank-folio::before { position: absolute; content: ''; left: 9px; top: 9px; right: 9px; bottom: 9px; border: 1px solid #d8ddce; }
.blank-folio span { position: absolute; top: 0; bottom: 0; left: 13px; border-left: 1px solid #d3d9c9; }
.placeholder-kicker { margin: 0 0 13px; color: #9aa28f; font-size: 10px; letter-spacing: .3em; }
.image-placeholder h2 { font-size: clamp(18px, 2vw, 24px); font-weight: 400; letter-spacing: .11em; margin: 0 0 17px; color: #6e7e66; line-height: 1.6; }
.image-placeholder > p:not(.placeholder-kicker) { font-size: 12px; line-height: 2; color: #939d88; margin: 0; }
.placeholder-foot { display: inline-block; margin-top: 28px; padding-top: 15px; border-top: 1px solid #d5daca; font-size: 10px; letter-spacing: .1em; color: #a1a996; }
.viewer-footer { display: flex; justify-content: space-between; gap: 15px; border-top: 1px solid var(--line, #d9d6ca); padding: 13px 18px; font-size: 10px; color: #929c87; line-height: 1.6; }
.notes-panel { border-top: 1px solid #9aa58c; }
.notes-heading { display: flex; align-items: center; justify-content: space-between; gap: 15px; padding: 19px 0 17px; }
.notes-heading .small-label { margin: 0 0 9px; }
.notes-heading h2 { margin: 0; font-weight: 500; font-size: 21px; letter-spacing: .1em; }
.note-count { border: 1px solid #d3d7c7; padding: 5px 8px; font-size: 10px; color: #89947c; white-space: nowrap; }
.note-list { border-top: 1px solid var(--line, #d9d6ca); }
.note-select { width: 100%; display: flex; align-items: center; gap: 13px; padding: 16px 11px 16px 0; background: transparent; color: var(--ink, #253d38); border: 0; border-bottom: 1px solid var(--line, #d9d6ca); text-align: left; cursor: pointer; }
.note-select:hover { background: #253d3803; }
.note-select.active { background: #e9ecdf70; }
.note-number { display: grid; place-items: center; width: 30px; height: 30px; flex: 0 0 30px; font-size: 14px; color: #a1ac92; }
.active .note-number { color: var(--accent, #ae5544); }
.note-copy { flex: 1; }
.note-copy strong { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 500; letter-spacing: .06em; }
.note-copy small { font-size: 10px; color: #919c85; }
.note-state { font-size: 10px; color: #9ca58f; }
.note-detail { padding: 23px 0 0; }
.note-detail h3 { margin: 11px 0; font-size: 17px; font-weight: 500; letter-spacing: .06em; }
.note-detail > p { font-size: 12px; color: #7f8c73; line-height: 1.95; margin: 0 0 16px; }
.note-detail dl { margin: 0; }
.note-detail dl > div { display: flex; justify-content: space-between; gap: 20px; padding: 8px 0; border-bottom: 1px solid #d9d6ca80; font-size: 10px; }
.note-detail dt { color: #8a9680; }
.note-detail dd { color: #a1aa96; margin: 0; }
.locate-button { width: 100%; border: 1px solid #d6daca; background: transparent; color: #a6ad9b; font-size: 11px; padding: 10px; margin-top: 17px; cursor: not-allowed; }
.comparison-notes { border-top: 1px solid var(--line, #d9d6ca); padding-top: 22px; }
.compare-block { border-left: 2px solid #ccd2bd; padding-left: 17px; }
.compare-block h3 { font-size: 18px; font-weight: 500; margin: 11px 0; letter-spacing: .05em; }
.compare-block p { margin: 10px 0; font-size: 12px; line-height: 1.95; color: #819071; }
.compare-state { display: inline-block; border: 1px solid #d8ddca; padding: 5px 8px; color: #99a18b; font-size: 10px; margin-top: 5px; }
.compare-divider { display: block; margin: 19px 0 19px 16px; color: #a1ad91; font-size: 18px; }
.modern-block { border-left-color: #ae554460; }
.comparison-foot { margin: 24px 0 0; border-top: 1px solid var(--line, #d9d6ca); padding-top: 16px; color: #96a087; font-size: 10px; line-height: 1.9; }
.edition-strip { display: grid; grid-template-columns: 170px minmax(0, 1fr); gap: 22px; align-items: center; border-top: 1px solid var(--line, #d9d6ca); border-bottom: 1px solid var(--line, #d9d6ca); padding: 21px 0; margin-top: 28px; }
.edition-title { border-right: 1px solid var(--line, #d9d6ca); }
.edition-title strong { display: block; font-size: 12px; font-weight: 500; margin-top: 9px; color: #6f8063; }
.edition-strip dl { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 0; }
.edition-strip dt { font-size: 10px; color: #8e9a80; margin-bottom: 9px; }
.edition-strip dd { font-size: 12px; color: #a2aa97; margin: 0; }
@media (max-width: 1080px) {
  .reader-layout { grid-template-columns: minmax(0, 1fr) 285px; gap: 23px; }
  .reader-toolbar { padding: 12px; gap: 10px; flex-wrap: wrap; }
  .image-space { padding: 38px 24px; }
  .viewer-footer { flex-direction: column; gap: 5px; }
}
@media (max-width: 800px) {
  .reader-layout { grid-template-columns: 1fr; gap: 27px; }
  .image-space { min-height: 410px; }
  .notes-panel { margin-top: 0; }
  .mode-bar { align-items: flex-start; flex-direction: column; gap: 0; padding-bottom: 13px; }
  .mode-tabs { margin-bottom: 14px; }
  .mode-tabs button { padding-bottom: 13px; }
  .mode-tabs button.active::after { bottom: 0; }
  .note-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 20px; }
  .edition-strip { grid-template-columns: 140px minmax(0, 1fr); gap: 20px; }
}
@media (max-width: 520px) {
  .chapter-heading { gap: 14px; margin-bottom: 24px; }
  .chapter-number { font-size: 40px; }
  .chapter-intro { font-size: 12px; }
  .image-space { min-height: 360px; }
  .image-placeholder h2 { font-size: 18px; }
  .mode-tabs { width: 100%; justify-content: space-between; gap: 15px; }
  .note-list { grid-template-columns: 1fr; }
  .edition-strip { grid-template-columns: 1fr; }
  .edition-title { border-right: 0; }
  .edition-strip dl { grid-template-columns: repeat(2, 1fr); gap: 20px; }
}
</style>
