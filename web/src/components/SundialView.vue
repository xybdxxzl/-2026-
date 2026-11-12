<script setup>
import { computed, defineAsyncComponent, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SundialFallback from './SundialFallback.vue';
import AnnualShadowChart from './AnnualShadowChart.vue';
import YearSlider from './YearSlider.vue';
import HouSection from './HouSection.vue';
import LinkedRecords from './LinkedRecords.vue';
import TimeAxis from './TimeAxis.vue';
import SundialReadout from './SundialReadout.vue';
import SundialLegend from './SundialLegend.vue';
import UiIcon from './UiIcon.vue';
import { year } from '../state/year.js';
import { subscribeFrame, motionPreferences } from '../core/loop.js';
import { savedObservation, decodeObservation, saveObservation, encodeObservation } from '../state/observation.js';
import {
  OBSERVERS, MIN_DATE, MAX_DATE, MIN_CYCLE, MAX_CYCLE, assertDate, atSolarTime, cycleTerm, dayBounds,
  dayTrack, formatLocal, localDate, localStamp, longitudeAt, parseClock, solarAt, termAt, validateObserver,
} from '../lib/astro/observation.js';
import { splitTracks } from '../lib/astro/tracks.js';
import { sunriseSunset } from '../lib/astro/sundialGeometry.js';

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
  return { ms, place:firstPlace, mode:'date', cycle:clampCycle(terms.cycle), selected:terms.active.id, requested:solarAt(ms,firstPlace).solarTime };
};
const initial = decodeObservation(route.query.obs) ?? savedObservation.value ?? makeDefault();
const current = ref(initial);
const draft = ref({});
const error = ref(route.query.obs && !decodeObservation(route.query.obs) ? '分享地址中的观测条件无效，已载入可用条件。' : '');
const fallback = ref(false), forceFlat = ref(false), low = ref(false), touchActive = ref(false);
const ready = ref(false), mounted = ref(false);
const preset = ref('oblique'), reset = ref(0);
const face = ref(solarAt(initial.ms,initial.place).polar.face ?? 'front');
const followingShadow = ref(true);
const advancedOpen = ref(false);
const layers = ref({ sky:true, shadow:false, ray:false, compass:false });
const playing = ref(false), speed = ref(1), explanation = ref(false);
const comparePeer = ref(initial.selected === 'xiazhi' ? 'dongzhi' : 'xiazhi');
const showBoth = ref(false), xray = ref(false);
const debug = new URLSearchParams(location.search).get('debug') === 'geom';
let unsubscribe, active = false, requestedYearTerm = null, elapsed = 0, playBounds;

const place = computed(() => current.value.place);
const stamp = computed(() => localStamp(current.value.ms, place.value.zone));
const date = computed(() => stamp.value.toPlainDate().toString());
const bounds = computed(() => dayBounds(date.value,place.value.zone));
const solar = computed(() => solarAt(current.value.ms, place.value));
const dayPoints = computed(() => dayTrack(date.value, place.value));
const tracks = computed(() => splitTracks(dayPoints.value));
const daylight = computed(() => {
  const crossings = tracks.value.solarCrossings ?? [];
  const rising = crossings.filter(crossing => crossing.rising);
  const setting = crossings.filter(crossing => !crossing.rising);
  if (rising.length === 1 && setting.length === 1 && rising[0].solarTime < setting[0].solarTime) {
    return { state:'regular', sunrise:rising[0].solarTime, sunset:setting[0].solarTime };
  }
  const sample = dayPoints.value[Math.floor(dayPoints.value.length / 2)];
  return sample ? sunriseSunset(place.value.latitude,sample.declination) : null;
});
const solarLongitude = computed(() => longitudeAt(current.value.ms));
const actual = computed(() => termAt(current.value.ms));
const compare = computed(() => current.value.mode === 'compare');
const compareTime = computed(() => compare.value ? current.value.requested : solar.value.solarTime);
const termEvent = computed(() => compare.value ? cycleTerm(current.value.cycle,current.value.selected) : actual.value.active);
const highlighted = computed(() => compare.value ? current.value.selected : actual.value.active.id);
const clockText = computed(() => stamp.value.toPlainTime().toString({ smallestUnit:'minute' }));
const sliderValue = computed(() => Math.round(solar.value.solarTime * 60) % 1440);
const compareTerms = computed(() => props.terms);
function termSample(id) {
  const event = cycleTerm(current.value.cycle,id);
  const day = localDate(event.ms,place.value.zone);
  const ms = atSolarTime(day,current.value.requested,place.value);
  if (ms == null) return null;
  return { term:event, ms, solar:solarAt(ms,place.value) };
}
const comparisons = computed(() => {
  if (!compare.value) return [];
  try { return [termSample(current.value.selected),termSample(comparePeer.value)].filter(Boolean); }
  catch { return []; }
});
const secondarySolar = computed(() => comparisons.value[1]?.solar ?? null);
const isFlat = computed(() => fallback.value || forceFlat.value);
const annotatedShadow = computed(() => isFlat.value || layers.value.ray || layers.value.shadow || compare.value);
const message = computed(() => {
  const status = solar.value.polar.status;
  if (status === 'night') return '太阳在当地地平线下，无直射日影。';
  if (status === 'parallel') return '春秋分附近光线平行晷面，没有有限影端。';
  if (status === 'overflow') return annotatedShadow.value ? '影端越出晷面，虚线标出延伸方向。' : '开启「光影关系」可查看影端的延伸方向。';
  if (compare.value) return '同一真太阳时的时线方向不变；赤纬符号决定影落正面或背面。';
  return annotatedShadow.value ? '朱砂点标记晷针尖端在晷面上的计算投影。' : '';
});

