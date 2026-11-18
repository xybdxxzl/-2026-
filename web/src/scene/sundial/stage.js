import * as THREE from 'three';
import { createSolarShadowFilter, solarShadowVolume } from './solarShadows.js';
import { applySurfaceFinish } from './surfaceFinish.js';
import { palette } from './sundialTheme.js';

export function createWarmEnvironment(renderer) {
  const room=new THREE.Scene();
  room.background=new THREE.Color(palette.reflection).multiplyScalar(.68);
  const cardShape=new THREE.PlaneGeometry();
  const cards=[];
  function card(x,y,z,width,height,pigment,power) {
    const material=new THREE.MeshBasicMaterial({color:new THREE.Color(pigment).multiplyScalar(power),toneMapped:false});
    const panel=new THREE.Mesh(cardShape,material);
    panel.position.set(x,y,z);panel.scale.set(width,height,1);panel.lookAt(0,0,0);
    room.add(panel);cards.push(material);
  }
  card(-4,5,-3,6.5,7,palette.sky,3.6);
  card(4,2,3,2.7,6,palette.paper,2.6);
  card(1,.7,5,5,3.6,palette.paper,1.7);
  card(0,5,3,5,3,palette.sky,1.8);
  card(1,-3,-4,5,2,palette.ground,.43);
  const generator=new THREE.PMREMGenerator(renderer);
  const target=generator.fromScene(room,.17,.1,20);
  generator.dispose();cardShape.dispose();cards.forEach(m=>m.dispose());
  return target;
}

export function createPaperBackground() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const context=canvas.getContext('2d');
  const wash=context.createRadialGradient(214,174,10,245,233,405);
  wash.addColorStop(0,palette.studioPaper);wash.addColorStop(1,palette.studioEdge);
  context.fillStyle=wash;context.fillRect(0,0,512,512);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}

export function createStage() {
  const shade=new THREE.Mesh(new THREE.PlaneGeometry(450,450),new THREE.ShadowMaterial({
    color:palette.shadow,opacity:.26,depthWrite:false,toneMapped:false,
  }));
  shade.rotation.x=-Math.PI/2;shade.position.y=-.015;shade.receiveShadow=true;shade.renderOrder=-11;
  return shade;
}

// Only the floor receives the soft contact darkening beneath the stone.
function contactPatch() {
  const size=96,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=Math.abs(2*(x+.5)/size-1),v=Math.abs(2*(y+.5)/size-1);
    const distance=Math.max(0,Math.hypot(Math.max(0,u-.68),Math.max(0,v-.68))-.12);
    const i=4*(y*size+x);data[i]=data[i+1]=data[i+2]=255;
    data[i+3]=Math.round(255*Math.exp(-170*distance*distance));
  }
  const map=new THREE.DataTexture(data,size,size);map.magFilter=map.minFilter=THREE.LinearFilter;map.needsUpdate=true;
  const material=new THREE.MeshBasicMaterial({map,color:palette.shadow,opacity:.32,transparent:true,depthWrite:false,toneMapped:false});
  const contact=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);
  contact.rotation.x=-Math.PI/2;contact.position.y=-.012;contact.renderOrder=-10;
  return contact;
}

export function createStudio(renderer,scene,compact) {
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.BasicShadowMap;
  const paperBackground=createPaperBackground(),environmentTarget=createWarmEnvironment(renderer);
  scene.background=paperBackground;scene.environment=environmentTarget.texture;
  const fill=new THREE.HemisphereLight(palette.sky,palette.ground,.32);
  const light=new THREE.DirectionalLight(palette.sunlight,2.35);
  light.castShadow=true;
  const size=compact?1536:3072;light.shadow.mapSize.set(size,size);
  const {halfWidth,near,far}=solarShadowVolume;
  Object.assign(light.shadow.camera,{left:-halfWidth,right:halfWidth,top:halfWidth,bottom:-halfWidth,near,far});
  light.shadow.bias=-.000012;light.shadow.normalBias=.002;light.shadow.autoUpdate=false;
  const shade=createStage(),contact=contactPatch(),solarSpread={value:.0045},supportSpread={value:.047};
  const readingFilter=createSolarShadowFilter(solarSpread,compact);
  const supportFilter=createSolarShadowFilter(supportSpread,compact);
  function filterSolarShadow(material) {
    const filter=material.isShadowMaterial||material.name==='暖灰石'?supportFilter:readingFilter;
    filter(material);applySurfaceFinish(material);
  }
  filterSolarShadow(shade.material);
  scene.add(fill,light,light.target,shade,contact);
  return {scene,fill,light,shade,contact,stageShadow:shade.material,solarSpread,supportSpread,filterSolarShadow,environmentTarget,paperBackground};
}

export function setStudioSun(studio,center,direction,altitude) {
  const {light,fill,scene,solarSpread,supportSpread,stageShadow}=studio;
  const daylight=altitude>0,gain=THREE.MathUtils.clamp(altitude/15,0,1);
  light.position.copy(center).addScaledVector(direction,solarShadowVolume.lightDistance);
  light.target.position.copy(center);
  light.intensity=3.15*Math.pow(gain,.34);
  light.castShadow=daylight;light.shadow.needsUpdate=daylight;
  fill.intensity=.15+.17*gain;
  scene.environmentIntensity=.28+.62*gain;
  solarSpread.value=THREE.MathUtils.lerp(.008,.0045,gain);
  supportSpread.value=THREE.MathUtils.lerp(.072,.047,gain);
  stageShadow.opacity=daylight?.26:0;
}
