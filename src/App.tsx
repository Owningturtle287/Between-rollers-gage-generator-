import { useEffect, useRef, useState } from 'react';
import { DEFAULTS, QUALITY, derive, importProject, validate } from './core/geometry.mjs';
import { FORMATS, exportModel, safeName } from './core/export.mjs';
import { Field, Section, Toggle } from './components/Fields';
import { Viewer } from './components/Viewer';
import { Icon } from './components/Icon';
import type { Model, Project, TextLayer, ViewSettings } from './types';

const STORAGE='between-rollers-project-v1';
const cloneDefaults=()=>structuredClone(DEFAULTS) as Project;
const getInitial=()=>{try{const raw=localStorage.getItem(STORAGE);return raw?importProject(JSON.parse(raw)) as Project:cloneDefaults();}catch{return cloneDefaults();}};
const download=(data:Uint8Array|string,name:string,mime:string)=>{
  const blob=new Blob([typeof data==='string'?data:new Uint8Array(data).buffer],{type:mime});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
};
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{ref.current?.showModal();},[]);
  return <dialog ref={ref} className="modal" aria-label={title} onCancel={onClose} onClick={e=>{if(e.target===ref.current){const r=ref.current!.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}>
    <div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close"/></button></div>{children}
  </dialog>;
}
function Select({label,value,onChange,options}:{label:string;value:string;onChange:(s:string)=>void;options:{value:string;label:string}[]}){
  return <label className="field"><span className="field-label">{label}</span><select aria-label={label} value={value} onChange={e=>onChange(e.target.value)}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
}

export default function App(){
  const [p,setP]=useState<Project>(getInitial),[tab,setTab]=useState<'geometry'|'text'|'print'>('geometry');
  const [model,setModel]=useState<Model|null>(null),[renderedProject,setRenderedProject]=useState<Project>(p);
  const [buildError,setBuildError]=useState({signature:'',message:''}),[saved,setSaved]=useState(true);
  const [modal,setModal]=useState<null|'export'|'help'>(null),[format,setFormat]=useState('3mf'),[exporting,setExporting]=useState(false);
  const [selectedText,setSelectedText]=useState(p.texts[0]?.id||''),[notice,setNotice]=useState(''),[hasUndo,setHasUndo]=useState(false);
  const [settings,setSettings]=useState<ViewSettings>({rollers:true,dimensions:false,grid:true,wireframe:false,material:DEFAULTS.color,view:'iso',reset:0});
  const [zoom,setZoom]=useState({id:0,factor:1});
  const [installEvent,setInstallEvent]=useState<(Event&{prompt:()=>Promise<void>})|null>(null);
  const fileInput=useRef<HTMLInputElement>(null),fontInput=useRef<HTMLInputElement>(null),worker=useRef<Worker|null>(null);
  const jobs=useRef(new Map<number,Project>()),requestId=useRef(0),undo=useRef<Project|null>(null);
  const signature=JSON.stringify({...p,name:undefined,units:undefined,color:undefined,customFontName:undefined});
  const currentSignature=useRef(signature);currentSignature.current=signature;
  const issues=validate(p),d=derive(p),error=buildError.signature===signature?buildError.message:'';
  const building=model?.signature!==signature&&!issues.length&&!error;
  const ready=!!model&&model.signature===signature&&!issues.length&&!error;
  const units=p.units,unitFactor=units==='in'?25.4:1;
  const fmt=(n:number,digits=units==='in'?4:2)=>Number.isFinite(n)?(n/unitFactor).toFixed(digits):'—';
  const update=(key:keyof Project,value:unknown)=>setP(prev=>({...prev,[key]:value}));
  const updateView=(key:keyof ViewSettings,value:unknown)=>setSettings(s=>({...s,[key]:value}));
  const activeText=p.texts.find(t=>t.id===selectedText)||p.texts[0];
  const updateText=(key:keyof TextLayer,value:unknown)=>setP(prev=>({...prev,texts:prev.texts.map(t=>t.id===activeText?.id?{...t,[key]:value}:t)}));
  const showNotice=(text:string)=>{setNotice(text);};

  useEffect(()=>{
    const w=new Worker(new URL('./model.worker.ts',import.meta.url),{type:'module'});worker.current=w;
    w.onmessage=e=>{
      const data=e.data;
      if(data.id!==requestId.current)return;
      const project=jobs.current.get(data.id);jobs.current.clear();
      if(data.error){if(project)setBuildError({signature:JSON.stringify({...project,name:undefined,units:undefined,color:undefined,customFontName:undefined}),message:data.error});return;}
      if(data.model.signature!==currentSignature.current)return;
      setModel(data.model);if(project)setRenderedProject(project);setBuildError({signature:'',message:''});
    };
    w.onerror=e=>{setBuildError({signature:currentSignature.current,message:`Model engine could not start: ${e.message||'reload the page while connected.'}`});};
    return()=>w.terminate();
  },[]);
  useEffect(()=>{
    if(issues.length)return;
    const timeout=setTimeout(()=>{const id=++requestId.current;jobs.current.clear();jobs.current.set(id,p);worker.current?.postMessage({id,project:p,signature});},150);
    return()=>clearTimeout(timeout);
  },[signature]);
  useEffect(()=>{setSaved(false);const timer=setTimeout(()=>{try{localStorage.setItem(STORAGE,JSON.stringify(p));setSaved(true);}catch{setNotice('Device storage is full or unavailable. Save a project file to keep your settings.');}},450);return()=>clearTimeout(timer);},[p]);
  useEffect(()=>{if(!notice)return;const t=setTimeout(()=>{setNotice('');setHasUndo(false);},8000);return()=>clearTimeout(t);},[notice]);
  useEffect(()=>{
    const install=(e:Event)=>{e.preventDefault();setInstallEvent(e as Event&{prompt:()=>Promise<void>});};window.addEventListener('beforeinstallprompt',install);
    return()=>window.removeEventListener('beforeinstallprompt',install);
  },[]);
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      if((e.target as HTMLElement)?.closest('input,textarea,select,dialog,[role=dialog]'))return;
      if(e.key.toLowerCase()==='f')setSettings(s=>({...s,reset:s.reset+1}));
      if(['1','2','3','4'].includes(e.key))setSettings(s=>({...s,view:({1:'iso',2:'top',3:'bottom',4:'front'} as const)[e.key as '1'],reset:s.reset+1}));
    };window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);
  },[]);

  const saveProject=()=>{download(JSON.stringify(p,null,2),safeName(p.name)+'.gage.json','application/json');showNotice('Project file saved. Open it here to restore every setting.');};
  const openProject=async(file:File)=>{
    try{if(file.size>3500000)throw new Error('Project files must be smaller than 3.5 MB.');const next=importProject(JSON.parse(await file.text())) as Project;
      undo.current=p;setHasUndo(true);setP(next);setSelectedText(next.texts[0]?.id||'');showNotice('Project opened.');
    }catch(e){showNotice(e instanceof Error?e.message:'Could not open project.');}
  };
  const uploadFont=async(file:File)=>{
    try{if(file.size>2000000)throw new Error('Choose a TTF, OTF, or WOFF font under 2 MB.');const bytes=new Uint8Array(await file.arrayBuffer());
      let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));
      setP(prev=>({...prev,customFont:btoa(raw),customFontName:file.name,texts:prev.texts.map(t=>t.id===activeText?.id?{...t,font:'custom'}:t)}));showNotice(`Loaded ${file.name}. The font is included in saved projects.`);
    }catch(e){showNotice(e instanceof Error?e.message:'Font could not be loaded.');}
  };
  const newProject=()=>{undo.current=p;setHasUndo(true);setP(cloneDefaults());setSelectedText('label-1');setTab('geometry');showNotice('Started a new gage.');};
  const addText=()=>{if(p.texts.length>=6)return;const id=crypto.randomUUID();const web=Number.isFinite(d.web)?Math.max(1,d.web):25;const bore=Number.isFinite(d.bore)?d.bore:0;const next={...structuredClone(DEFAULTS.texts[0]),id,text:'YOUR TEXT',layout:'linear',size:Math.min(4.4,web*.18),y:-(bore/2+web*.45),radius:d.diameter*.3} as TextLayer;setP(prev=>({...prev,texts:[...prev.texts,next]}));setSelectedText(id);};
  const exportFile=async(share=false)=>{
    if(!ready||!model)return;setExporting(true);
    try{
      const data=exportModel(format,model,p),info=FORMATS.find(f=>f.id===format)!;
      const name=`${safeName(p.name)}-${fmt(d.nominal)}${units}.${format}`;
      const file=new File([new Uint8Array(data).buffer],name,{type:info.mime});
      if(share&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:p.name});}
      else if(share)throw new Error('File sharing is unavailable in this browser. Use Download instead.');
      else download(data,name,info.mime);
      if(!share)showNotice(`${info.label} exported with text and chamfers. ${format==='glb'?'GLB uses meters.':'Model coordinates are in millimeters.'}`);
    }catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))showNotice(e instanceof Error?e.message:'Export failed.');}
    finally{setExporting(false);}
  };
  const setTarget=(position:number)=>update('targetPosition',position);
  const viewButton=(view:ViewSettings['view'],icon:string,title:string)=><button className={`tool-button ${settings.view===view?'active':''}`} aria-label={title} title={title} aria-pressed={settings.view===view} onClick={()=>setSettings(s=>({...s,view,reset:s.reset+1}))}><Icon name={icon}/></button>;

  return <div className="app-shell">
    <header className="app-header">
      <a className="brand" href="./" aria-label="Between Rollers Gage Studio"><img src="./icon.svg" alt=""/><span><strong>BETWEEN ROLLERS</strong><small>GAGE STUDIO</small></span></a>
      <div className="header-divider"/><label className="project-title"><span className="sr-only">Project name</span><input aria-label="Project name" value={p.name} maxLength={80} onChange={e=>update('name',e.target.value)}/><span className={`save-status ${saved?'saved':''}`} title={saved?'Saved on this device':'Saving on this device'}><span/>{saved?'Saved':'Saving…'}</span></label>
      <nav className="header-actions" aria-label="Project actions">
        <button className="icon-button" title="New gage" aria-label="New gage" onClick={newProject}><Icon name="plus"/></button>
        <button className="icon-button" title="Open project" aria-label="Open project" onClick={()=>fileInput.current?.click()}><Icon name="folder"/></button>
        <button className="icon-button" title="Save project file" aria-label="Save project file" onClick={saveProject}><Icon name="save"/></button>
        <button className="icon-button help-button" title="Geometry guide and shortcuts" aria-label="Geometry guide and shortcuts" onClick={()=>setModal('help')}><Icon name="help"/></button>
        <button className="export-button" onClick={()=>setModal('export')}><Icon name="download" size={17}/><span>Export</span><Icon name="chevron" size={14}/></button>
      </nav>
      <input ref={fileInput} type="file" accept=".json,.gage.json" hidden onChange={e=>{if(e.target.files?.[0])void openProject(e.target.files[0]);e.target.value='';}}/>
      <input ref={fontInput} type="file" accept=".ttf,.otf,.woff" hidden onChange={e=>{if(e.target.files?.[0])void uploadFont(e.target.files[0]);e.target.value='';}}/>
    </header>
    <main className="app-body">
      <aside className="sidebar" aria-label="Gage parameters">
        <nav className="tabs" aria-label="Parameter groups">{([{id:'geometry',label:'Geometry',icon:'sliders'},{id:'text',label:'Lettering',icon:'type'},{id:'print',label:'Print setup',icon:'print'}] as const).map(t=><button key={t.id} className={tab===t.id?'active':''} aria-pressed={tab===t.id} onClick={()=>setTab(t.id)}><Icon name={t.icon} size={16}/>{t.label}</button>)}<div className="unit-switch" aria-label="Display units">{(['in','mm'] as const).map(u=><button key={u} className={units===u?'selected':''} aria-pressed={units===u} onClick={()=>update('units',u)}>{u}</button>)}</div></nav>
        <div className="panel-scroll">
          {tab==='geometry'&&<>
            <Section number="01" title="Roller arrangement">
              <div className="field-grid"><Field label="Roller count" value={p.rollerCount} onChange={v=>update('rollerCount',v)} dimension={false} units="" min={3} max={80}/><Field label="Roller diameter" value={p.rollerDiameter} onChange={v=>update('rollerDiameter',v)} units={units} help="The actual diameter of one roller. This is required to calculate tangent seating faces."/></div>
              <div className="subtle-note"><span className="mini-dot"/>Evenly spaced at {(360/p.rollerCount).toFixed(2)}° · exact tangent contacts</div>
            </Section>
            <Section number="02" title="Between-roller diameter">
              <p className="section-description">The circle through the rollers’ inward-facing apexes.</p>
              <div className="field-grid"><Field label="Minimum diameter" value={p.betweenMin} onChange={v=>update('betweenMin',v)} units={units}/><Field label="Maximum diameter" value={p.betweenMax} onChange={v=>update('betweenMax',v)} units={units}/></div>
              <div className="target-box"><div><span>Design target</span><strong>Ø {fmt(d.nominal)} <small>{units}</small></strong></div><input aria-label="Target within diameter range" type="range" min={0} max={1} step={.001} value={p.targetPosition} onChange={e=>setTarget(Number(e.target.value))}/><div className="segmented">{[['Min',0],['Midpoint',.5],['Max',1]].map(([label,v])=><button key={label} className={Math.abs(p.targetPosition-Number(v))<.001?'active':''} onClick={()=>setTarget(Number(v))}>{label}</button>)}</div></div>
              <p className="fine-note">One rigid gage is generated at the selected target. Change the target to make minimum and maximum gages.</p>
            </Section>
            <Section number="03" title="Gage & probe clearance">
              <Field label="Gage thickness" value={p.thickness} onChange={v=>update('thickness',v)} units={units}/>
              <div className="field-grid"><Field label="Space gap width" value={p.gapWidth} onChange={v=>update('gapWidth',v)} units={units} help="Width between the parallel relief walls, below the two tangent contact flats."/><Field label="Space gap length" value={p.gapLength} onChange={v=>update('gapLength',v)} units={units} help="Radial distance from the inward roller apex to the bottom of the relief slot."/></div>
              <Field label="Cage Clearance Diameter" value={p.cageDiameter} onChange={v=>update('cageDiameter',v)} units={units} help="The very outside diameter of the gage before printing compensation. Contact flats auto-size and remain tangent at their midpoints."/>
              <div className="contact-callout"><Icon name="check" size={15}/><span>Auto flat length: <strong>{fmt(d.flatLength)} {units}</strong> · {(d.contactAngle*180/Math.PI).toFixed(1)}°</span></div>
            </Section>
            <Section number="04" title="Center bore">
              <Toggle label="Add a through bore" checked={p.boreEnabled} onChange={v=>update('boreEnabled',v)}/>
              {p.boreEnabled&&<Field label="Bore diameter" value={p.boreDiameter} onChange={v=>update('boreDiameter',v)} units={units}/>}
            </Section>
            <div className="panel-link"><Icon name="print" size={16}/><button onClick={()=>setTab('print')}>Set compensation & chamfers</button><Icon name="arrow" size={16}/></div>
          </>}
          {tab==='text'&&<>
            <div className="text-intro"><div><h3>Text layers</h3><p>Real embossed or engraved geometry.</p></div><button className="small-button" disabled={p.texts.length>=6} onClick={addText}><Icon name="plus" size={14}/>Add text</button></div>
            <div className="layer-list">{p.texts.map((t,i)=><button key={t.id} className={`layer ${activeText?.id===t.id?'active':''}`} onClick={()=>setSelectedText(t.id)}><span className="layer-icon"><Icon name="type" size={17}/></span><span><strong>{t.text.split('\n')[0]||`Text layer ${i+1}`}</strong><small>{t.face} face · {t.mode}{t.enabled?'':' · hidden'}</small></span><span className="layer-index">{String(i+1).padStart(2,'0')}</span></button>)}</div>
            {activeText?<>
              <div className="text-actions"><Toggle label="Include this layer" checked={activeText.enabled} onChange={v=>updateText('enabled',v)}/><button className="icon-button" title="Duplicate layer" aria-label="Duplicate layer" disabled={p.texts.length>=6} onClick={()=>{const id=crypto.randomUUID();setP(prev=>({...prev,texts:[...prev.texts,{...activeText,id,y:activeText.y-activeText.size*1.5}]}));setSelectedText(id);}}><Icon name="copy" size={15}/></button><button className="icon-button danger" title="Delete layer" aria-label="Delete layer" onClick={()=>{setP(prev=>({...prev,texts:prev.texts.filter(t=>t.id!==activeText.id)}));setSelectedText('');}}><Icon name="trash" size={15}/></button></div>
              <label className="field"><span className="field-label">Text</span><textarea value={activeText.text} maxLength={120} rows={2} onChange={e=>updateText('text',e.target.value)} placeholder="Part number, size, or your label"/></label>
              <div className="field-grid"><Select label="Face" value={activeText.face} onChange={v=>updateText('face',v)} options={[{value:'top',label:'Top face'},{value:'bottom',label:'Bottom face'}]}/><Select label="Operation" value={activeText.mode} onChange={v=>updateText('mode',v)} options={[{value:'emboss',label:'Emboss · raised'},{value:'engrave',label:'Engrave · recessed'}]}/></div>
              <Select label="Arrangement" value={activeText.layout} onChange={v=>updateText('layout',v)} options={[{value:'arc',label:'Around a circle'},{value:'linear',label:'Straight / multiline'}]}/>
              <Section title="Typography">
                <div className="field-grid"><Select label="Font family" value={activeText.font} onChange={v=>updateText('font',v)} options={[{value:'sans',label:'Roboto · Sans'},{value:'serif',label:'Libre Baskerville'},{value:'mono',label:'Roboto Mono'},...(p.customFont?[{value:'custom',label:p.customFontName||'Custom'}]:[])]}/><Select label="Weight" value={activeText.weight} onChange={v=>updateText('weight',v)} options={[{value:'regular',label:'Regular'},{value:'bold',label:'Bold'}]}/></div>
                <button className="upload-font" onClick={()=>fontInput.current?.click()}><Icon name="folder" size={14}/>Upload TTF, OTF, or WOFF</button>
                <div className="field-grid"><Field label="Font size" value={activeText.size} onChange={v=>updateText('size',v)} units={units}/><Field label={activeText.mode==='emboss'?'Raised height':'Engraving depth'} value={activeText.depth} onChange={v=>updateText('depth',v)} units={units}/><Field label="Letter spacing" value={activeText.tracking} onChange={v=>updateText('tracking',v)} units={units}/><Select label="Alignment" value={activeText.align} onChange={v=>updateText('align',v)} options={[{value:'left',label:'Left / start'},{value:'center',label:'Center'},{value:'right',label:'Right / end'}]}/></div>
                {activeText.layout==='linear'&&<Field label="Line spacing" value={activeText.lineHeight} onChange={v=>updateText('lineHeight',v)} units="x" dimension={false} step={.05}/>}
                <Toggle label="Italic / slanted" checked={activeText.italic} onChange={v=>updateText('italic',v)}/>
                <Toggle label="Optical pair kerning" checked={activeText.kerning} onChange={v=>updateText('kerning',v)}/>
                {activeText.font==='custom'&&<p className="fine-note">Custom fonts retain their own weight and style. Use a bold font file for true bold lettering.</p>}
              </Section>
              <Section title="Position & orientation">
                {activeText.layout==='arc'&&<><div className="field-grid"><Field label="Text radius" value={activeText.radius} onChange={v=>updateText('radius',v)} units={units}/><Field label="Anchor angle" value={activeText.angle} onChange={v=>updateText('angle',v)} units="deg" dimension={false}/></div><Toggle label="Clockwise reading" checked={activeText.clockwise} onChange={v=>updateText('clockwise',v)}/></>}
                <div className="field-grid"><Field label="Horizontal offset" value={activeText.x} onChange={v=>updateText('x',v)} units={units}/><Field label="Vertical offset" value={activeText.y} onChange={v=>updateText('y',v)} units={units}/></div>
                <Field label="Rotation" value={activeText.rotation} onChange={v=>updateText('rotation',v)} units="deg" dimension={false}/>
                <button className="small-button full-width" onClick={()=>setSettings(s=>({...s,view:activeText.face,reset:s.reset+1}))}><Icon name="eye" size={15}/>View {activeText.face} face</button>
                <p className="fine-note">Bottom text reads correctly when viewed from underneath. Text must remain entirely on the flat face.</p>
              </Section>
            </>:<div className="empty-text"><Icon name="type" size={30}/><p>Add a text layer to identify your gage.</p><button className="small-button" onClick={addText}>Add your first label</button></div>}
          </>}
          {tab==='print'&&<>
            <Section number="01" title="Printer compensation">
              <p className="section-description">Correct a measured size error with a signed <strong>diametral</strong> adjustment.</p>
              <Field label="Deformation offset" value={p.compensation} onChange={v=>update('compensation',v)} units={units} help="A positive value increases the target diameter; a negative value decreases it. Each radial side moves by half this amount."/>
              <div className="offset-shortcuts"><button onClick={()=>update('compensation',-Math.abs(p.compensation||.254))}>− undersize model</button><button onClick={()=>update('compensation',Math.abs(p.compensation||.254))}>+ oversize model</button></div>
              <div className="compensation-card"><div><span>Nominal span</span><b>{fmt(d.nominal)} {units}</b></div><div><span>Diameter offset</span><b>{p.compensation>=0?'+':''}{fmt(p.compensation)} {units}</b></div><div className="result"><span>Modeled span</span><b>Ø {fmt(d.diameter)} {units}</b></div></div>
              <p className="fine-note">If a measured diameter prints 0.010 in small, enter <strong>+0.010 in</strong>. Each side moves 0.005 in. Roller size, gap dimensions, lettering, and thickness stay nominal.</p>
              <Toggle label="Also compensate bore diameter" checked={p.compensateBore} onChange={v=>update('compensateBore',v)} description={p.boreEnabled?`Modeled bore Ø ${fmt(d.bore)} ${units}`:'Applies when the center bore is enabled'}/>
            </Section>
            <Section number="02" title="Face chamfers">
              <p className="section-description">Size is the setback along the flat face. Angle is measured from that face. Enter zero size for a sharp edge.</p>
              <div className="field-grid"><Field label="Top chamfer" value={p.chamferTop} onChange={v=>update('chamferTop',v)} units={units}/><Field label="Top angle" value={p.chamferTopAngle} onChange={v=>update('chamferTopAngle',v)} units="deg" dimension={false} min={1} max={89}/><Field label="Bottom chamfer" value={p.chamferBottom} onChange={v=>update('chamferBottom',v)} units={units}/><Field label="Bottom angle" value={p.chamferBottomAngle} onChange={v=>update('chamferBottomAngle',v)} units="deg" dimension={false} min={1} max={89}/></div>
              <div className="subtle-note"><Icon name="ruler" size={14}/>Full contact height: {fmt(d.contactHeight)} {units}</div>
            </Section>
            <Section number="03" title="Mesh quality">
              <Select label="Curve resolution" value={p.quality} onChange={v=>update('quality',v)} options={Object.entries(QUALITY).map(([value,q])=>({value,label:`${({draft:'Draft',standard:'Standard',fine:'Fine',ultra:'Ultra fine'} as Record<string,string>)[value]} · ${fmt(q.tolerance,units==='in'?4:4)} ${units} chord tolerance`}))}/>
              <p className="fine-note">Resolution controls curve smoothness. It does not change the entered chamfer size or angle.</p>
            </Section>
            <Section number="04" title="Desktop & phone">
              <p className="section-description">Install Gage Studio for a dedicated window and home-screen icon. The app works offline after its first complete load.</p>
              {installEvent?<button className="small-button full-width" onClick={async()=>{await installEvent.prompt();setInstallEvent(null);}}><Icon name="install" size={16}/>Install Gage Studio</button>:<p className="fine-note">iPhone: Safari → Share → Add to Home Screen.<br/>Android / desktop: use your browser’s Install app command.</p>}
              <button className="small-button full-width" onClick={saveProject}><Icon name="save" size={15}/>Save a portable project</button>
            </Section>
          </>}
          <div className="sidebar-foot"><img src="./icon.svg" alt=""/><span>Made for the measurement.</span><button aria-label="Open geometry guide" onClick={()=>setModal('help')}><Icon name="help" size={16}/></button></div>
        </div>
      </aside>
      <section className="workspace" aria-label="3D design workspace" aria-busy={building}>
        <output className="sr-only" role="status">{ready?'Model ready':building?'Updating model':'Review model settings'}</output>
        <Viewer model={model} project={renderedProject} settings={{...settings,material:p.color}} zoomCommand={zoom}/>
        <div className="viewport-tools"><div className="tool-group">{viewButton('iso','cube','Isometric view · 1')}{viewButton('top','top','Top view · 2')}{viewButton('bottom','bottom','Bottom view · 3')}{viewButton('front','front','Front view · 4')}</div><div className="tool-group"><button className="tool-button" aria-label="Zoom in" title="Zoom in" onClick={()=>setZoom(z=>({id:z.id+1,factor:.82}))}><Icon name="plus"/></button><button className="tool-button" aria-label="Zoom out" title="Zoom out" onClick={()=>setZoom(z=>({id:z.id+1,factor:1.22}))}><Icon name="minus"/></button><button className="tool-button" aria-label="Fit model" title="Fit model · F" onClick={()=>setSettings(s=>({...s,reset:s.reset+1}))}><Icon name="frame"/></button></div></div>
        <div className="display-tools" aria-label="Preview options">{([{key:'rollers',icon:'eye',title:'Roller guides'},{key:'dimensions',icon:'ruler',title:'Diameter guide'},{key:'grid',icon:'grid',title:'Grid'},{key:'wireframe',icon:'wire',title:'Wireframe'}] as const).map(t=><button key={t.key} className={`tool-button ${settings[t.key]?'active':''}`} aria-label={t.title} title={t.title} aria-pressed={settings[t.key]} onClick={()=>updateView(t.key,!settings[t.key])}><Icon name={t.icon}/></button>)}<span className="tool-separator"/><label className="color-control" title="Gage color"><span className="sr-only">Gage color</span><input type="color" aria-label="Gage color" value={p.color} onChange={e=>update('color',e.target.value)}/></label></div>
        {(issues.length>0||error)&&<div className="validation-banner" role="alert"><Icon name="warning" size={18}/><div><strong>Adjust the model to continue</strong>{(issues.length?issues:[error]).map((msg:string)=><p key={msg}>{msg}</p>)}{model&&<small>Showing the previous valid model. Export is paused.</small>}</div></div>}
        {building&&<div className="building-pill"><span className="spinner"/>{model?'Updating geometry':'Preparing your workspace'}</div>}
      </section>
    </main>
    {notice&&<div className="toast" role="status"><Icon name="info" size={17}/><span>{notice}</span>{hasUndo&&<button onClick={()=>{if(undo.current){setP(undo.current);setSelectedText(undo.current.texts[0]?.id||'');setHasUndo(false);setNotice('Previous project restored.');}}}>Undo</button>}<button className="icon-button" aria-label="Dismiss notification" onClick={()=>setNotice('')}><Icon name="close" size={15}/></button></div>}
    {modal==='export'&&<Modal title="Ready for the next step." onClose={()=>setModal(null)}>
      <p className="modal-description">Export the gage at its modeled size. Roller guides, grids, and dimensions are excluded.</p>
      <div className="export-summary"><span className="export-model-icon"><Icon name="cube" size={28}/></span><div><strong>{p.name||'My roller gage'}</strong><span>{p.rollerCount} rollers · Ø {fmt(d.diameter)} {units} modeled span</span></div><span className={`health-chip ${ready?'':'invalid'}`}>{ready?'Watertight':'Not ready'}</span></div>
      <div className="export-formats" role="radiogroup" aria-label="Export format">{FORMATS.map(f=><label key={f.id} className={`format-option ${format===f.id?'selected':''}`}><input type="radio" name="format" value={f.id} checked={format===f.id} onChange={()=>setFormat(f.id)}/><strong>{f.label}</strong><span>{f.detail}</span>{f.id==='3mf'&&<small>BEST FOR PRINTING</small>}</label>)}</div>
      <div className="export-notes"><Icon name="info" size={17}/><p>{format==='3mf'?'3MF contains one solid in explicit millimeter units and a copy of the editable project. Open it as a model in your slicer.':'STL, OBJ, and PLY use millimeter coordinates. GLB uses meters and Y-up for standard 3D viewers.'}<br/>Lettering and chamfers are built into every exported mesh.<br/>{model?.triangles.toLocaleString()} triangles · {model?(model.volume/1000).toFixed(1):'—'} cm³</p></div>
      {!ready&&<p className="export-error">{issues[0]||error||'Wait for the current model to finish building before exporting.'}</p>}
      <div className="modal-buttons"><button className="small-button" onClick={saveProject}><Icon name="save" size={16}/>Save project</button>{typeof navigator.share==='function'&&<button className="small-button" disabled={!ready||exporting} onClick={()=>void exportFile(true)}>Share file</button>}<button className="export-button" disabled={!ready||exporting} onClick={()=>void exportFile()}><Icon name="download" size={17}/>{exporting?'Exporting…':`Download .${format}`}</button></div>
    </Modal>}
    {modal==='help'&&<Modal title="A guide to the geometry." onClose={()=>setModal(null)}>
      <img className="help-diagram" src="./geometry-guide.svg" alt="A roller seated between two tangent flats, with its inward apex exposed over an open relief slot."/>
      <div className="help-copy"><h3>Defined from the roller outward</h3><p>The between-roller diameter is the circle through the inward-facing apexes. The roller center radius is half that diameter plus half the roller diameter. Slots repeat evenly around the gage.</p><h3>Centered, tangent contact flats</h3><p>Each flat touches the roller at its exact midpoint. Its normal passes through the roller center, making it perpendicular to the surface at contact. Cage Clearance Diameter sets the outside tooth diameter. Flat length and contact angle are solved automatically from that diameter and the gap width.</p><h3>Two dimensions for probe access</h3><p>Gap width is the distance between the parallel relief walls. Gap length runs radially inward from the roller apex to the slot floor. Chamfers reduce the usable contact height at the top and bottom.</p><h3>Compensation is on the diameter</h3><p>Positive compensation enlarges both the between-roller span and the specified cage clearance diameter by exactly the entered amount; each radial side shifts by half. Bore compensation can be toggled separately. This is an additive size correction, not a percentage shrink scale.</p><h3>Working with the model</h3><p>Drag to orbit. Scroll or pinch to zoom. Right-drag, Shift-drag, or use two fingers to pan. Use 1–4 for views and F to fit. Roller guides do not export. The saved project keeps every setting, including uploaded fonts.</p><h3>Before making a measuring tool</h3><p>The model describes the nominal seating geometry. Verify probe-ball access, roller seating, and finished dimensions on the actual printed part; material stiffness and printing process affect the result.</p></div>
      <div className="modal-buttons"><button className="export-button" onClick={()=>setModal(null)}>Back to the model<Icon name="arrow" size={16}/></button></div>
    </Modal>}
  </div>;
}
