'use client';
import {useEffect,useState} from 'react';
import {AlertTriangle,ArrowLeft,CalendarDays,FolderKanban,MessagesSquare,Plus,RotateCcw,Trash2,Users} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {ResponsiveModal} from '@/components/ui/responsive-modal';
import DocumentsPanel from './documents-panel';
import NotesTodosPanel from './notes-todos-panel';
import {JourneyReviewPanel} from './journey-review';
import {category,dealMissingNextAction,hats,pipelineStages,type DocStatus,type DocumentRecord,type Note,type NoteRevision,type Opportunity,type Project,type RecordLink,type State,type Task} from '../lib/model';
import {addDays,computeDealAging,type DocLink,type RetrospectiveEntry} from '../lib/workspace-links';

const titleCase=(v:string)=>v.replace(/\b[a-z]/g,c=>c.toUpperCase());
const money=(v:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:0}).format(v);
const fmtDate=(s?:string)=>s?new Date(s+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}):'—';
const tone=(s:string)=>s==='Done'||s==='Approved'||s==='Complete'||s==='Contract Signed'?'green':s==='Lost'||s==='Overdue'?'red':s==='In progress'?'blue':'purple';

type DealDetailsProps={
 state:State;
 deal:Opportunity;
 today:string;
 editable:boolean;
 busy:boolean;
 financials:boolean;
 canProjects:boolean;
 canContacts:boolean;
 canTouchpoints:boolean;
 canDocuments:boolean;
 onBack:()=>void;
 onChangeStage:(dealId:string,stage:string)=>void;
 onEditDeal:(deal:Opportunity)=>void;
 onMarkLost:(deal:Opportunity)=>void;
 onReopenDeal:(deal:Opportunity)=>void;
 onOpenHandoff:(deal:Opportunity)=>void;
 onLogTouchpoint:(deal:Opportunity,contactId?:string)=>void;
 onRescheduleTouchpoint:(touchId:string)=>void;
 onDoneTouchpoint:(touchId:string)=>void;
 onOpenProject:(projectId:string)=>void;
 onAddDoc:(links:DocLink[])=>void;
 onEditDoc:(doc:DocumentRecord)=>void;
 onToggleDocPin:(doc:DocumentRecord)=>void;
 onChangeDocStatus:(docId:string,status:DocStatus)=>void;
 authorName?:string;
 retrospective?:RetrospectiveEntry;
 canEditRetrospective?:boolean;
 onSaveRetrospective?:(entry:RetrospectiveEntry)=>void;
 notesHandlers?:{
  editable:boolean;
  busy:boolean;
  matchesTask?:(t:Task)=>boolean;
  unlockedNotes?:Record<string,{text:string;edits?:NoteRevision[];passcode?:string}>;
  onUnlockNote?:(note:Note,passcode:string)=>Promise<string|null>;
  onLockNote?:(noteId:string)=>void;
  onAddNote:(initialLinks:RecordLink[])=>void;
  onEditNote:(note:Note)=>void;
  onTogglePin:(note:Note)=>void;
  onCreateTaskFromNote:(note:Note)=>void;
  onAddTask:(initialLinks:RecordLink[])=>void;
  onEditTask:(task:Task)=>void;
  onTaskStatus:(taskId:string,status:string)=>void;
  onTaskOwner:(t:Task,owner:string)=>void;
  onTaskDue:(t:Task,due:string)=>void;
 };
};

