'use client';
import {useState} from 'react';
import {AlertTriangle,ExternalLink,FileText,Lock,Pin,Plus,Search,Share2} from 'lucide-react';
import {docStatuses,docTypes,type DocumentRecord,type DocStatus,type State} from '../lib/model';
import {docLinkName,docLinkTypeLabel,matchesDocContext,type DocLink,type DocLinkType} from '../lib/workspace-links';

const statusTone=(st:string)=>st==='Approved'?'green':st==='Superseded'?'red':st==='For Review'?'blue':'purple';

type DocumentsPanelProps={
 state:State;
 contextType?:DocLinkType;
 contextId?:string;
 editable:boolean;
 busy:boolean;
 matchesOwner?:(r:{owner?:string;hat?:string})=>boolean;
 onAddDoc:(initialLinks:DocLink[])=>void;
 onEditDoc:(doc:DocumentRecord)=>void;
 onTogglePin:(doc:DocumentRecord)=>void;
 onChangeStatus:(docId:string,status:DocStatus)=>void;
};

export default function DocumentsPanel({
 state,contextType,contextId,editable,busy,matchesOwner,
 onAddDoc,onEditDoc,onTogglePin,onChangeStatus
}:DocumentsPanelProps){
 const [query,setQuery]=useState('');
 const [typeFilter,setTypeFilter]=useState('');
 const [statusFilter,setStatusFilter]=useState('');
 const [audienceFilter,setAudienceFilter]=useState('');
 const [pinnedOnly,setPinnedOnly]=useState(false);

 const isCentral=!contextType;
 const defaultLinks:DocLink[]=contextType&&contextId?[{type:contextType,id:contextId}]:[];

 const docs=(state.documents||[])
  .filter(d=>!contextType||!contextId||matchesDocContext(state,d.links,contextType,contextId))
  .filter(d=>!matchesOwner||matchesOwner(d))
  .filter(d=>!typeFilter||d.docType===typeFilter)
  .filter(d=>!statusFilter||d.status===statusFilter)
  .filter(d=>!audienceFilter||d.audience===audienceFilter)
  .filter(d=>!pinnedOnly||d.pinned)
  .filter(d=>{
   if(!query.trim())return true;
   const q=query.trim().toLowerCase();
   const linksText=d.links.map(l=>docLinkName(state,l)).join(' ');
   return `${d.title} ${d.docType} ${d.description} ${d.tags.join(' ')} ${d.owner} ${linksText}`.toLowerCase().includes(q);
  })
  .sort((a,b)=>{
   if(a.pinned!==b.pinned)return a.pinned?-1:1;
   return (b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||'');
  });

 return <>
  {isCentral&&<div className="notice lavender" style={{marginBottom:'0.85rem'}}>
   External file links remain subject to both DOPAMINE workspace permissions and the file provider&apos;s sharing permissions. Replacing a document URL increments its version and clears prior approval until the new version is reviewed.
  </div>}

  {isCentral&&<div className="toolbar" style={{flexWrap:'wrap'}}>
   <div className="search"><Search size={17}/><input aria-label="Search documents" placeholder="Search title, tags, description or owner…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
   <select aria-label="Filter document type" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>
    <option value="">All types</option>
    {docTypes.map(t=><option key={t} value={t}>{t}</option>)}
   </select>
   <select aria-label="Filter document status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
    <option value="">All statuses</option>
    {docStatuses.map(st=><option key={st} value={st}>{st}</option>)}
   </select>
   <select aria-label="Filter document audience" value={audienceFilter} onChange={e=>setAudienceFilter(e.target.value)}>
    <option value="">All audiences</option>
    <option value="internal">Internal only</option>
    <option value="client-sharing">Intended for client sharing</option>
   </select>
   <button type="button" className={pinnedOnly?'primary':''} onClick={()=>setPinnedOnly(x=>!x)}><Pin size={14}/> Pinned</button>
  </div>}

  <div className="section-heading" style={{marginBottom:'0.65rem'}}>
   <div>
    <h2><FileText size={17} style={{display:'inline',marginRight:6}}/>Documents ({docs.length})</h2>
    <p>{isCentral?'External file links organized by type, version, review status, and audience.':'Linked briefs, proposals, contracts, and deliverables.'}</p>
   </div>
   {editable&&<button type="button" className={isCentral?'primary':'mini-btn'} disabled={busy} onClick={()=>onAddDoc(defaultLinks)}><Plus size={15}/> Add document link</button>}
  </div>

  {docs.length>0?<div className="waiting-list">
   {docs.map(d=>{
    const versionMismatch=Boolean(d.approvedVersion&&d.approvedVersion!==d.version);
    return <article className="waiting-card" key={d.id}>
     <div className="grow">
      <div className="row" style={{justifyContent:'space-between',flexWrap:'wrap',gap:'0.5rem'}}>
       <div className="row" style={{gap:'0.45rem',flexWrap:'wrap'}}>
        <button type="button" className={'pin-toggle'+(d.pinned?' active':'')} disabled={!editable||busy} aria-label={d.pinned?`Unpin ${d.title}`:`Pin ${d.title}`} title={d.pinned?'Unpin document':'Pin key document'} onClick={()=>onTogglePin(d)}><Pin size={14}/></button>
        <strong>{d.title}</strong>
        <span className="origin-pill">v{d.version}</span>
        <span className="origin-pill">{d.docType}</span>
        <span className={'badge '+(d.audience==='client-sharing'?'blue':'purple')}>
         {d.audience==='client-sharing'?<><Share2 size={11} style={{display:'inline',marginRight:4}}/>Client sharing</>:<><Lock size={11} style={{display:'inline',marginRight:4}}/>Internal</>}
        </span>
        <span className={'badge '+statusTone(d.status)}>{d.status}</span>
       </div>
       <div className="actions">
        <a className="edit-pill" href={d.url} target="_blank" rel="noopener noreferrer">Open file <ExternalLink size={12} style={{display:'inline',marginLeft:3}}/></a>
        {editable&&<select aria-label={`Document status: ${d.title}`} disabled={busy} value={d.status} onChange={e=>onChangeStatus(d.id,e.target.value as DocStatus)}>
         {docStatuses.map(st=><option key={st} value={st}>{st}</option>)}
        </select>}
        {editable&&<button type="button" className="mini-btn" disabled={busy} onClick={()=>onEditDoc(d)}>Edit</button>}
       </div>
      </div>
      {d.description&&<p style={{margin:'0.35rem 0'}}>{d.description}</p>}
      <div className="origin-pills" style={{margin:'0.35rem 0'}}>
       {d.links.map(l=><span className="origin-pill" key={`${l.type}:${l.id}`}>{docLinkTypeLabel[l.type]} · {docLinkName(state,l)}</span>)}
       {d.tags.map(tag=><span className="origin-pill" key={`tag:${tag}`}>#{tag}</span>)}
      </div>
      {d.approvedVersion&&!versionMismatch&&d.status==='Approved'&&<small style={{color:'#2f6b3c',display:'block'}}>Approved v{d.approvedVersion}{d.approvedBy?` · ${d.approvedBy}`:''}{d.approvedAt?` · ${new Date(d.approvedAt).toLocaleDateString('en-PH')}`:''}</small>}
      {versionMismatch&&<small className="danger-text" style={{display:'block'}}><AlertTriangle size={12} style={{display:'inline',marginRight:4}}/>URL updated to v{d.version} — previously approved v{d.approvedVersion} does not cover this new version.</small>}
      <small>Owner: {d.owner}{d.hat?` (${d.hat})`:''} · Updated {d.updatedAt?new Date(d.updatedAt).toLocaleDateString('en-PH'):'—'}</small>
     </div>
    </article>;
   })}
  </div>:<div className="empty">No document links match here yet. Add a link to a brief, proposal, contract, or deliverable.</div>}
 </>;
}
