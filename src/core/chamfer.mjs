import { QUALITY } from './geometry.mjs';

// Extend cutters outside the stock and past adjacent edges. Ending a cutter
// exactly on a stock wall leaves microscopic connected membranes after CSG;
// they are manifold but appear as tall flying triangles in external viewers.
// The extensions preserve the nominal sloping plane inside the stock.
function edgeWedge(api, a, b, width, depth, thickness, top, keep, margin) {
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
  const nx=-dy/length,ny=dx/length;
  const slope=depth/width,tipZ=top?thickness-depth-margin*slope:depth+margin*slope,faceZ=top?thickness+margin:-margin;
  const ax=a[0]-dx/length*margin-nx*margin,ay=a[1]-dy/length*margin-ny*margin;
  const bx=b[0]+dx/length*margin-nx*margin,by=b[1]+dy/length*margin-ny*margin;
  const cutWidth=width+margin+margin/slope;
  const positions=[
    ax,ay,tipZ, ax,ay,faceZ, ax+nx*cutWidth,ay+ny*cutWidth,faceZ,
    bx,by,tipZ, bx,by,faceZ, bx+nx*cutWidth,by+ny*cutWidth,faceZ,
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
  const margin=Math.max(1e-5,solid.tolerance()*16);
  for(const top of [true,false]){
    const width=top?p.chamferTop:p.chamferBottom;
    if(!width)continue;
    const depth=top?d.topDepth:d.bottomDepth;
    if(faceSection(api,outline,d.bore,width,keep,q.circleSegments).isEmpty())throw new Error(`The ${top?'top':'bottom'} chamfer removes its entire flat face. Reduce its size.`);
    const coneSegments=Math.max(16,Math.ceil(Math.PI/Math.acos(Math.max(-1,1-q.tolerance/width))));
    for(let i=0;i<outline.length;i++){
      const a=outline[i],b=outline[(i+1)%outline.length],prev=outline[(i+outline.length-1)%outline.length];
      cuts.push(edgeWedge(api,a,b,width,depth,p.thickness,top,keep,margin));
      const turn=(a[0]-prev[0])*(b[1]-a[1])-(a[1]-prev[1])*(b[0]-a[0]);
      const extendedWidth=width+margin*width/depth;
      if(turn< -1e-7)cuts.push(keep(api.Manifold.cylinder(depth+margin,top?0:extendedWidth,top?extendedWidth:0,coneSegments).translate([a[0],a[1],top?p.thickness-depth:-margin])));
    }
    if(d.bore>0){
      const inner=Math.max(0,d.bore/2-margin*width/depth),outer=d.bore/2+width+margin*width/depth;
      cuts.push(keep(api.Manifold.cylinder(depth+2*margin,top?inner:outer,top?outer:inner,q.circleSegments).translate([0,0,top?p.thickness-depth-margin:-margin])));
    }
  }
  const cut=keep(api.Manifold.union(cuts)),raw=keep(solid.subtract(cut));
  const cleanup=Math.max(raw.tolerance(),Math.min(margin/4,q.tolerance/100));
  const result=keep(raw.simplify(cleanup));
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
