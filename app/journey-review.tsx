'use client';
import {useEffect,useMemo,useState} from 'react';
import {BookOpenCheck,CheckCircle2,ChevronDown,ChevronRight,Clock3,Edit3,GitCommitHorizontal,Plus,Sparkles} from 'lucide-react';
import type {State} from '../lib/model';
import {buildDealJourney,buildProjectJourney,computeDealAging,type JourneyEvent,type RetrospectiveEntry,type RetrospectiveRating} from '../lib/workspace-links';

const RATINGS:RetrospectiveRating[]=['Smooth win','Good with lessons','Bumpy — needs fix','Lost / Post-mortem'];
const fmtDate=(iso?:string)=>iso?new Date(`${iso.slice(0,10)}T00:00:00`).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}):'—';

type JourneyReviewProps={
 state:State;
 targetType:'deal'|'project';
 targetId:string;
 today:string;
 authorName:string;
 editable:boolean;
 existing?:RetrospectiveEntry;
 onSave:(entry:RetrospectiveEntry)=>void;
};

export function JourneyReviewPanel({
 state,targetType,targetId,today,authorName,editable,existing,onSave
}:JourneyReviewProps){
 const events:JourneyEvent[]=useMemo(()=>targetType==='deal'?buildDealJourney(state,targetId,today):buildProjectJourney(state,targetId,today),[state,targetType,targetId,today]);
 const [expanded,setExpanded]=useState(false);
 const [editing,setEditing]=useState(false);
 const [rating,setRating]=useState<RetrospectiveRating>(existing?.rating||'Good with lessons');
 const [wentWell,setWentWell]=useState(existing?.wentWell||'');
 const [couldImprove,setCouldImprove]=useState(existing?.couldImprove||'');
 const [playbook,setPlaybook]=useState(existing?.playbook||'');

 useEffect(()=>{
  setRating(existing?.rating||'Good with lessons');
  setWentWell(existing?.wentWell||'');
  setCouldImprove(existing?.couldImprove||'');
  setPlaybook(existing?.playbook||'');
  setEditing(false);
  setExpanded(false);
 },[targetType,targetId,existing?.updatedAt]);

 const stageMoves=events.filter(e=>e.kind==='stage').length;
 const touches=events.filter(e=>e.kind==='touchpoint').length;
 const blockers=events.filter(e=>e.kind==='blocker').length;
 const deal=targetType==='deal'?state.opportunities.find(o=>o.id===targetId):undefined;
 const aging=deal?computeDealAging(deal,today):null;

 const handleSave=(e:React.FormEvent)=>{
  e.preventDefault();
  onSave({
   id:`${targetType}:${targetId}`,
   targetType,
   targetId,
   rating,
   wentWell:wentWell.trim(),
   couldImprove:couldImprove.trim(),
   playbook:playbook.trim(),
   updatedAt:new Date().toISOString(),
   updatedBy:authorName||'Workspace member'
  });
  setEditing(false);
 };

 return <section className="panel journey-review-panel">
  <div className="section-heading journey-toggle-head" role="button" tabIndex={0} aria-expanded={expanded} onClick={()=>setExpanded(x=>!x)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setExpanded(x=>!x);}}}>
   <div className="journey-head-left">
    <span className="journey-caret" aria-hidden="true">{expanded?<ChevronDown size={16}/>:<ChevronRight size={16}/>}</span>
    <div>
     <h2><GitCommitHorizontal size={16} style={{display:'inline',marginRight:6}}/>Journey Timeline &amp; Self-Review</h2>
     {!expanded&&<p>{events.length} milestone{events.length===1?'':'s'}{existing?` · Reviewed (${existing.rating})`:' · Click to expand timeline or log self-review'}</p>}
    </div>
   </div>
   <div className="journey-stat-pills" onClick={e=>e.stopPropagation()}>
    {aging&&<span className="origin-pill">{aging.totalLabel}</span>}
    <span className="origin-pill">{stageMoves} move{stageMoves===1?'':'s'}</span>
    <span className="origin-pill">{touches} touch{touches===1?'':'es'}</span>
    {blockers>0&&<span className="badge red">{blockers} blocker{blockers===1?'':'s'}</span>}
    {existing?<span className="badge green">{existing.rating}</span>:<span className="origin-pill">No review</span>}
    <button type="button" className="mini-btn" onClick={()=>setExpanded(x=>!x)}>{expanded?'Collapse':'Expand'}</button>
   </div>
  </div>

  {expanded&&<div className="journey-split">
   <div className="journey-timeline-col">
    <h3><Clock3 size={13}/> What Happened ({events.length})</h3>
    <ol className="journey-timeline journey-timeline-scroll">
     {events.map(ev=><li key={ev.id} className={`journey-item tone-${ev.tone||'blue'}`}>
      <span className="journey-dot" aria-hidden="true"/>
      <div className="journey-item-body">
       <div className="journey-item-head">
        <strong>{ev.title}</strong>
        <span className="journey-date">{fmtDate(ev.at)}</span>
       </div>
       {ev.detail&&<p>{ev.detail}</p>}
       {(ev.actor||ev.deltaLabel)&&<div className="journey-item-meta">
        {ev.actor&&<small>{ev.actor}</small>}
        {ev.deltaLabel&&<span className="journey-delta">{ev.deltaLabel}</span>}
       </div>}
      </div>
     </li>)}
    </ol>
   </div>

   <div className="journey-reflection-col">
    <div className="journey-reflection-head">
     <h3><BookOpenCheck size={13}/> Process Self-Review</h3>
     {existing&&editable&&!editing&&<button type="button" className="mini-btn" onClick={()=>setEditing(true)}><Edit3 size={12}/> Edit</button>}
    </div>

    {!editing&&existing?(
     <div className="reflection-saved-card">
      <div className="reflection-rating-row">
       <span className={`badge ${existing.rating==='Smooth win'?'green':existing.rating==='Lost / Post-mortem'?'red':existing.rating==='Bumpy — needs fix'?'purple':'blue'}`}>{existing.rating}</span>
       <small>{existing.updatedBy} · {fmtDate(existing.updatedAt)}</small>
      </div>
      {existing.wentWell&&<div className="reflection-block"><strong>What went well</strong><p>{existing.wentWell}</p></div>}
      {existing.couldImprove&&<div className="reflection-block"><strong>What stalled / do differently</strong><p>{existing.couldImprove}</p></div>}
      {existing.playbook&&<div className="reflection-block playbook"><strong><Sparkles size={12}/> Next-time playbook</strong><p>{existing.playbook}</p></div>}
     </div>
    ):!editing?(
     <div className="reflection-empty-card">
      <p>Capture what went smoothly, what stalled, and a quick playbook takeaway for next time.</p>
      {editable&&<button type="button" className="mini-btn primary" onClick={()=>setEditing(true)}><Plus size={13}/> Write self-review</button>}
     </div>
    ):(
     <form className="reflection-form" onSubmit={handleSave}>
      <label>Overall outcome
       <select value={rating} disabled={!editable} onChange={e=>setRating(e.target.value as RetrospectiveRating)}>
        {RATINGS.map(r=><option key={r} value={r}>{r}</option>)}
       </select>
      </label>
      <label>What went well?
       <textarea rows={2} disabled={!editable} value={wentWell} onChange={e=>setWentWell(e.target.value)} placeholder="e.g. Fast discovery call, clear pricing deck…"/>
      </label>
      <label>What stalled or could we improve?
       <textarea rows={2} disabled={!editable} value={couldImprove} onChange={e=>setCouldImprove(e.target.value)} placeholder="e.g. Request supplier quotes earlier during Discovery…"/>
      </label>
      <label>Next-time playbook takeaway
       <textarea rows={2} disabled={!editable} value={playbook} onChange={e=>setPlaybook(e.target.value)} placeholder="e.g. Pre-book a 15-min approval walkthrough 48h before launch."/>
      </label>
      {editable&&<div className="actions">
       <button type="submit" className="mini-btn primary"><CheckCircle2 size={14}/> Save review</button>
       <button type="button" className="mini-btn" onClick={()=>setEditing(false)}>Cancel</button>
      </div>}
     </form>
    )}
   </div>
  </div>}
 </section>;
}

