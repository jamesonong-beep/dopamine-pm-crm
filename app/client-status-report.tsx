'use client';
import {useState} from 'react';
import {Printer} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {ResponsiveModal} from '@/components/ui/responsive-modal';
import {category,type Project,type State} from '../lib/model';
import {formatWaitingAge} from '../lib/workspace-links';

type ClientStatusReportProps={
 open:boolean;
 project:Project|null;
 state:State;
 today:string;
 onClose:()=>void;
};

export default function ClientStatusReport({open,project,state,today,onClose}:ClientStatusReportProps){
 const [includeTimeline,setIncludeTimeline]=useState(true);
 const [includeTasks,setIncludeTasks]=useState(true);
 const [includeWaiting,setIncludeWaiting]=useState(true);
 const [includeApprovals,setIncludeApprovals]=useState(true);
 const [includeDocs,setIncludeDocs]=useState(true);
 const [summaryNote,setSummaryNote]=useState('');

 if(!project)return null;
 const company=state.companies.find(c=>c.id===project.companyId);
 const brand=state.brands.find(b=>b.id===project.brandId);
 const tasks=state.tasks.filter(t=>t.projectId===project.id);
 const doneTasks=tasks.filter(t=>category(state,t.status)==='done').length;
 // Strictly client-facing items only: never include confidential notes, internal documents, or supplier costs!
 const clientWaiting=state.waiting.filter(w=>w.projectId===project.id&&!w.resolved&&w.party==='Client');
 const approvals=state.approvals.filter(a=>a.projectId===project.id);
 const clientDocs=(state.documents||[]).filter(d=>d.audience==='client-sharing'&&d.links.some(l=>l.type==='project'&&l.id===project.id));
 const asOf=new Date().toLocaleString('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'})+' PHT';

 return <ResponsiveModal open={open} onOpenChange={(next)=>{if(!next)onClose()}} title={`Client Project Status Report: ${project.name}`}>
  <div style={{display:'flex',flexDirection:'column',gap:'0.85rem'}}>
   <div className="notice lavender">
    Review before sharing. Internal notes, confidential notes, internal-only documents, supplier waiting items, and planned supplier costs are automatically excluded.
   </div>

   <div className="permission-list" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:'0.35rem'}}>
    <label><input type="checkbox" checked={includeTimeline} onChange={e=>setIncludeTimeline(e.target.checked)}/>Overview &amp; timeline</label>
    <label><input type="checkbox" checked={includeTasks} onChange={e=>setIncludeTasks(e.target.checked)}/>Task progress ({doneTasks}/{tasks.length})</label>
    <label><input type="checkbox" checked={includeWaiting} onChange={e=>setIncludeWaiting(e.target.checked)}/>Client inputs needed ({clientWaiting.length})</label>
    <label><input type="checkbox" checked={includeApprovals} onChange={e=>setIncludeApprovals(e.target.checked)}/>Deliverable approvals ({approvals.length})</label>
    <label><input type="checkbox" checked={includeDocs} onChange={e=>setIncludeDocs(e.target.checked)}/>Client-sharing links ({clientDocs.length})</label>
   </div>

   <label style={{display:'flex',flexDirection:'column',gap:'0.25rem',fontSize:13}}>
    Optional executive summary note for client
    <textarea rows={2} placeholder="Add a short status update or next milestone highlight…" value={summaryNote} onChange={e=>setSummaryNote(e.target.value)}/>
   </label>

   <div className="panel printable-status-report" style={{padding:'1.1rem',border:'1px solid #d9cbb8',background:'#fff'}}>
    <div style={{borderBottom:'1px solid #e6dac8',paddingBottom:'0.6rem',marginBottom:'0.75rem'}}>
     <div style={{fontSize:11,letterSpacing:'0.08em',color:'#AA3931',fontWeight:700}}>CLIENT PROJECT STATUS REPORT</div>
     <h3 style={{margin:'0.2rem 0'}}>{project.name}</h3>
     <small>{company?.name||'Client'}{brand?` / ${brand.name}`:''} · {project.engagement} · As of {asOf}</small>
    </div>

    {summaryNote.trim()&&<p style={{marginBottom:'0.75rem'}}><strong>Summary:</strong> {summaryNote.trim()}</p>}

    {includeTimeline&&<div style={{marginBottom:'0.75rem',fontSize:13}}>
     <strong>Status:</strong> {project.status} · <strong>Timeline:</strong> {project.start} – {project.due} · <strong>Project Lead:</strong> {project.owner}
    </div>}

    {includeTasks&&<div style={{marginBottom:'0.75rem'}}>
     <strong style={{fontSize:13}}>Delivery Progress ({doneTasks} / {tasks.length} tasks complete)</strong>
     <ul style={{margin:'0.35rem 0 0 1.1rem',fontSize:13}}>
      {tasks.map(t=><li key={t.id}>{t.name} — <em>{t.status}</em> (Target: {t.due})</li>)}
      {!tasks.length&&<li>No tasks listed yet.</li>}
     </ul>
    </div>}

    {includeWaiting&&<div style={{marginBottom:'0.75rem'}}>
     <strong style={{fontSize:13}}>Items Needed From Client ({clientWaiting.length})</strong>
     <ul style={{margin:'0.35rem 0 0 1.1rem',fontSize:13}}>
      {clientWaiting.map(w=><li key={w.id}>{w.name} — {w.person} · Needed by {w.due} ({formatWaitingAge(w.requested,today)})</li>)}
      {!clientWaiting.length&&<li>No pending client inputs.</li>}
     </ul>
    </div>}

    {includeApprovals&&<div style={{marginBottom:'0.75rem'}}>
     <strong style={{fontSize:13}}>Deliverable Approvals ({approvals.length})</strong>
     <ul style={{margin:'0.35rem 0 0 1.1rem',fontSize:13}}>
      {approvals.map(a=><li key={a.id}>{a.name} (v{a.version}) — {a.status} · Reviewer: {a.reviewer} · Due {a.due}</li>)}
      {!approvals.length&&<li>No approvals recorded.</li>}
     </ul>
    </div>}

    {includeDocs&&<div>
     <strong style={{fontSize:13}}>Shared Documents ({clientDocs.length})</strong>
     <ul style={{margin:'0.35rem 0 0 1.1rem',fontSize:13}}>
      {clientDocs.map(d=><li key={d.id}><a href={d.url} target="_blank" rel="noopener noreferrer">{d.title} (v{d.version} · {d.status})</a></li>)}
      {!clientDocs.length&&<li>No client-sharing document links attached.</li>}
     </ul>
    </div>}
   </div>

   <div className="modal-actions">
    <Button type="button" variant="outline" onClick={onClose}>Close</Button>
    <Button type="button" onClick={()=>window.print()}><Printer size={15}/> Print / Save as PDF</Button>
   </div>
  </div>
 </ResponsiveModal>;
}
