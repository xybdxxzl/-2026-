import * as THREE from 'three';
import { polarBasis } from '../../lib/astro/sundialGeometry.js';

// Local dial axes are W, M, P. The face-on normal alignment uses quaternions only.
export function dialQuaternion(latitudeDeg) {
  const { P, W } = polarBasis(latitudeDeg);
  const normal = new THREE.Vector3(...P).normalize();
  const align = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(align);
  // At the exact antipodal equator case Three.js chooses a different valid roll.
  const angle = localX.dot(new THREE.Vector3(...W)) < 0 ? Math.PI : 0;
  const roll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle);
  return align.multiply(roll);
}
