import { TUNING as T } from './tuning.js';
import { snapAngle } from './angle.js';

// 固定步长计算；输入手势可以随时打断惯性或弹簧。
export function createMotion(angle = 0) {
  return { angle, velocity: 0, target: angle, phase: 'idle', accumulator: 0, settled: 0 };
}
export function dragMotion(model, angle) {
  Object.assign(model, { angle, target: angle, velocity: 0, phase: 'drag', accumulator: 0 });
}
export function springMotion(model, target, reduced = false) {
  model.target = target;
  model.accumulator = 0;
  model.phase = 'spring';
  if (reduced) finishMotion(model);
}
export function releaseMotion(model, velocity = 0, reduced = false) {
  model.velocity = Math.max(-T.maxVelocity, Math.min(T.maxVelocity, velocity));
  model.target = snapAngle(model.angle + model.velocity / T.friction);
  model.phase = Math.abs(model.velocity) > T.inertiaThreshold ? 'inertia' : 'spring';
  model.accumulator = 0;
  if (reduced) finishMotion(model);
}
export function finishMotion(model) {
  model.angle = model.target;
  model.velocity = 0;
  model.phase = 'idle';
  model.accumulator = 0;
  model.settled++;
}
export function advanceMotion(model, elapsed) {
  if (!['spring', 'inertia'].includes(model.phase)) return model;
  model.accumulator += Math.min(.1, Math.max(0, elapsed));
  const damping = 2 * T.dampingRatio * Math.sqrt(T.stiffness);
  while (model.accumulator + 1e-10 >= T.step) {
    model.accumulator -= T.step;
    if (model.phase === 'inertia') {
      const decay = Math.exp(-T.friction * T.step);
      model.angle += model.velocity / T.friction * (1 - decay);
      model.velocity *= decay;
      if (Math.abs(model.velocity) < T.springThreshold) model.phase = 'spring';
    } else {
      model.velocity += (-T.stiffness * (model.angle - model.target) - damping * model.velocity) * T.step;
      model.angle += model.velocity * T.step;
      if (Math.abs(model.angle - model.target) < T.distanceEpsilon && Math.abs(model.velocity) < T.velocityEpsilon) {
        finishMotion(model);
        break;
      }
    }
  }
  return model;
}
