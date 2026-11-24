import {z} from 'zod';
import {studioPinSchema,meetingSchema,retrospectiveSchema,validateSharedReferences} from './shared-work';
import {docStatuses,normalize,type State} from './model';
import {docLinkExists,docLinkTypes,isValidExternalUrl,linkExists,recordLinkTypes,taskLinks} from './workspace-links';

const text=z.string().max(10000),id=z.string().min(1).max(1000),num=z.number().finite().min(0).max(1e12);
const attrs={createdBy:text.optional(),createdAt:text.optional(),updatedBy:text.optional(),updatedAt:text.optional(),hat:text.optional()};
const object=(fields:Record<string,z.ZodTypeAny>)=>z.object({id,...attrs,...fields});
const list=(v:z.ZodTypeAny)=>z.array(v).max(20000);
const linkSchema=z.object({type:z.enum(recordLinkTypes),id});
const docLinkSchema=z.object({type:z.enum(docLinkTypes),id});
const noteEditSchema=z.object({title:text.optional(),text,editedBy:text,editedAt:text});
const stageChangeSchema=z.object({from:text,to:text,at:text,by:text});
const taskRescheduleSchema=z.object({from:text,to:text,at:text,by:text});

const recordSchema=z.object({
 sampleWorkspace:z.literal(true).optional(),
 studioPins:z.array(studioPinSchema).max(100).optional(),
 meetings:z.array(meetingSchema).max(500).optional(),
 retrospectives:z.array(retrospectiveSchema).max(500).optional(),
 contactTypes:z.array(z.object({id,name:z.string().trim().min(1).max(60)})).max(100).optional(),
 projectTemplates:list(object({name:z.string().trim().min(1).max(100),steps:z.array(z.string().trim().min(1).max(200)).min(1).max(100),initialStatus:z.enum(['Planning','Bidding']),archived:z.boolean()})).optional(),
 people:list(z.object({id,name:text,email:text,hats:z.array(text).optional()})),taskStatuses:list(z.object({name:text,category:z.enum(['todo','active','done'])})),
 companies:list(object({name:text,contact:text})),brands:list(object({companyId:id,name:text,warmth:text.optional()})),suppliers:list(object({name:text,service:text,contact:text})),
 projects:list(object({companyId:id,brandId:text,name:text,engagement:text,type:text,owner:text,start:text,due:text,status:text,budget:num.optional(),cost:num.optional(),opportunityId:text.optional(),completedAt:text.optional()})),
 tasks:list(object({projectId:text,name:text,owner:text,supplierId:text,due:text,originalDue:text.optional(),reschedules:z.array(taskRescheduleSchema).max(200).optional(),completedAt:text.optional(),reopenedAt:text.optional(),status:text,dependsOn:text,links:z.array(linkSchema).max(50).optional(),sourceNoteId:text.optional()})),
 opportunities:list(object({companyId:id,brandId:text,name:text,owner:text,value:num,stage:text,nextAction:text,nextActionDate:text.optional(),lostFrom:text.optional(),lostAt:text.optional(),lostReason:text.optional(),retargetDate:text.optional(),stageHistory:z.array(stageChangeSchema).max(200).optional()})),
 contacts:list(object({companyId:id,brandId:text,name:text,title:text,email:text,phone:text,typeId:text.optional(),warmth:text.optional(),owner:text})),
 touchpoints:list(object({companyId:id,contactId:text,opportunityId:text,projectId:text,channel:text,summary:text,owner:text,nextAction:text,followup:text,done:z.boolean(),followupTaskId:text.optional()})),
 waiting:list(object({projectId:id,taskId:text,name:text,party:text,person:text,owner:text,requested:text,due:text,followup:text,impact:text,resolved:z.boolean(),resolution:text,resolvedAt:text.optional()})),
 approvals:list(object({projectId:id,name:text,version:z.number().int().min(1),reviewer:text,due:text,status:text,note:text,decidedAt:text,documentId:text.optional(),documentVersion:z.number().int().min(1).optional(),documentUrl:text.optional()})),
 activity:list(z.object({id,at:text,text,actor:text.optional(),actorId:text.optional(),owner:text.optional(),section:text.optional(),hat:text.optional()})),
 confidentialNotes:list(object({projectId:id,text})).default([]),
 notes:list(object({title:text.optional(),text,pinned:z.boolean().default(false),confidential:z.boolean().optional(),locked:z.boolean().optional(),passcodeHash:z.string().max(200).optional(),links:z.array(linkSchema).min(1).max(50),edits:z.array(noteEditSchema).max(200).optional()})).default([]),
 documents:list(object({title:text,url:text,docType:text,owner:text,status:z.enum(docStatuses),description:text,tags:z.array(text).max(30).default([]),audience:z.enum(['internal','client-sharing']).default('internal'),pinned:z.boolean().default(false),version:z.number().int().min(1).default(1),approvedVersion:z.number().int().min(1).optional(),approvedUrl:text.optional(),approvedAt:text.optional(),approvedBy:text.optional(),links:z.array(docLinkSchema).min(1).max(50)})).default([])
});

