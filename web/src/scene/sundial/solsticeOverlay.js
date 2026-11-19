import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { SKY_RADIUS } from '../../lib/astro/tracks.js';
import { equinoxDayArc } from '../../lib/astro/sundialObservation.js';
import { projectGnomonShadow } from './gnomonReference.js';
import { createSolarPath } from './solarPath.js';
import { CELESTIAL_COLORS, SUNDIAL_COLORS, SUNDIAL_SOLSTICES } from './sundialTheme.js';

const angleSteps = 28;
const Y = new THREE.Vector3(0, 1, 0);

function canvasTexture(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { context:canvas.getContext('2d'), texture };
}

function solarMarker(theme) {
  const { context, texture } = canvasTexture(128, 128);
  const glow = context.createRadialGradient(64,64,18,64,64,62);
  glow.addColorStop(0, theme.glow + 'db');
  glow.addColorStop(.52, theme.glow + '48');
  glow.addColorStop(1, theme.glow + '00');
  context.fillStyle = glow;
  context.fillRect(0,0,128,128);
  context.fillStyle = theme.core;
  context.strokeStyle = theme.color;
  context.lineWidth = 3;
  context.beginPath();
  context.arc(64,64,22,0,Math.PI*2);
  context.fill();
  context.stroke();
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map:texture, transparent:true, depthWrite:false, toneMapped:false,
  }));
  sprite.renderOrder = 10;
  return sprite;
}

function solarLabel() {
  const { context, texture } = canvasTexture(384, 104);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map:texture, transparent:true, depthWrite:false, toneMapped:false,
  }));
  sprite.scale.set(3.15, .853, 1);
  sprite.renderOrder = 11;
  return { context, texture, sprite, text:'' };
}

function updateLabel(label, theme, text) {
  if (label.text === text) return;
  label.text = text;
  const { context, texture } = label;
  context.clearRect(0,0,384,104);
  context.font = '600 49px "Microsoft YaHei", "PingFang SC", sans-serif';
  const width = Math.min(382, context.measureText(text).width + 68);
  const left = (384 - width) / 2;
  context.fillStyle = SUNDIAL_COLORS.stage+'f7';
  context.strokeStyle = theme.color;
  context.lineWidth = 2.5;
  context.beginPath();
  context.roundRect(left,12,width,80,10);
  context.fill();
  context.stroke();
  context.fillStyle = theme.color;
  context.beginPath();
  context.arc(left+25,52,5,0,Math.PI*2);
  context.fill();
  context.fillStyle = theme.core;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text,204,53,326);
  texture.needsUpdate = true;
}

function line(color, count, dashed = false) {
  const geometry = new LineSegmentsGeometry().setPositions(new Float32Array(count * 6));
  const material = new LineMaterial({
    color, linewidth:2, transparent:true, depthWrite:false, toneMapped:false,
    dashed, dashSize:.21, gapSize:.125,
  });
  const mesh = new LineSegments2(geometry, material);
  if (dashed) mesh.computeLineDistances();
  mesh.frustumCulled = false;
  mesh.renderOrder = 8;
  return mesh;
}

function setLine(mesh, positions) {
  const buffer = mesh.geometry.attributes.instanceStart.data;
  buffer.array.set(positions);
  buffer.needsUpdate = true;
  const distances = mesh.geometry.attributes.instanceDistanceEnd?.data;
  if (distances) {
    distances.array[1] = Math.hypot(
      positions[3] - positions[0], positions[4] - positions[1], positions[5] - positions[2],
    );
    distances.needsUpdate = true;
  }
}

function buildSeason(group, theme) {
  const path = createSolarPath({
    travelled:theme.arc??theme.color, ahead:theme.arcAhead, crossing:theme.color,
    tubeRadius:theme.arc ? .030 : .061,
  });
  const mark = solarMarker(theme);
  const label = solarLabel();
  const ray = line(theme.color, 1);
  const incoming = line(theme.color, 1, true);
  const angle = line(theme.color, angleSteps);
  const root = new THREE.Group();
  root.add(path.group, mark, label.sprite, ray, incoming, angle);
  group.add(root);
  return { root, theme, path, mark, label, ray, incoming, angle, arcPoints:[], rayPoints:[],
    trackCenter:new THREE.Vector3(), sunDirection:new THREE.Vector3() };
}

function updatePath(season, tracks, center, radius) {
  if (season.tracks === tracks && season.trackCenter.equals(center) && season.radius === radius) return;
  season.tracks = tracks;
  season.trackCenter.copy(center);
  season.radius = radius;
  const scale = radius / SKY_RADIUS;
  const toWorld = ([east, north, up]) => new THREE.Vector3(east * scale, up * scale, -north * scale).add(center);
  const runs = tracks?.solarArcs ?? [];
  season.path.update(runs, tracks?.horizon ?? [], toWorld);
  season.arcPoints = runs.flatMap(run => {
    const stride = Math.max(1, Math.floor(run.length / 26));
    return run.filter((_, i) => i % stride === 0 || i === run.length - 1).map(({ point }) => toWorld(point));
  });
}

