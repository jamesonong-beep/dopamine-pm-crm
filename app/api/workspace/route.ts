import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {applySharedWork,sharedWorkSchema} from '../../../lib/shared-work';
import {blank,sample,visibleState,normalize,category,day,docStatuses,effectiveDealValue,pipelineStages,hats,reminders,type State,type ViewRole} from '../../../lib/model';
import {commitWorkspace,rateLimit,securityLog,HttpError} from '../../../lib/security-storage';
import {context,allowedState,sessionInfo,ensureOwner,sections,actionSection,assertRecordAccess,requiredSectionsForAction} from '../../../lib/access';
import {dedupeDocLinks,dedupeLinks,docLinkExists,docLinkTypes,isValidExternalUrl,linkExists,primarySectionForTask,recordLinkTypes,requiredSectionsForLinks,syncTaskLinks} from '../../../lib/workspace-links';

export const dynamic='force-dynamic';
const str=z.string().trim().max(1000);const required=str.min(1);const longText=z.string().trim().min(1).max(10000);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'Invalid date');
const hat=z.preprocess(v=>v===''?undefined:v,z.string().trim().max(60).optional());
const linkSchema=z.object({type:z.enum(recordLinkTypes),id:required});
const docLinkSchema=z.object({type:z.enum(docLinkTypes),id:required});
const extUrl=z.string().trim().min(1).max(2000).refine(isValidExternalUrl,'Use a valid http:// or https:// file link');
const tagsInput=z.union([z.string().max(1000).transform(v=>v.split(',').map(x=>x.trim()).filter(Boolean).slice(0,30)),z.array(z.string().trim().min(1).max(60)).max(30)]).optional().default([]);

const schemas:Record<string,z.ZodTypeAny>={
 sharedWork:sharedWorkSchema,
 templateSave:z.object({id:str.optional(),name:z.string().trim().min(1).max(100),steps:z.string().max(20000).transform(v=>v.split('\n').map(x=>x.trim()).filter(Boolean)).refine(v=>v.length>0&&v.length<=100&&v.every(x=>x.length<=200),'Use 1–100 task lines, at most 200 characters each'),initialStatus:z.string().trim().min(1).max(60)}),
 templateArchive:z.object({id:required,archived:z.boolean()}),templateOrder:z.object({ids:z.array(required).max(200)}),
 contactTypeSave:z.object({id:str.optional(),name:z.string().trim().min(1).max(60)}),contactTypeAssign:z.object({id:required,typeId:str}),brandWarmth:z.object({id:required,warmth:z.enum(['Unrated','Cold','Warm','Hot'])}),
 listItemSave:z.object({list:z.enum(['workRoles','docTypes','touchpointChannels','projectStatuses','contactTypes']),oldValue:str.optional(),id:str.optional(),value:z.string().trim().min(1).max(60)}),
 listItemRemove:z.object({list:z.enum(['workRoles','docTypes','touchpointChannels','projectStatuses','contactTypes']),value:str.optional(),id:str.optional()}),
 confidentialNote:z.object({projectId:required,text:required}),
 confidentialNoteEdit:z.object({id:required,text:required}),
 note:z.object({title:z.string().trim().max(200).optional().default(''),text:longText,pinned:z.boolean().optional().default(false),confidential:z.boolean().optional().default(false),locked:z.boolean().optional().default(false),passcode:z.string().trim().max(100).optional().default(''),links:z.array(linkSchema).min(1,'Link this note to at least one record').max(50)}),
 noteEdit:z.object({id:required,title:z.string().trim().max(200).optional(),text:longText,confidential:z.boolean().optional(),locked:z.boolean().optional(),passcode:z.string().trim().max(100).optional(),currentPasscode:z.string().trim().max(100).optional(),links:z.array(linkSchema).min(1,'Link this note to at least one record').max(50).optional()}),
 notePin:z.object({id:required,pinned:z.boolean()}),
 noteUnlock:z.object({id:required,passcode:z.string().trim().min(1,'Enter passcode').max(100)}),
 noteToTask:z.object({noteId:required,name:required,owner:required,hat,supplierId:str.default(''),due:date,projectId:str.default(''),dependsOn:str.default(''),links:z.array(linkSchema).max(50).optional()}),
 person:z.object({name:required,email:z.union([z.string().email(),z.literal('')]),hats:z.string().max(300).optional()}),
 personEdit:z.object({id:required,name:required,email:z.union([z.string().email(),z.literal('')]),hats:z.string().max(300).optional()}),
 member:z.object({personId:required,coOwner:z.boolean().optional().default(false),sections:z.array(z.enum(sections)),canEdit:z.boolean(),financials:z.boolean(),scopeMode:z.enum(['all','selected']).default('selected'),companyIds:z.array(required).default([]),brandIds:z.array(required).default([]),projectIds:z.array(required).default([])}),memberRemove:z.object({personId:required}),reminderRead:z.object({id:required}),priorityPin:z.object({taskId:required,pinned:z.boolean()}),
 reminderPrefsSave:z.object({inApp:z.boolean(),email:z.boolean(),dailyDigest:z.boolean(),digestTime:z.string().regex(/^\d{2}:\d{2}$/,'Use HH:MM format'),timezone:z.string().trim().min(1).max(60).default('Asia/Manila')}),
 reminderTestEmail:z.object({}),
 reportViewSave:z.object({id:str.optional(),name:z.string().trim().min(1).max(80),report:z.enum(['pipeline','delivery','workload','followups','waiting']),filters:z.object({from:z.union([date,z.literal('')]).optional(),to:z.union([date,z.literal('')]).optional(),companyId:str.optional(),brandId:str.optional(),projectId:str.optional(),owner:str.optional(),hat:str.optional()}).default({})}),
 reportViewDelete:z.object({id:required}),
 warmth:z.object({id:required,warmth:z.enum(['Unrated','Cold','Warm','Hot'])}),dealLost:z.object({id:required,reason:required,retargetDate:z.union([date,z.literal('')]).optional().default('')}),
 dealEdit:z.object({id:required,name:required.optional(),brandId:str.optional(),owner:required,hat,value:z.coerce.number().min(0).max(1e12).optional(),mrc:z.coerce.number().min(0).max(1e12).optional(),otc:z.coerce.number().min(0).max(1e12).optional(),siteCount:z.coerce.number().int().min(0).max(100000).optional(),supplierId:str.optional(),referredBy:str.optional(),nextAction:str,nextActionDate:z.union([date,z.literal('')]).optional().default(''),retargetDate:z.union([date,z.literal('')]).optional()}),
 dealReopen:z.object({id:required,stage:z.enum(pipelineStages),nextAction:str.optional(),nextActionDate:z.union([date,z.literal('')]).optional()}),
 dealHandoff:z.object({opportunityId:required,projects:z.array(z.object({brandId:str.default(''),name:required,engagement:required,type:required,owner:required,hat,start:date,due:date,budget:z.coerce.number().min(0).max(1e12).default(0),cost:z.coerce.number().min(0).max(1e12).default(0),siteCount:z.coerce.number().int().min(0).max(100000).optional(),supplierId:str.optional(),notes:z.string().trim().max(5000).optional()}).refine(v=>v.due>=v.start,'Due date must follow start date')).min(1,'Add at least one project to hand off').max(20)}),
 contact:z.object({companyId:required,brandId:str,name:required,title:str,email:z.union([z.string().email(),z.literal('')]),phone:str,typeId:str.default(''),owner:str.default(''),hat}),
 contactEdit:z.object({id:required,companyId:required,brandId:str,name:required,title:str,email:z.union([z.string().email(),z.literal('')]),phone:str,typeId:str.default(''),owner:str.default(''),hat}),
 touchpoint:z.object({companyId:required,contactId:str,opportunityId:str,projectId:str,channel:z.string().trim().min(1).max(60),summary:required,owner:required,hat,nextAction:required,followup:date,createFollowupTask:z.boolean().optional().default(false)}),
 touchpointEdit:z.object({id:required,companyId:required,contactId:str,opportunityId:str,projectId:str,channel:z.string().trim().min(1).max(60),summary:required,owner:required,hat,nextAction:required,followup:date}),
 touchDone:z.object({id:required}),touchReschedule:z.object({id:required,followup:date}),
 projectEdit:z.object({id:required,name:required.optional(),engagement:required.optional(),brandId:str.optional(),owner:required,hat,start:date,due:date,budget:z.coerce.number().min(0).max(1e12).optional(),cost:z.coerce.number().min(0).max(1e12).optional()}).refine(v=>v.due>=v.start,'Completion must be on or after the start date'),
 statusSave:z.object({oldName:str,name:z.string().trim().min(1).max(40),category:z.enum(['todo','active','done'])}),
 opportunity:z.object({companyId:required,brandId:str,name:required,owner:required,hat,value:z.coerce.number().min(0).max(1e12),mrc:z.coerce.number().min(0).max(1e12).optional().default(0),otc:z.coerce.number().min(0).max(1e12).optional().default(0),siteCount:z.coerce.number().int().min(0).max(100000).optional().default(0),supplierId:str.optional().default(''),referredBy:str.optional().default(''),nextAction:str,nextActionDate:z.union([date,z.literal('')]).optional().default('')}),dealStage:z.object({id:required,stage:z.enum(pipelineStages)}),company:z.object({name:required,contact:str}),companyEdit:z.object({id:required,name:required,contact:str}),brand:z.object({companyId:required,name:required,warmth:z.enum(['Unrated','Cold','Warm','Hot']).default('Unrated')}),brandEdit:z.object({id:required,name:required}),supplier:z.object({name:required,service:str,contact:str}),supplierEdit:z.object({id:required,name:required,service:str,contact:str}),
 project:z.object({companyId:required,brandId:str,name:required,engagement:required,type:required,owner:required,hat,start:date,due:date,budget:z.coerce.number().min(0).max(1e12),cost:z.coerce.number().min(0).max(1e12),opportunityId:str.optional().default('')}).refine(v=>v.due>=v.start,'Due date must follow start date'),
 task:z.object({projectId:str.default(''),name:required,owner:required,hat,supplierId:str.default(''),due:date,dependsOn:str.default(''),links:z.array(linkSchema).max(50).optional(),sourceNoteId:str.default('')}),
 waiting:z.object({projectId:required,taskId:str,name:required,party:z.enum(['Client','Supplier','Internal']),person:required,owner:required,hat,due:date,followup:date,impact:required}),
 waitingEdit:z.object({id:required,taskId:str,name:required,party:z.enum(['Client','Supplier','Internal']),person:required,owner:required,hat,due:date,followup:date,impact:required,resolution:str.optional()}),
 doc:z.object({title:z.string().trim().min(1).max(200),url:extUrl,docType:z.string().trim().min(1).max(60),owner:required,hat,status:z.enum(docStatuses).default('Draft'),description:str.default(''),tags:tagsInput,audience:z.enum(['internal','client-sharing']).default('internal'),pinned:z.boolean().optional().default(false),links:z.array(docLinkSchema).min(1,'Link this document to at least one company, brand, deal or project').max(50)}),
 docEdit:z.object({id:required,title:z.string().trim().min(1).max(200),url:extUrl,docType:z.string().trim().min(1).max(60),owner:required,hat,description:str.default(''),tags:tagsInput,audience:z.enum(['internal','client-sharing']).default('internal'),links:z.array(docLinkSchema).min(1,'Link this document to at least one company, brand, deal or project').max(50).optional()}),
 docPin:z.object({id:required,pinned:z.boolean()}),
 docStatus:z.object({id:required,status:z.enum(docStatuses)}),
 approval:z.object({projectId:required,name:required,reviewer:required,due:date,note:str,documentId:str.optional().default('')}),
 approvalEdit:z.object({id:required,name:required,reviewer:required,due:date,note:str,documentId:str.optional()}),
 taskEdit:z.object({id:required,name:required.optional(),owner:required,hat,supplierId:str,due:date,dependsOn:str.optional(),links:z.array(linkSchema).max(50).optional()}),taskStatus:z.object({id:required,status:required}),projectStatus:z.object({id:required,status:z.string().trim().min(1).max(60)}),
 resolve:z.object({id:required,resolution:required}),followup:z.object({id:required,followup:date}),decision:z.object({id:required,status:z.enum(['Approved','Changes requested']),note:required}),revision:z.object({id:required,note:required}),sample:z.object({}),clear:z.object({confirm:z.literal('CLEAR SAMPLE')})
};

