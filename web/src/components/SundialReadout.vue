<script setup>
import { computed } from 'vue';

const props = defineProps({ bowl:Boolean, solar:Object, place:Object, clockText:String, offset:String, longitude:Number,
  actual:Object, message:String, compare:Boolean, comparisons:Array });
const status = computed(() => props.bowl ? (props.solar.altitude>0?'珠影在碗内':'夜间无直射影') : ({normal:'影端在晷面内',overflow:'影端越出晷面',night:'夜间无直射影',parallel:'春秋分光线平行晷面'}[props.solar?.polar?.status] ?? '—'));
const face = faceName => faceName === 'front' ? '正面' : faceName === 'back' ? '背面' : '—';
const fmt = value => Number.isFinite(value) ? value.toFixed(1)+'°' : '—';
const solarClock = computed(() => {
  const minutes = Math.round(props.solar.solarTime * 60) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2,'0')}:${String(minutes % 60).padStart(2,'0')}`;
});
</script>

<template>
  <aside class="readout" aria-label="当前观测读数">
    <h2>观测读数</h2>
    <div class="solar-clock">{{ solarClock }}<span>真太阳时</span></div>
    <p class="clock-caption">当地钟表 {{ clockText }} · UTC{{ offset }}<br>{{ place.zone }}</p>
    <dl class="dial-readings">
      <div><dt>太阳高度 / 方位</dt><dd>{{ fmt(solar.altitude) }} / {{ Math.abs(solar.altitude)>89.95||Math.abs(place.latitude)===90?'—':fmt(solar.azimuth) }}</dd></div>
      <div><dt>太阳赤纬 / 黄经</dt><dd>{{ fmt(solar.declination) }} / {{ fmt(longitude) }}</dd></div>
      <div><dt>时角</dt><dd>{{ fmt(solar.hourAngle) }}</dd></div>
      <div v-if="bowl"><dt>珠影水平偏移</dt><dd>{{ solar.altitude>0 ? Math.hypot(solar.polar.sun[0],solar.polar.sun[2]).toFixed(3)+' R' : '—' }}</dd></div>
      <div v-else><dt>影长 / 晷针长</dt><dd>{{ solar.polar.valid ? solar.polar.ratio.toFixed(2) : '—' }}</dd></div>
      <div v-if="!bowl"><dt>影所在面</dt><dd>{{ face(solar.polar.face) }}</dd></div>
      <div><dt>实际所处节气</dt><dd>{{ actual?.active.name }}</dd></div>
    </dl>
    <p class="status" :class="solar.polar.status">{{ status }}</p>
    <p v-if="message" class="dial-state-note" aria-live="polite">{{ message }}</p>
    <div v-if="compare && comparisons.length" class="compare-table">
      <div v-for="(item,index) in comparisons" :key="item.term.id" class="compare-row">
        <strong>{{ item.term.name }}<small>{{ index ? '对照' : '当前' }}</small></strong>
        <span v-if="bowl">δ {{ fmt(item.solar.declination) }} · {{ item.solar.altitude>0 ? Math.hypot(item.solar.polar.sun[0],item.solar.polar.sun[2]).toFixed(3)+' R' : '无直射影' }}</span>
        <span v-else>δ {{ fmt(item.solar.declination) }} · r/L {{ item.solar.polar.valid ? item.solar.polar.ratio.toFixed(2) : '—' }} · {{ face(item.solar.polar.face) }}</span>
      </div>
      <p>{{ bowl ? '同一真太阳时的珠影落在同一条时线上。' : '时线方向由真太阳时决定，影长和落影面随太阳赤纬变化。' }}</p>
    </div>
  </aside>
</template>

<style scoped>
.readout { padding:18px; background:var(--surface); border:1px solid var(--line); border-radius:8px; }
.readout h2 { margin-bottom:10px; font-size:20px; }
.solar-clock { font-family:var(--font-number); font-size:clamp(2.25rem,4vw,3.4rem); line-height:1.05; color:var(--ink); font-variant-numeric:tabular-nums; }
.solar-clock span { display:block; font:12px var(--font-body); color:var(--muted); margin-top:5px; }
.clock-caption,.dial-state-note { color:var(--muted); font-size:12px; line-height:1.7; }
.dial-readings { display:grid; grid-template-columns:1fr; gap:8px; margin:15px 0 10px; }
.dial-readings div { display:flex; justify-content:space-between; gap:12px; padding-top:7px; border-top:1px solid var(--line); }
dt { color:var(--muted); font-size:12px; } dd { margin:0; font:600 14px var(--font-number); text-align:right; }
.status { display:inline-block; margin:0 0 8px; padding:3px 8px; border-radius:3px; background:var(--surface-muted); color:var(--green); font-size:11px; }
.status.overflow,.status.parallel,.status.night { color:var(--accent); background:var(--accent-soft); }
.compare-table { margin-top:10px; padding-top:10px; border-top:1px solid var(--line); }
.compare-row { display:grid; gap:2px; padding:7px 0; }
.compare-row strong { display:flex; justify-content:space-between; font-size:13px; }
.compare-row small,.compare-row span,.compare-table p { color:var(--muted); font-size:11px; font-weight:400; }
.compare-table p { margin-top:7px; line-height:1.65; }
</style>
