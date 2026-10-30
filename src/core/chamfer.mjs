import { QUALITY } from './geometry.mjs';

// Wedges vary linearly with Z, so their setback is independent of tessellation.
// Vertex cones close re-entrant corners; the kernel resolves overlapping cuts.
function edgeWedge(api, a, b, width, depth, thickness, top, keep) {
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
  const nx=-dy/length,ny=dx/length;
  const tipZ=top?thickness-depth:depth,faceZ=top?thickness:0;
  const positions=[
    a[0],a[1],tipZ, a[0],a[1],faceZ, a[0]+nx*width,a[1]+ny*width,faceZ,
    b[0],b[1],tipZ, b[0],b[1],faceZ, b[0]+nx*width,b[1]+ny*width,faceZ,
  ];
  const triangles=[0,1,2,3,5,4,0,3,4,0,4,1,1,4,5,1,5,2,2,5,3,2,3,0];
  if(!top)for(let i=0;i<triangles.length;i+=3)[triangles[i+1],triangles[i+2]]=[triangles[i+2],triangles[i+1]];
  return keep(new api.Manifold(new api.Mesh({numProp:3,vertProperties:new Float32Array(positions),triVerts:new Uint32Array(triangles)})));
}

export function faceSection(api, outline, bore, setback, keep, segments=256) {
  let face=keep(new api.CrossSection([outline],'Positive'));
  if(bore>0)face=keep(face.subtract(keep(api.CrossSection.circle(bore/2,segments))));
  return setback?keep(face.offset(-setback,'Round',2,segments)):face;
}

export function applyChamfers(api, solid, outline, p, d, keep) {
  if(!p.chamferTop&&!p.chamferBottom)return solid;
  const q=QUALITY[p.quality]||QUALITY.standard,cuts=[];
  for(const top of [true,false]){
    const width=top?p.chamferTop:p.chamferBottom;
    if(!width)continue;
    const depth=top?d.topDepth:d.bottomDepth;
    if(faceSection(api,outline,d.bore,width,keep,q.circleSegments).isEmpty())throw new Error(`The ${top?'top':'bottom'} chamfer removes its entire flat face. Reduce its size.`);
    const coneSegments=Math.max(16,Math.ceil(Math.PI/Math.acos(Math.max(-1,1-q.tolerance/width))));
    for(let i=0;i<outline.length;i++){
      const a=outline[i],b=outline[(i+1)%outline.length],prev=outline[(i+outline.length-1)%outline.length];
      cuts.push(edgeWedge(api,a,b,width,depth,p.thickness,top,keep));
      const turn=(a[0]-prev[0])*(b[1]-a[1])-(a[1]-prev[1])*(b[0]-a[0]);
      if(turn< -1e-7)cuts.push(keep(api.Manifold.cylinder(depth,top?0:width,top?width:0,coneSegments).translate([a[0],a[1],top?p.thickness-depth:0])));
    }
    if(d.bore>0)cuts.push(keep(api.Manifold.cylinder(depth,top?d.bore/2:d.bore/2+width,top?d.bore/2+width:d.bore/2,q.circleSegments).translate([0,0,top?p.thickness-depth:0])));
  }
  const cut=keep(api.Manifold.union(cuts)),result=keep(solid.subtract(cut));
  if(result.status()!=='NoError'||result.isEmpty())throw new Error('The requested chamfer could not form a solid. Reduce its size or angle.');
  // Monotonic cuts leave the intact middle band connected. Remove only numeric
  // zero-volume flecks from coincident cutter edges, before adding any lettering.
  const parts=result.decompose().map(keep).sort((a,b)=>b.volume()-a.volume());
  if(parts.length>1){
    const residue=parts.slice(1).reduce((sum,part)=>sum+Math.abs(part.volume()),0);
    if(residue>Math.max(1e-5,solid.volume()*1e-7))throw new Error('The chamfer produced an unexpected detached region. Adjust its size or angle.');
  }
  return parts[0];
}
