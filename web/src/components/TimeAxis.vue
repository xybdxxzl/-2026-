<script setup>
import { computed } from 'vue';

const props = defineProps({ value:Number, playing:Boolean, speed:Number, solar:Object, daylight:Object });
const emit = defineEmits(['input','commit','toggle-play','step','noon','update:speed']);
const lastMinute = 1439;
const names = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const fmt = minutes => `${String(Math.floor(minutes / 60)).padStart(2,'0')}:${String(minutes % 60).padStart(2,'0')}`;
const percent = minutes => `${Math.max(0, Math.min(lastMinute, minutes)) / lastMinute * 100}%`;
const ticks = names.map((name,index) => ({ name, position:percent(index * 120), major:index % 3 === 0 }));
const minute = computed(() => Math.max(0, Math.min(lastMinute, Math.round(props.value))));
const hourName = computed(() => names[Math.floor((minute.value + 60) % 1440 / 120)]);
const text = computed(() => {
  const altitude = props.solar?.altitude;
  const time = `真太阳时 ${fmt(minute.value)}（${hourName.value}时）`;
  return Number.isFinite(altitude) ? `${time}，太阳高度 ${altitude.toFixed(1)}°` : time;
});
const crossings = computed(() => {
  const day = props.daylight;
  if (day?.state !== 'regular' || !Number.isFinite(day.sunrise) || !Number.isFinite(day.sunset)) return null;
  return { sunrise: day.sunrise * 60, sunset: day.sunset * 60 };
});
const railStyle = computed(() => ({
  '--sunrise': crossings.value ? percent(crossings.value.sunrise) : '0%',
  '--sunset': crossings.value ? percent(crossings.value.sunset) : '100%',
  '--selected-time': percent(minute.value),
}));
</script>

<template>
  <section class="time-axis" aria-label="一日真太阳时">
    <div class="axis-header">
      <div class="axis-readout">
        <strong>{{ fmt(minute) }}</strong>
        <span>真太阳时<br>{{ hourName }}时</span>
      </div>
      <dl v-if="crossings" class="horizon-readout">
        <div><dt>日出</dt><dd>{{ fmt(Math.round(crossings.sunrise)) }}</dd></div>
        <div><dt>日落</dt><dd>{{ fmt(Math.round(crossings.sunset)) }}</dd></div>
      </dl>
      <span v-else-if="daylight?.state === 'polar-day'" class="day-state">全天日照</span>
      <span v-else-if="daylight?.state === 'polar-night'" class="day-state">全天无直射日光</span>
    </div>

    <div class="ruler" :style="railStyle">
      <div class="range-wrap">
        <div class="rail" aria-hidden="true">
          <template v-if="crossings || daylight?.state === 'polar-day'">
            <span class="daylight-band"></span>
            <span class="elapsed"></span>
          </template>
        </div>
        <input :value="minute" class="slider" type="range" min="0" :max="lastMinute" step="1" aria-label="真太阳时"
          :aria-valuetext="text" @input="emit('input', $event.target.valueAsNumber)" @change="emit('commit')" />
      </div>
      <div class="hour-ticks" aria-hidden="true">
        <span v-for="tick in ticks" :key="tick.name" :style="{ left:tick.position }"
          :class="{ major:tick.major, current:tick.name === hourName }">{{ tick.name }}</span>
        <span class="major end"></span>
      </div>
    </div>

    <div class="axis-controls">
      <div class="time-buttons">
        <button type="button" class="play" :aria-pressed="playing" @click="emit('toggle-play')">
          <span class="play-mark" :class="{ pause:playing }" aria-hidden="true"></span>
          {{ playing ? '暂停' : '播放一天' }}
        </button>
        <button type="button" aria-label="后退十五分钟" @click="emit('step',-15)">−15分</button>
        <button type="button" aria-label="前进十五分钟" @click="emit('step',15)">+15分</button>
        <button type="button" @click="emit('noon')">当地午正</button>
      </div>
      <label class="speed">
        <span>速度</span>
        <select :value="speed" aria-label="播放速度" @change="emit('update:speed', Number($event.target.value))">
          <option :value=".5">0.5×</option><option :value="1">1×</option><option :value="2">2×</option>
        </select>
      </label>
    </div>
  </section>
</template>

