<script setup>
import { onMounted, onActivated, onDeactivated, onBeforeUnmount, ref, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DIAL_RADIUS, hourMarks, toScene } from '../lib/astro/geometry.js';
import { scaledSun } from '../lib/astro/tracks.js';

const props = defineProps({ solar: Object, latitude: Number, tracks: Object, layers: Object, preset: String,
  reset: Number, touchActive: Boolean, low: Boolean });
const emit = defineEmits(['unavailable', 'ready']);
const host = ref(null);
let rig;

const xyz = (v, height = 0) => {
  const [x,y,z] = toScene(v);
  return [x,y+height,z];
};
function markTexture(latitude) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  ctx.translate(512, 512);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const radius of [4.6, 4.86]) {
    ctx.beginPath();
    ctx.arc(0,0,radius * 100,0,Math.PI * 2);
    ctx.strokeStyle = '#947248';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  for (const mark of hourMarks(latitude)) {
    const [e,n] = mark.direction;
    ctx.beginPath();
    ctx.moveTo(e * 65, -n * 65);
    ctx.lineTo(e * 424, -n * 424);
    ctx.strokeStyle = mark.hour === 12 ? '#9e4935' : '#806547';
    ctx.lineWidth = mark.major ? 2 : 1;
    ctx.stroke();
    if (mark.label) {
      ctx.font = '30px Georgia';
      ctx.fillStyle = '#3d3023';
      ctx.fillText(mark.label, e * 448, -n * 448);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function textMarker(text) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f6f3ea';
  ctx.beginPath(); ctx.arc(64,64,47,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#304b3f'; ctx.font = '52px serif'; ctx.textAlign = 'center';
  ctx.textBaseline = 'middle'; ctx.fillText(text,64,68);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
  sprite.scale.setScalar(.8);
  return sprite;
}
function material(color, metalness, roughness) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}
function release(object) {
  object.traverse(item => {
    item.geometry?.dispose();
    const mat = item.material;
    mat?.map?.dispose();
    mat?.dispose();
  });
}

function init() {
  if (rig || !host.value) return;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setClearColor('#f1ecde');
    renderer.shadowMap.enabled = !props.low;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    host.value.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(39, 1, .1, 90);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0,1.05,0);
    controls.enablePan = false;
    controls.minDistance = 10;
    controls.maxDistance = 38;
    controls.maxPolarAngle = Math.PI / 2 - .035;

    const disc = new THREE.Mesh(new THREE.CylinderGeometry(5,5,.18,96), material('#c5a573', .44, .63));
    disc.position.y = -.09;
    disc.receiveShadow = true;
    scene.add(disc);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(4.65,4.85,.24,64), material('#b7ac95', .04, .9));
    base.position.y = -.30;
    scene.add(base);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200,200), material('#e7dfcb', 0, .95));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -.43;
    floor.receiveShadow = true;
    scene.add(floor);
    scene.add(new THREE.HemisphereLight('#fff4db', '#aaa792', 2.15));
    const light = new THREE.DirectionalLight('#fff1d6', 2.45);
    light.castShadow = !props.low;
    const size = matchMedia('(pointer: coarse)').matches ? 1024 : 2048;
    light.shadow.mapSize.set(size, size);
    Object.assign(light.shadow.camera, { left:-8, right:8, bottom:-8, top:8, near:1, far:35 });
    light.shadow.bias = -.0002;
    light.shadow.normalBias = .015;
    scene.add(light, light.target);
    const sun = new THREE.Mesh(new THREE.SphereGeometry(.19,18,12), new THREE.MeshBasicMaterial({ color:'#bf7c32' }));
    const dot = new THREE.Mesh(new THREE.SphereGeometry(.075,12,8), new THREE.MeshBasicMaterial({ color:'#a04130' }));
    const compass = new THREE.Group();
    const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length:96 }, (_, i) => {
      const a = i / 96 * Math.PI * 2;
      return new THREE.Vector3(Math.sin(a) * 7.8, .012, Math.cos(a) * 7.8);
    })), new THREE.LineBasicMaterial({ color:'#b6a789' }));
    compass.add(ring);
    for (const [text, e, n] of [['北',0,6],['东',6,0],['南',0,-6],['西',-6,0]]) {
      const marker = textMarker(text);
      marker.position.set(...xyz([e,n,.05]));
      compass.add(marker);
    }

    function line(color, opacity = 1) {
      return new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({
        color, transparent:opacity < 1, opacity,
      }));
    }
    const day = line('#a36528'), night = line('#877f6a', .36);
    const track = line('#467668'), ray = line('#bd7431'), shadow = line('#354939');
    scene.add(sun,dot,compass,day,night,track,ray,shadow);
    const render = () => renderer.render(scene, camera);
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = host.value;
      if (!w || !h) return;
      renderer.setPixelRatio(Math.min(devicePixelRatio, props.low ? 1 : matchMedia('(pointer: coarse)').matches ? 1.25 : 1.6));
      renderer.setSize(w,h,false);
      camera.aspect = w/h;
      camera.fov = camera.aspect < 1 ? 50 : 39;
      camera.updateProjectionMatrix();
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host.value);
    const contextLost = event => {
      event.preventDefault();
      emit('unavailable');
    };
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    controls.addEventListener('change', render);
    rig = { renderer, scene, camera, controls, light, sun, dot, compass, day, night, track, ray, shadow,
      render, resize, observer, contextLost };
    rebuildDial();
    updateTracks();
    updateSolar();
    updateLayers();
    changeView();
    resize();
    emit('ready');
  } catch (error) {
    console.warn('三维日晷初始化失败', error);
    if (rig) destroy();
    else {
      renderer?.dispose();
      renderer?.domElement.remove();
    }
    emit('unavailable');
  }
}
function setLine(line, points, y = 0) {
  line.geometry.dispose();
  line.geometry = new THREE.BufferGeometry();
  line.geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap(v => xyz(v,y)),3));
}
function rebuildDial() {
  if (!rig) return;
  const { scene } = rig;
  if (rig.dial) { scene.remove(rig.dial); release(rig.dial); }
  const group = new THREE.Group();
  const marks = new THREE.Mesh(new THREE.PlaneGeometry(10.24,10.24), new THREE.MeshBasicMaterial({
    map:markTexture(props.latitude), transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-1,
  }));
  marks.rotation.x = -Math.PI / 2;
  marks.position.y = .009;
  group.add(marks);
  const tip = props.solar.needle;
  if (tip) {
    const shape = new THREE.Shape();
    shape.moveTo(0,0);
    shape.lineTo(-tip[1],0);
    shape.lineTo(-tip[1],tip[2]);
    shape.closePath();
    const needle = new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{ depth:.036, bevelEnabled:false }),
      material('#536b5c',.46,.52));
    needle.rotation.y = -Math.PI / 2;
    // The local x axis maps to world +Z and the plate's thickness straddles x=0.
    needle.position.x = .018;
    needle.castShadow = true;
    group.add(needle);
  }
  rig.dial = group;
  scene.add(group);
  rig.render();
}
function updateTracks() {
  if (!rig) return;
  setLine(rig.day,props.tracks.day,.025);
  setLine(rig.night,props.tracks.night);
  setLine(rig.track,props.tracks.shadow,.035);
  rig.render();
}
function updateSolar() {
  if (!rig) return;
  const { direction, altitude, needle, shadow } = props.solar;
  rig.light.position.set(...xyz(direction.map(value => value * 19)));
  rig.light.intensity = altitude > 0 ? 2.45 * Math.min(1, .18 + altitude / 9) : 0;
  rig.sun.position.set(...xyz(scaledSun(direction)));
  rig.sun.visible = altitude > 0;
  rig.dot.visible = Boolean(shadow?.inside);
  if (shadow?.inside) rig.dot.position.set(...xyz(shadow.point,.063));
  setLine(rig.shadow, shadow ? [[0,0,0],shadow.end] : [], .045);
  let ray = [];
  if (shadow) {
    ray = [needle.map((value,i) => value + direction[i] * 5), needle];
    const fraction = shadow.inside ? 1 : Math.min(1, DIAL_RADIUS / Math.max(1, shadow.distance));
    ray.push(needle, needle.map((value,i) => value + (shadow.point[i] - value) * fraction));
  }
  setLine(rig.ray,ray,.012);
  rig.render();
}
function updateLayers() {
  if (!rig) return;
  const { sky, shadow, ray, compass } = props.layers;
  rig.day.visible = rig.night.visible = sky;
  rig.track.visible = shadow;
  rig.ray.visible = ray;
  rig.compass.visible = compass;
  rig.render();
}
function changeView() {
  if (!rig) return;
  const preset = {
    oblique:[12,12,16], overhead:[0,23,.03], side:[22,2.6,0], reset:[12,12,16],
  }[props.preset] || [12,12,16];
  rig.camera.position.set(...preset);
  rig.controls.update();
  rig.render();
}
function destroy() {
  if (!rig) return;
  const old = rig;
  rig = null;
  old.observer.disconnect();
  old.controls.dispose();
  old.renderer.domElement.removeEventListener('webglcontextlost',old.contextLost);
  release(old.scene);
  old.light.shadow.dispose();
  old.renderer.dispose();
  old.renderer.domElement.remove();
}
watch(() => props.solar, updateSolar);
watch(() => props.latitude, rebuildDial);
watch(() => props.tracks, updateTracks);
watch(() => props.layers, updateLayers, { deep:true });
watch(() => [props.preset,props.reset], changeView);
watch(() => props.low, () => { destroy(); init(); });
onMounted(init);
onActivated(init);
onDeactivated(destroy);
onBeforeUnmount(destroy);
</script>

<template><div ref="host" class="scene-host" :class="{ 'touch-active':touchActive }" /></template>
<style scoped>
.scene-host { width:100%; height:100%; }
.scene-host :deep(canvas) { width:100%; height:100%; display:block; cursor:grab; }
.scene-host :deep(canvas:active) { cursor:grabbing; }
@media (pointer:coarse) {
  .scene-host:not(.touch-active) :deep(canvas) { pointer-events:none; }
}
</style>
