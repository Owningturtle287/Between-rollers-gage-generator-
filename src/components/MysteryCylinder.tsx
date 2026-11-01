import { useEffect, useRef } from 'react';

/** Independent of model dimensions: even a completely blank project can render it. */
export function MysteryCylinder({color}:{color:string}){
  const canvas=useRef<HTMLCanvasElement>(null),currentColor=useRef(color);currentColor.current=color;
  useEffect(()=>{
    const el=canvas.current!,ctx=el.getContext('2d');if(!ctx)return;
    let frame=0;const started=performance.now(),reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    const draw=(time:number)=>{
      frame=requestAnimationFrame(draw);if(document.hidden)return;
      const {width,height}=el.getBoundingClientRect();if(!width||!height)return;
      const ratio=Math.min(window.devicePixelRatio||1,2);
      if(el.width!==Math.round(width*ratio)||el.height!==Math.round(height*ratio)){el.width=Math.round(width*ratio);el.height=Math.round(height*ratio);}
      ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
      const hex=currentColor.current.slice(1),rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));
      const tint=(alpha:number,factor=1)=>`rgba(${rgb.map(v=>Math.round(v*factor)).join(',')},${alpha})`;
      const rx=Math.min(width*.3,height*.28,180),tilt=.7,ry=rx*Math.sin(tilt),half=rx*.64*Math.cos(tilt),cx=width/2,cy=height/2;
      const angle=reduced.matches?.45:(time-started)*.00055,scale=rx/42;
      // A soft shadow and two caps define a translucent volume, not a loading disk.
      ctx.save();ctx.translate(cx,cy+half+ry+rx*.13);ctx.scale(1,.19);
      const shadow=ctx.createRadialGradient(0,0,rx*.2,0,0,rx*1.2);shadow.addColorStop(0,'#244d3f1a');shadow.addColorStop(1,'#244d3f00');
      ctx.fillStyle=shadow;ctx.fillRect(-rx*1.3,-rx*1.3,rx*2.6,rx*2.6);ctx.restore();
      const ellipse=(y:number)=>{ctx.beginPath();ctx.ellipse(cx,y,rx,ry,0,0,Math.PI*2);};
      ellipse(cy+half);ctx.fillStyle=tint(.12);ctx.fill();ctx.strokeStyle=tint(.3,.7);ctx.lineWidth=1.2;ctx.stroke();
      const body=new Path2D();body.moveTo(cx-rx,cy-half);body.lineTo(cx-rx,cy+half);body.ellipse(cx,cy+half,rx,ry,0,Math.PI,0,true);body.lineTo(cx+rx,cy-half);body.ellipse(cx,cy-half,rx,ry,0,0,Math.PI,true);body.closePath();
      const glass=ctx.createLinearGradient(cx-rx,0,cx+rx,0);glass.addColorStop(0,tint(.29));glass.addColorStop(.27,tint(.08));glass.addColorStop(.75,tint(.18));glass.addColorStop(1,tint(.34));
      ctx.fillStyle=glass;ctx.fill(body);
      // Rotate an upright question-mark plane inside the cylinder in 3D.
      ctx.save();ctx.clip(body);
      ctx.transform(Math.cos(angle)*scale,-Math.sin(angle)*Math.sin(tilt)*scale,0,Math.cos(tilt)*scale,cx,cy);
      ctx.font='600 51px Roboto, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=tint(.86,.48);ctx.fillText('?',0,3);ctx.restore();
      // Front glass softens the mark and carries a highlight around the rotating shell.
      ctx.fillStyle=tint(.1);ctx.fill(body);ctx.strokeStyle=tint(.48,.72);ctx.lineWidth=1.25;ctx.stroke(body);
      const glintX=cx+Math.cos(angle)*rx*.72;
      ctx.save();ctx.clip(body);ctx.beginPath();ctx.moveTo(glintX,cy-half-ry);ctx.lineTo(glintX,cy+half+ry);
      ctx.strokeStyle=`rgba(255,255,255,${.13+.15*Math.abs(Math.sin(angle))})`;ctx.lineWidth=Math.max(1,rx*.035);ctx.stroke();ctx.restore();
      ellipse(cy-half);ctx.fillStyle=tint(.17);ctx.fill();ctx.strokeStyle=tint(.48,.72);ctx.lineWidth=1.25;ctx.stroke();
    };
    frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);
  },[]);
  return <div className="mystery-preview"><canvas ref={canvas} role="img" aria-label="Rotating translucent mystery cylinder with a question mark. Enter valid dimensions to reveal the gage."/></div>;
}
