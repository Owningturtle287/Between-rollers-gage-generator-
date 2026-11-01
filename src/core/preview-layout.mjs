import { derive } from './geometry.mjs';

/** Keep the ground below every preview surface, including roller overhangs.
 * @param {any} project
 * @param {number} [zOffset]
 * @param {ArrayLike<number>|null} [positions]
 */
export function previewLayout(project,zOffset=0,positions=null){
  const d=derive(project),radialRadius=d.pitchRadius+d.rollerRadius;
  const rollerBottom=zOffset-project.thickness*.1;
  let radius=Math.hypot(radialRadius,Math.abs(zOffset)+project.thickness*.6);
  if(positions)for(let i=0;i<positions.length;i+=3)radius=Math.max(radius,Math.hypot(positions[i],positions[i+1],positions[i+2]-project.thickness/2));
  return {radius,rollerBottom,groundZ:Math.min(0,rollerBottom)-Math.max(.1,radialRadius*.01),
    gridSize:radialRadius*12,gridFadeRadius:radialRadius*4,gridStep:10**Math.floor(Math.log10(radialRadius))/2};
}

/** A close near plane retains precision while leaving the entire part unclipped. */
export function previewDepthRange(distance,radius){
  return {near:Math.max(.005,distance-radius*1.1),far:Math.max(1,distance+radius*8)};
}

/** A single convex screen silhouette avoids alpha accumulating along triangle seams.
 * @param {number[][]} points
 * @returns {number[][]}
 */
export function convexHull2D(points){
  const sorted=points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  if(sorted.length<3)return sorted;
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const lower=[],upper=[];
  for(const p of sorted){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
  for(const p of sorted.slice().reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
  return lower.slice(0,-1).concat(upper.slice(0,-1));
}
