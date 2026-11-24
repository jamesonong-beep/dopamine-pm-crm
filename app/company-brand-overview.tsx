'use client';
import {ArrowLeft,Building2,CheckCheck,Clock3,FolderKanban,MessagesSquare,BriefcaseBusiness,Users} from 'lucide-react';
import NotesTodosPanel from './notes-todos-panel';
import DocumentsPanel from './documents-panel';
import {category,dealMissingNextAction,type DocStatus,type DocumentRecord,type Note,type Opportunity,type Project,type RecordLink,type State,type Task} from '../lib/model';
import {brandRecencyWarmth,contactRecencyWarmth,formatWaitingAge,type DocLink} from '../lib/workspace-links';

const titleCase=(v:string)=>v.replace(/\b[a-z]/g,c=>c.toUpperCase());
const money=(v:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:0}).format(v);
const fmtDate=(s?:string)=>s?new Date(s+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'}):'—';
const tone=(s:string)=>s==='Done'||s==='Approved'||s==='Complete'||s==='Contract Signed'?'green':s==='Lost'||s==='Overdue'||s==='Changes requested'?'red':s==='In progress'?'blue':'purple';

type NotesHandlers={
 editable:boolean;
 busy:boolean;
 matchesTask:(r:{owner?:string;hat?:string})=>boolean;
 unlockedNotes?:Record<string,{text:string;edits?:Note['edits'];passcode?:string}>;
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

type CompanyBrandOverviewProps={
 state:State;
 companyId:string;
 brandId?:string;
 today:string;
 editable:boolean;
 busy:boolean;
 financials:boolean;
 can:(section:string)=>boolean;
 onBack:()=>void;
 onSelectBrand:(brandId:string)=>void;
 onBrandWarmth:(brandId:string,warmth:string)=>void;
 onOpenProject:(projectId:string)=>void;
 onOpenDeal:(dealId:string)=>void;
 onLogTouchpoint:(prefill:{companyId:string;contactId?:string;opportunityId?:string;projectId?:string;owner?:string})=>void;
 onRescheduleTouchpoint:(touchId:string)=>void;
 onDoneTouchpoint:(touchId:string)=>void;
 onOpenWaiting:()=>void;
 onOpenApprovals:()=>void;
 notesHandlers:NotesHandlers;
 onAddDoc:(links:DocLink[])=>void;
 onEditDoc:(doc:DocumentRecord)=>void;
 onToggleDocPin:(doc:DocumentRecord)=>void;
 onChangeDocStatus:(docId:string,status:DocStatus)=>void;
};

export default function CompanyBrandOverview({
 state,companyId,brandId,today,editable,busy,financials,can,
 onBack,onSelectBrand,onBrandWarmth,onOpenProject,onOpenDeal,
 onLogTouchpoint,onRescheduleTouchpoint,onDoneTouchpoint,onOpenWaiting,onOpenApprovals,notesHandlers,
 onAddDoc,onEditDoc,onToggleDocPin,onChangeDocStatus
}:CompanyBrandOverviewProps){
 const company=state.companies.find(c=>c.id===companyId);
 if(!company)return null;
 const brand=brandId?state.brands.find(b=>b.id===brandId&&b.companyId===companyId):undefined;
 const companyBrands=state.brands.filter(b=>b.companyId===companyId);

 const scopedProjects=state.projects.filter(p=>p.companyId===companyId&&(!brand||p.brandId===brand.id));
 const projectIds=new Set(scopedProjects.map(p=>p.id));
 const scopedContacts=state.contacts.filter(c=>c.companyId===companyId&&(!brand||c.brandId===brand.id));
 const contactIds=new Set(scopedContacts.map(c=>c.id));
 const scopedDeals=state.opportunities.filter(o=>o.companyId===companyId&&(!brand||o.brandId===brand.id));
 const dealIds=new Set(scopedDeals.map(o=>o.id));
 const scopedTouchpoints=state.touchpoints.filter(t=>t.companyId===companyId&&(!brand||(t.projectId&&projectIds.has(t.projectId))||(t.contactId&&contactIds.has(t.contactId))||(t.opportunityId&&dealIds.has(t.opportunityId))));
 const scopedWaiting=state.waiting.filter(w=>!w.resolved&&projectIds.has(w.projectId));
 const scopedApprovals=state.approvals.filter(a=>projectIds.has(a.projectId));
 const pendingApprovals=scopedApprovals.filter(a=>a.status==='Pending');
 const openDeals=scopedDeals.filter(o=>o.stage!=='Lost'&&o.stage!=='Contract Signed');
 const openFollowups=scopedTouchpoints.filter(t=>!t.done);
 const owners=Array.from(new Set([...scopedContacts,...scopedDeals,...scopedProjects,...scopedWaiting].map(x=>x.owner).filter(Boolean)));
 const doneTasks=(p:Project)=>state.tasks.filter(t=>t.projectId===p.id&&category(state,t.status)==='done').length;
 const totalTasks=(p:Project)=>state.tasks.filter(t=>t.projectId===p.id).length;

 return <>
  <div className="drawer-action-bar">
   <div className="record-meta" style={{margin:0}}>
    {company.contact||'Client account'}{owners.length>0?` · Owners: ${owners.join(', ')}`:''}
   </div>
   <div className="actions">
    {brand&&<button type="button" className="mini-btn" onClick={()=>onSelectBrand('')}>All of {company.name}</button>}
    {companyBrands.length>0&&<label style={{display:'flex',alignItems:'center',gap:'0.45rem',fontSize:12.5}}>
     Scope:
     <select aria-label="Overview brand scope" value={brand?.id||''} onChange={e=>onSelectBrand(e.target.value)}>
      <option value="">All of {company.name}</option>
      {companyBrands.map(b=>{const bw=brandRecencyWarmth(state,b.id,today);return <option key={b.id} value={b.id}>{b.name} ({bw.level})</option>})}
     </select>
    </label>}
   </div>
  </div>

  {brand&&(()=>{const bw=brandRecencyWarmth(state,brand.id,today);return <div className="panel" style={{padding:'0.75rem 1rem',marginBottom:'0.85rem'}}><div className={`warmth-bar-wrap warmth-${bw.level.toLowerCase()}`} style={{margin:0}} title={bw.label}><div className="warmth-bar-head"><span className="warmth-bar-label"><i className="warmth-bar-dot"/>{bw.label}</span><small>Auto from touchpoints</small></div><div className="warmth-bar-track"><span className="warmth-bar-fill" style={{width:`${bw.fill}%`}}/></div></div></div>})()}

  <div className="metrics compact-metrics">
   {can('Contacts')&&<div className="metric"><div>Contacts</div><strong>{scopedContacts.length}</strong><small>{scopedContacts.filter(c=>{const l=contactRecencyWarmth(state,c.id,today).level;return l==='Hot'||l==='Warm'}).length} warm/hot</small></div>}
   {can('CRM Pipeline')&&<div className="metric"><div>Open Deals</div><strong>{openDeals.length}</strong><small>{financials?money(openDeals.reduce((n,o)=>n+o.value,0)):`${scopedDeals.length} total deals`}</small></div>}
   {can('Projects')&&<div className="metric"><div>Projects</div><strong>{scopedProjects.length}</strong><small>{scopedProjects.filter(p=>p.status!=='Complete').length} active</small></div>}
   {can('Touchpoints')&&<div className="metric"><div>Follow-ups</div><strong>{openFollowups.length}</strong><small>{openFollowups.filter(t=>t.followup<today).length} overdue</small></div>}
   {can('Waiting on')&&<div className="metric"><div>Waiting On</div><strong>{scopedWaiting.length}</strong><small>{scopedWaiting.filter(w=>w.due<today).length} overdue</small></div>}
   {can('Approvals')&&<div className="metric"><div>Approvals</div><strong>{pendingApprovals.length}</strong><small>{scopedApprovals.length} recorded</small></div>}
  </div>

  {can('CRM Pipeline')&&<details className="panel collapsible-panel" open={scopedDeals.length>0}>
   <summary className="section-heading"><div><h2><BriefcaseBusiness size={16} style={{display:'inline',marginRight:6}}/>Opportunities ({scopedDeals.length})</h2><p>Active, signed, and lost deals.</p></div></summary>
   {scopedDeals.length>0?<div className="table-wrap"><table><thead><tr><th>Deal</th><th>Stage</th>{financials&&<th>Value</th>}<th>Owner</th><th>Next Action</th><th>Open</th></tr></thead><tbody>
    {scopedDeals.map((o:Opportunity)=>{const gap=dealMissingNextAction(state,o);return <tr key={o.id}>
     <td><strong>{o.name}</strong><small>{state.brands.find(b=>b.id===o.brandId)?.name||'Company-wide'}</small></td>
     <td><span className={'badge '+tone(o.stage)}>{titleCase(o.stage)}</span></td>
     {financials&&<td>{money(o.value)}</td>}
     <td>{o.owner}</td>
     <td>{o.stage==='Lost'?<small>Lost: {o.lostReason||'—'}{o.retargetDate?` · Retarget ${fmtDate(o.retargetDate)}`:''}</small>:<><span>{o.nextAction||'None set'}</span>{gap.needsAttention&&<div><span className="badge red">{gap.missingAction?'Missing next action':'Missing follow-up date'}</span></div>}</>}</td>
     <td><button type="button" className="edit-pill" onClick={()=>onOpenDeal(o.id)}>Details</button></td>
    </tr>})}
   </tbody></table></div>:<div className="empty">No opportunities in this scope yet.</div>}
  </details>}

  {can('Projects')&&<details className="panel collapsible-panel" open={scopedProjects.length>0}>
   <summary className="section-heading"><div><h2><FolderKanban size={16} style={{display:'inline',marginRight:6}}/>Projects ({scopedProjects.length})</h2><p>Delivery status, owners, timelines, and progress.</p></div></summary>
   {scopedProjects.length>0?<div className="table-wrap"><table><thead><tr><th>Project</th><th>Status</th><th>Owner</th><th>Timeline</th><th>Progress</th><th>Open</th></tr></thead><tbody>
    {scopedProjects.map(p=><tr key={p.id}>
     <td><strong>{p.name}</strong><small>{state.brands.find(b=>b.id===p.brandId)?.name||'Company-wide'} · {p.engagement}</small></td>
     <td><span className={'badge '+tone(p.status)}>{p.status}</span></td>
     <td>{p.owner}</td>
     <td>{fmtDate(p.start)} – {fmtDate(p.due)}</td>
     <td>{doneTasks(p)} / {totalTasks(p)} tasks</td>
     <td><button type="button" className="edit-pill" onClick={()=>onOpenProject(p.id)}>Project</button></td>
    </tr>)}
   </tbody></table></div>:<div className="empty">No projects in this scope yet.</div>}
  </details>}

  {can('Contacts')&&<details className="panel collapsible-panel" open={scopedContacts.length>0}>
   <summary className="section-heading"><div><h2><Users size={16} style={{display:'inline',marginRight:6}}/>Contacts ({scopedContacts.length})</h2><p>Relationship owners, warmth, and touchpoints.</p></div></summary>
   {scopedContacts.map(c=><div className="approval-line" key={c.id}>
    <div className="grow">
     <strong>{c.name}</strong>
     <small>{c.title||'No title'} · {state.brands.find(b=>b.id===c.brandId)?.name||'Company-wide'} · Owner: {c.owner}</small>
     <small>{c.email||'No email'}{c.phone?` · ${c.phone}`:''}</small>
    </div>
    {(()=>{const cw=contactRecencyWarmth(state,c.id,today);return <span className={`warmth-pill warmth-${cw.level.toLowerCase()}`} title={cw.label}>{cw.label}</span>})()}
    {editable&&can('Touchpoints')&&<button type="button" className="mini-btn" disabled={busy} onClick={()=>onLogTouchpoint({companyId,contactId:c.id,owner:c.owner})}>Log touchpoint</button>}
   </div>)}
   {!scopedContacts.length&&<div className="empty">No contacts in this scope yet.</div>}
  </details>}

  <div className="two-column">
   {can('Touchpoints')&&<details className="panel collapsible-panel" open={scopedTouchpoints.length>0}>
    <summary className="section-heading"><div><h2><MessagesSquare size={16} style={{display:'inline',marginRight:6}}/>Follow-ups ({openFollowups.length} open)</h2></div></summary>
    {scopedTouchpoints.slice(0,8).map(t=><div className="approval-line" key={t.id}>
     <div className="grow">
      <strong>{t.nextAction}</strong>
      <small>{t.channel} · {t.owner} · Due {fmtDate(t.followup)}</small>
     </div>
     <span className={'badge '+tone(t.done?'Done':t.followup<today?'Overdue':'Follow-up')}>{t.done?'Done':t.followup<today?'Overdue':'Open'}</span>
     {!t.done&&editable&&<div className="actions">
      <button type="button" className="mini-btn" disabled={busy} onClick={()=>onRescheduleTouchpoint(t.id)}>Reschedule</button>
      <button type="button" className="mini-btn" disabled={busy} onClick={()=>onDoneTouchpoint(t.id)}>Done</button>
     </div>}
    </div>)}
    {!scopedTouchpoints.length&&<div className="empty">No touchpoints recorded here yet.</div>}
   </details>}

   {can('Waiting on')&&<details className="panel collapsible-panel" open={scopedWaiting.length>0}>
    <summary className="section-heading"><div><h2><Clock3 size={16} style={{display:'inline',marginRight:6}}/>Waiting On ({scopedWaiting.length})</h2></div><button type="button" className="mini-btn" onClick={e=>{e.preventDefault();onOpenWaiting()}}>Open Waiting On</button></summary>
    {scopedWaiting.map(w=><div className="approval-line" key={w.id}>
     <div className="grow">
      <strong>{w.name}</strong>
      <small>Owed by {w.person} ({w.party}) · Chase: {w.owner} · Due {fmtDate(w.due)}</small>
     </div>
     <span className="origin-pill">{formatWaitingAge(w.requested,today)}</span>
    </div>)}
    {!scopedWaiting.length&&<div className="empty">Nothing waiting in this scope.</div>}
   </details>}
  </div>

  {can('Approvals')&&<details className="panel collapsible-panel" open={scopedApprovals.length>0}>
   <summary className="section-heading"><div><h2><CheckCheck size={16} style={{display:'inline',marginRight:6}}/>Approvals ({pendingApprovals.length} pending)</h2></div><button type="button" className="mini-btn" onClick={e=>{e.preventDefault();onOpenApprovals()}}>Open Approvals</button></summary>
   {scopedApprovals.map(a=><div className="approval-line" key={a.id}>
    <div className="grow">
     <strong>{a.name} · v{a.version}</strong>
     <small>{state.projects.find(p=>p.id===a.projectId)?.name||''} · Reviewer: {a.reviewer} · Due {fmtDate(a.due)}</small>
    </div>
    <span className={'badge '+tone(a.status)}>{a.status}</span>
   </div>)}
   {!scopedApprovals.length&&<div className="empty">No approvals recorded in this scope yet.</div>}
  </details>}

  <section className="panel">
   <div className="section-heading"><div><h2>Notes &amp; To-dos (Direct / Related)</h2><p>Contextual notes and shared to-dos for {brand?brand.name:company.name}.</p></div></div>
   <div className="panel-body-pad">
    <NotesTodosPanel state={state} contextType={brand?'brand':'company'} contextId={brand?brand.id:company.id} allowRelatedToggle={true} {...notesHandlers}/>
   </div>
  </section>

  {can('Documents')&&<details className="panel collapsible-panel" open={(state.documents||[]).length>0}>
   <summary className="section-heading"><div><h2>Documents</h2><p>Briefs, proposals, and shared files.</p></div></summary>
   <DocumentsPanel state={state} contextType={brand?'brand':'company'} contextId={brand?brand.id:company.id} editable={editable} busy={busy} onAddDoc={onAddDoc} onEditDoc={onEditDoc} onTogglePin={onToggleDocPin} onChangeStatus={onChangeDocStatus}/>
  </details>}
 </>;
}
