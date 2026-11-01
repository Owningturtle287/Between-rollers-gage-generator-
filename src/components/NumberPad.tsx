import { createContext, startTransition, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { activatesPadKey, draftValue, editNumber } from '../core/number-entry.mjs';
import { Icon } from './Icon';

type Editor={id:string;label:string;units:string;precision:number;anchor:HTMLInputElement;initial:string;onValue:(value:number)=>void};
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
    const draft=editNumber(active.draft,key,active.replaceAll,active.precision);
    const next={...active,draft,replaceAll:false};current.current=next;setSession(next);
    // Keep entry synchronous, while expensive model/UI updates yield to the next tap.
    const value=draftValue(draft);if(value!==null)startTransition(()=>active.onValue(value));
  };
  useLayoutEffect(()=>{
    if(!session)return;
    const anchor=session.anchor,pane=anchor.closest('.panel-scroll') as HTMLElement|null;
    let raf=0,initialPlacement=true;
    pane?.classList.add('number-pad-open');
    const place=()=>{
      cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{
        if(!anchor.isConnected){close();return;}
        let a=anchor.getBoundingClientRect();const p=pane?.getBoundingClientRect();
        const bounds=p||{left:8,right:window.innerWidth-8,top:8,bottom:window.innerHeight-8,width:window.innerWidth-16};
        const width=Math.min(340,bounds.width-16),height=popup.current?.getBoundingClientRect().height||250;
        const below=bounds.bottom-a.bottom-8,above=a.top-bounds.top-8;
        const useAbove=below<height&&above>=height;
        // Make room once, before the keys become interactive. Never chase scroll events
        // or move keys under the user's fingers as a value changes.
        if(initialPlacement&&!useAbove&&below<height&&pane){
          pane.scrollBy({top:height-below+8,behavior:'instant'});
          a=anchor.getBoundingClientRect();
        }
        initialPlacement=false;
        let top=useAbove?a.top-height-5:a.bottom+5;
        top=Math.max(bounds.top+5,Math.min(top,bounds.bottom-height-5));
        const left=Math.max(bounds.left+8,Math.min(a.left,bounds.right-width-8));
        setPosition({left,top,width,above:useAbove,ready:true});
      });
    };
    const inside=(target:Node)=>popup.current?.contains(target)||anchor.closest('.field')?.contains(target);
    const outside=(e:PointerEvent)=>{if(!inside(e.target as Node))close(session.id);};
    const focusOutside=(e:FocusEvent)=>{if(!inside(e.target as Node))close(session.id);};
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')close(session.id);};
    // Scrolling the settings does not dismiss or reposition the pad. A disconnected
    // field (for example when switching tabs) still ends the session.
    const observer=new MutationObserver(()=>{if(!anchor.isConnected)close(session.id);});
    if(pane)observer.observe(pane,{childList:true,subtree:true});
    place();window.addEventListener('resize',place);window.visualViewport?.addEventListener('resize',place);
    document.addEventListener('pointerdown',outside,true);document.addEventListener('focusin',focusOutside);document.addEventListener('keydown',escape);
    return()=>{cancelAnimationFrame(raf);observer.disconnect();pane?.classList.remove('number-pad-open');window.removeEventListener('resize',place);window.visualViewport?.removeEventListener('resize',place);document.removeEventListener('pointerdown',outside,true);document.removeEventListener('focusin',focusOutside);document.removeEventListener('keydown',escape);};
  },[session?.id]);
  const keys=[['7','7'],['8','8'],['9','9'],['backspace','⌫'],['4','4'],['5','5'],['6','6'],['sign','−/+'],['1','1'],['2','2'],['3','3'],['clear','C'],['0','0'],['decimal','.'],['done','Done']];
  return <PadContext.Provider value={{session,open,close,press}}>{children}{session&&createPortal(
    <div ref={popup} className={`number-pad ${position.above?'above':''} ${position.ready?'placed':''}`} role="dialog" aria-label={`${session.label} number pad`}
      style={{left:position.left,top:position.top,width:position.width}} onPointerDown={e=>e.preventDefault()}>
      <div className="number-pad-heading"><span>{session.label}</span><output aria-label="Number being entered">{session.draft||'—'}</output><small>{session.units}</small><button type="button" aria-label="Close number pad" onClick={()=>close()}><Icon name="close" size={15}/></button></div>
      <div className="number-pad-keys">{keys.map(([key,label])=><button type="button" key={key} className={key==='done'?'pad-done':''}
        aria-label={key==='sign'?'Toggle negative sign':key==='decimal'?'Decimal point':key==='backspace'?'Backspace':key==='clear'?'Clear number':key==='done'?'Done entering number':label}
        onPointerDown={e=>{e.preventDefault();e.stopPropagation();if(activatesPadKey(e,key))press(key);}}
        onClick={e=>{e.preventDefault();e.stopPropagation();const pointerType='pointerType' in e.nativeEvent?String(e.nativeEvent.pointerType):'';if(activatesPadKey({type:e.type,detail:e.detail,pointerType},key))press(key);}}>{label}</button>)}</div>
    </div>,document.body)}</PadContext.Provider>;
}
