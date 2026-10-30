import { ShapeUtils, Vector2 } from 'three';

export const DEFAULTS = {
  version: 1, name: 'My roller gage', units: 'in',
  rollerCount: 12, rollerDiameter: 12.7,
  betweenMin: 101.346, betweenMax: 101.854, targetPosition: 0.5,
  thickness: 6.35, gapWidth: 5.588, gapLength: 5.08,
  flatLength: 5.08, boreEnabled: true, boreDiameter: 12.7,
  compensation: 0, compensateBore: true,
  chamferTop: 0.381, chamferBottom: 0.381, quality: 'standard',
  texts: [{ id: 'label-1', enabled: true, text: 'GAGE STUDIO',
    face: 'top', mode: 'emboss', layout: 'arc', font: 'sans', weight: 'regular',
    italic: false, size: 4.4, depth: 0.5, tracking: 0.3,
    lineHeight: 1.2, align: 'center', x: 0, y: 0, rotation: 0,
    radius: 33, angle: 90, clockwise: true, kerning: true,
  }],
};

export const QUALITY = {
  draft: { arcSegments: 4, circleSegments: 96, curveSegments: 5, tolerance: 0.08 },
  standard: { arcSegments: 10, circleSegments: 256, curveSegments: 10, tolerance: 0.025 },
  fine: { arcSegments: 24, circleSegments: 720, curveSegments: 20, tolerance: 0.008 },
};
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const rad = (d) => d * Math.PI / 180;

export function derive(p) {
  const nominal = p.betweenMin + (p.betweenMax - p.betweenMin) * p.targetPosition;
  const diameter = nominal + p.compensation;
  const r = p.rollerDiameter / 2;
  const pitchRadius = diameter / 2 + r;
  const halfFlat = p.flatLength / 2;
  const angle = Math.atan2(halfFlat, r) + Math.asin(p.gapWidth / (2 * Math.hypot(r, halfFlat)));
  const sx = r * Math.sin(angle), sy = pitchRadius - r * Math.cos(angle);
  const lower = [sx - halfFlat * Math.cos(angle), sy - halfFlat * Math.sin(angle)];
  const upper = [sx + halfFlat * Math.cos(angle), sy + halfFlat * Math.sin(angle)];
  const floor = diameter / 2 - p.gapLength;
  const tipRadius = Math.hypot(...upper);
  const bore = p.boreEnabled ? p.boreDiameter + (p.compensateBore ? p.compensation : 0) : 0;
  const toothAngle = Math.PI / p.rollerCount - Math.atan2(upper[0], upper[1]);
  return { nominal, diameter, rollerRadius: r, pitchRadius, contactAngle: angle,
    contact: [sx, sy], lower, upper, floor, tipRadius, bore,
    toothWidth: 2 * tipRadius * Math.sin(toothAngle),
    web: floor - bore / 2, contactHeight: p.thickness - p.chamferTop - p.chamferBottom,
  };
}

