<script setup>
import { computed, nextTick, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { TERMS, getTerm, adjacentTerm } from './data/terms.js';
import { year } from './state/year.js';
import { motionPreferences } from './core/loop.js';
import SeasonAtmosphere from './components/SeasonAtmosphere.vue';
import MotionDebug from './components/MotionDebug.vue';

const route = useRoute();
const router = useRouter();
year.initialize(route.query.term);
const term = year.term;
const region = computed(() => ['north', 'south'].includes(route.query.region) ? route.query.region : 'both');
const previewLongitude = ref(null);
const drawer = ref(null);
const drawerHeading = ref(null);
let triggerElement = null;
const origins = ref({});
try {
  const saved = JSON.parse(sessionStorage.getItem('shoushi-detail-origins') || '{}');
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) origins.value = saved;
} catch { /* Optional session state. */ }
const currentOrigin = computed(() => {
  const key = route.query.origin;
  return typeof key === 'string' && Object.hasOwn(origins.value, key) ? origins.value[key] : null;
});
const hasOrigin = computed(() => Boolean(route.name === 'detail' && currentOrigin.value?.key && currentOrigin.value.key === route.query.origin));
const chapters = [
  { name: 'overview', label: '授时总览', number: '壹' },
  { name: 'farm', label: '农事长卷', number: '贰' },
  { name: 'sky', label: '观天测影', number: '叁' },
  { name: 'ancient', label: '古图解读', number: '肆' },
];

