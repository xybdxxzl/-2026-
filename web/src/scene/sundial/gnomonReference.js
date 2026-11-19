import * as THREE from 'three';
import { DEMO_MODEL, formatShadow } from '../../lib/astronomy.js';
import { REFERENCE_COLORS as R, SUNDIAL_COLORS as C, SUNDIAL_SOLSTICES } from './sundialTheme.js';

const UNIT = .9;
const HEIGHT = DEMO_MODEL.heightChi * UNIT;
const RULE_LENGTH = 15 * UNIT;
const FOOT = Object.freeze(new THREE.Vector3(8.25, 0, 4.9));
const TOP = Object.freeze(new THREE.Vector3(FOOT.x, HEIGHT, FOOT.z));
const RIBBON_Y = .11;
const RULE_MARGIN = .22;
const FONT = '"Microsoft YaHei", "PingFang SC", sans-serif';

function groundMesh(geometry, material, x, y, z) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  return mesh;
}

function addStone(group, geometry, material, y, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, y, z);
  mesh.receiveShadow = true;
  group.add(mesh);
}

function stoneCylinder(top, bottom, height) {
  return new THREE.CylinderGeometry(top, bottom, height, 4).rotateY(Math.PI / 4);
}

function buildPost(group) {
  const stone = new THREE.MeshStandardMaterial({ color:R.post, roughness:.84 });
  const base = new THREE.MeshStandardMaterial({ color:R.base, roughness:.88 });
  const cap = new THREE.MeshStandardMaterial({ color:R.cap, roughness:.72 });
  addStone(group, stoneCylinder(.76, .82, .16), base, .08);
  addStone(group, stoneCylinder(.58, .67, .17), cap, .245);
  addStone(group, stoneCylinder(.37, .53, HEIGHT - .51), stone, (HEIGHT - .51) / 2 + .33);
  addStone(group, stoneCylinder(.24, .39, .18), cap, HEIGHT - .09);
}

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { context:canvas.getContext('2d'), texture };
}

function buildRule(group) {
  const span = RULE_LENGTH + RULE_MARGIN * 2;
  const rule = new THREE.MeshStandardMaterial({ color:R.rule, roughness:.82 });
  addStone(group, new THREE.BoxGeometry(1.16,.086,span), rule, .043, -RULE_LENGTH / 2);
  const { context, texture } = makeCanvas(256, 2048);
  const margin = RULE_MARGIN / span * 2048;
  context.strokeStyle = C.bronze;
  context.lineWidth = 3.5;
  context.beginPath();
  for (const x of [14, 242]) {
    context.moveTo(x, margin);
    context.lineTo(x, 2048 - margin);
  }
  context.stroke();
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '600 53px Georgia, serif';
  for (let chi = 1; chi <= 15; chi++) {
    const y = margin + (2048 - 2 * margin) * (1 - chi / 15);
    const major = chi % 5 === 0;
    context.strokeStyle = major ? C.ray : C.dialHighlight;
    context.lineWidth = major ? 9 : 5.5;
    context.beginPath();
    context.moveTo(major ? 94 : 161, y);
    context.lineTo(224, y);
    context.stroke();
    if (major) {
      context.fillStyle = C.ray;
      context.fillText(String(chi), 56, y + 1);
    }
  }
  const marks = new THREE.MeshStandardMaterial({
    map:texture, transparent:true, depthWrite:false, roughness:.9,
  });
  const overlay = groundMesh(new THREE.PlaneGeometry(1.16,span), marks, 0,.088,-RULE_LENGTH / 2);
  overlay.receiveShadow = true;
  overlay.renderOrder = 2;
  group.add(overlay);
}

function textSprite(width, height, worldWidth, worldHeight) {
  const { context, texture } = makeCanvas(width, height);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map:texture, transparent:true, depthWrite:false, toneMapped:false,
  }));
  sprite.scale.set(worldWidth, worldHeight, 1);
  return { context, texture, sprite };
}

function buildCompass(group) {
  const material = new THREE.MeshBasicMaterial({
    color:C.dialHighlight, transparent:true, opacity:.46, depthWrite:false, toneMapped:false,
  });
  group.add(
    groundMesh(new THREE.PlaneGeometry(3.42,.032), material, 0,.023,0),
    groundMesh(new THREE.PlaneGeometry(.032,1.32), material, 0,.023,.66),
    groundMesh(new THREE.PlaneGeometry(.032,.59), material, 0,.023,-RULE_LENGTH-.445),
  );
  for (const [text, x, z] of [['北',0,-RULE_LENGTH-.98], ['南',0,1.63], ['东',1.99,0], ['西',-1.99,0]]) {
    const { context, sprite } = textSprite(128, 128, .70, .70);
    context.font = '600 74px "KaiTi", "SimSun", serif';
    context.fillStyle = C.dialHighlight;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 64, 66);
    sprite.position.set(x,.27,z);
    group.add(sprite);
  }
}

