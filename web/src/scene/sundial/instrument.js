import * as THREE from 'three';
import { DIAL_RADIUS, STYLE_LENGTH_RATIO } from '../../lib/astro/sundialGeometry.js';
import { dialQuaternion } from './dialOrientation.js';
import { buildPlinth, craft, lip, mesh, moulding as m, plinthHeight, ringTrim, scaledGroup, turn } from './instrumentCraft.js';
export { disposeObject } from './instrumentCraft.js';

const pivot=1.12, thickness=.08, face=thickness/2;
const earInner=1.04,earOuter=1.132;

// A single re-entrant shoulder makes the ruyi head legible in silhouette.
function earGeometry() {
  const s=new THREE.Shape();
  s.moveTo(-.282,.004);s.lineTo(.282,.004);s.lineTo(.282,.04);
  s.bezierCurveTo(.215,.14,.107,.41,.087,.69);
  s.quadraticCurveTo(.091,.91,.067,1.012);
  s.bezierCurveTo(.062,1.038,.14,1.041,.14,1.092);
  s.bezierCurveTo(.14,1.141,.082,1.161,.046,1.178);
  s.quadraticCurveTo(.018,1.191,0,1.222);
  s.quadraticCurveTo(-.018,1.191,-.046,1.178);
  s.bezierCurveTo(-.082,1.161,-.14,1.141,-.14,1.092);
  s.bezierCurveTo(-.14,1.041,-.062,1.038,-.067,1.012);
  s.quadraticCurveTo(-.091,.91,-.087,.69);
  s.bezierCurveTo(-.107,.41,-.215,.14,-.282,.04);s.closePath();
  const hole=new THREE.Path();hole.moveTo(-.178,.08);
  hole.quadraticCurveTo(-.082,.28,-.035,.57);hole.quadraticCurveTo(0,.75,.035,.57);
  hole.quadraticCurveTo(.082,.28,.178,.08);hole.closePath();s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s,{depth:earOuter-earInner-.008,bevelSize:.004,bevelThickness:.004,bevelSegments:3,curveSegments:24})
    .translate(0,0,-(earOuter-earInner-.008)/2).rotateY(Math.PI/2);
}

function supports(frame,kit) {
  const {bronze,dark,gold}=kit.materials;
  const ears=earGeometry(),shaft=new THREE.CylinderGeometry(.028,.028,earInner-1,40).rotateZ(Math.PI/2);
  for(const side of [-1,1]){
    mesh(frame,ears,bronze,'如意耳座').position.set(side*(earOuter+earInner)/2,plinthHeight,0);
    mesh(frame,shaft,dark,'短耳轴').position.set(side*(1+earInner)/2,plinthHeight+pivot,0);
    const boss=mesh(frame,turn([[0,0],[.074,0],[.079,.01],[.069,.02],[0,.02]],48).rotateZ(-side*Math.PI/2),gold,'轴盖');
    boss.position.set(side*earOuter,plinthHeight+pivot,0);
    const recess=mesh(frame,new THREE.CylinderGeometry(.034,.034,m.fine,40).rotateZ(Math.PI/2),bronze,'轴心');
    recess.position.set(side*(earOuter+m.bead+m.fine/2),plinthHeight+pivot,0);kit.mid.push(recess);
  }
}
function lotus(parent,kit,sign) {
  if(kit.compact)return;
  const s=new THREE.Shape();
  s.moveTo(0,.021);s.bezierCurveTo(-.023,.036,-.022,.055,0,.076);
  s.bezierCurveTo(.022,.055,.023,.036,0,.021);s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:.008,bevelThickness:.001,bevelSize:.001,bevelSegments:2,curveSegments:8});
  const flower=new THREE.Group();flower.position.z=sign*(face+.014);if(sign<0)flower.rotation.y=Math.PI;
  for(let i=0;i<6;i++)mesh(flower,g,kit.materials.gold,'莲瓣').rotation.z=i*Math.PI/3;
  parent.add(flower);kit.near.push(flower);
}

export function createInstrument(latitude,textures,baseMap,normal,compact=false) {
  const kit=craft(normal,compact),group=new THREE.Group(),dial=new THREE.Group();
  group.userData.ownedTextures=[normal,textures.front.map,textures.back.map];group.name='双面赤道式日晷';
  const frame=scaledGroup(group);
  buildPlinth(frame,kit,baseMap,2.53,1.38,.13);supports(frame,kit);
  dial.position.y=(plinthHeight+pivot)*DIAL_RADIUS;dial.quaternion.copy(dialQuaternion(latitude));group.add(dial);
  const body=scaledGroup(dial),inner=1-lip.width;
  const bronze=kit.materials.bronze;
  const rimMaterial=bronze.clone();
  mesh(body,turn([[inner,-face],[.982,-face],[1,-face+m.fine],[1,face-m.fine],[.982,face],[inner,face]])
    .rotateX(Math.PI/2),rimMaterial,'盘缘');
  const disk=new THREE.CircleGeometry(inner,160),uv=disk.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,.5+(uv.getX(i)-.5)*inner,.5+(uv.getY(i)-.5)*inner);
  const faceMaterials=[];
  for(const [name,sign] of [['front',1],['back',-1]]){
    const material=kit.marble(textures[name].map,sign>0?THREE.FrontSide:THREE.BackSide);
    material.userData.inkClearance=new THREE.Vector3();
    mesh(body,disk,material,name+'-dial-face').position.z=sign*face;faceMaterials.push(material);
    ringTrim(body,kit,inner,new THREE.Vector3(0,0,sign*(face+.0003)),sign>0?0:Math.PI,sign);
    const collar=turn([[0,0],[.077,0],[.077,.01],[.061,.02],[.022,.02],[0,.02]],64).rotateX(sign*Math.PI/2);
    mesh(body,collar,bronze,'莲座').position.z=sign*face;
    const needle=turn([[.022,.02],[.022,.04],[.017,.196],[.013,.238],[.008,.247],[0,STYLE_LENGTH_RATIO]],64).rotateX(sign*Math.PI/2);
    mesh(body,needle,bronze,name+'-style').position.z=sign*face;lotus(body,kit,sign);
  }
  kit.detail(compact?1:2);
  return {kind:'plate',group,dial,centerHeight:dial.position.y,faceMaterials,bodyMaterial:rimMaterial,
    thickness:thickness*DIAL_RADIUS,length:STYLE_LENGTH_RATIO*DIAL_RADIUS,baseHeight:plinthHeight*DIAL_RADIUS,
    setDetail:kit.detail};
}
