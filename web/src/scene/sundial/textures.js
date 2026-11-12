import * as THREE from 'three';
import { dialLocalPoint } from '../../lib/astro/sundialGeometry.js';
import { SUNDIAL_COLORS as C } from './sundialTheme.js';

const HOURS = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
function canvas(size) {
  const element = document.createElement('canvas');
  element.width = element.height = size;
  return [element, element.getContext('2d')];
}
function texture(element, renderer, color = false) {
  const result = new THREE.CanvasTexture(element);
  if (color) result.colorSpace = THREE.SRGBColorSpace;
  result.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return result;
}
function stroke(context, color, width) {
  context.strokeStyle = color;
  context.lineWidth = width;
  context.lineCap = 'round';
  context.stroke();
}

function lineAt(context, hour, from, to) {
  const a = dialLocalPoint(from * 1024, 15 * (hour - 12));
  const b = dialLocalPoint(to * 1024, 15 * (hour - 12));
  context.beginPath();
  context.moveTo(a[0], -a[1]);
  context.lineTo(b[0], -b[1]);
}

function ring(context, radius, ink, width) {
  context.beginPath();
  context.arc(0, 0, radius * 1024, 0, Math.PI * 2);
  stroke(context, ink, width);
}

function dialBand(context, inner, outer, fill) {
  context.beginPath();
  context.arc(0, 0, outer * 1024, 0, Math.PI * 2);
  context.arc(0, 0, inner * 1024, 0, Math.PI * 2, true);
  context.fillStyle = fill;
  context.fill('evenodd');
}

function mineralWash(context) {
  const gradient = context.createRadialGradient(-260, -310, 95, 0, 0, 1080);
  gradient.addColorStop(0, '#dad7b7');
  gradient.addColorStop(.68, '#cac5a3');
  gradient.addColorStop(1, '#afa283');
  context.fillStyle = gradient;
  context.fillRect(-1024, -1024, 2048, 2048);

  let seed = 29137;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  for (let i = 0; i < 28; i++) {
    const x = random() * 2000 - 1000, y = random() * 2000 - 1000, radius = 95 + random() * 260;
    const stain = context.createRadialGradient(x, y, 0, x, y, radius);
    stain.addColorStop(0, i % 2 ? '#f9ecc144' : '#59664a2a');
    stain.addColorStop(1, i % 2 ? '#f9ecc100' : '#68755b00');
    context.fillStyle = stain;
    context.fillRect(x - radius, y - radius, 2 * radius, 2 * radius);
  }
  for (let i = 0; i < 10000; i++) {
    context.fillStyle = i % 2 ? '#66634c25' : '#fffce545';
    context.fillRect(random() * 2048 - 1024, random() * 2048 - 1024, 1 + random() * 3, 1 + random() * 2);
  }
}

function dialGlyph(context, text, hour, radius, mirrored) {
  const [x, y] = dialLocalPoint(radius * 1024, 15 * (hour - 12));
  context.save();
  context.translate(x, -y);
  // The back is viewed through the same physical coordinates. Reverse only the writing.
  if (mirrored) context.scale(-1, 1);
  context.fillText(text, 0, 0);
  context.restore();
}

export function createDialTextures(renderer, compact) {
  const size = compact ? 1024 : 2048, result = {};
  for (const back of [false, true]) {
    const [colorCanvas, color] = canvas(size), [bumpCanvas, bump] = canvas(size);
    for (const context of [color, bump]) {
      context.translate(size / 2, size / 2);
      context.scale(size / 2048, size / 2048);
    }
    mineralWash(color);
    dialBand(color, .625, .838, '#9d8a5b25');
    dialBand(color, .838, .940, '#b7a57142');
    bump.fillStyle = '#808080';
    bump.fillRect(-1024, -1024, 2048, 2048);
    for (const [radius, width] of [[.12,3], [.619,5], [.633,2], [.829,2], [.841,5], [.936,5]]) {
      ring(color, radius + .002, '#f0e7c7b0', width + 2);
      ring(color, radius, '#64654e', width);
      ring(bump, radius, '#494949', width + 2);
    }
    for (let quarter = 0; quarter < 96; quarter++) {
      const hour = quarter / 4, major = quarter % 4 === 0, half = quarter % 2 === 0;
      const branchHour = quarter % 8 === 0;
      const start = branchHour ? .851 : major ? .867 : half ? .891 : .908;
      const noon = hour === 12;
      const tickWidth = branchHour ? 10 : major ? 7 : half ? 5 : 3.5;
      lineAt(color, hour, start, .927);
      stroke(color, '#ece1b880', tickWidth + 4);
      stroke(color, noon ? '#853f2d' : '#464d3b', tickWidth);
      lineAt(bump, hour, start, .927);
      stroke(bump, '#393939', tickWidth + 1);
      if (major) {
        const ink = branchHour ? '#686a53' : '#89886e';
        lineAt(color, hour, .128, .612);
        stroke(color, '#eee5c58c', branchHour ? 9 : 6);
        stroke(color, noon ? '#8a5438' : ink, branchHour ? 6 : 4);
        lineAt(bump, hour, .124, .615);
        stroke(bump, '#5d5d5d', branchHour ? 6 : 4);
      }
    }
    for (const context of [color, bump]) {
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = '600 128px "KaiTi", "STKaiti", "Songti SC", "Noto Serif CJK SC", "SimSun", serif';
    }
    bump.fillStyle = '#555555';
    for (let hour = 0; hour < 24; hour += 2) {
      color.fillStyle = hour === 12 ? '#7e3727' : '#222f26';
      dialGlyph(color, HOURS[hour / 2], hour, .732, back);
      dialGlyph(bump, HOURS[hour / 2], hour, .732, back);
    }
    result[back ? 'back' : 'front'] = { map:texture(colorCanvas, renderer, true), bump:texture(bumpCanvas, renderer) };
  }
  return result;
}

