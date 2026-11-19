import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { DIAL_RADIUS, polarBasis, projectTipToDial, solarVector } from '../../lib/astro/sundialGeometry.js';
import { SKY_RADIUS } from '../../lib/astro/tracks.js';
import { palette, SUNDIAL_COLORS as C, SUNDIAL_VIEWS } from './sundialTheme.js';
import { createBowlTexture, createDialTextures, createBaseTexture, createStoneNormal, createMarkerTexture, createTextTexture } from './textures.js';
import { createInstrument, disposeObject } from './instrument.js';
import { centerPortrait, instrumentHull, requiredDistance, viewAxes } from './instrumentFraming.js';
import { createStudio, setStudioSun } from './stage.js';
import { createBowlInstrument } from './bowlInstrument.js';
import { bowlLocalPoint } from '../../lib/astro/bowlSundial.js';
import { createSolarPath } from './solarPath.js';
import { createGnomonReference } from './gnomonReference.js';
import { solarDeclination, solarHourAngle, verticalGnomonShadow } from '../../lib/astro/sundialObservation.js';
import { createSolsticeOverlay } from './solsticeOverlay.js';
import { starVisibility } from '../../lib/astro/celestial.js';
import { createCelestialDome } from './celestialDome.js';
import starData from '../../data/sundialStars.json';

