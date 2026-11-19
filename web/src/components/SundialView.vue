<script setup>
import { computed, defineAsyncComponent, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SundialFallback from './SundialFallback.vue';
import BowlFallback from './BowlFallback.vue';
import AnnualShadowChart from './AnnualShadowChart.vue';
import YearSlider from './YearSlider.vue';
import HouSection from './HouSection.vue';
import LinkedRecords from './LinkedRecords.vue';
import TimeAxis from './TimeAxis.vue';
import RulerSegments from './RulerSegments.vue';
import PaperChoice from './PaperChoice.vue';
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
import { dialFaceForDeclination, SUNRISE_ALTITUDE, verticalGnomonShadow } from '../lib/astro/sundialObservation.js';
import { snapCalendarTerm, stepCalendarTerm, stepCivilYearDay, sundialCalendarTerms } from '../lib/astro/sundialCalendar.js';
import { CELESTIAL_COLORS, studioCss } from '../scene/sundial/sundialTheme.js';

const props = defineProps({ term: Object, terms: Array });
const emit = defineEmits(['select-term']);
const Scene = defineAsyncComponent({
  loader: () => import('./SundialScene.vue'),
  onError(_error, _retry, fail) { fallback.value = true; fail(); },
});
const route = useRoute(), router = useRouter();
const instrumentKind = computed(() => route.query.dial === 'bowl' ? 'bowl' : 'plate');
const isBowl = computed(() => instrumentKind.value === 'bowl');
const instruments=[{value:'plate',label:'赤道式'},{value:'bowl',label:'碗式'}];
const cameraOptions=computed(()=>[
  {value:'oblique',label:'斜视'},{value:'overhead',label:isBowl.value?'俯看碗内':'晷面'},
  {value:'side',label:'侧视'},{value:'north',label:'北侧'},{value:'south',label:'南侧'},
]);
const faceOptions=[{value:'front',label:'正面'},{value:'back',label:'背面'}];
const placeOptions=[...OBSERVERS.map(item=>({value:item.id,label:item.name})),{value:'custom',label:'自定义地点'}];
const cycleOptions=[2025,2026,2027,2028].map(value=>({value,label:String(value)}));
const termOptions=computed(()=>props.terms.map(item=>({value:item.id,label:item.name})));
const foldOptions=[{value:'reject',label:'提示选择'},{value:'earlier',label:'前一次'},{value:'later',label:'后一次'}];
function chooseInstrument(kind) {
  if(kind !== instrumentKind.value)router.replace({query:{...route.query,dial:kind==='bowl'?'bowl':undefined}});
}
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
const facingShadow = ref(true);
const advancedOpen = ref(false);
const layers = ref({ sky:false, shadow:false, ray:false, compass:false, dome:false });
const playing = ref(false), speed = ref(1), explanation = ref(false);
const comparePeer = ref(initial.selected === 'xiazhi' ? 'dongzhi' : 'xiazhi');
const solsticeMode = ref(false);
const comparisonDock = ref(null);
const wideLayout = window.matchMedia('(min-width:961px)');
const dockReadings = ref(wideLayout.matches);
function syncComparisonLayout() { dockReadings.value = wideLayout.matches; }
const equinox = ref(false);
const solsticeIds = ['xiazhi','dongzhi'];
const solsticeNames = { xiazhi:'夏至', dongzhi:'冬至' };
const showBoth = ref(false), xray = ref(false);
const debug = new URLSearchParams(location.search).get('debug') === 'geom';
let unsubscribe, active = false, requestedYearTerm = null, elapsed = 0, playBounds;
let beforeSolstice;

const place = computed(() => current.value.place);
const cycle = computed(() => current.value.cycle);
const stamp = computed(() => localStamp(current.value.ms, place.value.zone));
const date = computed(() => stamp.value.toPlainDate().toString());
const civilYear = computed(() => date.value.slice(0,4));
const yearTerms = computed(() => sundialCalendarTerms(`${civilYear.value}-01-01`,place.value.zone));
const eventOnDate = computed(() => yearTerms.value.find(event=>event.date===date.value));
const bounds = computed(() => dayBounds(date.value,place.value.zone));
// A civil date has one position on the year ruler, regardless of the selected hour.
const calendarLongitude = computed(() => {
  const [start,end] = bounds.value;
  return longitudeAt((start+end)/2);
});
const solar = computed(() => solarAt(current.value.ms, place.value));
const solsticeDays = computed(() => solsticeMode.value ? solsticeIds.map(id => {
  const day = localDate(cycleTerm(cycle.value,id).ms,place.value.zone);
  const points = dayTrack(day,place.value);
  return { id, day, points, tracks:splitTracks(points) };
}) : []);
const driverDay = computed(() => solsticeDays.value.find(item => item.id===current.value.selected));
const dayPoints = computed(() => driverDay.value?.points ?? dayTrack(date.value,place.value));
const tracks = computed(() => driverDay.value?.tracks ?? splitTracks(dayPoints.value));
function daylightFor(points) {
  const sample = points[Math.floor(points.length / 2)];
  return sample ? sunriseSunset(place.value.latitude,sample.declination,SUNRISE_ALTITUDE) : null;
}
const daylight = computed(() => daylightFor(dayPoints.value));
const solsticeDaylight = computed(() => solsticeDays.value.map(({id,points})=>({id,daylight:daylightFor(points)})));
const solarLongitude = computed(() => longitudeAt(current.value.ms));
const actual = computed(() => termAt(current.value.ms));
const compare = computed(() => current.value.mode === 'compare');
const compareTime = computed(() => compare.value ? current.value.requested : solar.value.solarTime);
const solsticePair = computed(() => solsticeDays.value.map(({id, day, tracks}) => {
  const ms = id===current.value.selected ? current.value.ms : atSolarTime(day,compareTime.value,place.value);
  const sample = ms == null ? null : id===current.value.selected ? solar.value : solarAt(ms,place.value);
  return { id, solar:sample, tracks, shadow:sample ? verticalGnomonShadow(sample.polar.sun) : null };
}));
const solsticeDifference = computed(() => {
  const [summer,winter] = solsticePair.value;
  return {
    altitude: summer?.solar && winter?.solar ? Math.abs(summer.solar.altitude-winter.solar.altitude) : null,
    length: summer?.shadow && winter?.shadow ? Math.abs(summer.shadow.lengthChi-winter.shadow.lengthChi) : null,
  };
});
const termEvent = computed(() => compare.value ? cycleTerm(current.value.cycle,current.value.selected)
  : eventOnDate.value ? termAt(eventOnDate.value.ms).active : actual.value.active);
const highlighted = computed(() => compare.value ? current.value.selected : eventOnDate.value?.id ?? actual.value.active.id);
const clockText = computed(() => stamp.value.toPlainTime().toString({ smallestUnit:'minute' }));
const sliderValue = computed(() => Math.round(solar.value.solarTime * 60) % 1440);
function termSample(id) {
  const event = cycleTerm(current.value.cycle,id);
  const day = localDate(event.ms,place.value.zone);
  const ms = atSolarTime(day,current.value.requested,place.value);
  if (ms == null) return null;
  return { term:event, ms, solar:solarAt(ms,place.value) };
}
const comparisons = computed(() => {
  if (!compare.value || solsticeMode.value) return [];
  try { return [termSample(current.value.selected),termSample(comparePeer.value)].filter(Boolean); }
  catch { return []; }
});
const secondarySolar = computed(() => comparisons.value[1]?.solar ?? null);
const isFlat = computed(() => fallback.value || forceFlat.value);
const geographicView = computed(() => ['side','north','south'].includes(preset.value));
const nearEquinox = computed(() => {
  const nearby = [date.value,stepCivilYearDay(date.value,-1),stepCivilYearDay(date.value,1)];
  return yearTerms.value.some(item=>['chunfen','qiufen'].includes(item.id)&&nearby.includes(item.date));
});
const declinationText = computed(() => {
  const value = solar.value.declination;
  return `赤纬 ${value>0?'+':''}${value.toFixed(1)}°`;
});
const seasonalFace = computed(() => {
  if(isBowl.value)return solar.value.altitude>0?'碗内受光 · 球心珠影':'地平线下 · 无直射日影';
  const receiving = dialFaceForDeclination(solar.value.declination);
  if (receiving === 'transition' || nearEquinox.value) return '分日·换面';
  if (solar.value.altitude<=0) return '地平线下 · 无直射日影';
  const northernFace = receiving === 'front';
  const lowerFace = northernFace ? place.value.latitude<0 : place.value.latitude>0;
  return `太阳在赤道以${northernFace?'北 · 北面受光':'南 · 南面受光'}${lowerFace?'，晷针影在晷面下方':''}`;
});
const annotatedShadow = computed(() => isFlat.value || layers.value.ray || layers.value.shadow || compare.value);
const message = computed(() => {
  if(isBowl.value)return solar.value.altitude<=0?'太阳在当地地平线下，无直射珠影。':layers.value.ray?'光线经过球心，圆圈标出珠影。':'';
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
function formatMeasure(value, unit) { return Number.isFinite(value) ? value.toFixed(2)+unit : '—'; }
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
  if (mode === 'date') leaveSolstice();
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
  if (!solsticeIds.includes(id)) leaveSolstice();
  if (comparePeer.value === id) comparePeer.value = id === 'xiazhi' ? 'dongzhi' : 'xiazhi';
}
function leaveSolstice() {
  if (!solsticeMode.value) return;
  solsticeMode.value = false;
  equinox.value = false;
  const previous = beforeSolstice;
  beforeSolstice = null;
  preset.value = previous.preset;
  followingShadow.value = previous.following;
  face.value = previous.following ? solar.value.polar.face ?? previous.face : previous.face;
  layers.value.ray = previous.ray;
  xray.value = previous.xray;
  reset.value++;
}
function toggleSolstice() {
  change(() => {
    if (solsticeMode.value) {
      const savedDate = localDate(beforeSolstice.ms,place.value.zone);
      setInstant(savedDate>=MIN_DATE && savedDate<=MAX_DATE ? beforeSolstice.ms : current.value.ms,'date');
      return;
    }
    const previous = { ms:current.value.ms, preset:preset.value, face:face.value, following:followingShadow.value,
      ray:layers.value.ray, xray:xray.value };
    selectComparison(current.value.selected==='dongzhi' ? 'dongzhi' : 'xiazhi',cycle.value,place.value,12);
    beforeSolstice = previous;
    solsticeMode.value = true;
    xray.value = false;
    setPreset('side');
  });
}
function setMode(mode) {
  if (solsticeMode.value) {
    if (mode === 'date') toggleSolstice();
    else change(leaveSolstice);
    return;
  }
  if (current.value.mode === mode) return;
  change(() => mode === 'compare' ? selectComparison(highlighted.value) : setInstant(current.value.ms,'date'));
}
function setPlace(nextPlace) {
  if (compare.value) selectComparison(current.value.selected,current.value.cycle,nextPlace);
  else setInstant(current.value.ms,'date',nextPlace);
}
function applyLocation() { change(() => setPlace(validateObserver({ ...draft.value, id:'custom', name:'自定义地点' }))); }
function choosePlace(id) {
  const selected = OBSERVERS.find(item => item.id === id);
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
function setCalendarDate(day) {
  if (day === date.value && !compare.value) return;
  setInstant(solarMoment(day,compareTime.value),'date');
}
function previewCalendarStep(days) {
  pause();
  try {
    setCalendarDate(stepCivilYearDay(date.value,days));
    error.value = '';
  } catch (issue) { error.value = issue.message; }
}
function finishCalendar({snap} = {}) {
  if (!snap) { commit(); return; }
  change(() => {
    const nearest = snapCalendarTerm(date.value,place.value.zone);
    if (nearest) setCalendarDate(nearest.date);
  });
}
function moveCalendarTerm(direction) {
  const event = stepCalendarTerm(date.value,place.value.zone,direction);
  if (event) change(() => setCalendarDate(event.date));
}
function chooseCalendarTerm(id) {
  const event = yearTerms.value.find(item=>item.id===id);
  if (event) change(() => setCalendarDate(event.date));
  else error.value = '这个节气在当前可观测的日期范围外。';
}
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
  if (geographicView.value) preset.value = 'oblique';
  face.value = value; reset.value++;
}
function showShadowFace() {
  const receiving = solar.value.polar.face;
  if (!receiving) return;
  followingShadow.value = true;
  face.value = receiving;
  setPreset(receiving==='front'?'north':'south');
}
function resetView() {
  followingShadow.value = true;
  face.value = solar.value.polar.face ?? 'front';
  setPreset(solsticeMode.value?'side':'oblique');
}
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
  pause(); current.value = restored; leaveSolstice(); syncDraft(); syncYear();
});
function activate() {
  if (active) return;
  active = true; mounted.value = true;
  if (!unsubscribe) unsubscribe = subscribeFrame(step);
  if (route.query.observeTerm === '1' && (!route.query.obs || props.term.id !== highlighted.value)) change(() => selectComparison(props.term.id));
  else if (!route.query.obs || route.query.observeTerm) commit(); else syncYear();
}
onMounted(() => {
  wideLayout.addEventListener('change',syncComparisonLayout);
  activate(); document.addEventListener('visibilitychange',onVisibility);
});
onActivated(activate);
function deactivate() {
  if (playing.value) saveObservation({ ...current.value });
  pause(); unsubscribe?.(); unsubscribe = null; active = false;
}
onDeactivated(deactivate);
onBeforeUnmount(() => { wideLayout.removeEventListener('change',syncComparisonLayout); deactivate(); document.removeEventListener('visibilitychange',onVisibility); });
syncDraft();
</script>

