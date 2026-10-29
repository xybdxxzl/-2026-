export const TUNING = Object.freeze({
  step: 1 / 120, friction: 3.6, stiffness: 170, dampingRatio: .7,
  maxVelocity: 720, inertiaThreshold: 20, springThreshold: 45,
  distanceEpsilon: .05, velocityEpsilon: .5,
  wheelThreshold: 80, maxWheelTerms: 3,
  particleCaps: { rain: 180, snow: 140, leaf: 32 },
});
