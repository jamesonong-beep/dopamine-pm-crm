'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowUpRight,Edit3,ExternalLink,FileText,GripVertical,Image as ImageIcon,Lock,Megaphone,Pin,PinOff,Plus,Sparkles,StickyNote,Trash2,Upload,X} from 'lucide-react';
import {ResponsiveModal} from '@/components/ui/responsive-modal';
import {Button} from '@/components/ui/button';
import type {State} from '../lib/model';

import {normalizeStudioPinSlots,type StudioPin,type StudioPinKind,type StudioNoteColor} from '../lib/studio-pins';

const fmtDate=(iso:string)=>iso?new Date(iso).toLocaleDateString('en-PH',{month:'short',day:'numeric'}):'';

function compressImageFile(file:File):Promise<string>{
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onerror=()=>reject(new Error('Could not read image file'));
  reader.onload=()=>{
   const img=new window.Image();
   img.onerror=()=>reject(new Error('Unsupported image format'));
   img.onload=()=>{
    const maxDim=920;
    const scale=Math.min(1,maxDim/Math.max(img.width,img.height));
    const w=Math.max(1,Math.round(img.width*scale));
    const h=Math.max(1,Math.round(img.height*scale));
    const canvas=document.createElement('canvas');
    canvas.width=w;
    canvas.height=h;
    const ctx=canvas.getContext('2d');
    if(!ctx){reject(new Error('Could not compress image'));return;}
    ctx.drawImage(img,0,0,w,h);
    for(const quality of [0.78,0.6,0.4,0.25]){
     const jpeg=canvas.toDataURL('image/jpeg',quality);
     if(jpeg.length<=150000){resolve(jpeg);return;}
    }
    reject(new Error('This image is too detailed. Try a smaller image.'));
   };
   img.src=String(reader.result||'');
  };
  reader.readAsDataURL(file);
 });
}

type StudioBoardProps={
 state:State;
 pins:StudioPin[];
 authorName:string;
 canEdit:boolean;
 onAddPin:(pin:Omit<StudioPin,'id'|'createdAt'>)=>void;
 onUpdatePin:(id:string,patch:Partial<Omit<StudioPin,'id'|'createdAt'>>)=>void;
 onTogglePinTop:(id:string)=>void;
 onDeletePin:(id:string)=>void;
 onMovePinToSlot:(pinId:string,targetSlot:number)=>void;
 onOpenDocuments?:()=>void;
};