<template>
  <section class="sky-page sundial-page" :style="studioCss">
    <div class="sky-flow">
      <div class="page-heading sky-heading">
        <h1>观天测影</h1>
        <p class="heading-note">拨动真太阳时，在赤道式与碗式日晷上观察同一束阳光。</p>
      </div>

      <div class="dial-experience">
        <div class="visual-panel">
          <div class="scene-frame">
            <header class="scene-toolbar">
              <div class="scene-name">
                <h2>{{ isBowl ? '半球碗式日晷' : '双面赤道式日晷' }}</h2>
                <p>{{ place.name }}<span aria-hidden="true"> / </span>{{ date }}</p>
              </div>
              <div class="view-modes">
                <button type="button" :aria-pressed="solsticeMode" @click="toggleSolstice">二至对照</button>
                <button v-if="!isFlat" type="button" :aria-pressed="layers.dome"
                @click="layers.dome=!layers.dome">{{ layers.dome ? '回看日晷' : '展开天球' }}</button>
              </div>
              <div class="scene-switches">
                <RulerSegments label="日晷器型" :model-value="instrumentKind" :options="instruments" @update:model-value="chooseInstrument"/>
                <RulerSegments v-if="!isFlat" label="观察视角" :model-value="preset" :options="cameraOptions" @update:model-value="setPreset"/>
              </div>
            </header>
            <div class="scene-viewport" :class="{'dome-viewport':layers.dome && !isFlat}" aria-label="日晷观测图">
              <BowlFallback v-if="(isFlat || !ready) && isBowl" class="fallback-underlay" :latitude="place.latitude" :solar="solar" :layers="layers"
                :tracks="tracks" :solstice-driver="solsticeMode ? current.selected : undefined" :secondary="solsticeMode ? solsticePair.find(item=>item.id!==current.selected)?.solar : showBoth ? secondarySolar : null" />
              <SundialFallback v-else-if="isFlat || !ready" class="fallback-underlay" polar-mode :face="face"
                :solar="solar" :latitude="place.latitude" :tracks="tracks" :layers="layers" :solstices="solsticePair" />
              <Scene v-if="mounted && !isFlat" :instrument-kind="instrumentKind" class="scene-overlay" :solar="solar" :latitude="place.latitude"
                :tracks="tracks" :layers="layers" :preset="preset" :face="face" :reset="reset" :touch-active="touchActive" :low="low"
                :xray="!isBowl && compare && xray" :secondary="secondarySolar" :show-both="showBoth" :compare="compare"
                :solstices="solsticePair" :solstice-driver="solsticeMode ? current.selected : undefined" :equinox="equinox" :longitude="solarLongitude"
                :reduced-motion="motionPreferences.reduced.value" :debug="debug"
                @ready="ready=true" @unavailable="fallback=true; ready=false" @view-change="onSceneView"
                @face-visibility="facingShadow=$event" />
              <p v-if="fallback" class="scene-note" role="status">三维暂不可用，已切换为二维图。</p>
              <p v-else-if="!forceFlat && !ready" class="scene-note" role="status">正在准备三维场景</p>
            </div>
            <Teleport v-if="solsticeMode" :to="comparisonDock" :disabled="!dockReadings || !comparisonDock">
              <section class="solstice-comparison" aria-label="二至对照读数">
                <div class="comparison-heading">
                  <h2>二至对照</h2>
                  <div class="scene-driver" role="group" aria-label="驱动日照的节气">
                      <button v-for="id in solsticeIds" :key="id" type="button" :aria-pressed="current.selected===id"
                        @click="change(() => selectComparison(id))">{{ solsticeNames[id] }}</button>
                  </div>
                </div>
                <div class="quick-compare">
                  <span>同一真太阳时 {{ formatSolarTime(compareTime) }}</span>
                  <label v-if="!isFlat && !isBowl"><input v-model="xray" type="checkbox" />透视晷面</label>
                  <label v-if="!isFlat"><input v-model="equinox" type="checkbox" />分日参考弧</label>
                </div>
                <table class="solstice-readings">
                  <thead>
                    <tr>
                      <th scope="col">观测量</th>
                      <th v-for="item in solsticePair" :key="item.id" scope="col" :class="item.id">{{ solsticeNames[item.id] }}</th>
                      <th scope="col">差值</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">太阳高度</th>
                      <td v-for="item in solsticePair" :key="item.id" :class="item.id">{{ formatMeasure(item.solar?.altitude,'°') }}</td>
                      <td>{{ formatMeasure(solsticeDifference.altitude,'°') }}</td>
                    </tr>
                    <tr>
                      <th scope="row">八尺表影长</th>
                      <td v-for="item in solsticePair" :key="item.id" :class="item.id">{{ item.solar && !item.shadow ? '无直射影' : formatMeasure(item.shadow?.lengthChi,' 尺') }}</td>
                      <td>{{ formatMeasure(solsticeDifference.length,' 尺') }}</td>
                    </tr>
                  </tbody>
                </table>
              </section>
            </Teleport>
            <section class="time-bands" aria-label="授时尺">
              <TimeAxis :value="sliderValue" :playing="playing" v-model:speed="speed" :solar="solar" :daylight="daylight"
                :samples="dayPoints" :comparison="solsticeDaylight"
                @input="previewSlider" @commit="commit()" @toggle-play="togglePlay" @step="stepMinutes" @noon="setNoon">
                <YearSlider sky-band :longitude="calendarLongitude" :date="date" :active-term="highlighted"
                  :reduced-motion="motionPreferences.reduced.value" @day-step="previewCalendarStep" @finish="finishCalendar"
                  @term-step="moveCalendarTerm" @select-term="chooseCalendarTerm"/>
              </TimeAxis>
            </section>
            <div class="scene-tools" aria-label="观测工具">
                <button type="button" class="light-control" :aria-pressed="layers.ray" @click="layers.ray=!layers.ray">
                  <UiIcon name="sun" />光影关系
                </button>
                <button v-if="!isFlat" type="button" class="touch-toggle" :aria-pressed="touchActive"
                  @click="touchActive=!touchActive">{{ touchActive ? '恢复滚动' : '触摸旋转' }}</button>

                <div class="surface-tools">
                  <RulerSegments v-if="!isBowl" label="晷面" :model-value="isFlat||!geographicView?face:null" :options="faceOptions" @update:model-value="setFace"/>
                  <button v-if="!isBowl" type="button" :disabled="!solar.polar.face" @click="showShadowFace">看影面</button>
                  <button v-if="!isFlat" type="button" @click="resetView">复位</button>
                </div>
            </div>
            <footer class="scene-footer">
              <SundialLegend :layers="layers" :shadow-visible="solar.altitude>0 && (isBowl || !isFlat || (solar.polar.valid && solar.polar.face===face))"
                :shadow-marker="annotatedShadow && (isBowl ? solar.altitude>0 : solar.polar.inside && (!isFlat || solar.polar.face===face))"
                :ray-visible="solar.altitude>0 && (isBowl || !isFlat || (solar.polar.valid && solar.polar.face===face))" />
              <p class="face-badge">{{ seasonalFace }} <span>{{ declinationText }}</span></p>
              <p v-if="!isFlat" class="orbit-hint">拖动旋转 · 滚轮缩放</p>
              <span v-if="!isFlat && (layers.dome || layers.sky || solsticeMode || compare)" class="scene-scale">{{ [layers.dome ? '天球半径非比例' : layers.sky ? '天空轨迹非比例' : '', (solsticeMode || compare) ? '圭表比例为示意' : ''].filter(Boolean).join(' · ') }}</span>
              <p v-if="layers.dome && !isFlat" class="dome-credit">外视天球，星象左右相反
                <span class="dome-key" :style="{ color:CELESTIAL_COLORS.horizon }">地平圈</span>
                <span class="dome-key" :style="{ color:CELESTIAL_COLORS.equator }">天赤道</span>
                <span class="dome-key" :style="{ color:CELESTIAL_COLORS.ecliptic }">黄道</span>
                <a href="https://github.com/astronexus/HYG-Database/blob/main/hyg/README.md" target="_blank" rel="noopener noreferrer">星表摘录 David Nash / HYG v4.1</a>
                <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>
              </p>
              <div v-if="!isBowl && ready && !isFlat && solar.polar.valid && !facingShadow" class="face-hint">
                <span>影在{{ solar.polar.face==='back' ? '南面' : '北面' }}。</span>
                <button type="button" @click="showShadowFace">点此查看</button>
              </div>
            </footer>
          </div>
          <section v-if="compare && !solsticeMode && !isFlat" class="quick-compare" aria-label="节气比较图层">
              <span>比较图层</span>
              <label><input v-model="showBoth" type="checkbox" />同时显示</label>
              <label v-if="!isBowl"><input v-model="xray" type="checkbox" />透视晷面</label>
          </section>
        </div>

        <div class="side-stack">
          <div ref="comparisonDock" class="comparison-dock"></div>
          <section class="observation-panel" aria-labelledby="observation-title">
            <h2 id="observation-title">观测条件</h2>
            <div class="observation-bar">
              <div class="mode-controls" aria-label="观测方式">
                <button type="button" :aria-pressed="!compare" @click="setMode('date')">按日期观测</button>
                <button type="button" :aria-pressed="compare && !solsticeMode" @click="setMode('compare')">按节气比较</button>
              </div>
              <label class="place-field">观测地点
                <PaperChoice label="观测地点" :model-value="draft.id" :options="placeOptions" @update:model-value="choosePlace"/>
              </label>
              <template v-if="compare">
                <label>立春周期
                  <PaperChoice label="立春周期" :model-value="current.cycle" :options="cycleOptions" @update:model-value="value=>change(()=>selectComparison(current.selected,value))"/>
                </label>
                <template v-if="!solsticeMode">
                  <label>比较节气
                    <PaperChoice label="比较节气" :model-value="current.selected" :options="termOptions" @update:model-value="id=>change(()=>selectComparison(id))"/>
                  </label>
                  <label>对照节气
                    <PaperChoice label="对照节气" v-model="comparePeer" :options="termOptions"/>
                  </label>
                </template>
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
                  <PaperChoice label="重复钟点" v-model="draft.disambiguation" :options="foldOptions"/>
                </label>
              </form>
            </details>
            <p v-if="error" class="form-error" role="alert">{{ error }}</p>
          </section>
          <SundialReadout :bowl="isBowl" :solar="solar" :place="place" :clock-text="clockText" :offset="stamp.offset"
            :longitude="solarLongitude" :actual="actual" :message="message" :compare="compare" :comparisons="comparisons" />
          <details class="layer-panel">
            <summary>图层与画质</summary>
            <div class="layers">
              <label><input v-model="layers.sky" type="checkbox" />太阳轨迹</label>
              <label><input v-model="layers.shadow" type="checkbox" />影端轨迹</label>
              <label v-if="!isFlat"><input v-model="layers.compass" type="checkbox" />方位</label>
              <label v-if="!isFlat"><input v-model="low" type="checkbox" />轻量画质</label>
              <button type="button" :aria-pressed="speed===.5" @click="speed=speed===.5?1:.5">慢放 0.5×</button>
              <button type="button" @click="toggleView">{{ isFlat ? '启用三维' : '切换二维图' }}</button>
            </div>
          </details>
        </div>
      </div>
    </div>

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
        <p>赤道式晷针平行地轴，时线按真太阳时每小时十五度均匀分布。碗式以球心铜珠投影，在半球内壁读取时线与节气线。太阳位置采用 Astronomy Engine，UTC 为唯一内部时间。</p>
        <p>首页午正预览保留项目原有水平式参考模型；全年曲线明确为八尺竖表理论影长，与极轴晷面的 r/L 读数不混用。</p>
        <p>交节由地心太阳视黄经确定。切换观测地点可改变当地钟表显示及日影，同一次交节仍对应同一 UTC 瞬间。</p>
        <p><a href="https://www.hko.gov.hk/sc/gts/astronomy/Solar_Term.htm" target="_blank" rel="noopener noreferrer">香港天文台节气时间资料</a> · <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noopener noreferrer">天文算法来源</a></p>
      </template>
    </details>
  </section>
