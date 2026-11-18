import * as THREE from 'three';
import { DIAL_RADIUS } from '../../lib/astro/sundialGeometry.js';
import { palette as p } from './sundialTheme.js';

export const moulding = Object.freeze({ fine:.01, bead:.02, rail:.04 });
const waistHeight=3*moulding.rail;
export const plinthHeight = 2*moulding.rail+waistHeight;
export const lip = Object.freeze({ width:.048, line:.007 });
const bevel=.004;

export function mesh(parent,geometry,material,name) {
  const item=new THREE.Mesh(geometry,material);
  if(name)item.name=name;
  item.castShadow=item.receiveShadow=true;parent.add(item);return item;
}
export function turn(profile,segments=128) {
  return new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),segments);
}
export function scaledGroup(parent) {
  const group=new THREE.Group();group.scale.setScalar(DIAL_RADIUS);parent.add(group);return group;
}
function metal(color,roughness,role) {
  const m=new THREE.MeshStandardMaterial({color,metalness:.85,roughness});
  m.name=role;return m;
}
export function craft(normal,compact=false) {
  const mid=[],near=[],stoneMaterials=[],engravedSurfaces=new Map();
  const materials={
    bronze:metal(p.bronze,.39,'古铜'),gold:metal(p.gold,.34,'磨亮铜边'),
    dark:metal(p.bronzeDark,.44,'铜件阴口'),
    lacquer:new THREE.MeshPhysicalMaterial({name:'深褐漆铜',color:p.lacquer,metalness:.38,roughness:.46,clearcoat:.18,clearcoatRoughness:.41}),
    patina:metal(p.patina,.45,'接缝铜绿'),
    stone:new THREE.MeshStandardMaterial({color:p.stone,roughness:.82,transparent:false,opacity:1,depthWrite:true}),
  };
  materials.stone.name='暖灰石';
  for(const [key,material] of Object.entries(materials))material.userData.finish=key;
  function marble(map,side) {
    const material=new THREE.MeshStandardMaterial({color:p.marble,map,roughness:.6,metalness:0,side});
    material.name='汉白玉';material.userData.finish='marble';stoneMaterials.push(material);engravedSurfaces.set(material,map);return material;
  }
  function engravedStone(map) {
    const material=materials.stone.clone();
    material.map=map;
    stoneMaterials.push(material);engravedSurfaces.set(material,map);
    return material;
  }
  stoneMaterials.push(materials.stone);
  let level=-1;
  function detail(request) {
    const next=Math.min(request,compact?1:2);
    if(level===next)return false;
    level=next;
    mid.forEach(o=>o.visible=next>=1);near.forEach(o=>o.visible=next>=2);
    for(const [surface,engraving] of engravedSurfaces){
      const map=next>=1?engraving:null;
      if(surface.map!==map){surface.map=map;surface.needsUpdate=true;}
    }
    stoneMaterials.forEach(m=>{
      const map=next===2?normal:null;
      if(m.normalMap!==map){m.normalMap=map;m.needsUpdate=true;}
      m.normalScale.setScalar(.12);
    });
    return true;
  }
  return {materials,marble,engravedStone,mid,near,detail,compact};
}

function stoneCourse(w,d,h,corner) {
  const x=w/2-bevel,z=d/2-bevel,shape=new THREE.Shape();
  const pts=[[-x+corner,-z],[x-corner,-z],[x,-z+corner],[x,z-corner],[x-corner,z],[-x+corner,z],[-x,z-corner],[-x,-z+corner]];
  pts.forEach(([a,b],i)=>i?shape.lineTo(a,b):shape.moveTo(a,b));shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:h-2*bevel,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:3});
  return g.translate(0,0,bevel).rotateX(-Math.PI/2);
}
export function buildPlinth(parent,kit,baseMap,w,d,corner) {
  const h=moulding.rail;
  parent.userData.ownedTextures=[baseMap];
  for(const [bottom,height,cut,name] of [[0,h,0,'下枋'],[h,waistHeight,.065,'束腰'],[h+waistHeight,h,.027,'上枋']]){
    const geometry=stoneCourse(w-cut,d-cut,height,corner);
    let material=kit.materials.stone;
    if(name==='上枋'){
      // The marks are pigment on the solid cap. Cap and bevel share the same depth surface.
      const {position,uv}=geometry.attributes;
      for(const cap of geometry.groups.filter(g=>g.materialIndex===0)){
        for(let i=cap.start;i<cap.start+cap.count;i++){
          const v=geometry.index?geometry.index.getX(i):i;
          uv.setXY(v,.5+position.getX(v)/(w-cut),.5-position.getZ(v)/(d-cut));
        }
      }
      material=[kit.engravedStone(baseMap),material];
    }
    mesh(parent,geometry,material,name).position.y=bottom;
  }
}

// Both rims use a broad bronze surface and one recessed line along its inner edge.
export function ringTrim(parent,kit,r,level,rotation=0,sign=1) {
  const groove=mesh(parent,new THREE.RingGeometry(r,r+lip.line,128),kit.materials.dark,'内缘细线');
  groove.rotation.x=rotation;groove.position.copy(level);groove.material.side=THREE.DoubleSide;
  kit.mid.push(groove);
  if(kit.compact)return;
  const horizontal=Math.abs(Math.sin(rotation))>.5;
  for(const angle of [.35,3.85]){
    const spot=mesh(parent,new THREE.RingGeometry(r+.001,r+.004,16,1,angle,.19),kit.materials.patina,'凹槽铜绿');
    spot.rotation.x=rotation;spot.position.copy(level);
    if(horizontal)spot.position.y+=.0002;
    else spot.position.z+=sign*.0002;
    spot.castShadow=false;kit.near.push(spot);
  }
}

export function disposeObject(object) {
  const geometries=new Set(),materials=new Set(),textures=new Set();
  object.traverse(item=>{
    if(item.geometry)geometries.add(item.geometry);
    for(const t of item.userData.ownedTextures??[])if(t)textures.add(t);
    for(const mat of item.material?(Array.isArray(item.material)?item.material:[item.material]):[]){
      materials.add(mat);for(const value of Object.values(mat))if(value?.isTexture)textures.add(value);
    }
  });
  // The normal map may be detached while a model is in its distance or phone tier.
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
}