<style scoped>
.time-axis {
  --thumb-size: 23px;
  --rail-height: 9px;
  --hit-height: 44px;
  --night-track: #b4bfb4;
  --track-rim: #b3ab97;
  display: grid;
  min-width: 0;
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}
.axis-header, .axis-readout, .horizon-readout, .axis-controls, .time-buttons, .speed {
  display: flex;
  align-items: center;
}
.axis-header, .axis-controls { justify-content: space-between; }
.axis-header { gap: 8px 16px; flex-wrap: wrap; }
.axis-readout { gap: 10px; }
.axis-readout strong {
  font: 31px/1 var(--font-number);
  font-variant-numeric: tabular-nums;
  color: var(--ink);
}
.axis-readout span, .horizon-readout dt, .day-state, .speed {
  font-size: 12px;
  line-height: 1.35;
  color: var(--muted);
}
.horizon-readout { gap: 14px; margin: 0; }
.horizon-readout div {
  display: grid;
  gap: 2px;
  grid-template-columns: auto auto;
  align-items: baseline;
  column-gap: 5px;
}
.horizon-readout dd {
  margin: 0;
  font: 600 14px/1 var(--font-number);
  font-variant-numeric: tabular-nums;
  color: var(--ink);
}
.range-wrap { position: relative; }
.rail {
  position: absolute;
  inset-inline: calc(var(--thumb-size) / 2);
  top: calc((var(--hit-height) - var(--rail-height)) / 2);
  height: var(--rail-height);
  overflow: hidden;
  border-radius: 20px;
  background: var(--night-track);
  box-shadow: inset 0 0 0 1px var(--track-rim);
  pointer-events: none;
}
.rail span { position: absolute; inset-block: 0; }
.daylight-band {
  inset-inline-start: var(--sunrise);
  inset-inline-end: calc(100% - var(--sunset));
  background: #c6ad88;
}
.elapsed {
  inset-inline-start: var(--sunrise);
  inset-inline-end: calc(100% - max(var(--sunrise), min(var(--selected-time), var(--sunset))));
  background: linear-gradient(90deg, #d4a56d, #e7bc7a);
}
.slider {
  position: relative;
  display: block;
  width: 100%;
  height: var(--hit-height);
  margin: 0;
  padding: 0;
  appearance: none;
  border: 0;
  border-radius: 5px;
  background: transparent;
  cursor: ew-resize;
}
.slider:focus-visible { outline-offset: 1px; }
.slider::-webkit-slider-runnable-track { height: var(--hit-height); background: transparent; }
.slider::-moz-range-track { height: var(--hit-height); background: transparent; }
.slider::-webkit-slider-thumb {
  appearance: none;
  width: var(--thumb-size);
  height: var(--thumb-size);
  margin-top: calc((var(--hit-height) - var(--thumb-size)) / 2);
  border: 2px solid var(--surface);
  border-radius: 50%;
  background: radial-gradient(circle, #f7dfac 0 24%, #af513b 27% 57%, #763622 100%);
  box-shadow: 0 0 0 1px #783f2d, 0 2px 5px #422e2540;
}
.slider::-moz-range-thumb {
  box-sizing: border-box;
  width: var(--thumb-size);
  height: var(--thumb-size);
  border: 2px solid var(--surface);
  border-radius: 50%;
  background: radial-gradient(circle, #f7dfac 0 24%, #af513b 27% 57%, #763622 100%);
  box-shadow: 0 0 0 1px #783f2d, 0 2px 5px #422e2540;
}
.hour-ticks {
  position: relative;
  height: 23px;
  margin: -5px calc(var(--thumb-size) / 2) 7px;
  font: 12px/1 var(--font-display);
  color: var(--muted);
  pointer-events: none;
}
.hour-ticks span {
  position: absolute;
  top: 11px;
  transform: translateX(-50%);
}
.hour-ticks span::before {
  content: '';
  position: absolute;
  bottom: calc(100% + 3px);
  left: 50%;
  height: 4px;
  border-left: 1px solid #aab0a1;
}
.hour-ticks .major { color: var(--ink); }
.hour-ticks .major::before { height: 7px; border-color: #718376; }
.hour-ticks .current { color: var(--accent); font-weight: 700; }
.hour-ticks .current::before { border-color: var(--accent); }
.hour-ticks .end { left: 100%; }
.axis-controls { gap: 8px 10px; flex-wrap: wrap; padding-top: 8px; border-top: 1px solid var(--line); }
.time-buttons { gap: 6px; flex-wrap: wrap; }
.axis-controls button, .speed select {
  min-width: 44px;
  min-height: 44px;
  border: 1px solid var(--line);
  border-radius: 5px;
  padding: 5px 10px;
  background: var(--surface);
  color: var(--ink);
  font-size: 13px;
}
.axis-controls button:hover { background: var(--surface-muted); }
.axis-controls .play {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-width: 94px;
  justify-content: center;
  background: var(--ink);
  color: var(--paper);
  border-color: var(--ink);
}
.axis-controls .play:hover { background: #3d5b4d; }
.play-mark { width: 8px; height: 10px; border-block: 5px solid transparent; border-left: 8px solid #e7bd83; }
.play-mark.pause { border-block: 0; border-inline: 2px solid #e7bd83; }
.speed { gap: 7px; }
.speed select { cursor: pointer; font-variant-numeric: tabular-nums; }
@media (pointer:coarse) { .time-axis { --thumb-size: 26px; } }
@media (max-width: 767px) {
  .time-axis { padding: 10px 12px; }
  .axis-readout strong { font-size: 29px; }
  .axis-controls, .time-buttons { gap: 5px; }
  .axis-controls button, .speed select { padding-inline: 6px; font-size: 12px; }
  .axis-controls .play { min-width: 78px; gap: 5px; }
  .speed { gap: 4px; }
}
@media (max-width: 420px) {
  .horizon-readout { gap: 9px; }
  .horizon-readout div { grid-template-columns: auto; }
  .speed > span { display: none; }
}
@media (max-width: 360px) {
  .speed > span { display: inline; }
}
@media (forced-colors: active) {
  .rail { display: none; }
  .slider { appearance: auto; }
  .slider::-webkit-slider-runnable-track { appearance: auto; }
  .slider::-webkit-slider-thumb { appearance: auto; }
}
</style>
