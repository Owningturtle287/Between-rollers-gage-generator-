import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Raycaster} from 'three';
import {DEFAULTS,derive} from '../src/core/geometry.mjs';
import {createPreviewGround} from '../src/core/preview-ground.mjs';
import {createRollerPreview} from '../src/core/preview-rollers.mjs';
import {convexHull2D,previewDepthRange,previewLayout} from '../src/core/preview-layout.mjs';

test('the shadow receiver and grid never cut into roller bottoms, including thick gages',()=>{
  for(const thickness of [1,6.35,19.05,1000])for(const zOffset of [0,2,50]){
    const p={...DEFAULTS,thickness},layout=previewLayout(p,zOffset),ground=createPreviewGround(),rollers=createRollerPreview(p,zOffset,'clear');
    try{
      ground.update(layout);ground.floor.updateMatrixWorld(true);rollers.updateMatrixWorld(true);
      const box=rollers.children[0].geometry;box.computeBoundingBox();
      const bottom=box.boundingBox.min.z+rollers.children[0].position.z;
      assert.ok(ground.floor.position.z<Math.min(0,bottom)-.09);
      assert.equal(ground.grid.position.z,ground.floor.position.z);
      const x=rollers.children[0].position.x,y=rollers.children[0].position.y;
      const origin=new Vector3(x,y,bottom+thickness+20),ray=new Raycaster(origin,new Vector3(0,0,-1));
      const hit=ray.intersectObject(ground.floor)[0];assert.ok(hit);
      assert.ok(hit.distance>origin.z-bottom,'the entire roller is above the ground intersection');
    }finally{ground.dispose();rollers.children[0].geometry.dispose();rollers.children[0].material.dispose();}
  }
});

test('transparent background passes cannot write depth that hides a ghost roller',()=>{
  const ground=createPreviewGround(),rollers=createRollerPreview(DEFAULTS,0,'clear');
  try{
    for(const mesh of [ground.floor,ground.grid]){
      assert.equal(mesh.material.transparent,true);assert.equal(mesh.material.depthWrite,false);assert.equal(mesh.material.depthTest,true);
      assert.ok(mesh.renderOrder<rollers.children[0].renderOrder);
    }
    assert.equal(ground.grid.isMesh,true,'grid is filtered as a surface instead of thin hardware lines');
  }finally{ground.dispose();rollers.children[0].geometry.dispose();rollers.children[0].material.dispose();}
});

test('adaptive clipping improves depth resolution while containing all visible part geometry',()=>{
  const p=DEFAULTS,d=derive(p),layout=previewLayout(p),distance=layout.radius*3.8;
  const old={near:d.tipRadius/1000,far:d.tipRadius*100+100},range=previewDepthRange(distance,layout.radius);
  const depthStep=({near,far})=>distance**2*(far-near)/(far*near*(2**24-1));
  assert.ok(depthStep(range)<depthStep(old)/1000);
  for(const factor of [.1,1,1.5,3.8,20]){
    const distance=layout.radius*factor,{near,far}=previewDepthRange(distance,layout.radius);
    assert.ok(near>0&&far>near);assert.ok(near<Math.max(.01,distance-layout.radius));assert.ok(far>distance+layout.radius);
  }
  const tall=previewLayout(p,0,new Float32Array([0,0,400,50,0,0]));
  assert.ok(tall.radius>=400-p.thickness/2,'raised lettering also stays inside the clipping bounds');
});

test('single-pass ghost silhouettes match cylinder projections through edge-on views',()=>{
  const r=6.35,h=7.62,n=64;
  for(const pitch of [-Math.PI/2,-1,-.01,0,.01,1,Math.PI/2]){
    const sp=Math.sin(pitch),cp=Math.cos(pitch);
    const rings=[-h/2,h/2].flatMap(z=>Array.from({length:n},(_,i)=>{const a=i*2*Math.PI/n;return [r*Math.cos(a),r*Math.sin(a)*sp+z*cp];}));
    const hull=convexHull2D(rings);
    const area=Math.abs(hull.reduce((sum,p,i)=>{const q=hull[(i+1)%hull.length];return sum+p[0]*q[1]-q[0]*p[1];},0))/2;
    const expected=Math.PI*r*r*Math.abs(sp)+2*r*h*Math.abs(cp);
    assert.ok(Math.abs(area-expected)<expected*.002,'the silhouette stays continuous as the visible cap changes');
  }
});
