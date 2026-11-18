import * as THREE from 'three';
import { DIAL_RADIUS } from '../../lib/astro/sundialGeometry.js';
import { bowlAnchor, bowlUV } from '../../lib/astro/bowlSundial.js';
import { buildPlinth, craft, lip, mesh, moulding as m, plinthHeight, ringTrim, scaledGroup, turn } from './instrumentCraft.js';
import { palette } from './sundialTheme.js';

const shellRadius=1.047, bowlHeight=1.26, footJoin=.35;
const wallAt=y=>Math.sqrt(shellRadius*shellRadius-y*y);

function innerBowl() {
  const g=new THREE.SphereGeometry(1,160,72,0,2*Math.PI,Math.PI/2,Math.PI/2);
  const {position,normal,uv}=g.attributes;
  for(let i=0;i<position.count;i++){
    const [u,v]=bowlUV([position.getX(i),position.getY(i),position.getZ(i)]);
    uv.setXY(i,u,1-v);normal.setXYZ(i,-normal.getX(i),-normal.getY(i),-normal.getZ(i));
  }
  for(let i=0;i<g.index.count;i+=3){
    const b=g.index.getX(i+1);g.index.setX(i+1,g.index.getX(i+2));g.index.setX(i+2,b);
  }
  return g;
}
function stringCourse(y) {
  const h=m.fine;
  return turn([[wallAt(y),y],[wallAt(y+h*.28)+.005,y+h*.28],
    [wallAt(y+h*.72)+.005,y+h*.72],[wallAt(y+h),y+h]]);
}

// One continuous narrow meander, conformed to the sphere; a single draw call.
function meander() {
  const xyz=[],indices=[],count=28,step=2*Math.PI/count,height=m.rail,base=-.23;
  const pattern=[[0,.13],[.24,.13],[.24,.84],[.72,.84],[.72,.39],[.49,.39],
    [.49,.14],[1,.14]];
  function vertex(u,v){const y=base+v*height,r=wallAt(y)+.0015;xyz.push(r*Math.sin(u),y,r*Math.cos(u));}
  for(let i=0;i<count;i++)for(let j=1;j<pattern.length;j++){
    const [u0,v0]=pattern[j-1],[u1,v1]=pattern[j];
    const horiz=v0===v1,du=horiz?0:.0022,dv=horiz?.0024/height:0,n=xyz.length/3;
    const extendU=horiz?Math.sign(u1-u0)*.0022:0,extendV=horiz?0:Math.sign(v1-v0)*.0024/height;
    const a=(i+u0)*step-extendU,b=(i+u1)*step+extendU;
    vertex(a-du,v0-extendV-dv);vertex(a+du,v0-extendV+dv);
    vertex(b+du,v1+extendV+dv);vertex(b-du,v1+extendV-dv);
    indices.push(n,n+1,n+2,n,n+2,n+3);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(xyz,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function shaft(parent,a,b,r0,r1,mat,name) {
  const dir=b.clone().sub(a),part=mesh(parent,new THREE.CylinderGeometry(r1,r0,dir.length(),48),mat,name);
  part.position.copy(a).lerp(b,.5);part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());
}
export function createBowlInstrument(latitude,bowlMap,baseMap,normal,compact=false) {
  const kit=craft(normal,compact),{bronze,gold,dark,lacquer}=kit.materials;
  const group=new THREE.Group(),dial=new THREE.Group();group.name='半球碗式日晷';group.userData.ownedTextures=[normal,bowlMap];
  const base=scaledGroup(group);buildPlinth(base,kit,baseMap,2.28,2.18,.40);
  const yJoin=footJoin-bowlHeight,rJoin=wallAt(yJoin);
  const foot=turn([[.44,0],[.566,0],[.578,.02],[.567,.04],[.49,.065],[.448,.10],
    [.405,.16],[.404,.21],[.428,.26],[rJoin-.014,footJoin-m.fine],[rJoin,footJoin]]);
  mesh(base,foot,lacquer,'空心圈足').position.y=plinthHeight;
  const topLine=mesh(base,turn([[rJoin-.014,footJoin-m.fine],[rJoin+.002,footJoin-.005],[rJoin,footJoin]]),bronze,'圈足上沿细线');
  topLine.position.y=plinthHeight;kit.mid.push(topLine);
  dial.position.y=(plinthHeight+bowlHeight)*DIAL_RADIUS;group.add(dial);
  const cup=scaledGroup(dial),profile=[],start=Math.acos(-yJoin/shellRadius);
  for(let i=0;i<=56;i++){const a=start+(Math.PI/2-start)*i/56;profile.push([shellRadius*Math.sin(a),-shellRadius*Math.cos(a)]);}
  mesh(cup,turn(profile),lacquer,'漆铜外壁');
  const inner=mesh(cup,innerBowl(),kit.marble(bowlMap,THREE.FrontSide),'bowl-reading-surface');
  for(const y of [-.108,-.264])kit.mid.push(mesh(cup,stringCourse(y),bronze,'弦纹'));
  if(!compact){
    const inlay=dark.clone();inlay.side=THREE.DoubleSide;inlay.roughness=.45;
    const fret=mesh(cup,meander(),inlay,'窄回纹带');fret.castShadow=false;kit.near.push(fret);
  }
  mesh(cup,turn([[shellRadius-.001,-m.bead],[1+lip.width+.013,-m.fine],[1+lip.width+.008,0],[1,0]]),bronze,'碗唇');
  ringTrim(cup,kit,1.004,new THREE.Vector3(0,.0004,0),-Math.PI/2);
  const north=new THREE.MeshStandardMaterial({color:palette.cinnabar,roughness:.68});
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2,g=new THREE.PlaneGeometry(i===0?.018:.009,.034);
    const notch=mesh(cup,g,i===0?north:dark,i===0?'北朱砂刻':'方位刻');
    notch.rotation.order='YXZ';notch.rotation.y=-a;notch.rotation.x=-Math.PI/2;
    notch.position.set(1.033*Math.sin(a),.00075,-1.033*Math.cos(a));notch.castShadow=false;
    kit.mid.push(notch);
  }
  const anchor=new THREE.Vector3(...bowlAnchor(latitude));
  const at=r=>anchor.clone().multiplyScalar(r);
  shaft(cup,at(1),at(.96),.054,.039,bronze,'支杆圆托');
  shaft(cup,at(.96),at(.92),.03,.014,gold,'圆托内肩');
  shaft(cup,at(.92),at(.023),.014,.008,bronze,'托珠细杆');
  mesh(cup,new THREE.SphereGeometry(.026,48,32),bronze,'球心铜珠');
  kit.detail(compact?1:2);
  return {kind:'bowl',group,dial,centerHeight:dial.position.y,faceMaterials:[inner.material],baseHeight:plinthHeight*DIAL_RADIUS,
    thickness:0,length:DIAL_RADIUS,setDetail:kit.detail};
}
