<script setup>
import { computed, defineAsyncComponent, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SundialFallback from './SundialFallback.vue';
import AnnualShadowChart from './AnnualShadowChart.vue';
import YearSlider from './YearSlider.vue';
import HouSection from './HouSection.vue';
import LinkedRecords from './LinkedRecords.vue';
import { year } from '../state/year.js';
import { subscribeFrame, motionPreferences } from '../core/loop.js';
import { savedObservation, decodeObservation, saveObservation, encodeObservation } from '../state/observation.js';
import {
  OBSERVERS, MIN_DATE, MAX_DATE, MIN_CYCLE, MAX_CYCLE, assertDate, atSolarTime, cycleTerm, dayBounds,
  dayTrack, formatLocal, localDate, localStamp, longitudeAt, parseClock, solarAt, termAt, validateObserver,
} from '../lib/astro/observation.js';
import { splitTracks } from '../lib/astro/tracks.js';

const props = defineProps({ term: Object, terms: Array });
const emit = defineEmits(['select-term']);
const Scene = defineAsyncComponent({
  loader: () => import('./SundialScene.vue'),
  onError(_error, _retry, fail) { fallback.value = true; fail(); },
});
const route = useRoute(), router = useRouter();
const firstPlace = OBSERVERS[0];
const today = () => localDate(Date.now(),firstPlace.zone);
const initialDate = () => today() < MIN_DATE ? MIN_DATE : today() > MAX_DATE ? MAX_DATE : today();
const clampCycle = value => Math.max(MIN_CYCLE, Math.min(MAX_CYCLE, value));
const makeDefault = () => {
  const ms = atSolarTime(initialDate(),12,firstPlace) ?? parseClock(initialDate(),'12:00',firstPlace.zone);
  const terms = termAt(ms);
  return { ms, place:firstPlace, mode:'date', cycle:clampCycle(terms.cycle), selected:terms.active.id, requested:10 };
};
const current = ref(decodeObservation(route.query.obs) ?? savedObservation.value ?? makeDefault());
const draft = ref({});
const error = ref(route.query.obs && !decodeObservation(route.query.obs) ? '分享地址中的观测条件无效，已载入可用条件。' : '');
const fallback = ref(false), forceFlat = ref(false), low = ref(false), touchActive = ref(false);
const ready = ref(false), mounted = ref(false);
const preset = ref('oblique'), reset = ref(0);
const advancedOpen = ref(false);
const layers = ref({ sky:true, shadow:true, ray:false, compass:true });
const playing = ref(false), speed = ref(1), explanation = ref(false);
let unsubscribe, active = false, requestedYearTerm = null, elapsed = 0, playBounds;

const place = computed(() => current.value.place);
const stamp = computed(() => localStamp(current.value.ms, place.value.zone));
const date = computed(() => stamp.value.toPlainDate().toString());
const bounds = computed(() => dayBounds(date.value,place.value.zone));
const solar = computed(() => solarAt(current.value.ms, place.value));
const tracks = computed(() => splitTracks(dayTrack(date.value, place.value)));
const dayCount = computed(() => (bounds.value[1]-bounds.value[0])/60_000);
const solarLongitude = computed(() => longitudeAt(current.value.ms));
const actual = computed(() => termAt(current.value.ms));
const compare = computed(() => current.value.mode === 'compare');
const termEvent = computed(() => compare.value ? cycleTerm(current.value.cycle,current.value.selected) : actual.value.active);
const highlighted = computed(() => compare.value ? current.value.selected : actual.value.active.id);
const clockText = computed(() => stamp.value.toPlainTime().toString({ smallestUnit:'minute' }));
const keyTerms = computed(() => props.terms.filter(term => ['chunfen','xiazhi','qiufen','dongzhi'].includes(term.id)));
const sliderValue = computed(() => compare.value ? Math.round(current.value.requested * 60)
  : Math.min(dayCount.value, Math.round((current.value.ms - bounds.value[0]) / 60_000)));
const message = computed(() => {
  if (solar.value.altitude <= 0) return '太阳在当地地平线下，无直射日影。';
  if (!solar.value.needle) return '该纬度的水平极轴晷不提供读时。可继续观察太阳位置。';
  if (!solar.value.shadow) return '太阳贴近地平线，影端过远。';
  if (!solar.value.shadow.inside) return '影端超出晷面，盘内显示影线，读数保留实际距离。';
  return '朱砂点标记晷针尖端的投影。';
});

function formatSolarTime(hours) {
  const minutes = Math.round(hours * 60) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2,'0')}:${String(minutes % 60).padStart(2,'0')}`;
}
function syncDraft() {
  draft.value = { ...place.value, date:date.value, clock:clockText.value, disambiguation:'reject' };
}
function syncYear() {
  if (year.term.value.id === highlighted.value && !year.moving.value) {
    requestedYearTerm = null;
    return;
  }
  if (requestedYearTerm !== highlighted.value) {
    requestedYearTerm = highlighted.value;
    emit('select-term', highlighted.value);
  }
}
function commit() {
  syncDraft();
  syncYear();
  const encoded = saveObservation({ ...current.value });
  if (route.name === 'sky' && (route.query.obs !== encoded || route.query.observeTerm)) {
    router.replace({ query:{ ...route.query, term:highlighted.value, obs:encoded, observeTerm:undefined } });
  }
}
function setInstant(ms, mode = current.value.mode, nextPlace = place.value) {
  assertDate(localDate(ms,nextPlace.zone));
  const terms = termAt(ms);
  current.value = { ...current.value, ms, mode, place:nextPlace,
    ...(mode === 'date' ? { selected:terms.active.id, cycle:clampCycle(terms.cycle) } : {}) };
}
function pause(save = false) {
  const wasPlaying = playing.value;
  playing.value = false;
  elapsed = 0;
  if (save && wasPlaying) commit();
}
function change(action) {
  pause();
  try { action(); error.value = ''; commit(); }
  catch (issue) { error.value = issue.message || '无法计算这组观测条件。'; }
}
function solarMoment(day, hour, nextPlace) {
  const ms = atSolarTime(day,hour,nextPlace);
  if (ms == null) throw new RangeError('该当地日期没有对应的太阳时，请更换日期或时区。');
  return ms;
}
function selectComparison(id, cycle = current.value.cycle, nextPlace = place.value, hour = current.value.requested) {
  const event = cycleTerm(cycle,id);
  const day = localDate(event.ms,nextPlace.zone);
  const ms = solarMoment(day,hour,nextPlace);
  setInstant(ms,'compare',nextPlace);
  current.value = { ...current.value, selected:id, cycle, requested:hour };
}
function setMode(mode) {
  if (current.value.mode === mode) return;
  change(() => {
    if (mode === 'compare') selectComparison(highlighted.value);
    else setInstant(current.value.ms,'date');
  });
}
function setPlace(nextPlace) {
  if (compare.value) selectComparison(current.value.selected,current.value.cycle,nextPlace);
  else setInstant(current.value.ms,'date',nextPlace);
}
function applyLocation() {
  change(() => setPlace(validateObserver({ ...draft.value, id:'custom', name:'自定义地点' })));
}
function choosePlace(event) {
  const selected = OBSERVERS.find(item => item.id === event.target.value);
  if (selected) change(() => setPlace(selected));
  else {
    draft.value = { ...draft.value, id:'custom' };
    advancedOpen.value = true;
  }
}
function setClock() {
  change(() => setInstant(parseClock(draft.value.date,draft.value.clock,place.value.zone,draft.value.disambiguation),'date'));
}
function previewSlider(value) {
  pause();
  try {
    if (compare.value) {
      const hour = Number(value) / 60;
      const ms = solarMoment(date.value,hour,place.value);
      current.value = { ...current.value, requested:hour, ms };
    } else {
      const [start,end] = bounds.value;
      setInstant(Math.min(end-1,start + Number(value)*60_000),'date');
    }
    error.value = '';
  } catch (issue) { error.value = issue.message; }
}
function setNoon() {
  change(() => {
    if (compare.value) selectComparison(current.value.selected,current.value.cycle,place.value,12);
    else setInstant(solarMoment(date.value,12,place.value),'date');
  });
}
function jump(ms) { change(() => setInstant(ms,'date')); }
function togglePlay() {
  if (playing.value) { pause(true); return; }
  playBounds = [...bounds.value];
  if (current.value.ms >= playBounds[1] - 60_000) {
    current.value = { ...current.value, ms:playBounds[0], requested:solarAt(playBounds[0],place.value).solarTime };
  }
  playing.value = true;
}
function step(dt) {
  if (!playing.value) return;
  elapsed += dt;
  if (elapsed < .032) return;
  const [start,end] = playBounds;
  const ms = Math.min(end - 1, current.value.ms + Math.round(elapsed * speed.value * (end-start)/24));
  elapsed = 0;
  setInstant(ms);
  if (compare.value) current.value = { ...current.value, requested:solar.value.solarTime };
  if (ms === end-1) pause(true);
}
function setPreset(value) { preset.value = value; reset.value++; }
function toggleView() {
  forceFlat.value = !forceFlat.value && !fallback.value;
  ready.value = false;
  fallback.value = false;
}
function onVisibility() { if (document.hidden) pause(true); }
watch(motionPreferences.reduced, value => { if (value) pause(true); });
watch(() => year.state.settled, () => {
  if (!active || route.name !== 'sky') return;
  const id = year.term.value.id;
  if (id === requestedYearTerm) { requestedYearTerm = null; return; }
  requestedYearTerm = null;
  if (id !== highlighted.value) change(() => selectComparison(id));
});
watch(() => route.query.obs, value => {
  if (route.name !== 'sky' || value === encodeObservation(current.value)) return;
  const restored = decodeObservation(value);
  if (!restored) return;
  pause();
  current.value = restored;
  syncDraft();
  syncYear();
});
function activate() {
  if (active) return;
  active = true;
  mounted.value = true;
  if (!unsubscribe) unsubscribe = subscribeFrame(step);
  if (route.query.observeTerm === '1' && (!route.query.obs || props.term.id !== highlighted.value)) {
    change(() => selectComparison(props.term.id));
  } else if (!route.query.obs || route.query.observeTerm) commit();
  else syncYear();
}
onMounted(() => {
  activate();
  document.addEventListener('visibilitychange',onVisibility);
});
onActivated(activate);
function deactivate() {
  if (playing.value) saveObservation({ ...current.value });
  pause();
  unsubscribe?.();
  unsubscribe = null;
  active = false;
}
onDeactivated(deactivate);
onBeforeUnmount(() => { deactivate(); document.removeEventListener('visibilitychange',onVisibility); });
syncDraft();
</script>

<template>
  <section class="sky-page sundial-page">
    <div class="page-heading">
      <div><p class="eyebrow">第三篇 · 观天测影</p><h1>一晷日影，<em>读一日时光。</em></h1></div>
      <p class="heading-note">拨动一天，沿影线读时<br>换个节气，看太阳走过四季</p>
    </div>
    <div class="observation-bar">
      <div class="mode-controls" aria-label="观测方式">
        <button type="button" :aria-pressed="!compare" @click="setMode('date')">按日期观测</button>
        <button type="button" :aria-pressed="compare" @click="setMode('compare')">按节气比较</button>
      </div>
      <label>观测地点
        <select :value="draft.id" @change="choosePlace">
          <option v-for="item in OBSERVERS" :key="item.id" :value="item.id">{{ item.name }}</option>
          <option value="custom">自定义地点</option>
        </select>
      </label>
      <label v-if="compare">立春周期
        <select :value="current.cycle" @change="change(() => selectComparison(current.selected, Number($event.target.value)))">
          <option v-for="cycle in [2025,2026,2027,2028]" :key="cycle" :value="cycle">{{ cycle }}</option>
        </select>
      </label>
      <form v-else class="clock-form" @submit.prevent="setClock">
        <label>当地日期 <input v-model="draft.date" type="date" :min="MIN_DATE" :max="MAX_DATE" required @input="pause()" /></label>
        <label>当地钟表时间 <input v-model="draft.clock" type="time" required @input="pause()" /></label>
        <button type="submit">应用时刻</button>
      </form>
      <button type="button" @click="jump(Date.now())">此刻</button>
      <button type="button" @click="setNoon">当地午正</button>
    </div>
    <details v-if="draft.id === 'custom' || !compare" class="advanced" :open="advancedOpen" @toggle="advancedOpen=$event.target.open">
      <summary>经纬度、时区与重复钟点设置</summary>
      <form class="observation-bar" @submit.prevent="applyLocation">
        <label>纬度（北正）<input v-model="draft.latitude" type="number" step="any" min="-90" max="90" required /></label>
        <label>经度（东正）<input v-model="draft.longitude" type="number" step="any" min="-180" max="180" required /></label>
        <label>海拔（米）<input v-model="draft.elevation" type="number" step="any" min="-500" max="9000" required /></label>
        <label>IANA 时区 <input v-model="draft.zone" type="text" required placeholder="Asia/Shanghai" /></label>
        <button type="submit">应用地点</button>
        <label v-if="!compare">重复钟点
          <select v-model="draft.disambiguation">
            <option value="reject">提示选择</option><option value="earlier">前一次</option><option value="later">后一次</option>
          </select>
        </label>
      </form>
    </details>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>

    <div class="dial-experience">
      <div class="visual-panel">
        <div class="scene-toolbar">
          <span class="eyebrow">水平式日晷 · {{ place.name }}</span>
          <div v-if="!fallback && !forceFlat" class="scene-actions" aria-label="观察视角">
            <button type="button" :aria-pressed="preset==='oblique'" @click="setPreset('oblique')">斜视</button>
            <button type="button" :aria-pressed="preset==='overhead'" @click="setPreset('overhead')">俯视</button>
            <button type="button" :aria-pressed="preset==='side'" @click="setPreset('side')">侧视</button>
            <button type="button" @click="setPreset('oblique')">复位</button>
          </div>
        </div>
        <div class="scene-viewport" aria-label="日晷观测图">
          <SundialFallback v-if="fallback || forceFlat || !ready" class="fallback-underlay" :solar="solar" :latitude="place.latitude" :tracks="tracks" :layers="layers" />
          <Scene v-if="mounted && !fallback && !forceFlat" class="scene-overlay" :solar="solar" :latitude="place.latitude"
            :tracks="tracks" :layers="layers" :preset="preset" :reset="reset" :touch-active="touchActive" :low="low"
            @ready="ready=true" @unavailable="fallback=true; ready=false" />
          <p v-if="fallback" class="scene-note">三维暂不可用 · 正在使用二维日晷</p>
          <p v-else-if="!forceFlat && !ready" class="scene-note">正在准备三维场景</p>
        </div>
        <div class="layers">
          <label><input v-model="layers.sky" type="checkbox" />太阳轨迹</label>
          <label><input v-model="layers.shadow" type="checkbox" />影端轨迹</label>
          <label><input v-model="layers.ray" type="checkbox" />光线辅助</label>
          <label><input v-model="layers.compass" type="checkbox" />方位</label>
          <button v-if="!fallback && !forceFlat" type="button" class="touch-toggle" :aria-pressed="touchActive"
            @click="touchActive=!touchActive">{{ touchActive ? '恢复滚动' : '触摸旋转' }}</button>
          <button type="button" @click="toggleView">{{ forceFlat || fallback ? '启用三维' : '二维图' }}</button>
          <label v-if="!forceFlat && !fallback"><input v-model="low" type="checkbox" />轻量画质</label>
        </div>
        <p class="fine-print scene-caption">赭色为天空太阳路径，青绿色为晷面影端路径。天穹大小与距离为示意。</p>
      </div>

      <aside class="dial-time-panel">
        <p class="eyebrow">{{ date }} · {{ place.name }}</p>
        <div class="solar-clock">{{ formatSolarTime(solar.solarTime) }}<span>真太阳时</span></div>
        <p class="clock-caption">当地钟表 {{ clockText }} · UTC{{ stamp.offset }}<br>{{ place.zone }}</p>
        <dl class="dial-readings">
          <div><dt>太阳高度</dt><dd>{{ solar.altitude.toFixed(1) }}°</dd></div>
          <div><dt>太阳方位</dt><dd>{{ Math.abs(solar.altitude) > 89.95 || Math.abs(place.latitude) === 90 ? '—' : solar.azimuth.toFixed(1)+'°' }}</dd></div>
          <div><dt>太阳黄经</dt><dd>{{ solarLongitude.toFixed(1) }}°</dd></div>
          <div><dt>晷针倾角</dt><dd>{{ solar.needle ? Math.abs(place.latitude).toFixed(1)+'°' : '—' }}</dd></div>
          <div><dt>针根至影端</dt><dd>{{ solar.shadow ? solar.shadow.distance.toFixed(2) : '—' }} <small v-if="solar.shadow">相对单位</small></dd></div>
          <div><dt>所处节气</dt><dd>{{ actual.active.name }}</dd></div>
        </dl>
        <p class="dial-state-note" :aria-live="playing ? 'off' : 'polite'">{{ message }}</p>
      </aside>
    </div>

    <div class="time-control">
      <button type="button" :aria-pressed="playing" @click="togglePlay">{{ playing ? '暂停日行' : '播放一天' }}</button>
      <label class="time-slider">拨动一天 · {{ compare ? '真太阳时' : '当地钟表时间' }}
        <input type="range" min="0" :max="compare ? 1439 : dayCount" step="1" :value="sliderValue"
          :aria-valuetext="compare ? formatSolarTime(current.requested) : clockText + ' UTC' + stamp.offset"
          @input="previewSlider($event.target.value)" @change="commit" />
      </label>
      <label>速度 <select v-model.number="speed"><option :value=".5">0.5×</option><option :value="1">1×</option><option :value="2">2×</option></select></label>
    </div>
    <YearSlider compact />
    <section class="dial-season-compare">
      <div><p class="eyebrow">同一地点 · 同一真太阳时</p><h2>换个节气，再看日影。</h2></div>
      <div class="season-choices">
        <button v-for="item in keyTerms" :key="item.id" :aria-pressed="compare && current.selected === item.id"
          @click="change(() => selectComparison(item.id))">{{ item.name }}</button>
      </div>
      <p>按交节所在的当地日期比较。选择另一节气时保留真太阳时。</p>
    </section>
    <section class="term-card" aria-label="交节时刻">
      <div><p class="eyebrow">二十四节气 · 当地时间</p><h2>{{ termEvent.name }}交节</h2>
        <p>{{ formatLocal(termEvent.ms, place.zone) }} · {{ place.zone }}</p>
        <p class="fine-print">太阳地心视黄经 {{ termEvent.longitude }}° · {{ termEvent.usesReference ? '采用官方分钟记录' : '算法计算，显示到分钟' }}</p>
        <p v-if="termEvent.source" class="fine-print"><a :href="termEvent.source" target="_blank" rel="noopener noreferrer">{{ termEvent.sourceLabel }}对照</a> · 计算相差 {{ termEvent.differenceSeconds.toFixed(1) }} 秒</p>
        <p v-else class="fine-print">此节点暂无已收录的独立参考时刻。</p>
        <p>下次交节 · {{ actual.next.name }} {{ formatLocal(actual.next.ms, place.zone) }}</p></div>
      <div class="scene-actions">
        <button type="button" @click="jump(termEvent.ms)">查看交节瞬间</button>
        <button type="button" @click="change(() => setInstant(solarMoment(localDate(termEvent.ms,place.zone),12,place),'date'))">交节当天午正</button>
        <button type="button" :disabled="localDate(actual.next.ms,place.zone) > MAX_DATE" @click="jump(actual.next.ms)">跳到下次交节</button>
      </div>
    </section>
    <HouSection />
    <LinkedRecords />
    <details class="gnomon-reference" @toggle="explanation=$event.target.open">
      <summary>展开全年影长与计算说明</summary>
      <template v-if="explanation">
        <AnnualShadowChart :term="term" :terms="terms" :observer="place" :cycle="current.cycle" @select-term="id => change(() => selectComparison(id))" />
        <p>水平日晷以当地纬度校准晷针和时线。太阳位置采用 Astronomy Engine，按太阳中心的几何方向投影。观测采用理想水平地面，城市坐标是近似参考点。</p>
        <p>交节由地心太阳视黄经确定。切换观测地点可改变当地钟表显示及日影，同一次交节仍对应同一瞬间。</p>
        <p><a href="https://www.hko.gov.hk/sc/gts/astronomy/Solar_Term.htm" target="_blank" rel="noopener noreferrer">香港天文台节气时间资料</a> · <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noopener noreferrer">天文算法来源</a></p>
      </template>
    </details>
  </section>
</template>

<style scoped>
.observation-bar,.clock-form,.mode-controls,.scene-actions,.layers,.time-control,.season-choices { display:flex; flex-wrap:wrap; gap:8px 12px; align-items:end; }
.observation-bar { padding:12px 0; border-block:1px solid var(--line); }
.observation-bar label,.time-control label { display:grid; gap:4px; font-size:.82rem; }
:is(.observation-bar,.scene-toolbar,.layers,.time-control,.dial-season-compare,.term-card) :is(button,input:not([type=checkbox]),select) { min-height:44px; }
:is(.observation-bar,.scene-toolbar,.layers,.time-control,.dial-season-compare,.term-card) :is(button,select,input:not([type=range],[type=checkbox])) { border:1px solid var(--line); border-radius:5px; padding:6px 12px; color:var(--ink); background:#fcfaf3; }
:is(.observation-bar,.scene-toolbar,.layers,.time-control,.dial-season-compare,.term-card) button[aria-pressed=true] { background:#29483d; color:#fffaf0; }
.sundial-page button:focus-visible { outline:2px solid #9e4935; outline-offset:2px; }
.advanced { margin-block:10px; font-size:.88rem; }
.advanced summary,.gnomon-reference summary { padding:8px 0; cursor:pointer; }
.advanced input { width:9.5rem; max-width:100%; }
.form-error { padding:9px 12px; border-left:3px solid #9e4935; color:#803726; background:#f6e9dc; }
.dial-experience { display:grid; grid-template-columns:minmax(0,2.3fr) minmax(240px,1fr); gap:18px; margin-top:16px; align-items:stretch; }
.visual-panel,.dial-time-panel,.term-card { background:#fcfaf3; border:1px solid var(--line); border-radius:7px; }
.scene-toolbar,.layers,.scene-caption { padding:9px 12px; }
.scene-toolbar { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; }
.scene-viewport { position:relative; height:clamp(330px,40vw,570px); background:#f1ecde; overflow:hidden; }
.scene-overlay,.fallback-underlay { position:absolute; inset:0; }
.scene-note { position:absolute; inset:auto 10px 8px; font-size:.78rem; margin:0; pointer-events:none; }
.layers { align-items:center; border-top:1px solid var(--line); font-size:.84rem; }
.layers label { display:flex; align-items:center; gap:4px; min-height:44px; }
.scene-caption { margin:0; }
.dial-time-panel { padding:18px; }
.solar-clock { font-family:Georgia,serif; font-size:clamp(2.4rem,5vw,4rem); line-height:1.1; color:#304b3f; }
.solar-clock span { display:block; font-size:.85rem; }
.clock-caption,.dial-state-note { font-size:.86rem; line-height:1.6; }
.dial-readings { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.dial-readings div { border-top:1px solid var(--line); padding-top:8px; }
.dial-readings dt { color:var(--muted); font-size:.8rem; }
.dial-readings dd { margin:0; font-size:1.04rem; font-weight:600; }
.time-control { align-items:center; margin:12px 0 20px; }
.time-slider { flex:1 1 155px; }
.time-slider input { width:100%; accent-color:#9e4935; }
.dial-season-compare,.term-card,.gnomon-reference { margin:20px 0; padding:16px; border-top:1px solid var(--line); }
.term-card { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; }
.term-card p { margin-block:5px; }
.touch-toggle { display:none; }
@media(pointer:coarse) { .touch-toggle { display:inline-block; } }
@media(max-width:800px) { .dial-experience { grid-template-columns:minmax(0,1fr); } }
@media(max-width:480px) {
  .scene-viewport { height:330px; }
  .scene-toolbar,.layers { padding-inline:8px; }
  .clock-form { width:100%; }
  .observation-bar input[type=date] { max-width:100%; }
}
</style>