const Y = new THREE.Vector3(0,1,0);
const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
const ease = value => 1 - Math.pow(1-value,3);
const shadowPreviewRadius = DIAL_RADIUS * 2.2;
const skyScale = 1.31;
const sunOrbitRadius = SKY_RADIUS * skyScale;
const domeRadius = sunOrbitRadius * 1.48;
const compactStudio = low => Boolean(low) || matchMedia('(max-width: 600px), (pointer: coarse)').matches;
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
    this.layers={sky:false,shadow:false,ray:false,compass:false}; this.preset='oblique'; this.face='front';
    this.reducedMotion=false; this.fitDistance=20; this.lastWidth=0; this.lastHeight=0;
    this.domeBlend=0;
  }

  init(initialState={}) {
    this.state=initialState; this.reducedMotion=Boolean(initialState.reducedMotion);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,initialState.low?1:2));
    const compact=compactStudio(initialState.low);
    const canvas=this.renderer.domElement; canvas.setAttribute('aria-hidden','true'); this.host.appendChild(canvas);
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(31,1,.08,240); this.camera.up.copy(Y);
    this.controls=new OrbitControls(this.camera,canvas); this.controls.enablePan=false; this.controls.enableDamping=!this.reducedMotion;
    this.controls.dampingFactor=.09; this.controls.rotateSpeed=.65; this.controls.zoomSpeed=.75;
    this.controls.minPolarAngle=.025; this.controls.maxPolarAngle=Math.PI/2;
    this.controls.addEventListener('change',this.onControlsChange=()=>this.requestRender());
    this.controls.addEventListener('start',this.onControlsStart=()=>{
      if(!this.tween)return;
      this.tween=null;
      this.controls.enableDamping=!this.reducedMotion;
    });
    canvas.addEventListener('dblclick',this.onDoubleClick=()=>{
      const face=this.state.solar?.polar?.face??this.face;
      const preset=this.state.solstices?.length?'side':'oblique';
      this.setView(preset,face,!this.reducedMotion); this.options.onView?.(preset,face);
    });
    canvas.addEventListener('webglcontextlost',this.onContextLost=event=>{event.preventDefault();this.options.onUnavailable?.();});
    const raycaster=new THREE.Raycaster();
    canvas.addEventListener('pointermove',this.onPointerMove=event=>{
      if(!this.layers.dome||event.buttons||event.pointerType==='touch')return;
      const bounds=canvas.getBoundingClientRect();
      const pointer=new THREE.Vector2((event.clientX-bounds.left)/bounds.width*2-1,1-(event.clientY-bounds.top)/bounds.height*2);
      raycaster.setFromCamera(pointer,this.camera);
      this.celestial.setHoveredTerm(this.celestial.pickTerm(raycaster)?.id);
      this.requestRender();
    });
    canvas.addEventListener('pointerleave',this.onPointerLeave=()=>{
      if(!this.layers.dome)return;
      this.celestial.setHoveredTerm();
      this.requestRender();
    });

    Object.assign(this,createStudio(this.renderer,this.scene,compact));
    this.celestial=createCelestialDome(domeRadius,starData);
    this.scene.add(this.celestial.group);
    this.reference=createGnomonReference();
    this.reference.group.traverse(item=>{if(item.receiveShadow)this.filterSolarShadow(item.material);});
    this.scene.add(this.reference.group);
    this.solsticeOverlay=createSolsticeOverlay(this.reference);
    this.scene.add(this.solsticeOverlay.group);
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
    this.oppositeShadow=segmentLine(C.sun,2.1,false,.82);
    this.oppositeShadow.material.depthTest=false;
    this.oppositeShadow.renderOrder=12;
    this.dialAttachments.add(this.oppositeShadow);
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
    this.rayGlow=segmentLine(palette.bronzeDark,1.45,true,.55);
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
    this.compact=compactStudio(this.state.low);
    const baseMap=createBaseTexture(this.renderer),normal=this.compact?null:createStoneNormal(this.renderer);
    this.instrument=this.state.instrumentKind==='bowl'
      ? createBowlInstrument(latitude,createBowlTexture(this.renderer,latitude,this.compact),baseMap,normal,this.compact)
      : createInstrument(latitude,createDialTextures(this.renderer,this.compact),baseMap,normal,this.compact);
    for(const marker of [this.dot,this.ghost,this.secondaryDot]){
      marker.visible=false;marker.rotation.set(0,0,0);marker.scale.setScalar(this.instrument.kind==='bowl'?.73:1);
    }
    this.scene.add(this.instrument.group);
    this.instrument.group.updateMatrixWorld(true);
    const foundation=this.instrument.group.getObjectByName('下枋');
    const footprint=new THREE.Box3().setFromObject(foundation).getSize(new THREE.Vector3());
    this.contact.scale.set(footprint.x*1.24,footprint.z*1.24,1);
    this.fitPoints=instrumentHull(this.instrument.group);
    const receivers=new Set();
    this.instrument.group.traverse(item=>{
      if(!item.geometry)return;
      if(item.receiveShadow)for(const material of [].concat(item.material))receivers.add(material);
    });
    receivers.forEach(this.filterSolarShadow);
    this.instrument.dial.add(this.dialAttachments);
    const bounds=new THREE.Box3().setFromObject(this.instrument.group,true);
    this.modelAim=THREE.MathUtils.lerp(bounds.min.y,bounds.max.y,.48);
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
    group.add(segmentLine(palette.lightInk,1,true,.48)); setSegments(group.children[0],points);
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
    if(this.reducedMotion&&this.tween){
      this.camera.position.copy(this.tween.to);
      this.tween=null;
      this.controls.enabled=true;
    }
    if(this.reducedMotion&&this.domeMotion){
      this.domeBlend=this.domeMotion.to;
      this.domeMotion=null;
    }
    this.controls.enableDamping=!this.reducedMotion&&!this.tween;
    const newLatitude=next.latitude!=null&&Math.abs(next.latitude-this.latitude)>1e-8;
    const rebuild=newLatitude||this.state.instrumentKind!==previous.instrumentKind;
    if(rebuild)this.buildInstrument(this.state.latitude??34.4);
    if((next.tracks!==undefined&&next.tracks!==previous.tracks)||rebuild)this.updateTracks();
    if(previous.xray!==this.state.xray)this.applyXray(this.state.xray);
    this.updateSolar(previous);
    if(rebuild&&this.lastWidth)this.setView(this.preset,this.face,false);
    this.requestRender();
  }

  updateTracks() {
    const tracks=this.state.tracks;if(!tracks||!this.instrument)return;
    const center=this.instrument.centerHeight;
    const toWorld=([east,north,up])=>new THREE.Vector3(east*skyScale,up*skyScale+center,-north*skyScale);
    this.dayPositions=(tracks.day??[]).map(toWorld);
    this.sunPath.update(tracks.solarArcs??[],tracks.horizon??[],toWorld);
    if(this.instrument.kind==='bowl'){
      const r=(DIAL_RADIUS-.012)/SKY_RADIUS;
      setSegments(this.shadowTracks.front,(tracks.day??[]).flatMap(([east,north,up])=>[-east*r,-up*r,north*r]));
      setSegments(this.shadowTracks.back,[]);
      this.applyLayers();return;
    }
    for(const [face,sign] of [['front',1],['back',-1]]){
      const z=sign*(this.instrument.thickness/2+.018);
      setSegments(this.shadowTracks[face],(tracks.polar?.[face]??[]).flatMap(point=>[point[0],point[1],z]));
    }
    this.applyLayers();
  }

  updateSolar(previous={}) {
    const solar=this.state.solar,polar=solar?.polar;if(!solar||!polar||!this.instrument)return;
    const center=new THREE.Vector3(0,this.instrument.centerHeight,0),sun=new THREE.Vector3(...polar.sun);
    const daylight=solar.altitude>0;
    setStudioSun(this,center,sun,solar.altitude);
    if(this.instrument.kind==='plate'){
      this.instrument.faceMaterials.forEach((material,index)=>{
        const active=polar.valid&&polar.inside&&polar.face===(index===0?'front':'back');
        const clear=material.userData.inkClearance;
        if(active)clear.set(.5+polar.local[0]/(2*DIAL_RADIUS),.5+polar.local[1]/(2*DIAL_RADIUS),this.compact?.033:.026);
        else clear.z=0;
      });
    }
    this.sun.position.copy(center).addScaledVector(sun,sunOrbitRadius);this.sun.visible=daylight;
    this.sunPath.setTime(solar.ms);
    this.overflowLine.userData.hasData=false;this.dot.visible=false;this.debugDot.visible=false;
    let guide=[];
    const bowl=this.instrument.kind==='bowl';
    if(bowl){
      const local=bowlLocalPoint(polar.sun);
      if(local){
        this.placeBowlMarker(this.dot,polar.sun);
        const entry=center.clone().addScaledVector(sun,sunOrbitRadius*.89),impact=center.clone().add(new THREE.Vector3(...local));
        guide=[...entry.toArray(),...center.toArray(),...center.toArray(),...impact.toArray()];
      }
    }else if(polar.valid){
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
    const peer=this.state.solstices?.find(item=>item.id!==this.state.solsticeDriver);
    const secondary=peer?.solar?.polar??this.state.secondary?.polar;
    this.secondaryDot.visible=false;
    if((this.state.showBoth||peer)&&secondary){
      if(bowl&&secondary.sun[1]>0)this.placeBowlMarker(this.secondaryDot,secondary.sun);
      if(!bowl&&secondary.valid)this.placeMarker(this.secondaryDot,secondary);
    }
    setSegments(this.oppositeShadow,[]);
    if(!bowl&&secondary?.valid&&this.state.xray){
      const z=(secondary.face==='front'?1:-1)*(this.instrument.thickness/2+.036);
      setSegments(this.oppositeShadow,[0,0,z,secondary.localEnd[0],secondary.localEnd[1],z]);
    }
    this.solsticeOverlay.update(this.state.solstices??[],this.state.solsticeDriver,center,sunOrbitRadius,
      this.latitude,this.state.equinox);
    this.dot.userData.hasData=this.dot.visible;
    this.updateCelestial();
    this.applySkyScale();
    this.updateAngles();this.applyLayers();
  }

  updateCelestial() {
    const {solar,longitude}=this.state;
    if(!this.layers.dome||!solar||!Number.isFinite(longitude))return;
    const center=new THREE.Vector3(0,this.instrument.centerHeight,0);
    this.celestial.update({center,latitude:this.latitude,longitude,solarTime:solar.solarTime,altitude:solar.altitude,
      styleReach:this.instrument.length+this.instrument.thickness/2,showNearestTerm:!this.state.solstices?.length});
  }

  applySkyScale() {
    const {solar,longitude}=this.state;
    if(!solar||!this.instrument)return;
    const blend=this.domeBlend;
    const scale=THREE.MathUtils.lerp(1,domeRadius/sunOrbitRadius,blend);
    const center=new THREE.Vector3(0,this.instrument.centerHeight,0);
    const sun=new THREE.Vector3(...solar.polar.sun);
    const ecliptic=Number.isFinite(longitude)&&blend>0
      ? new THREE.Vector3(...solarVector(this.latitude,solarDeclination(longitude),solarHourAngle(solar.solarTime))) : sun;
    sun.lerp(ecliptic,blend).normalize();
    this.skyGroup.scale.setScalar(scale);
    this.skyGroup.position.copy(center).multiplyScalar(1-scale);
    this.sun.position.copy(center).addScaledVector(sun,sunOrbitRadius);
    const twilight=blend*starVisibility(solar.altitude);
    this.setTwilight(twilight);
    this.sun.scale.setScalar(.183*(1-.62*twilight)/scale);
    this.sun.visible=solar.altitude>0||Boolean(this.layers.dome);
    this.sun.material.opacity=solar.altitude>0?1:.50;
    const comparisonCenter=this.reference.top.clone().lerp(center,blend);
    this.solsticeOverlay.setOrbitScale(scale,comparisonCenter,center,this.state.solsticeDriver,sun);
  }

  placeBowlMarker(marker,sun) {
    const normal=new THREE.Vector3(...sun);
    marker.position.copy(normal).multiplyScalar(-DIAL_RADIUS+.019);
    marker.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
    marker.visible=true;
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
    const plate=this.instrument.kind==='plate';
    enabled=Boolean(enabled&&plate);
    for(const material of this.instrument.faceMaterials){
      material.transparent=Boolean(enabled);material.opacity=enabled ? .35 : 1;
      material.depthWrite=!enabled;material.needsUpdate=true;
    }
    if(plate){
      for(const name of ['front-dial-face','back-dial-face','盘缘'])this.instrument.dial.getObjectByName(name).castShadow=!enabled;
      const body=this.instrument.bodyMaterial;
      body.transparent=enabled;body.opacity=enabled?.22:1;body.depthWrite=!enabled;body.needsUpdate=true;
    }
    for(const marker of [this.dot,this.secondaryDot,this.ghost]){
      marker.material.depthTest=!enabled;
      marker.material.side=enabled?THREE.DoubleSide:THREE.FrontSide;
      marker.material.needsUpdate=true;
    }
  }

  setLayers(layers) {
    const changed=Boolean(layers.dome)!==Boolean(this.layers.dome);
    this.layers={...this.layers,...layers};
    if(changed){
      const to=this.layers.dome?1:0;
      this.domeMotion=this.lastWidth&&!this.reducedMotion?{from:this.domeBlend,to,started:performance.now()}:null;
      if(!this.domeMotion)this.domeBlend=to;
      this.celestial.group.visible=Boolean(this.layers.dome);
      this.celestial.setHoveredTerm();
      this.updateCelestial();
      this.applySkyScale();
      if(this.lastWidth)this.setView(this.preset,this.face,!this.reducedMotion);
    }
    this.applyLayers();this.requestRender();
  }
  applyLayers() {
    if(!this.sunPath)return;
    const sun=this.state.solar?.polar?.sun;
    const solstices=this.state.solstices??[];
    const referenceShadows=solstices.length?solstices.map(({id,shadow})=>shadow&&({
      ...shadow,id,active:id===this.state.solsticeDriver,
      label:`${id==='xiazhi'?'夏至':'冬至'} 约 ${shadow.lengthChi.toFixed(2)} 尺`,
    })):[sun&&(this.layers.ray||this.state.compare)?verticalGnomonShadow(sun):null];
    this.reference.update({visible:Boolean(solstices.length||this.state.compare),shadows:referenceShadows.map(shadow=>shadow&&({
      ...shadow,eastChi:shadow.groundPointChi[0],northChi:-shadow.groundPointChi[2],
    }))});
    const nightSun=this.layers.dome&&this.state.solar?.altitude<=0;
    this.skyGroup.visible=((this.layers.sky||this.layers.dome)&&!solstices.length)||nightSun;
    this.sunPath.group.visible=this.layers.sky&&!solstices.length;
    this.solsticeOverlay.group.visible=solstices.length>0;
    this.oppositeShadow.visible=this.oppositeShadow.userData.hasData;
    for(const face of ['front','back'])this.shadowTracks[face].visible=this.layers.shadow&&this.shadowTracks[face].userData.hasData;
    this.ray.visible=this.rayGlow.visible=this.layers.ray&&!solstices.length&&this.ray.userData.hasData;this.compass.visible=this.layers.compass;
    const annotations=this.layers.ray||this.layers.shadow||this.state.compare;
    this.dot.visible=annotations&&this.dot.userData.hasData;
    this.overflowLine.visible=annotations&&this.overflowLine.userData.hasData;
    if(this.angleGroup){
      this.angleGroup.visible=this.preset==='side'&&this.layers.ray&&!solstices.length;
      const anglesVisible=this.angleGroup.visible&&this.latitudeArc.userData.hasData;
      this.latitudeArc.visible=anglesVisible;this.altitudeArc.visible=anglesVisible&&this.state.solar?.altitude>0&&this.altitudeArc.userData.hasData;
      this.angleLabels[0].visible=anglesVisible;
      this.angleLabels[1].visible=this.altitudeArc.visible;
    }
  }

  setView(preset='oblique',face=this.face,animate=true) {
    if(!this.camera||!this.target)return;
    const flips=face!==this.face&&Math.abs(this.state.solar?.declination)<1.2;
    this.preset=preset;this.face=face;
    const comparison=Boolean(this.state.solstices?.length);
    const skyRoom=comparison?2.1:0;
    this.target.set(0,this.layers.dome?this.instrument.centerHeight:this.modelAim+skyRoom,0);
    const {P}=polarBasis(this.latitude);
    const normal=new THREE.Vector3(...P).multiplyScalar(face==='front'?1:-1);
    let outward;
    if(this.instrument.kind==='bowl'&&preset==='oblique'){
      outward=direction(SUNDIAL_VIEWS.bowl.azimuth,SUNDIAL_VIEWS.bowl.elevation);
    }else if(this.instrument.kind==='bowl'&&preset==='overhead'){
      outward=direction(180,89.7);
    }else if(preset==='overhead'){
      outward=normal.clone();
      if(outward.y<.10)outward=direction(face==='front'?0:180,6);
      if(outward.y>.99)outward=direction(face==='front'?0:180,82);
    }else if(preset==='side'){
      outward=direction(SUNDIAL_VIEWS.side.azimuth,comparison?0:SUNDIAL_VIEWS.side.elevation);
    }else if(preset==='north'||preset==='south'){
      const view=preset==='north'?SUNDIAL_VIEWS.oblique:SUNDIAL_VIEWS.south;
      outward=direction(view.azimuth,view.elevation);
    }else{
      const view=face==='back'?SUNDIAL_VIEWS.back:SUNDIAL_VIEWS.oblique;
      const elevation=normal.y<0?Math.min(view.elevation,Math.atan2(Math.abs(normal.z),-normal.y)*180/Math.PI*.65):view.elevation;
      outward=direction(view.azimuth,Math.max(3,elevation));
    }
    if(!this.layers.dome&&!this.layers.sky&&!this.reference.group.visible&&!comparison)
      centerPortrait(this.target,this.fitPoints,outward,this.camera);
    this.controls.target.copy(this.target);
    this.fitDistance=this.distanceFor(outward);
    this.updateZoomLimits();
    const destination=this.target.clone().addScaledVector(outward,this.fitDistance);
    this.controls.enableDamping=false;
    this.tween=null;
    if(!animate||this.reducedMotion){
      this.camera.position.copy(destination);this.controls.update();this.controls.enabled=true;this.controls.enableDamping=!this.reducedMotion;
    }else{
      const duration=comparison&&preset==='side'?960:flips?600:500;
      this.tween={started:performance.now(),from:this.camera.position.clone(),to:destination,duration};
    }
    this.applyLayers();this.requestRender();
  }

  distanceFor(outward) {
    if(this.layers.dome){
      const vfov=this.camera.fov*Math.PI/360;
      const halfAngle=Math.min(vfov,Math.atan(Math.tan(vfov)*this.camera.aspect));
      return (domeRadius+1.35)/Math.sin(halfAngle);
    }
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
    let fitted=requiredDistance(this.fitPoints,this.target,{right,vertical,outward},fov*this.camera.aspect*.84,fov*.84);
    if(this.reference?.group.visible)for(const point of this.reference.fitPoints){
      fitted=Math.max(fitted,distance(point,.9,.88));
    }
    if(this.state.solstices?.length)for(const point of this.solsticeOverlay.fitPoints){
      fitted=Math.max(fitted,distance(point,.9,.85));
    }
    if(this.preset==='oblique'&&this.layers.sky&&this.dayPositions?.length){
      const narrow=this.camera.aspect<1.1;
      let skyFit=fitted;
      for(const point of this.dayPositions){
        skyFit=Math.max(skyFit,distance(point,narrow?.83:.89,.84));
      }
      // Keep the instrument legible on narrow screens even if an arc is partly outside the view.
      fitted=Math.min(skyFit,fitted*(narrow?1.04:1.13));
    }
    return fitted;
  }

  updateZoomLimits() {
    this.safeDirection=null;
    this.controls.minDistance=0;
    this.controls.maxDistance=this.fitDistance*2;
  }

  keepInstrumentInFrame() {
    const offset=this.camera.position.clone().sub(this.target),distance=offset.length();
    if(!distance)return;
    const outward=offset.divideScalar(distance);
    if(!this.safeDirection||outward.distanceToSquared(this.safeDirection)>1e-8){
      this.safeDirection=outward.clone();
      const slope=Math.tan(this.camera.fov*Math.PI/360)*.94;
      this.controls.minDistance=requiredDistance(this.fitPoints,this.target,viewAxes(outward),slope*this.camera.aspect,slope);
      this.controls.maxDistance=Math.max(this.controls.maxDistance,this.controls.minDistance);
    }
    if(distance<this.controls.minDistance)this.camera.position.copy(this.target).addScaledVector(outward,this.controls.minDistance);
  }

  resize() {
    if(!this.renderer||this.disposed)return;
    const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;
    if(this.instrument&&compactStudio(this.state.low)!==this.compact){
      this.buildInstrument(this.latitude);this.updateTracks();this.updateSolar();
    }
    const oldFit=this.fitDistance;this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.state.low?1:2));this.renderer.setSize(w,h,false);
    this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
    if(this.lastWidth&&oldFit){
      const offset=this.camera.position.clone().sub(this.target);
      this.fitDistance=this.distanceFor(offset.clone().normalize());
      this.updateZoomLimits();
      this.camera.position.copy(this.target).addScaledVector(offset,this.fitDistance/oldFit);
      if(this.tween)this.tween.to.sub(this.target).setLength(this.fitDistance).add(this.target);
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
    if(this.domeMotion){
      const t=clamp((performance.now()-this.domeMotion.started)/760,0,1);
      this.domeBlend=THREE.MathUtils.lerp(this.domeMotion.from,this.domeMotion.to,ease(t));
      this.applySkyScale();
      if(t>=1)this.domeMotion=null;else active=true;
    }
    if(this.tween){
      const t=clamp((performance.now()-this.tween.started)/this.tween.duration,0,1),k=ease(t);
      const from=this.tween.from.clone().sub(this.target),to=this.tween.to.clone().sub(this.target);
      const a=new THREE.Spherical().setFromVector3(from),b=new THREE.Spherical().setFromVector3(to);
      const turn=Math.atan2(Math.sin(b.theta-a.theta),Math.cos(b.theta-a.theta));
      a.theta+=turn*k;a.phi=THREE.MathUtils.lerp(a.phi,b.phi,k);a.radius=THREE.MathUtils.lerp(a.radius,b.radius,k);
      this.camera.position.setFromSpherical(a).add(this.target);
      if(t>=1){this.tween=null;this.controls.enabled=true;this.controls.enableDamping=!this.reducedMotion;}else active=true;
    }
    if(this.controls.update())active=true;
    this.keepInstrumentInFrame();
    if(this.ghost.visible){
      const t=(performance.now()-this.ghostStarted)/600;
      if(t>=1)this.ghost.visible=false;else{this.ghost.material.opacity=.55*(1-t);active=true;}
    }
    const dist=this.camera.position.distanceTo(this.instrument.dial.position);
    const diameter=this.lastHeight*DIAL_RADIUS/(dist*Math.tan(this.camera.fov*Math.PI/360));
    if(this.instrument.setDetail(diameter<125?0:diameter<285?1:2))this.light.shadow.needsUpdate=true;
    this.renderer.render(this.scene,this.camera);this.reportSun();this.reportFaceVisibility();if(active)this.requestRender();
  }
  reportFaceVisibility() {
    const polar=this.state.solar?.polar;
    const direction=this.camera.position.clone().sub(this.instrument.dial.position).normalize();
    const facing=polar?.valid&&direction.dot(new THREE.Vector3(...polar.normal))*(polar.face==='front'?1:-1)>.075;
    const visible=this.instrument.kind==='bowl'||!polar?.valid||facing||Boolean(this.state.xray);
    if(visible!==this.lastFaceVisible){
      this.lastFaceVisible=visible;
      this.options.onFaceVisibility?.(visible);
    }
  }
  reportSun() {
    if(!this.options.onSunEdge||!this.sun.visible||!this.layers.sky)return;
    const world=this.sun.getWorldPosition(new THREE.Vector3());
    const cameraPoint=world.clone().applyMatrix4(this.camera.matrixWorldInverse);
    const point=world.project(this.camera);
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
    if(canvas){
      canvas.removeEventListener('dblclick',this.onDoubleClick);canvas.removeEventListener('webglcontextlost',this.onContextLost);
      canvas.removeEventListener('pointermove',this.onPointerMove);canvas.removeEventListener('pointerleave',this.onPointerLeave);
    }
    this.sunPath?.dispose();
    this.solsticeOverlay?.dispose();
    this.celestial?.dispose();
    if(this.scene)disposeObject(this.scene);this.environmentTarget?.dispose();this.paperBackground?.dispose();this.light?.shadow?.dispose();
    this.renderer?.dispose();this.renderer?.forceContextLoss();canvas?.remove();if(window.__sundialDebug===this)delete window.__sundialDebug;
    this.renderer=null;this.scene=null;
  }
}
