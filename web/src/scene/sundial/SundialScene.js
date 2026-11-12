import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { DIAL_RADIUS, polarBasis, projectTipToDial } from '../../lib/astro/sundialGeometry.js';
import { SKY_RADIUS } from '../../lib/astro/tracks.js';
import { SUNDIAL_COLORS as C, SUNDIAL_VIEWS } from './sundialTheme.js';
import { createDialTextures, createBaseTexture, createStoneNormal, createMarkerTexture, createTextTexture } from './textures.js';
import { createInstrument, disposeObject } from './instrument.js';
import { createStage } from './stage.js';
import { createSolarShadowFilter, solarShadowVolume } from './solarShadows.js';
import { createSolarPath } from './solarPath.js';

const Y = new THREE.Vector3(0,1,0);
const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
const ease = value => 1 - Math.pow(1-value,3);
const shadowPreviewRadius = DIAL_RADIUS * 2.2;
const skyScale = 1.31;
const sunOrbitRadius = SKY_RADIUS * skyScale;
const dawnLight = new THREE.Color('#ffba79');
const daytimeLight = new THREE.Color('#ffe4ba');
function direction(azimuth,elevation) {
  const az = azimuth*Math.PI/180, el = elevation*Math.PI/180;
  return new THREE.Vector3(Math.sin(az)*Math.cos(el),Math.sin(el),-Math.cos(az)*Math.cos(el));
}
function segmentLine(color,width,dashed=false,opacity=1) {
  const material = new LineMaterial({ color, linewidth:width, dashed, transparent:true, opacity,
    dashSize:.28, gapSize:.18, depthWrite:false, toneMapped:false });
  const line = new LineSegments2(new LineSegmentsGeometry(),material);
  line.frustumCulled = false; line.userData.hasData = false; line.visible = false;
  return line;
}
function setSegments(line,positions) {
  line.userData.hasData = positions.length >= 6;
  if (!line.userData.hasData) return;
  const buffer = line.geometry.attributes.instanceStart?.data;
  if (buffer?.array.length === positions.length) {
    buffer.array.set(positions);
    buffer.needsUpdate = true;
  } else {
    line.geometry.dispose();
    line.geometry.setPositions(positions);
  }
  if (line.material.dashed) line.computeLineDistances();
}
function arcSegments(points) {
  const positions = [];
  for (let i=1;i<points.length;i++) positions.push(...points[i-1],...points[i]);
  return positions;
}

export class SundialScene {
  constructor(host,options={}) {
    this.host=host; this.options=options; this.disposed=false; this.frame=0; this.state={};
    this.layers={sky:true,shadow:false,ray:false,compass:false}; this.preset='oblique'; this.face='front';
    this.reducedMotion=false; this.fitDistance=20; this.lastWidth=0; this.lastHeight=0;
  }