function reply(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}})}
async function hashPasscode(noteId:string,passcode:string){const bytes=new TextEncoder().encode(`dopamine-note-v1:${noteId}:${passcode}`);const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');}

export async function GET(req:Request){if(!req.headers.get('oai-authenticated-user-id'))return reply({error:'Sign in to access your workspace.'},401);try{const c=await context(req);const role=new URL(req.url).searchParams.get('role')||'Owner';if(!['Owner','Team','Client','Supplier'].includes(role))return reply({error:'Invalid view'},400);const permitted=allowedState(c.state,c.member,c.user.id);return reply({revision:c.row.revision,state:c.isOwner?visibleState(permitted,role as ViewRole,new URL(req.url).searchParams.get('scope')||''):permitted,session:sessionInfo(c)});}catch(e){return reply({error:(e as Error).message},403)}}

export async function POST(req:Request){const id=req.headers.get('oai-authenticated-user-id');if(!id)return reply({error:'Sign in required'},401);const origin=req.headers.get('origin');if(!origin||origin!==new URL(req.url).origin)return reply({error:'Origin not allowed'},403);if(Number(req.headers.get('content-length')||0)>1250000)return reply({error:'Request too large'},413);
 try {const raw=await req.text();if(raw.length>1250000)return reply({error:'Request too large'},413);const body=JSON.parse(raw);if(body.action!=='sharedWork'&&raw.length>30000)return reply({error:'Request too large'},413);const schema=schemas[body.action];if(!schema)return reply({error:'Unknown action'},400);const v=schema.parse(body.values);const c=await context(req);await rateLimit(c.user.id,'write',120);const row=c.row;if(!row)return reply({error:'Workspace unavailable'},503);if(row.revision!==body.revision)return reply({error:'Workspace changed in another tab. Refresh and try again.'},409);let s:State=c.state;
 const personalNotifAction=['reminderRead','reminderPrefsSave','reminderTestEmail'].includes(body.action);
 const personalReportAction=['reportViewSave','reportViewDelete'].includes(body.action);
 const isNoteUnlock=body.action==='noteUnlock';
 const reqSections=requiredSectionsForAction(s,body.action,v);
 if(!c.isOwner&&!personalNotifAction&&!personalReportAction&&body.action!=='priorityPin'&&!isNoteUnlock&&(!c.member?.canEdit||!reqSections||!reqSections.length||!reqSections.every(sec=>c.member!.sections.includes(sec)))){await securityLog(c.row.owner,c.user.id,'denied-write',body.action);return reply({error:'You do not have permission for this section or action.'},403);}
 if(!c.isOwner&&isNoteUnlock&&(!reqSections||!reqSections.length||!reqSections.every(sec=>c.member!.sections.includes(sec)))){await securityLog(c.row.owner,c.user.id,'denied-read',body.action);return reply({error:'You do not have permission to view this note.'},403);}
 if(!c.isOwner&&personalNotifAction&&!c.member?.sections.includes('Notifications'))return reply({error:'Notifications are not enabled for this member.'},403);
 if(!c.isOwner&&personalReportAction&&!c.member?.sections.includes('Reports'))return reply({error:'Reports are not enabled for this member.'},403);
 if(!c.isOwner&&body.action==='priorityPin'&&!c.member?.sections.includes('My Day'))return reply({error:'My Day is not enabled for this member.'},403);
 if(!c.isOwner&&!c.member?.financials&&['project','projectEdit','opportunity','dealEdit'].includes(body.action)){if(v.budget||v.cost||v.value||v.mrc||v.otc)return reply({error:'Financial values require financial access.'},403);}
 if(!c.isOwner&&!c.member?.financials&&body.action==='dealHandoff'){if(v.projects.some((p:{budget?:number;cost?:number})=>p.budget||p.cost))return reply({error:'Financial values require financial access.'},403);}
 try{assertRecordAccess(s,c.member,body.action,v)}catch{await securityLog(row.owner,id,'denied-scope',body.action);return reply({error:'This record or linked record is outside your access.'},403)}
 if(isNoteUnlock){
  const note=(s.notes||[]).find(n=>n.id===v.id);
  if(!note)return reply({error:'Note not found'},404);
  if(note.confidential&&!c.isOwner)return reply({error:'Confidential notes are owner-only'},403);
  if(!note.locked&&!note.passcodeHash)return reply({unlocked:true,id:note.id,text:note.text,edits:note.edits||[]});
  const hashed=await hashPasscode(note.id,v.passcode);
  if(hashed!==note.passcodeHash)return reply({error:'Incorrect passcode'},403);
  return reply({unlocked:true,id:note.id,text:note.text,edits:note.edits||[]});
 }
 const uid=()=>crypto.randomUUID();const today=day();const now=new Date().toISOString();let actor=req.headers.get('oai-authenticated-user-full-name')||req.headers.get('oai-authenticated-user-email')||'Authenticated owner';if(req.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8'){try{actor=decodeURIComponent(actor)}catch{}}const stamp={createdBy:actor,createdAt:now,updatedBy:actor,updatedAt:now};let description='';let affectedOwner='Unassigned';let activitySection=actionSection[body.action]||'Access design';let createdId:string|undefined;let createdValue:string|undefined;
 if(!s.people.length)s.people.push({id:'account-owner',name:actor,email:req.headers.get('oai-authenticated-user-email')||''});
 if(v.owner&&!s.people.some(p=>p.name===v.owner))throw Error('Select an owner from People first');
 const previousIds=new Set([...s.projects,...s.tasks,...s.waiting,...s.approvals,...s.opportunities,...s.contacts,...s.touchpoints,...s.companies,...s.brands,...s.suppliers,...(s.notes||[]),...(s.documents||[])].map(x=>x.id));

 const project=(pid:string)=>{const p=s.projects.find(p=>p.id===pid);if(!p)throw Error('Project not found');return p};
 const validateLinks=(links:ReturnType<typeof dedupeLinks>)=>{
  if(!links.length)throw Error('Link this record to at least one existing company, brand, project or contact');
  for(const l of links)if(!linkExists(s,l))throw Error('Linked record not found');
  return links;
 };
 switch(body.action){
 case 'contactTypeSave':{const list=s.contactTypes!;const old=list.find(t=>t.id===v.id);if(v.id&&!old)throw Error('Contact type not found');if(list.some(t=>t.id!==v.id&&t.name.toLowerCase()===v.name.toLowerCase()))throw Error('This contact type already exists');if(old)old.name=v.name;else{if(list.length>=100)throw Error('Contact type limit reached');const newId=uid();list.push({id:newId,name:v.name});createdId=newId;}description=`${old?'Renamed':'Added'} contact type: ${v.name}`;break;}
 case 'listItemSave':{
  if(v.list==='contactTypes'){
   const list=s.contactTypes!;
   const old=v.id?list.find(t=>t.id===v.id):v.oldValue?list.find(t=>t.name===v.oldValue):undefined;
   if((v.id||v.oldValue)&&!old)throw Error('Contact type not found');
   if(list.some(t=>t.id!==old?.id&&t.name.toLowerCase()===v.value.toLowerCase()))throw Error('This contact type already exists');
   if(old){old.name=v.value;createdId=old.id;}else{if(list.length>=100)throw Error('Contact type limit reached');const newId=uid();list.push({id:newId,name:v.value});createdId=newId;}
   createdValue=v.value;
   description=`${old?'Renamed':'Added'} contact type: ${v.value}`;
   break;
  }
  const listKey=v.list as 'workRoles'|'docTypes'|'touchpointChannels'|'projectStatuses';
  const list=s[listKey]!;
  const oldVal=v.oldValue?.trim()||'';
  const idx=oldVal?list.indexOf(oldVal):-1;
  if(oldVal&&idx<0)throw Error('List item not found');
  if(listKey==='projectStatuses'&&oldVal==='Complete'&&v.value!=='Complete')throw Error('Complete is a required closeout status and cannot be renamed');
  if(list.some((x:string,i:number)=>i!==idx&&x.toLowerCase()===v.value.toLowerCase()))throw Error('This item already exists in the list');
  if(idx>=0){
   list[idx]=v.value;
   if(oldVal!==v.value){
    if(listKey==='workRoles'){
     for(const p of s.people)if(p.hats?.length)p.hats=p.hats.map(h=>h===oldVal?v.value:h);
     for(const rec of [...s.projects,...s.tasks,...s.waiting,...s.opportunities,...s.contacts,...s.touchpoints,...(s.documents||[])])if(rec.hat===oldVal)rec.hat=v.value;
    }else if(listKey==='docTypes'){
     for(const d of s.documents||[])if(d.docType===oldVal)d.docType=v.value;
    }else if(listKey==='touchpointChannels'){
     for(const t of s.touchpoints)if(t.channel===oldVal)t.channel=v.value;
    }else if(listKey==='projectStatuses'){
     for(const p of s.projects)if(p.status===oldVal)p.status=v.value;
     for(const tpl of s.projectTemplates||[])if(tpl.initialStatus===oldVal)tpl.initialStatus=v.value;
    }
   }
  }else{
   if(list.length>=100)throw Error('List limit reached');
   list.push(v.value);
  }
  createdValue=v.value;
  const labels:Record<string,string>={workRoles:'work role',docTypes:'document type',touchpointChannels:'touchpoint channel',projectStatuses:'project status'};
  description=`${idx>=0?'Renamed':'Added'} ${labels[listKey]}: ${v.value}`;
  break;
 }
 case 'listItemRemove':{
  if(v.list==='contactTypes'){
   const list=s.contactTypes!;
   const target=v.id?list.find(t=>t.id===v.id):v.value?list.find(t=>t.name===v.value||t.id===v.value):undefined;
   if(!target)throw Error('Contact type not found');
   if(list.length<=1)throw Error('Keep at least one contact type');
   s.contactTypes=list.filter(t=>t.id!==target.id);
   for(const ct of s.contacts)if(ct.typeId===target.id)ct.typeId='';
   description=`Removed contact type: ${target.name}`;
   break;
  }
  const listKey=v.list as 'workRoles'|'docTypes'|'touchpointChannels'|'projectStatuses';
  const list=s[listKey]!;
  const val=v.value?.trim()||'';
  if(!val||!list.includes(val))throw Error('List item not found');
  if(list.length<=1)throw Error('Keep at least one item in this list');
  if(listKey==='projectStatuses'&&val==='Complete')throw Error('Complete is a required closeout status and cannot be removed');
  s[listKey]=list.filter((x:string)=>x!==val);
  const labels:Record<string,string>={workRoles:'work role',docTypes:'document type',touchpointChannels:'touchpoint channel',projectStatuses:'project status'};
  description=`Removed ${labels[listKey]}: ${val}`;
  break;
 }
 case 'contactTypeAssign':{const contact=s.contacts.find(t=>t.id===v.id);if(!contact)throw Error('Contact not found');if(v.typeId&&!s.contactTypes!.some(t=>t.id===v.typeId))throw Error('Choose an existing contact type');contact.typeId=v.typeId;description=`Updated contact type: ${contact.name}`;break;}
 case 'brandWarmth':{const b=s.brands.find(b=>b.id===v.id);if(!b)throw Error('Brand not found');b.warmth=v.warmth;description=`Brand warmth: ${b.name} — ${v.warmth}`;break;}
 case 'templateSave':{const list=s.projectTemplates!;const old=list.find(t=>t.id===v.id);if(v.id&&!old)throw Error('Template not found');if(list.some(t=>t.id!==v.id&&t.name.toLowerCase()===v.name.toLowerCase()))throw Error('A template with this name already exists');if(old)Object.assign(old,{name:v.name,steps:v.steps,initialStatus:v.initialStatus,updatedBy:actor,updatedAt:now});else{if(list.length>=200)throw Error('Template limit reached');list.push({id:uid(),name:v.name,steps:v.steps,initialStatus:v.initialStatus,archived:false,...stamp})}description=`${old?'Updated':'Created'} project template: ${v.name}`;break;}
 case 'templateArchive':{const t=s.projectTemplates!.find(t=>t.id===v.id);if(!t)throw Error('Template not found');t.archived=v.archived;t.updatedBy=actor;t.updatedAt=now;description=`${v.archived?'Archived':'Restored'} project template: ${t.name}`;break;}
 case 'templateOrder':{const list=s.projectTemplates!;if(v.ids.length!==list.length||new Set(v.ids).size!==list.length||v.ids.some((id:string)=>!list.some(t=>t.id===id)))throw Error('Order must include every template exactly once');s.projectTemplates=v.ids.map((id:string)=>list.find(t=>t.id===id)!);description='Reordered project templates';break;}
 case 'confidentialNote':project(v.projectId);s.confidentialNotes!.unshift({id:uid(),projectId:v.projectId,text:v.text,...stamp});description='Added owner-only confidential note';break;
 case 'confidentialNoteEdit':{const cn=s.confidentialNotes!.find(n=>n.id===v.id);if(!cn)throw Error('Confidential note not found');cn.text=v.text;cn.updatedBy=actor;cn.updatedAt=now;description='Updated owner-only confidential note';break;}
 case 'note':{
  const links=validateLinks(dedupeLinks(v.links));
  const confidential=Boolean(v.confidential);
  if(confidential&&!c.isOwner)throw new HttpError('Confidential notes are owner-only',403);
  const locked=Boolean(v.locked);
  if(locked&&(!v.passcode||v.passcode.length<4))throw Error('Passcode must be at least 4 characters');
  const noteId=uid();
  const passcodeHash=locked?await hashPasscode(noteId,v.passcode):undefined;
  s.notes!.unshift({id:noteId,title:v.title||undefined,text:v.text,pinned:Boolean(v.pinned),confidential,locked,passcodeHash,links,edits:[],...stamp});
  activitySection=confidential?'Access design':requiredSectionsForLinks(links)[0]||'Projects';
  description=confidential?'Added owner-only confidential workspace note':locked?'Added passcode-locked workspace note':`Added workspace note${v.title?`: ${v.title}`:''}`;
  break;
 }
 case 'noteEdit':{
  const note=s.notes!.find(n=>n.id===v.id);if(!note)throw Error('Note not found');
  if((note.confidential||v.confidential)&&!c.isOwner)throw new HttpError('Confidential notes are owner-only',403);
  if(note.locked&&note.passcodeHash){
   if(!v.currentPasscode||await hashPasscode(note.id,v.currentPasscode)!==note.passcodeHash)throw new HttpError('Unlock this note with its current passcode before editing',403);
  }
  const nextLinks=v.links?validateLinks(dedupeLinks(v.links)):note.links;
  const nextTitle=v.title!==undefined?(v.title||undefined):note.title;
  const textChanged=note.text!==v.text||(note.title||'')!==(nextTitle||'');
  if(textChanged){
   note.edits ||= [];
   note.edits.unshift({title:note.title,text:note.text,editedBy:note.updatedBy||note.createdBy||actor,editedAt:note.updatedAt||note.createdAt||now});
   if(note.edits.length>200)note.edits=note.edits.slice(0,200);
  }
  note.title=nextTitle;
  note.text=v.text;
  note.links=nextLinks;
  if(v.confidential!==undefined&&c.isOwner)note.confidential=v.confidential;
  if(v.locked===false){note.locked=false;delete note.passcodeHash;}
  else if(v.locked===true){
   if(v.passcode&&v.passcode.length>0){
    if(v.passcode.length<4)throw Error('Passcode must be at least 4 characters');
    note.locked=true;note.passcodeHash=await hashPasscode(note.id,v.passcode);
   }else if(!note.passcodeHash){
    throw Error('Enter a passcode (at least 4 characters) to lock this note');
   }else{note.locked=true;}
  }
  note.updatedBy=actor;note.updatedAt=now;
  activitySection=note.confidential?'Access design':requiredSectionsForLinks(note.links)[0]||'Projects';
  description=note.confidential?'Updated owner-only confidential workspace note':note.locked?'Updated passcode-locked workspace note':`Edited workspace note${note.title?`: ${note.title}`:''}`;
  break;
 }
 case 'notePin':{
  const note=s.notes!.find(n=>n.id===v.id);if(!note)throw Error('Note not found');
  if(note.confidential&&!c.isOwner)throw new HttpError('Confidential notes are owner-only',403);
  note.pinned=v.pinned;
  note.updatedBy=actor;note.updatedAt=now;
  activitySection=note.confidential?'Access design':requiredSectionsForLinks(note.links)[0]||'Projects';
  description=note.confidential?(v.pinned?'Pinned confidential workspace note':'Unpinned confidential workspace note'):`${v.pinned?'Pinned':'Unpinned'} workspace note${note.title?`: ${note.title}`:''}`;
  break;
 }
 case 'noteToTask':{
  const note=s.notes!.find(n=>n.id===v.noteId);if(!note)throw Error('Note not found');
  if(note.confidential&&!c.isOwner)throw new HttpError('Confidential notes are owner-only',403);
  const incomingLinks=v.links&&v.links.length?v.links:note.links;
  const synced=syncTaskLinks(v.projectId||'',incomingLinks);
  validateLinks(synced.links);
  if(synced.projectId)project(synced.projectId);
  if(v.supplierId&&!s.suppliers.some(x=>x.id===v.supplierId))throw Error('Supplier not found');
  if(v.dependsOn){
   if(!synced.projectId)throw Error('Task dependencies require a linked project');
   if(!s.tasks.some(t=>t.id===v.dependsOn&&t.projectId===synced.projectId))throw Error('Dependency must belong to this project');
  }
  const createdTask={id:uid(),projectId:synced.projectId,name:v.name,owner:v.owner,hat:v.hat||'General',supplierId:v.supplierId||'',due:v.due,originalDue:v.due,status:s.taskStatuses.find(x=>x.category==='todo')!.name,dependsOn:v.dependsOn||'',links:synced.links,sourceNoteId:note.id};
  s.tasks.push(createdTask);
  activitySection=note.confidential?'Access design':primarySectionForTask(createdTask);
  description=note.confidential?'Created task from confidential note':`Created task from note: ${v.name}`;
  break;
 }
 case 'member':{
  const person=s.people.find(p=>p.id===v.personId);
  if(!person||!person.email)throw Error('Add a valid email to this person first');
  if(person.email.toLowerCase()===c.user.email)throw Error('Another workspace owner must update your access');
  const grants=v.coOwner
   ? {...v,sections:[...sections],canEdit:true,financials:true,scopeMode:'all' as const,companyIds:[],brandIds:[],projectIds:[]}
   : v;
  for(const [key,list] of [['companyIds',s.companies],['brandIds',s.brands],['projectIds',s.projects]] as const){
   if(grants[key].some((id:string)=>!list.some(x=>x.id===id)))throw Error('Invalid access scope');
  }
  const membership={...grants,email:person.email.toLowerCase()};
  s.members=s.members!.filter(m=>m.personId!==person.id&&m.email!==membership.email);
  s.members.push(membership);
  description=membership.coOwner?`Granted workspace co-owner access to ${person.name}`:`Granted member access to ${person.name}`;
  break;
 }
 case 'memberRemove':if(s.members!.some(m=>m.personId===v.personId&&m.email===c.user.email))throw Error('Another workspace owner must update your access');s.members=s.members!.filter(m=>m.personId!==v.personId);description='Removed workspace membership';break;
 case 'reminderRead':{const list=reminders(allowedState(s,c.member,id)).filter(r=>r.owner===sessionInfo(c).person);if(!list.some(r=>r.id===v.id))throw Error('Reminder is not assigned to you');s.readReminders![id]=[...new Set([...(s.readReminders![id]||[]),v.id])].slice(-500);description='Read a reminder';break;}
 case 'reminderPrefsSave':{s.reminderPrefs ||= {};s.reminderPrefs[id]={inApp:v.inApp,email:v.email,dailyDigest:v.dailyDigest,digestTime:v.digestTime,timezone:v.timezone};description='Updated personal reminder preferences';break;}
 case 'reminderTestEmail':{const pref=s.reminderPrefs?.[id];if(!pref?.email&&!pref?.dailyDigest)throw Error('Enable email reminders or daily digest in your preferences first');const dueCount=reminders(allowedState(s,c.member,id)).filter(r=>r.owner===sessionInfo(c).person).length;s.deliveryFailures ||= [];s.deliveryFailures.unshift({id:uid(),at:now,userId:id,channel:'email',reason:'Email delivery is not connected: no approved sending account or mail provider is configured.',reminderCount:dueCount});if(s.deliveryFailures.length>100)s.deliveryFailures=s.deliveryFailures.slice(0,100);description='Recorded email delivery failure (sending account not connected)';break;}
 case 'reportViewSave':{s.savedReportViews ||= {};const list=s.savedReportViews[id]||[];const cleanFilters:Record<string,string>={};for(const [k,val] of Object.entries(v.filters||{})){if(typeof val==='string'&&val.trim())cleanFilters[k]=val.trim();}const existing=v.id?list.find(x=>x.id===v.id):undefined;if(existing){existing.name=v.name;existing.report=v.report;existing.filters=cleanFilters;}else{if(list.length>=50)throw Error('Saved report view limit reached');list.unshift({id:uid(),name:v.name,report:v.report,filters:cleanFilters,createdAt:now});}s.savedReportViews[id]=list;description=`Saved report view: ${v.name}`;break;}
 case 'reportViewDelete':{s.savedReportViews ||= {};s.savedReportViews[id]=(s.savedReportViews[id]||[]).filter(x=>x.id!==v.id);description='Deleted saved report view';break;}
 case 'priorityPin':{const visible=allowedState(s,c.member,id);if(!visible.tasks.some(t=>t.id===v.taskId)){if(!c.isOwner){await securityLog(row.owner,id,'denied-scope','priorityPin');throw new HttpError('This task is outside your access.',403);}throw Error('Task not found');}s.pinnedPriorities ||= {};const current=s.pinnedPriorities[id]||[];s.pinnedPriorities[id]=v.pinned?[...new Set([v.taskId,...current])].slice(0,50):current.filter(x=>x!==v.taskId);description=v.pinned?'Pinned daily priority':'Unpinned daily priority';break;}
 case 'warmth':{const contact=s.contacts.find(x=>x.id===v.id);if(!contact)throw Error('Contact not found');contact.warmth=v.warmth;description=`Relationship warmth: ${contact.name} — ${v.warmth}`;break;}
 case 'dealLost':{const o=s.opportunities.find(x=>x.id===v.id);if(!o||o.stage==='Lost')throw Error('Select an active opportunity');const prevStage=o.stage;o.lostFrom=prevStage;o.lostAt=now;o.lostReason=v.reason;if(v.retargetDate)o.retargetDate=v.retargetDate;else delete o.retargetDate;o.stage='Lost';o.stageHistory ||= [];o.stageHistory.push({from:prevStage,to:'Lost',at:now,by:actor});description=`Marked lost: ${o.name}; from ${o.lostFrom}; ${v.reason}${v.retargetDate?`; retarget ${v.retargetDate}`:''}`;break;}
 case 'dealEdit':{const o=s.opportunities.find(x=>x.id===v.id);if(!o)throw Error('Opportunity not found');if(v.name)o.name=v.name;if(v.brandId!==undefined){if(v.brandId&&!s.brands.some(b=>b.id===v.brandId&&b.companyId===o.companyId))throw Error('Brand must belong to company');o.brandId=v.brandId;}if(v.supplierId!==undefined){if(v.supplierId&&!s.suppliers.some(x=>x.id===v.supplierId))throw Error('Supplier not found');if(v.supplierId)o.supplierId=v.supplierId;else delete o.supplierId;}if(v.referredBy!==undefined){if(v.referredBy)o.referredBy=v.referredBy;else delete o.referredBy;}if(v.siteCount!==undefined){if(v.siteCount>0)o.siteCount=v.siteCount;else delete o.siteCount;}o.owner=v.owner;if(v.hat)o.hat=v.hat;if(c.isOwner||c.member?.financials){if(v.mrc!==undefined){if(v.mrc>0)o.mrc=v.mrc;else delete o.mrc;}if(v.otc!==undefined){if(v.otc>0)o.otc=v.otc;else delete o.otc;}if(v.value!==undefined)o.value=v.value>0?v.value:effectiveDealValue({value:0,mrc:o.mrc,otc:o.otc,siteCount:o.siteCount});}o.nextAction=v.nextAction;if(v.nextActionDate)o.nextActionDate=v.nextActionDate;else delete o.nextActionDate;if(v.retargetDate!==undefined){if(v.retargetDate)o.retargetDate=v.retargetDate;else delete o.retargetDate;}description=`Updated opportunity: ${o.name}`;break;}
 case 'dealReopen':{const o=s.opportunities.find(x=>x.id===v.id);if(!o||o.stage!=='Lost')throw Error('Select a lost opportunity to reopen');o.stage=v.stage;o.stageHistory ||= [];o.stageHistory.push({from:'Lost',to:v.stage,at:now,by:actor});if(v.nextAction!==undefined)o.nextAction=v.nextAction;if(v.nextActionDate!==undefined){if(v.nextActionDate)o.nextActionDate=v.nextActionDate;else delete o.nextActionDate;}description=`Reopened ${o.name} at ${v.stage}`;break;}
 case 'dealHandoff':{const o=s.opportunities.find(x=>x.id===v.opportunityId);if(!o)throw Error('Opportunity not found');if(o.stage!=='Contract Signed')throw Error('Only Contract Signed deals can be handed off to projects');const seenBrands=new Set<string>();for(const item of v.projects){if(!s.people.some(p=>p.name===item.owner))throw Error('Select an owner from People first');if(item.brandId&&!s.brands.some(b=>b.id===item.brandId&&b.companyId===o.companyId))throw Error('Brand must belong to selected company');const itemSupplier=item.supplierId!==undefined?item.supplierId:(o.supplierId||'');if(itemSupplier&&!s.suppliers.some(x=>x.id===itemSupplier))throw Error('Supplier not found');const key=item.brandId||'__company__';if(seenBrands.has(key))throw Error('Duplicate brand in handoff request. Use one project per brand scope.');seenBrands.add(key);if(s.projects.some(p=>p.opportunityId===o.id&&(p.brandId||'')===(item.brandId||'')))throw Error('A project already exists for this deal and brand scope. Edit the existing project or choose another brand.');const tpl=s.projectTemplates!.find(t=>t.id===item.type||t.name===item.type);if(!tpl||tpl.archived)throw Error('Choose an active project template');}for(const item of v.projects){const tpl=s.projectTemplates!.find(t=>t.id===item.type||t.name===item.type)!;const pid=uid();const itemSites=item.siteCount!==undefined?item.siteCount:(o.siteCount||0);const itemSupplier=item.supplierId!==undefined?item.supplierId:(o.supplierId||'');s.projects.push({id:pid,companyId:o.companyId,brandId:item.brandId,name:item.name,engagement:item.engagement,type:tpl.name,owner:item.owner,hat:item.hat||'Project lead',start:item.start,due:item.due,status:tpl.initialStatus,budget:item.budget,cost:item.cost,...(itemSites>0?{siteCount:itemSites}:{}),...(itemSupplier?{supplierId:itemSupplier}:{}),opportunityId:o.id});let prev='';for(const stepName of tpl.steps){const tid=uid();s.tasks.push({id:tid,projectId:pid,name:stepName,owner:item.owner,hat:item.hat||'Project lead',supplierId:itemSupplier,due:item.due,originalDue:item.due,status:s.taskStatuses.find(x=>x.category==='todo')!.name,dependsOn:prev});prev=tid;}if(item.notes&&item.notes.trim()){const noteLinks:ReturnType<typeof dedupeLinks>=dedupeLinks([{type:'project',id:pid},{type:'company',id:o.companyId},...(item.brandId?[{type:'brand' as const,id:item.brandId}]:[])]);s.notes!.unshift({id:uid(),title:`Deal handoff notes — ${o.name}`,text:item.notes.trim(),pinned:true,confidential:false,locked:false,links:noteLinks,edits:[],...stamp});}}activitySection='Projects';description=`Handed off signed deal ${o.name} into ${v.projects.length} project${v.projects.length===1?'':'s'}`;break;}
 case 'person':if(s.people.some(p=>p.name.toLowerCase()===v.name.toLowerCase()))throw Error('A person with this name already exists');s.people.push({id:uid(),...v,hats:(v.hats||'').split(',').map((x:string)=>x.trim()).filter(Boolean)});description=`Added assignee: ${v.name}`;break;
 case 'personEdit':{
  const person=s.people.find(p=>p.id===v.id);if(!person)throw Error('Person not found');
  if(s.people.some(p=>p.id!==person.id&&p.name.toLowerCase()===v.name.toLowerCase()))throw Error('A person with this name already exists');
  const nextEmail=v.email.toLowerCase();
  const membership=s.members?.find(m=>m.personId===person.id);
  if(membership&&nextEmail!==membership.email){
   if(!nextEmail)throw Error('Remove app access before clearing this member’s email');
   if(membership.email===c.user.email)throw Error('Another workspace owner must update your sign-in email');
   if(s.members?.some(m=>m.personId!==person.id&&m.email===nextEmail))throw Error('Another member already uses this email');
   membership.email=nextEmail;
  }
  const prevName=person.name;
  person.name=v.name;person.email=v.email;person.hats=(v.hats||'').split(',').map((x:string)=>x.trim()).filter(Boolean);
  if(prevName!==v.name){
   for(const rec of [...s.projects,...s.tasks,...s.waiting,...s.opportunities,...s.contacts,...s.touchpoints,...(s.documents||[])]){if(rec.owner===prevName)rec.owner=v.name;}
   for(const m of s.meetings||[]){if(m.owner===prevName)m.owner=v.name;if(m.attendees?.length)m.attendees=m.attendees.map(a=>a===prevName?v.name:a);}
  }
  description=`Updated person: ${person.name}`;
  break;
 }
 case 'projectEdit':{const p=project(v.id);if(v.brandId!==undefined){if(v.brandId&&!s.brands.some(b=>b.id===v.brandId&&b.companyId===p.companyId))throw Error('Brand must belong to selected company');p.brandId=v.brandId;}if(v.name)p.name=v.name;if(v.engagement)p.engagement=v.engagement;if(v.budget!==undefined&&(c.isOwner||c.member?.financials))p.budget=v.budget;if(v.cost!==undefined&&(c.isOwner||c.member?.financials))p.cost=v.cost;description=`Updated ${p.name}: ${p.start} – ${p.due} to ${v.start} – ${v.due}; owner ${p.owner} to ${v.owner}`;Object.assign(p,{owner:v.owner,hat:v.hat||p.hat,start:v.start,due:v.due});break;}
 case 'statusSave':{const old=s.taskStatuses.find(x=>x.name===v.oldName);if(v.oldName&&!old)throw Error('Status not found');if(s.taskStatuses.some(x=>x.name.toLowerCase()===v.name.toLowerCase()&&x!==old))throw Error('Status already exists');if(old&&old.category!==v.category&&['todo','done'].includes(old.category)&&s.taskStatuses.filter(x=>x.category===old.category).length===1)throw Error('Keep at least one Not started and one Completed status');if(v.category==='done'&&old?.category!=='done'){for(const t of s.tasks.filter(t=>t.status===v.oldName)){if(s.waiting.some(w=>w.taskId===t.id&&!w.resolved)||(t.dependsOn&&category(s,s.tasks.find(x=>x.id===t.dependsOn)?.status||'')!=='done'))throw Error('Resolve task blockers before making this a Completed status')}}if(old){s.tasks.filter(t=>t.status===old.name).forEach(t=>t.status=v.name);old.name=v.name;old.category=v.category}else{s.taskStatuses.push({name:v.name,category:v.category})}description=`${v.oldName?'Updated':'Added'} task status: ${v.name} (${v.category})`;break;}
 case 'contact':{if(v.typeId&&!s.contactTypes!.some(t=>t.id===v.typeId))throw Error('Choose an existing contact type');if(!s.companies.some(c=>c.id===v.companyId))throw Error('Company not found');if(v.brandId&&!s.brands.some(b=>b.id===v.brandId&&b.companyId===v.companyId))throw Error('Brand must belong to client account');const newId=uid();s.contacts.push({id:newId,...v});createdId=newId;description=`Added CRM contact: ${v.name}`;break;}
 case 'contactEdit':{const contact=s.contacts.find(x=>x.id===v.id);if(!contact)throw Error('Contact not found');if(v.typeId&&!s.contactTypes!.some(t=>t.id===v.typeId))throw Error('Choose an existing contact type');if(!s.companies.some(c=>c.id===v.companyId))throw Error('Company not found');if(v.brandId&&!s.brands.some(b=>b.id===v.brandId&&b.companyId===v.companyId))throw Error('Brand must belong to client account');Object.assign(contact,{companyId:v.companyId,brandId:v.brandId,name:v.name,title:v.title,email:v.email,phone:v.phone,typeId:v.typeId,owner:v.owner,hat:v.hat||contact.hat});description=`Updated CRM contact: ${contact.name}`;break;}
 case 'touchpoint':{if(!s.touchpointChannels!.includes(v.channel))throw Error('Choose an existing touchpoint channel');if(!s.companies.some(c=>c.id===v.companyId))throw Error('Company not found');for(const [key,records] of [['contactId',s.contacts],['opportunityId',s.opportunities],['projectId',s.projects]] as const){if(v[key]&&!records.some(x=>x.id===v[key]&&x.companyId===v.companyId))throw Error('Linked records must belong to the selected company')}let followupTaskId:string|undefined;if(v.createFollowupTask){const rawLinks=[...(v.projectId?[{type:'project' as const,id:v.projectId}]:[]),...(v.contactId?[{type:'contact' as const,id:v.contactId}]:[]),{type:'company' as const,id:v.companyId}];const synced=syncTaskLinks(v.projectId||'',rawLinks);followupTaskId=uid();s.tasks.push({id:followupTaskId,projectId:synced.projectId,name:v.nextAction,owner:v.owner,hat:v.hat||'Sales',supplierId:'',due:v.followup,originalDue:v.followup,status:s.taskStatuses.find(x=>x.category==='todo')!.name,dependsOn:'',links:synced.links});}const {createFollowupTask:_,...tpFields}=v;s.touchpoints.push({id:uid(),...tpFields,done:false,...(followupTaskId?{followupTaskId}:{})});description=`Logged ${v.channel} touchpoint: ${v.summary}; next: ${v.nextAction}`;break;}
 case 'touchpointEdit':{const t=s.touchpoints.find(x=>x.id===v.id);if(!t)throw Error('Touchpoint not found');if(v.channel!==t.channel&&!s.touchpointChannels!.includes(v.channel))throw Error('Choose an existing touchpoint channel');if(!s.companies.some(c=>c.id===v.companyId))throw Error('Company not found');for(const [key,records] of [['contactId',s.contacts],['opportunityId',s.opportunities],['projectId',s.projects]] as const){if(v[key]&&!records.some(x=>x.id===v[key]&&x.companyId===v.companyId))throw Error('Linked records must belong to the selected company')}if(t.followupTaskId&&t.followup!==v.followup){const ft=s.tasks.find(x=>x.id===t.followupTaskId);if(ft&&ft.due!==v.followup){ft.originalDue ||= ft.due;ft.reschedules ||= [];ft.reschedules.push({from:ft.due,to:v.followup,at:now,by:actor});ft.due=v.followup;}}Object.assign(t,{companyId:v.companyId,contactId:v.contactId,opportunityId:v.opportunityId,projectId:v.projectId,channel:v.channel,summary:v.summary,owner:v.owner,hat:v.hat||t.hat,nextAction:v.nextAction,followup:v.followup});description=`Updated ${t.channel} touchpoint: ${t.summary}`;break;}
 case 'touchDone':{const t=s.touchpoints.find(t=>t.id===v.id);if(!t)throw Error('Touchpoint not found');t.done=true;description=`Completed CRM follow-up: ${t.nextAction}`;break;}
 case 'touchReschedule':{const t=s.touchpoints.find(t=>t.id===v.id);if(!t)throw Error('Touchpoint not found');description=`Rescheduled CRM follow-up from ${t.followup} to ${v.followup}: ${t.nextAction}`;t.followup=v.followup;if(t.followupTaskId){const ft=s.tasks.find(x=>x.id===t.followupTaskId);if(ft&&ft.due!==v.followup){ft.originalDue ||= ft.due;ft.reschedules ||= [];ft.reschedules.push({from:ft.due,to:v.followup,at:now,by:actor});ft.due=v.followup;}}break;}
 case 'sample':{
  if(s.projects.length||s.companies.length||s.suppliers.length)throw Error('Sample data can only be loaded into an empty workspace');
  const {members,people}=s;
  s=sample();
  s.members=members;
  s.people=[...people,...s.people.filter(example=>!people.some(existing=>existing.id===example.id||existing.name===example.name||existing.email.toLowerCase()===example.email.toLowerCase()))];
  description='Loaded illustrative sample projects';
  break;
 }
 case 'sharedWork':{
  if(!c.isOwner)throw new HttpError('Only workspace owners can update shared work records.',403);
  applySharedWork(s,v,actor,now);
  activitySection=v.collection==='studioPins'?'Studio Board':v.collection==='meetings'?'Calendar':'Reports';
  description=`Updated shared ${activitySection} records`;
  break;
 }
 case 'clear':{const members=s.members;const memberIds=new Set((members||[]).map(m=>m.personId));const people=s.people.filter(p=>memberIds.has(p.id));s=blank();s.members=members;s.people=people;}description='Workspace cleared by owner';break;
 case 'opportunity':{if(!s.companies.some(c=>c.id===v.companyId))throw Error('Company not found');if(v.brandId&&!s.brands.some(b=>b.id===v.brandId&&b.companyId===v.companyId))throw Error('Brand must belong to company');if(v.supplierId&&!s.suppliers.some(x=>x.id===v.supplierId))throw Error('Supplier not found');const {nextActionDate,mrc,otc,siteCount,supplierId,referredBy,...oppFields}=v;const computedVal=v.value>0?v.value:effectiveDealValue({value:0,mrc,otc,siteCount});s.opportunities.push({id:uid(),...oppFields,value:computedVal,...(mrc>0?{mrc}:{}),...(otc>0?{otc}:{}),...(siteCount>0?{siteCount}:{}),...(supplierId?{supplierId}:{}),...(referredBy?{referredBy}:{}),...(nextActionDate?{nextActionDate}:{}),stage:'New leads',stageHistory:[{from:'',to:'New leads',at:now,by:actor}]});description=`Added opportunity: ${v.name}`;break;}
 case 'dealStage':{const o=s.opportunities.find(x=>x.id===v.id);if(!o)throw Error('Opportunity not found');const prevStage=o.stage;const wasLost=prevStage==='Lost';o.stage=v.stage;if(prevStage!==v.stage){o.stageHistory ||= [];o.stageHistory.push({from:prevStage,to:v.stage,at:now,by:actor});}description=`${wasLost?'Reopened':'Moved'} ${o.name}: ${v.stage}`;break;}
 case 'company':{const newId=uid();s.companies.push({id:newId,...v});createdId=newId;description=`Added company: ${v.name}`;break;}
 case 'companyEdit':{const co=s.companies.find(x=>x.id===v.id);if(!co)throw Error('Company not found');co.name=v.name;co.contact=v.contact;description=`Updated company: ${co.name}`;break;}
 case 'brand':{if(!s.companies.some(c=>c.id===v.companyId))throw Error('Company not found');const newId=uid();s.brands.push({id:newId,...v});createdId=newId;description=`Added brand: ${v.name}`;break;}
 case 'brandEdit':{const b=s.brands.find(x=>x.id===v.id);if(!b)throw Error('Brand not found');b.name=v.name;description=`Updated brand: ${b.name}`;break;}
 case 'supplier':s.suppliers.push({id:uid(),...v});description=`Added supplier: ${v.name}`;break;
 case 'supplierEdit':{const sup=s.suppliers.find(x=>x.id===v.id);if(!sup)throw Error('Supplier not found');sup.name=v.name;sup.service=v.service;sup.contact=v.contact;description=`Updated supplier: ${sup.name}`;break;}
 case 'project':{if(!s.companies.some(c=>c.id===v.companyId))throw Error('Company not found');if(v.brandId&&!s.brands.some(b=>b.id===v.brandId&&b.companyId===v.companyId))throw Error('Brand must belong to selected company');if(v.opportunityId){const linkedOpp=s.opportunities.find(o=>o.id===v.opportunityId&&o.companyId===v.companyId);if(!linkedOpp)throw Error('Linked opportunity must belong to selected company');if(s.projects.some(p=>p.opportunityId===v.opportunityId&&(p.brandId||'')===(v.brandId||'')))throw Error('A project already exists for this deal and brand scope. Edit the existing project or choose another brand.');}const template=s.projectTemplates!.find(t=>t.id===v.type||t.name===v.type);if(!template||template.archived)throw Error('Choose an active project template');const pid=uid();const {opportunityId,...projFields}=v;s.projects.push({id:pid,...projFields,type:template.name,status:template.initialStatus,...(opportunityId?{opportunityId}:{})});let prev='';for(const name of template.steps){const tid=uid();s.tasks.push({id:tid,projectId:pid,name,owner:v.owner,hat:v.hat||'Project lead',supplierId:'',due:v.due,originalDue:v.due,status:s.taskStatuses.find(x=>x.category==='todo')!.name,dependsOn:prev});prev=tid;}description=`Created project: ${v.name}`;break;}
 case 'task':{
  const synced=syncTaskLinks(v.projectId||'',v.links);
  validateLinks(synced.links);
  if(synced.projectId)project(synced.projectId);
  if(v.supplierId&&!s.suppliers.some(x=>x.id===v.supplierId))throw Error('Supplier not found');
  if(v.dependsOn){
   if(!synced.projectId)throw Error('Task dependencies require a linked project');
   if(!s.tasks.some(t=>t.id===v.dependsOn&&t.projectId===synced.projectId))throw Error('Dependency must belong to this project');
  }
  if(v.sourceNoteId){
   const src=(s.notes||[]).find(n=>n.id===v.sourceNoteId);
   if(!src)throw Error('Source note not found');
   if(src.confidential&&!c.isOwner)throw new HttpError('Confidential notes are owner-only',403);
  }
  const createdTask={id:uid(),projectId:synced.projectId,name:v.name,owner:v.owner,hat:v.hat||'General',supplierId:v.supplierId||'',due:v.due,originalDue:v.due,status:s.taskStatuses.find(x=>x.category==='todo')!.name,dependsOn:v.dependsOn||'',...(v.links&&v.links.length||!synced.projectId?{links:synced.links}:{}),...(v.sourceNoteId?{sourceNoteId:v.sourceNoteId}:{})};
  s.tasks.push(createdTask);
  activitySection=primarySectionForTask(createdTask);
  description=`Added task: ${v.name}`;
  break;
 }
 case 'waiting':project(v.projectId);if(v.taskId&&!s.tasks.some(t=>t.id===v.taskId&&t.projectId===v.projectId))throw Error('Task must belong to this project');s.waiting.push({id:uid(),...v,requested:today,resolved:false,resolution:''});description=`Waiting on ${v.person}: ${v.name}`;break;
 case 'waitingEdit':{const w=s.waiting.find(x=>x.id===v.id);if(!w)throw Error('Waiting item not found');if(v.taskId&&!s.tasks.some(t=>t.id===v.taskId&&t.projectId===w.projectId))throw Error('Task must belong to this project');Object.assign(w,{taskId:v.taskId,name:v.name,party:v.party,person:v.person,owner:v.owner,hat:v.hat||w.hat,due:v.due,followup:v.followup,impact:v.impact,...(v.resolution!==undefined?{resolution:v.resolution}:{})});description=`Updated waiting item: ${w.name}`;break;}
 case 'doc':{
  const links=dedupeDocLinks(v.links);
  if(!links.length)throw Error('Link this document to at least one existing company, brand, deal or project');
  for(const l of links)if(!docLinkExists(s,l))throw Error('Linked record not found');
  const docRec={id:uid(),title:v.title,url:v.url,docType:v.docType,owner:v.owner,hat:v.hat||'General',status:v.status,description:v.description,tags:v.tags,audience:v.audience,pinned:Boolean(v.pinned),version:1,links,...(v.status==='Approved'?{approvedVersion:1,approvedUrl:v.url,approvedAt:now,approvedBy:actor}:{}),...stamp};
  s.documents!.unshift(docRec);
  activitySection='Documents';
  description=`Added document link: ${v.title} (${v.docType})`;
  break;
 }
 case 'docEdit':{
  const d=(s.documents||[]).find(x=>x.id===v.id);if(!d)throw Error('Document not found');
  const nextLinks=v.links?dedupeDocLinks(v.links):d.links;
  if(!nextLinks.length)throw Error('Link this document to at least one existing company, brand, deal or project');
  for(const l of nextLinks)if(!docLinkExists(s,l))throw Error('Linked record not found');
  const urlChanged=d.url!==v.url;
  if(urlChanged){
   d.version=(d.version||1)+1;
   if(d.status==='Approved')d.status='For Review';
  }
  d.title=v.title;d.url=v.url;d.docType=v.docType;d.owner=v.owner;if(v.hat)d.hat=v.hat;d.description=v.description;d.tags=v.tags;d.audience=v.audience;d.links=nextLinks;
  d.updatedBy=actor;d.updatedAt=now;
  activitySection='Documents';
  description=urlChanged?`Updated document URL to v${d.version}: ${d.title} (review required)`:`Updated document metadata: ${d.title}`;
  break;
 }
 case 'docPin':{
  const d=(s.documents||[]).find(x=>x.id===v.id);if(!d)throw Error('Document not found');
  d.pinned=v.pinned;d.updatedBy=actor;d.updatedAt=now;
  activitySection='Documents';
  description=`${v.pinned?'Pinned':'Unpinned'} document: ${d.title}`;
  break;
 }
 case 'docStatus':{
  const d=(s.documents||[]).find(x=>x.id===v.id);if(!d)throw Error('Document not found');
  d.status=v.status;
  if(v.status==='Approved'){d.approvedVersion=d.version;d.approvedUrl=d.url;d.approvedAt=now;d.approvedBy=actor;}
  d.updatedBy=actor;d.updatedAt=now;
  activitySection='Documents';
  description=`Document ${d.title} v${d.version}: ${v.status}`;
  break;
 }
 case 'approval':{project(v.projectId);let docMeta:{documentId?:string;documentVersion?:number;documentUrl?:string}={};if(v.documentId){const d=(s.documents||[]).find(x=>x.id===v.documentId);if(!d)throw Error('Linked document not found');docMeta={documentId:d.id,documentVersion:d.version,documentUrl:d.url};}const {documentId:_,...appFields}=v;s.approvals.push({id:uid(),...appFields,...docMeta,version:1,status:'Pending',decidedAt:''});description=`Requested approval: ${v.name}`;break;}
 case 'approvalEdit':{
  const a=s.approvals.find(x=>x.id===v.id);if(!a)throw Error('Approval not found');
  a.name=v.name;a.reviewer=v.reviewer;a.due=v.due;a.note=v.note;
  if(v.documentId!==undefined){
   if(v.documentId){
    const d=(s.documents||[]).find(x=>x.id===v.documentId);if(!d)throw Error('Linked document not found');
    a.documentId=d.id;a.documentVersion=d.version;a.documentUrl=d.url;
   }else{
    delete a.documentId;delete a.documentVersion;delete a.documentUrl;
   }
  }
  description=`Updated approval: ${a.name}`;
  break;
 }
 case 'taskEdit':{
  const t=s.tasks.find(t=>t.id===v.id);if(!t)throw Error('Task not found');
  if(v.supplierId&&!s.suppliers.some(x=>x.id===v.supplierId))throw Error('Supplier not found');
  if(v.links!==undefined){
   const nextLinks=validateLinks(dedupeLinks(v.links));
   const hasOriginalProject=t.projectId&&nextLinks.some(l=>l.type==='project'&&l.id===t.projectId);
   if(t.projectId&&!hasOriginalProject&&(t.dependsOn||s.tasks.some(x=>x.dependsOn===t.id)||s.waiting.some(w=>w.taskId===t.id))){
    throw Error('Cannot remove the project link while this task has project dependencies or waiting items');
   }
   const nextProjectId=hasOriginalProject?t.projectId:(nextLinks.find(l=>l.type==='project')?.id||'');
   t.projectId=nextProjectId;
   t.links=nextLinks;
  }
  if(v.dependsOn!==undefined){
   if(v.dependsOn){
    if(!t.projectId)throw Error('Task dependencies require a linked project');
    if(v.dependsOn===t.id)throw Error('A task cannot depend on itself');
    if(!s.tasks.some(x=>x.id===v.dependsOn&&x.projectId===t.projectId))throw Error('Dependency must belong to this project');
   }
   t.dependsOn=v.dependsOn;
  }
  if(v.name)t.name=v.name;
  description=`Updated ${t.name}: owner ${t.owner} to ${v.owner}; due ${t.due} to ${v.due}`;
  if(t.due!==v.due){t.originalDue ||= t.due;t.reschedules ||= [];t.reschedules.push({from:t.due,to:v.due,at:now,by:actor});if(t.reschedules.length>100)t.reschedules=t.reschedules.slice(-100);}
  t.hat=v.hat||t.hat;t.owner=v.owner;t.supplierId=v.supplierId;t.due=v.due;
  activitySection=primarySectionForTask(t);
  break;
 }
 case 'taskStatus':{if(!s.taskStatuses.some(x=>x.name===v.status))throw Error('Unknown task status');const t=s.tasks.find(t=>t.id===v.id);if(!t)throw Error('Task not found');if(category(s,v.status)==='done'&&s.waiting.some(w=>w.taskId===t.id&&!w.resolved))throw Error('Resolve the linked waiting items first');if(category(s,v.status)!=='todo'&&t.dependsOn&&category(s,s.tasks.find(x=>x.id===t.dependsOn)?.status||'')!=='done')throw Error('Complete the preceding task first');const prevCat=category(s,t.status);const nextCat=category(s,v.status);t.status=v.status;if(prevCat!=='done'&&nextCat==='done')t.completedAt=now;else if(prevCat==='done'&&nextCat!=='done')t.reopenedAt=now;activitySection=primarySectionForTask(t);description=`${t.name}: ${v.status}`;break;}
 case 'projectStatus':{const p=project(v.id);if(v.status!==p.status&&!s.projectStatuses!.includes(v.status))throw Error('Unknown project status');if(v.status==='Complete'&&(s.tasks.some(t=>t.projectId===p.id&&category(s,t.status)!=='done')||s.waiting.some(w=>w.projectId===p.id&&!w.resolved)||s.approvals.some(a=>a.projectId===p.id&&a.status!=='Approved')))throw Error('Complete tasks, resolve waiting items and approve deliverables before closeout');const prevStatus=p.status;p.status=v.status;if(v.status==='Complete')p.completedAt=now;else if(prevStatus==='Complete')delete p.completedAt;description=`${p.name}: ${v.status}`;break;}
 case 'resolve':{const w=s.waiting.find(w=>w.id===v.id);if(!w)throw Error('Waiting item not found');w.resolved=true;w.resolution=v.resolution;w.resolvedAt=now;description=`Resolved ${w.name}: ${v.resolution}`;break;}
 case 'followup':{const w=s.waiting.find(w=>w.id===v.id);if(!w)throw Error('Waiting item not found');w.followup=v.followup;description=`Scheduled follow-up: ${w.name}`;break;}
 case 'decision':{const a=s.approvals.find(a=>a.id===v.id);if(!a||a.status!=='Pending')throw Error('Only pending approvals can receive a decision');a.status=v.status;a.note=v.note;a.decidedAt=new Date().toISOString();if(a.documentId&&v.status==='Approved'){const d=(s.documents||[]).find(x=>x.id===a.documentId);if(d&&d.version===a.documentVersion&&d.url===a.documentUrl){d.status='Approved';d.approvedVersion=d.version;d.approvedUrl=d.url;d.approvedAt=a.decidedAt;d.approvedBy=a.reviewer;}}description=`Recorded ${a.reviewer}'s decision: ${a.name} v${a.version} — ${v.status}. ${v.note}`;break;}
 case 'revision':{const a=s.approvals.find(a=>a.id===v.id);if(!a)throw Error('Approval not found');description=`Superseded ${a.name} v${a.version} (${a.status}); previous note: ${a.note}`;a.version++;a.status='Pending';a.decidedAt='';a.note=v.note;if(a.documentId){const d=(s.documents||[]).find(x=>x.id===a.documentId);if(d){a.documentVersion=d.version;a.documentUrl=d.url;}}break;}
 }
 if(c.isOwner)ensureOwner(s,c.user);
 const records=[...s.projects,...s.tasks,...s.waiting,...s.approvals,...s.opportunities,...s.contacts,...s.touchpoints,...s.companies,...s.brands,...s.suppliers,...(s.notes||[]),...(s.documents||[])];
 for(const record of records){if(!previousIds.has(record.id)&&body.action!=='sample')Object.assign(record,stamp);if(record.id===v.id){Object.assign(record,{updatedBy:actor,updatedAt:now});if('owner'in record)affectedOwner=record.owner;else if('projectId'in record&&record.projectId)affectedOwner=s.projects.find(p=>p.id===record.projectId)?.owner||'Unassigned'}}
 if(v.owner)affectedOwner=v.owner;
 if(!personalNotifAction&&!personalReportAction&&body.action!=='priorityPin')s.activity.unshift({id:uid(),at:now,text:description,actor,actorId:id,owner:affectedOwner,section:activitySection,hat:v.hat||records.find(r=>r.id===v.id)?.hat});if(JSON.stringify(s).length>2000000)throw Error('Workspace size limit reached');await commitWorkspace(row,s,id,body.action);return reply({state:allowedState(normalize(s),c.member,id),revision:row.revision+1,session:sessionInfo({...c,state:s}),...(createdId?{createdId}:{}),...(createdValue?{createdValue}:{})});
 }catch(e){return reply({error:e instanceof z.ZodError?e.issues[0]?.message:e instanceof Error?e.message:'Invalid request'},e instanceof HttpError?e.status:400)} }
