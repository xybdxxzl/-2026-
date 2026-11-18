import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { TERMS } from '../../data/terms.js';
import {
  eclipticVector, equatorialToLocalAxes, equatorialVector, localSiderealAngle, starVisibility,
} from '../../lib/astro/celestial.js';
import { polarBasis } from '../../lib/astro/sundialGeometry.js';
import { CELESTIAL_COLORS as C, SUNDIAL_COLORS } from './sundialTheme.js';
import { disposeObject } from './instrument.js';

const TURN = Math.PI * 2;
const CIRCLE_STEPS = 144;
const DIPPER = [54061,53910,58001,59774,54061,null,59774,62956,65378,67301];

function circle(pointAt) {
  const data = [];
  let previous = pointAt(0);
  for (let step = 1; step <= CIRCLE_STEPS; step++) {
    const point = pointAt(step / CIRCLE_STEPS * TURN);
    data.push(...previous, ...point);
    previous = point;
  }
  return data;
}

function line(data, color, opacity, width, dashed = false) {
  const geometry = new LineSegmentsGeometry().setPositions(data);
  const material = new LineMaterial({
    color, opacity, linewidth:width, transparent:true, depthWrite:false, toneMapped:false,
    dashed, dashSize:.27, gapSize:.16,
  });
  const mesh = new LineSegments2(geometry, material);
  if (dashed) mesh.computeLineDistances();
  return mesh;
}

function label(width, height, worldWidth, worldHeight, ink, bordered = false) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map:texture, transparent:true, depthWrite:false, toneMapped:false,
  }));
  sprite.scale.set(worldWidth,worldHeight,1);
  sprite.renderOrder = 14;
  let last = '';
  return {
    sprite,
    setText(text) {
      if (last === text) return;
      last = text;
      context.clearRect(0,0,width,height);
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = '600 52px "Microsoft YaHei", "PingFang SC", sans-serif';
      if (bordered) {
        const frameWidth = Math.min(width-8,context.measureText(text).width+44);
        context.beginPath();
        context.roundRect((width-frameWidth)/2,8,frameWidth,height-16,10);
        context.fillStyle = SUNDIAL_COLORS.stage+'f4';
        context.strokeStyle = ink;
        context.lineWidth = 2;
        context.fill();
        context.stroke();
      }
      context.fillStyle = ink;
      context.fillText(text,width/2,height/2+1,width-30);
      texture.needsUpdate = true;
    },
  };
}

function buildHorizon(group, radius) {
  const gridData = [];
  for (const latitude of [-60,-30,30,60]) {
    const tilt = latitude * Math.PI / 180;
    const parallel = radius * Math.cos(tilt), y = radius * Math.sin(tilt);
    gridData.push(...circle(angle => [Math.cos(angle)*parallel,y,Math.sin(angle)*parallel]));
  }
  for (let index = 0; index < 4; index++) {
    const azimuth = index * Math.PI / 4;
    const x = radius*Math.sin(azimuth), z = -radius*Math.cos(azimuth);
    gridData.push(...circle(angle => [x*Math.cos(angle),radius*Math.sin(angle),z*Math.cos(angle)]));
  }
  const grid = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(gridData,3)),
    new THREE.LineBasicMaterial({ color:C.grid, transparent:true, opacity:.19, depthWrite:false, toneMapped:false }),
  );
  const horizon = line(circle(angle => [radius*Math.sin(angle),0,-radius*Math.cos(angle)]),C.horizon,.66,1.55);
  group.add(grid,horizon);
  const cardinal = [
    ['北',0,0,-1],['东',1,0,0],['南',0,0,1],['西',-1,0,0],
  ];
  for (const [name,x,y,z] of cardinal) {
    const marker = label(116,92,1.05,.83,C.horizon,true);
    marker.setText(name);
    marker.sprite.position.set(x,y,z).multiplyScalar(radius + .66);
    group.add(marker.sprite);
  }
}

