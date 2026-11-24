'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Bookmark,Download,FileBarChart2,Printer,Trash2} from 'lucide-react';
import {hats,type ReportKey,type SavedReportView,type State,type ViewRole} from '../lib/model';
import {buildReport,type ReportFilters} from '../lib/reports';
import type {RetrospectiveEntry} from '../lib/workspace-links';
import {RetrospectivesReportView} from './journey-review';

type ExtendedReportKey=ReportKey|'retrospectives';
const reportTabs:{key:ExtendedReportKey;label:string}[]=[
 {key:'pipeline',label:'Sales Pipeline'},
 {key:'delivery',label:'Project Delivery'},
 {key:'workload',label:'Team Workload'},
 {key:'followups',label:'Client Follow-ups'},
 {key:'waiting',label:'Waiting On & Blockers'},
 {key:'retrospectives',label:'Retrospectives'}
];

type ReportsPanelProps={
 state:State;
 today:string;
 role:ViewRole;
 scope:string;
 financials:boolean;
 signed:boolean;
 busy:boolean;
 initialReport?:ReportKey;
 initialFilters?:ReportFilters;
 savedViews:SavedReportView[];
 retrospectives?:Record<string,RetrospectiveEntry>;
 onSaveView:(payload:{name:string;report:ReportKey;filters:ReportFilters})=>void;
 onDeleteView:(id:string)=>void;
 onOpenProject:(projectId:string)=>void;
 onOpenDeal:(dealId:string)=>void;
 onOpenClientReport:(projectId:string)=>void;
};