</template>

<style scoped>
.sundial-page {
  --paper: var(--dial-paper);
  --surface: var(--dial-paper);
  --surface-muted: var(--dial-marble);
  --ink: var(--dial-ink);
  --muted: var(--dial-lightInk);
  --accent: var(--dial-cinnabar);
  --accent-soft: color-mix(in srgb,var(--dial-cinnabar) 8%,var(--dial-paper));
  --accent-line: color-mix(in srgb,var(--dial-cinnabar) 40%,var(--dial-paper));
  --green: var(--dial-bronzeDark);
  --line: var(--dial-paperEdge);
  color: var(--dial-ink);
}
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
  --stage: var(--dial-paper);
  --stage-edge: var(--dial-stoneLine);
  --stage-text: var(--dial-ink);
  --stage-muted: var(--dial-lightInk);
  border: 1px solid var(--stage-edge);
  border-radius: 12px;
  overflow: hidden;
  background: var(--stage);
  color: var(--stage-text);
  box-shadow: 0 14px 32px color-mix(in srgb,var(--dial-shadow) 12%,transparent);
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
  color: var(--dial-bronze);
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
  border: 1px solid var(--dial-stoneLine);
  border-radius: 5px;
  color: var(--stage-text);
  font-size: 13px;
  white-space: nowrap;
}
.scene-toolbar button:hover {
  background: var(--dial-paperEdge);
}
.scene-toolbar button[aria-pressed=true] {
  border-color: var(--dial-bronzeDark);
  background: var(--dial-bronzeDark);
  color: var(--dial-paper);
}
.scene-toolbar button:focus-visible {
  outline-color: var(--dial-bronzeDark);
  outline-offset: 2px;
}
.scene-driver {
  display: inline-flex;
  align-items: stretch;
}
.scene-driver button:first-child {
  border-start-end-radius: 0;
  border-end-end-radius: 0;
}
.scene-driver button:last-child {
  margin-inline-start: -1px;
  border-start-start-radius: 0;
  border-end-start-radius: 0;
}
.scene-driver button[aria-pressed=true] {
  z-index: 1;
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
  height: clamp(420px, 56dvh, 610px);
  overflow: hidden;
  background: var(--dial-background);
}
.scene-viewport.dome-viewport {
  height: clamp(460px, 56dvh, 650px);
}
.dome-credit {
  flex-basis: 100%;
  margin: 0;
  color: var(--stage-muted);
}
.dome-credit a {
  color: var(--stage-text);
  margin-inline-start: 8px;
  text-decoration: underline;
}
.dome-key {
  display: inline-block;
  margin-inline-start: 9px;
}
.dome-key::before {
  content: '';
  display: inline-block;
  width: 9px;
  margin-inline-end: 4px;
  vertical-align: middle;
  border-top: 1px solid currentColor;
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
  background: var(--dial-paper);
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
.face-badge {
  padding: 3px 8px;
  border: 1px solid var(--dial-stoneLine);
  border-radius: 4px;
  color: var(--stage-text);
}
.face-badge span {
  margin-inline-start: 4px;
  color: var(--dial-bronze);
  font-variant-numeric: tabular-nums;
}
.face-hint {
  display: flex;
  flex: 1 0 100%;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  border-top: 1px solid var(--stage-edge);
  color: var(--stage-text);
}
.face-hint button {
  min-height: 44px;
  padding-inline: 4px;
  color: var(--dial-bronzeDark);
  text-decoration: underline;
  text-underline-offset: .2em;
}
.face-hint button:focus-visible {
  outline-color: var(--dial-bronzeDark);
}
.quick-compare, .layers {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.segmented, .mode-controls {
  display: flex;
  min-width: 0;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--dial-paperEdge);
}
:is(.observation-bar, .quick-compare, .layers, .term-card) :is(button, input:not([type=checkbox])) {
  min-height: 44px;
  min-width: 0;
  padding: 6px 11px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--surface);
  color: var(--ink);
  font-size: 13px;
}
.quick-compare .segmented button, .observation-bar .mode-controls button {
  flex: 1 0 auto;
  border-color: transparent;
  background: transparent;
}
:is(.observation-bar, .quick-compare, .layers, .term-card) button:not(:disabled):hover {
  border-color: var(--dial-stoneLine);
}
:is(.observation-bar, .quick-compare) button[aria-pressed=true] {
  border-color: var(--dial-bronzeDark);
  background: var(--dial-bronzeDark);
  color: var(--dial-paper);
}
.quick-compare {
  padding: 10px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.quick-compare span, .quick-compare label, .layers label {
  color: var(--muted);
  font-size: 12px;
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
.comparison-dock:empty {display:none;}
.comparison-heading {display:flex;align-items:center;justify-content:space-between;gap:8px;}
.comparison-heading h2 {font:20px var(--ruler-font);}
.comparison-heading button {min-height:36px;padding:4px 10px;border:1px solid var(--line);}
.comparison-heading button[aria-pressed=true] {color:var(--dial-paper);background:var(--dial-ink);}
.solstice-comparison {
  padding: 12px 14px 8px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}
.solstice-comparison .quick-compare {
  border-top: 0;
  gap: 6px 12px;
}
.solstice-readings {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.solstice-readings th, .solstice-readings td {
  padding: 8px 5px;
  text-align: right;
}
.solstice-readings th:first-child {
  text-align: left;
}
.solstice-readings tbody th {
  color: var(--muted);
  font-weight: 400;
}
.solstice-readings tbody tr {
  border-top: 1px solid var(--line);
}
.solstice-readings .xiazhi {
  color: var(--dial-cinnabar);
}
.solstice-readings .dongzhi {
  color: var(--dial-winter);
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
  color: var(--dial-cinnabar);
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
@media (min-width:961px) and (max-height:800px) {
  .scene-viewport {height:clamp(320px,46dvh,370px);}
  .scene-viewport.dome-viewport {height:clamp(350px,50dvh,400px);}
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
  .scene-toolbar {
    flex-wrap: wrap;
  }
  .scene-viewport {
    height: clamp(300px, 43dvh, 430px);
  }
  .scene-viewport.dome-viewport {
    height: clamp(320px, 46dvh, 450px);
  }
  .scene-footer {
    gap: 4px 10px;
  }
  .side-stack {
    grid-template-columns: minmax(0, 1fr);
  }
  .solstice-comparison {
    padding-inline: 9px;
  }
}
@media (max-width: 420px) {
  .light-control .ui-icon {
    display: none;
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


/* Both instruments read against the same sheet and the same column of graduations. */
.time-bands {
  --ruler-pad:18px; --ruler-label:38px;
  --ruler-rule:color-mix(in srgb,var(--dial-lightInk) 40%,transparent);
  --ruler-mark:color-mix(in srgb,var(--dial-lightInk) 70%,var(--dial-ink));
  border-top:1px solid var(--ruler-rule);
  background:var(--dial-paper); container-type:inline-size;
}
.time-bands :deep(.ruler-row) {
  display:grid; grid-template-columns:var(--ruler-label) minmax(0,1fr);
  align-items:center; gap:12px; margin-inline:var(--ruler-pad);
}
.time-bands :deep(.year-row) {padding-top:10px;padding-bottom:3px;border-top:1px solid var(--ruler-rule);}
.time-bands :deep(.day-row) {padding-block:4px;}
.time-bands :deep(.ruler-label) {align-self:stretch;display:grid;align-items:center;border-right:1px solid var(--ruler-rule);font:20px/1 var(--ruler-font);color:var(--dial-ink);}
.scene-frame {border-radius:2px;border-color:color-mix(in srgb,var(--dial-lightInk) 40%,transparent);box-shadow:none;}
.scene-toolbar {align-items:center;justify-content:space-between;gap:6px 12px;font-family:var(--ruler-font);}
.scene-name h2 {font:20px/1.4 var(--ruler-font);}
.scene-switches,.scene-tools,.surface-tools {display:flex;align-items:center;}
.scene-toolbar {flex-wrap:wrap;}
.view-modes {display:flex;align-items:center;gap:5px;margin-left:auto;}
.scene-switches {margin-left:0;gap:8px;flex-wrap:nowrap;max-width:100%;overflow-x:auto;}
.scene-switches > :last-child:not(:first-child) {padding-left:8px;border-left:1px solid var(--stage-edge);}
.scene-tools {gap:6px;flex-wrap:wrap;padding:6px 14px;border-top:1px solid var(--line);font:14px/1.2 var(--ruler-font);}
.scene-tools > button,.surface-tools > button,.scene-tools .scene-driver button {
  min-height:32px;padding:4px 9px;border:1px solid var(--dial-lightInk);border-radius:2px;background:transparent;color:var(--dial-ink);font:inherit;
}
.scene-tools button[aria-pressed=true],.observation-bar .mode-controls button[aria-pressed=true] {background:transparent;color:var(--dial-cinnabar);text-decoration:underline;text-underline-offset:4px;}
.scene-tools button:not(:disabled):hover {border-color:var(--dial-cinnabar);color:var(--dial-cinnabar);}
.scene-tools button:focus-visible {outline:2px solid var(--dial-cinnabar);outline-offset:1px;}
.surface-tools {margin-left:auto;gap:6px;}
.observation-bar .paper-choice {display:block;}
.observation-bar .mode-controls {background:transparent;border-radius:2px;}
.observation-panel :is(input,button),.term-card button,.layers button {border-radius:2px;}
@media(max-width:640px){
  .time-bands {--ruler-pad:10px;--ruler-label:27px;}
  .time-bands :deep(.ruler-row) {gap:8px;}
  .scene-toolbar {display:grid;grid-template-columns:minmax(0,1fr) auto;gap:0 4px;padding:6px 9px 0;}
  .scene-switches {grid-column:1 / -1;}
  .scene-switches {margin-left:0;justify-self:end;gap:3px;}
  .scene-switches > :last-child:not(:first-child) {padding-left:4px;}
  .scene-tools {gap:5px;padding:4px 8px;font-size:12px;}
  .scene-tools > button,.surface-tools > button,.scene-tools .scene-driver button {min-height:40px;padding-inline:6px;}
  .scene-name {display:flex;align-items:baseline;gap:7px;flex-wrap:wrap;}
}
</style>