function buildEquator(group, radius) {
  const equator = circle(angle => [radius*Math.cos(angle),radius*Math.sin(angle),0]);
  const ecliptic = circle(angle => eclipticVector(angle / TURN * 360).map(value => value * radius));
  group.add(line(equator,C.equator,.67,1.48),line(ecliptic,C.ecliptic,.87,1.7));
  const normal = new THREE.Vector3(...eclipticVector(0)).cross(new THREE.Vector3(...eclipticVector(90))).normalize();
  const ticks = TERMS.map(term => ({ term, vector:new THREE.Vector3(...eclipticVector(term.longitude)) }));
  const data = { major:[], minor:[] };
  for (const { term, vector } of ticks) {
    const major = term.longitude % 90 === 0;
    const half = major ? .030 : .018;
    const center = vector.clone().multiplyScalar(radius * Math.cos(half));
    const tangent = radius * Math.sin(half);
    data[major?'major':'minor'].push(
      ...center.clone().addScaledVector(normal,-tangent).toArray(),
      ...center.clone().addScaledVector(normal,tangent).toArray(),
    );
  }
  group.add(line(data.minor,C.ecliptic,.68,1.15),line(data.major,C.ecliptic,.93,1.7));
  const highlight = new THREE.Mesh(new THREE.SphereGeometry(.105,12,8),new THREE.MeshBasicMaterial({
    color:C.ecliptic, toneMapped:false, depthWrite:false,
  }));
  const selected = label(336,92,3.04,.83,C.ecliptic,true);
  highlight.visible = selected.sprite.visible = false;
  group.add(highlight,selected.sprite);
  return { normal, ticks, highlight, selected };
}

