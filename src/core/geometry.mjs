import { ShapeUtils, Vector2 } from 'three';
import { chamferSettings } from './chamfer-settings.mjs';
import { formatDimension } from './units.mjs';

export const DEFAULTS = {
  version: 3, name: 'My roller gage', units: 'in', color: '#a9d5f0',
  rollerCount: 12, rollerDiameter: 12.7,
  betweenMin: 101.346, betweenMax: 101.854, targetPosition: 0.5,
  thickness: 6.35, gapWidth: 5.588, gapLength: 5.08,
  cageDiameter: 109.84467545022416, boreEnabled: true, boreDiameter: 12.7,
  compensation: 0, compensateBore: true,
  chamferTop: 0.381, chamferBottom: 0.381, chamferTopAngle: 45, chamferBottomAngle: 45, quality: 'standard',
  boreChamferTop: 0.381, boreChamferBottom: 0.381, boreChamferTopAngle: 45, boreChamferBottomAngle: 45,
  outerChamfersLinked: true, boreChamfersLinked: true,
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
  ultra: { arcSegments: 40, circleSegments: 1200, curveSegments: 32, tolerance: 0.0025 },
};
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const rad = (d) => d * Math.PI / 180;

/** Previous flat-length projects migrate without changing their envelope. */
export function legacyCageDiameter(p) {
  const nominal=p.betweenMin+(p.betweenMax-p.betweenMin)*p.targetPosition;
  const c=(nominal+p.compensation+p.rollerDiameter)/2,r=p.rollerDiameter/2,h=p.flatLength/2;
  const beta=Math.atan2(h,r)+Math.asin(p.gapWidth/(2*Math.hypot(r,h)));
  return 2*Math.hypot(r*Math.sin(beta)+h*Math.cos(beta),c-r*Math.cos(beta)+h*Math.sin(beta))-p.compensation;
}

export function chamferDepth(size, angle) { return size*Math.tan(rad(angle)); }

export function solveFlat(pitchRadius, rollerRadius, gapWidth, outerRadius) {
  const at=h=>{
    const angle=Math.atan2(h,rollerRadius)+Math.asin(gapWidth/(2*Math.hypot(rollerRadius,h)));
    const sx=rollerRadius*Math.sin(angle),sy=pitchRadius-rollerRadius*Math.cos(angle);
    const lower=[sx-h*Math.cos(angle),sy-h*Math.sin(angle)];
    const upper=[sx+h*Math.cos(angle),sy+h*Math.sin(angle)];
    return {angle,contact:[sx,sy],lower,upper,flatLength:2*h,radius:Math.hypot(...upper)};
  };
  const minimum=at(0);
  if(!finite(outerRadius)||!finite(minimum.radius)||outerRadius<=minimum.radius) return {...minimum,flatLength:NaN};
  let lo=0,hi=Math.max(rollerRadius,outerRadius);
  for(let i=0;i<20&&at(hi).radius<outerRadius;i++)hi*=2;
  for(let i=0;i<64;i++){const mid=(lo+hi)/2;if(at(mid).radius<outerRadius)lo=mid;else hi=mid;}
  return at((lo+hi)/2);
}

export function derive(p) {
  const nominal = p.betweenMin + (p.betweenMax - p.betweenMin) * p.targetPosition;
  const diameter = nominal + p.compensation;
  const r = p.rollerDiameter / 2;
  const pitchRadius = diameter / 2 + r;
  const tipRadius=(p.cageDiameter+p.compensation)/2;
  const flat=solveFlat(pitchRadius,r,p.gapWidth,tipRadius);
  const {angle,lower,upper}=flat;
  const floor = diameter / 2 - p.gapLength;
  const bore = p.boreEnabled ? p.boreDiameter + (p.compensateBore ? p.compensation : 0) : 0;
  const toothAngle = Math.PI / p.rollerCount - Math.atan2(upper[0], upper[1]);
  const c=chamferSettings(p);
  const topDepth=chamferDepth(c.top,c.topAngle),bottomDepth=chamferDepth(c.bottom,c.bottomAngle);
  const boreTopDepth=chamferDepth(c.boreTop,c.boreTopAngle),boreBottomDepth=chamferDepth(c.boreBottom,c.boreBottomAngle);
  return { nominal, diameter, rollerRadius: r, pitchRadius, contactAngle: angle,
    contact: flat.contact, flatLength:flat.flatLength, lower, upper, floor, tipRadius, bore, topDepth, bottomDepth,boreTopDepth,boreBottomDepth,
    toothWidth: 2 * tipRadius * Math.sin(toothAngle),
    web: floor - bore / 2, contactHeight: p.thickness - topDepth - bottomDepth,boreContactHeight:p.thickness-boreTopDepth-boreBottomDepth,
  };
}

