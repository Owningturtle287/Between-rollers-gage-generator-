import { zipSync, strToU8 } from 'fflate';
export const FORMATS = [
  {id:'3mf',label:'3MF',detail:'Recommended · explicit millimeter units',mime:'model/3mf'},
  {id:'stl',label:'STL',detail:'Binary mesh · import as millimeters',mime:'model/stl'},
  {id:'obj',label:'OBJ',detail:'Indexed mesh · import as millimeters',mime:'text/plain'},
  {id:'glb',label:'GLB',detail:'3D viewing · meters, Y up',mime:'model/gltf-binary'},
  {id:'ply',label:'PLY',detail:'ASCII mesh · millimeter coordinates',mime:'text/plain'},
];
const xml=s=>String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
const modelColor=p=>/^#[0-9a-f]{6}$/i.test(p?.color||'')?p.color:'#a9d5f0';
export const safeName=s=>(s||'roller-gage').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,72)||'roller-gage';

export function exportSTL(model){
  const {positions:p,indices:ix}=model;const buffer=new ArrayBuffer(84+ix.length/3*50),v=new DataView(buffer);
  new Uint8Array(buffer,0,80).set(new TextEncoder().encode('Gage Studio | mm | Z up'));
  v.setUint32(80,ix.length/3,true);let offset=84;
  for(let i=0;i<ix.length;i+=3){
    const a=ix[i]*3,b=ix[i+1]*3,c=ix[i+2]*3;
    const u=[p[b]-p[a],p[b+1]-p[a+1],p[b+2]-p[a+2]],w=[p[c]-p[a],p[c+1]-p[a+1],p[c+2]-p[a+2]];
    const n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],len=Math.hypot(...n)||1;
    for(const value of [...n.map(x=>x/len),...p.slice(a,a+3),...p.slice(b,b+3),...p.slice(c,c+3)]){v.setFloat32(offset,value,true);offset+=4;}
    v.setUint16(offset,0,true);offset+=2;
  }
  return new Uint8Array(buffer);
}
export function exportOBJ(model,name='roller-gage'){
  const {positions:p,indices:ix}=model;const lines=['# Gage Studio | millimeters | Z up',`o ${safeName(name)}`];
  for(let i=0;i<p.length;i+=3)lines.push(`v ${p[i]} ${p[i+1]} ${p[i+2]}`);
  for(let i=0;i<ix.length;i+=3)lines.push(`f ${ix[i]+1} ${ix[i+1]+1} ${ix[i+2]+1}`);
  return strToU8(lines.join('\n')+'\n');
}
export function exportPLY(model){
  const {positions:p,indices:ix}=model;const lines=['ply','format ascii 1.0','comment Gage Studio; millimeters; Z up',`element vertex ${p.length/3}`,'property float x','property float y','property float z',`element face ${ix.length/3}`,'property list uchar uint vertex_indices','end_header'];
  for(let i=0;i<p.length;i+=3)lines.push(`${p[i]} ${p[i+1]} ${p[i+2]}`);
  for(let i=0;i<ix.length;i+=3)lines.push(`3 ${ix[i]} ${ix[i+1]} ${ix[i+2]}`);
  return strToU8(lines.join('\n')+'\n');
}
export function export3MF(model,project){
  const {positions:p,indices:ix}=model;
  const vertices=[],triangles=[];
  for(let i=0;i<p.length;i+=3)vertices.push(`<vertex x="${p[i]}" y="${p[i+1]}" z="${p[i+2]}"/>`);
  for(let i=0;i<ix.length;i+=3)triangles.push(`<triangle v1="${ix[i]}" v2="${ix[i+1]}" v3="${ix[i+2]}"/>`);
  const modelXML=`<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Title">${xml(project.name)}</metadata><metadata name="Application">Between Rollers Gage Studio</metadata><metadata name="Description">One solid gage with integrated text and chamfers. Millimeter units. Z up.</metadata><resources><basematerials id="2"><base name="Gage color" displaycolor="${modelColor(project).toUpperCase()}"/></basematerials><object id="1" type="model" name="${xml(project.name)}" pid="2" pindex="0"><mesh><vertices>${vertices.join('')}</vertices><triangles>${triangles.join('')}</triangles></mesh></object></resources><build><item objectid="1"/></build></model>`;
  const types=`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="json" ContentType="application/json"/></Types>`;
  const relationships=`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`;
  return zipSync({'[Content_Types].xml':strToU8(types),'_rels/.rels':strToU8(relationships),'3D/3dmodel.model':strToU8(modelXML),'Metadata/gage-project.json':strToU8(JSON.stringify(project,null,2))},{level:6});
}
export function exportGLB(model,project){
  const positions=new Float32Array(model.positions.length);for(let i=0;i<positions.length;i++)positions[i]=model.positions[i]/1000;
  const indices=model.indices;
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<positions.length;i++){const c=i%3;min[c]=Math.min(min[c],positions[i]);max[c]=Math.max(max[c],positions[i]);}
  const bytes=positions.byteLength+indices.byteLength;
  const rgb=modelColor(project).slice(1).match(/../g).map(c=>{const s=parseInt(c,16)/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});
  const gltf={asset:{version:'2.0',generator:'Between Rollers Gage Studio'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,rotation:[-Math.SQRT1_2,0,0,Math.SQRT1_2]}],meshes:[{primitives:[{attributes:{POSITION:0},indices:1,material:0}]}],materials:[{pbrMetallicRoughness:{baseColorFactor:[...rgb,1],metallicFactor:.05,roughnessFactor:.55},doubleSided:false}],buffers:[{byteLength:bytes}],bufferViews:[{buffer:0,byteOffset:0,byteLength:positions.byteLength,target:34962},{buffer:0,byteOffset:positions.byteLength,byteLength:indices.byteLength,target:34963}],accessors:[{bufferView:0,componentType:5126,count:positions.length/3,type:'VEC3',min,max},{bufferView:1,componentType:5125,count:indices.length,type:'SCALAR'}]};
  const raw=strToU8(JSON.stringify(gltf)),jsonLen=Math.ceil(raw.length/4)*4;
  const buffer=new ArrayBuffer(12+8+jsonLen+8+bytes),view=new DataView(buffer),out=new Uint8Array(buffer);
  view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,buffer.byteLength,true);
  view.setUint32(12,jsonLen,true);view.setUint32(16,0x4e4f534a,true);out.fill(32,20,20+jsonLen);out.set(raw,20);
  const bin=20+jsonLen;view.setUint32(bin,bytes,true);view.setUint32(bin+4,0x004e4942,true);
  out.set(new Uint8Array(positions.buffer),bin+8);out.set(new Uint8Array(indices.buffer,indices.byteOffset,indices.byteLength),bin+8+positions.byteLength);
  return out;
}
export function exportModel(format,model,project){
  if(format==='3mf')return export3MF(model,project);
  if(format==='stl')return exportSTL(model);
  if(format==='obj')return exportOBJ(model,project.name);
  if(format==='glb')return exportGLB(model,project);
  if(format==='ply')return exportPLY(model);
  throw new Error('Unsupported export format.');
}