function buildStars(group, radius, starData) {
  const byHip = new Map();
  const positions = [], sizes = [], luminance = [];
  for (const row of starData?.stars ?? []) {
    const [hip,ra,dec,magnitude] = row;
    if (![hip,ra,dec,magnitude].every(Number.isFinite)) continue;
    const vector = equatorialVector(ra * 15,dec).map(value => value * radius * .997);
    byHip.set(hip,vector);
    positions.push(...vector);
    sizes.push(2.2 + 3.6 * Math.exp(-Math.max(0,magnitude+1.5)*.59));
    luminance.push(THREE.MathUtils.clamp(1.04 - .13 * magnitude,.27,1));
  }
  const fade = { value:0 };
  const pixelRatio = { value:1 };
  const geometry = new THREE.BufferGeometry()
    .setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
    .setAttribute('starSize',new THREE.Float32BufferAttribute(sizes,1))
    .setAttribute('starLight',new THREE.Float32BufferAttribute(luminance,1));
  const points = new THREE.Points(geometry,new THREE.ShaderMaterial({
    uniforms:{ fade, pixelRatio, tint:{ value:new THREE.Color(C.stars) } },
    transparent:true,
    depthWrite:false,
    toneMapped:false,
    vertexShader:`
      attribute float starSize;
      attribute float starLight;
      uniform float pixelRatio;
      varying float brightness;
      void main() {
        float altitude = (modelMatrix * vec4(position, 0.0)).y;
        brightness = starLight * mix(0.25, 1.0, smoothstep(-0.7, 0.6, altitude));
        gl_PointSize = starSize * pixelRatio;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader:`
      uniform float fade;
      uniform vec3 tint;
      varying float brightness;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float shape = exp(-3.5 * r * r) * (1.0 - smoothstep(0.55, 1.0, r));
        gl_FragColor = vec4(tint, brightness * fade * shape);
        #include <colorspace_fragment>
      }
    `,
  }));
  points.visible = false;
  points.renderOrder = 3;
  points.frustumCulled = false;
  points.onBeforeRender = renderer => { pixelRatio.value = renderer.getPixelRatio(); };
  group.add(points);

  const segments = [];
  for (let index = 1; index < DIPPER.length; index++) {
    const a = byHip.get(DIPPER[index-1]), b = byHip.get(DIPPER[index]);
    if (a && b) segments.push(...a,...b);
  }
  const dipper = segments.length ? line(segments,C.dipper,0,1.2) : null;
  if (dipper) group.add(dipper);
  return {
    update(altitude) {
      fade.value = starVisibility(altitude);
      points.visible = fade.value > .005 && positions.length > 0;
      if (dipper) {
        dipper.visible = points.visible;
        dipper.material.opacity = .57 * fade.value;
      }
    },
  };
}

function buildPole(group, radius) {
  const guide = line([0,0,0,0,0,0],C.pole,.76,1.3,true);
  guide.frustumCulled = false;
  const marker = new THREE.Mesh(new THREE.SphereGeometry(.095,12,8),new THREE.MeshBasicMaterial({
    color:C.pole, toneMapped:false, depthWrite:false,
  }));
  const caption = label(440,92,3.65,.77,C.pole,true);
  caption.setText('天北极 · 近北极星');
  group.add(guide,marker,caption.sprite);
  return {
    update(latitude,styleReach) {
      const pole = new THREE.Vector3(...polarBasis(latitude).P);
      const start = pole.clone().multiplyScalar(THREE.MathUtils.clamp(styleReach,0,radius));
      const end = pole.clone().multiplyScalar(radius);
      const data = guide.geometry.attributes.instanceStart.data;
      data.array.set([...start.toArray(),...end.toArray()]);
      data.needsUpdate = true;
      const distances = guide.geometry.attributes.instanceDistanceEnd.data;
      distances.array[1] = end.distanceTo(start);
      distances.needsUpdate = true;
      marker.position.copy(end);
      caption.sprite.position.copy(pole).multiplyScalar(radius+1.15);
      caption.sprite.position.y += .62;
    },
  };
}

export function createCelestialDome(radius, starData) {
  const group = new THREE.Group();
  group.visible = false;
  const equatorial = new THREE.Group();
  equatorial.matrixAutoUpdate = false;
  group.add(equatorial);
  buildHorizon(group,radius);
  const pole = buildPole(group,radius);
  const stars = buildStars(equatorial,radius,starData);
  const { normal,ticks,highlight,selected } = buildEquator(equatorial,radius);
  let nearest, hovered, showNearest = true;

  function updateSelection() {
    const active = hovered ?? (showNearest ? nearest : null);
    highlight.visible = selected.sprite.visible = Boolean(active);
    if (!active) return;
    const { vector,term } = active;
    highlight.position.copy(vector).multiplyScalar(radius);
    selected.sprite.position.copy(vector).multiplyScalar(radius+.55).addScaledVector(normal,.61);
    selected.setText(`${term.name}  ${term.longitude}°`);
  }

  function update({ center,latitude,longitude,solarTime,altitude,styleReach = 0, showNearestTerm = true }) {
    if (center) group.position.copy(center);
    if (![latitude,longitude,solarTime,altitude].every(Number.isFinite)) return;
    const [east,up,south] = equatorialToLocalAxes(latitude,localSiderealAngle(longitude,solarTime));
    equatorial.matrix.set(...east,0,...up,0,...south,0,0,0,0,1);
    equatorial.matrixWorldNeedsUpdate = true;
    pole.update(latitude,styleReach);
    stars.update(altitude);
    showNearest = showNearestTerm;
    const sun = new THREE.Vector3(...eclipticVector(longitude));
    nearest = ticks.reduce((best,tick) => sun.dot(tick.vector) > sun.dot(best.vector) ? tick : best,ticks[0]);
    updateSelection();
  }

  function pickTerm(raycaster, minimumY = -Infinity) {
    if (!group.visible || !raycaster?.ray) return null;
    group.updateWorldMatrix(true,true);
    const ray = raycaster.ray;
    const point = new THREE.Vector3(), relative = new THREE.Vector3();
    let picked = null, score = Infinity;
    for (const { term,vector } of ticks) {
      point.copy(vector).multiplyScalar(radius).applyMatrix4(equatorial.matrixWorld);
      if (point.y < minimumY) continue;
      const depth = relative.copy(point).sub(ray.origin).dot(ray.direction);
      if (depth <= 0) continue;
      const distance = ray.distanceSqToPoint(point);
      const threshold = THREE.MathUtils.clamp(depth*.015,.26,.78);
      const angularError = distance/(depth*depth);
      if (distance < threshold*threshold && angularError < score) {
        score = angularError;
        picked = term;
      }
    }
    return picked;
  }

  return {
    group,
    update,
    pickTerm,
    setHoveredTerm(id) {
      const tick = ticks.find(item => item.term.id === id);
      if (tick === hovered) return;
      hovered = tick;
      updateSelection();
    },
    dispose() {
      group.removeFromParent();
      disposeObject(group);
    },
  };
}
