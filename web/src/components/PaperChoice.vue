<script setup>
import { computed, nextTick, onBeforeUnmount, ref, useId } from 'vue';
const props=defineProps({ id:String, label:{type:String,required:true}, modelValue:[String,Number], options:{type:Array,required:true} });
const emit=defineEmits(['update:modelValue']);
const listId='paper-options-'+useId(), expanded=ref(false), active=ref(0), root=ref(null), list=ref(null);
const selected=computed(()=>props.options.findIndex(item=>item.value===props.modelValue));
const current=computed(()=>props.options[selected.value]?.label??'');
function reveal(){ nextTick(()=>list.value?.children[active.value]?.scrollIntoView({block:'nearest',inline:'nearest'})); }
function outside(event){ if(!root.value?.contains(event.target))close(); }
function close(){ expanded.value=false;document.removeEventListener('pointerdown',outside,true); }
function open(){
  if(expanded.value)return;
  active.value=Math.max(0,selected.value);expanded.value=true;
  document.addEventListener('pointerdown',outside,true);reveal();
}
function choose(index){
  const item=props.options[index];
  if(item)emit('update:modelValue',item.value);
  close();
}
function key(event){
  const k=event.key;
  if(k==='Tab'){close();return;}
  if(k==='Escape'&&expanded.value){event.preventDefault();event.stopPropagation();close();return;}
  if(k==='Enter'||k===' '){event.preventDefault();expanded.value?choose(active.value):open();return;}
  if(!['ArrowDown','ArrowUp','Home','End'].includes(k))return;
  event.preventDefault();open();
  if(k==='Home')active.value=0;
  else if(k==='End')active.value=props.options.length-1;
  else active.value=Math.max(0,Math.min(props.options.length-1,active.value+(k==='ArrowDown'?1:-1)));
  reveal();
}
onBeforeUnmount(close);
</script>

<template>
  <span ref="root" class="paper-choice" @focusout="!$event.currentTarget.contains($event.relatedTarget) && close()">
    <button :id="id" type="button" role="combobox" aria-haspopup="listbox" :aria-label="label" :aria-expanded="expanded"
      :aria-controls="listId" :aria-activedescendant="expanded?listId+'-'+active:undefined"
      @click="expanded?close():open()" @keydown="key">{{ current }}<i aria-hidden="true"></i></button>
    <span v-if="expanded" :id="listId" ref="list" class="paper-options" role="listbox" :aria-label="label">
      <span v-for="(item,index) in options" :id="listId+'-'+index" :key="item.value" role="option"
        :aria-selected="index===selected" :class="{pointed:index===active}"
        @pointerdown.prevent @pointermove="active=index" @click.stop.prevent="choose(index)">{{ item.label }}</span>
    </span>
  </span>
</template>

<style scoped>
.paper-choice { position:relative; display:inline-block; min-width:0; font:14px/1.4 var(--ruler-font); color:var(--dial-ink); }
.paper-choice > button {
  display:flex; width:100%; min-height:38px; align-items:center; justify-content:space-between; gap:12px;
  padding:5px 11px; border:1px solid var(--dial-lightInk); border-radius:2px; background:transparent; color:inherit; font:inherit;
}
.paper-choice > button i { width:6px; height:6px; transform:translateY(-2px) rotate(45deg); border:solid currentColor; border-width:0 1px 1px 0; }
.paper-choice > button:hover,.paper-choice > button[aria-expanded=true] { border-color:var(--dial-cinnabar); color:var(--dial-cinnabar); }
.paper-choice > button:focus-visible {outline:2px solid var(--dial-cinnabar);outline-offset:2px;}
.paper-options { position:absolute; z-index:12; inset:100% 0 auto; margin-top:2px; min-width:max-content; max-height:220px; overflow:auto;
  border:1px solid var(--dial-lightInk); background:var(--dial-paper); text-align:start; }
.paper-options [role=option] {display:block; padding:7px 12px; cursor:pointer; white-space:nowrap;}
.paper-options .pointed { background:var(--dial-paperEdge); }
.paper-options [aria-selected=true] { color:var(--dial-cinnabar); text-decoration:underline; text-underline-offset:3px; }
</style>