export default function StudioBoard({
 state,pins,authorName,canEdit,onAddPin,onUpdatePin,onTogglePinTop,onDeletePin,onMovePinToSlot,onOpenDocuments
}:StudioBoardProps){
 const [filter,setFilter]=useState<'all'|StudioPinKind>('all');
 const [search,setSearch]=useState('');
 const [openModal,setOpenModal]=useState(false);
 const [editingId,setEditingId]=useState('');
 const [kind,setKind]=useState<StudioPinKind>('postit');
 const [title,setTitle]=useState('');
 const [body,setBody]=useState('');
 const [color,setColor]=useState<StudioNoteColor>('butter');
 const [tag,setTag]=useState('');
 const [imageUrl,setImageUrl]=useState('');
 const [fileName,setFileName]=useState('');
 const [linkUrl,setLinkUrl]=useState('');
 const [documentId,setDocumentId]=useState('');
 const [pinTop,setPinTop]=useState(false);
 const [targetSlotForNew,setTargetSlotForNew]=useState<number|undefined>(undefined);
 const [uploadErr,setUploadErr]=useState('');
 const fileInputRef=useRef<HTMLInputElement|null>(null);

 // Pointer drag-and-place onto any unlocked 3xN board slot
 const [draggingId,setDraggingId]=useState('');
 const [dragPoint,setDragPoint]=useState<{x:number;y:number}|null>(null);
 const [dropSlot,setDropSlot]=useState<number|null>(null);
 const dragRef=useRef<{pin:StudioPin;x:number;y:number;active:boolean}|null>(null);
 const dropSlotRef=useRef<number|null>(null);
 const moveRef=useRef(onMovePinToSlot);
 moveRef.current=onMovePinToSlot;

 const slottedPins=useMemo(()=>normalizeStudioPinSlots(pins),[pins]);
 const pinnedSlotsRef=useRef<Set<number>>(new Set());
 pinnedSlotsRef.current=new Set(slottedPins.filter(p=>p.pinned).map(p=>p.slot??-1));

 useEffect(()=>{
  const clearDrag=()=>{
   dragRef.current=null;
   dropSlotRef.current=null;
   setDraggingId('');
   setDragPoint(null);
   setDropSlot(null);
  };
  const onMove=(e:PointerEvent)=>{
   const d=dragRef.current;
   if(!d)return;
   if(e.buttons===0){clearDrag();return;}
   if(!d.active){
    if(Math.hypot(e.clientX-d.x,e.clientY-d.y)<6)return;
    d.active=true;
    setDraggingId(d.pin.id);
   }
   const px=Math.max(8,Math.min(e.clientX+16,window.innerWidth-256));
   const py=Math.max(8,Math.min(e.clientY+16,window.innerHeight-110));
   setDragPoint({x:px,y:py});
   const el=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-studio-slot]');
   const rawSlot=el?.dataset.studioSlot;
   if(rawSlot===undefined){
    dropSlotRef.current=null;
    setDropSlot(null);
    return;
   }
   const slotNum=Number(rawSlot);
   if(Number.isNaN(slotNum)||slotNum===d.pin.slot||pinnedSlotsRef.current.has(slotNum)){
    dropSlotRef.current=null;
    setDropSlot(null);
    return;
   }
   dropSlotRef.current=slotNum;
   setDropSlot(slotNum);
  };
  const onUp=()=>{
   const d=dragRef.current;
   if(!d)return;
   const slot=dropSlotRef.current;
   const wasActive=d.active;
   clearDrag();
   if(wasActive&&slot!==null&&slot!==d.pin.slot&&!pinnedSlotsRef.current.has(slot)){
    moveRef.current(d.pin.id,slot);
   }
  };
  const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')clearDrag();};
  window.addEventListener('pointermove',onMove);
  window.addEventListener('pointerup',onUp);
  window.addEventListener('pointercancel',clearDrag);
  window.addEventListener('blur',clearDrag);
  window.addEventListener('keydown',onKey);
  return()=>{
   window.removeEventListener('pointermove',onMove);
   window.removeEventListener('pointerup',onUp);
   window.removeEventListener('pointercancel',clearDrag);
   window.removeEventListener('blur',clearDrag);
   window.removeEventListener('keydown',onKey);
  };
 },[]);

 const startPinPointer=(e:React.PointerEvent<HTMLElement>,pin:StudioPin)=>{
  if(!canEdit||pin.pinned||e.button!==0)return;
  if((e.target as HTMLElement).closest('button,a,input,select,textarea,label'))return;
  e.preventDefault();
  dragRef.current={pin,x:e.clientX,y:e.clientY,active:false};
 };

 const draggingPin=draggingId?slottedPins.find(p=>p.id===draggingId):undefined;
 const pinnedAnnouncements=useMemo(()=>slottedPins.filter(p=>p.pinned),[slottedPins]);
 const isFiltered=filter!=='all'||Boolean(search.trim());
 const filteredPins=useMemo(()=>{
  const q=search.trim().toLowerCase();
  return slottedPins.filter(p=>{
   if(filter!=='all'&&p.kind!==filter)return false;
   if(!q)return true;
   return `${p.title} ${p.body} ${p.tag||''} ${p.author}`.toLowerCase().includes(q);
  });
 },[slottedPins,filter,search]);

 // Default 3x2 (6 slots); expands to 3x3 (9), 3x4 (12), etc. as more cards are added
 const {totalSlots,slotMap,rowCount}=useMemo(()=>{
  const map=new Map<number,StudioPin>();
  let maxSlot=5;
  for(const p of slottedPins){
   const s=p.slot??0;
   map.set(s,p);
   if(s>maxSlot)maxSlot=s;
  }
  let rows=Math.max(2,Math.ceil((maxSlot+1)/3));
  if(slottedPins.length>=rows*3)rows+=1;
  return {totalSlots:rows*3,slotMap:map,rowCount:rows};
 },[slottedPins]);

 const resetForm=(nextKind:StudioPinKind='postit',slot?:number)=>{
  setEditingId('');
  setKind(nextKind);
  setTitle('');
  setBody('');
  setColor('butter');
  setTag(nextKind==='announcement'?'Announcement':nextKind==='image'?'Inspiration':nextKind==='document'?'Reference':'Idea');
  setImageUrl('');
  setFileName('');
  setLinkUrl('');
  setDocumentId('');
  setPinTop(nextKind==='announcement');
  setTargetSlotForNew(slot);
  setUploadErr('');
  if(fileInputRef.current)fileInputRef.current.value='';
  setOpenModal(true);
 };

 const openEditModal=(pin:StudioPin)=>{
  if(!canEdit)return;
  setEditingId(pin.id);
  setKind(pin.kind);
  setTitle(pin.title||'');
  setBody(pin.body||'');
  setColor(pin.color||'butter');
  setTag(pin.tag||'');
  setImageUrl(pin.imageUrl||'');
  setFileName('');
  setLinkUrl(pin.linkUrl||'');
  setDocumentId(pin.documentId||'');
  setPinTop(Boolean(pin.pinned));
  setTargetSlotForNew(pin.slot);
  setUploadErr('');
  if(fileInputRef.current)fileInputRef.current.value='';
  setOpenModal(true);
 };

 const handleFile=async(e:React.ChangeEvent<HTMLInputElement>)=>{
  const file=e.target.files?.[0];
  if(!file)return;
  setUploadErr('');
  try{
   const dataUrl=await compressImageFile(file);
   setImageUrl(dataUrl);
   setFileName(file.name);
   if(!title.trim())setTitle(file.name.replace(/\.[^.]+$/,''));
  }catch(err){
   setUploadErr((err as Error).message||'Could not load image');
  }
 };

 const submit=(e:React.FormEvent)=>{
  e.preventDefault();
  if(!title.trim()&&!body.trim())return;
  const linkedDoc=documentId?(state.documents||[]).find(d=>d.id===documentId):undefined;
  const payload={
   kind,
   title:title.trim()||linkedDoc?.title||'Untitled pin',
   body:body.trim()||linkedDoc?.description||'',
   color:kind==='postit'?color:undefined,
   imageUrl:kind==='image'?imageUrl.trim()||undefined:undefined,
   linkUrl:kind==='document'?(linkedDoc?.url||linkUrl.trim()||undefined):undefined,
   documentId:kind==='document'&&linkedDoc?linkedDoc.id:undefined,
   tag:tag.trim()||undefined,
   pinned:pinTop
  };
  if(editingId){
   onUpdatePin(editingId,payload);
  }else{
   onAddPin({
    ...payload,
    slot:targetSlotForNew,
    author:authorName||'Workspace member'
   });
  }
  setEditingId('');
  setOpenModal(false);
 };

 const renderPinCard=(p:StudioPin)=>{
  const linkedDoc=p.documentId?(state.documents||[]).find(d=>d.id===p.documentId):undefined;
  const href=linkedDoc?.url||p.linkUrl;
  const isDragging=draggingId===p.id;
  return <article
   key={p.id}
   draggable={false}
   onDragStart={e=>e.preventDefault()}
   onPointerDown={e=>startPinPointer(e,p)}
   onDoubleClick={e=>{if(!canEdit)return;if((e.target as HTMLElement).closest('button,a,input,select,textarea,label'))return;openEditModal(p);}}
   title={canEdit?'Double-click to edit':undefined}
   className={`studio-pin studio-pin-${p.kind}${p.color?` studio-color-${p.color}`:''}${p.pinned?' is-pinned':''}${isDragging?' studio-pin-dragging':''}`}
   style={{cursor:canEdit&&!p.pinned?'grab':'default'}}
  >
   <span className="studio-tack" aria-hidden="true"/>
   <div className="studio-card-top">
    <span className="studio-tag">
     {p.kind==='announcement'&&<Megaphone size={12}/>}
     {p.kind==='postit'&&<StickyNote size={11}/>}
     {p.kind==='image'&&<Sparkles size={11}/>}
     {p.kind==='document'&&<FileText size={11}/>}
     {p.tag||(p.kind==='announcement'?'Announcement':p.kind==='image'?'Mood & Vision':p.kind==='document'?'Pinned Doc':'Post-it')}
    </span>
    <div className="studio-card-actions">
     {canEdit&&<button type="button" className="studio-icon-btn" title="Edit card (or double-click card)" aria-label={`Edit ${p.title}`} onClick={()=>openEditModal(p)}><Edit3 size={13}/></button>}
     {canEdit&&<button type="button" className={'studio-pin-toggle'+(p.pinned?' active':'')} title={p.pinned?'Unpin to unlock moving & deletion':'Pin to top & lock against moving or deletion'} onClick={()=>onTogglePinTop(p.id)}>
      {p.pinned?<><PinOff size={11}/> Pinned</>:<><Pin size={11}/> Pin</>}
     </button>}
     {canEdit&&!p.pinned&&<span className="studio-drag-handle" aria-hidden="true" title="Drag to any open slot"><GripVertical size={13}/></span>}
     {canEdit&&!p.pinned&&<button type="button" className="studio-icon-btn" title="Delete card" onClick={()=>onDeletePin(p.id)}><Trash2 size={13}/></button>}
     {p.pinned&&<span className="studio-lock-icon" title="Pinned — locked from moving or deletion (unpin first)"><Lock size={12}/></span>}
    </div>
   </div>
   {p.kind==='image'&&p.imageUrl&&<div className="studio-pin-image-wrap"><img src={p.imageUrl} alt={p.title} loading="lazy"/></div>}
   <h3>{p.title}</h3>
   {p.body&&<p>{p.body}</p>}
   {href&&<a className="studio-link" href={href} target="_blank" rel="noopener noreferrer">{linkedDoc?`${linkedDoc.docType} v${linkedDoc.version}`:'Open resource'} <ExternalLink size={12}/></a>}
   {p.kind==='document'&&!href&&onOpenDocuments&&<button type="button" className="mini-btn" onClick={onOpenDocuments}>Open Documents</button>}
   <div className="studio-pin-foot">
    <small>{p.author} · {fmtDate(p.createdAt)}</small>
    {p.pinned&&<span className="studio-pinned-badge"><Lock size={10}/> Pinned · Locked</span>}
   </div>
  </article>;
 };

 return <div className={'studio-board-page'+(draggingId?' is-dragging':'')}>
  {dragPoint&&draggingPin&&<div className="deal-pointer-preview" aria-live="polite" style={{transform:`translate3d(${dragPoint.x}px,${dragPoint.y}px,0)`}}>
   <strong>{draggingPin.title}</strong>
   <small>{draggingPin.tag||draggingPin.kind} · {draggingPin.author}</small>
   <span>{dropSlot!==null?`Drop into slot ${dropSlot+1}`:'Drag onto an open or unpinned slot'}</span>
  </div>}

  <div className="toolbar studio-board-toolbar">
   <div className="segmented">
    {([
     ['all','All pins'],
     ['announcement','Announcements'],
     ['postit','Post-its'],
     ['image','Mood & Images'],
     ['document','Docs & Links']
    ] as const).map(([k,lbl])=><button key={k} type="button" className={filter===k?'selected':''} onClick={()=>setFilter(k)}>{lbl}</button>)}
   </div>
   <input
    type="search"
    aria-label="Search studio board"
    placeholder="Search pins, tags, or authors…"
    value={search}
    onChange={e=>setSearch(e.target.value)}
    style={{maxWidth:240}}
   />
   {canEdit&&<div className="actions">
    <button type="button" onClick={()=>resetForm('postit')}><StickyNote size={15}/> Post-it</button>
    <button type="button" onClick={()=>resetForm('image')}><ImageIcon size={15}/> Image</button>
    <button type="button" onClick={()=>resetForm('document')}><FileText size={15}/> Doc / Link</button>
    <button type="button" className="primary" onClick={()=>resetForm('announcement')}><Megaphone size={15}/> Announce</button>
   </div>}
  </div>

  {pinnedAnnouncements.length>0&&!isFiltered&&<section className="studio-pinned-strip" aria-label="Pinned studio announcements">
   <div className="studio-pinned-head">
    <strong><Pin size={14}/> Pinned to top ({pinnedAnnouncements.length})</strong>
    <small>Highlighted on Studio Board &amp; Overview — double-click any card to edit</small>
   </div>
   <div className="studio-pinned-grid">
    {pinnedAnnouncements.map(p=><article key={p.id} onDoubleClick={e=>{if(!canEdit)return;if((e.target as HTMLElement).closest('button,a'))return;openEditModal(p);}} title={canEdit?'Double-click to edit':undefined} className={'studio-pinned-card'+(p.kind==='announcement'?' is-announcement':'')}>
     <div className="studio-card-top">
      <span className="studio-tag">{p.kind==='announcement'&&<Megaphone size={11}/>}{p.tag||(p.kind==='announcement'?'Announcement':'Pinned')}</span>
      {canEdit&&<div className="studio-card-actions">
       <button type="button" className="studio-icon-btn" title="Edit card" aria-label={`Edit ${p.title}`} onClick={()=>openEditModal(p)}><Edit3 size={13}/></button>
       <button type="button" className="studio-pin-toggle active" title="Unpin to unlock moving & deletion" onClick={()=>onTogglePinTop(p.id)}><PinOff size={11}/> Unpin</button>
      </div>}
     </div>
     <h3>{p.title}</h3>
     {p.body&&<p>{p.body}</p>}
     {p.linkUrl&&<a className="studio-link" href={p.linkUrl} target="_blank" rel="noopener noreferrer">Open link <ExternalLink size={12}/></a>}
     <small className="studio-meta">{p.author} · {fmtDate(p.createdAt)}</small>
    </article>)}
   </div>
  </section>}

  <section className="studio-wall" aria-label="Studio bulletin and dream board">
   <div className="studio-wall-hint">
    <small>Board layout: <strong>3×{rowCount}</strong> ({slottedPins.length} of {totalSlots} slots used){canEdit?' · Double-click any card to edit. Drag unpinned cards onto any open slot or swap with another unpinned card. Pinned cards are locked from moving and deletion.':''}</small>
   </div>
   {!isFiltered?(
    <div className="studio-slot-grid">
     {Array.from({length:totalSlots},(_,slotIdx)=>{
      const pin=slotMap.get(slotIdx);
      const isDrop=dropSlot===slotIdx;
      return <div
       key={slotIdx}
       data-studio-slot={slotIdx}
       className={'studio-slot'+(pin?' occupied':' empty')+(pin?.pinned?' is-locked':'')+(isDrop?' studio-slot-drop':'')}
      >
       {pin?renderPinCard(pin):(
        <button
         type="button"
         className="studio-empty-slot-btn"
         disabled={!canEdit}
         onClick={()=>resetForm('postit',slotIdx)}
        >
         <Plus size={16}/>
         <span>{isDrop?'Drop card here':'Empty slot · Click to pin'}</span>
        </button>
       )}
      </div>;
     })}
    </div>
   ):filteredPins.length>0?(
    <div className="studio-slot-grid">
     {filteredPins.map(p=><div key={p.id} className={'studio-slot occupied'+(p.pinned?' is-locked':'')}>{renderPinCard(p)}</div>)}
    </div>
   ):<div className="empty">No pins match this filter yet. Click Post-it, Image, Doc / Link, or Announce to add to the board.</div>}
  </section>

  <ResponsiveModal open={openModal} onOpenChange={(next)=>{setOpenModal(next);if(!next)setEditingId('');}} title={editingId?'Edit Studio Card':'Pin to Studio Board'}>
   <form onSubmit={submit}>
    <div className="segmented" style={{marginBottom:'0.9rem',flexWrap:'wrap'}}>
     {([
      ['postit','Post-it'],
      ['image','Image / Mood'],
      ['document','Document / Link'],
      ['announcement','Announcement']
     ] as const).map(([k,lbl])=><button key={k} type="button" className={kind===k?'selected':''} onClick={()=>{setKind(k);if(!editingId&&k==='announcement')setPinTop(true);}}>{lbl}</button>)}
    </div>
    <div className="form-grid">
     <label className="full">Title<input required value={title} onChange={e=>setTitle(e.target.value)} placeholder={kind==='announcement'?'e.g. Friday client showcase at 4 PM':kind==='image'?'e.g. Campaign visual direction':'e.g. Q4 dream client list'}/></label>
     <label className="full">Details / Caption<textarea rows={3} value={body} onChange={e=>setBody(e.target.value)} placeholder="Write a quick note, inspiration, or announcement…"/></label>
     <label>Tag<input value={tag} onChange={e=>setTag(e.target.value)} placeholder="e.g. Inspiration, Win, Reminder"/></label>
     {kind==='postit'&&<label>Sticky color
      <div className="studio-color-picker">
       {(['butter','terracotta','sage','sky','ochre'] as const).map(c=><button key={c} type="button" aria-label={`Color ${c}`} className={`studio-swatch studio-swatch-${c}${color===c?' active':''}`} onClick={()=>setColor(c)}/>)}
      </div>
     </label>}
     {kind==='image'&&<>
      <div className="full file-pill-field">
       <span className="file-pill-label">Upload image from your computer</span>
       <div className="file-pill-row">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="sr-only"/>
        <button type="button" className="file-pill-btn" onClick={()=>fileInputRef.current?.click()}>
         <Upload size={14}/>{fileName||imageUrl?'Change image':'Choose File'}
        </button>
        <span className="file-pill-name">{fileName||(imageUrl?'Current image attached':'No file selected')}</span>
        {(fileName||imageUrl)&&<button type="button" className="mini-btn" onClick={()=>{setFileName('');setImageUrl('');if(fileInputRef.current)fileInputRef.current.value='';}}><X size={12}/>Clear</button>}
       </div>
      </div>
      <label className="full">Or paste an image URL<input type="url" value={imageUrl.startsWith('data:')?'':imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="https://…"/></label>
      {uploadErr&&<p className="error full">{uploadErr}</p>}
      {imageUrl&&<div className="studio-pin-image-wrap full" style={{maxHeight:180}}><img src={imageUrl} alt="Preview"/></div>}
     </>}
     {kind==='document'&&<>
      {(state.documents||[]).length>0&&<label className="full">Pick from workspace Documents
       <select value={documentId} onChange={e=>{const id=e.target.value;setDocumentId(id);const d=(state.documents||[]).find(x=>x.id===id);if(d&&!title.trim())setTitle(d.title);}}>
        <option value="">— Or paste an external link below —</option>
        {(state.documents||[]).map(d=><option key={d.id} value={d.id}>{d.title} ({d.docType} · v{d.version})</option>)}
       </select>
      </label>}
      <label className="full">External link URL<input type="url" value={linkUrl} onChange={e=>setLinkUrl(e.target.value)} placeholder="https://…"/></label>
     </>}
    </div>
    <div className="permission-list" style={{marginTop:'0.75rem'}}>
     <label><input type="checkbox" checked={pinTop} onChange={e=>setPinTop(e.target.checked)}/>Pin to top &amp; lock against moving or deletion (also highlights on Overview)</label>
    </div>
    <div className="modal-actions">
     <Button type="button" variant="outline" onClick={()=>{setOpenModal(false);setEditingId('');}}>Cancel</Button>
     <Button type="submit">{editingId?'Save changes':<><Plus size={15}/> Pin to board</>}</Button>
    </div>
   </form>
  </ResponsiveModal>
 </div>;
}

