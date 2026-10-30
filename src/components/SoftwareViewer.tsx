import { useEffect, useRef } from 'react';
import type { Model, Project, ViewSettings } from '../types';
import { derive, localToWorld } from '../core/geometry.mjs';

/** Canvas painter fallback. Uses the actual solid mesh, never a placeholder. */
export function SoftwareViewer({model,project,settings,zoomCommand}:{model:Model|null;project:Project;settings:ViewSettings;zoomCommand:{id:number;factor:number}}){
  const canvas=useRef<HTMLCanvasElement>(null),data=useRef({model,project,settings});
  const pose=useRef({yaw:.55,pitch:.83,zoom:1,panX:0,panY:0});
  const redraw=useRef<()=>void>(()=>{});
  data.current={model,project,settings};
  useEffect(()=>{
    const el=canvas.current!,ctx=el.getContext('2d');if(!ctx)return;
    let raf=0;const pointers=new Map<number,{x:number;y:number}>();
    const draw=()=>{
      raf=0;const {model,project:p,settings:s}=data.current;if(!model)return;
      const {width,height}=el.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,2);
      if(el.width!==Math.round(width*ratio)||el.height!==Math.round(height*ratio)){el.width=Math.round(width*ratio);el.height=Math.round(height*ratio);}
      ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
      const d=derive(p),v=pose.current,scale=Math.min(width*.41,height*.37)/(d.pitchRadius+d.rollerRadius)*v.zoom;
      const cx=width*.52+v.panX,cy=height*.52+v.panY;
      const cs=Math.cos(v.yaw),sn=Math.sin(v.yaw),cp=Math.cos(v.pitch),sp=Math.sin(v.pitch);
      const project=(x:number,y:number,z:number)=>{
        const xx=x*cs-y*sn,yy=x*sn+y*cs,zz=z-p.thickness/2-model.zOffset;
        return [cx+xx*scale,cy-(yy*sp+zz*cp)*scale,-yy*cp+zz*sp];
      };
      // A soft grounding shadow gives shape and thickness a stable reference.
      const ground=project(0,0,0),rx=d.tipRadius*scale,ry=Math.max(.05,Math.abs(sp))*rx;
      ctx.save();ctx.translate(ground[0],ground[1]+8);ctx.scale(1,Math.max(.13,ry/rx));
      const shadow=ctx.createRadialGradient(0,0,rx*.35,0,0,rx*1.16);shadow.addColorStop(0,'#274d3a19');shadow.addColorStop(.65,'#274d3a0b');shadow.addColorStop(1,'#274d3a00');ctx.fillStyle=shadow;ctx.fillRect(-rx*1.2,-rx*1.2,rx*2.4,rx*2.4);ctx.restore();
      if(s.grid){
        ctx.strokeStyle='#a8bba125';ctx.lineWidth=.65;
        const step=Math.pow(10,Math.floor(Math.log10(d.tipRadius)))/2,extent=d.tipRadius*1.65;
        for(let x=-Math.ceil(extent/step)*step;x<=extent;x+=step){for(const vertical of [false,true]){const a=vertical?project(x,-extent,-.1):project(-extent,x,-.1),b=vertical?project(x,extent,-.1):project(extent,x,-.1);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();}}
      }
      const pos=model.positions,ix=model.indices,points=new Float32Array(pos.length);
      for(let i=0;i<pos.length;i+=3)points.set(project(pos[i],pos[i+1],pos[i+2]),i);
      const faces:{a:number;b:number;c:number;depth:number;shade:number}[]=[];
      for(let i=0;i<ix.length;i+=3){
        const a=ix[i]*3,b=ix[i+1]*3,c=ix[i+2]*3;
        const area=(points[b]-points[a])*(points[c+1]-points[a+1])-(points[b+1]-points[a+1])*(points[c]-points[a]);
        if(area>=-.0001&&!s.wireframe)continue;
        const ux=pos[b]-pos[a],uy=pos[b+1]-pos[a+1],uz=pos[b+2]-pos[a+2],vx=pos[c]-pos[a],vy=pos[c+1]-pos[a+1],vz=pos[c+2]-pos[a+2];
        const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,len=Math.hypot(nx,ny,nz)||1;
        const shade=.62+.35*Math.max(0,(-.35*nx-.25*ny+.902*nz)/len);
        faces.push({a,b,c,depth:(points[a+2]+points[b+2]+points[c+2])/3,shade});
      }
      faces.sort((a,b)=>a.depth-b.depth);
      const color=s.material.replace('#',''),rgb=[parseInt(color.slice(0,2),16),parseInt(color.slice(2,4),16),parseInt(color.slice(4,6),16)];
      ctx.lineJoin='round';
      for(const {a,b,c,shade}of faces){
        ctx.beginPath();ctx.moveTo(points[a],points[a+1]);ctx.lineTo(points[b],points[b+1]);ctx.lineTo(points[c],points[c+1]);ctx.closePath();
        if(s.wireframe){ctx.strokeStyle='#52776858';ctx.lineWidth=.45;ctx.stroke();}
        else{ctx.fillStyle=`rgb(${rgb.map(x=>Math.round(x*shade)).join(',')})`;ctx.fill();ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=.35;ctx.stroke();}
      }
      const polyline=(pts:number[][],stroke:string,lineWidth=1,fill?:string)=>{
        ctx.beginPath();for(let i=0;i<pts.length;i++){const point=project(pts[i][0],pts[i][1],pts[i][2]);if(i===0)ctx.moveTo(point[0],point[1]);else ctx.lineTo(point[0],point[1]);}if(fill){ctx.fillStyle=fill;ctx.fill();}ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.stroke();
      };
      if(s.rollers){for(let i=0;i<p.rollerCount;i++){
        const angle=Math.PI/2-i*Math.PI*2/p.rollerCount,[x,y]=localToWorld(0,d.pitchRadius,angle);
        for(const z of [model.zOffset,model.zOffset+p.thickness*1.15])polyline(Array.from({length:49},(_,k)=>{const a=k*Math.PI*2/48;return [x+d.rollerRadius*Math.cos(a),y+d.rollerRadius*Math.sin(a),z];}),'#648b835b',.8,'#6a9c8e0b');
        for(const k of [0,12,24,36]){const a=k*Math.PI*2/48,xx=x+d.rollerRadius*Math.cos(a),yy=y+d.rollerRadius*Math.sin(a);polyline([[xx,yy,model.zOffset],[xx,yy,model.zOffset+p.thickness*1.15]],'#648b8329',.7);}
        for(const sign of [-1,1])polyline([d.lower,d.upper].map(([xx,yy])=>[...localToWorld(sign*xx,yy,angle),model.zOffset+p.thickness-p.chamferTop]),'#218573a0',1.3);
      }}
      if(s.dimensions){ctx.setLineDash([4,4]);polyline(Array.from({length:129},(_,i)=>{const a=i*Math.PI*2/128;return [d.diameter/2*Math.cos(a),d.diameter/2*Math.sin(a),model.zOffset+p.thickness+.2];}),'#b7844c9f',1);ctx.setLineDash([]);polyline([[0,-d.diameter/2,model.zOffset+p.thickness+.2],[0,d.diameter/2,model.zOffset+p.thickness+.2]],'#b7844c9f',1);}
    };
    const request=()=>{if(!raf)raf=requestAnimationFrame(draw);};redraw.current=request;
    const resize=new ResizeObserver(request);resize.observe(el);
    const down=(e:PointerEvent)=>{el.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});};
    const move=(e:PointerEvent)=>{
      const old=pointers.get(e.pointerId);if(!old)return;
      const next={x:e.clientX,y:e.clientY},v=pose.current;
      if(pointers.size===2){const other=[...pointers.entries()].find(([id])=>id!==e.pointerId)![1],before=Math.hypot(old.x-other.x,old.y-other.y),after=Math.hypot(next.x-other.x,next.y-other.y);if(before>1)v.zoom*=after/before;v.panX+=(next.x-old.x)/2;v.panY+=(next.y-old.y)/2;}
      else if(e.button===2||e.buttons===2||e.shiftKey){v.panX+=next.x-old.x;v.panY+=next.y-old.y;}
      else{v.yaw+=(next.x-old.x)*.008;v.pitch=Math.max(-Math.PI/2,Math.min(Math.PI/2,v.pitch+(next.y-old.y)*.008));}
      v.zoom=Math.max(.15,Math.min(12,v.zoom));pointers.set(e.pointerId,next);request();
    };
    const up=(e:PointerEvent)=>pointers.delete(e.pointerId);
    const wheel=(e:WheelEvent)=>{e.preventDefault();pose.current.zoom=Math.max(.15,Math.min(12,pose.current.zoom*Math.exp(-e.deltaY*.001)));request();};
    const context=(e:Event)=>e.preventDefault();
    el.addEventListener('pointerdown',down);el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('wheel',wheel,{passive:false});el.addEventListener('contextmenu',context);request();
    return()=>{cancelAnimationFrame(raf);resize.disconnect();el.removeEventListener('pointerdown',down);el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);el.removeEventListener('wheel',wheel);el.removeEventListener('contextmenu',context);};
  },[]);
  useEffect(()=>{redraw.current();},[model,settings]);
  useEffect(()=>{
    const v=pose.current;v.panX=v.panY=0;v.zoom=1;v.yaw=settings.view==='iso'?.55:0;v.pitch=settings.view==='top'?Math.PI/2:settings.view==='bottom'?-Math.PI/2:settings.view==='front'?0:.83;redraw.current();
  },[settings.view,settings.reset]);
  useEffect(()=>{if(zoomCommand.id){pose.current.zoom=Math.max(.15,Math.min(12,pose.current.zoom/zoomCommand.factor));redraw.current();}},[zoomCommand]);
  return <><canvas ref={canvas} className="software-canvas" tabIndex={0} role="img" aria-label="Interactive 3D gage in compatibility mode. Drag to orbit, right-drag or use two fingers to pan, and pinch or scroll to zoom."/><span className="compatibility-label" title="Software-rendered 3D. Model geometry and export quality are unchanged.">Compatibility 3D</span></>;
}
