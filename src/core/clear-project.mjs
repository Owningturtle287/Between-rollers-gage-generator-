import { DEFAULTS } from './geometry.mjs';

/** Clear editable numeric/optional settings; retain the document identity and display choices. */
export function clearProject(project){
  const next=structuredClone(project);
  for(const [key,value] of Object.entries(DEFAULTS)){
    if(typeof value==='number'&&key!=='version')next[key]=0;
    if(typeof value==='boolean')next[key]=false;
  }
  const text={...structuredClone(DEFAULTS.texts[0]),...next.texts[0],text:''};
  for(const [key,value] of Object.entries(DEFAULTS.texts[0])){
    if(typeof value==='number')text[key]=0;
    if(typeof value==='boolean')text[key]=false;
  }
  next.texts=[text];
  return next;
}

export const isBlankProject=p=>['rollerCount','rollerDiameter','betweenMin','betweenMax','thickness','gapWidth','gapLength','cageDiameter','boreDiameter'].every(key=>p[key]===0);
