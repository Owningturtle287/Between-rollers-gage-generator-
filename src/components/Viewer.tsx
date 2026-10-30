import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Model, Project, ViewSettings } from '../types';
import { derive, localToWorld } from '../core/geometry.mjs';
import { SoftwareViewer } from './SoftwareViewer';

type SceneState={scene:THREE.Scene;camera:THREE.PerspectiveCamera;renderer:THREE.WebGLRenderer;controls:OrbitControls;part:THREE.Group;helpers:THREE.Group;grid:THREE.GridHelper;light:THREE.DirectionalLight;frame:()=>void;zoom:(factor:number)=>void;};
const disposeGroup=(group:THREE.Group)=>{group.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.geometry)mesh.geometry.dispose();if(mesh.material)for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])m.dispose();});group.clear();};
export function Viewer({model,project,settings,zoomCommand}:{model:Model|null;project:Project;settings:ViewSettings;zoomCommand:{id:number;factor:number}}){
  const root=useRef<HTMLDivElement>(null),state=useRef<SceneState|null>(null),first=useRef(true),lastSize=useRef(0);
  const projectRef=useRef(project);projectRef.current=project;
  const [error,setError]=useState('');
  useEffect(()=>{
    const el=root.current!;let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch{setError('3D viewing needs WebGL. Enable graphics acceleration or try a current browser. The model controls and exports remain available.');return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
    renderer.domElement.setAttribute('aria-label','Interactive gage model. Drag to orbit, use two fingers or right-drag to pan, and pinch or scroll to zoom.');
    renderer.domElement.setAttribute('role','img');renderer.domElement.tabIndex=0;el.appendChild(renderer.domElement);
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.1,100000);camera.up.set(0,0,1);
    camera.position.set(125,-160,155);
    const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.12;controls.minDistance=8;controls.maxDistance=50000;controls.target.set(0,0,3);
    const env=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(env,.04);scene.environment=environment.texture;env.dispose();pmrem.dispose();
    const key=new THREE.DirectionalLight('#fff6dc',3.2);key.position.set(-80,-100,180);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.bias=-.0004;key.shadow.normalBias=.05;scene.add(key);
    const fill=new THREE.DirectionalLight('#c4dfed',1.6);fill.position.set(100,80,100);scene.add(fill);
    scene.add(new THREE.AmbientLight('#ffffff',.6));
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(50000,50000),new THREE.ShadowMaterial({color:'#244b48',opacity:.13}));floor.position.z=-.05;floor.receiveShadow=true;scene.add(floor);
    const part=new THREE.Group(),helpers=new THREE.Group();scene.add(part,helpers);
    const grid=new THREE.GridHelper(1000,100,'#9eafa8','#cbd5d0');grid.rotation.x=Math.PI/2;grid.position.z=-.02;(grid.material as THREE.Material).transparent=true;(grid.material as THREE.Material).opacity=.32;scene.add(grid);
    const frame=()=>{
      const d=derive(projectRef.current),radius=d.tipRadius||60;
      controls.target.set(0,0,projectRef.current.thickness/2);const distance=radius*3.8;
      const direction=camera.position.clone().sub(controls.target).normalize();if(!Number.isFinite(direction.x)||direction.lengthSq()<.1)direction.set(.7,-1,.85).normalize();
      camera.position.copy(controls.target).addScaledVector(direction,distance);camera.near=Math.max(.01,radius/1000);camera.far=radius*100+100;camera.updateProjectionMatrix();controls.update();
      key.shadow.camera.left=key.shadow.camera.bottom=-radius*1.6;key.shadow.camera.right=key.shadow.camera.top=radius*1.6;key.shadow.camera.far=radius*12+200;key.shadow.camera.updateProjectionMatrix();
      key.position.set(-radius*1.5,-radius*1.8,radius*3.5);key.target.position.set(0,0,0);key.shadow.needsUpdate=true;
    };
    state.current={scene,camera,renderer,controls,part,helpers,grid,light:key,frame,zoom:(factor)=>{camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);controls.update();}};
    const resize=new ResizeObserver(()=>{const {width,height}=el.getBoundingClientRect();if(width&&height){renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();}});resize.observe(el);
    let raf=0;const render=()=>{raf=requestAnimationFrame(render);if(!document.hidden){controls.update();renderer.render(scene,camera);}};render();
    const lost=(e:Event)=>{e.preventDefault();setError('Graphics context paused. Reload the page to restore the 3D view; your settings are saved on this device.');};renderer.domElement.addEventListener('webglcontextlost',lost);
    return()=>{cancelAnimationFrame(raf);resize.disconnect();controls.dispose();disposeGroup(part);disposeGroup(helpers);floor.geometry.dispose();(floor.material as THREE.Material).dispose();grid.geometry.dispose();(grid.material as THREE.Material).dispose();environment.dispose();renderer.dispose();el.replaceChildren();state.current=null;};
  },[]);
  useEffect(()=>{
    const s=state.current;if(!s||!model)return;disposeGroup(s.part);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(model.positions,3));geometry.setIndex(new THREE.BufferAttribute(model.indices,1));
    // Split for crisp planar faces rather than smoothing across contact edges.
    const flat=geometry.toNonIndexed();flat.computeVertexNormals();geometry.dispose();
    const material=new THREE.MeshStandardMaterial({color:settings.material,roughness:.54,metalness:.06,wireframe:settings.wireframe});
    const mesh=new THREE.Mesh(flat,material);mesh.castShadow=true;mesh.receiveShadow=true;s.part.add(mesh);
    if(first.current||derive(project).tipRadius>lastSize.current*2||derive(project).tipRadius<lastSize.current/2){s.frame();first.current=false;}lastSize.current=derive(project).tipRadius;
  },[model,settings.material,settings.wireframe]);
  useEffect(()=>{
    const s=state.current;if(!s||!model)return;disposeGroup(s.helpers);s.grid.visible=settings.grid;
    const d=derive(project),z=(model.zOffset||0),h=project.thickness;
    if(settings.rollers){
      for(let i=0;i<project.rollerCount;i++){
        const a=Math.PI/2-i*2*Math.PI/project.rollerCount,[x,y]=localToWorld(0,d.pitchRadius,a);
        const geo=new THREE.CylinderGeometry(d.rollerRadius,d.rollerRadius,h*1.2,48,1);geo.rotateX(Math.PI/2);
        const roller=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:'#759d9b',transparent:true,opacity:.22,metalness:.3,roughness:.35,depthWrite:false}));roller.position.set(x,y,z+h/2);s.helpers.add(roller);
        const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geo,20),new THREE.LineBasicMaterial({color:'#628c8b',transparent:true,opacity:.4}));edges.position.copy(roller.position);s.helpers.add(edges);
        for(const sign of [-1,1]){
          const pts=[d.lower,d.upper].map(([xx,yy])=>{const [wx,wy]=localToWorld(sign*xx,yy,a);return new THREE.Vector3(wx,wy,z+h-project.chamferTop+.02);});
          const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:'#0e8b7c'}));s.helpers.add(line);
        }
      }
    }
    if(settings.dimensions){
      const vertices=Array.from({length:129},(_,i)=>{const a=i*Math.PI*2/128;return new THREE.Vector3(d.diameter/2*Math.cos(a),d.diameter/2*Math.sin(a),z+h+.3);});
      const circle=new THREE.Line(new THREE.BufferGeometry().setFromPoints(vertices),new THREE.LineDashedMaterial({color:'#b6783c',dashSize:1.5,gapSize:1,opacity:.6,transparent:true}));circle.computeLineDistances();s.helpers.add(circle);
      const points=[new THREE.Vector3(0,-d.diameter/2,z+h+.3),new THREE.Vector3(0,d.diameter/2,z+h+.3)];
      s.helpers.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#b6783c',opacity:.7,transparent:true})));
      for(const sign of [-1,1])s.helpers.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.7,sign*d.diameter/2,z+h+.3),new THREE.Vector3(1.7,sign*d.diameter/2,z+h+.3)]),new THREE.LineBasicMaterial({color:'#b6783c'})));
    }
  },[model,settings.rollers,settings.dimensions,settings.grid]);
  useEffect(()=>{
    const s=state.current;if(!s)return;const radius=derive(projectRef.current).tipRadius||60,z=projectRef.current.thickness/2;
    const directions={iso:new THREE.Vector3(.8,-1.25,1.15),top:new THREE.Vector3(0,-.0001,1),bottom:new THREE.Vector3(0,.0001,-1),front:new THREE.Vector3(0,-1,.0001)};
    s.controls.target.set(0,0,z);s.camera.position.copy(s.controls.target).addScaledVector(directions[settings.view].normalize(),radius*3.8);s.controls.update();
  },[settings.view,settings.reset]);
  useEffect(()=>{if(zoomCommand.id)state.current?.zoom(zoomCommand.factor);},[zoomCommand]);
  return <div ref={root} className="three-canvas">{error&&<SoftwareViewer model={model} project={project} settings={settings} zoomCommand={zoomCommand}/>}</div>;
}
