import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,derive} from '../src/core/geometry.mjs';
import {createRollerPreview} from '../src/core/preview-rollers.mjs';

test('roller preview uses single shaded surfaces without competing line overlays',()=>{
  const group=createRollerPreview(DEFAULTS,0,'metal'),d=derive(DEFAULTS);
  try{
    assert.equal(group.children.length,DEFAULTS.rollerCount);
    for(const mesh of group.children){
      assert.equal(mesh.type,'Mesh');assert.equal(mesh.material.transparent,false);assert.equal(mesh.material.depthWrite,true);
      assert.ok(mesh.material.metalness>.9);assert.ok(mesh.material.roughness<.3);
      assert.ok(Math.abs(Math.hypot(mesh.position.x,mesh.position.y)-d.pitchRadius)<1e-9);
      assert.equal(mesh.children.length,0);
    }
  }finally{group.children[0].geometry.dispose();group.children[0].material.dispose();}
});

test('see-through rollers retain depth testing without writing transparent surfaces to depth',()=>{
  const clear=createRollerPreview(DEFAULTS,0,'clear'),off=createRollerPreview(DEFAULTS,0,'off');
  try{
    assert.equal(off.children.length,0);
    for(const mesh of clear.children){assert.equal(mesh.material.transparent,true);assert.equal(mesh.material.depthWrite,false);assert.equal(mesh.material.depthTest,true);assert.equal(mesh.material.forceSinglePass,true);assert.equal(mesh.castShadow,false);}
  }finally{clear.children[0].geometry.dispose();clear.children[0].material.dispose();}
});
