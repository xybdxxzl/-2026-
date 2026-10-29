import { normalize } from './angle.js';

const anchors = [
  ['#e6efdd','#cfe0c8'],['#dcebe0','#bbd8c9'],['#e4ebcb','#c9ddb0'],['#f6e7b8','#e7c58b'],
  ['#f0deb5','#d8b27c'],['#ebd3a8','#c99a64'],['#dce0e2','#b8c2c8'],['#e8ebee','#c5ced6'],
];
// 艺术化季相强度，不是历史气象记录或天气预报。
const weather = [
  [0,0,.15,0,0],[.55,0,0,0,0],[.35,0,0,0,.7],[.1,0,0,0,0],[.4,0,0,0,0],[.6,0,0,0,0],
  [0,0,0,0,0],[.2,0,0,0,0],[.5,0,.2,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],
  [0,0,0,.2,0],[0,0,0,.1,0],[0,0,.45,0,0],[0,0,0,.45,0],[0,0,.3,.3,0],[0,0,.2,.35,0],
  [0,0,0,0,0],[0,.4,0,0,0],[0,.85,0,0,0],[0,.3,0,0,0],[0,.2,0,0,0],[0,.45,0,0,0],
];
const mix = (a, b, t) => a + (b - a) * t;
function mixColor(a, b, t) {
  const rgb = value => [1,3,5].map(i => parseInt(value.slice(i,i+2),16));
  return `rgb(${rgb(a).map((channel,i) => Math.round(mix(channel,rgb(b)[i],t))).join(' ')})`;
}
export function seasonAt(angle) {
  const value = normalize(angle), segment = value / 45, index = Math.floor(segment), t = segment - index;
  const wi = Math.floor(value / 15), wt = value / 15 - wi;
  const weights = weather[wi].map((a,i) => mix(a, weather[(wi+1)%24][i], wt));
  const warmth = (Math.cos((value-135)*Math.PI/180)+1)/2;
  return { top: mixColor(anchors[index][0],anchors[(index+1)%8][0],t), bottom: mixColor(anchors[index][1],anchors[(index+1)%8][1],t),
    light: mixColor('#dce8f5','#fff1c9',warmth), strength: mix(.45,1,warmth),
    rain: weights[0], snow: weights[1], fog: weights[2], leaf: weights[3], thunder: weights[4] };
}
