import { solarModel } from '../lib/astronomy.js';
import { normalize } from './angle.js';

const HOU_SPAN = 5;
export const WHEEL = Object.freeze({
  size:820, center:410, rim:398,
  termInner:350, termOuter:388, termLabel:369,
  seasonInner:331, seasonOuter:347,
  houInner:207, houOuter:328, houLabel:267.5,
  shadowInner:103, shadowOuter:199, shadowMaxChi:16, centerRadius:198,
});
export function polarPoint(radius, angle) {
  const radians=angle*Math.PI/180;
  return {x:WHEEL.center+radius*Math.sin(radians),y:WHEEL.center-radius*Math.cos(radians)};
}
export function annularPath(inner,outer,start,end) {
  const a=polarPoint(outer,start),b=polarPoint(outer,end),c=polarPoint(inner,end),d=polarPoint(inner,start);
  const large=end-start>180?1:0;
  return `M${a.x} ${a.y} A${outer} ${outer} 0 ${large} 1 ${b.x} ${b.y} L${c.x} ${c.y} A${inner} ${inner} 0 ${large} 0 ${d.x} ${d.y} Z`;
}
// 节气节点为扇区中心；三候在同一扇区内按-5、0、5度排布。
export function termRingLayout(index) {
  const angle=index*15;
  return {angle,start:angle-7.5,end:angle+7.5,label:polarPoint(WHEEL.termLabel,angle),
    path:annularPath(WHEEL.termInner,WHEEL.termOuter,angle-7.5+.12,angle+7.5-.12)};
}
export function houRingLayout(termIndex,order,name) {
  const angle=termIndex*15+(order-1)*HOU_SPAN;
  const start=angle-HOU_SPAN/2,end=angle+HOU_SPAN/2;
  return {angle,start,end,position:polarPoint(WHEEL.houLabel,angle),
    path:annularPath(WHEEL.houInner,WHEEL.houOuter,start+.08,end-.08),...houLetterLayout(name)};
}
export const nearestTermIndex=angle=>Math.round(normalize(angle)/15)%24;
// 0° 对准立春二候，所以从初候计数时偏移一格。
export const nearestHouOrder=angle=>(Math.round(normalize(angle)/HOU_SPAN)+1)%3;
export const seasonRingLayout=index=>({start:index*90-7.5,end:index*90+82.5,middle:index*90+37.5});
export function shadowRadius(chi) {
  return WHEEL.shadowInner+chi/WHEEL.shadowMaxChi*(WHEEL.shadowOuter-WHEEL.shadowInner);
}
// 固定线性零点与比例，不能按季节或当前值重新缩放。
export function shadowRingSamples() {
  return Array.from({length:72},(_,index)=>{
    const angle=index*5, model=solarModel(315+angle);
    return {index,angle,longitude:normalize(315+angle),shadowChi:model.shadowChi,
      radius:shadowRadius(model.shadowChi),major:index%3===0};
  });
}
export function houLetterLayout(name) {
  const letters=Array.from(name),long=letters.length>6;
  const pitch=long?14.8:18, fontSize=long?14.5:16.5;
  return {fontSize,letters:letters.map((letter,index)=>({letter,y:(index-(letters.length-1)/2)*pitch})),
    extent:(letters.length-1)*pitch+fontSize};
}
export function radialLabelAngle(angle,rotation) {
  const screenAngle=normalize(angle+rotation);
  return angle+(screenAngle>90&&screenAngle<270?180:0);
}
