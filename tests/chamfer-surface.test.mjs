import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import Module from 'manifold-3d';
import {unzipSync,strFromU8} from 'fflate';
import {DEFAULTS,QUALITY,derive,profile} from '../src/core/geometry.mjs';
import {buildSolid} from '../src/core/solid.mjs';
import {exportModel} from '../src/core/export.mjs';
let api;before(async()=>{api=await Module();api.setup();});

/** Independent distance-to-boundary oracle: no cutter or Boolean code is used. */
function surfaceError(positions,indices,p){
  const poly=profile(p),d=derive(p);
  const edges=poly.map((a,i)=>{const b=poly[(i+1)%poly.length],dx=b[0]-a[0],dy=b[1]-a[1];return {x:a[0],y:a[1],dx,dy,inv:1/(dx*dx+dy*dy)};});
  const top=p.chamferTopAngle*Math.PI/180,bottom=p.chamferBottomAngle*Math.PI/180;
  let worst=0;
  const check=(x,y,z)=>{
    let squared=Infinity;
    for(const e of edges){const xx=x-e.x,yy=y-e.y,t=Math.max(0,Math.min(1,(xx*e.dx+yy*e.dy)*e.inv));squared=Math.min(squared,(xx-t*e.dx)**2+(yy-t*e.dy)**2);}
    let distance=Math.sqrt(squared);if(d.bore)distance=Math.min(distance,Math.hypot(x,y)-d.bore/2);
    const upper=Math.min(p.thickness,p.thickness-d.topDepth+distance*Math.tan(top));
    const lower=Math.max(0,d.bottomDepth-distance*Math.tan(bottom));
    worst=Math.max(worst,(z-upper)*Math.cos(top),(lower-z)*Math.cos(bottom));
  };
  for(let i=0;i<positions.length;i+=3)check(positions[i],positions[i+1],positions[i+2]);
  for(let i=0;i<indices.length;i+=3){const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;check((positions[a]+positions[b]+positions[c])/3,(positions[a+1]+positions[b+1]+positions[c+1])/3,(positions[a+2]+positions[b+2]+positions[c+2])/3);}
  return worst;
}
function read3MF(bytes){
  const xml=strFromU8(unzipSync(bytes)['3D/3dmodel.model']);
  return {positions:Float64Array.from([...xml.matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"\/>/g)].flatMap(m=>m.slice(1).map(Number))),indices:Uint32Array.from([...xml.matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"\/>/g)].flatMap(m=>m.slice(1).map(Number)))};
}
for(const quality of Object.keys(QUALITY))test(`3MF chamfers have no outlying flaps at ${quality} resolution`,async()=>{
  const p={...structuredClone(DEFAULTS),texts:[],rollerCount:24,thickness:19.05,chamferTop:.635,chamferBottom:.635,quality};
  const m=await buildSolid(api,p,()=>null),roundtrip=read3MF(exportModel('3mf',m,p));
  assert.equal(m.components,1);assert.equal(roundtrip.indices.length,m.indices.length);
  const error=surfaceError(roundtrip.positions,roundtrip.indices,p);
  assert.ok(error<QUALITY[quality].tolerance+.0003,`surface error ${error} mm exceeds curve tolerance; potential flying chamfer membrane`);
});
test('unequal chamfer angles preserve the intended surface envelope',async()=>{
  const p={...structuredClone(DEFAULTS),texts:[],rollerCount:12,thickness:19.05,chamferTop:.635,chamferBottom:.381,chamferTopAngle:30,chamferBottomAngle:60,quality:'fine'};
  const m=await buildSolid(api,p,()=>null);
  assert.ok(surfaceError(m.positions,m.indices,p)<QUALITY.fine.tolerance+.0003);
});
