import * as THREE from 'three';

const hourMs = 3_600_000;
const radialSegments = 8;

function arcGeometry(samples, toWorld, origin) {
  const curve = new THREE.CatmullRomCurve3(samples.map(({ point }) => toWorld(point)));
  const segments = (samples.length - 1) * 3;
  curve.arcLengthDivisions = Math.max(200, segments);
  const geometry = new THREE.TubeGeometry(curve, segments, .038, radialSegments, false);
  const hours = new Float32Array(geometry.attributes.position.count);

  for (let ring = 0; ring <= segments; ring++) {
    // TubeGeometry is spaced by arc length. Map each ring back to its observation time.
    const index = curve.getUtoTmapping(ring / segments) * (samples.length - 1);
    const before = Math.min(samples.length - 2, Math.floor(index));
    const ms = THREE.MathUtils.lerp(samples[before].ms, samples[before + 1].ms, index - before);
    const firstVertex = ring * (radialSegments + 1);
    hours.fill((ms - origin) / hourMs, firstVertex, firstVertex + radialSegments + 1);
  }
  geometry.setAttribute('observationHour', new THREE.BufferAttribute(hours, 1));
  return geometry;
}

export function createSolarPath() {
  const group = new THREE.Group();
  const arcs = new THREE.Group();
  const crossings = new THREE.Group();
  group.add(arcs, crossings);
  const now = { value: 0 };
  let origin = 0;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      now,
      travelled: { value: new THREE.Color('#f7c786') },
      ahead: { value: new THREE.Color('#c8a774') },
    },
    transparent: true,
    depthWrite: false,
    vertexShader: `
      attribute float observationHour;
      varying float hour;
      varying vec3 viewNormal;
      varying vec3 viewPosition;
      void main() {
        vec4 positionInView = modelViewMatrix * vec4(position, 1.0);
        hour = observationHour;
        viewNormal = normalMatrix * normal;
        viewPosition = -positionInView.xyz;
        gl_Position = projectionMatrix * positionInView;
      }
    `,
    fragmentShader: `
      uniform float now;
      uniform vec3 travelled;
      uniform vec3 ahead;
      varying float hour;
      varying vec3 viewNormal;
      varying vec3 viewPosition;
      void main() {
        float upcoming = smoothstep(-0.025, 0.025, hour - now);
        float edge = max(dot(normalize(viewNormal), normalize(viewPosition)), 0.0);
        float coverage = smoothstep(0.05, 0.84, edge);
        float alpha = mix(0.98, 0.53, upcoming) * coverage;
        gl_FragColor = vec4(mix(travelled, ahead, upcoming), alpha);
        #include <colorspace_fragment>
      }
    `,
  });

  const markerGeometry = new THREE.SphereGeometry(.09, 16, 10);
  const markerMaterial = new THREE.MeshBasicMaterial({ color:'#edc489', toneMapped:false });

  function update(runs, horizon, toWorld) {
    for (const mesh of arcs.children) mesh.geometry.dispose();
    arcs.clear();
    crossings.clear();
    origin = runs[0]?.[0]?.ms ?? 0;
    for (const samples of runs) {
      if (samples.length < 2) continue;
      const arc = new THREE.Mesh(arcGeometry(samples, toWorld, origin), material);
      arc.renderOrder = 1;
      arcs.add(arc);
    }
    for (const point of horizon) {
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.copy(toWorld(point));
      crossings.add(marker);
    }
  }

  return {
    group,
    update,
    setTime(ms) { now.value = (ms - origin) / hourMs; },
    dispose() {
      for (const mesh of arcs.children) mesh.geometry.dispose();
      markerGeometry.dispose();
      markerMaterial.dispose();
      material.dispose();
      group.removeFromParent();
    },
  };
}
