<script setup>
import { computed, useId } from 'vue';
import { inscriptionFont, studioCss } from '../scene/sundial/sundialTheme.js';
import { dialLayout } from '../scene/sundial/dialEngraving.js';
import { DIAL_RADIUS, hourMarks } from '../lib/astro/geometry.js';
import { DIAL_RADIUS as POLAR_RADIUS, STYLE_LENGTH_RATIO, dialLocalPoint, dialLocalToWorld, polarBasis } from '../lib/astro/sundialGeometry.js';
import { scaledSun, SKY_RADIUS } from '../lib/astro/tracks.js';

const props = defineProps({ solar: Object, tracks: Object, latitude: Number, layers: Object, compact: Boolean,
  polarMode: Boolean, face: String, solstices: Array });
const clip = useId();
const at = ([e, n, u]) => [320 + (e - .30 * n) * 27, 235 - (.46 * n + u) * 27];
const point = v => at(v).map(x => x.toFixed(2)).join(',');
const circle = radius => Array.from({ length: 97 }, (_, i) => {
  const a = i / 96 * Math.PI * 2;
  return point([radius * Math.sin(a), radius * Math.cos(a), 0]);
}).join(' ');
const path = segments => (segments ?? []).map((v, i) => (i % 2 ? 'L' : 'M') + point(v)).join(' ');
const origin = [0, 0, 0];
const marks = computed(() => hourMarks(props.latitude).filter(mark => !props.compact || mark.major));
const shadow = computed(() => props.solar.shadow);
const tip = computed(() => props.solar.needle);
const foot = computed(() => tip.value && [tip.value[0], tip.value[1], 0]);
const sun = computed(() => scaledSun(props.solar.direction));
const ray = computed(() => tip.value?.map((value, i) => value + props.solar.direction[i] * 5));
const rayEnd = computed(() => {
  if (!shadow.value) return null;
  const portion = Math.min(1,DIAL_RADIUS / Math.max(1,shadow.value.distance));
  return tip.value.map((value,i) => value + (shadow.value.point[i] - value) * portion);
});

const project = ([x,y,z]) => {
  const side = props.face === 'back' ? -1 : 1;
  return [320 - (side * x * .82 + z * .57) * 23, 205 + (x * .28 - y * .90 - side * z * .43) * 23];
};
const worldPoint = v => project(v).map(value => value.toFixed(2)).join(',');
const localPoint = ([x,y,z=0]) => worldPoint(dialLocalToWorld([x,y,z],props.latitude));
const worldPath = segments => (segments ?? []).map((v,i) => (i%2?'L':'M') + worldPoint([v[0],v[2],-v[1]])).join(' ');
const localPath = (segments,faceName) => (segments ?? []).map((v,i) => (i%2?'L':'M') +
  localPoint([v[0],v[1],(faceName==='front'?1:-1)*.22])).join(' ');
const polarCircle = (radius=1) => Array.from({length:97},(_,i)=>{
  const a=i/96*Math.PI*2;
  return localPoint([Math.sin(a)*POLAR_RADIUS*radius,Math.cos(a)*POLAR_RADIUS*radius]);
}).join(' ');
const markPoint=(r,angle)=>localPoint(dialLocalPoint(POLAR_RADIUS*r,angle));
function letterTurn(angle){
  const a=angle*Math.PI/180,origin=project([0,0,0]);
  const tangent=project(dialLocalToWorld([Math.cos(a),-Math.sin(a),0],props.latitude));
  const roll=Math.atan2(tangent[1]-origin[1],tangent[0]-origin[0])*180/Math.PI;
  return (roll+270)%180-90;
}
const polarShadow = computed(() => props.solar.polar);
const showingShadow = computed(() => polarShadow.value.valid && polarShadow.value.face === props.face);
const inkWindow=computed(()=>{
  const sheet='M0,0H640V430H0Z';
  if(!showingShadow.value||!polarShadow.value.inside)return sheet;
  const [x,y]=polarShadow.value.local,r=(props.compact?.066:.052)*POLAR_RADIUS;
  const edge=Array.from({length:32},(_,i)=>{
    const a=i*Math.PI/16;
    return localPoint([x+r*Math.cos(a),y+r*Math.sin(a)]);
  });
  return sheet+'M'+edge.join('L')+'Z';
});
const basis = computed(() => polarBasis(props.latitude));
const needleA = computed(() => basis.value.P.map(value => -value*POLAR_RADIUS*STYLE_LENGTH_RATIO));
const needleB = computed(() => basis.value.P.map(value => value*POLAR_RADIUS*STYLE_LENGTH_RATIO));
const scalePolarSun = sun => sun.map(value => value*SKY_RADIUS);
const polarSun = computed(() => scalePolarSun(props.solar.polar.sun));
const polarRayStart = computed(() => polarShadow.value?.tip?.map((value,i)=>value+polarShadow.value.sun[i]*8));
const solsticeColor = { xiazhi:'var(--dial-gold)', dongzhi:'var(--dial-winter)' };
</script>

