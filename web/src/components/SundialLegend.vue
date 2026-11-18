<script setup>
defineProps({
  layers: { type: Object, required: true },
  shadowVisible: Boolean,
  shadowMarker: Boolean,
  rayVisible: Boolean,
});
</script>

<template>
  <ul class="legend" aria-label="图例">
    <li v-if="layers.sky" title="亮金色为太阳已走过的轨迹"><i class="path-sun" aria-hidden="true"></i>日行轨迹</li>
    <li v-if="shadowVisible"><i class="shadow-now" :class="{ 'with-marker':shadowMarker }" aria-hidden="true"></i>此刻日影</li>
    <li v-if="layers.ray && rayVisible"><i class="sun-ray" aria-hidden="true"></i>入射光线</li>
    <li v-if="layers.shadow"><i class="path-shadow" aria-hidden="true"></i>影端轨迹</li>
  </ul>
</template>

<style scoped>
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.legend li {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.legend i {
  position: relative;
  width: 16px;
  border-top: 2px solid;
}
.legend .path-sun {
  border: 0;
  height: 2px;
  border-radius: 1px;
  background: linear-gradient(90deg,var(--dial-gold) 50%,var(--dial-bronze) 50%);
}
.legend .sun-ray {
  border-color: var(--dial-bronze);
  border-top-style: dashed;
}
.legend .path-shadow {
  border-color: var(--dial-cinnabar);
}
.legend .shadow-now {
  border-color: var(--dial-shadow);
}
.shadow-now.with-marker::after {
  position: absolute;
  right: 0;
  top: -4px;
  width: 5px;
  height: 5px;
  border: 1px solid var(--dial-paper);
  border-radius: 50%;
  background: var(--dial-cinnabar);
  content: '';
}
</style>