export function createBaseTexture(renderer) {
  const [element, context] = canvas(1024);
  context.translate(512, 512);
  context.strokeStyle = '#c3b18b'; context.lineWidth = 2.9;
  context.beginPath(); context.ellipse(0, 0, 315, 415, 0, 0, Math.PI * 2); context.stroke();
  context.strokeStyle = '#aa946d'; context.lineWidth = 1.7;
  context.beginPath(); context.ellipse(0, 0, 295, 388, 0, 0, Math.PI * 2); context.stroke();
  context.beginPath(); context.moveTo(0, -386); context.lineTo(0, 386); context.stroke();
  context.beginPath(); context.moveTo(-293, 0); context.lineTo(293, 0); context.stroke();
  for (let index = 0; index < 16; index++) {
    const angle = index * Math.PI / 8;
    const x = Math.sin(angle), y = Math.cos(angle);
    context.beginPath(); context.moveTo(x * 295, y * 388); context.lineTo(x * 315, y * 415); context.stroke();
  }
  context.fillStyle = '#ebd4a1';
  context.beginPath(); context.moveTo(0, -415); context.lineTo(11, -379); context.lineTo(0, -385); context.lineTo(-11, -379); context.fill();
  context.textAlign = 'center'; context.textBaseline = 'middle'; context.font = '600 46px "KaiTi", "SimSun", serif';
  for (const [text,x,y] of [['北',0,-448], ['南',0,445], ['东',357,0], ['西',-357,0]]) context.fillText(text,x,y);
  return texture(element, renderer, true);
}

export function createStoneNormal(renderer) {
  const [element, context] = canvas(128), image = context.createImageData(128, 128);
  for (let i = 0; i < image.data.length; i += 4) {
    const noise = Math.sin(i * 12.9898) * 43758.5453;
    image.data[i] = 128 + (noise - Math.floor(noise) - .5) * 14;
    image.data[i + 1] = 128 + (Math.sin(i * 4.1414) * .5) * 8;
    image.data[i + 2] = 252; image.data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  const result = texture(element, renderer);
  result.wrapS = result.wrapT = THREE.RepeatWrapping; result.repeat.set(3, 3);
  return result;
}

export function createMarkerTexture(kind = 'shadow') {
  const [element, context] = canvas(256), center = 128;
  if (kind === 'sun') {
    const aura = context.createRadialGradient(center, center, 32, center, center, 122);
    aura.addColorStop(0, '#ffc578ed');
    aura.addColorStop(.24, '#f5ab6090');
    aura.addColorStop(.55, '#f0a14f30');
    aura.addColorStop(1, '#f0a14f00');
    context.fillStyle = aura;
    context.fillRect(0, 0, 256, 256);
    const sphere = context.createRadialGradient(118, 114, 0, center, center, 46);
    sphere.addColorStop(0, '#fff9e2');
    sphere.addColorStop(.60, '#fff0b9');
    sphere.addColorStop(.89, '#ffd58b');
    sphere.addColorStop(1, '#f9a853');
    context.fillStyle = sphere;
    context.beginPath(); context.arc(center, center, 46, 0, Math.PI * 2); context.fill();
  } else {
    const glow = context.createRadialGradient(center, center, 64, center, center, 116);
    glow.addColorStop(0, '#241b154f');
    glow.addColorStop(1, '#241b1500');
    context.fillStyle = glow;
    context.fillRect(0, 0, 256, 256);
    context.fillStyle = C.cinnabar;
    context.strokeStyle = '#582f22';
    context.lineWidth = 8;
    context.beginPath(); context.arc(center, center, 67, 0, Math.PI * 2); context.fill(); context.stroke();
    context.strokeStyle = kind === 'secondary' ? C.sun : C.halo;
    context.lineWidth = 13;
    context.beginPath(); context.arc(center, center, 77, 0, Math.PI * 2); context.stroke();
  }
  const result = new THREE.CanvasTexture(element);
  result.colorSpace = THREE.SRGBColorSpace;
  return result;
}

export function createTextTexture(text, color = C.ink) {
  const [element, context] = canvas(256);
  context.fillStyle = '#f6f3eadd'; context.beginPath(); context.roundRect(8,70,240,116,18); context.fill();
  context.fillStyle = color; context.font = '600 54px "Microsoft YaHei", sans-serif';
  context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text,128,130);
  const result = new THREE.CanvasTexture(element); result.colorSpace = THREE.SRGBColorSpace;
  return result;
}