function selectTerm(id) {
  previewLongitude.value = null;
  year.selectTerm(id);
}
watch(() => route.query.term, id => { if (id && id !== year.term.value.id) year.selectTerm(id); });
watch(() => year.state.settled, () => {
  if (route.query.term !== term.value.id) router.replace({ name: route.name, query: { ...route.query, term: term.value.id } });
});
const circularNavigation = ref(false);
async function pageTransition(update) {
  // 页面内裁切保留真实DOM交互，避免整页快照转场吞掉快速连点。
  circularNavigation.value = !motionPreferences.reduced.value;
  await update();
  await nextTick();
}
function interruptTransition(event) {
  circularNavigation.value = false;
  document.documentElement.style.setProperty('--transition-x', `${event.clientX}px`);
  document.documentElement.style.setProperty('--transition-y', `${event.clientY}px`);
}
function globalKey(event) {
  if (event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
  if (event.key.toLowerCase() === 'd') year.setDebug(!year.state.debug);
  if (event.key === 'Escape') { year.setPanel(false); year.clearFocus(); circularNavigation.value = false; }
}
onMounted(() => {
  year.setDebug(new URLSearchParams(location.search || location.hash.split('?')[1]).get('debug') === '1');
  window.addEventListener('pointerdown', interruptTransition, true); window.addEventListener('keydown', globalKey);
});
onBeforeUnmount(() => { window.removeEventListener('pointerdown', interruptTransition, true); window.removeEventListener('keydown', globalKey); });
function selectRegion(value) {
  router.replace({ name: route.name, query: { ...route.query, term: term.value.id, region: value } });
}
function navigate(name) {
  circularNavigation.value = false;
  router.push({ name, query: { term: term.value.id, region: region.value } });
}
function openDetail() {
  const snapshot = { key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: route.name, query: { ...route.query, term: term.value.id, region: region.value }, scroll: window.scrollY };
  origins.value[snapshot.key] = snapshot;
  try { sessionStorage.setItem('shoushi-detail-origins', JSON.stringify(origins.value)); } catch { /* Storage may be unavailable. */ }
  pageTransition(() => router.push({ name: 'detail', query: { term: term.value.id, region: region.value, origin: snapshot.key } }));
}
async function returnOrigin() {
  const target = currentOrigin.value;
  if (hasOrigin.value && target && ['overview', 'farm', 'sky', 'ancient'].includes(target.name)) {
    await pageTransition(() => router.push({ name: target.name, query: target.query }));
    await nextTick();
    if (route.name === target.name && route.query.term === target.query.term) window.scrollTo({ top: target.scroll || 0 });
  } else navigate('overview');
}
async function openSource(title = '资料出处') {
  triggerElement = document.activeElement;
  drawer.value = title;
  await nextTick();
  drawerHeading.value?.focus();
}
function closeSource() {
  drawer.value = null;
  triggerElement?.focus();
}
function focusMain() {
  document.getElementById('main-content')?.focus();
}
function hideChapter(element) { element.inert = true; element.setAttribute('aria-hidden', 'true'); }
function showChapter(element) { element.inert = false; element.removeAttribute('aria-hidden'); }
function trapFocus(event) {
  if (event.key === 'Escape') { closeSource(); return; }
  if (event.key !== 'Tab') return;
  const items = [...event.currentTarget.querySelectorAll('button, a[href], [tabindex="0"]')];
  const first = items[0], last = items.at(-1);
  if (event.shiftKey && (document.activeElement === first || document.activeElement === drawerHeading.value)) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}
watch(() => route.fullPath, () => {
  previewLongitude.value = null;
  drawer.value = null;
});
watch(drawer, value => { document.body.style.overflow = value ? 'hidden' : ''; });
watch([motionPreferences.reduced,motionPreferences.mode], ([value,mode]) => {
  document.documentElement.dataset.reducedMotion=String(value);
  document.documentElement.dataset.motionMode=mode===null?'auto':mode?'reduce':'full';
}, {immediate:true});
</script>

<template>
  <SeasonAtmosphere />
  <a class="skip-link" href="#main-content" @click.prevent="focusMain">跳到正文</a>
  <header class="site-header">
    <button class="brand" @click="navigate('overview')" aria-label="转动的授时图，返回总览">
      <span class="brand-seal">时</span>
      <span><strong>转动的授时图</strong><small>观天时 · 知农事</small></span>
    </button>
    <nav class="main-nav" aria-label="主题篇章">
      <button v-for="chapter in chapters" :key="chapter.name" :class="{ active: route.name === chapter.name }" :aria-current="route.name === chapter.name ? 'page' : undefined" @click="navigate(chapter.name)">
        <small>{{ chapter.number }}</small>{{ chapter.label }}
      </button>
    </nav>
    <button class="source-link" @click="navigate('sources')">资料与说明 <span>↗</span></button>
  </header>

  <main id="main-content" class="page-shell" tabindex="-1">
    <div class="context-bar">
      <div class="context-label"><span class="status-dot"></span>交互原型 <span class="context-separator">/</span> 史料待补</div>
      <div class="term-control">
        <span class="control-label">当前节气</span>
        <button class="arrow-button" aria-label="上一节气" @click="selectTerm(adjacentTerm(term.id, -1).id)">←</button>
        <label class="sr-only" for="term-picker">选择节气</label>
        <select id="term-picker" :value="term.id" @change="selectTerm($event.target.value)">
          <option v-for="item in TERMS" :key="item.id" :value="item.id">{{ item.name }} · {{ item.longitude }}°</option>
        </select>
        <button class="arrow-button" aria-label="下一节气" @click="selectTerm(adjacentTerm(term.id, 1).id)">→</button>
        <button class="today-button" :aria-pressed="year.state.atmosphere" @click="year.setAtmosphere(!year.state.atmosphere)">{{ year.state.atmosphere ? '季相氛围 开' : '季相氛围 关' }}</button>
      </div>
    </div>

    <RouterView v-slot="{ Component }">
      <Transition name="chapter" @before-leave="hideChapter" @before-enter="showChapter" @leave-cancelled="showChapter"><KeepAlive>
        <component :is="Component" :class="{'circle-entry':circularNavigation}" :term="term" :terms="TERMS" :region="region" :preview-longitude="year.longitude.value" :origin-label="hasOrigin ? getTerm(currentOrigin?.query?.term).name : ''"
          @select-term="selectTerm" @update:region="selectRegion" @navigate="navigate"
          @open-detail="openDetail" @return-origin="returnOrigin" @open-source="openSource"
          @preview="previewLongitude = $event" @preview-end="previewLongitude = null" />
      </KeepAlive></Transition>
    </RouterView>
  </main>

  <footer class="site-footer"><span>天有其时，地有其宜。</span><button class="text-link" :aria-pressed="motionPreferences.reduced.value" @click="motionPreferences.setManualReduced(!motionPreferences.reduced.value)">减少动态效果 {{motionPreferences.reduced.value?'开':'关'}}{{motionPreferences.mode.value===null?' · 遵循系统':''}}</button><span>二十四节气 · 七十二候 <i>／</i> 产品交互原型 v0.2</span></footer>
  <MotionDebug />

  <Teleport to="body">
    <div v-if="drawer" class="drawer-backdrop" @click.self="closeSource">
      <section class="source-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" @keydown="trapFocus">
        <div class="drawer-top"><span class="eyebrow">资料索引</span><button class="quiet-button" aria-label="关闭出处" @click="closeSource">关闭 ×</button></div>
        <h2 id="drawer-title" ref="drawerHeading" tabindex="-1">{{ drawer }}</h2>
        <span class="pending-label">等待资料核验</span>
        <p class="body-copy">这部分的原文与出处尚未录入。确认底本、卷页与适用范围后，将在这里展示完整依据。</p>
        <dl class="source-fields"><div v-for="label in ['文献名称','作者 / 责任者','版本与卷页','原文及释义','地域与资料时期','来源链接 / 影印定位']" :key="label"><dt>{{ label }}</dt><dd>待补充</dd></div></dl>
        <button class="button" @click="closeSource">返回继续探索</button>
      </section>
    </div>
  </Teleport>
</template>