  init(initialState={}) {
    this.state=initialState; this.reducedMotion=Boolean(initialState.reducedMotion);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,initialState.low?1:2));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace; this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.08; this.renderer.setClearColor(C.stageEdge);
    this.renderer.shadowMap.enabled=true; this.renderer.shadowMap.type=THREE.BasicShadowMap;
    const compact=Boolean(initialState.low)||matchMedia('(pointer:coarse)').matches;
    this.solarSpread={value:.006};
    this.filterSolarShadow=createSolarShadowFilter(this.solarSpread,compact);
    const canvas=this.renderer.domElement; canvas.setAttribute('aria-hidden','true'); this.host.appendChild(canvas);
    this.scene=new THREE.Scene(); this.scene.background=new THREE.Color(C.stageEdge);
    this.camera=new THREE.PerspectiveCamera(37,1,.08,240); this.camera.up.copy(Y);
    this.controls=new OrbitControls(this.camera,canvas); this.controls.enablePan=false; this.controls.enableDamping=true;
    this.controls.dampingFactor=.09; this.controls.rotateSpeed=.65; this.controls.zoomSpeed=.75;
    this.controls.minPolarAngle=.025; this.controls.maxPolarAngle=Math.PI/2-.045;
    this.controls.addEventListener('change',this.onControlsChange=()=>this.requestRender());
    this.controls.addEventListener('start',this.onControlsStart=()=>{this.tween=null;});
    canvas.addEventListener('dblclick',this.onDoubleClick=()=>{
      const face=this.state.solar?.polar?.face??this.face;
      this.setView('oblique',face,!this.reducedMotion); this.options.onView?.('oblique',face);
    });
    canvas.addEventListener('webglcontextlost',this.onContextLost=event=>{event.preventDefault();this.options.onUnavailable?.();});

    const pmrem=new THREE.PMREMGenerator(this.renderer), room=new RoomEnvironment();
    this.environmentTarget=pmrem.fromScene(room,.04); this.scene.environment=this.environmentTarget.texture;
    this.scene.environmentIntensity=.56; room.dispose(); pmrem.dispose();
    this.fill=new THREE.HemisphereLight('#dbeae6','#3b4945',.63);
    this.rim=new THREE.DirectionalLight('#d3ebe3',.75);
    this.rim.position.set(-7,7,-6);
    this.scene.add(this.fill,this.rim);
    this.light=new THREE.DirectionalLight('#ffe4ba',3.9); this.light.castShadow=true;
    const shadowSize=compact?1024:2048;
    this.light.shadow.mapSize.set(shadowSize,shadowSize);
    const {halfWidth,near,far}=solarShadowVolume;
    Object.assign(this.light.shadow.camera,{left:-halfWidth,right:halfWidth,top:halfWidth,bottom:-halfWidth,near,far});
    this.light.shadow.bias=-.000012; this.light.shadow.normalBias=.003;
    this.light.shadow.autoUpdate=false; this.scene.add(this.light,this.light.target);
    const {group,shade}=createStage();
    this.stageShadow=shade.material;
    this.filterSolarShadow(this.stageShadow);
    this.scene.add(group);
    this.skyGroup=new THREE.Group(); this.scene.add(this.skyGroup);
    this.sunPath=createSolarPath();
    this.skyGroup.add(this.sunPath.group);
    this.sun=new THREE.Sprite(new THREE.SpriteMaterial({map:createMarkerTexture('sun'),transparent:true,depthWrite:false,
      sizeAttenuation:false,toneMapped:false}));
    this.sun.scale.setScalar(.183); this.sun.renderOrder=3; this.skyGroup.add(this.sun);

    this.dialAttachments=new THREE.Group();
    this.shadowTracks={front:segmentLine(C.cinnabarTrack,1.5,false,.82),back:segmentLine(C.cinnabarTrack,1.5,false,.82)};
    this.dialAttachments.add(this.shadowTracks.front,this.shadowTracks.back);
    this.overflowLine=segmentLine(C.cinnabarTrack,1.6,true,.92); this.dialAttachments.add(this.overflowLine);
    const markerPlane=new THREE.PlaneGeometry(.9,.9);
    const marker=(kind)=>{
      const mesh=new THREE.Mesh(markerPlane,new THREE.MeshBasicMaterial({map:createMarkerTexture(kind),transparent:true,
        depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-4}));
      mesh.visible=false;mesh.renderOrder=20;this.dialAttachments.add(mesh);
      return mesh;
    };
    this.dot=marker('shadow'); this.ghost=marker('shadow'); this.secondaryDot=marker('secondary');
    this.debugDot=new THREE.Mesh(new THREE.SphereGeometry(.065,12,8),new THREE.MeshBasicMaterial({color:C.debug,depthTest:false}));
    this.debugDot.visible=false; this.dialAttachments.add(this.debugDot);

    this.ray=segmentLine(C.ray,1.8,true,.95);
    this.rayGlow=segmentLine('#d7883e',1.45,true,.55);
    this.rayGlow.material.depthTest=false; this.rayGlow.renderOrder=8;
    this.ray.renderOrder=9;
    this.scene.add(this.rayGlow,this.ray);
    this.compass=this.createCompass(); this.scene.add(this.compass);
    this.angleGroup=new THREE.Group(); this.latitudeArc=segmentLine(C.bronzeDark,2.2); this.altitudeArc=segmentLine(C.sun,2.2);
    this.latitudeArc.renderOrder=this.altitudeArc.renderOrder=15;
    this.latitudeArc.material.depthTest=this.altitudeArc.material.depthTest=false;
    this.angleGroup.add(this.latitudeArc,this.altitudeArc);
    this.angleLabels=['φ','h 投影'].map(text=>{const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:createTextTexture(text),transparent:true,depthWrite:false}));
      sprite.scale.set(1.5,.75,1);this.angleGroup.add(sprite);return sprite;});
    this.scene.add(this.angleGroup);
    this.buildInstrument(initialState.latitude??34.4);
    this.resizeObserver=new ResizeObserver(()=>this.resize()); this.resizeObserver.observe(this.host);
    document.addEventListener('visibilitychange',this.onVisibility=()=>{if(document.hidden){cancelAnimationFrame(this.frame);this.frame=0;}else this.requestRender();});
    this.setLayers(initialState.layers??this.layers); this.updateTracks(); this.updateSolar(); this.resize(); this.setView(initialState.preset??'oblique',initialState.face??'front',false);
    if(new URLSearchParams(location.search).has('debug')) window.__sundialDebug=this;
    this.options.onReady?.(); this.requestRender();
  }

  buildInstrument(latitude) {
    if(this.instrument){
      this.instrument.dial.remove(this.dialAttachments); this.scene.remove(this.instrument.group); disposeObject(this.instrument.group);
    }
    this.latitude=latitude;
    this.textures=createDialTextures(this.renderer,matchMedia('(pointer:coarse)').matches);
    this.baseTexture=createBaseTexture(this.renderer); this.stoneNormal=createStoneNormal(this.renderer);
    this.instrument=createInstrument(latitude,this.textures,this.baseTexture,this.stoneNormal);
    this.scene.add(this.instrument.group);
    this.instrument.group.updateMatrixWorld(true);
    this.fitPoints=[];
    const corner=new THREE.Vector3();
    const receivers=new Set();
    this.instrument.group.traverse(item=>{
      if(!item.geometry)return;
      if(item.receiveShadow)receivers.add(item.material);
      const positions=item.geometry.attributes.position;
      const stride=Math.max(1,Math.floor(positions.count/96));
      for(let index=0;index<positions.count;index+=stride){
        this.fitPoints.push(corner.clone().fromBufferAttribute(positions,index).applyMatrix4(item.matrixWorld));
      }
    });
    receivers.forEach(this.filterSolarShadow);
    this.instrument.dial.add(this.dialAttachments);
    this.modelAim=(this.instrument.centerHeight+DIAL_RADIUS*.45)*.57;
    this.target=new THREE.Vector3(0,this.modelAim,0);
    this.controls.target.copy(this.target);
    this.applyXray(this.state.xray);
  }

  createCompass() {
    const group=new THREE.Group(),points=[];
    for(let i=0;i<96;i++){
      const a=i/96*Math.PI*2,b=(i+1)/96*Math.PI*2;
      points.push(Math.sin(a)*7.2,.025,-Math.cos(a)*7.2,Math.sin(b)*7.2,.025,-Math.cos(b)*7.2);
    }
    group.add(segmentLine('#b8cabc',1,true,.48)); setSegments(group.children[0],points);
    for(const [text,x,z] of [['真北',0,-7.5],['东',7.5,0],['南',0,7.5],['西',-7.5,0]]){
      const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:createTextTexture(text),transparent:true,depthWrite:false}));
      sprite.position.set(x,.35,z);sprite.scale.set(1.35,.68,1);group.add(sprite);
    }
    return group;
  }

  setState(next) {
    if(this.disposed)return;
    const previous=this.state; this.state={...previous,...next}; this.reducedMotion=Boolean(this.state.reducedMotion);
    if(!this.renderer)return;
    const newLatitude=next.latitude!=null&&Math.abs(next.latitude-this.latitude)>1e-8;
    if(newLatitude)this.buildInstrument(next.latitude);
    if((next.tracks!==undefined&&next.tracks!==previous.tracks)||newLatitude)this.updateTracks();
    if(previous.xray!==this.state.xray)this.applyXray(this.state.xray);
    this.updateSolar(previous);
    if(newLatitude&&this.lastWidth)this.setView(this.preset,this.face,false);
    this.requestRender();
  }

  updateTracks() {
    const tracks=this.state.tracks;if(!tracks||!this.instrument)return;
    const center=this.instrument.centerHeight;
    const toWorld=([east,north,up])=>new THREE.Vector3(east*skyScale,up*skyScale+center,-north*skyScale);
    this.dayPositions=(tracks.day??[]).map(toWorld);
    this.sunPath.update(tracks.solarArcs??[],tracks.horizon??[],toWorld);
    for(const [face,sign] of [['front',1],['back',-1]]){
      const z=sign*(this.instrument.thickness/2+.018);
      setSegments(this.shadowTracks[face],(tracks.polar?.[face]??[]).flatMap(point=>[point[0],point[1],z]));
    }
    this.applyLayers();
  }

  updateSolar(previous={}) {
    const solar=this.state.solar,polar=solar?.polar;if(!solar||!polar||!this.instrument)return;
    const center=new THREE.Vector3(0,this.instrument.centerHeight,0),sun=new THREE.Vector3(...polar.sun);
    this.light.position.copy(center).addScaledVector(sun,solarShadowVolume.lightDistance);this.light.target.position.copy(center);
    const sunStrength=clamp(solar.altitude/15,0,1);
    const daylight=solar.altitude>0;
    this.light.intensity=5.0*sunStrength**.34;
    this.light.color.copy(dawnLight).lerp(daytimeLight,clamp(solar.altitude/22,0,1));
    this.light.castShadow=daylight;
    this.light.shadow.needsUpdate=daylight;
    // A slightly broadened dawn glow makes the penumbra legible in the small model.
    this.solarSpread.value=THREE.MathUtils.lerp(.011,.0055,sunStrength);
    this.stageShadow.opacity=.62*Math.sqrt(sunStrength);
    this.fill.intensity=.34+sunStrength*.15;
    this.rim.intensity=.37+sunStrength*.16;
    this.scene.environmentIntensity=.32+sunStrength*.11;
    this.sun.position.copy(center).addScaledVector(sun,sunOrbitRadius);this.sun.visible=daylight;
    this.sunPath.setTime(solar.ms);
    this.overflowLine.userData.hasData=false;this.dot.visible=false;this.debugDot.visible=false;
    let guide=[];
    if(polar.valid){
      const sign=polar.face==='front'?1:-1, surface=sign*this.instrument.thickness/2;
      const z=surface+sign*.015,end=polar.localEnd;
      const length=Math.hypot(end[0],end[1]);
      this.placeMarker(this.dot,polar);
      if(!polar.inside){
        const ratio=Math.min(polar.distance,shadowPreviewRadius)/length;
        setSegments(this.overflowLine,[end[0],end[1],z,end[0]*ratio,end[1]*ratio,z]);
      }
      const offset=center.clone().addScaledVector(new THREE.Vector3(...polar.normal),surface);
      const tip=new THREE.Vector3(...polar.tip).add(offset);
      const entry=tip.clone().addScaledVector(sun,sunOrbitRadius*.89);
      const impact=new THREE.Vector3(...polar.point).add(offset);
      const exit=tip.clone().lerp(impact,Math.min(1,shadowPreviewRadius/polar.distance));
      guide=[...entry.toArray(),...tip.toArray(),...tip.toArray(),...exit.toArray()];
      if(this.state.debug){
        const projected=projectTipToDial(polar.tip,polar.sun,polar.normal);
        const local=new THREE.Vector3(...projected).applyQuaternion(this.instrument.dial.quaternion.clone().invert());
        this.debugDot.position.copy(local);this.debugDot.position.z+=sign*.08;this.debugDot.visible=true;
      }
      if(this.state.compare&&previous.solar?.polar?.valid&&!this.reducedMotion){
        const old=previous.solar.polar;
        if(old.face!==polar.face||Math.hypot(old.local[0]-polar.local[0],old.local[1]-polar.local[1])>.01){
          this.placeMarker(this.ghost,old);
          this.ghost.material.opacity=.55;this.ghostStarted=performance.now();
        }
      }
    }else if(this.sun.visible){
      const origin=center.clone().addScaledVector(new THREE.Vector3(...polar.normal),this.instrument.thickness*.7);
      guide=[...origin.clone().addScaledVector(sun,sunOrbitRadius*.89).toArray(),
        ...origin.clone().addScaledVector(sun,-DIAL_RADIUS*.84).toArray()];
    }
    setSegments(this.ray,guide);setSegments(this.rayGlow,guide);
    const secondary=this.state.secondary?.polar;
    this.secondaryDot.visible=false;
    if(this.state.showBoth&&secondary?.valid)this.placeMarker(this.secondaryDot,secondary);
    this.dot.userData.hasData=this.dot.visible;
    this.updateAngles();this.applyLayers();
  }

  placeMarker(marker,shadow) {
    const front=shadow.face==='front';
    marker.rotation.y=front?0:Math.PI;
    marker.position.set(shadow.local[0],shadow.local[1],(front?1:-1)*(this.instrument.thickness/2+.038));
    marker.visible=shadow.distance<=shadowPreviewRadius;
  }

  updateAngles() {
    if(!this.instrument||!this.state.solar)return;
    const horizontal=this.latitude>=0?[0,0,-1]:[0,0,1],angle=Math.abs(this.latitude)*Math.PI/180;
    const points=[];
    for(let i=0;i<=24;i++){
      const t=i/24*angle;
      points.push([0,Math.sin(t)*2.25,horizontal[2]*Math.cos(t)*2.25]);
    }
    // Latitude arc is expressed around the dial centre in the meridian plane.
    const center=[0,this.instrument.centerHeight,0];
    setSegments(this.latitudeArc,arcSegments(points.map(point=>point.map((value,index)=>value+center[index]))));
    const sun=this.state.solar.polar.sun,sz=Math.abs(sun[2])>.0001?sun[2]:-1;
    const solarPoints=[],h=Math.atan2(sun[1],Math.abs(sz));
    for(let i=0;i<=24;i++){
      const t=i/24*h;solarPoints.push([center[0],center[1]+Math.sin(t)*2.7,center[2]+Math.sign(sz)*Math.cos(t)*2.7]);
    }
    setSegments(this.altitudeArc,arcSegments(solarPoints));
    this.angleLabels[0].position.set(0,center[1]+2.55,center[2]+Math.sign(horizontal[2])*1.25);
    this.angleLabels[1].position.set(0,center[1]+Math.sin(h/2)*3.1,center[2]+Math.sign(sz)*Math.cos(h/2)*3.1);
    this.angleGroup.visible=this.preset==='side'&&this.layers.ray;
  }

  applyXray(enabled) {
    if(!this.instrument)return;
    for(const material of this.instrument.faceMaterials){
      material.transparent=Boolean(enabled);material.opacity=enabled ? .35 : 1;
      material.depthWrite=!enabled;material.needsUpdate=true;
    }
    for(const name of ['front-dial-face','back-dial-face']){
      this.instrument.dial.getObjectByName(name).castShadow=!enabled;
    }
    for(const mesh of this.instrument.dial.children){
      if(mesh.material===this.instrument.bodyMaterial)mesh.castShadow=!enabled;
    }
    this.instrument.bodyMaterial.transparent=Boolean(enabled);this.instrument.bodyMaterial.opacity=enabled ? .22 : 1;
    this.instrument.bodyMaterial.depthWrite=!enabled;this.instrument.bodyMaterial.needsUpdate=true;
    for(const marker of [this.dot,this.secondaryDot,this.ghost]){
      marker.material.depthTest=!enabled;
      marker.material.side=enabled?THREE.DoubleSide:THREE.FrontSide;
      marker.material.needsUpdate=true;
    }
  }

  setLayers(layers) {this.layers={...this.layers,...layers};this.applyLayers();this.requestRender();}
  applyLayers() {
    if(!this.sunPath)return;
    this.skyGroup.visible=this.layers.sky;
    for(const face of ['front','back'])this.shadowTracks[face].visible=this.layers.shadow&&this.shadowTracks[face].userData.hasData;
    this.ray.visible=this.rayGlow.visible=this.layers.ray&&this.ray.userData.hasData;this.compass.visible=this.layers.compass;
    const annotations=this.layers.ray||this.layers.shadow||this.state.compare;
    this.dot.visible=annotations&&this.dot.userData.hasData;
    this.overflowLine.visible=annotations&&this.overflowLine.userData.hasData;
    if(this.angleGroup){
      this.angleGroup.visible=this.preset==='side'&&this.layers.ray;
      const anglesVisible=this.angleGroup.visible&&this.latitudeArc.userData.hasData;
      this.latitudeArc.visible=anglesVisible;this.altitudeArc.visible=anglesVisible&&this.sun.visible&&this.altitudeArc.userData.hasData;
      this.angleLabels[0].visible=anglesVisible;
      this.angleLabels[1].visible=this.altitudeArc.visible;
    }
  }

  setView(preset='oblique',face=this.face,animate=true) {
    if(!this.camera||!this.target)return;this.preset=preset;this.face=face;
    const skyRoom=preset==='oblique'&&this.layers.sky?(face==='front'?1.65:.7):0;
    this.target.y=this.modelAim+skyRoom;
    this.controls.target.copy(this.target);
    const {P}=polarBasis(this.latitude);
    const normal=new THREE.Vector3(...P).multiplyScalar(face==='front'?1:-1);
    let outward;
    if(preset==='overhead'){
      outward=normal.clone();
      if(outward.y<.10)outward=direction(face==='front'?0:180,6);
      if(outward.y>.99)outward=direction(face==='front'?0:180,82);
    }else if(preset==='side'){
      outward=direction(SUNDIAL_VIEWS.side.azimuth,SUNDIAL_VIEWS.side.elevation);
    }else{
      const view=face==='back'?SUNDIAL_VIEWS.back:SUNDIAL_VIEWS.oblique;
      const elevation=normal.y<0?Math.min(view.elevation,Math.atan2(Math.abs(normal.z),-normal.y)*180/Math.PI*.65):view.elevation;
      outward=direction(view.azimuth,Math.max(3,elevation));
    }
    this.fitDistance=this.distanceFor(outward);
    this.updateZoomLimits();
    const destination=this.target.clone().addScaledVector(outward,this.fitDistance);
    this.controls.enabled=false;this.controls.enableDamping=false;
    this.tween=null;
    if(!animate||this.reducedMotion){
      this.camera.position.copy(destination);this.controls.update();this.controls.enabled=true;this.controls.enableDamping=true;
    }else{
      this.tween={started:performance.now(),from:this.camera.position.clone(),to:destination};
    }
    this.applyLayers();this.requestRender();
  }

  distanceFor(outward) {
    const right=new THREE.Vector3().crossVectors(Y,outward).normalize();
    const vertical=new THREE.Vector3().crossVectors(outward,right);
    const fov=Math.tan(this.camera.fov*Math.PI/360);
    const relative=new THREE.Vector3();
    const distance=(point,xMargin,yMargin)=>{
      relative.copy(point).sub(this.target);
      return relative.dot(outward)+Math.max(
        Math.abs(relative.dot(right))/(fov*this.camera.aspect*xMargin),
        Math.abs(relative.dot(vertical))/(fov*yMargin),
      );
    };
    let fitted=0;
    for(const point of this.fitPoints)fitted=Math.max(fitted,distance(point,.86,.86));
    if(this.preset==='oblique'&&this.layers.sky&&this.dayPositions?.length){
      const narrow=this.camera.aspect<1.1;
      let skyFit=fitted;
      for(const point of this.dayPositions){
        skyFit=Math.max(skyFit,distance(point,narrow?.83:.89,.84));
      }
      // Keep the instrument legible on narrow screens even if an arc is partly outside the view.
      fitted=Math.min(skyFit,fitted*(narrow?1.43:1.30));
    }
    return fitted;
  }

  updateZoomLimits() {
    this.controls.minDistance=this.fitDistance*.57;
    this.controls.maxDistance=this.fitDistance*2;
  }

  resize() {
    if(!this.renderer||this.disposed)return;
    const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;
    const oldFit=this.fitDistance;this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.state.low?1:2));this.renderer.setSize(w,h,false);
    this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
    if(this.lastWidth&&oldFit){
      const offset=this.camera.position.clone().sub(this.target);
      this.fitDistance=this.distanceFor(offset.clone().normalize());
      this.updateZoomLimits();
      this.camera.position.copy(this.target).addScaledVector(offset,this.fitDistance/oldFit);
    }
    this.lastWidth=w;this.lastHeight=h;
    this.scene.traverse(item=>{if(item.material?.isLineMaterial)item.material.resolution.set(w,h);});
    this.requestRender();
  }

  requestRender() {
    if(this.disposed||document.hidden||this.frame)return;
    this.frame=requestAnimationFrame(()=>this.renderFrame());
  }
  renderFrame() {
    this.frame=0;if(this.disposed||document.hidden)return;
    let active=false;
    if(this.tween){
      const t=clamp((performance.now()-this.tween.started)/500,0,1),k=ease(t);
      const from=this.tween.from.clone().sub(this.target),to=this.tween.to.clone().sub(this.target);
      const a=new THREE.Spherical().setFromVector3(from),b=new THREE.Spherical().setFromVector3(to);
      const turn=Math.atan2(Math.sin(b.theta-a.theta),Math.cos(b.theta-a.theta));
      a.theta+=turn*k;a.phi=THREE.MathUtils.lerp(a.phi,b.phi,k);a.radius=THREE.MathUtils.lerp(a.radius,b.radius,k);
      this.camera.position.setFromSpherical(a).add(this.target);
      if(t>=1){this.tween=null;this.controls.enabled=true;this.controls.enableDamping=true;}else active=true;
    }
    if(this.controls.update())active=true;
    if(this.ghost.visible){
      const t=(performance.now()-this.ghostStarted)/600;
      if(t>=1)this.ghost.visible=false;else{this.ghost.material.opacity=.55*(1-t);active=true;}
    }
    this.renderer.render(this.scene,this.camera);this.reportSun();if(active)this.requestRender();
  }
  reportSun() {
    if(!this.options.onSunEdge||!this.sun.visible||!this.layers.sky)return;
    const cameraPoint=this.sun.position.clone().applyMatrix4(this.camera.matrixWorldInverse);
    const point=this.sun.position.clone().project(this.camera);
    const visible=Math.abs(point.x)<.89&&Math.abs(point.y)<.94&&cameraPoint.z<0;
    const scale=Math.max(1,Math.abs(point.x)/.82,Math.abs(point.y)/.76);
    const x=visible?point.x:point.x/scale,y=visible?point.y:point.y/scale;
    const next={visible,x:(x+1)*50,y:(1-y)*50,angle:Math.atan2(-y,x)*180/Math.PI,
      altitude:this.state.solar?.altitude??0};
    const last=this.lastSunReport;
    if(!last||last.visible!==visible||Math.abs(last.x-next.x)+Math.abs(last.y-next.y)>.04||last.altitude!==next.altitude){
      this.lastSunReport=next;
      this.options.onSunEdge(next);
    }
  }

  dispose() {
    if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.frame);this.resizeObserver?.disconnect();
    document.removeEventListener('visibilitychange',this.onVisibility);
    if(this.controls){this.controls.removeEventListener('change',this.onControlsChange);this.controls.removeEventListener('start',this.onControlsStart);this.controls.dispose();}
    const canvas=this.renderer?.domElement;
    if(canvas){canvas.removeEventListener('dblclick',this.onDoubleClick);canvas.removeEventListener('webglcontextlost',this.onContextLost);}
    this.sunPath?.dispose();
    if(this.scene)disposeObject(this.scene);this.environmentTarget?.dispose();this.light?.shadow?.dispose();
    this.renderer?.dispose();this.renderer?.forceContextLoss();canvas?.remove();if(window.__sundialDebug===this)delete window.__sundialDebug;
    this.renderer=null;this.scene=null;
  }
}
