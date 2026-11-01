import { CylinderGeometry, FrontSide, Group, Mesh, MeshStandardMaterial } from 'three';
import { derive, localToWorld } from './geometry.mjs';

/** One surface per roller. Coplanar edge overlays are deliberately absent. */
export function createRollerPreview(project,zOffset,mode){
  const group=new Group();
  if(mode==='off')return group;
  const d=derive(project),clear=mode==='clear';
  const geometry=new CylinderGeometry(d.rollerRadius,d.rollerRadius,project.thickness*1.2,64,1);
  geometry.rotateX(Math.PI/2);
  const material=new MeshStandardMaterial({
    color:clear?'#78a5bb':'#c6d0da',metalness:clear?.08:.95,roughness:clear?.4:.2,envMapIntensity:clear?.85:1.3,
    transparent:clear,opacity:clear?.38:1,depthWrite:!clear,depthTest:true,side:FrontSide,
  });
  material.forceSinglePass=true;
  for(let i=0;i<project.rollerCount;i++){
    const angle=Math.PI/2-i*2*Math.PI/project.rollerCount,[x,y]=localToWorld(0,d.pitchRadius,angle);
    const roller=new Mesh(geometry,material);roller.name=`Roller ${i+1}`;
    roller.position.set(x,y,zOffset+project.thickness/2);
    roller.castShadow=!clear;roller.receiveShadow=false;
    roller.renderOrder=clear?2:0;
    group.add(roller);
  }
  return group;
}