type RetrospectivesReportProps={
 state:State;
 today:string;
 retrospectives:Record<string,RetrospectiveEntry>;
 onOpenDeal:(dealId:string)=>void;
 onOpenProject:(projectId:string)=>void;
};

export function RetrospectivesReportView({
 state,today,retrospectives,onOpenDeal,onOpenProject
}:RetrospectivesReportProps){
 const [scopeFilter,setScopeFilter]=useState<'all'|'deal'|'project'|'reviewed'|'pending'>('all');

 const items=useMemo(()=>{
  const dealItems=state.opportunities.map(o=>{
   const key=`deal:${o.id}`;
   const rev=retrospectives[key];
   const events=buildDealJourney(state,o.id,today);
   const age=computeDealAging(o,today);
   return {
    key,
    type:'deal' as const,
    id:o.id,
    name:o.name,
    company:state.companies.find(c=>c.id===o.companyId)?.name||'—',
    status:o.stage,
    owner:o.owner,
    cycleDays:age.totalDays,
    cycleLabel:age.totalLabel,
    blockers:events.filter(e=>e.kind==='blocker').length,
    milestones:events.length,
    review:rev
   };
  });
  const projectItems=state.projects.map(p=>{
   const key=`project:${p.id}`;
   const rev=retrospectives[key];
   const events=buildProjectJourney(state,p.id,today);
   const startMs=Date.parse(`${p.start}T00:00:00Z`);
   const endMs=Date.parse(`${(p.completedAt?.slice(0,10)||today)}T00:00:00Z`);
   const cycleDays=Number.isNaN(startMs)||Number.isNaN(endMs)?0:Math.max(0,Math.floor((endMs-startMs)/86400000));
   return {
    key,
    type:'project' as const,
    id:p.id,
    name:p.name,
    company:state.companies.find(c=>c.id===p.companyId)?.name||'—',
    status:p.status,
    owner:p.owner,
    cycleDays,
    cycleLabel:`${cycleDays}d active`,
    blockers:events.filter(e=>e.kind==='blocker').length,
    milestones:events.length,
    review:rev
   };
  });
  return [...dealItems,...projectItems];
 },[state,retrospectives,today]);

 const filtered=useMemo(()=>items.filter(it=>{
  if(scopeFilter==='deal')return it.type==='deal';
  if(scopeFilter==='project')return it.type==='project';
  if(scopeFilter==='reviewed')return Boolean(it.review);
  if(scopeFilter==='pending')return !it.review;
  return true;
 }),[items,scopeFilter]);

 const reviewedCount=items.filter(i=>Boolean(i.review)).length;
 const avgDealCycle=useMemo(()=>{
  const ds=items.filter(i=>i.type==='deal');
  if(!ds.length)return 0;
  return Math.round(ds.reduce((n,i)=>n+i.cycleDays,0)/ds.length);
 },[items]);
 const totalBlockers=items.reduce((n,i)=>n+i.blockers,0);

 return <>
  <div className="metrics compact-metrics">
   <div className="metric"><div>Self-Reviews</div><strong>{reviewedCount}</strong><small>of {items.length} deals &amp; projects</small></div>
   <div className="metric"><div>Avg Deal Cycle</div><strong>{avgDealCycle}d</strong><small>First stage to current/close</small></div>
   <div className="metric"><div>Blockers Logged</div><strong>{totalBlockers}</strong><small>Across linked journeys</small></div>
   <div className="metric"><div>Awaiting Review</div><strong>{items.length-reviewedCount}</strong><small>Click any row to add lessons</small></div>
  </div>

  <section className="panel">
   <div className="section-heading">
    <div>
     <h2>Deal &amp; Project Retrospectives</h2>
     <p>Click any row to open its full Journey Timeline &amp; Self-Review in a slide-over drawer.</p>
    </div>
    <div className="segmented">
     {([['all','All'],['deal','Deals'],['project','Projects'],['reviewed','Reviewed'],['pending','Needs review']] as const).map(([k,lbl])=><button key={k} type="button" className={scopeFilter===k?'selected':''} onClick={()=>setScopeFilter(k)}>{lbl}</button>)}
    </div>
   </div>

   <div className="table-wrap">
    <table className="retro-table">
     <thead>
      <tr>
       <th>Deal / Project</th>
       <th>Type &amp; Status</th>
       <th>Cycle</th>
       <th>Journey</th>
       <th>Self-Review &amp; Playbook</th>
       <th>Open</th>
      </tr>
     </thead>
     <tbody>
      {filtered.map(it=>{
       const openRec=()=>it.type==='deal'?onOpenDeal(it.id):onOpenProject(it.id);
       const snippet=it.review?.playbook||it.review?.couldImprove||it.review?.wentWell||'';
       return <tr key={it.key} tabIndex={0} onClick={openRec} onKeyDown={e=>{if(e.key==='Enter')openRec();}}>
        <td>
         <strong>{it.name}</strong>
         <small>{it.company} · {it.owner}</small>
        </td>
        <td>
         <div className="retro-cell-pills">
          <span className="origin-pill">{it.type==='deal'?'CRM Deal':'Project'}</span>
          <span className="badge blue">{it.status}</span>
         </div>
        </td>
        <td><span className="origin-pill">{it.cycleLabel}</span></td>
        <td>
         <div className="retro-cell-pills">
          <span className="muted" style={{fontSize:12}}>{it.milestones} steps</span>
          {it.blockers>0&&<span className="badge red">{it.blockers} blocker{it.blockers===1?'':'s'}</span>}
         </div>
        </td>
        <td>
         {it.review?(
          <div className="retro-review-cell">
           <span className={`badge ${it.review.rating==='Smooth win'?'green':it.review.rating==='Lost / Post-mortem'?'red':it.review.rating==='Bumpy — needs fix'?'purple':'blue'}`}>{it.review.rating}</span>
           {snippet&&<small className="retro-snippet">{snippet}</small>}
          </div>
         ):<small className="muted">Pending reflection</small>}
        </td>
        <td>
         <button type="button" className="edit-pill" onClick={e=>{e.stopPropagation();openRec();}}>
          {it.review?'View':'Review'}
         </button>
        </td>
       </tr>;
      })}
     </tbody>
    </table>
    {!filtered.length&&<div className="empty">No deals or projects match this filter.</div>}
   </div>
  </section>
 </>;
}