function updateGuide(season, shadow, sun, reference, radius) {
  const { ray, incoming, angle, theme } = season;
  const point = shadow?.groundPointChi;
  const valid = Boolean(point?.every(Number.isFinite));
  ray.visible = incoming.visible = angle.visible = valid;
  season.rayPoints = [];
  if (!valid) return;

  const { east, south, fraction } = projectGnomonShadow(point[0], -point[2]);
  const { top, foot } = reference;
  // Move the clipped endpoint along the incident ray, leaving its physical slope intact.
  const endpoint = new THREE.Vector3(
    foot.x + east * fraction, top.y * (1 - fraction), foot.z + south * fraction,
  );
  const reach = season.mark.position.clone().sub(top).dot(sun);
  const upper = top.clone().addScaledVector(sun, Math.max(radius * .35, reach));
  setLine(ray, [...endpoint.toArray(), ...top.toArray()]);
  setLine(incoming, [...top.toArray(), ...upper.toArray()]);
  season.rayPoints = [endpoint, upper];
  angle.visible = fraction === 1;
  if (!angle.visible) return;

  const ground = new THREE.Vector3(sun.x, 0, sun.z);
  const altitude = Math.atan2(sun.y, ground.length());
  if (ground.lengthSq() < 1e-12) ground.set(0,0,1);
  else ground.normalize();
  const arcRadius = Math.min(theme.angleRadius, Math.max(.62, Math.hypot(east,south)*.68));
  const origin = endpoint.clone().addScaledVector(Y, .12);
  const points = Array.from({ length:angleSteps+1 }, (_, index) => {
    const phi = altitude * index / angleSteps;
    return origin.clone()
      .addScaledVector(ground, arcRadius * Math.cos(phi))
      .addScaledVector(Y, arcRadius * Math.sin(phi)).toArray();
  });
  setLine(angle, points.slice(1).flatMap((point, index) => [...points[index], ...point]));
}

function updateSeason(season, sample, active, center, radius, reference) {
  season.root.visible = Boolean(sample);
  if (!sample) return;
  const { solar, tracks, shadow } = sample;
  updatePath(season, tracks, center, radius);
  season.path.setTime(solar?.ms ?? tracks?.solarArcs?.[0]?.[0]?.ms ?? 0);
  season.path.setOpacity(active ? 1 : .77);
  const direction = solar?.polar?.sun ?? solar?.sun;
  const lit = solar?.altitude > 0 && direction?.every(Number.isFinite);
  const { mark, label, ray, incoming, angle } = season;
  mark.visible = label.sprite.visible = Boolean(lit);
  season.markerPoints = [];
  if (!lit) {
    ray.visible = incoming.visible = angle.visible = false;
    season.rayPoints = [];
    return;
  }
  const sun = new THREE.Vector3(...direction);
  season.sunDirection.copy(sun);
  mark.position.copy(center).addScaledVector(sun, radius);
  mark.scale.setScalar(active ? 1.43 : 1.15);
  mark.material.opacity = active ? 1 : .79;
  label.sprite.position.copy(mark.position).addScaledVector(Y, .83);
  label.sprite.material.opacity = active ? 1 : .87;
  updateLabel(label, season.theme, season.theme.name);
  season.markerPoints = [mark.position, label.sprite.position.clone().addScaledVector(Y, .39)];
  for (const guide of [ray, incoming, angle]) {
    guide.material.linewidth = active ? 2.25 : 1.65;
    guide.material.opacity = active ? .91 : .66;
  }
  incoming.material.opacity *= .78;
  updateGuide(season, shadow, sun, reference, radius);
}

export function createSolsticeOverlay(reference) {
  const group = new THREE.Group();
  const seasons = Object.entries(SUNDIAL_SOLSTICES).map(([id, theme]) => ({
    id, ...buildSeason(group, theme),
  }));
  const equinox = createSolarPath({ travelled:CELESTIAL_COLORS.equator, ahead:CELESTIAL_COLORS.equator });
  equinox.setOpacity(.68);
  equinox.group.visible = false;
  group.add(equinox.group);
  let equinoxLatitude, equinoxHeight;
  group.visible = false;
  return {
    group,
    update(samples, driver, dialCenter, radius, latitude, showEquinox) {
      const driverId = driver?.id ?? driver ?? samples[0]?.id;
      group.visible = samples.length > 0;
      for (const season of seasons) {
        const sample = samples.find(({ id }) => id === season.id);
        updateSeason(season, sample, season.id === driverId, reference.top, radius, reference);
      }
      equinox.group.visible = group.visible && Boolean(showEquinox);
      if (equinox.group.visible && (equinoxLatitude !== latitude || equinoxHeight !== dialCenter.y)) {
        const points = equinoxDayArc(latitude);
        const scale = radius / SKY_RADIUS;
        const toWorld = ([east,north,up])=>new THREE.Vector3(east*scale,up*scale,-north*scale).add(dialCenter);
        equinox.update(points.length ? [points] : [], [], toWorld);
        equinox.setTime(18 * 3_600_000);
        equinoxLatitude = latitude;
        equinoxHeight = dialCenter.y;
      }
    },
    setOrbitScale(scale, center, dialCenter, activeId, activeDirection) {
      equinox.group.scale.setScalar(scale);
      equinox.group.position.copy(dialCenter).multiplyScalar(1-scale);
      for (const season of seasons) {
        if (!season.root.visible) continue;
        season.path.group.scale.setScalar(scale);
        season.path.group.position.copy(center).addScaledVector(season.trackCenter,-scale);
        if (!season.mark.visible) continue;
        const direction = season.id===activeId && activeDirection ? activeDirection : season.sunDirection;
        season.mark.position.copy(center).addScaledVector(direction,season.radius*scale);
        season.label.sprite.position.copy(season.mark.position).addScaledVector(Y,.83);
      }
    },
    get fitPoints() {
      return seasons.filter(season => season.root.visible && group.visible)
        .flatMap(season => [...season.arcPoints, ...season.rayPoints, ...season.markerPoints]);
    },
    dispose() {
      equinox.dispose();
      for (const season of seasons) season.path.dispose();
    },
  };
}