<template>
  <svg :style="studioCss" v-if="polarMode" class="fallback polar-fallback" viewBox="0 0 640 430" role="img"
    :aria-label="showingShadow ? '极轴日晷及解析日影' : '极轴日晷，当前视图无可读日影'">
    <defs>
      <clipPath :id="clip+'-engraving'"><path :d="inkWindow" clip-rule="evenodd"/></clipPath>
      <linearGradient :id="clip+'-face'" x1="0" x2="1" y1="0" y2="1">
        <stop stop-color="var(--dial-marble)"/><stop offset="1" stop-color="var(--dial-paperEdge)"/>
      </linearGradient>
      <filter :id="clip+'-floor'"><feGaussianBlur stdDeviation="2.5"/></filter>
      <radialGradient :id="clip+'-glow'">
        <stop stop-color="var(--dial-gold)" stop-opacity=".6"/><stop offset="1" stop-color="var(--dial-gold)" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <template v-if="layers?.sky">
      <g v-if="solstices?.length">
        <template v-for="item in solstices" :key="item.id">
          <path :d="worldPath(item.tracks.day)" fill="none" :stroke="solsticeColor[item.id]"
            :stroke-dasharray="item.id==='dongzhi' ? '5 3' : undefined" stroke-width="1.7" />
          <circle v-if="item.solar?.altitude>0" :transform="'translate('+worldPoint(scalePolarSun(item.solar.polar.sun))+')'"
            r="5" :fill="item.id==='dongzhi'?'var(--dial-lightInk)':solsticeColor[item.id]" stroke="var(--dial-sunlight)" stroke-width="1.5" />
        </template>
      </g>
      <template v-else>
        <path :d="worldPath(tracks?.day)" fill="none" stroke="var(--dial-gold)" stroke-width="1.7"/>
        <g v-if="solar.altitude>0" :transform="'translate('+worldPoint(polarSun)+')'">
          <circle r="28" :fill="'url(#'+clip+'-glow)'"/>
          <circle r="6" fill="var(--dial-sunlight)" stroke="var(--dial-gold)" stroke-width="2"/>
        </g>
      </template>
    </template>
    <ellipse cx="320" cy="344" rx="172" ry="20" fill="var(--dial-shadow)" opacity=".28" :filter="'url(#'+clip+'-floor)'"/>
    <path d="M169 315h302l17 18H152z" fill="var(--dial-stone)"/>
    <path d="M152 333h336v13H152z" fill="var(--dial-stoneLine)"/>
    <path d="M263 315l28-105m86 105-28-105" fill="none" stroke="var(--dial-bronze)" stroke-width="6"/>
    <polygon :points="polarCircle()" fill="var(--dial-bronze)" transform="translate(0 7)"/>
    <polygon :points="polarCircle()" :fill="'url(#'+clip+'-face)'" stroke="var(--dial-gold)" stroke-width="3"/>
    <g :clip-path="'url(#'+clip+'-engraving)'">
      <polygon v-for="rule in dialLayout.rules" :key="rule.r" :points="polarCircle(rule.r)" fill="none"
        stroke="var(--dial-lightInk)" :stroke-width="rule.width*135"/>
      <g v-for="mark in dialLayout.marks" :key="mark.hour" :stroke="mark.hour===12?'var(--dial-cinnabar)':mark.major?'var(--dial-ink)':'var(--dial-lightInk)'">
        <path v-for="span in mark.spans" :key="span[0]" :d="'M'+markPoint(span[0],mark.angle)+'L'+markPoint(span[1],mark.angle)"
          :stroke-width="mark.width*(compact?167:143)"/>
        <text v-if="mark.letter" :transform="'translate('+markPoint(dialLayout.letterRadius,mark.angle)+') rotate('+letterTurn(mark.angle)+')'"
          :font-family="inscriptionFont" text-anchor="middle" dominant-baseline="central" :font-size="(compact?dialLayout.phoneLetterHeight:dialLayout.letterHeight)*115"
          stroke="none" :fill="mark.hour===12?'var(--dial-cinnabar)':'var(--dial-ink)'">{{ mark.letter }}</text>
      </g>
    </g>
    <path v-if="layers?.shadow && tracks?.polar" :d="localPath(tracks.polar[face],face)" fill="none" stroke="var(--dial-cinnabar)" stroke-width="2"/>
    <path v-if="showingShadow" :d="'M'+localPoint([0,0,0])+'L'+localPoint(polarShadow.localEnd)" stroke="var(--dial-shadow)" stroke-width="5" stroke-linecap="round"/>
    <path v-if="showingShadow && !polarShadow.inside" :d="'M'+localPoint(polarShadow.localEnd)+'L'+localPoint(polarShadow.local)"
      stroke="var(--dial-paperEdge)" stroke-width="1.7" stroke-dasharray="5 4"/>
    <path :d="'M'+worldPoint(origin)+'L'+worldPoint(face==='back'?needleA:needleB)" stroke="var(--dial-bronze)" stroke-width="6" stroke-linecap="round"/>
    <circle v-if="showingShadow" :transform="'translate('+localPoint(polarShadow.local)+')'"
      r="5" fill="var(--dial-cinnabar)" stroke="var(--dial-paper)" stroke-width="2"/>
    <path v-if="layers?.ray && showingShadow" :d="'M'+worldPoint(polarRayStart)+'L'+worldPoint(polarShadow.tip)+'L'+worldPoint(polarShadow.point)"
      fill="none" stroke="var(--dial-gold)" stroke-width="2" stroke-dasharray="5 4"/>
    <text x="320" y="407" text-anchor="middle" font-size="12" fill="var(--dial-lightInk)">二维示意 · {{ face === 'back' ? '背面' : '正面' }}</text>
  </svg>
  <svg :style="studioCss" v-else class="fallback" :viewBox="compact ? '135 140 370 167' : '0 0 640 345'" role="img"
    :aria-label="solar.shadow ? '水平日晷及晷针投影' : '水平日晷，当前无可读日影'">
    <defs><clipPath :id="clip"><polygon :points="circle(DIAL_RADIUS)" /></clipPath></defs>
    <g v-if="!compact && layers?.sky">
      <path :d="path(tracks?.night)" fill="none" stroke="var(--dial-stone)" stroke-dasharray="2 4"/>
      <path :d="path(tracks?.day)" fill="none" stroke="var(--dial-bronze)" stroke-width="2.2"/>
    </g>
    <circle v-if="!compact && solar.altitude > 0" :cx="at(sun)[0]" :cy="at(sun)[1]" r="6" fill="var(--dial-bronze)"/>
    <polygon :points="circle(DIAL_RADIUS)" transform="translate(0 8)" fill="var(--dial-bronze)"/>
    <polygon :points="circle(DIAL_RADIUS)" fill="var(--dial-marble)" stroke="var(--dial-bronze)"/>
    <polygon :points="circle(4.68)" fill="none" stroke="var(--dial-bronze)"/>
    <g v-for="mark in marks" :key="mark.hour">
      <path :d="'M'+point(mark.direction.map(v => v * .55))+'L'+point(mark.direction.map(v => v * 4.12))"
        :stroke="mark.hour === 12 ? 'var(--dial-cinnabar)' : 'var(--dial-stoneLine)'" :stroke-width="mark.major ? 1 : .5"/>
      <text v-if="mark.label && (!compact || [6,12,18].includes(mark.hour))"
        :x="at(mark.direction.map(v => v * 4.48))[0]" :y="at(mark.direction.map(v => v * 4.48))[1]"
        text-anchor="middle" dominant-baseline="central" fill="var(--dial-ink)" font-size="9">{{ mark.label }}</text>
    </g>
    <g :clip-path="'url(#'+clip+')'">
      <path v-if="!compact && layers?.shadow" :d="path(tracks?.shadow)" fill="none" stroke="var(--dial-lightInk)" stroke-width="2" stroke-dasharray="4 4"/>
      <polygon v-if="shadow" :points="[point(origin),point(foot),point(shadow.point)].join(' ')" fill="var(--dial-shadow)" opacity=".30"/>
      <path v-if="shadow" :d="'M'+point(origin)+'L'+point(shadow.end)" fill="none" stroke="var(--dial-shadow)" stroke-width="3"/>
    </g>
    <polygon v-if="tip" :points="[point(origin),point(foot),point(tip)].join(' ')" fill="var(--dial-bronze)" stroke="var(--dial-ink)"/>
    <path v-if="!compact && layers?.ray && shadow" :d="'M'+point(ray)+'L'+point(tip)+'L'+point(rayEnd)"
      fill="none" stroke="var(--dial-bronze)" stroke-width="1.6" stroke-dasharray="4 3"/>
    <circle v-if="shadow?.inside" :cx="at(shadow.point)[0]" :cy="at(shadow.point)[1]" r="4" fill="var(--dial-cinnabar)" stroke="var(--dial-paper)"/>
    <text v-if="!compact && layers?.compass" x="319" y="306" text-anchor="middle" fill="var(--dial-lightInk)" font-size="12">东右 · 北向画面深处</text>
  </svg>
</template>

<style scoped>
.fallback { display:block; width:100%; height:100%; min-height:0; }
</style>
