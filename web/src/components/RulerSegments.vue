<script setup>
const props=defineProps({ label:{type:String,required:true}, modelValue:[String,Number], options:{type:Array,required:true} });
const emit=defineEmits(['update:modelValue']);
function navigate(event,index) {
  let next;
  if(event.key==='Home') next=0;
  else if(event.key==='End') next=props.options.length-1;
  else if(event.key==='ArrowRight'||event.key==='ArrowLeft'){
    next=(index+(event.key==='ArrowRight'?1:-1)+props.options.length)%props.options.length;
  }else return;
  event.preventDefault();
  event.currentTarget.parentElement.children[next].focus({preventScroll:true});
  emit('update:modelValue',props.options[next].value);
}
</script>

<template>
  <div class="ruler-segments" role="group" :aria-label="label">
    <button v-for="(item,index) in options" :key="item.value" type="button"
      :aria-pressed="modelValue===item.value" @click="emit('update:modelValue',item.value)"
      @keydown="navigate($event,index)">{{ item.label }}</button>
  </div>
</template>

<style scoped>
.ruler-segments {
  display:inline-flex; align-items:stretch; flex:none; white-space:nowrap;
  font:14px/1 var(--ruler-font); color:var(--dial-ink);
}
.ruler-segments button {
  position:relative; min-height:34px; margin:0; padding:0 9px;
  border:0; border-radius:0; color:inherit; background:transparent; font:inherit;
  font-variant-numeric:tabular-nums;
}
.ruler-segments button[aria-pressed=true] { color:var(--dial-cinnabar); }
.ruler-segments button[aria-pressed=true]::after {
  content:''; position:absolute; inset:auto 7px 3px; height:2px; background:currentColor;
}
.ruler-segments button:hover { color:var(--dial-cinnabar); background:color-mix(in srgb,var(--dial-bronze) 7%,transparent); }
.ruler-segments button:focus-visible { z-index:1; outline:2px solid var(--dial-cinnabar); outline-offset:-2px; }
@media(max-width:640px) {
  .ruler-segments { font-size:12px; }
  .ruler-segments button { min-height:44px; padding-inline:6px; }
}
</style>
