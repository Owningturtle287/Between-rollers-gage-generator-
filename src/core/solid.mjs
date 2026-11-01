import { baseMesh, derive, validate, QUALITY } from './geometry.mjs';
import { applyChamfers, faceSection } from './chamfer.mjs';
import { chamferSettings } from './chamfer-settings.mjs';

const baseCache=new WeakMap();
const baseKey=p=>JSON.stringify({...p,name:undefined,units:undefined,color:undefined,texts:undefined,customFont:undefined,customFontName:undefined});

function pathContours(commands, steps) {
  const out=[];let contour=[],current=[0,0];
  const push=(x,y)=>{const p=[x,-y];if(!contour.length||Math.hypot(p[0]-contour.at(-1)[0],p[1]-contour.at(-1)[1])>1e-7)contour.push(p);current=[x,y];};
  const finish=()=>{if(contour.length>2){if(Math.hypot(contour[0][0]-contour.at(-1)[0],contour[0][1]-contour.at(-1)[1])<1e-7)contour.pop();out.push(contour);}contour=[];};
  for(const c of commands) {
    if(c.type==='M'){finish();push(c.x,c.y);}
    else if(c.type==='L')push(c.x,c.y);
    else if(c.type==='Q'||c.type==='C'){
      const start=[...current];
      for(let i=1;i<=steps;i++){const t=i/steps,u=1-t;
        if(c.type==='Q')push(u*u*start[0]+2*u*t*c.x1+t*t*c.x,u*u*start[1]+2*u*t*c.y1+t*t*c.y);
        else push(u*u*u*start[0]+3*u*u*t*c.x1+3*u*t*t*c.x2+t*t*t*c.x,u*u*u*start[1]+3*u*u*t*c.y1+3*u*t*t*c.y2+t*t*t*c.y);
      }
    } else if(c.type==='Z')finish();
  }
  finish();return out;
}

export function letteringContours(font, t, steps=10) {
  const scale=t.size/font.unitsPerEm, lines=t.text.split('\n');
  const glyphs=[];
  lines.forEach((line,lineIndex)=>{
    let cursor=0,prev=null;const row=[];
    for(const char of [...line]){
      const glyph=font.charToGlyph(char);
      if(glyph.index===0 && !/\s/.test(char)) throw new Error(`The selected font has no “${char}” glyph. Choose another font or upload one.`);
      if(prev&&t.kerning)cursor+=font.getKerningValue(prev,glyph)*scale;
      const advance=(glyph.advanceWidth||font.unitsPerEm*.5)*scale;
      row.push({glyph,x:cursor,advance});cursor+=advance+t.tracking;prev=glyph;
    }
    const width=Math.max(0,cursor-t.tracking);
    const shift=t.align==='center'?-width/2:t.align==='right'?-width:0;
    for(const {glyph,x,advance}of row){
      const contours=pathContours(glyph.getPath(0,0,t.size).commands,steps);
      const baseline=((lines.length-1)/2-lineIndex)*t.size*t.lineHeight-t.size*.35;
      const center=x+shift+advance/2;
      if(t.layout==='arc'&&width/t.radius>Math.PI*1.9) throw new Error('Circular text overlaps itself. Increase radius, reduce size, or reduce tracking.');
      const clockwise=t.clockwise!==false, direction=clockwise?1:-1;
      const theta=t.angle*Math.PI/180-direction*center/t.radius;
      const rotation=t.rotation*Math.PI/180;
      const transformed=contours.map(poly=>poly.map(([gx,gy])=>{
        if(t.italic)gx+=gy*Math.tan(Math.PI/12);
        let px,py;
        if(t.layout==='arc'){
          const tangential=gx-advance/2,radial=t.radius+direction*(gy-t.size*.35);
          px=direction*tangential*Math.sin(theta)+radial*Math.cos(theta);
          py=-direction*tangential*Math.cos(theta)+radial*Math.sin(theta);
        }else{px=gx+x+shift;py=gy+baseline;}
        let xx=px*Math.cos(rotation)-py*Math.sin(rotation)+t.x;
        const yy=px*Math.sin(rotation)+py*Math.cos(rotation)+t.y;
        if(t.face==='bottom')xx=-xx;
        return [xx,yy];
      }));
      if(transformed.length)glyphs.push(transformed);
    }
  });
  return glyphs;
}

