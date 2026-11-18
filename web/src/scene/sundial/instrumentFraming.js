import { Vector3 } from 'three';
import { ConvexHull } from 'three/addons/math/ConvexHull.js';

const up=new Vector3(0,1,0);

// Only the hull can touch the frame; keep every extremum of the finished instrument.
export function instrumentHull(group) {
  const hull=new ConvexHull().setFromObject(group),points=new Set();
  for(const {edge} of hull.faces){
    points.add(edge.head().point);points.add(edge.next.head().point);points.add(edge.prev.head().point);
  }
  return [...points];
}
export function viewAxes(outward) {
  const right=new Vector3().crossVectors(up,outward);
  if(right.lengthSq()<1e-12)right.set(1,0,0);
  else right.normalize();
  return {right,vertical:new Vector3().crossVectors(outward,right),outward};
}
export function requiredDistance(points,target,axes,slopeX,slopeY){
  const {right,vertical,outward}=axes;
  const rel=new Vector3();
  let fit=0;
  for(const p of points){
    rel.subVectors(p,target);
    fit=Math.max(fit,rel.dot(outward)+Math.max(Math.abs(rel.dot(right))/slopeX,Math.abs(rel.dot(vertical))/slopeY));
  }
  return fit;
}
// Center the projected silhouette. A tall front edge otherwise biases the framing downward.
export function centerPortrait(target,points,outward,camera) {
  const axes=viewAxes(outward),v=Math.tan(camera.fov*Math.PI/360),rel=new Vector3();
  for(let pass=0;pass<2;pass++){
    const distance=requiredDistance(points,target,axes,v*camera.aspect*.84,v*.84);
    let left=Infinity,right=-Infinity,top=-Infinity,bottom=Infinity;
    for(const p of points){
      rel.subVectors(p,target);
      const depth=distance-rel.dot(outward),x=rel.dot(axes.right)/depth,y=rel.dot(axes.vertical)/depth;
      left=Math.min(left,x);right=Math.max(right,x);bottom=Math.min(bottom,y);top=Math.max(top,y);
    }
    target.addScaledVector(axes.right,distance*(left+right)/2);
    target.addScaledVector(axes.vertical,distance*(bottom+top)/2);
  }
}
