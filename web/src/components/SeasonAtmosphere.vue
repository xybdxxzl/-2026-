<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { year } from '../state/year.js';
import { seasonAt } from '../core/season.js';
import { subscribeFrame, motionPreferences } from '../core/loop.js';
import { TUNING } from '../core/tuning.js';
const canvas = ref(null);
const palette = computed(() => seasonAt(year.state.yearAngle));
const styles = computed(() => ({ '--bg-top':palette.value.top, '--bg-bottom':palette.value.bottom,
  '--light-color':palette.value.light, '--light-strength':palette.value.strength,
  '--sun-y': `${18 + (1-palette.value.strength)*35}%` }));
let unsubscribe, context, width=0, height=0, quality=1, frames=0, duration=0, elapsed=0, nextThunder=5, flash=0;
const levels = { rain:0, snow:0, leaf:0, fog:0, thunder:0 };
const particles = {};
const random = (min,max) => min + Math.random()*(max-min);
function resize() {
  width=window.innerWidth; height=window.innerHeight;
  const ratio=Math.min(2,devicePixelRatio || 1);
  canvas.value.width=width*ratio; canvas.value.height=height*ratio;
  context.setTransform(ratio,0,0,ratio,0,0);
}
function seed(kind) { return { x:random(-80,width+80), y:random(-height, height), phase:random(0,Math.PI*2), size:random(1.5,4), speed:kind==='rain'?random(900,1400):kind==='snow'?random(40,100):random(30,65) }; }
function draw(dt) {
  if (!context) return;
  context.clearRect(0,0,width,height);
  if (motionPreferences.reduced.value || !year.state.atmosphere) {
    year.reportParticles({rain:0,snow:0,leaf:0},quality); return;
  }
  elapsed+=dt; frames++; duration+=dt;
  if (duration>=1) {
    if (frames/duration<45) quality=quality===1?.6:.3;
    frames=0; duration=0;
  }
  const target=palette.value;
  Object.keys(levels).forEach(key => { const delta=target[key]-levels[key]; levels[key]+=Math.sign(delta)*Math.min(Math.abs(delta),dt*.6); });
  const counts={};
  for (const kind of ['rain','snow','leaf']) {
    const count=Math.round(TUNING.particleCaps[kind]*levels[kind]*quality); counts[kind]=count;
    const list=particles[kind] ||= [];
    while(list.length<count) list.push(seed(kind));
    if(list.length>count) list.length=count;
    context.lineWidth=kind==='rain'?.8:1;
    for(const p of list) {
      p.y+=p.speed*dt; p.x+=kind==='rain'?-p.speed*.16*dt:Math.sin(elapsed+p.phase)*16*dt;
      if(p.y>height+25) { p.y=-25; p.x=random(0,width+80); }
      if(p.x < -85) p.x=width+20;
      if(kind==='rain') { context.strokeStyle='rgba(68,105,108,.24)'; context.beginPath(); context.moveTo(p.x,p.y); context.lineTo(p.x-3,p.y+random(10,18)); context.stroke(); }
      else if(kind==='snow') { context.fillStyle='rgba(255,255,255,.85)'; context.beginPath(); context.arc(p.x,p.y,p.size,0,Math.PI*2); context.fill(); }
      else { context.save(); context.translate(p.x,p.y); context.rotate(Math.sin(elapsed+p.phase)); context.fillStyle=p.phase>3?'rgba(160,96,53,.46)':'rgba(177,133,58,.5)'; context.beginPath(); context.ellipse(0,0,3,8,.4,0,Math.PI*2); context.fill(); context.restore(); }
    }
  }
  if(levels.fog>.01) {
    for(let i=0;i<2;i++) {
      const x=width*(.2+i*.55)+Math.sin(elapsed*.07+i)*width*.2, y=height*(.3+i*.4);
      const mist=context.createRadialGradient(x,y,0,x,y,width*.55);
      mist.addColorStop(0,`rgba(246,247,237,${levels.fog*.35})`); mist.addColorStop(1,'rgba(246,247,237,0)');
      context.fillStyle=mist; context.fillRect(0,0,width,height);
    }
  }
  // 远处的单次柔光脉冲；每次至少间隔3秒，无快速连闪。
  if(elapsed>nextThunder) {
    flash=levels.thunder>.1?levels.thunder*.16:0;
    nextThunder=elapsed+random(3,8);
  }
  if(flash>.001) { context.fillStyle=`rgba(244,249,255,${flash})`; context.fillRect(0,0,width,height); flash*=Math.exp(-dt*15); }
  year.reportParticles(counts,quality);
}
onMounted(() => { context=canvas.value.getContext('2d'); resize(); window.addEventListener('resize',resize); unsubscribe=subscribeFrame(draw); });
onBeforeUnmount(() => { unsubscribe?.(); window.removeEventListener('resize',resize); });
</script>

<template>
  <div class="season-atmosphere" :style="styles" aria-hidden="true"><div class="season-light"></div><canvas ref="canvas"></canvas></div>
</template>

<style scoped>
.season-atmosphere{position:fixed;inset:0;z-index:0;pointer-events:none;background:linear-gradient(155deg,var(--bg-top),var(--bg-bottom));opacity:.8}.season-light{position:absolute;inset:0;background:radial-gradient(ellipse at 75% var(--sun-y),var(--light-color),transparent 65%);opacity:var(--light-strength)}canvas{position:absolute;inset:0;width:100%;height:100%}
</style>