export function compactMesh(mesh) {
  const parent=Array.from({length:mesh.numVert},(_,i)=>i);
  const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  for(let i=0;i<mesh.mergeFromVert.length;i++)parent[root(mesh.mergeFromVert[i])]=root(mesh.mergeToVert[i]);
  const map=new Map(),positions=[],indices=[];
  for(const v of mesh.triVerts){const id=root(v);if(!map.has(id)){map.set(id,positions.length/3);positions.push(...mesh.vertProperties.slice(id*mesh.numProp,id*mesh.numProp+3));}indices.push(map.get(id));}
  return {positions:new Float32Array(positions),indices:new Uint32Array(indices)};
}

/** All lettering is booleaned into the actual export solid. */
export async function buildSolid(api,p,resolveFont) {
  const issues=validate(p);if(issues.length)throw new Error(issues.join(' '));
  const started=performance.now(),owned=new Set();
  const keep=x=>{owned.add(x);return x;};
  try{
    const key=baseKey(p),d=derive(p);
    let cached=baseCache.get(api);
    if(!cached||cached.key!==key){
      const base=baseMesh(p);
      let body=keep(new api.Manifold(new api.Mesh({numProp:3,vertProperties:base.positions,triVerts:base.indices})));
      if(body.status()!=='NoError')throw new Error(`The base solid could not be constructed (${body.status()}).`);
      body=applyChamfers(api,body,base.outline,p,d,keep);
      cached?.solid.delete();cached={key,solid:body,outline:base.outline};baseCache.set(api,cached);owned.delete(body);
    }
    let solid=cached.solid;
    for(const t of p.texts||[]) if(t.enabled&&t.text.trim()){
      const font=await resolveFont(t,p);
      const glyphs=letteringContours(font,t,(QUALITY[p.quality]||QUALITY.standard).curveSegments);
      if(!glyphs.length)continue;
      const sections=glyphs.map(contours=>keep(new api.CrossSection(contours,'EvenOdd')));
      const text=keep(api.CrossSection.union(sections));
      const c=chamferSettings(p),faceChamfer=t.face==='top'?c.top:c.bottom,boreChamfer=t.face==='top'?c.boreTop:c.boreBottom;
      const face=faceSection(api,cached.outline,d.bore,faceChamfer+.03,keep,(QUALITY[p.quality]||QUALITY.standard).circleSegments,boreChamfer+.03);
      const outside=keep(text.subtract(face));
      if(outside.area()>.002)throw new Error(`Text “${t.text.slice(0,24)}” crosses a relief, bore, chamfer, or outer edge. Move it inward or reduce its size.`);
      const eps=.03;
      let z;
      if(t.face==='top')z=t.mode==='emboss'?p.thickness-eps:p.thickness-t.depth;
      else z=t.mode==='emboss'?-t.depth:-eps;
      const letters=keep(keep(text.extrude(t.depth+eps)).translate([0,0,z]));
      solid=keep(t.mode==='emboss'?solid.add(letters):solid.subtract(letters));
    }
    if(solid.status()!=='NoError'||solid.isEmpty())throw new Error(`The final solid is invalid (${solid.status()}). Adjust the geometry or lettering.`);
    const zOffset=Math.max(0,-solid.boundingBox().min[2]);
    if(zOffset>0)solid=keep(solid.translate([0,0,zOffset]));
    const parts=solid.decompose();parts.forEach(keep);
    if(parts.length!==1)throw new Error('The model contains disconnected pieces. Adjust the text or dimensions.');
    const result=compactMesh(solid.getMesh());
    return {...result,volume:solid.volume(),surfaceArea:solid.surfaceArea(),triangles:result.indices.length/3,
      components:parts.length,zOffset,milliseconds:performance.now()-started};
  }finally{for(const item of [...owned].reverse())item.delete();}
}
