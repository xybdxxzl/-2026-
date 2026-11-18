import * as THREE from 'three';
import { dialLocalPoint, solarHourAngle } from '../../lib/astro/sundialGeometry.js';
import { bowlEngravings, bowlUV } from '../../lib/astro/bowlSundial.js';
import { branches, inscriptionFont, palette as p } from './sundialTheme.js';
import { dialLayout } from './dialEngraving.js';

const widths = { branch:.009, hour:.0055, minor:.003 };

function canvas(size) {
  const el = document.createElement('canvas');
  el.width = el.height = size;
  return [el, el.getContext('2d')];
}
function texture(el, renderer, color=true) {
  const result = new THREE.CanvasTexture(el);
  if (color) result.colorSpace = THREE.SRGBColorSpace;
  result.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return result;
}

// Albedo maps multiply the material's marble pigment in linear light.
const marble = new THREE.Color(p.marble);
function marbleInk(pigment,ground=marble) {
  const c = new THREE.Color(pigment);
  return c.setRGB(c.r/ground.r,c.g/ground.g,c.b/ground.b).getStyle();
}
function sheet(size) {
  const [el,ctx] = canvas(size);
  ctx.fillStyle=marbleInk(p.marble); ctx.fillRect(0,0,size,size);
  ctx.translate(size/2,size/2);ctx.scale(size/2,size/2);
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineCap='round';ctx.lineJoin='round';
  return [el,ctx];
}
function path(ctx,points,type,color,compact) {
  if (points.length<2) return;
  ctx.strokeStyle=marbleInk(color);
  ctx.lineWidth=widths[type]*(compact?1.20:1);
  ctx.beginPath();ctx.moveTo(...points[0]);
  for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);
  ctx.stroke();
}
function label(ctx,h,point,height,back=false,roll=0) {
  ctx.save();ctx.translate(...point);
  ctx.rotate(roll*Math.PI/180);
  if(back)ctx.scale(-1,1);
  // Set font in pixel space; sub-pixel CSS font sizes are rounded by some canvas engines.
  ctx.scale(.001,.001);
  ctx.font='600 '+Math.round(height*1000)+'px '+inscriptionFont;
  ctx.lineWidth=9;ctx.strokeStyle=marbleInk(p.marble);ctx.strokeText(branches[h/2],0,0);
  ctx.fillStyle=marbleInk(h===12?p.cinnabar:p.ink);ctx.fillText(branches[h/2],0,0);ctx.restore();
}
const dialXY=(r,h)=>{const [x,y]=dialLocalPoint(r,solarHourAngle(h));return [x,-y];};

export function createDialTextures(renderer,compact) {
  const faces={};
  for(const name of ['front','back']) {
    const [el,ctx]=sheet(compact?1024:2048);
    ctx.lineCap='butt';
    for(const {r,width} of dialLayout.rules){
      ctx.lineWidth=width*(compact?1.25:1);ctx.strokeStyle=marbleInk(p.lightInk);
      ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();
    }
    for(const mark of dialLayout.marks){
      ctx.lineWidth=mark.width*(compact?1.22:1);
      ctx.strokeStyle=marbleInk(mark.hour===12?p.cinnabar:mark.major?p.ink:p.lightInk);
      for(const [start,end] of mark.spans){
        ctx.beginPath();ctx.moveTo(...dialXY(start,mark.hour));ctx.lineTo(...dialXY(end,mark.hour));ctx.stroke();
      }
      if(mark.letter)label(ctx,mark.hour,dialXY(dialLayout.letterRadius,mark.hour),
        compact?dialLayout.phoneLetterHeight:dialLayout.letterHeight,name==='back',mark.roll);
    }
    faces[name]={map:texture(el,renderer)};
  }
  return faces;
}

export function createBowlTexture(renderer,latitude,compact) {
  const [el,ctx]=sheet(compact?1024:2048);
  const {lines,letters}=bowlEngravings(latitude);
  const xy=point=>bowlUV(point).map(x=>2*x-1);
  for(const {kind,hour,arcs} of lines) {
    const type=kind==='branch'?'branch':kind==='minor'||kind==='winter'?'minor':'hour';
    const color=kind==='winter'?p.winter:kind==='summer'||hour===12?p.cinnabar:
      kind==='branch'?p.ink:p.lightInk;
    for(const arc of arcs)path(ctx,arc.map(xy),type,color,compact);
  }
  for(const {hour,point} of letters)label(ctx,hour,xy(point),compact?.139:.108);
  return texture(el,renderer);
}

export function createBaseTexture(renderer) {
  const [el,ctx]=canvas(1024);
  const stone=new THREE.Color(p.stone),ink=marbleInk(p.stoneLine,stone);
  ctx.fillStyle=marbleInk(p.stone,stone);ctx.fillRect(0,0,1024,1024);
  ctx.translate(512,512);
  ctx.strokeStyle=ink;ctx.lineWidth=3;ctx.beginPath();
  ctx.moveTo(0,-424);ctx.lineTo(0,424);ctx.stroke();
  ctx.font='600 45px '+inscriptionFont;ctx.fillStyle=ink;
  ctx.textAlign='center';ctx.textBaseline='middle';
  for(const [s,x,y] of [['北',0,-459],['南',0,459],['東',460,0],['西',-460,0]])ctx.fillText(s,x,y);
  return texture(el,renderer);
}

// Tangent-space data, independent of albedo. The long, sparse veins have continuous derivatives.
export function createStoneNormal(renderer) {
  const size=256,[el,ctx]=canvas(size),data=ctx.createImageData(size,size);
  const tau=2*Math.PI;
  const height=(x,y)=>Math.sin(tau*(3*x+2*y)+.65*Math.sin(tau*2*y))*.48
    +Math.sin(tau*(7*x-3*y)+.8*Math.sin(tau*x))*.12;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size,i=4*(y*size+x);
    data.data[i]=128+(height(u-1/size,v)-height(u+1/size,v))*175;
    data.data[i+1]=128+(height(u,v-1/size)-height(u,v+1/size))*175;
    data.data[i+2]=254;data.data[i+3]=255;
  }
  ctx.putImageData(data,0,0);
  const result=texture(el,renderer,false);result.wrapS=result.wrapT=THREE.RepeatWrapping;
  return result;
}

export function createMarkerTexture(kind='shadow') {
  const [el,c]=canvas(192),r=96;
  if(kind==='sun'){
    const g=c.createRadialGradient(r,r,14,r,r,92);
    g.addColorStop(0,p.sky);g.addColorStop(.28,p.gold);g.addColorStop(1,p.gold+'00');
    c.fillStyle=g;c.fillRect(0,0,192,192);
  }else{
    c.lineWidth=11;c.strokeStyle=kind==='secondary'?p.bronze:p.cinnabar;
    c.beginPath();c.arc(r,r,53,0,2*Math.PI);c.stroke();
    c.lineWidth=4;c.strokeStyle=p.paper;c.beginPath();c.arc(r,r,61,0,2*Math.PI);c.stroke();
  }
  const t=new THREE.CanvasTexture(el);t.colorSpace=THREE.SRGBColorSpace;return t;
}
export function createTextTexture(text,color=p.ink) {
  const [el,c]=canvas(256);
  c.fillStyle=p.paper+'ed';c.beginPath();c.roundRect(8,70,240,116,18);c.fill();
  c.fillStyle=color;c.font='600 54px "Microsoft YaHei",sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,128,130);
  const t=new THREE.CanvasTexture(el);t.colorSpace=THREE.SRGBColorSpace;return t;
}
