import { Color } from 'three';
import { palette } from './sundialTheme.js';

const finishes={
  bronze:[palette.oxide,.67], gold:[palette.burnished,.72], dark:[palette.umber,.32],
  lacquer:[palette.umber,.82], stone:[palette.stoneShade,.58],
};
const grain=`
  varying vec3 craftPoint;
  float castHash(vec3 v) {
    v = fract(v * 0.1031);
    v += dot(v, v.yzx + 33.33);
    return fract((v.x + v.y) * v.z);
  }
  float castGrain(vec3 p) {
    vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(castHash(i),castHash(i+vec3(1,0,0)),f.x),
                   mix(castHash(i+vec3(0,1,0)),castHash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(castHash(i+vec3(0,0,1)),castHash(i+vec3(1,0,1)),f.x),
                   mix(castHash(i+vec3(0,1,1)),castHash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }`;

// The finish is defined in the object's coordinates, so the grain stays on the casting
// as the observer circles it. The environment provides the broad specular reflections.
export function applySurfaceFinish(material) {
  const role=material.userData.finish,finish=finishes[role];
  if(!finish&&role!=='marble')return;
  const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{
    previous.call(material,shader,renderer);
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nvarying vec3 craftPoint;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\ncraftPoint=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
      '#include <common>\n'+grain+'\nuniform vec3 finishPigment;');
    if(finish)shader.uniforms.finishPigment={value:new Color(finish[0])};
    const clearance=material.userData.inkClearance;
    if(clearance){
      shader.uniforms.inkClearance={value:clearance};
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
        #include <map_fragment>
        #ifdef USE_MAP
          if(inkClearance.z>0.0){
            float reveal=smoothstep(inkClearance.z*.66,inkClearance.z,distance(vMapUv,inkClearance.xy));
            diffuseColor.rgb=mix(diffuse,diffuseColor.rgb,reveal);
          }
        #endif`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 inkClearance;');
    }
    const tone=finish
      ? 'diffuseColor.rgb=mix(diffuseColor.rgb,finishPigment,clamp('+finish[1].toFixed(2)+'+variation*.26,0.0,1.0));'
      : '';
    const stone=role==='marble'||role==='stone';
    const surface=stone?`
      float drift=castGrain(craftPoint*2.8);
      float bed=castGrain(vec3(craftPoint.x*2.5,craftPoint.y*5.0+craftPoint.z*1.8+drift,drift*2.0));
      float stratum=dot(craftPoint,vec3(.92,.29,.62))*1.45+drift*.37;
      float seam=abs(fract(stratum+.14)-.5);
      float vein=(1.0-smoothstep(.001,max(.014,fwidth(stratum)),seam))*smoothstep(.42,.68,bed);
      float fleck=castGrain(craftPoint*108.0)-.5;
      diffuseColor.rgb*=1.0 + variation*.075 + fleck*.042 - vein*.055;
    `:`
      float brushing=castGrain(craftPoint*vec3(52.0,120.0,52.0))-.5;
      diffuseColor.rgb*=1.0 + variation*.22 + brushing*.08;
    `;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
      'float variation=castGrain(craftPoint*5.2)-.5;\n'+tone+'\n#include <map_fragment>');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\n'+surface);
    if(role==='marble')shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`
      #include <lights_fragment_end>
      // An ink-filled cut has a matte finish even when the surrounding stone reflects the softbox.
      vec3 pigment=diffuseColor.rgb/max(diffuse,vec3(.001));
      float density=max(pigment.r,max(pigment.g,pigment.b));
      float polished=mix(.025,.72,smoothstep(.16,.80,density));
      float inkAbsorption=mix(.68,1.0,smoothstep(.06,.32,density));
      reflectedLight.indirectDiffuse *= .074*inkAbsorption;
      reflectedLight.directDiffuse *= 1.37*inkAbsorption;
      reflectedLight.directSpecular *= polished;
      reflectedLight.indirectSpecular *= polished;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+variation*.13,.30,.88);');
  };
  material.customProgramCacheKey=()=>key+'-finish-'+role+(material.userData.inkClearance?'-inscribed':'');
}