export function validate(p) {
  const issues = [];
  const keys = ['rollerCount','rollerDiameter','betweenMin','betweenMax','targetPosition','thickness',
    'gapWidth','gapLength','flatLength','boreDiameter','compensation','chamferTop','chamferBottom'];
  if (keys.some(k => !finite(p[k]))) return ['Every dimension must be a finite number.'];
  if (!Number.isInteger(p.rollerCount) || p.rollerCount < 3 || p.rollerCount > 80) issues.push('Use a whole roller count from 3 to 80.');
  if (p.betweenMin <= 0 || p.betweenMax < p.betweenMin) issues.push('Between-roller maximum must be at least the positive minimum.');
  if (p.targetPosition < 0 || p.targetPosition > 1) issues.push('The target must be inside the minimum and maximum.');
  for (const [key,label] of [['rollerDiameter','Roller diameter'],['thickness','Thickness'],['gapWidth','Gap width'],['gapLength','Gap length'],['flatLength','Contact flat length']]) {
    if (p[key] <= 0) issues.push(`${label} must be greater than zero.`);
  }
  if (p.gapWidth >= p.rollerDiameter) issues.push('Gap width must be smaller than the roller diameter.');
  if (p.boreEnabled && p.boreDiameter <= 0) issues.push('Bore diameter must be greater than zero.');
  if (p.chamferTop < 0 || p.chamferBottom < 0) issues.push('Chamfer sizes cannot be negative.');
  if (p.thickness - p.chamferTop - p.chamferBottom < 0.2) issues.push('Leave at least 0.2 mm of full-size contact height between chamfers.');
  if (p.thickness > 1000 || p.betweenMax > 10000 || p.rollerDiameter > 1000) issues.push('Dimensions exceed the supported modeling range (10 m span / 1 m roller or thickness).');
  if (issues.length) return issues;
  const d = derive(p);
  if (d.diameter > 10000 || !finite(d.pitchRadius)) issues.push('The compensated diameter exceeds the 10 m modeling range.');
  if (!finite(d.contactAngle) || d.contactAngle > rad(80)) issues.push('The gap and flat length leave too little outward support. Reduce their sizes.');
  if (d.diameter <= 0 || d.bore < 0) issues.push('Compensation makes a diameter zero or negative.');
  if (d.lower[1] <= d.floor + .05) issues.push('Increase gap length so the relief reaches below the contact flats.');
  if (d.toothWidth < .6) issues.push('Teeth are too narrow. Increase the between-roller diameter or reduce the roller, gap, flat length, or count.');
  if (2 * d.pitchRadius * Math.sin(Math.PI / p.rollerCount) <= p.rollerDiameter + .05) issues.push('Neighboring rollers overlap. Increase the span or reduce roller count or diameter.');
  if (d.web <= 2 * Math.max(p.chamferTop,p.chamferBottom) + .4) issues.push('The bore and relief leave too little material. Reduce bore, gap length, or chamfers.');
  if (Math.max(p.chamferTop,p.chamferBottom) * 2 >= d.toothWidth - .2) issues.push('Chamfers consume the tooth face. Reduce chamfer size.');
  if ((p.texts?.length || 0) > 6) issues.push('Use up to six text layers.');
  for (const t of p.texts || []) if (t.enabled && t.text.trim()) {
    if (t.text.length > 120) issues.push('Keep each text layer within 120 characters.');
    for (const key of ['size','depth','tracking','lineHeight','x','y','rotation','radius','angle']) if (!finite(t[key])) issues.push(`Text ${key} must be a finite number.`);
    if (t.size <= .1 || t.size > d.diameter) issues.push('Text size must be positive and smaller than the gage.');
    if (t.depth <= 0 || (t.mode === 'engrave' && t.depth >= p.thickness / 2)) issues.push('Text depth must be positive; engraving must be less than half the thickness.');
    if (t.depth > 1000 || Math.abs(t.x) > d.diameter * 2 || Math.abs(t.y) > d.diameter * 2 || t.radius > d.diameter * 2 || Math.abs(t.tracking) > t.size * 2) issues.push('Text depth, position, radius, or spacing exceeds the modeling range.');
    if (t.layout === 'arc' && (t.radius <= t.size || t.text.includes('\n'))) issues.push('Circular text needs a radius larger than its size and a single line.');
    if (t.lineHeight < .5 || t.lineHeight > 4) issues.push('Text line spacing must be between 0.5 and 4.');
  }
  return [...new Set(issues)];
}

export function localToWorld(x, y, theta) {
  return [x*Math.sin(theta) + y*Math.cos(theta), -x*Math.cos(theta) + y*Math.sin(theta)];
}

export function signedArea(poly) {
  return poly.reduce((s,p,i) => { const q=poly[(i+1)%poly.length]; return s+p[0]*q[1]-q[0]*p[1]; },0)/2;
}

export function profile(p) {
  const issues = validate(p); if (issues.length) throw new Error(issues.join(' '));
  const d=derive(p), pts=[], quality=QUALITY[p.quality] || QUALITY.standard;
  const delta = Math.atan2(d.upper[0], d.upper[1]), step=2*Math.PI/p.rollerCount;
  const seat = [[-d.upper[0],d.upper[1]],[-d.lower[0],d.lower[1]],[-p.gapWidth/2,d.floor],
    [p.gapWidth/2,d.floor],d.lower,d.upper];
  for(let i=0;i<p.rollerCount;i++) {
    const a=Math.PI/2-i*step;
    for(const [x,y] of seat) pts.push(localToWorld(x,y,a));
    const start=a-delta, end=a-step+delta;
    // Sagitta bound in mm, in addition to the selected minimum segment count.
    const maxAngle=2*Math.acos(Math.max(-1,1-quality.tolerance/d.tipRadius));
    const count=Math.max(quality.arcSegments,Math.ceil((start-end)/maxAngle));
    for(let j=1;j<count;j++) { const b=start+(end-start)*j/count;pts.push([d.tipRadius*Math.cos(b),d.tipRadius*Math.sin(b)]); }
  }
  return signedArea(pts)<0 ? pts.reverse() : pts;
}

export function insetPolygon(poly, distance) {
  if (!distance) return poly.map(p=>[...p]);
  return poly.map((p,i)=>{
    const prev=poly[(i+poly.length-1)%poly.length], next=poly[(i+1)%poly.length];
    const ax=p[0]-prev[0],ay=p[1]-prev[1],bx=next[0]-p[0],by=next[1]-p[1];
    const al=Math.hypot(ax,ay),bl=Math.hypot(bx,by);
    const na=[-ay/al,ax/al],nb=[-by/bl,bx/bl],denom=1+na[0]*nb[0]+na[1]*nb[1];
    if(denom<1e-8) throw new Error('An edge is too sharp for this chamfer.');
    return [p[0]+distance*(na[0]+nb[0])/denom,p[1]+distance*(na[1]+nb[1])/denom];
  });
}

