import * as THREE from 'three';
import { DIAL_RADIUS, STYLE_LENGTH_RATIO } from '../../lib/astro/sundialGeometry.js';
import { dialQuaternion } from './dialOrientation.js';
import { SUNDIAL_MODEL as M } from './sundialTheme.js';

const metal = (color, metalness, roughness) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
const Y = new THREE.Vector3(0, 1, 0);

function addMesh(group, geometry, material, casts = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = casts;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function lathe(profile, segments = 128) {
  return new THREE.LatheGeometry(profile.map(([radius, height]) => new THREE.Vector2(radius, height)), segments);
}

function slab(width, depth, height, bevel) {
  const x = width / 2 - bevel, y = depth / 2 - bevel, corner = .26;
  const outline = new THREE.Shape([
    [-x + corner, -y], [x - corner, -y], [x, -y + corner], [x, y - corner],
    [x - corner, y], [-x + corner, y], [-x, y - corner], [-x, -y + corner],
  ].map(([a, b]) => new THREE.Vector2(a, b)));
  const geometry = new THREE.ExtrudeGeometry(outline, {
    depth:height - bevel * 2, bevelEnabled:true, bevelSize:bevel, bevelThickness:bevel, bevelSegments:3,
  });
  return geometry.translate(0, 0, bevel).rotateX(-Math.PI / 2);
}

function supportLeg(group, from, to, material, trim) {
  const start = new THREE.Vector3(...from);
  const axis = new THREE.Vector3(...to).sub(start);
  const h = axis.length();
  const geometry = lathe([[.26,0],[.26,.13],[.19,.25],[.15,h*.34],[.12,h*.72],[.15,h-.19],[.19,h]], 32);
  const mesh = addMesh(group, geometry, material);
  addMesh(mesh, lathe([[.263,.07],[.278,.09],[.278,.13],[.228,.2],[.211,.2]], 32), trim, false);
  addMesh(mesh, lathe([[.157,h-.16],[.177,h-.14],[.177,h-.11],[.172,h-.09]], 32), trim, false);
  mesh.position.copy(start);
  mesh.quaternion.setFromUnitVectors(Y, axis.normalize());
}

function buildPlinth(group, radius, baseTexture, stoneNormal) {
  const width = radius * 2.36, depth = radius * 1.82;
  const stone = new THREE.MeshStandardMaterial({
    color:'#2d4038', roughness:.77, normalMap:stoneNormal, normalScale:new THREE.Vector2(.47, .47),
  });
  const foot = new THREE.MeshStandardMaterial({ color:'#1b2c26', roughness:.84 });
  const inlay = metal('#a58450', .72, .31);
  const base = [
    [0, .16, width, depth, .052, foot],
    [.16, .055, width - .11, depth - .11, .015, inlay],
    [.215, .09, width - .20, depth - .20, .022, foot],
    [.305, .535, width - .30, depth - .30, .08, stone],
  ];
  for (const [y, height, w, d, bevel, material] of base) {
    addMesh(group, slab(w, d, height, bevel), material).position.y = y;
  }
  const top = addMesh(group, new THREE.PlaneGeometry(width - .65, depth - .65), new THREE.MeshStandardMaterial({
    map:baseTexture, transparent:true, depthWrite:false, roughness:.8, polygonOffset:true, polygonOffsetFactor:-1,
  }), false);
  top.rotation.x = -Math.PI / 2;
  top.position.y = .842;
  return .84;
}

export function createInstrument(latitude, textures, baseTexture, stoneNormal) {
  const radius = DIAL_RADIUS, thickness = radius * M.thicknessRatio;
  const faceZ = thickness / 2, length = radius * STYLE_LENGTH_RATIO;
  const group = new THREE.Group(), dial = new THREE.Group();
  const baseHeight = buildPlinth(group, radius, baseTexture, stoneNormal);
  const phi = latitude * Math.PI / 180;
  const verticalNormal = Math.abs(Math.sin(phi));
  const diskReach = radius * Math.abs(Math.cos(phi)) + faceZ * verticalNormal;
  const tipReach = (length + faceZ) * verticalNormal;
  const centerHeight = baseHeight + Math.max(diskReach, tipReach) + .46;
  dial.position.y = centerHeight;
  dial.quaternion.copy(dialQuaternion(latitude));
  group.add(dial);

  const bodyMaterial = metal('#936239', .72, .35);
  const edgeMaterial = metal('#cfa46b', .76, .25);
  const shoulder = metal('#403e2d', .68, .41);
  const rim = lathe([
    [radius * .943, -faceZ], [radius * .970, -faceZ], [radius * .983, -faceZ * .83],
    [radius, -faceZ * .53], [radius * .998, -faceZ * .34], [radius * .991, -faceZ * .29],
    [radius * .991, faceZ * .29], [radius * .998, faceZ * .34], [radius, faceZ * .53],
    [radius * .983, faceZ * .83], [radius * .970, faceZ], [radius * .943, faceZ],
  ]).rotateX(Math.PI / 2);
  addMesh(dial, rim, bodyMaterial);
  addMesh(dial, new THREE.TorusGeometry(radius * .99, .024, 8, 128), shoulder, false);
  for (const z of [-faceZ, faceZ]) {
    addMesh(dial, new THREE.TorusGeometry(radius * .977, .043, 10, 128), edgeMaterial).position.z = z;
    addMesh(dial, new THREE.TorusGeometry(radius * .955, .018, 8, 128), shoulder, false).position.z = z;
  }
  for (const z of [-faceZ * .5, faceZ * .5]) {
    addMesh(dial, new THREE.TorusGeometry(radius - .006, .021, 8, 128), edgeMaterial, false).position.z = z;
  }

  const surfaceRadius = radius * .956;
  const disc = new THREE.CircleGeometry(surfaceRadius, 128);
  const uv = disc.attributes.uv;
  // Sample the central area of a full-radius texture so marks stay on their model coordinates.
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, .5 + (uv.getX(i) - .5) * surfaceRadius / radius, .5 + (uv.getY(i) - .5) * surfaceRadius / radius);
  }
  const faceMaterials = [];
  const needleMaterial = metal('#8d5d31', .74, .3);
  for (const [face, side] of [['front', 1], ['back', -1]]) {
    const faceMaterial = new THREE.MeshStandardMaterial({
      map:textures[face].map, bumpMap:textures[face].bump, bumpScale:.024, roughness:.66,
      side:side > 0 ? THREE.FrontSide : THREE.BackSide,
    });
    const faceMesh = addMesh(dial, disc, faceMaterial);
    faceMesh.name = `${face}-dial-face`;
    faceMesh.position.z = side * faceZ;
    faceMaterials.push(faceMaterial);
    const collar = lathe([
      [0,0],[.43,0],[.43,.04],[.40,.072],[.34,.088],[.34,.11],[.29,.145],[.24,.155],[.19,.20],[0,.20],
    ], 64);
    collar.rotateX(side * Math.PI / 2);
    addMesh(dial, collar, edgeMaterial).position.z = side * faceZ;
    const needle = lathe([[.167,.14],[.167,.24],[.152,.31],[.123,length*.73],[.076,length*.92],[0,length]], 40);
    needle.rotateX(side * Math.PI / 2);
    const style = addMesh(dial, needle, needleMaterial);
    style.name = `${face}-style`;
    style.position.z = side * faceZ;
    const bands = [
      [.365, .024, .086, shoulder],
      [.151, .021, .30, edgeMaterial],
      [.14, .011, .425, edgeMaterial],
    ];
    for (const [ringRadius, tube, offset, material] of bands) {
      const band = addMesh(dial, new THREE.TorusGeometry(ringRadius, tube, 8, 40), material, false);
      band.position.z = side * (faceZ + offset);
    }
  }

  const support = metal('#475b4c', .66, .41);
  const pivotGeometry = new THREE.CylinderGeometry(.285, .285, .64, 40).rotateZ(Math.PI / 2);
  const pivotTrim = new THREE.TorusGeometry(.234, .035, 10, 40).rotateY(Math.PI / 2);
  const fastenerGeometry = new THREE.CylinderGeometry(.157, .178, .085, 6).rotateZ(Math.PI / 2);
  for (const side of [-1, 1]) {
    const x = side * radius * 1.035;
    for (const z of [-1.22, 1.22]) {
      addMesh(group, new THREE.CylinderGeometry(.34, .38, .13, 32), edgeMaterial).position.set(x, baseHeight + .065, z);
      supportLeg(group, [x, baseHeight + .12, z], [x, centerHeight, 0], support, edgeMaterial);
    }
    addMesh(group, pivotGeometry, support).position.set(x, centerHeight, 0);
    addMesh(group, pivotTrim, edgeMaterial, false).position.set(x + side * .308, centerHeight, 0);
    addMesh(group, fastenerGeometry, edgeMaterial).position.set(x + side * .341, centerHeight, 0);
  }
  return { group, dial, centerHeight, faceMaterials, labelMeshes:[], bodyMaterial, edgeMaterial, thickness, length, baseHeight };
}

export function disposeObject(object) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  object.traverse(item => {
    if (item.geometry) geometries.add(item.geometry);
    for (const material of item.material ? (Array.isArray(item.material) ? item.material : [item.material]) : []) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  geometries.forEach(value => value.dispose());
  materials.forEach(value => value.dispose());
  textures.forEach(value => value.dispose());
}
