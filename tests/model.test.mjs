import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Module from 'manifold-3d';
import opentype from 'opentype.js';
import { fromArrayBuffer } from 'manifold-3d/lib/import-3mf.js';
import { unzipSync, strFromU8 } from 'fflate';
import { DEFAULTS, derive, validate, baseMesh, importProject, localToWorld, signedArea, profile, legacyCageDiameter } from '../src/core/geometry.mjs';
import { buildSolid, compactMesh } from '../src/core/solid.mjs';
import { exportModel } from '../src/core/export.mjs';
import { toMillimeters, fromMillimeters } from '../src/core/units.mjs';
import { applyChamfers } from '../src/core/chamfer.mjs';

let api,font,base,lettered;
const params=(overrides={})=>({...structuredClone(DEFAULTS),texts:[],...overrides});
const near=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,`${a} differs from ${b}`);
function checkClosed(model){
  const counts=new Map();
  for(let i=0;i<model.indices.length;i+=3){const t=[...model.indices.slice(i,i+3)];assert.equal(new Set(t).size,3);
    for(let e=0;e<3;e++){const a=t[e],b=t[(e+1)%3],key=a<b?`${a},${b}`:`${b},${a}`,c=counts.get(key)||[0,0];c[0]++;c[1]+=a<b?1:-1;counts.set(key,c);}}
  for(const c of counts.values()){assert.equal(c[0],2,'every edge has two faces');assert.equal(c[1],0,'edge directions oppose');}
  assert.ok(model.volume>0);assert.equal(model.components,1);
}
before(async()=>{
  api=await Module();api.setup();
  const raw=await readFile(new URL('../node_modules/@fontsource/roboto/files/roboto-latin-400-normal.woff',import.meta.url));
  font=opentype.parse(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
  base=await buildSolid(api,params(),async()=>font);
  lettered=await buildSolid(api,structuredClone(DEFAULTS),async()=>font);
});

test('every flat midpoint is an exact tangent point in world space',()=>{
  const p=params(),d=derive(p);
  for(let i=0;i<p.rollerCount;i++)for(const sign of [-1,1]){
    const theta=Math.PI/2-i*Math.PI*2/p.rollerCount;
    const center=localToWorld(0,d.pitchRadius,theta);
    const a=localToWorld(sign*d.lower[0],d.lower[1],theta),b=localToWorld(sign*d.upper[0],d.upper[1],theta);
    const midpoint=a.map((v,j)=>(v+b[j])/2),normal=midpoint.map((v,j)=>v-center[j]),tangent=b.map((v,j)=>v-a[j]);
    near(Math.hypot(...normal),p.rollerDiameter/2);near(normal[0]*tangent[0]+normal[1]*tangent[1],0);near(Math.hypot(...tangent),d.flatLength);
  }
});
test('0.010 inch compensation changes the diameter by 0.010, never 0.020',()=>{
  const p=params(),d0=derive(p),d1=derive({...p,compensation:.010*25.4});
  near(d1.diameter-d0.diameter,.254);near(d1.pitchRadius-d0.pitchRadius,.127);near(d1.bore-d0.bore,.254);
  near(derive({...p,compensation:-.254}).diameter-d0.diameter,-.254);
  near(derive({...p,compensation:.254,compensateBore:false}).bore,d0.bore);
  near(2*(d1.tipRadius-d0.tipRadius),.254);
});
test('inch chamfer input is independent of millimeter mesh tolerance',async()=>{
  near(toMillimeters(.025,'in'),.635);near(fromMillimeters(.635,'in'),.025);
  const p=params({thickness:toMillimeters(.75,'in'),chamferTop:toMillimeters(.025,'in'),chamferBottom:toMillimeters(.025,'in')});
  near(fromMillimeters(derive(p).contactHeight,'in'),.7);
  const inch=await buildSolid(api,{...p,units:'in'},async()=>font),metric=await buildSolid(api,{...p,units:'mm'},async()=>font);
  checkClosed(inch);assert.deepEqual(inch.positions,metric.positions);assert.deepEqual(inch.indices,metric.indices);
});
test('old flat-length projects migrate to an identical cage envelope',()=>{
  const legacy={...params(),version:1,flatLength:5.08};delete legacy.cageDiameter;
  const migrated=importProject(legacy),d=derive(migrated);
  assert.equal(migrated.version,2);assert.equal('flatLength' in migrated,false);
  near(d.flatLength,5.08);near(migrated.cageDiameter,legacyCageDiameter(legacy));
  near(migrated.cageDiameter,DEFAULTS.cageDiameter);
});
test('chamfer angles match an independent square-prism volume calculation',()=>{
  const objects=[],keep=x=>{objects.push(x);return x;};
  try{
    const p=params({thickness:10,boreEnabled:false,chamferTop:1,chamferBottom:2,chamferTopAngle:30,chamferBottomAngle:60,quality:'fine'}),d=derive(p);
    const square=[[0,0],[20,0],[20,20],[0,20]],cube=keep(api.Manifold.cube([20,20,10]));
    const result=applyChamfers(api,cube,square,p,{...d,bore:0},keep);
    const removed=(w,depth)=>depth*(40*w-4*w*w/3);
    near(result.volume(),4000-removed(1,Math.tan(Math.PI/6))-removed(2,2*Math.tan(Math.PI/3)),.01);
    checkClosed({...compactMesh(result.getMesh()),volume:result.volume(),components:1});
  }finally{for(const o of [...new Set(objects)].reverse())o.delete();}
});
test('minimum, midpoint, and maximum select distinct rigid-gage targets',()=>{
  const p=params();near(derive({...p,targetPosition:0}).diameter,p.betweenMin);near(derive({...p,targetPosition:1}).diameter,p.betweenMax);near(derive({...p,targetPosition:.5}).diameter,(p.betweenMin+p.betweenMax)/2);
});
test('cage clearance diameter controls the exact outside envelope with centered tangency',()=>{
  const p=params();
  for(const width of [3,5,7])for(const cageDiameter of [108,110,112]){
    const d=derive({...p,gapWidth:width,cageDiameter});
    near(2*d.tipRadius,cageDiameter);near(2*Math.hypot(...d.upper),cageDiameter);
    near(d.lower[0],width/2);near(Math.hypot(d.contact[0],d.contact[1]-d.pitchRadius),p.rollerDiameter/2);
    near((d.lower[0]+d.upper[0])/2,d.contact[0]);near((d.lower[1]+d.upper[1])/2,d.contact[1]);
  }
});
test('default chamfered solid is watertight and connected',()=>checkClosed(base));
test('embossed circular lettering is integrated into the watertight part',()=>{checkClosed(lettered);assert.ok(lettered.volume>base.volume);assert.ok(lettered.triangles>base.triangles);});
test('extrusion volume agrees with independent cross-section area',async()=>{
  const p=params({boreEnabled:false,chamferTop:0,chamferBottom:0});const m=await buildSolid(api,p,async()=>font);checkClosed(m);near(m.volume,signedArea(profile(p))*p.thickness,.03);
});
test('independent top and bottom chamfers remove material without changing middle flats',async()=>{
  const sharp=await buildSolid(api,params({chamferTop:0,chamferBottom:0}),async()=>font);
  const top=await buildSolid(api,params({chamferTop:.7,chamferBottom:0}),async()=>font);
  const bottom=await buildSolid(api,params({chamferTop:0,chamferBottom:.3}),async()=>font);
  for(const m of [sharp,top,bottom])checkClosed(m);assert.ok(top.volume<bottom.volume);assert.ok(bottom.volume<sharp.volume);
  near(derive(params({chamferTop:.7,chamferBottom:.3})).contactHeight,DEFAULTS.thickness-1);
});
test('bore toggle, roller count, target, and negative compensation produce valid solids',async()=>{
  for(const extra of [{boreEnabled:false},{rollerCount:8},{rollerCount:24,chamferTop:.1,chamferBottom:.1},{targetPosition:0},{targetPosition:1},{compensation:-.254},{quality:'draft'},{quality:'fine'}])checkClosed(await buildSolid(api,params(extra),async()=>font));
});
test('linear multiline engraving removes material and keeps a single solid',async()=>{
  const t={...DEFAULTS.texts[0],text:'BRG\n12',layout:'linear',mode:'engrave',size:4,y:17};
  const m=await buildSolid(api,params({texts:[t]}),async()=>font);checkClosed(m);assert.ok(m.volume<base.volume);
});
test('bottom emboss is readable from below and places lowest geometry at Z=0',async()=>{
  const t={...DEFAULTS.texts[0],text:'BOTTOM',layout:'linear',face:'bottom',size:4,y:17};
  const m=await buildSolid(api,params({texts:[t]}),async()=>font);checkClosed(m);near(m.zOffset,t.depth,1e-5);
  let min=Infinity;for(let i=2;i<m.positions.length;i+=3)min=Math.min(min,m.positions[i]);near(min,0,1e-5);
});
test('out-of-bounds text is rejected instead of exporting floating pieces',async()=>{
  await assert.rejects(buildSolid(api,params({texts:[{...DEFAULTS.texts[0],x:200}]}),async()=>font),/crosses/);
});
test('missing glyphs are reported instead of silently replacing lettering',async()=>{
  await assert.rejects(buildSolid(api,params({texts:[{...DEFAULTS.texts[0],text:'漢'}]}),async()=>font),/no .* glyph/);
});
test('impossible dimensions are rejected before creating a mesh',()=>{
  for(const extra of [{rollerCount:0},{rollerCount:12.5},{betweenMax:1},{rollerDiameter:-1},{gapWidth:15},{gapLength:100},{boreDiameter:100},{chamferTop:5,chamferBottom:5},{compensation:-200},{compensation:1e100}]){
    const p=params(extra);assert.ok(validate(p).length);assert.throws(()=>baseMesh(p));
  }
});
test('formerly intersecting chamfers resolve at fine and ultra quality',async()=>{
  for(const quality of ['fine','ultra'])checkClosed(await buildSolid(api,params({rollerCount:24,thickness:19.05,chamferTop:.635,chamferBottom:.635,quality}),async()=>font));
});
test('project round-trip retains exact physical dimensions when switching units',()=>{
  const p=params({units:'mm'}),next=importProject(JSON.parse(JSON.stringify(p)));
  near(derive(next).diameter,derive(p).diameter);assert.equal(next.units,'mm');
  assert.throws(()=>importProject({...p,version:3}));assert.throws(()=>importProject({...p,units:'cm'}));assert.throws(()=>importProject({...p,texts:[{...DEFAULTS.texts[0],face:'side'}]}));
});
test('3MF is a valid OPC package with millimeter units and all final triangles',()=>{
  const bytes=exportModel('3mf',lettered,DEFAULTS),files=unzipSync(bytes);
  assert.ok(files['[Content_Types].xml']);assert.ok(files['_rels/.rels']);assert.ok(files['Metadata/gage-project.json']);
  const xml=strFromU8(files['3D/3dmodel.model']);assert.match(xml,/unit="millimeter"/);assert.match(xml,/core\/2015\/02/);assert.match(xml,/displaycolor="#A9D5F0"/);
  assert.equal((xml.match(/<triangle /g)||[]).length,lettered.indices.length/3);assert.equal((xml.match(/<vertex /g)||[]).length,lettered.positions.length/3);
  assert.equal(JSON.parse(strFromU8(files['Metadata/gage-project.json'])).rollerCount,DEFAULTS.rollerCount);
});
test('3MF reopens with an independent importer and retains triangle count',async()=>{
  const bytes=exportModel('3mf',lettered,DEFAULTS);
  const document=await fromArrayBuffer(new Uint8Array(bytes).buffer);
  const primitives=document.getRoot().listMeshes().flatMap(m=>m.listPrimitives());
  assert.equal(primitives.reduce((n,p)=>n+(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3,0),lettered.triangles);
});
test('STL binary layout and triangle count are correct',()=>{
  const bytes=exportModel('stl',lettered,DEFAULTS),v=new DataView(bytes.buffer);assert.equal(v.getUint32(80,true),lettered.triangles);assert.equal(bytes.length,84+50*lettered.triangles);
});
test('OBJ and PLY include all vertices and faces',()=>{
  const obj=strFromU8(exportModel('obj',lettered,DEFAULTS)),ply=strFromU8(exportModel('ply',lettered,DEFAULTS));
  assert.equal((obj.match(/^v /gm)||[]).length,lettered.positions.length/3);assert.equal((obj.match(/^f /gm)||[]).length,lettered.triangles);
  assert.match(ply,new RegExp(`element face ${lettered.triangles}\\n`));assert.match(ply,/millimeters/);
});
test('GLB has valid chunks, explicit axis transform, and meter coordinates',()=>{
  const bytes=exportModel('glb',lettered,DEFAULTS),v=new DataView(bytes.buffer);assert.equal(v.getUint32(0,true),0x46546c67);assert.equal(v.getUint32(4,true),2);assert.equal(v.getUint32(8,true),bytes.length);
  const len=v.getUint32(12,true),json=JSON.parse(strFromU8(bytes.slice(20,20+len))),bin=20+len+8;
  assert.equal(json.accessors[1].count,lettered.indices.length);assert.equal(json.nodes[0].rotation.length,4);
  near(v.getFloat32(bin,true),lettered.positions[0]/1000,1e-8);assert.equal((bin+json.buffers[0].byteLength),bytes.length);
});
