import {env} from 'cloudflare:workers';
import {blank,defaultReminderPreference,normalize,type State,type AccessMember,type RecordLink} from './model';
import {dedupeDocLinks,dedupeLinks,docLinkExists,linkExists,requiredSectionsForDocLinks,requiredSectionsForLinks,syncTaskLinks,taskLinks,type DocLink} from './workspace-links';

export const sections=['My Day','Calendar','Studio Board','Notifications','Overview','Reports','Projects','CRM Pipeline','Contacts','Touchpoints','Companies & brands','Documents','Waiting on','Approvals','Suppliers','Activity','Task statuses'] as const;
export const actionSection:Record<string,string>={project:'Projects',projectEdit:'Projects',projectStatus:'Projects',task:'Projects',taskEdit:'Projects',taskStatus:'Projects',opportunity:'CRM Pipeline',dealStage:'CRM Pipeline',dealLost:'CRM Pipeline',dealEdit:'CRM Pipeline',dealReopen:'CRM Pipeline',dealHandoff:'Projects',contact:'Contacts',contactEdit:'Contacts',contactTypeAssign:'Contacts',brandWarmth:'Companies & brands',warmth:'Contacts',touchpoint:'Touchpoints',touchpointEdit:'Touchpoints',touchDone:'Touchpoints',touchReschedule:'Touchpoints',company:'Companies & brands',companyEdit:'Companies & brands',brand:'Companies & brands',brandEdit:'Companies & brands',doc:'Documents',docEdit:'Documents',docPin:'Documents',docStatus:'Documents',waiting:'Waiting on',waitingEdit:'Waiting on',resolve:'Waiting on',followup:'Waiting on',approval:'Approvals',approvalEdit:'Approvals',decision:'Approvals',revision:'Approvals',supplier:'Suppliers',supplierEdit:'Suppliers',reminderRead:'Notifications',reportViewSave:'Reports',reportViewDelete:'Reports'};

