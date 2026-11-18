import { solarHourAngle } from '../../lib/astro/sundialGeometry.js';
import { branches } from './sundialTheme.js';

// Radius fractions on both physical faces. Only the letterforms change handedness.
export const dialLayout=Object.freeze({
  clearRadius:.655, letterRadius:.778, letterHeight:.123, phoneLetterHeight:.142,
  rules:[{r:.655,width:.0032},{r:.874,width:.0038},{r:.935,width:.0026}],
  marks:Array.from({length:96},(_,quarter)=>{
    const hour=quarter/4,major=quarter%8===0,whole=quarter%4===0,angle=solarHourAngle(hour);
    const start=major?.869:whole?.655:quarter%2===0?.892:.911;
    const spans=major?[[.655,.691],[start,.935]]:[[start,.935]];
    // Turn type on the two arcs independently so neither half reads upside down.
    const roll=angle>90?angle-180:angle< -90?angle+180:angle;
    return {hour,angle,roll,major,whole,spans,width:major?.0083:whole?.0046:.0030,letter:major?branches[hour/2]:null};
  }),
});
