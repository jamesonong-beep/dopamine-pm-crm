'use client';
import {useState} from 'react';
import {Pin,Plus,CheckSquare,StickyNote,LockKeyhole,Unlock,History,Edit3} from 'lucide-react';
import type {Note,NoteRevision,RecordLink,RecordLinkType,State,Task} from '../lib/model';
import {hasDirectLink,matchesBrandScope,matchesCompanyScope,originLabelsForContext,sortNotes,taskLinks} from '../lib/workspace-links';
import {compareRecordDates,compareRecordNames,orderRecords,type RecordSort} from '../lib/record-order';
import RecordSortSelect from './record-sort-select';

type UnlockedNoteData={text:string;edits?:NoteRevision[];passcode?:string};

type Props={
 state:State;
 contextType:RecordLinkType;
 contextId:string;
 editable:boolean;
 busy:boolean;
 showTodos?:boolean;
 allowRelatedToggle?:boolean;
 matchesTask?:(t:Task)=>boolean;
 unlockedNotes?:Record<string,UnlockedNoteData>;
 onUnlockNote?:(note:Note,passcode:string)=>Promise<string|null>;
 onLockNote?:(noteId:string)=>void;
 onAddNote:(initialLinks:RecordLink[])=>void;
 onEditNote:(note:Note)=>void;
 onTogglePin:(note:Note)=>void;
 onCreateTaskFromNote:(note:Note)=>void;
 onAddTask:(initialLinks:RecordLink[])=>void;
 onEditTask:(task:Task)=>void;
 onTaskStatus:(taskId:string,status:string)=>void;
 onTaskOwner:(task:Task,owner:string)=>void;
 onTaskDue:(task:Task,due:string)=>void;
};