export function selfIntersects(poly) {
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  for(let i=0;i<poly.length;i++) for(let j=i+2;j<poly.length;j++) {
    if(i===0&&j===poly.length-1) continue;
    const a=poly[i],b=poly[(i+1)%poly.length],c=poly[j],d=poly[(j+1)%poly.length];
    if(Math.max(a[0],b[0])<Math.min(c[0],d[0])||Math.max(c[0],d[0])<Math.min(a[0],b[0])||Math.max(a[1],b[1])<Math.min(c[1],d[1])||Math.max(c[1],d[1])<Math.min(a[1],b[1])) continue;
    if(cross(a,b,c)*cross(a,b,d)<-1e-12&&cross(c,d,a)*cross(c,d,b)<-1e-12) return true;
  }
  return false;
}

/** Watertight polygon loft, with independent 45-degree face chamfers. */
export function baseMesh(p) {
  const poly=profile(p), d=derive(p), q=QUALITY[p.quality]||QUALITY.standard;
  const maxChamfer=Math.max(p.chamferTop,p.chamferBottom);
  if(maxChamfer&&selfIntersects(insetPolygon(poly,maxChamfer))) throw new Error('Chamfer edges intersect. Reduce the chamfer size.');
  const levels=[[0,p.chamferBottom]];
  if(p.chamferBottom>0) levels.push([p.chamferBottom,0]);
  if(p.thickness-p.chamferTop>levels.at(-1)[0]) levels.push([p.thickness-p.chamferTop,0]);
  if(p.chamferTop>0) levels.push([p.thickness,p.chamferTop]);
  const positions=[],triangles=[],rings=[];
  const boreSegments=Math.max(q.circleSegments,Math.ceil(Math.PI/Math.acos(Math.max(-1,1-q.tolerance/Math.max(d.bore/2,1)))));
  for(const [z,inset] of levels) {
    const contours=[insetPolygon(poly,inset)];
    if(d.bore>0) contours.push(Array.from({length:boreSegments},(_,i)=>{const a=-i*2*Math.PI/boreSegments;return [(d.bore/2+inset)*Math.cos(a),(d.bore/2+inset)*Math.sin(a)];}));
    const ring=[];
    for(const contour of contours) {
      const ids=[];
      for(const [x,y] of contour){ids.push(positions.length/3);positions.push(x,y,z);}
      ring.push({points:contour,ids});
    }
    rings.push(ring);
  }
  for(let k=0;k<rings.length-1;k++) for(let c=0;c<rings[k].length;c++) {
    const a=rings[k][c].ids,b=rings[k+1][c].ids;
    for(let i=0;i<a.length;i++){const j=(i+1)%a.length;triangles.push(a[i],a[j],b[j],a[i],b[j],b[i]);}
  }
  for(const [k,top] of [[0,false],[rings.length-1,true]]) {
    const ring=rings[k];
    const verts=ring.map(c=>c.points.map(p=>new Vector2(...p)));
    const faces=ShapeUtils.triangulateShape(verts[0],verts.slice(1));
    const ids=ring.flatMap(c=>c.ids);
    for(const face of faces){const t=face.map(i=>ids[i]);const [a,b,c]=t.map(i=>positions.slice(i*3,i*3+3));
      const positive=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>0;
      if(positive!==top) [t[1],t[2]]=[t[2],t[1]];triangles.push(...t);}
  }
  return {positions:new Float32Array(positions),indices:new Uint32Array(triangles),outline:poly,derived:d};
}

export function importProject(value) {
  if (!value || value.version !== 1 || typeof value.name !== 'string') throw new Error('This is not a Gage Studio v1 project.');
  const p={...structuredClone(DEFAULTS),...value};
  if(!['in','mm'].includes(p.units)||!Object.keys(QUALITY).includes(p.quality)) throw new Error('Unsupported units or mesh quality.');
  if(!Array.isArray(p.texts)||p.texts.length>6) throw new Error('Invalid text layer list.');
  const enums={face:['top','bottom'],mode:['emboss','engrave'],layout:['linear','arc'],font:['sans','serif','mono','custom'],weight:['regular','bold'],align:['left','center','right']};
  p.texts=p.texts.map((t,i)=>{if(typeof t?.text!=='string')throw new Error('Invalid text layer.');const out={...DEFAULTS.texts[0],...t,id:`label-${Date.now()}-${i}`};for(const key in enums)if(!enums[key].includes(out[key]))throw new Error(`Invalid text ${key}.`);return out;});
  if(p.customFont && (typeof p.customFont!=='string'||p.customFont.length>2800000||!/^[A-Za-z0-9+/=]+$/.test(p.customFont))) throw new Error('Invalid custom font data.');
  const issues=validate(p);if(issues.length)throw new Error(issues.join(' '));
  return p;
}
