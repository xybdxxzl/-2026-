import { ShaderChunk } from 'three';

// Directional light, so the depth difference is a world-space travel distance.
export const solarShadowVolume = Object.freeze({ halfWidth: 9.5, near: 11, far: 280, lightDistance: 32 });

const stockShadows = ShaderChunk.shadowmap_pars_fragment;
// The published Three.js build strips comments from its GLSL chunks.
const basicStart = stockShadows.search(/#else[^\n]*\n\s*float\s+getShadow\s*\(\s*sampler2D\s+shadowMap\b/);
const basicEnd = stockShadows.indexOf('#if NUM_SUN_LIGHT_SHADOWS > 0', basicStart);

function directionalShadowChunk(blockerSamples, filterSamples) {
  if (basicStart < 0 || basicEnd < 0) return stockShadows;
  return `${stockShadows.slice(0, basicStart)}
    #else
    uniform float solarAngularSpread;

    vec2 solarDiskSample(int index, int count, float rotation) {
      float radius = sqrt((float(index) + 0.5) / float(count));
      float angle = float(index) * 2.39996323 + rotation;
      return radius * vec2(cos(angle), sin(angle));
    }

    float getShadow(sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity,
                    float shadowBias, float shadowRadius, vec4 shadowCoord) {
      vec3 receiver = shadowCoord.xyz / shadowCoord.w;
      vec3 dx = dFdx(receiver);
      vec3 dy = dFdy(receiver);
      float determinant = dx.x * dy.y - dx.y * dy.x;
      vec2 slope = vec2(0.0);
      if (abs(determinant) > 1e-12) {
        slope = vec2(dy.y * dx.z - dx.y * dy.z, dx.x * dy.z - dy.x * dx.z) / determinant;
      }

      if (any(lessThan(receiver, vec3(0.0))) || any(greaterThan(receiver, vec3(1.0)))) return 1.0;

      vec2 texel = 1.0 / shadowMapSize;
      // Correct for the receiver plane at each tap, especially when the sun is grazing it.
      float bias = -shadowBias + min(dot(abs(slope), texel) * 0.72, 0.006);
      float angularScale = solarAngularSpread / ${(solarShadowVolume.halfWidth * 2).toFixed(1)};
      float maxGap = max(receiver.z * ${(solarShadowVolume.far - solarShadowVolume.near).toFixed(1)} - 9.0, 0.0);
      float search = clamp(maxGap * angularScale, texel.x * 1.6, 0.055);
      float blockerGap = 0.0;
      float blockers = 0.0;
      for (int i = 0; i < ${blockerSamples}; ++i) {
        vec2 offset = i == 0 ? vec2(0.0) : solarDiskSample(i, ${blockerSamples}, 0.7) * search;
        float depth = texture2D(shadowMap, receiver.xy + offset).r;
        float gap = receiver.z + dot(slope, offset) - bias - depth;
        if (gap > 0.0) {
          blockerGap += gap;
          blockers += 1.0;
        }
      }
      if (blockers == 0.0) return 1.0;

      float gap = blockerGap / blockers * ${(solarShadowVolume.far - solarShadowVolume.near).toFixed(1)};
      float penumbra = clamp(gap * angularScale, texel.x * 1.5, 0.055);
      float visibility = 0.0;
      for (int i = 0; i < ${filterSamples}; ++i) {
        vec2 offset = solarDiskSample(i, ${filterSamples}, 1.8) * penumbra;
        float depth = texture2D(shadowMap, receiver.xy + offset).r;
        visibility += step(receiver.z + dot(slope, offset) - bias, depth);
      }
      return mix(1.0, visibility / float(${filterSamples}), shadowIntensity);
    }
    #endif
    ${stockShadows.slice(basicEnd)}`;
}

// Keep the shader scoped to this instrument and its floor.
export function createSolarShadowFilter(spread, compact) {
  const fragment = compact ? directionalShadowChunk(9, 16) : directionalShadowChunk(13, 28);
  return material => {
    material.onBeforeCompile = shader => {
      shader.uniforms.solarAngularSpread = spread;
      shader.fragmentShader = shader.fragmentShader.replace('#include <shadowmap_pars_fragment>', fragment);
    };
    material.customProgramCacheKey = () => compact ? 'sundial-solar-shadow-compact' : 'sundial-solar-shadow';
  };
}
