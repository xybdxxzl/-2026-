import { sundialModel } from '../lib/astronomy.js';

// Fixed oblique projection of the existing polar-style sundial model.
// North faces the viewer so the noon shadow remains visible beside the style.
export const WHEEL_DIAL = Object.freeze({ x:410, y:444, scale:32, radius:4.6 });
export function projectDial(east, north, up=0) {
  return {
    x:WHEEL_DIAL.x+WHEEL_DIAL.scale*(east+.28*north),
    y:WHEEL_DIAL.y+WHEEL_DIAL.scale*(.5*north-1.5*up),
  };
}
export function dialCirclePath(radius) {
  return Array.from({length:97},(_,index)=>{
    const angle=index/96*Math.PI*2;
    const p=projectDial(radius*Math.sin(angle),radius*Math.cos(angle));
    return `${index?'L':'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }).join(' ')+'Z';
}
export function wheelSundial(longitude) {
  const model=sundialModel(longitude,12);
  return {
    model, origin:projectDial(0,0), foot:projectDial(0,model.styleNorth),
    tip:projectDial(0,model.styleNorth,1),
    shadow:model.shadow?projectDial(model.shadow.east,model.shadow.north):null,
  };
}
