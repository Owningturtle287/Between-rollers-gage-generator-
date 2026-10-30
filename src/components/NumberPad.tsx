import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { draftValue, editNumber } from '../core/number-entry.mjs';
import { Icon } from './Icon';

type Editor={id:string;label:string;units:string;anchor:HTMLInputElement;initial:string;onValue:(value:number)=>void};
type Session=Editor&{draft:string;replaceAll:boolean};
type PadAPI={session:Session|null;open:(editor:Editor)=>void;close:(id?:string)=>void;press:(key:string)=>void};
const PadContext=createContext<PadAPI|null>(null);
export const useNumberPad=()=>{const value=useContext(PadContext);if(!value)throw new Error('Number pad provider is missing.');return value;};

export function NumberPadProvider({children}:{children:ReactNode}){
  const [session,setSession]=useState<Session|null>(null),current=useRef<Session|null>(null);
  const [position,setPosition]=useState({left:0,top:0,width:280,above:false,ready:false});
  const popup=useRef<HTMLDivElement>(null);
  const open=(editor:Editor)=>{
    if(current.current?.id===editor.id)return;
    const next={...editor,draft:editor.initial,replaceAll:true};
    current.current=next;setPosition(p=>({...p,ready:false}));setSession(next);
  };
  const close=(id?:string)=>{
    if(id&&current.current?.id!==id)return;
    const old=current.current;current.current=null;setSession(null);old?.anchor.blur();
  };
  const press=(key:string)=>{
    const active=current.current;if(!active)return;
    if(key==='done'){close();return;}
    const draft=editNumber(active.draft,key,active.replaceAll);
    const next={...active,draft,replaceAll:false};current.current=next;setSession(next);
    const value=draftValue(draft);if(value!==null)active.onValue(value);
    requestAnimationFrame(()=>{if(active.anchor.isConnected)active.anchor.setSelectionRange(draft.length,draft.length);});
  };
  useLayoutEffect(()=>{
    if(!session)return;
    const anchor=session.anchor,pane=anchor.closest('.panel-scroll') as HTMLElement|null;
    let raf=0;
    const place=()=>{
      cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{
        if(!anchor.isConnected){close();return;}
        const a=anchor.getBoundingClientRect(),p=pane?.getBoundingClientRect();
        if(p&&(a.bottom<p.top||a.top>p.bottom)){close(session.id);return;}
        const bounds=p||{left:8,right:window.innerWidth-8,top:8,bottom:window.innerHeight-8,width:window.innerWidth-16};
        const width=Math.min(294,bounds.width-16),height=popup.current?.getBoundingClientRect().height||184;
        const below=bounds.bottom-a.bottom-8,above=a.top-bounds.top-8;
        const useAbove=below<height&&above>=height;
        let top=useAbove?a.top-height-5:a.bottom+5;
        // Only the settings pane moves if neither side has enough room.
        if(!useAbove&&below<height&&pane&&pane.scrollTop<pane.scrollHeight-pane.clientHeight){
          pane.scrollBy({top:height-below+8,behavior:'smooth'});
        }
        top=Math.max(bounds.top+5,Math.min(top,bounds.bottom-height-5));
        const left=Math.max(bounds.left+8,Math.min(a.left,bounds.right-width-8));
        setPosition({left,top,width,above:useAbove,ready:true});
      });
    };
    const outside=(e:PointerEvent)=>{const target=e.target as Node;if(popup.current?.contains(target)||anchor.contains(target))return;close(session.id);};
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')close(session.id);};
    place();pane?.addEventListener('scroll',place,{passive:true});window.addEventListener('resize',place);window.visualViewport?.addEventListener('resize',place);
    document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',escape);
    return()=>{cancelAnimationFrame(raf);pane?.removeEventListener('scroll',place);window.removeEventListener('resize',place);window.visualViewport?.removeEventListener('resize',place);document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape);};
  },[session?.id]);
  const keys=[['7','7'],['8','8'],['9','9'],['backspace','⌫'],['4','4'],['5','5'],['6','6'],['sign','−/+'],['1','1'],['2','2'],['3','3'],['clear','C'],['0','0'],['decimal','.'],['done','Done']];
  return <PadContext.Provider value={{session,open,close,press}}>{children}{session&&createPortal(
    <div ref={popup} className={`number-pad ${position.above?'above':''} ${position.ready?'placed':''}`} role="dialog" aria-label={`${session.label} number pad`}
      style={{left:position.left,top:position.top,width:position.width}} onPointerDown={e=>e.preventDefault()}>
      <div className="number-pad-heading"><span>{session.label}</span><small>{session.units}</small><button type="button" aria-label="Close number pad" onClick={()=>close()}><Icon name="close" size={13}/></button></div>
      <div className="number-pad-keys">{keys.map(([key,label])=><button type="button" key={key} className={key==='done'?'pad-done':''}
        aria-label={key==='sign'?'Toggle negative sign':key==='decimal'?'Decimal point':key==='backspace'?'Backspace':key==='clear'?'Clear number':key==='done'?'Done entering number':label}
        onClick={()=>press(key)}>{label}</button>)}</div>
    </div>,document.body)}</PadContext.Provider>;
}