export function DealDetailsPanel({
 state,deal,today,editable,busy,financials,canProjects,canContacts,canTouchpoints,canDocuments,
 onBack,onChangeStage,onEditDeal,onMarkLost,onReopenDeal,onOpenHandoff,
 onLogTouchpoint,onRescheduleTouchpoint,onDoneTouchpoint,onOpenProject,
 onAddDoc,onEditDoc,onToggleDocPin,onChangeDocStatus,
 authorName='Workspace member',retrospective,onSaveRetrospective,canEditRetrospective,notesHandlers
}:DealDetailsProps){
 const company=state.companies.find(c=>c.id===deal.companyId);
 const brand=state.brands.find(b=>b.id===deal.brandId);
 const linkedProjects=state.projects.filter(p=>p.opportunityId===deal.id);
 const dealTouchpoints=state.touchpoints.filter(t=>t.opportunityId===deal.id);
 const relevantContacts=state.contacts.filter(c=>c.companyId===deal.companyId&&(!deal.brandId||!c.brandId||c.brandId===deal.brandId));
 const gap=dealMissingNextAction(state,deal);
 const doneCount=(p:Project)=>state.tasks.filter(t=>t.projectId===p.id&&category(state,t.status)==='done').length;
 const totalCount=(p:Project)=>state.tasks.filter(t=>t.projectId===p.id).length;

 return <>
  <div className="drawer-action-bar">
   <div className="record-meta" style={{margin:0}}>
    {company?.name||'—'} / {brand?.name||'Multiple brands / company-wide'} · Owner: <strong>{deal.owner}</strong> ({deal.hat||'Sales'})
   </div>
   <div className="actions">
    {editable&&<button type="button" className="mini-btn" disabled={busy} onClick={()=>onEditDeal(deal)}>Edit deal</button>}
    {editable&&canTouchpoints&&<button type="button" className="mini-btn" disabled={busy} onClick={()=>onLogTouchpoint(deal)}><MessagesSquare size={14}/> Log touchpoint</button>}
    {editable&&deal.stage==='Contract Signed'&&canProjects&&<button type="button" className="mini-btn primary" disabled={busy} onClick={()=>onOpenHandoff(deal)}><FolderKanban size={14}/> {linkedProjects.length?'Add brand project':'Hand off to projects'}</button>}
    {editable&&deal.stage==='Lost'&&<button type="button" className="mini-btn primary" disabled={busy} onClick={()=>onReopenDeal(deal)}><RotateCcw size={14}/> Reopen deal</button>}
    {editable&&deal.stage!=='Lost'&&<button type="button" className="mini-btn danger-button" disabled={busy} onClick={()=>onMarkLost(deal)}>Mark lost</button>}
   </div>
  </div>

  {gap.needsAttention&&<div className="error" role="status" style={{marginBottom:'0.85rem'}}>
   <div className="grow">
    <strong><AlertTriangle size={15} style={{display:'inline',marginRight:6}}/>Next-action gap:</strong>{' '}
    {gap.missingAction&&gap.missingDate?'This open deal is missing both a next action and a follow-up date.':gap.missingAction?'This open deal is missing a next action.':'This open deal has no follow-up date set.'}
   </div>
   {editable&&<button type="button" className="mini-btn" disabled={busy} onClick={()=>onEditDeal(deal)}>Set next action</button>}
  </div>}

  {deal.stage==='Lost'&&<div className="notice lavender" style={{marginBottom:'0.85rem'}}>
   <div className="grow">
    <strong>Lost from {titleCase(deal.lostFrom||'Earlier release')}</strong>
    {deal.lostAt&&` · ${new Date(deal.lostAt).toLocaleDateString('en-PH')}`}
    <div>Reason: {deal.lostReason||'Reason not recorded'}</div>
    <div><strong>Retargeting date:</strong> {deal.retargetDate?fmtDate(deal.retargetDate):'Not set'}{deal.retargetDate&&deal.retargetDate<=today?' (Due for retargeting)':''}</div>
   </div>
   {editable&&<div className="actions">
    <button type="button" className="mini-btn" disabled={busy} onClick={()=>onEditDeal(deal)}>Update retarget date</button>
    <button type="button" className="mini-btn primary" disabled={busy} onClick={()=>onReopenDeal(deal)}>Reopen</button>
   </div>}
  </div>}

  <div className="deal-stage-stepper" aria-label="Deal stage progression">
   {pipelineStages.map((st,idx)=>{
    const curIdx=(pipelineStages as readonly string[]).indexOf(deal.stage);
    const isCurrent=deal.stage===st;
    const isPassed=curIdx>=0&&idx<curIdx;
    const shortLbl=st==='First Pitch and Data Gathering'?'Pitch & Data':titleCase(st);
    return <button key={st} type="button" disabled={!editable||busy||isCurrent} className={'deal-step-pill'+(isCurrent?' current':isPassed?' passed':'')} onClick={()=>onChangeStage(deal.id,st)} title={editable?`Move to ${titleCase(st)}`:titleCase(st)}>
     <span className="deal-step-num">{String(idx+1).padStart(2,'0')}</span>
     <span>{shortLbl}</span>
    </button>;
   })}
  </div>

  <div className="project-summary">
   <div>
    <small>{deal.stage==='Lost'?'REOPEN AT':'STAGE'}</small>
    {editable?(
     <select aria-label={`Deal detail stage: ${deal.name}`} disabled={busy} value={deal.stage==='Lost'?'':deal.stage} onChange={e=>onChangeStage(deal.id,e.target.value)}>
      {deal.stage==='Lost'&&<option value="" disabled>Choose a stage…</option>}
      {pipelineStages.map(st=><option key={st} value={st}>{titleCase(st)}</option>)}
     </select>
    ):<span className={'badge '+tone(deal.stage)}>{titleCase(deal.stage)}</span>}
   </div>
   <div>
    <small>OWNER &amp; ROLE</small>
    <strong>{deal.owner}</strong>
    <div className="muted" style={{fontSize:12}}>{deal.hat||'Sales'}</div>
   </div>
   <div>
    <small>NEXT ACTION</small>
    <strong>{deal.nextAction||'No next action set'}</strong>
    <div className="muted" style={{fontSize:12}}><CalendarDays size={12} style={{display:'inline',marginRight:4}}/>{deal.nextActionDate?fmtDate(deal.nextActionDate):'No follow-up date'}</div>
   </div>
   {(()=>{const age=computeDealAging(deal,today);return <div>
    <small>PIPELINE AGING</small>
    <strong>{age.stageLabel}</strong>
    <div className="muted" style={{fontSize:12}}>{age.totalLabel} from first stage</div>
   </div>})()}
   {financials&&<div>
    <small>DEAL VALUE</small>
    <strong>{money(deal.value)}</strong>
   </div>}
  </div>

  {notesHandlers&&<section className="panel">
   <div className="section-heading">
    <div><h2>Deal Notes &amp; Pre-Sales To-Dos</h2><p>Track pitch notes, pricing context, and pre-sales tasks before this deal ever becomes a project.</p></div>
   </div>
   <div className="panel-body-pad">
    <NotesTodosPanel state={state} contextType={deal.brandId?'brand':'company'} contextId={deal.brandId||deal.companyId} allowRelatedToggle={true} {...notesHandlers}/>
   </div>
  </section>}

  {onSaveRetrospective&&<JourneyReviewPanel state={state} targetType="deal" targetId={deal.id} today={today} authorName={authorName} editable={Boolean(canEditRetrospective)} existing={retrospective} onSave={onSaveRetrospective}/>}

  {canProjects&&<details className="panel collapsible-panel" open={linkedProjects.length>0}>
   <summary className="section-heading">
    <div><h2>Linked Projects ({linkedProjects.length})</h2><p>Projects handed off after Contract Signed.</p></div>
    {editable&&deal.stage==='Contract Signed'&&<button type="button" className="mini-btn" disabled={busy} onClick={e=>{e.preventDefault();onOpenHandoff(deal)}}><Plus size={14}/> Create brand projects</button>}
   </summary>
   {linkedProjects.length>0?<div className="table-wrap"><table><thead><tr><th>Project / Brand</th><th>Status</th><th>Owner</th><th>Timeline</th><th>Progress</th><th>Open</th></tr></thead><tbody>
    {linkedProjects.map(p=><tr key={p.id}>
     <td><strong>{p.name}</strong><small>{state.brands.find(b=>b.id===p.brandId)?.name||'Company-wide'} · {p.type}</small></td>
     <td><span className={'badge '+tone(p.status)}>{p.status}</span></td>
     <td>{p.owner}</td>
     <td>{fmtDate(p.start)} – {fmtDate(p.due)}</td>
     <td>{doneCount(p)} / {totalCount(p)} tasks</td>
     <td><button type="button" className="edit-pill" onClick={()=>onOpenProject(p.id)}>Open project</button></td>
    </tr>)}
   </tbody></table></div>:<div className="empty">{deal.stage==='Contract Signed'?'No projects handed off yet. Click Create brand projects to launch delivery from a template.':'Projects handed off after Contract Signed will appear here.'}</div>}
  </details>}

  {canTouchpoints&&<details className="panel collapsible-panel" open={dealTouchpoints.length>0}>
   <summary className="section-heading">
    <div><h2>Touchpoints &amp; Follow-ups ({dealTouchpoints.length})</h2><p>Conversations and dated follow-ups linked to this deal.</p></div>
    {editable&&<button type="button" className="mini-btn" disabled={busy} onClick={e=>{e.preventDefault();onLogTouchpoint(deal)}}><Plus size={14}/> Log touchpoint</button>}
   </summary>
   {dealTouchpoints.map(t=><div className="approval-line" key={t.id}>
    <div className="grow">
     <strong>{t.channel} · {t.nextAction}</strong>
     <small>{t.summary}</small>
     <small>Owner: {t.owner} · Follow-up: {fmtDate(t.followup)}{!t.done&&t.followup<today?' · Overdue':''}{t.contactId?` · Contact: ${state.contacts.find(c=>c.id===t.contactId)?.name||''}`:''}</small>
    </div>
    <span className={'badge '+tone(t.done?'Done':t.followup<today?'Overdue':'Follow-up')}>{t.done?'Done':t.followup<today?'Overdue':'Open'}</span>
    {!t.done&&editable&&<div className="actions">
     <button type="button" className="mini-btn" disabled={busy} onClick={()=>onRescheduleTouchpoint(t.id)}>Reschedule</button>
     <button type="button" className="mini-btn" disabled={busy} onClick={()=>onDoneTouchpoint(t.id)}>Done</button>
    </div>}
   </div>)}
   {!dealTouchpoints.length&&<div className="empty">No touchpoints linked to this deal yet.</div>}
  </details>}

  {canContacts&&<details className="panel collapsible-panel" open={relevantContacts.length>0}>
   <summary className="section-heading">
    <div><h2>Account Contacts ({relevantContacts.length})</h2><p>People at {company?.name||'this company'} relevant to this deal.</p></div>
   </summary>
   {relevantContacts.map(c=><div className="approval-line" key={c.id}>
    <div className="grow">
     <strong>{c.name}</strong>
     <small>{c.title||'No title'} · {state.brands.find(b=>b.id===c.brandId)?.name||'Company-wide'} · Owner: {c.owner}</small>
     <small>{c.email||'No email'}{c.phone?` · ${c.phone}`:''}</small>
    </div>
    <span className="badge purple">{c.warmth||'Unrated'}</span>
    {editable&&canTouchpoints&&<button type="button" className="mini-btn" disabled={busy} onClick={()=>onLogTouchpoint(deal,c.id)}>Log touchpoint</button>}
   </div>)}
   {!relevantContacts.length&&<div className="empty"><Users size={16} style={{display:'inline',marginRight:6}}/>No contacts added for this account yet.</div>}
  </details>}

  {canDocuments&&<details className="panel collapsible-panel" open={(state.documents||[]).some(d=>d.links.some(l=>l.type==='opportunity'&&l.id===deal.id))}>
   <summary className="section-heading">
    <div><h2>Documents ({(state.documents||[]).filter(d=>d.links.some(l=>l.type==='opportunity'&&l.id===deal.id)).length})</h2><p>Linked proposals, decks, and contracts.</p></div>
    {editable&&<button type="button" className="mini-btn" disabled={busy} onClick={e=>{e.preventDefault();onAddDoc([{type:'opportunity',id:deal.id}])}}><Plus size={14}/> Add document</button>}
   </summary>
   <DocumentsPanel state={state} contextType="opportunity" contextId={deal.id} editable={editable} busy={busy} onAddDoc={onAddDoc} onEditDoc={onEditDoc} onTogglePin={onToggleDocPin} onChangeStatus={onChangeDocStatus}/>
  </details>}
 </>;
}

