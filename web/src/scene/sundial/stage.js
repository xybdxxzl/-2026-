import * as THREE from 'three';
import { SUNDIAL_COLORS as C } from './sundialTheme.js';

export function createStage() {
  const group = new THREE.Group();
  const plane = new THREE.PlaneGeometry(450, 450);
  const surface = new THREE.Mesh(plane, new THREE.ShaderMaterial({
    uniforms: {
      foreground: { value: new THREE.Color(C.stage) },
      pool: { value: new THREE.Color(C.stageLight) },
      distanceColor: { value: new THREE.Color(C.stageEdge) },
    },
    vertexShader: `
      varying vec2 ground;
      void main() {
        ground = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 ground;
      uniform vec3 foreground;
      uniform vec3 pool;
      uniform vec3 distanceColor;
      void main() {
        float distanceFromDial = length(ground);
        float spill = exp(-dot(ground, ground) * 0.0044);
        float contact = exp(-pow(distanceFromDial / 6.0, 5.0));
        float grain = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
        vec3 surface = mix(foreground, pool, spill * 0.9);
        surface = mix(surface, distanceColor, smoothstep(16.0, 74.0, distanceFromDial));
        gl_FragColor = vec4(surface * (1.0 - 0.37 * contact) + (grain - 0.5) * 0.0024, 1.0);
        #include <colorspace_fragment>
      }
    `,
  }));
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = -.045;
  group.add(surface);

  const shade = new THREE.Mesh(plane, new THREE.ShadowMaterial({
    color: '#090f0c',
    opacity: .66,
    depthWrite: false,
  }));
  shade.rotation.copy(surface.rotation);
  shade.position.y = -.03;
  shade.receiveShadow = true;
  group.add(shade);
  return { group, shade };
}
