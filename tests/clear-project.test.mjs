import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,baseMesh,importProject,validate} from '../src/core/geometry.mjs';
import {clearProject,isBlankProject} from '../src/core/clear-project.mjs';

test('Clear all zeroes numeric settings across geometry, print, and lettering without changing units or color',()=>{
  const project={...structuredClone(DEFAULTS),name:'My custom gage',units:'mm',color:'#d391aa',compensation:.254,
    texts:[...structuredClone(DEFAULTS.texts),{...structuredClone(DEFAULTS.texts[0]),id:'second',text:'SECOND',x:9}]};
  const before=structuredClone(project),cleared=clearProject(project);
  assert.deepEqual(project,before,'the original remains available to Undo');
  for(const [key,value] of Object.entries(DEFAULTS)){
    if(typeof value==='number'&&key!=='version')assert.equal(cleared[key],0,key);
    if(typeof value==='boolean')assert.equal(cleared[key],false,key);
  }
  assert.equal(cleared.name,project.name);assert.equal(cleared.units,'mm');assert.equal(cleared.color,'#d391aa');assert.equal(cleared.version,3);
  assert.equal(cleared.texts.length,1);assert.equal(cleared.texts[0].text,'');
  for(const [key,value] of Object.entries(DEFAULTS.texts[0])){
    if(typeof value==='number')assert.equal(cleared.texts[0][key],0,key);
    if(typeof value==='boolean')assert.equal(cleared.texts[0][key],false,key);
  }
  assert.equal(isBlankProject(cleared),true);assert.ok(validate(cleared).length);assert.throws(()=>baseMesh(cleared));
});

test('a cleared draft survives saving and reopening but cannot be mistaken for a printable gage',()=>{
  const cleared=clearProject(DEFAULTS),serialized=JSON.parse(JSON.stringify(cleared));
  const restored=importProject(serialized,{allowIncomplete:true});
  assert.equal(isBlankProject(restored),true);assert.equal(restored.texts[0].enabled,false);assert.equal(restored.chamferTopAngle,0);
  assert.ok(validate(restored).length);assert.throws(()=>importProject(serialized));assert.throws(()=>baseMesh(restored));
});

test('entering the necessary dimensions recovers a sharp-edged gage without entering unused chamfer angles',()=>{
  const recovered=clearProject(DEFAULTS);
  for(const key of ['rollerCount','rollerDiameter','betweenMin','betweenMax','thickness','gapWidth','gapLength','cageDiameter'])recovered[key]=DEFAULTS[key];
  assert.equal(isBlankProject(recovered),false);assert.deepEqual(validate(recovered),[]);
  const mesh=baseMesh(recovered);assert.ok(mesh.positions.length>0);assert.ok(mesh.indices.length>0);
  const withChamfer={...recovered,chamferTop:.5};assert.ok(validate(withChamfer).some(s=>s.includes('angle')));
  assert.deepEqual(validate({...withChamfer,chamferTopAngle:45}),[]);
});

test('draft loading retains incomplete dimensions while rejecting malformed values',()=>{
  const p={...structuredClone(DEFAULTS),rollerCount:0};assert.equal(importProject(p,{allowIncomplete:true}).rollerCount,0);
  for(const bad of [{rollerDiameter:null},{thickness:'0'},{color:'bad'},{boreEnabled:1},{texts:[{...DEFAULTS.texts[0],size:null}]}])assert.throws(()=>importProject({...p,...bad},{allowIncomplete:true}));
  assert.deepEqual(clearProject(clearProject(DEFAULTS)),clearProject(DEFAULTS));
});
