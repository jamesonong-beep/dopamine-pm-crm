import {z} from 'zod';
import type {State} from './model';
import type {StudioPin} from './studio-pins';
import {CUBIST_STARTER_ART,normalizeStudioPinSlots} from './studio-pins';
import {isValidExternalUrl,type Meeting,type RetrospectiveEntry} from './workspace-links';

const id=z.string().min(1).max(200);
const title=z.string().trim().min(1).max(240);
const text=z.string().max(10000);
const date=z.string().refine(value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value,'Invalid meeting date');
const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const timestamp=z.string().max(40);
const url=z.string().max(2000).refine(isValidExternalUrl);
export const studioPinSchema=z.object({
 id,kind:z.enum(['announcement','postit','image','document']),title,body:text,
 color:z.enum(['butter','terracotta','sage','sky','ochre']).optional(),
 imageUrl:z.string().max(150000).refine(value=>value===CUBIST_STARTER_ART||isValidExternalUrl(value)||/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/]+=*$/i.test(value),'Use a valid image URL or a compressed image').optional(),
 linkUrl:url.optional(),documentId:id.optional(),tag:z.string().max(100).optional(),
 pinned:z.boolean(),slot:z.number().int().min(0).max(1000).optional(),
 author:title,createdAt:timestamp
});
export const meetingSchema=z.object({
 id,title,date,startTime:time,endTime:time,owner:title,hat:z.string().max(80).optional(),
 attendees:z.array(title).max(100),locationOrLink:z.string().max(2000).optional(),agenda:text.optional(),
 status:z.enum(['Scheduled','Completed','Canceled']),
 companyId:id.optional(),brandId:id.optional(),opportunityId:id.optional(),projectId:id.optional(),
 createdBy:title.optional(),createdAt:timestamp.optional()
});
export const retrospectiveSchema=z.object({
 id,targetType:z.enum(['deal','project']),targetId:id,
 rating:z.enum(['Smooth win','Good with lessons','Bumpy — needs fix','Lost / Post-mortem']),
 wentWell:text,couldImprove:text,playbook:text,updatedAt:timestamp,updatedBy:title
});
export const sharedWorkSchema=z.discriminatedUnion('collection',[
 z.object({collection:z.literal('studioPins'),upserts:z.array(studioPinSchema).max(8),removeIds:z.array(id).max(8)}),
 z.object({collection:z.literal('meetings'),upserts:z.array(meetingSchema).max(8),removeIds:z.array(id).max(8)}),
 z.object({collection:z.literal('retrospectives'),upserts:z.array(retrospectiveSchema).max(8),removeIds:z.array(id).max(8)})
]);

function mergeItems<T extends {id:string}>(existing:T[],upserts:T[],removeIds:string[],maximum:number){
 const items=new Map(existing.map(item=>[item.id,item]));
 const changedIds=new Set(upserts.map(item=>item.id));
 if(changedIds.size!==upserts.length||removeIds.some(id=>changedIds.has(id)))throw Error('Invalid shared record changes.');
 for(const id of removeIds)items.delete(id);
 for(const item of upserts)items.set(item.id,item);
 if(items.size>maximum)throw Error('This collection has reached its record limit.');
 return [...items.values()];
}

export function validateSharedReferences(state:State){
 for(const pin of state.studioPins??[]){
  if(pin.documentId&&!state.documents?.some(doc=>doc.id===pin.documentId))throw Error('Studio card links to a missing document.');
 }
 for(const meeting of state.meetings??[]){
  const links=[
   [meeting.companyId,state.companies],[meeting.brandId,state.brands],
   [meeting.opportunityId,state.opportunities],[meeting.projectId,state.projects]
  ] as const;
  if(meeting.endTime<=meeting.startTime)throw Error('Meeting end time must be after start time.');
  if(links.some(([id,records])=>id&&!records.some(record=>record.id===id)))throw Error('Meeting links to a missing record.');
 }
 for(const note of state.retrospectives??[]){
  const records=note.targetType==='deal'?state.opportunities:state.projects;
  if(note.id!==note.targetType+':'+note.targetId||!records.some(record=>record.id===note.targetId))throw Error('Retrospective links to a missing record.');
 }
}

export function applySharedWork(state:State,change:z.infer<typeof sharedWorkSchema>,actor:string,now:string){
 if(change.collection==='studioPins'){
  const existing=state.studioPins??[];
  const incoming:StudioPin[]=change.upserts.map(item=>{
   const before=existing.find(pin=>pin.id===item.id);
   return {...item,author:before?.author??actor,createdAt:before?.createdAt??now,linkUrl:item.documentId?undefined:item.linkUrl};
  });
  state.studioPins=normalizeStudioPinSlots(mergeItems(existing,incoming,change.removeIds,100));
 }else if(change.collection==='meetings'){
  const existing=state.meetings??[];
  const incoming:Meeting[]=change.upserts.map(item=>{
   const before=existing.find(meeting=>meeting.id===item.id);
   return {...item,createdBy:before?.createdBy??actor,createdAt:before?.createdAt??now};
  });
  state.meetings=mergeItems(existing,incoming,change.removeIds,500);
 }else{
  const incoming:RetrospectiveEntry[]=change.upserts.map(item=>({...item,updatedAt:now,updatedBy:actor}));
  state.retrospectives=mergeItems(state.retrospectives??[],incoming,change.removeIds,500);
 }
 validateSharedReferences(state);
}
