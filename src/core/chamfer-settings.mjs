/** Missing bore settings in older projects inherit the original perimeter chamfer. */
export function chamferSettings(p){
  return {
    top:p.chamferTop,bottom:p.chamferBottom,topAngle:p.chamferTopAngle,bottomAngle:p.chamferBottomAngle,
    boreTop:p.boreChamferTop??p.chamferTop,boreBottom:p.boreChamferBottom??p.chamferBottom,
    boreTopAngle:p.boreChamferTopAngle??p.chamferTopAngle,boreBottomAngle:p.boreChamferBottomAngle??p.chamferBottomAngle,
  };
}

/** Keep both faces synchronized when linked, regardless of which face is edited. */
export function changeChamfer(p,area,face,property,value){
  const prefix=area==='bore'?'boreChamfer':'chamfer',suffix=property==='angle'?'Angle':'';
  const next={...p,[prefix+face+suffix]:value};
  if(p[area==='bore'?'boreChamfersLinked':'outerChamfersLinked'])next[prefix+(face==='Top'?'Bottom':'Top')+suffix]=value;
  return next;
}

export function linkChamfers(p,area,linked){
  const next={...p,[area==='bore'?'boreChamfersLinked':'outerChamfersLinked']:linked};
  if(linked){const prefix=area==='bore'?'boreChamfer':'chamfer';next[prefix+'Bottom']=p[prefix+'Top'];next[prefix+'BottomAngle']=p[prefix+'TopAngle'];}
  return next;
}