export function recordsOnly(s:State){const {members,readReminders,pinnedPriorities,reminderPrefs,deliveryFailures,savedReportViews,...records}=s;return records}
export function validateRecords(value:unknown):State{
 const s=recordSchema.parse(value) as State;
 for(const key of ['contactTypes','projectTemplates','people','companies','brands','suppliers','projects','tasks','opportunities','contacts','touchpoints','waiting','approvals','activity','confidentialNotes','notes','documents'] as const){const rows=s[key]||[];if(new Set(rows.map(x=>x.id)).size!==rows.length)throw Error(`Duplicate IDs in ${key}`)}
 for(const c of s.contacts)if(c.typeId&&!(s.contactTypes||[]).some(t=>t.id===c.typeId))throw Error('Backup contains an unknown contact type');
 const has=(key:keyof State,id:string)=>!id||Array.isArray(s[key])&&(s[key] as {id:string}[]).some(x=>x.id===id);
 for(const r of [...s.projects,...s.opportunities,...s.contacts,...s.brands,...s.touchpoints])if(!has('companies',r.companyId))throw Error('Backup contains a missing company');
 for(const r of [...s.projects,...s.opportunities,...s.contacts])if(r.brandId&&!s.brands.some(b=>b.id===r.brandId&&b.companyId===r.companyId))throw Error('Backup contains a mismatched brand');
 for(const r of [...s.waiting,...s.approvals,...s.confidentialNotes!])if(!has('projects',r.projectId))throw Error('Backup contains a missing project');
 for(const n of s.notes||[]){
  if(!n.links.length)throw Error('Backup contains a note without linked records');
  for(const l of n.links)if(!linkExists(s,l))throw Error('Backup contains a note with a missing linked record');
 }
 for(const d of s.documents||[]){
  if(!isValidExternalUrl(d.url))throw Error('Backup contains a document with an invalid URL');
  if(!d.links.length)throw Error('Backup contains a document without linked records');
  for(const l of d.links)if(!docLinkExists(s,l))throw Error('Backup contains a document with a missing linked record');
 }
 for(const a of s.approvals)if(a.documentId&&!(s.documents||[]).some(d=>d.id===a.documentId))throw Error('Backup contains an approval with a missing document');
 for(const t of s.tasks){
  if(t.projectId&&!has('projects',t.projectId))throw Error('Backup contains a missing project');
  const links=taskLinks(t);
  if(!links.length)throw Error('Backup contains a task without a project or linked record');
  for(const l of links)if(!linkExists(s,l))throw Error('Backup contains a task with a missing linked record');
  if(t.sourceNoteId&&!(s.notes||[]).some(n=>n.id===t.sourceNoteId))throw Error('Backup contains a task with a missing source note');
  if(!has('suppliers',t.supplierId)||t.dependsOn&&(!t.projectId||!s.tasks.some(x=>x.id===t.dependsOn&&x.projectId===t.projectId)))throw Error('Backup contains an invalid task link');
 }
 for(const w of s.waiting)if(w.taskId&&!s.tasks.some(t=>t.id===w.taskId&&t.projectId===w.projectId))throw Error('Backup contains an invalid waiting link');
 for(const p of s.projects)if(p.opportunityId&&!s.opportunities.some(o=>o.id===p.opportunityId&&o.companyId===p.companyId))throw Error('Backup contains an invalid project opportunity link');
 for(const t of s.touchpoints){
  for(const [key,rows] of [['contactId',s.contacts],['projectId',s.projects],['opportunityId',s.opportunities]] as const)if(t[key]&&!rows.some(r=>r.id===t[key]&&r.companyId===t.companyId))throw Error('Backup contains an invalid touchpoint link');
  if(t.followupTaskId&&!s.tasks.some(x=>x.id===t.followupTaskId))throw Error('Backup contains a touchpoint with a missing follow-up task');
 }
 if(!s.taskStatuses.some(x=>x.category==='todo')||!s.taskStatuses.some(x=>x.category==='done'))throw Error('Backup needs starting and completed task statuses');
 for(const t of s.tasks)if(!s.taskStatuses.some(x=>x.name===t.status))throw Error('Backup contains an unknown task status');
 for(const items of [s.studioPins??[],s.meetings??[],s.retrospectives??[]]){
  if(new Set(items.map(item=>item.id)).size!==items.length)throw Error('Backup contains duplicate shared record IDs');
 }
 validateSharedReferences(s);
 return normalize(s);
}
export async function digest(value:unknown){const bytes=new TextEncoder().encode(JSON.stringify(value));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')}
export async function envelope(s:State,owner:string,revision:number){const records=recordsOnly(s);return{format:'workspace-backup',version:1,workspace:owner,revision,exportedAt:new Date().toISOString(),checksum:await digest(records),records}}
export async function parseBackup(value:unknown,owner:string){const v=z.object({format:z.literal('workspace-backup'),version:z.literal(1),workspace:id,checksum:text,records:z.unknown()}).parse(value);if(v.workspace!==owner)throw Error('This backup belongs to a different workspace');if(await digest(v.records)!==v.checksum)throw Error('Backup checksum does not match');return validateRecords(v.records)}
export const exportSets=['contactTypes','projectTemplates','projects','tasks','opportunities','contacts','touchpoints','companies','brands','suppliers','waiting','approvals','people','activity','confidentialNotes','notes','documents','studioPins','meetings','retrospectives'] as const;
export function csv(rows:Record<string,unknown>[]){const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];const cell=(v:unknown)=>{let str=v==null?'':typeof v==='object'?JSON.stringify(v):String(v);if(/^[\s]*[=+@\-]/.test(str)||/^[\t\r\n]/.test(str))str="'"+str;return '"'+str.replaceAll('"','""')+'"'};return '\uFEFF'+[keys,...rows.map(r=>keys.map(k=>r[k]))].map(row=>row.map(cell).join(',')).join('\r\n')}
