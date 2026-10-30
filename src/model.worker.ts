import Module from 'manifold-3d';
import wasmURL from 'manifold-3d/manifold.wasm?url';
import { parse, type Font } from 'opentype.js';
import sans from '@fontsource/roboto/files/roboto-latin-400-normal.woff?url';
import sansBold from '@fontsource/roboto/files/roboto-latin-700-normal.woff?url';
import serif from '@fontsource/libre-baskerville/files/libre-baskerville-latin-400-normal.woff?url';
import serifBold from '@fontsource/libre-baskerville/files/libre-baskerville-latin-700-normal.woff?url';
import mono from '@fontsource/roboto-mono/files/roboto-mono-latin-400-normal.woff?url';
import monoBold from '@fontsource/roboto-mono/files/roboto-mono-latin-700-normal.woff?url';
import { buildSolid } from './core/solid.mjs';
import type { Project, TextLayer } from './types';

const kernel=Module({locateFile:()=>wasmURL}).then(api=>{api.setup();return api;});
const fonts=new Map<string,Promise<Font>>();
async function resolveFont(t:TextLayer,p:Project) {
  const urls:Record<string,string>={sans,sansBold,serif,serifBold,mono,monoBold};
  const key=t.font==='custom'?p.customFont:urls[t.font+(t.weight==='bold'?'Bold':'')];
  if(!key)throw new Error('Upload a TTF, OTF, or WOFF font before choosing Custom.');
  if(!fonts.has(key))fonts.set(key,(async()=>{
    if(t.font==='custom'){
      const raw=atob(key);const data=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)data[i]=raw.charCodeAt(i);
      return parse(data.buffer);
    }
    const response=await fetch(key);if(!response.ok)throw new Error('A bundled font could not be loaded. Reconnect and reload.');return parse(await response.arrayBuffer());
  })());
  return fonts.get(key)!;
}
let pending:{id:number;project:Project;signature:string}|null=null;
let running=false;
async function drain(){
  if(running)return;running=true;
  while(pending){
    const job=pending;pending=null;
    try{
      const model=await buildSolid(await kernel,job.project,resolveFont);
      if(!pending)self.postMessage({id:job.id,model:{...model,signature:job.signature}},[model.positions.buffer,model.indices.buffer]);
    }catch(error){if(!pending)self.postMessage({id:job.id,error:error instanceof Error?error.message:String(error)});}
  }
  running=false;
}
self.onmessage=e=>{pending=e.data;void drain();};
