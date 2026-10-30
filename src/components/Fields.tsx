import { useEffect, useId, useState } from 'react';
import { Icon } from './Icon';
import { toMillimeters, fromMillimeters } from '../core/units.mjs';

export function Field({label,value,onChange,units='mm',dimension=true,help,step,min,max,disabled=false}: {
  label:string;value:number;onChange:(v:number)=>void;units?:'in'|'mm'|'deg'|'x'|'';
  dimension?:boolean;help?:string;step?:number;min?:number;max?:number;disabled?:boolean;
}){
  const id=useId(),[focused,setFocused]=useState(false),[raw,setRaw]=useState('');
  const display=Number((dimension?fromMillimeters(value,units):value).toFixed(dimension?(units==='in'?4:3):3)).toString();
  useEffect(()=>{if(!focused)setRaw(display);},[display,focused]);
  return <label className={`field ${disabled?'disabled':''}`} htmlFor={id}>
    <span className="field-label">{label}{help&&<span className="tip" title={help} aria-label={help}><Icon name="info" size={12}/></span>}</span>
    <span className="input-wrap"><input id={id} type="number" inputMode="decimal" value={focused?raw:display} disabled={disabled}
      step={step??(dimension?(units==='in'?.001:.01):1)} min={min} max={max} aria-label={label} aria-describedby={help?id+'-help':undefined}
      onFocus={()=>{setFocused(true);setRaw(display);}}
      onChange={e=>{setRaw(e.target.value);const v=Number(e.target.value);if(e.target.value!==''&&Number.isFinite(v))onChange(dimension?toMillimeters(v,units):v);}}
      onBlur={()=>setFocused(false)}/><span className="input-unit">{units}</span></span>
    {help&&<span id={id+'-help'} className="sr-only">{help}</span>}
  </label>;
}
export function Toggle({label,checked,onChange,description}:{label:string;checked:boolean;onChange:(b:boolean)=>void;description?:string}){
  const id=useId();return <label className="toggle-row" htmlFor={id}><span><span className="toggle-title">{label}</span>{description&&<small>{description}</small>}</span><input id={id} type="checkbox" role="switch" checked={checked} onChange={e=>onChange(e.target.checked)}/><span className="switch" aria-hidden="true"/></label>;
}
export function Section({number,title,children,defaultOpen=true}:{number?:string;title:string;children:React.ReactNode;defaultOpen?:boolean}){
  return <details className="section" open={defaultOpen}><summary>{number&&<span className="section-number">{number}</span>}<span>{title}</span><Icon name="chevron" size={16}/></summary><div className="section-body">{children}</div></details>;
}
