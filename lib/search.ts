import {effectiveDealValue,type State} from './model';
import {docLinkName,linkName,taskLinks} from './workspace-links';

export const searchRecordTypes=[
 'company','brand','contact','opportunity','project','task','touchpoint','waiting','approval','note','document'
] as const;
export type SearchRecordType=(typeof searchRecordTypes)[number];

export type SearchResult={
 type:SearchRecordType;
 id:string;
 title:string;
 subtitle:string;
 snippet:string;
 owner?:string;
 companyId?:string;
 brandId?:string;
 projectId?:string;
 opportunityId?:string;
 section:string;
 badge?:string;
};

export type SearchParams={
 q?:string;
 type?:string;
 companyId?:string;
 brandId?:string;
 owner?:string;
 limit?:number;
};

export type SearchResponse={
 total:number;
 countsByType:Record<SearchRecordType,number>;
 results:SearchResult[];
};

const clip=(text:string,max=140)=>{
 const clean=(text||'').replace(/\s+/g,' ').trim();
 return clean.length>max?clean.slice(0,max-1)+'…':clean;
};

export function searchWorkspace(
 s:State,
 params:SearchParams,
 options:{financials:boolean}
):SearchResponse{
 const q=(params.q||'').trim().toLowerCase();
 const typeFilter=(params.type||'').trim() as SearchRecordType|'';
 const companyFilter=(params.companyId||'').trim();
 const brandFilter=(params.brandId||'').trim();
 const ownerFilter=(params.owner||'').trim();
 const limit=Math.min(100,Math.max(1,params.limit||50));

 const companyName=(id?:string)=>id?s.companies.find(c=>c.id===id)?.name||'':'';
 const brandName=(id?:string)=>id?s.brands.find(b=>b.id===id)?.name||'':'';
 const projectById=(id?:string)=>id?s.projects.find(p=>p.id===id):undefined;

 const items:(SearchResult&{haystack:string})[]=[];

 // Companies
 for(const c of s.companies){
  items.push({
   type:'company',id:c.id,title:c.name,subtitle:c.contact||'Client account',
   snippet:clip(`${c.name} ${c.contact||''}`),
   companyId:c.id,section:'Companies & brands',
   haystack:`${c.name} ${c.contact}`.toLowerCase()
  });
 }

 // Brands
 for(const b of s.brands){
  const cn=companyName(b.companyId);
  items.push({
   type:'brand',id:b.id,title:b.name,subtitle:`${cn} · Warmth: ${b.warmth||'Unrated'}`,
   snippet:clip(`Brand under ${cn} (${b.warmth||'Unrated'})`),
   companyId:b.companyId,brandId:b.id,section:'Companies & brands',badge:b.warmth||'Unrated',
   haystack:`${b.name} ${cn} ${b.warmth||''}`.toLowerCase()
  });
 }

 // Contacts
 for(const c of s.contacts){
  const cn=companyName(c.companyId),bn=brandName(c.brandId);
  const typeLabel=s.contactTypes?.find(t=>t.id===c.typeId)?.name||'';
  items.push({
   type:'contact',id:c.id,title:c.name,
   subtitle:`${cn}${bn?` / ${bn}`:''} · ${c.owner}`,
   snippet:clip([c.title,typeLabel,c.email,c.phone].filter(Boolean).join(' · ')||'CRM contact'),
   owner:c.owner,companyId:c.companyId,brandId:c.brandId||undefined,section:'Contacts',badge:c.warmth||'Unrated',
   haystack:`${c.name} ${c.title} ${c.email} ${c.phone} ${cn} ${bn} ${c.owner} ${typeLabel}`.toLowerCase()
  });
 }

 // Opportunities
 for(const o of s.opportunities){
  const cn=companyName(o.companyId),bn=brandName(o.brandId);
  const supName=o.supplierId?s.suppliers.find(x=>x.id===o.supplierId)?.name||'':'';
  const effVal=effectiveDealValue(o);
  const moneyStr=options.financials?(effVal>0?`PHP ${effVal.toLocaleString('en-PH')}`:'TBD'):'';
  items.push({
   type:'opportunity',id:o.id,title:o.name,
   subtitle:`${cn}${bn?` / ${bn}`:''} · ${o.owner}`,
   snippet:clip([o.stage,moneyStr,o.siteCount?`${o.siteCount} sites`:'',supName,o.referredBy?`via ${o.referredBy}`:'',o.nextAction,o.lostReason].filter(Boolean).join(' · ')),
   owner:o.owner,companyId:o.companyId,brandId:o.brandId||undefined,opportunityId:o.id,section:'CRM Pipeline',badge:o.stage,
   haystack:`${o.name} ${cn} ${bn} ${o.owner} ${o.stage} ${supName} ${o.referredBy||''} ${o.nextAction} ${o.lostReason||''}`.toLowerCase()
  });
 }

 // Projects
 for(const p of s.projects){
  const cn=companyName(p.companyId),bn=brandName(p.brandId);
  items.push({
   type:'project',id:p.id,title:p.name,
   subtitle:`${cn}${bn?` / ${bn}`:''} · ${p.owner}`,
   snippet:clip(`${p.engagement} · ${p.type} · ${p.start} – ${p.due}`),
   owner:p.owner,companyId:p.companyId,brandId:p.brandId||undefined,projectId:p.id,section:'Projects',badge:p.status,
   haystack:`${p.name} ${p.engagement} ${p.type} ${cn} ${bn} ${p.owner} ${p.status}`.toLowerCase()
  });
 }

 // Tasks
 for(const t of s.tasks){
  const p=projectById(t.projectId);
  const links=taskLinks(t);
  const ctx=links.map(l=>linkName(s,l)).join(' · ');
  const companyId=p?.companyId||links.find(l=>l.type==='company')?.id||(links.find(l=>l.type==='brand')?s.brands.find(b=>b.id===links.find(l=>l.type==='brand')!.id)?.companyId:undefined)||(links.find(l=>l.type==='contact')?s.contacts.find(c=>c.id===links.find(l=>l.type==='contact')!.id)?.companyId:undefined);
  const brandId=p?.brandId||links.find(l=>l.type==='brand')?.id||(links.find(l=>l.type==='contact')?s.contacts.find(c=>c.id===links.find(l=>l.type==='contact')!.id)?.brandId:undefined)||undefined;
  items.push({
   type:'task',id:t.id,title:t.name,
   subtitle:`${ctx||'Task'} · ${t.owner} · Due ${t.due}`,
   snippet:clip(`${t.status}${t.hat?` · ${t.hat}`:''} · ${ctx}`),
   owner:t.owner,companyId,brandId,projectId:t.projectId||undefined,section:t.projectId?'Projects':'My Day',badge:t.status,
   haystack:`${t.name} ${t.owner} ${t.status} ${t.hat||''} ${ctx}`.toLowerCase()
  });
 }

 // Touchpoints
 for(const tp of s.touchpoints){
  const cn=companyName(tp.companyId);
  const contact=s.contacts.find(c=>c.id===tp.contactId);
  items.push({
   type:'touchpoint',id:tp.id,title:`${tp.channel}: ${tp.nextAction}`,
   subtitle:`${cn}${contact?` · ${contact.name}`:''} · ${tp.owner}`,
   snippet:clip(tp.summary),
   owner:tp.owner,companyId:tp.companyId,brandId:contact?.brandId||projectById(tp.projectId)?.brandId||undefined,projectId:tp.projectId||undefined,opportunityId:tp.opportunityId||undefined,section:'Touchpoints',badge:tp.done?'Done':'Open',
   haystack:`${tp.channel} ${tp.summary} ${tp.nextAction} ${tp.owner} ${cn} ${contact?.name||''}`.toLowerCase()
  });
 }

 // Waiting On
 for(const w of s.waiting){
  const p=projectById(w.projectId);
  items.push({
   type:'waiting',id:w.id,title:w.name,
   subtitle:`Owed by ${w.person} (${w.party}) · Chase: ${w.owner}`,
   snippet:clip(`${p?.name||''} · ${w.impact} · Due ${w.due}`),
   owner:w.owner,companyId:p?.companyId,brandId:p?.brandId||undefined,projectId:w.projectId,section:'Waiting on',badge:w.resolved?'Resolved':w.party,
   haystack:`${w.name} ${w.person} ${w.party} ${w.owner} ${w.impact} ${p?.name||''}`.toLowerCase()
  });
 }

 // Approvals
 for(const a of s.approvals){
  const p=projectById(a.projectId);
  items.push({
   type:'approval',id:a.id,title:`${a.name} (v${a.version})`,
   subtitle:`${p?.name||'Project'} · Reviewer: ${a.reviewer}`,
   snippet:clip(a.note||`Status: ${a.status} · Due ${a.due}`),
   owner:p?.owner,companyId:p?.companyId,brandId:p?.brandId||undefined,projectId:a.projectId,section:'Approvals',badge:a.status,
   haystack:`${a.name} ${a.reviewer} ${a.status} ${a.note} ${p?.name||''}`.toLowerCase()
  });
 }

 // Permitted Notes (already filtered by allowedState; confidential notes excluded for non-owners; locked note bodies redacted)
 for(const n of s.notes||[]){
  const ctx=n.links.map(l=>linkName(s,l)).join(' · ');
  const firstProj=n.links.find(l=>l.type==='project')?.id;
  const firstComp=n.links.find(l=>l.type==='company')?.id||(firstProj?projectById(firstProj)?.companyId:undefined)||(n.links.find(l=>l.type==='brand')?s.brands.find(b=>b.id===n.links.find(l=>l.type==='brand')!.id)?.companyId:undefined)||(n.links.find(l=>l.type==='contact')?s.contacts.find(c=>c.id===n.links.find(l=>l.type==='contact')!.id)?.companyId:undefined);
  const firstBrand=n.links.find(l=>l.type==='brand')?.id||(firstProj?projectById(firstProj)?.brandId:undefined)||undefined;
  const section=firstProj?'Projects':n.links.some(l=>l.type==='contact')?'Contacts':'Companies & brands';
  const isLocked=Boolean(n.locked||n.passcodeHash);
  items.push({
   type:'note',id:n.id,title:n.title||(isLocked?'Locked note':clip(n.text,60)),
   subtitle:`Note · ${ctx}${n.createdBy?` · by ${n.createdBy}`:''}`,
   snippet:isLocked?'Passcode-locked note — enter passcode to view':clip(n.text),
   owner:n.createdBy,companyId:firstComp,brandId:firstBrand,projectId:firstProj,section,badge:isLocked?'Locked':n.confidential?'Owner-only':n.pinned?'Pinned':'Note',
   haystack:`${n.title||''} ${isLocked?'locked note':n.text} ${ctx} ${n.createdBy||''}`.toLowerCase()
  });
 }

 // Documents metadata
 for(const d of s.documents||[]){
  const ctx=d.links.map(l=>docLinkName(s,l)).join(' · ');
  const firstProj=d.links.find(l=>l.type==='project')?.id;
  const firstOpp=d.links.find(l=>l.type==='opportunity')?.id;
  const firstBrand=d.links.find(l=>l.type==='brand')?.id||(firstProj?projectById(firstProj)?.brandId:undefined)||(firstOpp?s.opportunities.find(o=>o.id===firstOpp)?.brandId:undefined)||undefined;
  const firstComp=d.links.find(l=>l.type==='company')?.id||(firstProj?projectById(firstProj)?.companyId:undefined)||(firstOpp?s.opportunities.find(o=>o.id===firstOpp)?.companyId:undefined)||(firstBrand?s.brands.find(b=>b.id===firstBrand)?.companyId:undefined);
  items.push({
   type:'document',id:d.id,title:`${d.title} (v${d.version})`,
   subtitle:`${d.docType} · ${d.owner} · ${d.audience==='client-sharing'?'Client sharing':'Internal'}`,
   snippet:clip([d.description,d.tags.length?`Tags: ${d.tags.join(', ')}`:'',ctx].filter(Boolean).join(' · ')),
   owner:d.owner,companyId:firstComp,brandId:firstBrand,projectId:firstProj,opportunityId:firstOpp,section:'Documents',badge:d.status,
   haystack:`${d.title} ${d.docType} ${d.description} ${d.tags.join(' ')} ${d.owner} ${d.status} ${d.audience} ${ctx}`.toLowerCase()
  });
 }

 // Filter by q, companyId, brandId, owner BEFORE computing countsByType so counts respect all non-type filters & permissions.
 const baseMatched=items.filter(item=>{
  if(q&&!item.haystack.includes(q))return false;
  if(companyFilter&&item.companyId!==companyFilter)return false;
  if(brandFilter&&item.brandId!==brandFilter)return false;
  if(ownerFilter&&item.owner!==ownerFilter)return false;
  return true;
 });

 const countsByType=Object.fromEntries(searchRecordTypes.map(t=>[t,0])) as Record<SearchRecordType,number>;
 for(const item of baseMatched)countsByType[item.type]++;

 const finalMatched=typeFilter?baseMatched.filter(i=>i.type===typeFilter):baseMatched;
 const results=finalMatched.slice(0,limit).map(({haystack:_,...r})=>r);
 return {total:finalMatched.length,countsByType,results};
}
