<script setup>
import { computed } from 'vue';
import { ANIMATED_HOU } from '../data/hou.js';
const props=defineProps({hou:Object,season:String,playing:Boolean});
const assets=import.meta.glob('../assets/hou/*.svg',{eager:true,query:'?url',import:'default'});
const asset=computed(()=>assets[`../assets/hou/${props.hou?.id}.svg`]);
const kind=computed(()=>ANIMATED_HOU[props.hou?.id] || 'static');
const motif=computed(()=>/鸟|雁|鹰|鸡|雀|鸠|鸣|雉|鹊|鹖|玄鸟|反舌/.test(props.hou?.name)?'bird':/冰|水|雨|虹|鱼|泉|獭/.test(props.hou?.name)?'water':/虫|螳螂|蚯蚓|蛰|蝼|蟋|萤/.test(props.hou?.name)?'insect':'plant');
const petals=[0,72,144,216,288];
</script>

<template>
  <div class="hou-art" :class="[kind,{'is-playing':playing}]">
    <img v-if="asset" :src="asset" :alt="`${hou.name}插画`" />
    <svg v-else viewBox="0 0 240 160" role="img" :aria-label="`${hou?.name || '候象'}，线描艺术示意`">
      <circle cx="163" cy="54" r="31" class="art-wash"/>
      <path d="M25 134 Q70 125 113 134 T216 132" class="ground"/>
      <g v-if="kind==='thaw'">
        <path d="M25 105 Q60 99 95 105 T217 104 M32 118 Q72 111 113 117 T209 115" class="water-line"/>
        <g class="ice-crack"><path d="M48 106 L76 100 98 109 123 99 159 104 190 96 M98 109 L90 119 M123 99 L133 88"/></g>
        <g class="wind"><path d="M22 62 H104 Q130 62 124 48 Q118 37 107 48 M58 78 H194 Q216 78 210 63 M36 89 H115"/></g>
      </g>
      <g v-else-if="kind==='fish'">
        <path d="M25 95 Q62 90 100 95 T217 94 M36 119 Q70 113 100 119 T202 119" class="water-line"/>
        <path class="ice-float" d="M90 89 L113 82 146 89 135 95 101 94 Z" fill="#dfebe7"/>
        <g class="fish-body"><path d="M81 116 Q108 89 141 111 Q111 132 81 116 L68 104 V126 Z" fill="#99b6ac"/><circle cx="132" cy="110" r="1.5" fill="currentColor"/><path d="M103 111 Q109 116 105 121"/></g>
      </g>
      <g v-else-if="kind==='blossom'">
        <path d="M40 137 Q77 102 101 85 T168 43 M95 90 L81 54 M130 65 L165 78 M70 110 L116 114"/>
        <g v-for="(p,i) in [[82,54],[163,78],[167,44],[113,113]]" :key="i" class="bloom" :style="{'--delay':`${i*.6}s`}" :transform="`translate(${p[0]} ${p[1]})`"><g class="bloom-petals"><ellipse v-for="angle in petals" :key="angle" cx="0" cy="-5" rx="4.2" ry="7" :transform="`rotate(${angle})`" fill="#d8a6a0" stroke="#b87d77" stroke-width=".7"/><circle r="2" fill="#b7965b"/></g></g>
      </g>
      <g v-else-if="kind==='swallow'">
        <path d="M37 122 Q60 103 68 75 M63 90 L45 78 M64 91 L79 77" class="plant-line"/>
        <g class="swallow-flight"><path d="M82 76 Q104 76 118 59 Q121 72 116 80 Q135 72 157 85 Q133 83 117 90 L121 107 108 97 96 109 103 91 Q89 89 82 76" fill="#425f54" stroke="none"/></g>
        <path d="M117 122 Q159 115 193 122" class="ground"/>
      </g>
      <g v-else-if="kind==='rainbow'">
        <g class="rainbow-arc" fill="none" stroke-width="3" opacity=".65"><path v-for="(color,i) in ['#be8c81','#cbab75','#cfbf87','#9cad87','#89a99f','#8f9db3','#aba0b8']" :key="color" :d="`M${45+i*4} 112 A${75-i*4} ${75-i*4} 0 0 1 ${195-i*4} 112`" :stroke="color"/></g>
        <path d="M24 116 Q24 105 36 105 Q40 91 52 98 Q64 94 69 108 Q83 105 84 117 M165 119 Q168 106 182 109 Q185 98 197 103 Q211 97 216 116" fill="#f7f7ec"/>
      </g>
      <g v-else-if="kind==='cicada'">
        <path d="M77 140 Q86 77 69 25 M87 139 Q99 72 80 25 M82 65 L55 49 M92 91 L111 72"/>
        <g transform="translate(112 76) rotate(16)"><ellipse rx="7" ry="17" fill="#b4bf9d"/><path d="M0 -10 Q-26 -8 -18 22 Q-4 20 0 1 Q6 22 20 20 Q23 -6 0 -10" fill="#e2e7d2"/><ellipse cy="-14" rx="7" ry="5" fill="#6b806b"/></g>
        <g class="sound-waves"><path d="M140 64 Q154 77 142 91 M151 54 Q173 77 154 102 M164 46 Q190 77 168 112"/></g>
      </g>
      <g v-else-if="kind==='firefly'">
        <path d="M31 139 Q31 116 22 106 M39 138 L46 99 M59 137 Q54 107 67 92 M181 138 Q192 104 183 91 M197 136 L210 105 M160 139 L157 117" class="plant-line"/>
        <g v-for="(p,i) in [[61,65],[110,100],[156,58],[182,83],[92,49],[132,74],[52,104]]" :key="i" class="firefly-dot" :style="{'--delay':`${i*.58}s`}" :transform="`translate(${p[0]} ${p[1]})`"><g class="glow-dot"><circle r="8" fill="#c1c16f" opacity=".15" stroke="none"/><circle r="2.2" fill="#b6ac50" stroke="none"/></g></g>
      </g>
      <g v-else-if="kind==='geese'">
        <g class="geese-flight"><path v-for="(p,i) in [[124,53],[100,71],[148,71],[76,89],[172,89],[52,107],[196,107]]" :key="i" :d="`M${p[0]-10} ${p[1]-4} Q${p[0]-5} ${p[1]-4} ${p[0]} ${p[1]+2} Q${p[0]+5} ${p[1]-4} ${p[0]+10} ${p[1]-4}`" class="goose" :style="{'--delay':`${i*.12}s`}"/></g>
        <path d="M28 131 Q76 118 110 128 T216 127" class="ground"/>
      </g>
      <g v-else-if="kind==='freeze'">
        <path d="M26 100 Q70 94 114 100 T217 99 M34 119 Q77 112 118 118 T208 117" class="water-line"/>
        <g class="ice-grow"><path d="M31 100 L67 94 83 103 111 96 M51 97 L45 84 M68 95 L73 82 M215 100 L183 93 161 103 139 97 M188 94 L195 81 M163 102 L166 114"/><path d="M74 82 L67 84 M195 81 L201 83"/></g>
      </g>
      <g v-else-if="kind==='spring'">
        <path d="M26 72 L78 69 101 75 131 68 166 73 215 70 M29 80 L86 77 112 83 141 77 211 80" class="ice-crack"/>
        <path d="M45 125 Q90 115 123 125 T203 124" class="water-line"/>
        <g v-for="i in 5" :key="i" class="spring-bubble" :style="{'--delay':`${i*.8}s`}"><circle :cx="92+i*11" :cy="120-i%2*7" :r="2+i%3" fill="none" stroke="#86a8a0"/></g>
      </g>
      <g v-else>
        <template v-if="motif==='bird'"><path d="M47 127 Q88 99 185 103 M139 103 L160 84"/><path d="M104 99 Q97 80 111 70 Q125 66 135 82 L150 85 135 90 Q129 104 104 99 L87 104 97 89" fill="#a5b7a2"/><circle cx="128" cy="80" r="1.5" fill="currentColor"/><path d="M112 98 L111 105 M123 98 L126 104"/></template>
        <template v-else-if="motif==='water'"><path d="M28 106 Q60 98 94 105 T215 105 M34 120 Q72 111 109 118 T205 119" class="water-line"/><path d="M82 93 Q109 78 139 92 Q113 107 82 93 L71 83 V101 Z" fill="#a5bdb2"/><circle cx="132" cy="91" r="1.5" fill="currentColor"/></template>
        <template v-else-if="motif==='insect'"><path d="M39 136 Q49 113 42 88 M57 135 L66 96 M186 134 Q191 105 208 87" class="plant-line"/><ellipse cx="122" cy="95" rx="18" ry="9" fill="#b9c4a2"/><circle cx="142" cy="92" r="6" fill="#8da080"/><path d="M112 101 L104 116 M126 103 L132 115 M140 95 L154 108 M145 88 L151 75 M144 88 L137 76"/></template>
        <template v-else><path d="M117 137 Q124 84 113 40 M120 100 Q81 104 75 74 Q108 72 120 100 M120 83 Q152 83 168 59 Q135 54 120 83 M120 120 Q152 124 167 100 Q138 88 120 120" fill="none"/><path d="M77 75 Q92 78 117 98 M167 60 Q147 64 122 82 M166 101 Q144 105 121 120" class="plant-line"/><circle cx="113" cy="39" r="7" fill="#c3b482" stroke="none"/></template>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.hou-art{color:#526c5e;aspect-ratio:3/2;width:100%;max-width:240px;margin:auto}.hou-art svg,.hou-art img{display:block;width:100%;height:100%}.hou-art svg{stroke:currentColor;fill:none;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round}.art-wash{fill:#cbd5b3;opacity:.2;stroke:none}.ground{stroke:#b9c3ae;stroke-width:.8}.water-line{stroke:#8faea4}.plant-line{stroke:#91a183}.wind,.ice-crack,.ice-grow{transform-box:fill-box;transform-origin:center}.is-playing .wind{animation:wind 5s ease-in-out infinite}.is-playing .ice-crack,.is-playing .ice-grow{animation:ice 5s ease-in-out infinite}.is-playing .fish-body{animation:fish 5s ease-in-out infinite}.is-playing .ice-float{animation:float 5s ease-in-out infinite}.bloom-petals{transform-origin:0 0}.is-playing .bloom-petals{animation:bloom 5s ease-in-out var(--delay) infinite}.is-playing .swallow-flight{animation:swallow 5.5s ease-in-out infinite}.rainbow-arc{transform-origin:45px 112px}.is-playing .rainbow-arc{animation:rainbow 5s ease-in-out infinite}.is-playing .sound-waves{animation:sound 4s ease-in-out infinite}.is-playing .glow-dot{animation:glow 4.8s ease-in-out var(--delay) infinite}.is-playing .geese-flight{animation:geese 6s ease-in-out infinite}.is-playing .goose{animation:wing 1.8s ease-in-out var(--delay) infinite;transform-box:fill-box;transform-origin:center}.is-playing .spring-bubble{animation:bubble 5s ease-in-out var(--delay) infinite}@keyframes wind{0%,100%{transform:translateX(-9px);opacity:.3}50%{transform:translateX(9px);opacity:.9}}@keyframes ice{0%,100%{transform:scaleX(.65);opacity:.25}65%{transform:scaleX(1);opacity:1}}@keyframes fish{0%,100%{transform:translate(-12px,9px)}45%{transform:translate(8px,-8px)}}@keyframes float{0%,100%{transform:translateY(0)}45%{transform:translateY(-5px)}}@keyframes bloom{0%,100%{transform:scale(.3);opacity:.5}35%,80%{transform:scale(1);opacity:1}}@keyframes swallow{0%,100%{transform:translate(-65px,15px);opacity:.2}45%,65%{transform:translate(16px,-10px);opacity:1}}@keyframes rainbow{0%,100%{transform:scaleX(.15);opacity:.1}45%,80%{transform:scaleX(1);opacity:.65}}@keyframes sound{0%,100%{opacity:.15;transform:translateX(-3px)}50%{opacity:.8;transform:translateX(5px)}}@keyframes glow{0%,100%{opacity:.15;transform:translateY(5px)}50%{opacity:1;transform:translate(3px,-6px)}}@keyframes geese{0%,100%{transform:translate(-27px,6px);opacity:.35}55%{transform:translate(22px,-8px);opacity:1}}@keyframes wing{50%{transform:scaleY(.45)}}@keyframes bubble{0%{transform:translateY(7px);opacity:0}30%{opacity:.8}80%,100%{transform:translateY(-35px);opacity:0}}@media(prefers-reduced-motion:reduce){:global(html:not([data-motion-mode=full])) .hou-art *{animation:none!important}}
</style>