export function StudioBoardOverviewStrip({pins,onOpenBoard}:{pins:StudioPin[];onOpenBoard:()=>void}){
 const featured=useMemo(()=>{
  const pinned=pins.filter(p=>p.pinned);
  const rest=pins.filter(p=>!p.pinned);
  return [...pinned,...rest].slice(0,3);
 },[pins]);
 return <section className="panel studio-overview-strip">
  <div className="section-heading">
   <div>
    <h2>Studio Board</h2>
    <p>Pinned team announcements, mood references, and dream goals.</p>
   </div>
   <button type="button" onClick={onOpenBoard}>Open Studio Board <ArrowUpRight size={15}/></button>
  </div>
  <div className="studio-overview-grid">
   {featured.map(p=><button key={p.id} type="button" className={`studio-mini-card studio-pin-${p.kind}${p.color?` studio-color-${p.color}`:''}`} onClick={onOpenBoard}>
    <div className="studio-card-top">
     <span className="studio-tag">{p.kind==='announcement'&&<Megaphone size={10}/>}{p.pinned?'Pinned':(p.tag||p.kind)}</span>
     <small>{fmtDate(p.createdAt)}</small>
    </div>
    {p.kind==='image'&&p.imageUrl&&<div className="studio-mini-thumb"><img src={p.imageUrl} alt={p.title}/></div>}
    <strong>{p.title}</strong>
    {p.body&&<p>{p.body}</p>}
   </button>)}
  </div>
 </section>;
}