export function validate(p) {
  const issues = [];
  const keys = ['rollerCount','rollerDiameter','betweenMin','betweenMax','targetPosition','thickness',
    'gapWidth','gapLength','cageDiameter','boreDiameter','compensation','chamferTop','chamferBottom','chamferTopAngle','chamferBottomAngle'];
  if (keys.some(k => !finite(p[k]))) return ['Every dimension must be a finite number.'];
  const c=chamferSettings(p);
  if(Object.values(c).some(v=>!finite(v)))return ['Every chamfer dimension must be a finite number.'];
  if (!Number.isInteger(p.rollerCount) || p.rollerCount < 3 || p.rollerCount > 80) issues.push('Use a whole roller count from 3 to 80.');
  if (p.betweenMin <= 0 || p.betweenMax < p.betweenMin) issues.push('Between-roller maximum must be at least the positive minimum.');
  if (p.targetPosition < 0 || p.targetPosition > 1) issues.push('The target must be inside the minimum and maximum.');
  for (const [key,label] of [['rollerDiameter','Roller diameter'],['thickness','Thickness'],['gapWidth','Gap width'],['gapLength','Gap length'],['cageDiameter','Cage Clearance Diameter']]) {
    if (p[key] <= 0) issues.push(`${label} must be greater than zero.`);
  }
  if (p.gapWidth >= p.rollerDiameter) issues.push('Gap width must be smaller than the roller diameter.');
  if (p.boreEnabled && p.boreDiameter <= 0) issues.push('Bore diameter must be greater than zero.');
  if ([c.top,c.bottom,c.boreTop,c.boreBottom].some(v=>v<0)) issues.push('Chamfer sizes cannot be negative.');
  if([[c.top,c.topAngle],[c.bottom,c.bottomAngle],[c.boreTop,c.boreTopAngle],[c.boreBottom,c.boreBottomAngle]].some(([width,angle])=>angle<0||angle>89||(width>0&&angle<1)))issues.push('A nonzero chamfer needs an angle between 1° and 89°, measured from the flat face.');
  if (p.thickness > 1000 || p.betweenMax > 10000 || p.cageDiameter>10000 || p.rollerDiameter > 1000) issues.push('Dimensions exceed the supported modeling range (10 m span / 1 m roller or thickness).');
  if(p.color&&!/^#[0-9a-f]{6}$/i.test(p.color))issues.push('Choose a valid six-digit gage color.');
  if (issues.length) return issues;
  const d = derive(p);
  const format=n=>`${formatDimension(n,p.units)} ${p.units||'mm'}`;
  if (d.diameter > 10000 || !finite(d.pitchRadius)) issues.push('The compensated diameter exceeds the 10 m modeling range.');
  if(!finite(d.flatLength)||d.flatLength<.01)issues.push('Cage Clearance Diameter is too small for the roller span and gap. Increase the outside diameter.');
  if (!finite(d.contactAngle) || d.contactAngle > rad(85)) issues.push('Cage Clearance Diameter is too large for centered outward support. Reduce it or change the roller/gap dimensions.');
  if (d.diameter <= 0 || d.bore < 0) issues.push('Compensation makes a diameter zero or negative.');
  if (d.lower[1] <= d.floor + .05) issues.push('Increase gap length so the relief reaches below the contact flats.');
  if (d.toothWidth < .3) issues.push('The outside diameter leaves no room between neighboring seats. Reduce Cage Clearance Diameter, gap width, or roller count.');
  if (2 * d.pitchRadius * Math.sin(Math.PI / p.rollerCount) <= p.rollerDiameter + .05) issues.push('Neighboring rollers overlap. Increase the span or reduce roller count or diameter.');
  if (d.web <= .2) issues.push('The bore and relief leave too little material. Reduce the bore or gap length.');
  if(d.contactHeight<.05)issues.push(`Chamfers use ${format(d.topDepth+d.bottomDepth)} of a ${format(p.thickness)} thickness. Reduce a chamfer size or angle to leave a contact band.`);
  if(p.boreEnabled&&d.boreContactHeight<.05)issues.push(`Bore chamfers use ${format(d.boreTopDepth+d.boreBottomDepth)} of a ${format(p.thickness)} thickness. Reduce a bore chamfer size or angle to leave a bore wall.`);
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

/** Sharp, watertight prism. Chamfers are robust solid cuts in solid.mjs. */
export function baseMesh(p) {
  const poly=profile(p), d=derive(p), q=QUALITY[p.quality]||QUALITY.standard;
  const levels=[[0,0],[p.thickness,0]];
  const positions=[],triangles=[],rings=[];
  const boreSegments=Math.max(q.circleSegments,Math.ceil(Math.PI/Math.acos(Math.max(-1,1-q.tolerance/Math.max(d.bore/2,1)))));
  for(const [z,inset] of levels) {
    const contours=[poly];
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

export function importProject(value,{allowIncomplete=false}={}) {
  if (!value || ![1,2,3].includes(value.version) || typeof value.name !== 'string') throw new Error('This is not a supported Gage Studio project.');
  const p={...structuredClone(DEFAULTS),...value,version:3};
  if(value.version===1){p.cageDiameter=legacyCageDiameter({...p,flatLength:value.flatLength??5.08});}
  if(value.version<3){
    p.boreChamferTop=p.chamferTop;p.boreChamferBottom=p.chamferBottom;
    p.boreChamferTopAngle=p.chamferTopAngle;p.boreChamferBottomAngle=p.chamferBottomAngle;
    p.outerChamfersLinked=p.boreChamfersLinked=p.chamferTop===p.chamferBottom&&p.chamferTopAngle===p.chamferBottomAngle;
  }
  if(typeof p.outerChamfersLinked!=='boolean'||typeof p.boreChamfersLinked!=='boolean')throw new Error('Invalid chamfer linking option.');
  delete p.flatLength;
  if(!['in','mm'].includes(p.units)||!Object.keys(QUALITY).includes(p.quality)) throw new Error('Unsupported units or mesh quality.');
  if(!Array.isArray(p.texts)||p.texts.length>6) throw new Error('Invalid text layer list.');
  const enums={face:['top','bottom'],mode:['emboss','engrave'],layout:['linear','arc'],font:['sans','serif','mono','custom'],weight:['regular','bold'],align:['left','center','right']};
  p.texts=p.texts.map((t,i)=>{if(typeof t?.text!=='string')throw new Error('Invalid text layer.');const out={...DEFAULTS.texts[0],...t,id:`label-${Date.now()}-${i}`};for(const key in enums)if(!enums[key].includes(out[key]))throw new Error(`Invalid text ${key}.`);return out;});
  // Incomplete dimensions are a valid editable draft. Malformed values still are not.
  for(const [key,initial] of Object.entries(DEFAULTS)){
    if(typeof initial==='number'&&!finite(p[key]))throw new Error('Invalid numeric project value.');
    if(typeof initial==='boolean'&&typeof p[key]!=='boolean')throw new Error('Invalid project option.');
  }
  for(const t of p.texts)for(const [key,initial] of Object.entries(DEFAULTS.texts[0])){
    if(typeof initial==='number'&&!finite(t[key]))throw new Error('Invalid numeric text value.');
    if(typeof initial==='boolean'&&typeof t[key]!=='boolean')throw new Error('Invalid text option.');
  }
  if(!/^#[0-9a-f]{6}$/i.test(p.color))throw new Error('Invalid gage color.');
  if(p.customFont && (typeof p.customFont!=='string'||p.customFont.length>2800000||!/^[A-Za-z0-9+/=]+$/.test(p.customFont))) throw new Error('Invalid custom font data.');
  const issues=validate(p);if(issues.length&&!allowIncomplete)throw new Error(issues.join(' '));
  return p;
}
