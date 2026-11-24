'use client';
import {useEffect,useState} from 'react';
import {Search} from 'lucide-react';
import {ResponsiveModal} from '@/components/ui/responsive-modal';
import type {State,ViewRole} from '../lib/model';
import {searchRecordTypes,searchWorkspace,type SearchRecordType,type SearchResponse,type SearchResult} from '../lib/search';

const typeLabels:Record<SearchRecordType,string>={
 company:'Companies',
 brand:'Brands',
 contact:'Contacts',
 opportunity:'Deals',
 project:'Projects',
 task:'Tasks',
 touchpoint:'Touchpoints',
 waiting:'Waiting on',
 approval:'Approvals',
 note:'Notes',
 document:'Documents'
};

type CommandSearchProps={
 open:boolean;
 onOpenChange:(open:boolean)=>void;
 state:State;
 signed:boolean;
 role:ViewRole;
 scope:string;
 financials:boolean;
 onSelect:(result:SearchResult)=>void;
};

export default function CommandSearch({open,onOpenChange,state,signed,role,scope,financials,onSelect}:CommandSearchProps){
 const [q,setQ]=useState('');
 const [type,setType]=useState<SearchRecordType|''>('');
 const [companyId,setCompanyId]=useState('');
 const [brandId,setBrandId]=useState('');
 const [owner,setOwner]=useState('');
 const [loading,setLoading]=useState(false);
 const [data,setData]=useState<SearchResponse|null>(null);

 useEffect(()=>{
  const onKey=(e:KeyboardEvent)=>{
   if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){
    e.preventDefault();
    onOpenChange(!open);
   }
  };
  window.addEventListener('keydown',onKey);
  return()=>window.removeEventListener('keydown',onKey);
 },[open,onOpenChange]);

 useEffect(()=>{
  if(!open)return;
  let cancelled=false;
  const timer=setTimeout(async()=>{
   if(!signed){
    setData(searchWorkspace(state,{q,type,companyId,brandId,owner},{financials}));
    return;
   }
   setLoading(true);
   try{
    const params=new URLSearchParams();
    if(q.trim())params.set('q',q.trim());
    if(type)params.set('type',type);
    if(companyId)params.set('companyId',companyId);
    if(brandId)params.set('brandId',brandId);
    if(owner)params.set('owner',owner);
    if(role!=='Owner')params.set('role',role);
    if(scope)params.set('scope',scope);
    const r=await fetch(`/api/search?${params.toString()}`);
    if(!r.ok)throw Error('Search unavailable');
    const j=await r.json() as SearchResponse;
    if(!cancelled)setData(j);
   }catch{
    if(!cancelled)setData(searchWorkspace(state,{q,type,companyId,brandId,owner},{financials}));
   }finally{
    if(!cancelled)setLoading(false);
   }
  },140);
  return()=>{cancelled=true;clearTimeout(timer)};
 },[open,q,type,companyId,brandId,owner,signed,role,scope,state,financials]);

 const counts=data?.countsByType;
 const totalAll=counts?Object.values(counts).reduce((a,b)=>a+b,0):0;

 return <ResponsiveModal open={open} onOpenChange={onOpenChange} title="Search Workspace (⌘K / Ctrl+K)">
  <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
   <div className="search" style={{width:'100%'}}>
    <Search size={17}/>
    <input
     autoFocus
     aria-label="Search across all permitted workspace records"
     placeholder="Search companies, brands, contacts, deals, projects, tasks, notes, documents…"
     value={q}
     onChange={e=>setQ(e.target.value)}
    />
   </div>

   <div className="form-grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))'}}>
    <label>Company
     <select aria-label="Search filter company" value={companyId} onChange={e=>{setCompanyId(e.target.value);setBrandId('')}}>
      <option value="">All companies</option>
      {state.companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
     </select>
    </label>
    <label>Brand
     <select aria-label="Search filter brand" value={brandId} onChange={e=>setBrandId(e.target.value)}>
      <option value="">All brands</option>
      {state.brands.filter(b=>!companyId||b.companyId===companyId).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
     </select>
    </label>
    <label>Owner
     <select aria-label="Search filter owner" value={owner} onChange={e=>setOwner(e.target.value)}>
      <option value="">All owners</option>
      {state.people.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
     </select>
    </label>
   </div>

   <div className="type-chips" style={{display:'flex',flexWrap:'wrap',gap:'0.35rem'}}>
    <button type="button" className={type===''?'primary':'mini-btn'} onClick={()=>setType('')}>All ({totalAll})</button>
    {searchRecordTypes.map(t=>{
     const n=counts?.[t]||0;
     if(n===0&&type!==t)return null;
     return <button key={t} type="button" className={type===t?'primary':'mini-btn'} onClick={()=>setType(t)}>{typeLabels[t]} ({n})</button>;
    })}
   </div>

   <div style={{maxHeight:'48vh',overflowY:'auto',display:'flex',flexDirection:'column',gap:'0.4rem'}}>
    {loading&&<div className="muted" style={{fontSize:13}}>Searching permitted records…</div>}
    {!loading&&(data?.results||[]).map(item=><button
     key={`${item.type}:${item.id}`}
     type="button"
     className="approval-line"
     style={{textAlign:'left',width:'100%',cursor:'pointer'}}
     onClick={()=>{onSelect(item);onOpenChange(false)}}
    >
     <div className="grow">
      <div className="row" style={{gap:'0.4rem',flexWrap:'wrap'}}>
       <span className="origin-pill">{typeLabels[item.type]}</span>
       <strong>{item.title}</strong>
       {item.badge&&<span className="badge purple">{item.badge}</span>}
      </div>
      <small>{item.subtitle}</small>
      {item.snippet&&<div className="muted" style={{fontSize:12}}>{item.snippet}</div>}
     </div>
    </button>)}
    {!loading&&(!data||data.results.length===0)&&<div className="empty">No matching permitted records found.</div>}
   </div>
  </div>
 </ResponsiveModal>;
}