export default function ReportsPanel({
 state,today,role,scope,financials,signed,busy,initialReport='delivery',initialFilters={},
 savedViews,retrospectives={},onSaveView,onDeleteView,onOpenProject,onOpenDeal,onOpenClientReport
}:ReportsPanelProps){
 const [activeReport,setActiveReport]=useState<ExtendedReportKey>(initialReport);
 const [filters,setFilters]=useState<ReportFilters>(initialFilters);
 const [bucket,setBucket]=useState('all');
 const [viewName,setViewName]=useState('');

 const standardKey:ReportKey=activeReport==='retrospectives'?'pipeline':activeReport;
 const report=useMemo(()=>buildReport(state,standardKey,filters,{financials,on:today}),[state,standardKey,filters,financials,today]);
 const filteredRows=useMemo(()=>bucket==='all'?report.rows:report.rows.filter(r=>r._bucket===bucket),[report.rows,bucket]);

 const hasActionsCol=activeReport==='delivery'||activeReport==='pipeline';
 const tableCols=useMemo(()=>[
  ...report.columns,
  ...(hasActionsCol?[{key:'__actions__',label:'Actions'}]:[])
 ],[report.columns,hasActionsCol]);

 const defaultWidthFor=(key:string)=>{
  if(['name','project','opportunity','item','nextAction','summary','impact'].includes(key))return 240;
  if(['company','companyBrand','timeline','actions','__actions__'].includes(key))return 215;
  if(['stage','owner','reviewer','person','contact','channel'].includes(key))return 165;
  if(['status','due','followup','requested','completedAt','progress'].includes(key))return 150;
  return 135;
 };
 const colStorageKey=`dopamine:report-columns:v1:${standardKey}`;
 const [colWidths,setColWidths]=useState<Record<string,number>>({});
 const dragCol=useRef<{key:string;x:number;width:number}|null>(null);

 useEffect(()=>{
  try{
   const saved=JSON.parse(window.localStorage.getItem(colStorageKey)||'null');
   setColWidths(saved&&typeof saved==='object'?saved:{});
  }catch{setColWidths({});}
 },[colStorageKey]);

 const getColWidth=(key:string)=>{
  const w=colWidths[key];
  return typeof w==='number'&&w>=90&&w<=700?w:defaultWidthFor(key);
 };
 const resizeCol=(key:string,nextWidth:number)=>{
  const clamped=Math.min(700,Math.max(90,Math.round(nextWidth)));
  setColWidths(prev=>{
   const next={...prev,[key]:clamped};
   try{window.localStorage.setItem(colStorageKey,JSON.stringify(next));}catch{}
   return next;
  });
 };
 const resetCols=()=>{
  setColWidths({});
  try{window.localStorage.removeItem(colStorageKey);}catch{}
 };

 const exportUrl=useMemo(()=>{
  const p=new URLSearchParams({report:activeReport});
  if(filters.from)p.set('from',filters.from);
  if(filters.to)p.set('to',filters.to);
  if(filters.companyId)p.set('companyId',filters.companyId);
  if(filters.brandId)p.set('brandId',filters.brandId);
  if(filters.projectId)p.set('projectId',filters.projectId);
  if(filters.owner)p.set('owner',filters.owner);
  if(filters.hat)p.set('hat',filters.hat);
  if(role!=='Owner')p.set('role',role);
  if(scope)p.set('scope',scope);
  return `/api/reports/export?${p.toString()}`;
 },[activeReport,filters,role,scope]);

 return <>
  <div className="segmented" style={{marginBottom:'0.85rem',flexWrap:'wrap'}}>
   {reportTabs.map(t=><button key={t.key} type="button" className={activeReport===t.key?'selected':''} onClick={()=>{setActiveReport(t.key);setBucket('all')}}>{t.label}</button>)}
  </div>

  {activeReport==='retrospectives'?<RetrospectivesReportView state={state} today={today} retrospectives={retrospectives} onOpenDeal={onOpenDeal} onOpenProject={onOpenProject}/>:<>
  <div className="panel" style={{padding:'0.9rem 1.15rem',marginBottom:'0.85rem'}}>
   <div className="form-grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))'}}>
    <label>From date<input type="date" value={filters.from||''} onChange={e=>setFilters(f=>({...f,from:e.target.value||undefined}))}/></label>
    <label>To date<input type="date" value={filters.to||''} onChange={e=>setFilters(f=>({...f,to:e.target.value||undefined}))}/></label>
    <label>Company
     <select value={filters.companyId||''} onChange={e=>setFilters(f=>({...f,companyId:e.target.value||undefined,brandId:undefined}))}>
      <option value="">All companies</option>
      {state.companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
     </select>
    </label>
    <label>Brand
     <select value={filters.brandId||''} onChange={e=>setFilters(f=>({...f,brandId:e.target.value||undefined}))}>
      <option value="">All brands</option>
      {state.brands.filter(b=>!filters.companyId||b.companyId===filters.companyId).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
     </select>
    </label>
    <label>Project
     <select value={filters.projectId||''} onChange={e=>setFilters(f=>({...f,projectId:e.target.value||undefined}))}>
      <option value="">All projects</option>
      {state.projects.filter(p=>!filters.companyId||p.companyId===filters.companyId).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
     </select>
    </label>
    <label>Owner
     <select value={filters.owner||''} onChange={e=>setFilters(f=>({...f,owner:e.target.value||undefined}))}>
      <option value="">Everyone</option>
      {state.people.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
     </select>
    </label>
    <label>Work role
     <select value={filters.hat||''} onChange={e=>setFilters(f=>({...f,hat:e.target.value||undefined}))}>
      <option value="">All roles</option>
      {hats.map(h=><option key={h} value={h}>{h}</option>)}
     </select>
    </label>
   </div>
   <div className="row" style={{justifyContent:'space-between',marginTop:'0.65rem',flexWrap:'wrap',gap:'0.5rem'}}>
    <div className="actions" style={{flexWrap:'wrap'}}>
     <button type="button" className="mini-btn" onClick={()=>{setFilters({});setBucket('all')}}>Clear filters</button>
     {signed&&<a className="download-link" href={exportUrl}><Download size={14} style={{display:'inline',marginRight:4}}/>Export Filtered CSV</a>}
    </div>
    {signed&&role==='Owner'&&<form className="actions" onSubmit={e=>{e.preventDefault();if(!viewName.trim())return;onSaveView({name:viewName.trim(),report:standardKey,filters});setViewName('')}}>
     <input aria-label="Save report view name" placeholder="Save view name…" value={viewName} onChange={e=>setViewName(e.target.value)} style={{maxWidth:180}}/>
     <button type="submit" className="mini-btn" disabled={busy||!viewName.trim()}><Bookmark size={13}/> Save view</button>
    </form>}
   </div>
   {savedViews.length>0&&<div className="type-chips" style={{marginTop:'0.6rem',display:'flex',flexWrap:'wrap',gap:'0.35rem'}}>
    {savedViews.map(v=><span key={v.id} className="origin-pill" style={{display:'inline-flex',alignItems:'center',gap:'0.35rem'}}>
     <button type="button" className="text-button" style={{padding:0,fontSize:12}} onClick={()=>{setActiveReport(v.report);setFilters(v.filters||{});setBucket('all')}}>{v.name}</button>
     {signed&&role==='Owner'&&<button type="button" aria-label={`Delete saved view ${v.name}`} style={{background:'none',border:'none',cursor:'pointer',padding:0}} onClick={()=>onDeleteView(v.id)}><Trash2 size={12}/></button>}
    </span>)}
   </div>}
  </div>

  <div className="metrics">
   {report.metrics.map(m=><button
    key={m.key}
    type="button"
    className="metric"
    style={{border:bucket===m.key?'2px solid #AA3931':undefined}}
    onClick={()=>setBucket(b=>b===m.key?'all':m.key)}
   >
    <div><span>{m.label}</span><FileBarChart2 size={17}/></div>
    <strong>{m.value}</strong>
    <small>{m.sub}</small>
   </button>)}
  </div>

  <section className="panel">
   <div className="section-heading">
    <div>
     <h2>{report.title}</h2>
     <p>{report.definition}</p>
    </div>
    <small className="muted">As of {report.asOf}</small>
   </div>
   <div className="column-tools">
    <span>Drag any column edge to resize (or focus an edge and use ← / →). Scroll sideways for more columns.</span>
    <button type="button" onClick={resetCols}>Reset Columns</button>
   </div>
   <div className="table-wrap delivery-scroll">
    <table className="delivery-table" style={{width:tableCols.reduce((sum,c)=>sum+getColWidth(c.key),0)}}>
     <colgroup>
      {tableCols.map(c=><col key={c.key} style={{width:getColWidth(c.key)}}/>)}
     </colgroup>
     <thead>
      <tr>
       {tableCols.map(c=>{
        const w=getColWidth(c.key);
        return <th key={c.key} scope="col">
         {c.label}
         <span
          className="column-resizer"
          role="separator"
          tabIndex={0}
          aria-label={`Resize ${c.label} column`}
          aria-orientation="vertical"
          aria-valuemin={90}
          aria-valuemax={700}
          aria-valuenow={w}
          title="Drag to resize; arrow keys adjust width"
          onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();dragCol.current={key:c.key,x:e.clientX,width:w};e.currentTarget.setPointerCapture(e.pointerId)}}
          onPointerMove={e=>{if(dragCol.current?.key===c.key)resizeCol(c.key,dragCol.current.width+e.clientX-dragCol.current.x)}}
          onPointerUp={e=>{dragCol.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}}
          onPointerCancel={()=>{dragCol.current=null}}
          onLostPointerCapture={()=>{dragCol.current=null}}
          onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home'].includes(e.key)){e.preventDefault();resizeCol(c.key,e.key==='Home'?defaultWidthFor(c.key):w+(e.key==='ArrowRight'?20:-20))}}}
         />
        </th>;
       })}
      </tr>
     </thead>
     <tbody>
      {filteredRows.map((row,idx)=><tr key={String(row._id||idx)}>
       {report.columns.map(c=><td key={c.key}>{row[c.key]}</td>)}
       {activeReport==='delivery'&&<td><div className="actions"><button type="button" className="edit-pill" onClick={()=>onOpenProject(String(row._id))}>Project</button><button type="button" className="mini-btn" onClick={()=>onOpenClientReport(String(row._id))}><Printer size={12}/> Client status</button></div></td>}
       {activeReport==='pipeline'&&<td><button type="button" className="edit-pill" onClick={()=>onOpenDeal(String(row._id))}>Details</button></td>}
      </tr>)}
     </tbody>
    </table>
    {!filteredRows.length&&<div className="empty">No permitted records match these report filters.</div>}
   </div>
  </section>
  </>}
 </>;
}