export function identity(req:Request){let name=req.headers.get('oai-authenticated-user-full-name')||req.headers.get('oai-authenticated-user-email')||'Workspace member';if(req.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8'){try{name=decodeURIComponent(name)}catch{}}return{id:req.headers.get('oai-authenticated-user-id')||'',email:(req.headers.get('oai-authenticated-user-email')||'').toLowerCase(),name}}

export async function context(req:Request){
 const user=identity(req);if(!user.id)throw Error('Sign in required');
 // Trust platform identity, never a user-supplied workspace or role parameter.
 const own=await env.DB!.prepare('SELECT owner,revision,data FROM workspaces WHERE owner=?').bind(user.id).first<{owner:string;revision:number;data:string}>();
 if(own){const state=normalize(JSON.parse(own.data));ensureOwner(state,user);return{user,row:own,state,member:null,isOwner:true}}
 const rows=user.email?await env.DB!.prepare("SELECT owner,revision,data FROM workspaces WHERE owner != ? AND EXISTS (SELECT 1 FROM json_each(workspaces.data,'$.members') m WHERE lower(json_extract(m.value,'$.email')) = ?)").bind(user.id,user.email).all<{owner:string;revision:number;data:string}>():{results:[]};
 if(rows.results.length>1)throw Error('This email has more than one workspace membership. Ask the owner to resolve duplicate access.');
 if(rows.results.length){const row=rows.results[0];const state=normalize(JSON.parse(row.data));const member=state.members!.find(m=>m.email.toLowerCase()===user.email)!;return{user,row,state,member:member.coOwner===true?null:member,isOwner:member.coOwner===true}}
 const existing=await env.DB!.prepare('SELECT owner FROM workspaces LIMIT 1').first<{owner:string}>();if(existing)throw Error('Your account has not been added to this workspace. Ask the owner to grant access.');
 const pilotOwnerEmail=env.PILOT_OWNER_EMAIL?.trim().toLowerCase();
 const pilotCoOwnerEmail=env.PILOT_COOWNER_EMAIL?.trim().toLowerCase();
 if(!pilotOwnerEmail||!pilotCoOwnerEmail||pilotOwnerEmail===pilotCoOwnerEmail)throw Error('Pilot workspace setup is incomplete.');
 if(user.email!==pilotOwnerEmail)throw Error('The pilot owner must sign in first to initialize the shared workspace.');
 const initial=blank();
 ensureOwner(initial,user);
 const coOwnerPersonId='pilot-co-owner';
 initial.people.push({id:coOwnerPersonId,name:'Justine',email:pilotCoOwnerEmail,hats:[]});
 initial.members=[{email:pilotCoOwnerEmail,personId:coOwnerPersonId,coOwner:true,sections:[...sections],canEdit:true,financials:true,scopeMode:'all'}];
 await env.DB!.prepare('INSERT OR IGNORE INTO workspaces (owner,revision,data) VALUES (?,0,?)').bind(user.id,JSON.stringify(initial)).run();
 const row=await env.DB!.prepare('SELECT owner,revision,data FROM workspaces WHERE owner=?').bind(user.id).first<{owner:string;revision:number;data:string}>();if(!row)throw Error('Workspace unavailable');const state=normalize(JSON.parse(row.data));ensureOwner(state,user);return{user,row,state,member:null,isOwner:true};
}

function linkPermittedInScope(state:State,member:AccessMember,link:RecordLink,pids:Set<string>,contacts:Set<string>):boolean{
 if(member.scopeMode==='all')return linkExists(state,link);
 const companies=new Set(member.companyIds||[]),brands=new Set(member.brandIds||[]);
 switch(link.type){
  case 'company':return companies.has(link.id)&&state.companies.some(c=>c.id===link.id);
  case 'brand':{const b=state.brands.find(x=>x.id===link.id);return !!b&&(brands.has(b.id)||companies.has(b.companyId))}
  case 'project':return pids.has(link.id);
  case 'contact':return contacts.has(link.id);
 }
}

function docLinkPermittedInScope(state:State,member:AccessMember,link:DocLink,pids:Set<string>,deals:Set<string>):boolean{
 if(member.scopeMode==='all')return docLinkExists(state,link);
 const companies=new Set(member.companyIds||[]),brands=new Set(member.brandIds||[]);
 switch(link.type){
  case 'company':return companies.has(link.id)&&state.companies.some(c=>c.id===link.id);
  case 'brand':{const b=state.brands.find(x=>x.id===link.id);return !!b&&(brands.has(b.id)||companies.has(b.companyId))}
  case 'opportunity':return deals.has(link.id);
  case 'project':return pids.has(link.id);
 }
}

export function scopedState(state:State,member:AccessMember|null):State{
 const out=JSON.parse(JSON.stringify(state)) as State;if(!member)return out;
 out.confidentialNotes=[];
 out.notes=(out.notes||[]).filter(n=>!n.confidential);
 const stripHiddenNoteRefs=(target:State)=>{const visibleNotes=new Set((target.notes||[]).map(n=>n.id));for(const t of target.tasks)if(t.sourceNoteId&&!visibleNotes.has(t.sourceNoteId))delete t.sourceNoteId;};
 if(member.scopeMode==='all'){stripHiddenNoteRefs(out);return out;}
 const companies=new Set(member.companyIds||[]),brands=new Set(member.brandIds||[]),projects=new Set(member.projectIds||[]);
 const account=(r:{companyId:string;brandId?:string})=>companies.has(r.companyId)||!!r.brandId&&brands.has(r.brandId);
 out.projects=out.projects.filter(p=>projects.has(p.id)||account(p));const pids=new Set(out.projects.map(p=>p.id));
 out.opportunities=out.opportunities.filter(account);out.contacts=out.contacts.filter(account);
 const contacts=new Set(out.contacts.map(x=>x.id)),deals=new Set(out.opportunities.map(x=>x.id));
 // Multi-linked notes, documents, and tasks use conservative ALL-links-permitted scope authorization.
 out.notes=(out.notes||[]).filter(n=>!n.confidential&&n.links.length>0&&n.links.every(l=>linkPermittedInScope(state,member,l,pids,contacts)));
 out.documents=(out.documents||[]).filter(d=>d.links.length>0&&d.links.every(l=>docLinkPermittedInScope(state,member,l,pids,deals)));
 out.tasks=out.tasks.filter(t=>{const links=taskLinks(t);if(!links.length)return false;return links.every(l=>linkPermittedInScope(state,member,l,pids,contacts))});
 stripHiddenNoteRefs(out);
 out.waiting=out.waiting.filter(w=>pids.has(w.projectId));out.approvals=out.approvals.filter(a=>pids.has(a.projectId));
 out.touchpoints=out.touchpoints.filter(t=> (!t.projectId||pids.has(t.projectId))&&(!t.contactId||contacts.has(t.contactId))&&(!t.opportunityId||deals.has(t.opportunityId))&&(!!t.projectId||!!t.contactId||!!t.opportunityId||companies.has(t.companyId)));
 const bIds=new Set([...out.projects,...out.contacts,...out.opportunities].map(x=>x.brandId));out.brands=out.brands.filter(b=>companies.has(b.companyId)||brands.has(b.id)||bIds.has(b.id));
 const cids=new Set([...out.projects,...out.brands,...out.contacts,...out.opportunities].map(x=>x.companyId));out.companies=out.companies.filter(c=>companies.has(c.id)||cids.has(c.id)).map(c=>companies.has(c.id)?c:{...c,contact:''});
 const suppliers=new Set([...out.tasks.map(t=>t.supplierId),...out.projects.map(p=>p.supplierId||''),...out.opportunities.map(o=>o.supplierId||'')]);out.suppliers=out.suppliers.filter(s=>suppliers.has(s.id));
 const names=new Set([...out.projects,...out.tasks,...out.waiting,...out.contacts,...out.opportunities,...out.touchpoints,...(out.documents||[])].map(x=>x.owner));out.people=out.people.filter(p=>p.id===member.personId||names.has(p.name));
 // Historical prose has no reliable record scope. Restricted members cannot receive it.
 out.activity=[];return out;
}

function approvalDocumentIds(state:State,action:string,v:Record<string,any>):string[]{
 const ids:string[]=[];
 if(action==='approval'&&v.documentId)ids.push(v.documentId);
 if(action==='decision'||action==='revision'||action==='approvalEdit'){
  const existing=state.approvals.find(a=>a.id===v.id)?.documentId;
  if(existing)ids.push(existing);
  if(action==='approvalEdit'&&v.documentId)ids.push(v.documentId);
 }
 return [...new Set(ids)];
}

export function requiredSectionsForAction(state:State,action:string,v:Record<string,any>):string[]|null{
 const documentIds=approvalDocumentIds(state,action,v);
 if(documentIds.length){
  const allLinks:DocLink[]=[];
  for(const documentId of documentIds){
   const document=state.documents?.find(item=>item.id===documentId);
   if(!document?.links.length)return null;
   allLinks.push(...document.links);
  }
  return ['Approvals','Documents',...requiredSectionsForDocLinks(dedupeDocLinks(allLinks))];
 }
 if(action==='dealHandoff')return['CRM Pipeline','Projects'];
 if(action==='doc'){
  const links=dedupeDocLinks(v.links);
  return links.length?['Documents',...requiredSectionsForDocLinks(links)]:null;
 }
 if(action==='docEdit'||action==='docPin'||action==='docStatus'){
  const existing=(state.documents||[]).find(d=>d.id===v.id);
  const links=dedupeDocLinks([...(existing?.links||[]),...(action==='docEdit'?v.links||[]:[])]);
  return links.length?['Documents',...requiredSectionsForDocLinks(links)]:null;
 }
 if(action==='note'){
  const links=dedupeLinks(v.links);
  return links.length?requiredSectionsForLinks(links):null;
 }
 if(action==='noteEdit'||action==='notePin'||action==='noteUnlock'){
  const existing=(state.notes||[]).find(n=>n.id===v.id);
  const links=dedupeLinks([...(existing?.links||[]),...(action==='noteEdit'?v.links||[]:[])]);
  return links.length?requiredSectionsForLinks(links):null;
 }
 if(action==='noteToTask'){
  const existing=(state.notes||[]).find(n=>n.id===v.noteId);
  const synced=syncTaskLinks(v.projectId||'',v.links);
  const links=dedupeLinks([...(existing?.links||[]),...synced.links]);
  return links.length?requiredSectionsForLinks(links):null;
 }
 if(action==='task'){
  const synced=syncTaskLinks(v.projectId||'',v.links);
  return synced.links.length?requiredSectionsForLinks(synced.links):['Projects'];
 }
 if(action==='taskEdit'||action==='taskStatus'){
  const existing=state.tasks.find(t=>t.id===v.id);
  const incomingLinks=action==='taskEdit'&&Array.isArray(v.links)?v.links:[];
  const links=dedupeLinks([...(existing?taskLinks(existing):[]),...incomingLinks]);
  return links.length?requiredSectionsForLinks(links):['Projects'];
 }
 return actionSection[action]?[actionSection[action]]:null;
}

export function assertRecordAccess(state:State,member:AccessMember|null,action:string,v:Record<string,any>){
 if(!member)return;
 const scoped=scopedState(state,member);
 const pids=new Set(scoped.projects.map(p=>p.id));
 const contacts=new Set(scoped.contacts.map(x=>x.id));
 const deals=new Set(scoped.opportunities.map(x=>x.id));
 const collections:Record<string,keyof State>={projectEdit:'projects',projectStatus:'projects',taskEdit:'tasks',taskStatus:'tasks',dealStage:'opportunities',dealLost:'opportunities',dealEdit:'opportunities',dealReopen:'opportunities',contactEdit:'contacts',warmth:'contacts',contactTypeAssign:'contacts',companyEdit:'companies',brandEdit:'brands',brandWarmth:'brands',supplierEdit:'suppliers',touchpointEdit:'touchpoints',touchDone:'touchpoints',touchReschedule:'touchpoints',waitingEdit:'waiting',resolve:'waiting',followup:'waiting',approvalEdit:'approvals',decision:'approvals',revision:'approvals',noteEdit:'notes',notePin:'notes',noteUnlock:'notes',docEdit:'documents',docPin:'documents',docStatus:'documents'};
 const has=(key:keyof State,id:string)=>Array.isArray(scoped[key])&&(scoped[key] as {id:string}[]).some(x=>x.id===id);
 if(collections[action]&&!has(collections[action],v.id))throw Error('Record access denied');
 if(action==='noteToTask'&&!has('notes',v.noteId))throw Error('Note access denied');
 if((action==='note'||action==='noteEdit')&&v.confidential)throw Error('Confidential notes are owner-only');
 if((action==='noteEdit'||action==='notePin'||action==='noteUnlock')&&(state.notes||[]).find(n=>n.id===v.id)?.confidential)throw Error('Confidential notes are owner-only');
 if(action==='noteToTask'&&(state.notes||[]).find(n=>n.id===v.noteId)?.confidential)throw Error('Confidential notes are owner-only');
 if((action==='doc'||action==='docEdit')&&Array.isArray(v.links)){
  for(const link of dedupeDocLinks(v.links)){
   if(!docLinkPermittedInScope(state,member,link,pids,deals))throw Error('Linked record access denied');
  }
 }else if(Array.isArray(v.links)){
  for(const link of dedupeLinks(v.links)){
   if(!linkPermittedInScope(state,member,link,pids,contacts))throw Error('Linked record access denied');
  }
 }
 if(v.sourceNoteId&&!has('notes',v.sourceNoteId))throw Error('Linked note access denied');
 for(const linkedDocumentId of approvalDocumentIds(state,action,v)){
  if(!has('documents',linkedDocumentId))throw Error('Linked document access denied');
 }
 for(const [field,key] of Object.entries({projectId:'projects',contactId:'contacts',opportunityId:'opportunities',taskId:'tasks',dependsOn:'tasks',supplierId:'suppliers',companyId:'companies',brandId:'brands'}))if(v[field]&&!has(key as keyof State,v[field]))throw Error('Linked record access denied');
 if(action==='dealHandoff'&&Array.isArray(v.projects)){
  const opp=scoped.opportunities.find(o=>o.id===v.opportunityId);
  if(!opp)throw Error('Opportunity access denied');
  for(const item of v.projects){
   if(item.brandId&&!has('brands',item.brandId))throw Error('Brand access denied');
   if(member.scopeMode!=='all'&&!(member.companyIds||[]).includes(opp.companyId)&&!(item.brandId&&(member.brandIds||[]).includes(item.brandId)))throw Error('Account or brand access required');
   if(item.owner&&!scoped.people.some(p=>p.name===item.owner))throw Error('Assignee is outside your permitted work');
  }
 }
 if(member.scopeMode==='all')return;
 if(action==='companyEdit'&&!(member.companyIds||[]).includes(v.id))throw Error('Company access required');
 if(action==='brandWarmth'||action==='brandEdit'){const b=state.brands.find(b=>b.id===v.id);if(!b||(!(member.brandIds||[]).includes(b.id)&&!(member.companyIds||[]).includes(b.companyId)))throw Error('Brand or company access required')}
 if(['company','brand','supplier','supplierEdit'].includes(action))throw Error('Only workspace-wide editors can create or edit shared directory records');
 if(['project','opportunity','contact','contactEdit'].includes(action)&&!(member.companyIds||[]).includes(v.companyId)&&!(v.brandId&&(member.brandIds||[]).includes(v.brandId)))throw Error('Account or brand access required');
 if((action==='touchpoint'||action==='touchpointEdit')&&!v.projectId&&!v.contactId&&!v.opportunityId&&!(member.companyIds||[]).includes(v.companyId))throw Error('Link this touchpoint to a permitted record');
 if(v.owner&&!scoped.people.some(p=>p.name===v.owner))throw Error('Assignee is outside your permitted work');
}

const redactLockedNotes=(notes:State['notes'])=>(notes||[]).map(n=>{const {passcodeHash,...rest}=n;if(n.locked||passcodeHash)return{...rest,locked:true,text:'',edits:[]};return rest;});
export function allowedState(state:State,member:AccessMember|null,userId:string):State{
 const out=scopedState(state,member);out.readReminders={[userId]:state.readReminders?.[userId]||[]};
 const rawPinned=state.pinnedPriorities?.[userId]||[];
 const userPref=state.reminderPrefs?.[userId]||defaultReminderPreference();
 const userFailures=(state.deliveryFailures||[]).filter(f=>f.userId===userId);
 const userReportViews=state.savedReportViews?.[userId]||[];
 if(!member){const existingIds=new Set(out.tasks.map(t=>t.id));out.pinnedPriorities={[userId]:rawPinned.filter(tid=>existingIds.has(tid))};out.reminderPrefs={[userId]:userPref};out.deliveryFailures=userFailures;out.savedReportViews={[userId]:userReportViews};out.notes=redactLockedNotes(out.notes);return out;}
 const can=(section:string)=>member.sections.includes(section);
 out.members=[];out.people=out.people.map(p=>({...p,email:''}));
 if(!can('Projects')){out.projects=[];out.projectTemplates=[]}else out.projectTemplates=(out.projectTemplates||[]).filter(t=>!t.archived).map(({id,name,steps,initialStatus,archived})=>({id,name,steps,initialStatus,archived}));
 if(!can('CRM Pipeline'))out.opportunities=[];
 if(!can('Contacts')){out.contacts=[];out.contactTypes=[]}
 if(!can('Touchpoints'))out.touchpoints=[];
 if(!can('Companies & brands')){out.companies=[];out.brands=[]}
 if(!can('Waiting on'))out.waiting=[];
 if(!can('Approvals'))out.approvals=[];
 if(!can('Suppliers'))out.suppliers=[];
 // Notes, documents, and tasks require section access for ALL of their linked record types.
 out.notes=(out.notes||[]).filter(n=>!n.confidential&&n.links.length>0&&requiredSectionsForLinks(n.links).every(can));
 out.documents=can('Documents')?(out.documents||[]).filter(d=>d.links.length>0&&requiredSectionsForDocLinks(d.links).every(can)):[];
 const visibleDocIds=new Set(out.documents.map(d=>d.id));
 const visibleCompanies=new Set(out.companies.map(item=>item.id));
 const visibleBrands=new Set(out.brands.map(item=>item.id));
 const visibleDeals=new Set(out.opportunities.map(item=>item.id));
 const visibleProjects=new Set(out.projects.map(item=>item.id));
 out.studioPins=can('Studio Board')?(out.studioPins??[]).filter(pin=>!pin.documentId||visibleDocIds.has(pin.documentId)):[];
 const memberName=state.people.find(person=>person.id===member.personId)?.name;
 out.meetings=can('Calendar')||can('My Day')?(out.meetings??[]).filter(meeting=>{
  const linked=meeting.companyId||meeting.brandId||meeting.opportunityId||meeting.projectId;
  const scopedProject=out.projects.find(project=>project.id===meeting.projectId);
  const scopedDeal=out.opportunities.find(deal=>deal.id===meeting.opportunityId);
  const workspaceAccess=member.scopeMode==='all';
  const companyAccess=workspaceAccess||member.companyIds?.includes(meeting.companyId??'')||
   scopedProject?.companyId===meeting.companyId||scopedDeal?.companyId===meeting.companyId;
  const brand=out.brands.find(item=>item.id===meeting.brandId);
  const brandAccess=workspaceAccess||member.brandIds?.includes(meeting.brandId??'')||
   Boolean(brand&&member.companyIds?.includes(brand.companyId))||
   scopedProject?.brandId===meeting.brandId||scopedDeal?.brandId===meeting.brandId;
  return (!meeting.companyId||(visibleCompanies.has(meeting.companyId)&&companyAccess))&&
   (!meeting.brandId||(visibleBrands.has(meeting.brandId)&&brandAccess))&&
   (!meeting.opportunityId||visibleDeals.has(meeting.opportunityId))&&
   (!meeting.projectId||visibleProjects.has(meeting.projectId))&&
   (linked||member.scopeMode==='all'||Boolean(memberName&&(meeting.owner===memberName||meeting.attendees.includes(memberName))));
 }):[];
 out.retrospectives=(out.retrospectives??[]).filter(item=>item.targetType==='deal'?visibleDeals.has(item.targetId):visibleProjects.has(item.targetId));
 for(const a of out.approvals)if(a.documentId&&!visibleDocIds.has(a.documentId)){delete a.documentId;delete a.documentVersion;delete a.documentUrl;}
 out.tasks=out.tasks.filter(t=>{const links=taskLinks(t);if(!links.length)return false;return requiredSectionsForLinks(links).every(can)});
 const visibleTaskIds=new Set(out.tasks.map(t=>t.id));
 out.pinnedPriorities={[userId]:can('My Day')?rawPinned.filter(tid=>visibleTaskIds.has(tid)):[]};
 out.reminderPrefs=can('Notifications')?{[userId]:userPref}:{};
 out.deliveryFailures=can('Notifications')?userFailures:[];
 out.savedReportViews=can('Reports')?{[userId]:userReportViews}:{};
 const visibleNotes=new Set(out.notes.map(n=>n.id));
 for(const t of out.tasks)if(t.sourceNoteId&&!visibleNotes.has(t.sourceNoteId))delete t.sourceNoteId;
 if(!can('Task statuses')&&!can('Projects')&&!out.tasks.length)out.taskStatuses=[];
 // Activity text may contain private notes. Only owners can read legacy events and
 // only members with financial access may read full newer event descriptions.
 out.activity=can('Activity')?out.activity.filter(a=>a.section&&can(a.section)).map(a=>member.financials?a:{...a,text:`Updated ${a.section} record`}):[];
 if(!member.financials){out.projects=out.projects.map(({cost,budget,...p})=>p);out.opportunities=out.opportunities.map(o=>({...o,value:0,mrc:0,otc:0}));}
 out.notes=redactLockedNotes(out.notes);
 return out;
}

export function sessionInfo(c:Awaited<ReturnType<typeof context>>){return{...c.user,isOwner:c.isOwner,canEdit:c.member?.canEdit??true,financials:c.member?.financials??true,scopeMode:c.member?.scopeMode??'all',sections:c.member?.sections||[...sections,'People','Project templates','Access design','Backups & exports'],person:c.state.people.find(p=>p.id===c.member?.personId||p.email.toLowerCase()===c.user.email)?.name||c.user.name}}

export function ensureOwner(s:State,user:{id:string;name:string;email:string}){const byEmail=user.email&&s.people.find(p=>p.email.toLowerCase()===user.email);if(byEmail)return;const byName=s.people.find(p=>p.name===user.name);if(byName&&!byName.email){byName.email=user.email;return}if(!byName)s.people.push({id:`account-${user.id}`,name:user.name,email:user.email,hats:[]})}
