<script setup>
import { computed, onMounted, onBeforeUnmount, ref, useId } from 'vue';
import { year } from '../state/year.js';
import { seasonAt } from '../core/season.js';
import { subscribeFrame, motionPreferences } from '../core/loop.js';
import { TUNING } from '../core/tuning.js';
const canvas = ref(null);
const paperId = `paper-${useId().replace(/[^a-z0-9-]/gi,'')}`;
// 静态纤维与纸斑，避免整屏噪声滤镜随拖动重绘。
const paperFibers = Array.from({length:32},(_,i) => ({
  x:(i*47+13)%180, y:(i*71+19)%180,
  dx:3+(i*7)%12, dy:(i%3)-1,
}));
const paperSpecks = Array.from({length:38},(_,i) => ({
  x:(i*67+31)%180, y:(i*43+7)%180, r:i%5===0?.75:.38,
}));
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
  <div class="season-atmosphere" :style="styles" aria-hidden="true">
    <div class="season-light"></div>
    <svg v-once class="mountain-watermark" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" focusable="false">
      <path class="mountain-far" d="M-80 704 Q15 668 86 603 Q134 550 183 579 L225 616 Q285 524 339 501 Q373 479 402 525 L431 550 Q478 507 513 535 L572 604 Q620 556 657 581 L707 623 Q753 589 796 614 L862 659 Q917 571 970 551 Q1004 535 1030 571 L1061 610 Q1105 537 1150 510 Q1186 485 1210 524 L1249 564 Q1280 536 1310 560 L1373 631 Q1453 565 1513 600 L1680 707 V960 H-80Z"/>
      <path class="mountain-near" d="M-80 792 Q40 709 111 732 Q166 751 221 687 Q267 631 307 659 L346 696 Q393 658 433 686 L508 748 Q577 699 629 734 L705 777 Q751 735 796 754 Q880 700 935 728 L982 751 Q1041 675 1092 659 Q1129 647 1165 689 L1212 737 Q1270 693 1318 714 L1404 773 Q1470 709 1545 751 L1680 800 V960 H-80Z"/>
      <path class="ridge-line" d="M-20 721 Q64 665 111 641 M250 616 Q305 551 349 525 M1080 637 Q1120 571 1161 550 M1208 574 L1241 603 M1398 650 Q1458 607 1494 623"/>
    </svg>
    <svg v-once class="paper-texture" width="100%" height="100%" focusable="false">
      <defs><pattern :id="paperId" width="180" height="180" patternUnits="userSpaceOnUse">
        <path v-for="(fiber,i) in paperFibers" :key="`fiber-${i}`" :d="`M${fiber.x} ${fiber.y} l${fiber.dx} ${fiber.dy}`" :stroke="i%2?'#fffdf3':'#88704c'" :stroke-opacity="i%2?.4:.12" stroke-width=".45"/>
        <circle v-for="(speck,i) in paperSpecks" :key="`speck-${i}`" :cx="speck.x" :cy="speck.y" :r="speck.r" fill="#8e7550" fill-opacity=".12"/>
      </pattern></defs>
      <rect width="100%" height="100%" :fill="`url(#${paperId})`"/>
    </svg>
    <canvas ref="canvas"></canvas>
  </div>
</template>

<style scoped>
.season-atmosphere{position:fixed;inset:0;z-index:0;pointer-events:none;background:linear-gradient(155deg,var(--bg-top),var(--bg-bottom));opacity:.88}.season-light{position:absolute;inset:0;background:radial-gradient(ellipse at 75% var(--sun-y),var(--light-color),transparent 65%);opacity:var(--light-strength)}.mountain-watermark,.paper-texture,canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.mountain-watermark{color:#536b63}.mountain-far{fill:currentColor;opacity:.09}.mountain-near{fill:currentColor;opacity:.065}.ridge-line{fill:none;stroke:currentColor;stroke-width:1.3;opacity:.12}.paper-texture{opacity:.8}
</style>

<style scoped>
.season-atmosphere { opacity: .52; }
</style>
