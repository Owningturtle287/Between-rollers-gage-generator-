/** A decimal draft may temporarily be empty, a minus sign, or end in a dot. */
export function editNumber(draft,key,replaceAll=false){
  let next=draft;
  if(/^\d$/.test(key))next=replaceAll||draft==='0'?key:draft==='-0'?'-'+key:draft+key;
  else if(key==='decimal')next=replaceAll?'0.':draft==='-'?'-0.':draft===''?'0.':draft.includes('.')?draft:draft+'.';
  else if(key==='sign')next=draft.startsWith('-')?draft.slice(1):'-'+draft;
  else if(key==='backspace')next=draft.slice(0,-1);
  else if(key==='clear')next='';
  if(next.length>24||! /^-?\d*\.?\d*$/.test(next))return draft;
  return next;
}
export function draftValue(draft){
  if(!/^-?(?:\d+\.?\d*|\.\d+)$/.test(draft))return null;
  const value=Number(draft);return Number.isFinite(value)?value:null;
}

/** Pointer presses are immediate; the subsequent compatibility click is not a second digit. */
export function activatesPadKey({type,button=0,detail=0,pointerType=''}){
  if(type==='pointerdown')return button===0;
  // Keyboard and assistive technologies activate buttons with a pointer-free click.
  return type==='click'&&detail===0&&!pointerType;
}
