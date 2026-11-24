'use client';
import {useMemo,useState} from 'react';
import {Check,Link2,Plus,Search,X} from 'lucide-react';

export type LinkGroup<T extends string>={
 type:T;
 label:string;
 items:{id:string;name:string}[];
};

const shortTypeLabel:Record<string,string>={
 company:'Company',
 brand:'Brand',
 project:'Project',
 contact:'Contact',
 opportunity:'Deal'
};

export default function LinkedRecordsPicker<T extends string>({
 title,
 helper,
 groups,
 selected,
 onToggle
}:{
 title:string;
 helper:string;
 groups:LinkGroup<T>[];
 selected:{type:T;id:string}[];
 onToggle:(link:{type:T;id:string},checked:boolean)=>void;
}){
 const [open,setOpen]=useState(false);
 const [activeType,setActiveType]=useState<string>('all');
 const [query,setQuery]=useState('');

 const itemLookup=useMemo(()=>{
  const map=new Map<string,{type:T;id:string;name:string;typeLabel:string}>();
  for(const g of groups){
   for(const item of g.items){
    map.set(`${g.type}:${item.id}`,{
     type:g.type,
     id:item.id,
     name:item.name,
     typeLabel:shortTypeLabel[g.type]||g.label
    });
   }
  }
  return map;
 },[groups]);

 const filteredGroups=useMemo(()=>{
  const q=query.trim().toLowerCase();
  return groups
   .filter(g=>activeType==='all'||g.type===activeType)
   .map(g=>({
    ...g,
    items:q?g.items.filter(i=>i.name.toLowerCase().includes(q)):g.items
   }))
   .filter(g=>g.items.length>0);
 },[groups,activeType,query]);

 return (
  <div className="link-picker">
   <div className="link-picker-head">
    <div>
     <h3><Link2 size={14}/>{title}</h3>
     <small>{helper}</small>
    </div>
    <button
     type="button"
     className="mini-btn"
     onClick={()=>{setOpen(x=>!x);setQuery('');}}
    >
     {open?'Done':<><Plus size={13}/>{selected.length?'Link another':'Link record'}</>}
    </button>
   </div>

   {selected.length>0?(
    <div className="link-chips">
     {selected.map(link=>{
      const info=itemLookup.get(`${link.type}:${link.id}`);
      const label=info?`${info.typeLabel} · ${info.name}`:`${shortTypeLabel[link.type]||link.type} · ${link.id}`;
      return (
       <span className="link-chip" key={`${link.type}:${link.id}`}>
        <span>{label}</span>
        <button
         type="button"
         aria-label={`Remove ${label}`}
         onClick={()=>onToggle(link,false)}
        >
         <X size={12}/>
        </button>
       </span>
      );
     })}
    </div>
   ):(
    <div className="link-empty">No linked records selected yet.</div>
   )}

   {open&&(
    <div className="link-picker-panel">
     <div className="link-picker-search">
      <Search size={14}/>
      <input
       type="text"
       value={query}
       onChange={e=>setQuery(e.target.value)}
       placeholder="Search companies, brands, projects, contacts…"
       aria-label="Search records to link"
      />
      {query&&(
       <button type="button" className="link-search-clear" onClick={()=>setQuery('')} aria-label="Clear search">
        <X size={13}/>
       </button>
      )}
     </div>

     <div className="link-picker-tabs" role="tablist" aria-label="Filter record type">
      <button
       type="button"
       className={activeType==='all'?'active':''}
       onClick={()=>setActiveType('all')}
      >
       All
      </button>
      {groups.map(g=>(
       <button
        key={g.type}
        type="button"
        className={activeType===g.type?'active':''}
        onClick={()=>setActiveType(g.type)}
       >
        {g.label}
       </button>
      ))}
     </div>

     <div className="link-picker-list">
      {filteredGroups.map(g=>(
       <div className="link-picker-group" key={g.type}>
        <div className="link-picker-group-label">{g.label}</div>
        {g.items.map(item=>{
         const isSelected=selected.some(l=>l.type===g.type&&l.id===item.id);
         return (
          <button
           key={item.id}
           type="button"
           className={'link-picker-option'+(isSelected?' is-selected':'')}
           onClick={()=>onToggle({type:g.type,id:item.id},!isSelected)}
          >
           <span className="link-picker-check" aria-hidden="true">
            {isSelected&&<Check size={12}/>}
           </span>
           <span className="link-picker-option-name">{item.name}</span>
          </button>
         );
        })}
       </div>
      ))}
      {!filteredGroups.length&&(
       <div className="link-empty">No matching records found.</div>
      )}
     </div>
    </div>
   )}
  </div>
 );
}