function formatSolarTime(hours) {
  const minutes = Math.round(hours * 60) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2,'0')}:${String(minutes % 60).padStart(2,'0')}`;
}
function syncDraft() { draft.value = { ...place.value, date:date.value, clock:clockText.value, disambiguation:'reject' }; }
function syncYear() {
  if (year.term.value.id === highlighted.value && !year.moving.value) { requestedYearTerm = null; return; }
  if (requestedYearTerm !== highlighted.value) { requestedYearTerm = highlighted.value; emit('select-term', highlighted.value); }
}
function commit() {
  syncDraft(); syncYear();
  current.value.requested = compareTime.value;
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
  const wasPlaying = playing.value; playing.value = false; elapsed = 0;
  if (save && wasPlaying) commit();
}
function change(action) {
  pause();
  try { action(); error.value = ''; commit(); }
  catch (issue) { error.value = issue.message || '无法计算这组观测条件。'; }
}
function solarMoment(day, hour, nextPlace = place.value) {
  const ms = atSolarTime(day,hour,nextPlace,current.value.ms);
  if (ms == null) throw new RangeError('该当地日期没有对应的真太阳时，请更换日期或时区。');
  return ms;
}
function selectComparison(id, cycle = current.value.cycle, nextPlace = place.value, hour = compareTime.value) {
  const event = cycleTerm(cycle,id);
  const ms = solarMoment(localDate(event.ms,nextPlace.zone),hour,nextPlace);
  setInstant(ms,'compare',nextPlace);
  current.value = { ...current.value, selected:id, cycle, requested:hour };
  if (comparePeer.value === id) comparePeer.value = id === 'xiazhi' ? 'dongzhi' : 'xiazhi';
}
function setMode(mode) {
  if (current.value.mode === mode) return;
  change(() => mode === 'compare' ? selectComparison(highlighted.value) : setInstant(current.value.ms,'date'));
}
function setPlace(nextPlace) {
  if (compare.value) selectComparison(current.value.selected,current.value.cycle,nextPlace);
  else setInstant(current.value.ms,'date',nextPlace);
}
function applyLocation() { change(() => setPlace(validateObserver({ ...draft.value, id:'custom', name:'自定义地点' }))); }
function choosePlace(event) {
  const selected = OBSERVERS.find(item => item.id === event.target.value);
  if (selected) change(() => setPlace(selected));
  else { draft.value = { ...draft.value, id:'custom' }; advancedOpen.value = true; }
}
function setClock() { change(() => setInstant(parseClock(draft.value.date,draft.value.clock,place.value.zone,draft.value.disambiguation),'date')); }
function previewSlider(value) {
  pause();
  try {
    const hour = Number(value) / 60, ms = solarMoment(date.value,hour);
    const terms = termAt(ms);
    current.value = compare.value ? { ...current.value, ms, requested:hour }
      : { ...current.value, ms, requested:hour, selected:terms.active.id, cycle:clampCycle(terms.cycle) };
    error.value = '';
  } catch (issue) { error.value = issue.message; }
}
function commitSlider(value) { if (value != null) previewSlider(value); commit(); }
function stepMinutes(minutes) { commitSlider((sliderValue.value + minutes + 1440) % 1440); }
function setNoon() {
  change(() => {
    if (compare.value) selectComparison(current.value.selected,current.value.cycle,place.value,12);
    else setInstant(solarMoment(date.value,12),'date');
    current.value = { ...current.value, requested:12 };
  });
}
function jump(ms) { change(() => setInstant(ms,'date')); }
function togglePlay() {
  if (playing.value) { pause(true); return; }
  playBounds = [...bounds.value];
  if (current.value.ms >= playBounds[1] - 60_000) current.value = { ...current.value, ms:playBounds[0] };
  playing.value = true;
}
function step(dt) {
  if (!playing.value) return;
  elapsed += dt; if (elapsed < .032) return;
  const [start,end] = playBounds;
  const ms = Math.min(end - 1, current.value.ms + Math.round(elapsed * speed.value * (end-start)/12));
  elapsed = 0;
  setInstant(ms);
  current.value = { ...current.value, requested:solar.value.solarTime };
  if (ms === end-1) pause(true);
}
function setPreset(value) {
  preset.value = value;
  if (value === 'side') layers.value.ray = true;
  if (value === 'overhead') layers.value.compass = true;
  reset.value++;
}
function setFace(value, follow = false) {
  followingShadow.value = follow;
  if (preset.value === 'side') preset.value = 'oblique';
  face.value = value; reset.value++;
}
function showShadowFace() { if (solar.value.polar.face) setFace(solar.value.polar.face,true); }
function resetView() { preset.value = 'oblique'; setFace(solar.value.polar.face ?? 'front',true); }
function onSceneView(view) { preset.value = view.preset; face.value = view.face; followingShadow.value = true; }
function toggleView() { forceFlat.value = !forceFlat.value && !fallback.value; ready.value = false; fallback.value = false; }
function onVisibility() { if (document.hidden) pause(true); }
watch(motionPreferences.reduced, value => { if (value) pause(true); });
watch(() => solar.value.polar.face, value => {
  if (value && followingShadow.value) face.value = value;
});
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
  pause(); current.value = restored; syncDraft(); syncYear();
});
function activate() {
  if (active) return;
  active = true; mounted.value = true;
  if (!unsubscribe) unsubscribe = subscribeFrame(step);
  if (route.query.observeTerm === '1' && (!route.query.obs || props.term.id !== highlighted.value)) change(() => selectComparison(props.term.id));
  else if (!route.query.obs || route.query.observeTerm) commit(); else syncYear();
}
onMounted(() => {
  activate(); document.addEventListener('visibilitychange',onVisibility);
});
onActivated(activate);
function deactivate() {
  if (playing.value) saveObservation({ ...current.value });
  pause(); unsubscribe?.(); unsubscribe = null; active = false;
}
onDeactivated(deactivate);
onBeforeUnmount(() => { deactivate(); document.removeEventListener('visibilitychange',onVisibility); });
syncDraft();
</script>

<template>
  <section class="sky-page sundial-page">
    <div class="sky-flow">
      <div class="page-heading sky-heading">
        <h1>观天测影</h1>
        <p class="heading-note">拨动真太阳时，观察晷针在两面晷盘上如何投影。</p>
      </div>

      <div class="dial-experience">
        <div class="visual-panel">
          <div class="scene-frame">
            <header class="scene-toolbar">
              <div class="scene-name">
                <h2>双面极轴日晷</h2>
                <p>{{ place.name }}<span aria-hidden="true"> / </span>{{ date }}</p>
              </div>
              <div class="scene-actions">
                <button type="button" class="light-control" :aria-pressed="layers.ray" @click="layers.ray=!layers.ray">
                  <UiIcon name="sun" />光影关系
                </button>
                <button v-if="!isFlat" type="button" class="touch-toggle" :aria-pressed="touchActive"
                  @click="touchActive=!touchActive">{{ touchActive ? '恢复滚动' : '触摸旋转' }}</button>
              </div>
            </header>
            <div class="scene-viewport" aria-label="日晷观测图">
              <SundialFallback v-if="isFlat || !ready" class="fallback-underlay" polar-mode :face="face"
                :solar="solar" :latitude="place.latitude" :tracks="tracks" :layers="layers" />
              <Scene v-if="mounted && !isFlat" class="scene-overlay" :solar="solar" :latitude="place.latitude"
                :tracks="tracks" :layers="layers" :preset="preset" :face="face" :reset="reset" :touch-active="touchActive" :low="low"
                :xray="xray" :secondary="secondarySolar" :show-both="showBoth" :compare="compare"
                :reduced-motion="motionPreferences.reduced.value" :debug="debug"
                @ready="ready=true" @unavailable="fallback=true; ready=false" @view-change="onSceneView" />
              <p v-if="fallback" class="scene-note" role="status">三维暂不可用，已切换为二维图。</p>
              <p v-else-if="!forceFlat && !ready" class="scene-note" role="status">正在准备三维场景</p>
            </div>
            <footer class="scene-footer">
              <SundialLegend :layers="layers" :shadow-visible="solar.altitude>0 && (!isFlat || (solar.polar.valid && solar.polar.face===face))"
                :shadow-marker="annotatedShadow && solar.polar.inside && (!isFlat || solar.polar.face===face)"
                :ray-visible="solar.altitude>0 && (!isFlat || (solar.polar.valid && solar.polar.face===face))" />
              <p v-if="!isFlat" class="orbit-hint">拖动旋转 · 滚轮缩放</p>
              <span v-if="layers.sky" class="scene-scale">天空轨迹非比例</span>
            </footer>
          </div>
          <TimeAxis :value="sliderValue" :playing="playing" v-model:speed="speed" :solar="solar" :daylight="daylight"
            @input="previewSlider" @commit="commit()" @toggle-play="togglePlay" @step="stepMinutes" @noon="setNoon" />
          <div class="view-controls" aria-label="观察视角">
            <div v-if="!isFlat" class="segmented" aria-label="视角">
              <button type="button" :aria-pressed="preset==='oblique'" @click="setPreset('oblique')">斜视</button>
              <button type="button" :aria-pressed="preset==='overhead'" @click="setPreset('overhead')">晷面</button>
              <button type="button" :aria-pressed="preset==='side'" @click="setPreset('side')">侧视</button>
            </div>
            <div class="segmented face-controls" aria-label="晷面">
              <button type="button" :aria-pressed="face==='front' && (isFlat || preset!=='side')" @click="setFace('front')">正面</button>
              <button type="button" :aria-pressed="face==='back' && (isFlat || preset!=='side')" @click="setFace('back')">背面</button>
            </div>
            <button type="button" :disabled="!solar.polar.face" @click="showShadowFace">看影面</button>
            <button v-if="!isFlat" type="button" class="reset-view" @click="resetView">复位</button>
          </div>
          <section class="quick-compare" aria-label="同一真太阳时节气比较">
            <div><strong>二至比较</strong><span>同一真太阳时 {{ formatSolarTime(compareTime) }}</span></div>
            <div class="segmented">
              <button type="button" :aria-pressed="compare && current.selected==='xiazhi'" @click="change(() => selectComparison('xiazhi'))">夏至</button>
              <button type="button" :aria-pressed="compare && current.selected==='dongzhi'" @click="change(() => selectComparison('dongzhi'))">冬至</button>
            </div>
            <template v-if="compare && !isFlat">
              <label><input v-model="showBoth" type="checkbox" />同时显示</label>
              <label><input v-model="xray" type="checkbox" />透视晷面</label>
            </template>
          </section>
        </div>

        <div class="side-stack">
          <section class="observation-panel" aria-labelledby="observation-title">
            <h2 id="observation-title">观测条件</h2>
            <div class="observation-bar">
              <div class="mode-controls" aria-label="观测方式">
                <button type="button" :aria-pressed="!compare" @click="setMode('date')">按日期观测</button>
                <button type="button" :aria-pressed="compare" @click="setMode('compare')">按节气比较</button>
              </div>
              <label class="place-field">观测地点
                <select :value="draft.id" @change="choosePlace">
                  <option v-for="item in OBSERVERS" :key="item.id" :value="item.id">{{ item.name }}</option>
                  <option value="custom">自定义地点</option>
                </select>
              </label>
              <template v-if="compare">
                <label>立春周期
                  <select :value="current.cycle" @change="change(() => selectComparison(current.selected, Number($event.target.value)))">
                    <option v-for="cycle in [2025,2026,2027,2028]" :key="cycle" :value="cycle">{{ cycle }}</option>
                  </select>
                </label>
                <label>比较节气
                  <select :value="current.selected" @change="change(() => selectComparison($event.target.value))">
                    <option v-for="item in compareTerms" :key="item.id" :value="item.id">{{ item.name }}</option>
                  </select>
                </label>
                <label>对照节气
                  <select v-model="comparePeer"><option v-for="item in compareTerms" :key="item.id" :value="item.id">{{ item.name }}</option></select>
                </label>
              </template>
              <form v-else class="clock-form" @submit.prevent="setClock">
                <label>当地日期 <input v-model="draft.date" type="date" :min="MIN_DATE" :max="MAX_DATE" required @input="pause()" /></label>
                <label>当地钟表时间 <input v-model="draft.clock" type="time" required @input="pause()" /></label>
                <button type="submit">应用时刻</button>
              </form>
              <button type="button" class="now-button" @click="jump(Date.now())">此刻</button>
            </div>
            <details class="advanced" :open="advancedOpen" @toggle="advancedOpen=$event.target.open">
              <summary>经纬度、时区与重复钟点设置</summary>
              <form class="observation-bar advanced-form" @submit.prevent="applyLocation">
                <label>纬度（北正）<input v-model="draft.latitude" type="number" step="any" min="-90" max="90" required /></label>
                <label>经度（东正）<input v-model="draft.longitude" type="number" step="any" min="-180" max="180" required /></label>
                <label>海拔（米）<input v-model="draft.elevation" type="number" step="any" min="-500" max="9000" required /></label>
                <label>IANA 时区 <input v-model="draft.zone" type="text" required placeholder="Asia/Shanghai" /></label>
                <button type="submit">应用地点</button>
                <label v-if="!compare">重复钟点
                  <select v-model="draft.disambiguation"><option value="reject">提示选择</option><option value="earlier">前一次</option><option value="later">后一次</option></select>
                </label>
              </form>
            </details>
            <p v-if="error" class="form-error" role="alert">{{ error }}</p>
          </section>
          <SundialReadout :solar="solar" :place="place" :clock-text="clockText" :offset="stamp.offset"
            :longitude="solarLongitude" :actual="actual" :message="message" :compare="compare" :comparisons="comparisons" />
          <details class="layer-panel">
            <summary>图层与画质</summary>
            <div class="layers">
              <label><input v-model="layers.sky" type="checkbox" />太阳轨迹</label>
              <label><input v-model="layers.shadow" type="checkbox" />影端轨迹</label>
              <label v-if="!isFlat"><input v-model="layers.compass" type="checkbox" />方位</label>
              <label v-if="!isFlat"><input v-model="low" type="checkbox" />轻量画质</label>
              <button type="button" @click="toggleView">{{ isFlat ? '启用三维' : '切换二维图' }}</button>
            </div>
          </details>
        </div>
      </div>
    </div>

    <YearSlider compact />
    <section class="term-card" aria-label="交节时刻">
      <div><p class="eyebrow">二十四节气 · 当地时间</p><h2>{{ termEvent.name }}交节</h2>
        <p>{{ formatLocal(termEvent.ms, place.zone) }} · {{ place.zone }}</p>
        <p class="fine-print">太阳地心视黄经 {{ termEvent.longitude }}° · {{ termEvent.usesReference ? '采用官方分钟记录' : '算法计算，显示到分钟' }}</p>
        <p v-if="termEvent.source" class="fine-print"><a :href="termEvent.source" target="_blank" rel="noopener noreferrer">{{ termEvent.sourceLabel }}对照</a> · 计算相差 {{ termEvent.differenceSeconds.toFixed(1) }} 秒</p>
        <p v-else class="fine-print">此节点暂无已收录的独立参考时刻。</p>
        <p>下次交节 · {{ actual.next.name }} {{ formatLocal(actual.next.ms, place.zone) }}</p></div>
      <div class="scene-actions">
        <button type="button" @click="jump(termEvent.ms)">查看交节瞬间</button>
        <button type="button" @click="change(() => setInstant(solarMoment(localDate(termEvent.ms,place.zone),12),'date'))">交节当天午正</button>
        <button type="button" :disabled="localDate(actual.next.ms,place.zone) > MAX_DATE" @click="jump(actual.next.ms)">跳到下次交节</button>
      </div>
    </section>
    <HouSection />
    <LinkedRecords />
    <details class="gnomon-reference" @toggle="explanation=$event.target.open">
      <summary>展开全年影长与计算说明</summary>
      <template v-if="explanation">
        <AnnualShadowChart :term="term" :terms="terms" :observer="place" :cycle="current.cycle" @select-term="id => change(() => selectComparison(id))" />
        <p>观天测影主模型采用双面极轴晷面：晷针平行地轴，时线按真太阳时每小时十五度均匀分布。太阳位置采用 Astronomy Engine，UTC 为唯一内部时间。</p>
        <p>首页午正预览保留项目原有水平式参考模型；全年曲线明确为八尺竖表理论影长，与极轴晷面的 r/L 读数不混用。</p>
        <p>交节由地心太阳视黄经确定。切换观测地点可改变当地钟表显示及日影，同一次交节仍对应同一 UTC 瞬间。</p>
        <p><a href="https://www.hko.gov.hk/sc/gts/astronomy/Solar_Term.htm" target="_blank" rel="noopener noreferrer">香港天文台节气时间资料</a> · <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noopener noreferrer">天文算法来源</a></p>
      </template>
    </details>
  </section>
</template>

<style scoped>
.sky-heading {
  margin: 18px 0 14px;
}
.sky-heading h1 {
  font-size: clamp(26px, 2.7vw, 38px);
  letter-spacing: .08em;
}
.sundial-page .dial-experience {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(290px, 330px);
  align-items: start;
  gap: clamp(16px, 2vw, 28px);
  margin: 0 0 24px;
  padding: 0;
  border: 0;
  background: transparent;
}
.visual-panel {
  min-width: 0;
}
.scene-frame {
  --stage: #132922;
  --stage-edge: #385048;
  --stage-text: #f5ecda;
  --stage-muted: #b5c3b8;
  border: 1px solid var(--stage-edge);
  border-radius: 12px;
  overflow: hidden;
  background: var(--stage);
  color: var(--stage-text);
  box-shadow: 0 14px 32px #1329221a;
}
.scene-toolbar, .scene-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  padding: 12px 18px;
}
.scene-toolbar {
  padding-block: 8px;
  border-bottom: 1px solid var(--stage-edge);
}
.scene-name {
  min-width: 0;
}
.scene-name h2 {
  font-size: clamp(17px, 2.2vw, 24px);
}
.scene-name p {
  color: var(--stage-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.scene-name p span {
  margin-inline: 2px;
  color: #c5a473;
}
.scene-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: end;
  gap: 8px;
}
.scene-toolbar button {
  min-height: 44px;
  padding: 5px 12px;
  border: 1px solid #577066;
  border-radius: 5px;
  color: var(--stage-text);
  font-size: 13px;
  white-space: nowrap;
}
.scene-toolbar button:hover {
  background: #31493e;
}
.scene-toolbar button[aria-pressed=true] {
  border-color: #e0b778;
  background: #e9c794;
  color: #243e36;
}
.scene-toolbar button:focus-visible {
  outline-color: #e9c794;
  outline-offset: 2px;
}
.light-control {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.light-control .ui-icon {
  width: 16px;
  height: 16px;
}
.touch-toggle {
  display: none;
}
.scene-viewport {
  position: relative;
  height: clamp(400px, 49dvh, 570px);
  overflow: hidden;
  background: radial-gradient(ellipse at 50% 46%, #263e32, var(--stage) 74%);
}
.scene-overlay, .fallback-underlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.scene-note {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  max-width: calc(100% - 20px);
  padding: 5px 10px;
  border: 1px solid var(--stage-edge);
  border-radius: 4px;
  background: #132922e8;
  color: var(--stage-text);
  font-size: 12px;
  text-align: center;
}
.scene-footer {
  flex-wrap: wrap;
  justify-content: start;
  min-height: 40px;
  padding-block: 9px;
  border-top: 1px solid var(--stage-edge);
  color: var(--stage-muted);
  font-size: 11px;
}
.orbit-hint {
  margin-left: auto;
}
.scene-scale {
  margin-left: auto;
}
.orbit-hint + .scene-scale {
  margin-left: 0;
}
.view-controls, .quick-compare, .layers {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.view-controls {
  padding: 10px 0;
}
.visual-panel > .time-axis {
  margin-top: 12px;
}
.segmented, .mode-controls {
  display: flex;
  min-width: 0;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: #edece1;
}
:is(.observation-bar, .view-controls, .quick-compare, .layers, .term-card) :is(button, select, input:not([type=checkbox])) {
  min-height: 44px;
  min-width: 0;
  padding: 6px 11px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--surface);
  color: var(--ink);
  font-size: 13px;
}
:is(.view-controls, .quick-compare) .segmented button, .observation-bar .mode-controls button {
  flex: 1 0 auto;
  border-color: transparent;
  background: transparent;
}
:is(.observation-bar, .view-controls, .quick-compare, .layers, .term-card) button:not(:disabled):hover {
  border-color: #a6b5a6;
}
:is(.observation-bar, .view-controls, .quick-compare) button[aria-pressed=true] {
  border-color: #29483d;
  background: #29483d;
  color: #fffaf0;
}
.view-controls .reset-view {
  margin-left: auto;
}
.view-controls button {
  min-width: 44px;
}
.quick-compare {
  padding: 10px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.quick-compare > div:first-child {
  display: grid;
  margin-right: 4px;
}
.quick-compare span, .quick-compare label, .layers label {
  color: var(--muted);
  font-size: 12px;
}
.quick-compare strong {
  font-weight: 600;
  font-size: 14px;
}
.quick-compare label, .layers label {
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: 44px;
  cursor: pointer;
}
:is(.quick-compare, .layers) input {
  accent-color: var(--green);
}
.side-stack {
  display: grid;
  min-width: 0;
  gap: 12px;
}
.observation-panel, .layer-panel {
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}
.observation-panel h2 {
  margin-bottom: 10px;
  font-size: 20px;
}
.observation-bar, .clock-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: end;
  gap: 8px;
}
.observation-bar :is(.mode-controls, .place-field, .clock-form) {
  grid-column: 1 / -1;
}
.observation-bar label {
  display: grid;
  gap: 3px;
  min-width: 0;
  color: var(--muted);
  font-size: 12px;
}
.observation-bar :is(select, input:not([type=checkbox])) {
  width: 100%;
  padding-inline: 7px;
}
.observation-bar .now-button {
  justify-self: start;
}
.advanced {
  margin-top: 10px;
  border-top: 1px solid var(--line);
}
.advanced summary, .layer-panel summary, .gnomon-reference summary {
  min-height: 44px;
  padding-block: 10px;
  color: var(--green);
  cursor: pointer;
  font-size: 13px;
}
.advanced-form {
  padding-bottom: 8px;
}
.form-error {
  margin-top: 6px;
  padding: 9px 12px;
  border-left: 3px solid var(--accent);
  background: var(--accent-soft);
  color: #803726;
  font-size: 13px;
}
.layer-panel {
  padding-block: 0;
}
.layer-panel[open] {
  padding-bottom: 12px;
}
.term-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin: 18px 0;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}
.term-card p {
  margin-block: 5px;
}
.gnomon-reference {
  margin: 20px 0;
}
@media (max-width: 960px) {
  .sundial-page .dial-experience {
    grid-template-columns: minmax(0, 1fr);
  }
  .side-stack {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
  .layer-panel {
    grid-column: 1 / -1;
  }
}
@media (max-width: 640px) {
  .sky-heading {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .sundial-page .dial-experience {
    margin-top: 10px;
  }
  .heading-note {
    display: none;
  }
  .scene-toolbar, .scene-footer {
    padding-inline: 10px;
  }
  .scene-toolbar {
    padding-block: 8px;
  }
  .scene-toolbar button {
    padding-inline: 8px;
    font-size: 12px;
  }
  .scene-toolbar .scene-actions {
    gap: 5px;
  }
  .scene-viewport {
    height: clamp(300px, 43dvh, 430px);
  }
  .scene-footer {
    gap: 4px 10px;
  }
  .side-stack {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 420px) {
  .light-control .ui-icon {
    display: none;
  }
  .view-controls {
    column-gap: 5px;
  }
  .view-controls button {
    padding-inline: 8px;
  }
  .view-controls .reset-view {
    margin-left: 0;
  }
}
@media (pointer: coarse) {
  .touch-toggle {
    display: inline-block;
  }
  .orbit-hint {
    display: none;
  }
}
</style>