const formatDateTime=(iso?:string)=>iso?new Date(iso).toLocaleString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Date not recorded';
const formatShortDate=(d?:string)=>d?new Date(d+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'}):'—';

export default function NotesTodosPanel({
 state,
 contextType,
 contextId,
 editable,
 busy,
 showTodos=true,
 allowRelatedToggle=false,
 matchesTask,
 unlockedNotes,
 onUnlockNote,
 onLockNote,
 onAddNote,
 onEditNote,
 onTogglePin,
 onCreateTaskFromNote,
 onAddTask,
 onEditTask,
 onTaskStatus,
 onTaskOwner,
 onTaskDue
}:Props){
 const [mode,setMode]=useState<'direct'|'related'>(allowRelatedToggle?'related':'direct');
 const [passcodes,setPasscodes]=useState<Record<string,string>>({});
 const [unlockErrors,setUnlockErrors]=useState<Record<string,string>>({});
 const [unlockingId,setUnlockingId]=useState('');
 const [noteSort,setNoteSort]=useState<RecordSort|'updated'>('updated');
 const [todoSort,setTodoSort]=useState<RecordSort|'due'>('due');
 const effectiveMode=allowRelatedToggle?mode:'direct';

 const matchesLinks=(links:RecordLink[])=>{
  if(contextType==='company')return matchesCompanyScope(state,links,contextId,effectiveMode);
  if(contextType==='brand')return matchesBrandScope(state,links,contextId,effectiveMode);
  return hasDirectLink(links,contextType,contextId);
 };

 // Deduplicate by ID so multi-linked items never appear twice in Direct or Related views.
 const matchingNotes=Array.from(
   new Map(
    (state.notes||[]).filter(n=>matchesLinks(n.links)).map(n=>[n.id,n])
   ).values()
 );
 const notes=noteSort==='updated'?sortNotes(matchingNotes):orderRecords(matchingNotes,noteSort,n=>n.title||'Untitled note',n=>n.pinned);

 const matchingTasks=showTodos?Array.from(
  new Map(
   state.tasks
    .filter(t=>(!matchesTask||matchesTask(t))&&matchesLinks(taskLinks(t)))
    .map(t=>[t.id,t])
  ).values()
 ):[];
 const tasks=todoSort==='due'
  ? matchingTasks.sort((a,b)=>compareRecordDates(a.due,b.due,false)||compareRecordNames(a.name,b.name))
  : orderRecords(matchingTasks,todoSort,t=>t.name);

 const defaultLink:RecordLink[]=[{type:contextType,id:contextId}];

 async function handleUnlock(n:Note){
  if(!onUnlockNote)return;
  const code=(passcodes[n.id]||'').trim();
  if(!code){setUnlockErrors(prev=>({...prev,[n.id]:'Enter passcode to unlock'}));return;}
  setUnlockingId(n.id);
  setUnlockErrors(prev=>({...prev,[n.id]:''}));
  const err=await onUnlockNote(n,code);
  setUnlockingId('');
  if(err){
   setUnlockErrors(prev=>({...prev,[n.id]:err}));
  }else{
   setPasscodes(prev=>({...prev,[n.id]:''}));
  }
 }

 return <div className="notes-todos-wrap">
  <div className="notes-todos-head">
   <div className="row">
    <strong>{showTodos?'Notes & To-dos':'Notes'}</strong>
    <span className="badge purple">{notes.length} {notes.length===1?'note':'notes'}</span>
    {showTodos&&<span className="badge blue">{tasks.length} {tasks.length===1?'to-do':'to-dos'}</span>}
   </div>
   <div className="actions">
    {allowRelatedToggle&&<div className="segmented" role="group" aria-label="Scope view">
     <button type="button" className={mode==='direct'?'selected':''} onClick={()=>setMode('direct')}>Direct</button>
     <button type="button" className={mode==='related'?'selected':''} onClick={()=>setMode('related')}>Related</button>
    </div>}
    {editable&&<button type="button" disabled={busy} onClick={()=>onAddNote(defaultLink)}><Plus size={14}/>Add Note</button>}
    {editable&&showTodos&&<button type="button" disabled={busy} onClick={()=>onAddTask(defaultLink)}><CheckSquare size={14}/>Add To-do</button>}
   </div>
  </div>

  <div className="notes-section">
   <div className="sub-label"><StickyNote size={14}/> Notes</div>
   {notes.length>1&&<RecordSortSelect<'updated'> label="Sort notes" value={noteSort} onChange={setNoteSort} extra={[{value:'updated',label:'Recently updated'}]}/>}
   {notes.map(n=>{
    const origins=originLabelsForContext(state,n.links,contextType,contextId);
    const linkedTasks=state.tasks.filter(t=>t.sourceNoteId===n.id);
    const unlocked=unlockedNotes?.[n.id];
    const isLocked=Boolean(n.locked)&&!unlocked;
    const displayText=unlocked?unlocked.text:n.text;
    const displayEdits=unlocked?(unlocked.edits||[]):(n.edits||[]);
    const effectiveNote:Note=unlocked?{...n,text:unlocked.text,edits:unlocked.edits}:n;
    return <article className={'note-card'+(n.pinned?' pinned':'')+(n.confidential?' confidential':'')+(isLocked?' locked':'')} key={n.id}>
     <div className="note-card-head">
      <div className="grow">
       <div className="row">
        {n.pinned&&<span className="badge blue"><Pin size={12}/> Pinned</span>}
        {n.confidential&&<span className="badge red"><LockKeyhole size={12}/> Owner-only</span>}
        {n.locked&&<span className={'badge '+(isLocked?'purple':'green')}>{isLocked?<><LockKeyhole size={12}/> Locked</>:<><Unlock size={12}/> Unlocked</>}</span>}
        {n.title&&<strong>{n.title}</strong>}
       </div>
       <div className="origin-pills">
        {origins.map(label=><span className="origin-pill" key={label}>{label}</span>)}
       </div>
      </div>
      <div className="actions">
       {n.locked&&unlocked&&onLockNote&&<button type="button" className="mini-btn" disabled={busy} onClick={()=>onLockNote(n.id)}><LockKeyhole size={13}/>Lock</button>}
       {editable&&<button type="button" className="mini-btn" disabled={busy} onClick={()=>onTogglePin(n)}>{n.pinned?'Unpin':'Pin'}</button>}
       {editable&&!isLocked&&<button type="button" className="mini-btn" disabled={busy} onClick={()=>onEditNote(effectiveNote)}><Edit3 size={13}/>Edit</button>}
       {editable&&!isLocked&&<button type="button" className="mini-btn" disabled={busy} onClick={()=>onCreateTaskFromNote(effectiveNote)}><CheckSquare size={13}/>Create To-do</button>}
      </div>
     </div>
     {isLocked?<div className="note-lock-box">
      <div className="row" style={{gap:'8px',flexWrap:'wrap'}}>
       <LockKeyhole size={15} style={{color:'#8a4037',flexShrink:0}}/>
       <span style={{fontSize:13,color:'#6c5446'}}>This note is passcode-locked.</span>
      </div>
      <div className="note-unlock-row">
       <input type="password" aria-label={`Passcode for ${n.title||'locked note'}`} placeholder="Enter passcode…" value={passcodes[n.id]||''} disabled={unlockingId===n.id} onChange={e=>{setPasscodes(prev=>({...prev,[n.id]:e.target.value}));if(unlockErrors[n.id])setUnlockErrors(prev=>({...prev,[n.id]:''}));}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();handleUnlock(n);}}}/>
       <button type="button" className="mini-btn primary" disabled={unlockingId===n.id} onClick={()=>handleUnlock(n)}>{unlockingId===n.id?'Checking…':'Unlock'}</button>
      </div>
      {unlockErrors[n.id]&&<small className="danger-text" role="alert">{unlockErrors[n.id]}</small>}
     </div>:<p className="note-body">{displayText}</p>}
     <div className="note-meta">
      <span>By {n.createdBy||'Not recorded'} · {formatDateTime(n.createdAt)}</span>
      {n.updatedAt&&n.updatedAt!==n.createdAt&&<span> · Edited by {n.updatedBy||'Not recorded'} ({formatDateTime(n.updatedAt)})</span>}
      {linkedTasks.length>0&&<span> · {linkedTasks.length} linked {linkedTasks.length===1?'to-do':'to-dos'}</span>}
     </div>
     {!isLocked&&displayEdits.length>0&&<details className="note-history">
      <summary><History size={13}/> Edit history ({displayEdits.length})</summary>
      <ul>
       {displayEdits.map((ed,idx)=><li key={idx}>
        <small>{ed.editedBy} · {formatDateTime(ed.editedAt)}</small>
        {ed.title&&<strong>{ed.title}</strong>}
        <p>{ed.text}</p>
       </li>)}
      </ul>
     </details>}
    </article>;
   })}
   {!notes.length&&<p className="muted small-empty">No {effectiveMode==='direct'?'direct':'related'} notes yet.</p>}
  </div>

  {showTodos&&<div className="todos-section">
   <div className="sub-label"><CheckSquare size={14}/> To-dos (shared task system)</div>
   {tasks.length>1&&<RecordSortSelect<'due'> label="Sort to-dos" value={todoSort} onChange={setTodoSort} extra={[{value:'due',label:'Due soonest'}]}/>}
   {tasks.map(t=>{
    const origins=originLabelsForContext(state,taskLinks(t),contextType,contextId);
    const sourceNote=t.sourceNoteId?(state.notes||[]).find(n=>n.id===t.sourceNoteId):undefined;
    return <div className="todo-row" key={t.id}>
     <div className="grow">
      <div className="row">
       <strong>{t.name}</strong>
       {editable&&<button type="button" className="edit-pill" disabled={busy} onClick={()=>onEditTask(t)}>Edit</button>}
      </div>
      <div className="origin-pills">
       {origins.map(label=><span className="origin-pill" key={label}>{label}</span>)}
       {sourceNote&&<span className="origin-pill note-ref">From note: {sourceNote.title||(sourceNote.locked?'Locked note':sourceNote.text.slice(0,36))}</span>}
      </div>
      <small>{t.hat||'General'} · Created by {t.createdBy||'Not recorded'}</small>
     </div>
     <div className="todo-controls">
      <select aria-label={`Status: ${t.name}`} disabled={!editable||busy} value={t.status} onChange={e=>onTaskStatus(t.id,e.target.value)}>
       {state.taskStatuses.map(st=><option key={st.name} value={st.name}>{st.name}</option>)}
      </select>
      <select aria-label={`Owner: ${t.name}`} disabled={!editable||busy} value={t.owner} onChange={e=>onTaskOwner(t,e.target.value)}>
       {state.people.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
      </select>
      {editable?<input key={`${t.id}-${t.due}`} className="inline-date" aria-label={`Due date: ${t.name}`} type="date" defaultValue={t.due} disabled={busy} onBlur={e=>{if(e.target.value&&e.target.value!==t.due)onTaskDue(t,e.target.value)}}/>:<span>{formatShortDate(t.due)}</span>}
     </div>
    </div>;
   })}
   {!tasks.length&&<p className="muted small-empty">No {effectiveMode==='direct'?'direct':'related'} to-dos yet.</p>}
  </div>}
 </div>;
}