type HandoffDraftRow={
 brandId:string;
 name:string;
 engagement:string;
 type:string;
 owner:string;
 hat:string;
 start:string;
 due:string;
 budget:string;
 cost:string;
};

type DealHandoffModalProps={
 open:boolean;
 deal:Opportunity|null;
 state:State;
 today:string;
 financials:boolean;
 busy:boolean;
 onClose:()=>void;
 onSubmit:(payload:{opportunityId:string;projects:{brandId:string;name:string;engagement:string;type:string;owner:string;hat:string;start:string;due:string;budget:number;cost:number}[]})=>void;
};

export function DealHandoffModal({open,deal,state,today,financials,busy,onClose,onSubmit}:DealHandoffModalProps){
 const activeTemplates=(state.projectTemplates||[]).filter(t=>!t.archived);
 const companyBrands=deal?state.brands.filter(b=>b.companyId===deal.companyId):[];
 const existingProjects=deal?state.projects.filter(p=>p.opportunityId===deal.id):[];
 const usedBrandKeys=new Set(existingProjects.map(p=>p.brandId||'__company__'));
 const allBrandOptions=[{id:'',name:'Company-wide'},...companyBrands.map(b=>({id:b.id,name:b.name}))];

 const makeRow=(brandId:string):HandoffDraftRow=>{
  const bName=brandId?companyBrands.find(b=>b.id===brandId)?.name||'':'';
  return{
   brandId,
   name:deal?(bName?`${deal.name} — ${bName}`:deal.name):'',
   engagement:deal?.name||'',
   type:activeTemplates[0]?.id||'',
   owner:deal?.owner||state.people[0]?.name||'',
   hat:'Project lead',
   start:today,
   due:addDays(today,14),
   budget:'0',
   cost:'0'
  };
 };

 const [rows,setRows]=useState<HandoffDraftRow[]>([]);
 const [localError,setLocalError]=useState('');

 useEffect(()=>{
  if(!open||!deal)return;
  setLocalError('');
  const preferred=deal.brandId&&!usedBrandKeys.has(deal.brandId)?deal.brandId:allBrandOptions.find(o=>!usedBrandKeys.has(o.id||'__company__'))?.id;
  setRows(preferred!==undefined?[makeRow(preferred)]:[]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[open,deal?.id]);

 if(!deal)return null;
 const selectedKeys=new Set(rows.map(r=>r.brandId||'__company__'));
 const availableToAdd=allBrandOptions.filter(o=>!usedBrandKeys.has(o.id||'__company__')&&!selectedKeys.has(o.id||'__company__'));

 function updateRow(index:number,patch:Partial<HandoffDraftRow>){
  setRows(prev=>prev.map((r,i)=>{
   if(i!==index)return r;
   const next={...r,...patch};
   if(patch.brandId!==undefined&&deal){
    const prevBrandName=r.brandId?companyBrands.find(b=>b.id===r.brandId)?.name||'':'';
    const nextBrandName=patch.brandId?companyBrands.find(b=>b.id===patch.brandId)?.name||'':'';
    const prevAuto=prevBrandName?`${deal.name} — ${prevBrandName}`:deal.name;
    if(!r.name||r.name===prevAuto)next.name=nextBrandName?`${deal.name} — ${nextBrandName}`:deal.name;
   }
   return next;
  }));
 }

 function handleSubmit(e:React.FormEvent){
  e.preventDefault();
  if(!deal)return;
  setLocalError('');
  if(!rows.length){setLocalError('All brand scopes for this deal already have handed-off projects.');return;}
  for(const r of rows){
   if(!r.name.trim()||!r.engagement.trim()||!r.type||!r.owner){setLocalError('Fill in project name, engagement, template, and owner for every row.');return;}
   if(r.due<r.start){setLocalError(`Target completion date for "${r.name}" must be on or after its start date.`);return;}
  }
  onSubmit({
   opportunityId:deal.id,
   projects:rows.map(r=>({
    brandId:r.brandId,
    name:r.name.trim(),
    engagement:r.engagement.trim(),
    type:r.type,
    owner:r.owner,
    hat:r.hat||'Project lead',
    start:r.start,
    due:r.due,
    budget:financials?Number(r.budget||0):0,
    cost:financials?Number(r.cost||0):0
   }))
  });
 }

 return <ResponsiveModal open={open} onOpenChange={(next)=>{if(!next&&!busy)onClose()}} title={`Hand Off Signed Deal: ${deal.name}`} dismissible={!busy}>
  <form onSubmit={handleSubmit}>
   <p className="form-note">Create one or more brand projects from active templates with independent owners and timelines. Each project stays linked to this deal, and duplicate handoffs for the same brand are prevented.</p>
   {existingProjects.length>0&&<div className="notice lavender" style={{marginBottom:'0.75rem'}}>
    <div><strong>Already handed off ({existingProjects.length}):</strong> {existingProjects.map(p=>`${state.brands.find(b=>b.id===p.brandId)?.name||'Company-wide'} (${p.name})`).join(' · ')}</div>
   </div>}
   {!rows.length?<div className="empty">Every brand under this company (plus company-wide) already has a handed-off project for this deal.</div>:rows.map((r,idx)=>{
    const rowKey=r.brandId||'__company__';
    return <div key={idx} className="panel" style={{padding:'0.85rem',marginBottom:'0.75rem'}}>
     <div className="row" style={{justifyContent:'space-between',marginBottom:'0.5rem'}}>
      <strong>Project {idx+1}</strong>
      {rows.length>1&&<button type="button" className="mini-btn" disabled={busy} onClick={()=>setRows(prev=>prev.filter((_,i)=>i!==idx))}><Trash2 size={13}/> Remove</button>}
     </div>
     <div className="form-grid">
      <label>Brand scope
       <select value={r.brandId} onChange={e=>updateRow(idx,{brandId:e.target.value})}>
        {allBrandOptions.map(opt=>{
         const optKey=opt.id||'__company__';
         const taken=usedBrandKeys.has(optKey)||(selectedKeys.has(optKey)&&optKey!==rowKey);
         return <option key={optKey} value={opt.id} disabled={taken}>{opt.name}{usedBrandKeys.has(optKey)?' (already handed off)':taken?' (selected above)':''}</option>;
        })}
       </select>
      </label>
      <label>Project template
       <select required value={r.type} onChange={e=>updateRow(idx,{type:e.target.value})}>
        {activeTemplates.map(t=><option key={t.id} value={t.id}>{t.name} ({t.steps.length} steps)</option>)}
       </select>
      </label>
      <label>Project name<input required value={r.name} onChange={e=>updateRow(idx,{name:e.target.value})}/></label>
      <label>Engagement<input required value={r.engagement} onChange={e=>updateRow(idx,{engagement:e.target.value})}/></label>
      <label>Project owner
       <select required value={r.owner} onChange={e=>updateRow(idx,{owner:e.target.value})}>
        {state.people.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
       </select>
      </label>
      <label>Work role
       <select value={r.hat} onChange={e=>updateRow(idx,{hat:e.target.value})}>
        {(state.workRoles?.length?state.workRoles:[...hats]).map(h=><option key={h} value={h}>{h}</option>)}
       </select>
      </label>
      <label>Start date<input required type="date" value={r.start} onChange={e=>updateRow(idx,{start:e.target.value})}/></label>
      <label>Target completion<input required type="date" value={r.due} onChange={e=>updateRow(idx,{due:e.target.value})}/></label>
      {financials&&<>
       <label>Client price (PHP)<input type="number" min={0} value={r.budget} onChange={e=>updateRow(idx,{budget:e.target.value})}/></label>
       <label>Planned cost (PHP)<input type="number" min={0} value={r.cost} onChange={e=>updateRow(idx,{cost:e.target.value})}/></label>
      </>}
     </div>
    </div>;
   })}
   {availableToAdd.length>0&&<div style={{marginBottom:'0.75rem'}}>
    <button type="button" disabled={busy} onClick={()=>setRows(prev=>[...prev,makeRow(availableToAdd[0].id)])}><Plus size={15}/> Add another brand project</button>
   </div>}
   {localError&&<p className="error" role="alert">{localError}</p>}
   <div className="modal-actions">
    <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
    <Button type="submit" disabled={busy||!rows.length}>{busy?'Creating…':`Create ${rows.length} Project${rows.length===1?'':'s'}`}</Button>
   </div>
  </form>
 </ResponsiveModal>;
}
