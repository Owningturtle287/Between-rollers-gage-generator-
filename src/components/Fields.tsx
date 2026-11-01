import { useId, useRef } from 'react';
import { Icon } from './Icon';
import { toMillimeters, formatDimension } from '../core/units.mjs';
import { useNumberPad } from './NumberPad';

export function Field({label,value,onChange,units='mm',dimension=true,help,step,min,max,disabled=false}: {
  label:string;value:number;onChange:(v:number)=>void;units?:'in'|'mm'|'deg'|'x'|'';
  dimension?:boolean;help?:string;step?:number;min?:number;max?:number;disabled?:boolean;
}){
  const id=useId(),input=useRef<HTMLInputElement>(null),pad=useNumberPad();
  const display=dimension?formatDimension(value,units):Number(value.toFixed(3)).toString();
  const active=pad.session?.id===id;
  const open=()=>{if(input.current)pad.open({id,label,units,precision:dimension?6:units===''?0:3,initial:display,anchor:input.current,onValue:v=>onChange(dimension?toMillimeters(v,units):v)});};
  return <label className={`field ${disabled?'disabled':''}`} htmlFor={id}>
    <span className="field-label">{label}{help&&<span className="tip" title={help} aria-label={help}><Icon name="info" size={12}/></span>}</span>
    <span className="input-wrap"><input ref={input} id={id} type="text" inputMode="none" readOnly role="spinbutton" value={active?pad.session!.draft:display} disabled={disabled}
      aria-valuenow={Number(display)} aria-valuemin={min} aria-valuemax={max} aria-label={label} aria-haspopup="dialog" aria-expanded={active} aria-describedby={help?id+'-help':undefined}
      onFocus={open} onClick={open} onKeyDown={e=>{
        const key=/^\d$/.test(e.key)?e.key:e.key==='.'||e.key===','?'decimal':e.key==='-'||e.key==='+'?'sign':e.key==='Backspace'?'backspace':e.key==='Delete'?'clear':e.key==='Enter'?'done':null;
        if(key){e.preventDefault();pad.press(key);}
      }}/><span className="input-unit">{units}</span></span>
    {help&&<span id={id+'-help'} className="sr-only">{help}</span>}
  </label>;
}
export function Toggle({label,checked,onChange,description}:{label:string;checked:boolean;onChange:(b:boolean)=>void;description?:string}){
  const id=useId();return <label className="toggle-row" htmlFor={id}><span><span className="toggle-title">{label}</span>{description&&<small>{description}</small>}</span><input id={id} type="checkbox" role="switch" checked={checked} onChange={e=>onChange(e.target.checked)}/><span className="switch" aria-hidden="true"/></label>;
}
export function Section({number,title,children}:{number?:string;title:string;children:React.ReactNode}){
  const id=useId();
  return <section className="section" aria-labelledby={id}><h3 id={id} className="section-heading">{number&&<span className="section-number">{number}</span>}<span>{title}</span></h3><div className="section-body">{children}</div></section>;
}
