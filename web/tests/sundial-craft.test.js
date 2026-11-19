import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DIAL_RADIUS as R, solarHourAngle, solarVector } from '../src/lib/astro/sundialGeometry.js';
import { bowlAnchor, bowlEngravings, bowlLocalPoint } from '../src/lib/astro/bowlSundial.js';
import { createInstrument } from '../src/scene/sundial/instrument.js';
import { createBowlInstrument } from '../src/scene/sundial/bowlInstrument.js';
import { disposeObject } from '../src/scene/sundial/instrumentCraft.js';
import { palette } from '../src/scene/sundial/sundialTheme.js';
import { dialLayout } from '../src/scene/sundial/dialEngraving.js';
import { createSolarShadowFilter } from '../src/scene/sundial/solarShadows.js';

const close = (a, b) => assert.ok(Math.abs(a-b) < 1e-5, `${a} should equal ${b}`);
const bounds = obj => new THREE.Box3().setFromObject(obj, true);
function models(compact=false) {
  const normal=new THREE.Texture();
  return [
    createInstrument(34.4,{front:{map:new THREE.Texture()},back:{map:new THREE.Texture()}},new THREE.Texture(),normal,compact),
    createBowlInstrument(34.4,new THREE.Texture(),new THREE.Texture(),normal,compact),
  ];
}

test('the three stone courses meet and both instruments use the same marble and bronze', () => {
  for(const instrument of models()) {
    instrument.group.updateMatrixWorld(true);
    for(const [name,bottom,top] of [['下枋',0,.04],['束腰',.04,.16],['上枋',.16,.20]]){
      const course=instrument.group.getObjectByName(name),box=bounds(course);
      close(box.min.y,bottom*R);close(box.max.y,top*R);
      for(const material of [].concat(course.material)){
        assert.equal(material.opacity,1);assert.equal(material.transparent,false);assert.equal(material.depthWrite,true);
      }
    }
    const cap=instrument.group.getObjectByName('上枋').material[0];
    assert.ok(cap.map);
    instrument.setDetail(0);assert.equal(cap.map,null);assert.equal(cap.transparent,false);
    instrument.setDetail(1);assert.ok(cap.map);
    const face=instrument.faceMaterials[0];
    assert.equal(face.color.getHexString(),palette.marble.slice(1).toLowerCase());
    close(face.roughness,instrument.kind==='plate' ? .6 : .69);
    const metal=instrument.group.getObjectByName(instrument.kind==='plate'?'盘缘':'碗唇').material;
    assert.equal(metal.color.getHexString(),palette.bronze.slice(1).toLowerCase());
    close(metal.metalness,.85);assert.ok(metal.roughness>=.32&&metal.roughness<=.45);
    disposeObject(instrument.group);
  }
});

test('the engraving leaves a clear reading field and follows the physical quarter hours on both faces',()=>{
  const {marks,rules,clearRadius,letterRadius,phoneLetterHeight}=dialLayout;
  assert.equal(marks.length,96);
  assert.equal(marks.filter(m=>m.letter).map(m=>m.letter).join(''),'子丑寅卯辰巳午未申酉戌亥');
  assert.equal(rules[0].r,clearRadius);
  const box=[letterRadius-phoneLetterHeight/2,letterRadius+phoneLetterHeight/2];
  for(const [i,m] of marks.entries()){
    close(m.angle,solarHourAngle(i/4));assert.ok(Math.abs(m.roll)<=90);
    for(const [start,end] of m.spans){
      assert.ok(start>=clearRadius&&end>start&&end<1);
      if(m.letter)assert.ok(end<box[0]||start>box[1]);
    }
  }
});