function buildShadow(group, color) {
  const root = new THREE.Group();
  const ribbon = groundMesh(new THREE.PlaneGeometry(1,1), new THREE.MeshBasicMaterial({
    color, transparent:true, opacity:.76, depthWrite:false, toneMapped:false,
  }), 0,RIBBON_Y,0);
  const mark = new THREE.MeshBasicMaterial({ color, toneMapped:false, transparent:true, depthWrite:false });
  const tip = groundMesh(new THREE.RingGeometry(.12,.195,32), mark, 0,RIBBON_Y+.005,0);
  const center = groundMesh(new THREE.CircleGeometry(.069,20), mark, 0,RIBBON_Y+.005,0);
  const arrow = groundMesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([
    0,.19,0, -.16,-.12,0, .16,-.12,0,
  ],3)), mark, 0,RIBBON_Y+.005,0);
  const label = textSprite(512, 104, 3.4, .69);
  label.sprite.renderOrder = 6;
  ribbon.renderOrder = 4;
  tip.renderOrder = center.renderOrder = arrow.renderOrder = 5;
  root.add(ribbon, tip, center, arrow, label.sprite);
  group.add(root);
  return { root, ribbon, tip, center, arrow, label, color, text:'' };
}

export function projectGnomonShadow(eastChi, northChi) {
  const east = eastChi * UNIT;
  const south = -northChi * UNIT;
  const xLimit = east < 0 ? -14.6 : 5.9;
  const zLimit = south < 0 ? -15.35 : 3.3;
  const fraction = Math.min(1, east ? xLimit / east : 1, south ? zLimit / south : 1);
  return { east, south, fraction };
}

function updateShadow(shadow, entry, index) {
  const { root, ribbon, tip, center, arrow, label } = shadow;
  const valid = entry && [entry.eastChi, entry.northChi, entry.lengthChi].every(Number.isFinite);
  root.visible = Boolean(valid);
  if (!valid) return;

  const { east, south, fraction } = projectGnomonShadow(entry.eastChi, entry.northChi);
  const x = east * fraction, z = south * fraction;
  const distance = Math.hypot(x, z);
  const angle = Math.atan2(x, -z);
  const y = RIBBON_Y + index * .008;
  const color = SUNDIAL_SOLSTICES[entry.id]?.color ?? shadow.color;
  const active = entry.active !== false;
  ribbon.material.color.set(color);
  ribbon.material.opacity = active ? .92 : .66;
  tip.material.color.set(color);
  tip.material.opacity = active ? 1 : .83;
  label.sprite.material.opacity = active ? 1 : .88;
  ribbon.visible = distance > .015;
  ribbon.position.set(x/2,y,z/2);
  ribbon.rotation.z = -angle;
  // At true noon both shadows may coincide. The winter ribbon remains visible around the summer ribbon.
  ribbon.scale.set(entry.id === 'dongzhi' ? .24 : .14,distance,1);
  ribbon.renderOrder = entry.id === 'xiazhi' ? 5 : 4;
  tip.visible = center.visible = fraction === 1;
  arrow.visible = fraction < 1;
  arrow.rotation.z = -angle;
  for (const mesh of [tip, center, arrow]) {
    mesh.position.set(x,y+.005,z);
    mesh.renderOrder = 6;
  }

  label.sprite.visible = !SUNDIAL_SOLSTICES[entry.id];
  if (!label.sprite.visible) return;
  const text = formatShadow(entry.lengthChi);
  label.sprite.position.set(distance > .65 ? x : x + 1, .62 + index * .28, z);
  const key = `${color}|${text}`;
  if (key !== shadow.text) {
    shadow.text = key;
    const { context, texture } = label;
    context.clearRect(0,0,512,104);
    context.font = `600 47px ${FONT}`;
    const width = Math.min(context.measureText(text).width + 50, 510);
    const left = (512 - width) / 2;
    context.fillStyle = C.stage+'f5';
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(left,12,width,80,11);
    context.fill();
    context.stroke();
    context.fillStyle = C.paper;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text,256,54,460);
    texture.needsUpdate = true;
  }
}

export function createGnomonReference() {
  const group = new THREE.Group();
  group.position.copy(FOOT);
  buildPost(group);
  buildRule(group);
  buildCompass(group);
  const overlays = [buildShadow(group, C.muted), buildShadow(group, SUNDIAL_SOLSTICES.dongzhi.color)];
  const fitPoints = [
    [-.46,HEIGHT,0], [.46,HEIGHT,0], [-2.35,0,0], [2.35,0,0],
    [0,0,1.95], [-.6,0,-RULE_LENGTH-1.28], [.6,0,-RULE_LENGTH-1.28],
  ].map(point => new THREE.Vector3(...point).add(FOOT));

  function update({ visible, shadows = [] }) {
    group.visible = Boolean(visible);
    for (const [index, overlay] of overlays.entries()) updateShadow(overlay, shadows[index], index);
  }

  update({ visible:false });
  return { group, fitPoints, update, foot:FOOT, top:TOP, unitsPerChi:UNIT };
}