test('both quality tiers install the solar disk filter in the shipped Three.js shader',()=>{
  for(const compact of [false,true]){
    const material=new THREE.MeshStandardMaterial(),spread={value:.0045};
    createSolarShadowFilter(spread,compact)(material);
    const shader={uniforms:{},fragmentShader:'#include <shadowmap_pars_fragment>'};
    material.onBeforeCompile(shader);
    assert.equal(shader.uniforms.solarAngularSpread,spread);
    assert.match(shader.fragmentShader,/float penumbra/);
    assert.match(shader.fragmentShader,/vec2 solarDiskSample\(/);
    assert.doesNotMatch(shader.fragmentShader,/#include <shadowmap_pars_fragment>/);
  }
});

test('east and west trunnions terminate flush at the rim and inner ear faces', () => {
  const [plate,bowl]=models();const ears=[],pins=[];
  plate.group.updateMatrixWorld(true);
  plate.group.traverse(obj=>{if(obj.name==='如意耳座')ears.push(bounds(obj));if(obj.name==='短耳轴')pins.push(bounds(obj));});
  const rim=bounds(plate.group.getObjectByName('盘缘'));
  close(pins[0].max.x,rim.min.x);close(pins[0].min.x,ears[0].max.x);
  close(pins[1].min.x,rim.max.x);close(pins[1].max.x,ears[1].min.x);
  close(plate.length,.25*R);
  disposeObject(plate.group);disposeObject(bowl.group);
});

test('the open foot and outer shell meet on one ring outside the complete reading hemisphere', () => {
  const [plate,bowl]=models();
  bowl.group.updateMatrixWorld(true);
  const foot=bowl.group.getObjectByName('空心圈足'),shell=bowl.group.getObjectByName('漆铜外壁');
  const top=bounds(foot).max.y;
  close(top,bounds(shell).min.y);
  function joinRadii(obj) {
    const attr=obj.geometry.attributes.position,point=new THREE.Vector3(),radii=[];
    for(let i=0;i<attr.count;i++){
      point.fromBufferAttribute(attr,i).applyMatrix4(obj.matrixWorld);
      if(Math.abs(point.y-top)<1e-5)radii.push(Math.hypot(point.x,point.z));
    }
    return radii;
  }
  const outer=joinRadii(shell),base=joinRadii(foot);
  assert.ok(outer.length&&base.length);close(Math.min(...base),Math.max(...outer));
  assert.ok(Math.min(...base)>Math.sqrt(R*R-(bowl.dial.position.y-top)**2));
  const inside=bowl.group.getObjectByName('bowl-reading-surface').geometry.attributes;
  const v=new THREE.Vector3(),n=new THREE.Vector3();
  for(let i=0;i<inside.position.count;i+=23){
    v.fromBufferAttribute(inside.position,i);n.fromBufferAttribute(inside.normal,i);
    close(v.length(),1);close(v.dot(n),-1);assert.ok(v.y<1e-5);
  }
  disposeObject(plate.group);disposeObject(bowl.group);
});

test('at phone widths the reading surface survives the middle tier and cannot acquire close-up ornaments', () => {
  for(const compact of [false,true])for(const instrument of models(compact)) {
    const face=instrument.faceMaterials[0],map=face.map;
    instrument.setDetail(0);
    assert.equal(face.map,null);assert.equal(face.normalMap,null);
    instrument.setDetail(1);assert.equal(face.map,map);
    instrument.setDetail(2);assert.equal(Boolean(face.normalMap),!compact);close(face.normalScale.x,.12);
    const visible=[];instrument.group.traverseVisible(o=>visible.push(o.name));
    assert.equal(visible.filter(n=>n==='莲瓣').length,!compact&&instrument.kind==='plate'?12:0);
    assert.equal(visible.filter(n=>n==='窄回纹带').length,!compact&&instrument.kind==='bowl'?1:0);
    if(compact)assert.ok(!visible.includes('凹槽铜绿'));
    disposeObject(instrument.group);
  }
});

test('bowl shadow and engraved hour lines use the same sun vector on both hemispheres', () => {
  for(const latitude of [90,66.7,34.4,0,-33.87,-90]){
    assert.ok(bowlAnchor(latitude)[1]<=0);
    const {lines}=bowlEngravings(latitude);
    for(const line of lines)for(const arc of line.arcs)for(const point of arc){
      assert.ok(point[1]<=1e-8);close(Math.hypot(...point),1);
    }
    for(const delta of [-23.44,0,23.44]){
      const sun=solarVector(latitude,delta,-30);
      const shadow=bowlLocalPoint(sun);
      if(sun[1]<=0){assert.equal(shadow,null);continue;}
      close(Math.hypot(...shadow),R);
      shadow.forEach((v,i)=>close(v,-R*sun[i]));
      const hour=lines.find(l=>l.kind==='branch'&&l.hour===10);
      assert.ok(hour?.arcs.flat().some(p=>p.every((v,i)=>Math.abs(v-shadow[i]/R)<1e-5)));
    }
  }
  assert.equal(bowlLocalPoint([1,0,0]),null);
});
