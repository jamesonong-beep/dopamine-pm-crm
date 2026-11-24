import type {State,RecordLink,RecordLinkType,Task,Note} from './model';

export const recordLinkTypes=['company','brand','project','contact'] as const;

export const linkTypeSection:Record<RecordLinkType,string>={
 company:'Companies & brands',
 brand:'Companies & brands',
 project:'Projects',
 contact:'Contacts'
};

export const linkTypeLabel:Record<RecordLinkType,string>={
 company:'Company',
 brand:'Brand',
 project:'Project',
 contact:'Contact'
};

export function dedupeLinks(links?:RecordLink[]):RecordLink[]{
 if(!Array.isArray(links))return [];
 const seen=new Set<string>();
 const out:RecordLink[]=[];
 for(const link of links){
  if(!link||!recordLinkTypes.includes(link.type)||!link.id)continue;
  const id=String(link.id).trim();
  if(!id)continue;
  const key=`${link.type}:${id}`;
  if(seen.has(key))continue;
  seen.add(key);
  out.push({type:link.type,id});
 }
 return out;
}

export function taskLinks(task:Pick<Task,'projectId'|'links'>):RecordLink[]{
 const base:RecordLink[]=task.projectId?[{type:'project',id:task.projectId}]:[];
 return dedupeLinks([...base,...(task.links||[])]);
}

export function syncTaskLinks(projectId:string,links?:RecordLink[]):{projectId:string;links:RecordLink[]}{
 const merged=dedupeLinks([...(projectId?[{type:'project' as const,id:projectId}]:[]),...(links||[])]);
 const effectiveProjectId=projectId||merged.find(l=>l.type==='project')?.id||'';
 return {projectId:effectiveProjectId,links:merged};
}

export function linkExists(state:State,link:RecordLink):boolean{
 switch(link.type){
  case 'company':return state.companies.some(c=>c.id===link.id);
  case 'brand':return state.brands.some(b=>b.id===link.id);
  case 'project':return state.projects.some(p=>p.id===link.id);
  case 'contact':return state.contacts.some(c=>c.id===link.id);
 }
}

export function linkName(state:State,link:RecordLink):string{
 switch(link.type){
  case 'company':return state.companies.find(c=>c.id===link.id)?.name||'Company';
  case 'brand':return state.brands.find(b=>b.id===link.id)?.name||'Brand';
  case 'project':return state.projects.find(p=>p.id===link.id)?.name||'Project';
  case 'contact':return state.contacts.find(c=>c.id===link.id)?.name||'Contact';
 }
}

export function requiredSectionsForLinks(links:RecordLink[]):string[]{
 return [...new Set(links.map(l=>linkTypeSection[l.type]))];
}

export function primarySectionForTask(task:Pick<Task,'projectId'|'links'>):string{
 if(task.projectId)return 'Projects';
 const links=taskLinks(task);
 if(links.some(l=>l.type==='project'))return 'Projects';
 if(links.some(l=>l.type==='contact'))return 'Contacts';
 if(links.some(l=>l.type==='brand'||l.type==='company'))return 'Companies & brands';
 return 'My Day';
}

export function hasDirectLink(links:RecordLink[],type:RecordLinkType,id:string):boolean{
 return links.some(l=>l.type===type&&l.id===id);
}

export function matchesCompanyScope(state:State,links:RecordLink[],companyId:string,mode:'direct'|'related'):boolean{
 if(hasDirectLink(links,'company',companyId))return true;
 if(mode==='direct')return false;
 return links.some(l=>{
  if(l.type==='brand')return state.brands.some(b=>b.id===l.id&&b.companyId===companyId);
  if(l.type==='project')return state.projects.some(p=>p.id===l.id&&p.companyId===companyId);
  if(l.type==='contact')return state.contacts.some(c=>c.id===l.id&&c.companyId===companyId);
  return false;
 });
}

export function matchesBrandScope(state:State,links:RecordLink[],brandId:string,mode:'direct'|'related'):boolean{
 if(hasDirectLink(links,'brand',brandId))return true;
 if(mode==='direct')return false;
 return links.some(l=>{
  if(l.type==='project')return state.projects.some(p=>p.id===l.id&&p.brandId===brandId);
  if(l.type==='contact')return state.contacts.some(c=>c.id===l.id&&c.brandId===brandId);
  return false;
 });
}

export function originLabelsForContext(state:State,links:RecordLink[],contextType:RecordLinkType,contextId:string):string[]{
 const labels:string[]=[];
 for(const l of dedupeLinks(links)){
  if(l.type===contextType&&l.id===contextId){
   labels.push(`Direct · ${linkTypeLabel[l.type]}`);
  }else{
   labels.push(`${linkTypeLabel[l.type]} · ${linkName(state,l)}`);
  }
 }
 return labels;
}

export function sortNotes(notes:Note[]):Note[]{
 return [...notes].sort((a,b)=>{
  if(a.pinned!==b.pinned)return a.pinned?-1:1;
  const at=a.updatedAt||a.createdAt||'';
  const bt=b.updatedAt||b.createdAt||'';
  return bt.localeCompare(at);
 });
}

export function addDays(dateStr:string,offset:number):string{
 const base=Date.parse(`${dateStr}T00:00:00Z`);
 if(Number.isNaN(base))return dateStr;
 const d=new Date(base);
 d.setUTCDate(d.getUTCDate()+offset);
 return d.toISOString().slice(0,10);
}

export function waitingAgeDays(requested:string,on:string):number|null{
 if(!requested||!on)return null;
 const start=Date.parse(`${requested}T00:00:00Z`),end=Date.parse(`${on}T00:00:00Z`);
 if(Number.isNaN(start)||Number.isNaN(end))return null;
 return Math.max(0,Math.round((end-start)/86400000));
}

export function formatWaitingAge(requested:string,on:string):string{
 const days=waitingAgeDays(requested,on);
 if(days===null)return 'Age not recorded';
 if(days===0)return 'Requested today';
 return days===1?'Waiting 1 day':`Waiting ${days} days`;
}

export const docLinkTypes=['company','brand','opportunity','project'] as const;
export type DocLinkType=(typeof docLinkTypes)[number];
export type DocLink={type:DocLinkType;id:string};

export const docLinkTypeSection:Record<DocLinkType,string>={
 company:'Companies & brands',
 brand:'Companies & brands',
 opportunity:'CRM Pipeline',
 project:'Projects'
};

export const docLinkTypeLabel:Record<DocLinkType,string>={
 company:'Company',
 brand:'Brand',
 opportunity:'Deal',
 project:'Project'
};

export function dedupeDocLinks(links?:DocLink[]):DocLink[]{
 if(!Array.isArray(links))return [];
 const seen=new Set<string>();
 const out:DocLink[]=[];
 for(const link of links){
  if(!link||!docLinkTypes.includes(link.type)||!link.id)continue;
  const id=String(link.id).trim();
  if(!id)continue;
  const key=`${link.type}:${id}`;
  if(seen.has(key))continue;
  seen.add(key);
  out.push({type:link.type,id});
 }
 return out;
}

export function docLinkExists(state:State,link:DocLink):boolean{
 switch(link.type){
  case 'company':return state.companies.some(c=>c.id===link.id);
  case 'brand':return state.brands.some(b=>b.id===link.id);
  case 'opportunity':return state.opportunities.some(o=>o.id===link.id);
  case 'project':return state.projects.some(p=>p.id===link.id);
 }
}

export function docLinkName(state:State,link:DocLink):string{
 switch(link.type){
  case 'company':return state.companies.find(c=>c.id===link.id)?.name||'Company';
  case 'brand':return state.brands.find(b=>b.id===link.id)?.name||'Brand';
  case 'opportunity':return state.opportunities.find(o=>o.id===link.id)?.name||'Deal';
  case 'project':return state.projects.find(p=>p.id===link.id)?.name||'Project';
 }
}

export function requiredSectionsForDocLinks(links:DocLink[]):string[]{
 return [...new Set(links.map(l=>docLinkTypeSection[l.type]))];
}

export function matchesDocContext(state:State,links:DocLink[],contextType:DocLinkType,contextId:string):boolean{
 if(links.some(l=>l.type===contextType&&l.id===contextId))return true;
 if(contextType==='company'){
  return links.some(l=>{
   if(l.type==='brand')return state.brands.some(b=>b.id===l.id&&b.companyId===contextId);
   if(l.type==='opportunity')return state.opportunities.some(o=>o.id===l.id&&o.companyId===contextId);
   if(l.type==='project')return state.projects.some(p=>p.id===l.id&&p.companyId===contextId);
   return false;
  });
 }
 if(contextType==='brand'){
  return links.some(l=>{
   if(l.type==='opportunity')return state.opportunities.some(o=>o.id===l.id&&o.brandId===contextId);
   if(l.type==='project')return state.projects.some(p=>p.id===l.id&&p.brandId===contextId);
   return false;
  });
 }
 return false;
}

export function isValidExternalUrl(raw:string):boolean{
 try{
  const u=new URL(raw.trim());
  return u.protocol==='https:'||u.protocol==='http:';
 }catch{
  return false;
 }
}

export type WarmthLevel='Hot'|'Warm'|'Cold'|'Unrated';
export type WarmthThresholds={hotMax:number;warmMax:number};
export const defaultWarmthThresholds:WarmthThresholds={hotMax:7,warmMax:21};
export type RecencyWarmth={
 level:WarmthLevel;
 days:number|null;
 fill:number;
 label:string;
 shortLabel:string;
 manual?:boolean;
};

export function computeRecencyWarmth(
 touchpoints:Pick<State['touchpoints'][number],'createdAt'|'followup'>[],
 today:string,
 thresholds:WarmthThresholds=defaultWarmthThresholds,
 manualOverride?:WarmthLevel
):RecencyWarmth{
 if(manualOverride&&manualOverride!=='Unrated'){
  const fill=manualOverride==='Hot'?94:manualOverride==='Warm'?62:24;
  return {level:manualOverride,days:null,fill,label:`${manualOverride} · Manual`,shortLabel:'Manual',manual:true};
 }
 const hotMax=Math.max(1,Math.round(thresholds.hotMax||7));
 const warmMax=Math.max(hotMax+1,Math.round(thresholds.warmMax||21));
 if(!touchpoints.length){
  return {level:'Unrated',days:null,fill:0,label:'Unrated · No touchpoints yet',shortLabel:'No touchpoints'};
 }
 let latestIso='';
 for(const t of touchpoints){
  const raw=(t.createdAt||'').slice(0,10)||t.followup||'';
  if(raw&&raw>latestIso)latestIso=raw;
 }
 if(!latestIso){
  return {level:'Unrated',days:null,fill:0,label:'Unrated · No touchpoints yet',shortLabel:'No touchpoints'};
 }
 const todayMs=Date.parse(`${today}T00:00:00Z`);
 const latestMs=Date.parse(`${latestIso}T00:00:00Z`);
 const days=Number.isNaN(todayMs)||Number.isNaN(latestMs)?0:Math.max(0,Math.floor((todayMs-latestMs)/86400000));
 if(days<=hotMax){
  const fill=Math.max(76,100-Math.round((days/hotMax)*24));
  const ago=days===0?'Today':days===1?'1d ago':`${days}d ago`;
  return {level:'Hot',days,fill,label:`Hot · ${ago}`,shortLabel:ago};
 }
 if(days<=warmMax){
  const span=Math.max(1,warmMax-hotMax);
  const fill=Math.max(44,72-Math.round(((days-hotMax)/span)*28));
  return {level:'Warm',days,fill,label:`Warm · ${days}d ago`,shortLabel:`${days}d ago`};
 }
 const fill=Math.max(14,38-Math.min(24,Math.round((days-warmMax)*0.6)));
 return {level:'Cold',days,fill,label:`Cold · ${days}d silent`,shortLabel:`${days}d silent`};
}

export function contactRecencyWarmth(
 state:State,
 contactId:string,
 today:string,
 thresholds:WarmthThresholds=defaultWarmthThresholds,
 manualOverride?:WarmthLevel
):RecencyWarmth{
 return computeRecencyWarmth(state.touchpoints.filter(t=>t.contactId===contactId),today,thresholds,manualOverride);
}

export function brandRecencyWarmth(
 state:State,
 brandId:string,
 today:string,
 thresholds:WarmthThresholds=defaultWarmthThresholds,
 manualOverride?:WarmthLevel
):RecencyWarmth{
 const contactIds=new Set(state.contacts.filter(c=>c.brandId===brandId).map(c=>c.id));
 const dealIds=new Set(state.opportunities.filter(o=>o.brandId===brandId).map(o=>o.id));
 const projectIds=new Set(state.projects.filter(p=>p.brandId===brandId).map(p=>p.id));
 const touches=state.touchpoints.filter(t=>
  (t.contactId&&contactIds.has(t.contactId))||
  (t.opportunityId&&dealIds.has(t.opportunityId))||
  (t.projectId&&projectIds.has(t.projectId))
 );
 return computeRecencyWarmth(touches,today,thresholds,manualOverride);
}

export type DealAging={
 stageDays:number;
 totalDays:number;
 stageLabel:string;
 totalLabel:string;
 stale:boolean;
 closed:boolean;
};

export function computeDealAging(o:State['opportunities'][number],today:string):DealAging{
 const hist=Array.isArray(o.stageHistory)?o.stageHistory:[];
 const firstIso=(o.createdAt||'').slice(0,10)||(hist[0]?.at||'').slice(0,10)||today;
 const lastStageEntry=hist.length?hist[hist.length-1]:undefined;
 const stageIso=(lastStageEntry?.at||'').slice(0,10)||(o.stage==='Lost'?(o.lostAt||'').slice(0,10):'')||firstIso;
 const closed=o.stage==='Contract Signed'||o.stage==='Lost';
 const endIso=closed?(o.stage==='Lost'?(o.lostAt||'').slice(0,10)||stageIso:stageIso):today;
 const diffDays=(fromIso:string,toIso:string)=>{
  const a=Date.parse(`${fromIso}T00:00:00Z`),b=Date.parse(`${toIso}T00:00:00Z`);
  if(Number.isNaN(a)||Number.isNaN(b))return 0;
  return Math.max(0,Math.floor((b-a)/86400000));
 };
 const stageDays=diffDays(stageIso,today);
 const totalDays=diffDays(firstIso,endIso);
 const fmt=(d:number)=>d===0?'<1d':`${d}d`;
 return {
  stageDays,
  totalDays,
  stageLabel:o.stage==='Contract Signed'?`Signed ${fmt(stageDays)} ago`:o.stage==='Lost'?`Lost ${fmt(stageDays)} ago`:`${fmt(stageDays)} in stage`,
  totalLabel:closed?`Cycle ${fmt(totalDays)}`:`${fmt(totalDays)} total`,
  stale:!closed&&stageDays>=14,
  closed
 };
}

export type JourneyEventKind='created'|'stage'|'touchpoint'|'handoff'|'blocker'|'approval'|'task'|'closed';
export type JourneyEvent={
 id:string;
 at:string;
 kind:JourneyEventKind;
 title:string;
 detail?:string;
 actor?:string;
 deltaLabel?:string;
 tone?:'green'|'red'|'blue'|'purple'|'amber';
};

export type RetrospectiveRating='Smooth win'|'Good with lessons'|'Bumpy — needs fix'|'Lost / Post-mortem';
export type RetrospectiveEntry={
 id:string;
 targetType:'deal'|'project';
 targetId:string;
 rating:RetrospectiveRating;
 wentWell:string;
 couldImprove:string;
 playbook:string;
 updatedAt:string;
 updatedBy:string;
};

const isoDay=(v?:string)=>v?v.slice(0,10):'';
const diffDaysSafe=(fromIso:string,toIso:string)=>{
 if(!fromIso||!toIso)return null;
 const a=Date.parse(`${fromIso.slice(0,10)}T00:00:00Z`),b=Date.parse(`${toIso.slice(0,10)}T00:00:00Z`);
 if(Number.isNaN(a)||Number.isNaN(b))return null;
 return Math.max(0,Math.floor((b-a)/86400000));
};

export function buildDealJourney(state:State,dealId:string,today:string):JourneyEvent[]{
 const deal=state.opportunities.find(o=>o.id===dealId);
 if(!deal)return [];
 const events:JourneyEvent[]=[];
 const hist=Array.isArray(deal.stageHistory)?deal.stageHistory:[];
 const createdIso=isoDay(deal.createdAt)||isoDay(hist[0]?.at)||today;
 events.push({
  id:`deal-created-${deal.id}`,
  at:createdIso,
  kind:'created',
  title:`Opportunity opened — ${deal.name}`,
  detail:`Initial owner: ${deal.owner}${deal.hat?` (${deal.hat})`:''}`,
  actor:deal.createdBy||deal.owner,
  tone:'purple'
 });
 let prevStageAt=createdIso;
 hist.forEach((h,i)=>{
  const at=isoDay(h.at)||createdIso;
  const d=diffDaysSafe(prevStageAt,at);
  events.push({
   id:`deal-stage-${deal.id}-${i}`,
   at,
   kind:'stage',
   title:`Stage moved: ${h.from} → ${h.to}`,
   detail:h.to==='Contract Signed'?'Deal signed and ready for project handoff.':undefined,
   actor:h.by||deal.owner,
   deltaLabel:d!==null?(d===0?'Same day':`+${d}d in ${h.from}`):undefined,
   tone:h.to==='Contract Signed'?'green':'blue'
  });
  prevStageAt=at;
 });
 for(const t of state.touchpoints.filter(x=>x.opportunityId===deal.id)){
  const at=isoDay(t.createdAt)||t.followup||createdIso;
  events.push({
   id:`deal-touch-${t.id}`,
   at,
   kind:'touchpoint',
   title:`${t.channel} touchpoint${t.done?' (Done)':''}`,
   detail:`${t.summary}${t.nextAction?` · Next: ${t.nextAction}`:''}`,
   actor:t.owner,
   tone:t.done?'green':'amber'
  });
 }
 if(deal.stage==='Lost'){
  const at=isoDay(deal.lostAt)||today;
  events.push({
   id:`deal-lost-${deal.id}`,
   at,
   kind:'closed',
   title:`Marked Lost${deal.lostFrom?` from ${deal.lostFrom}`:''}`,
   detail:deal.lostReason||'No loss reason recorded',
   actor:deal.updatedBy||deal.owner,
   tone:'red'
  });
 }
 const linkedProjects=state.projects.filter(p=>p.opportunityId===deal.id);
 for(const p of linkedProjects){
  const pAt=isoDay(p.createdAt)||p.start||today;
  events.push({
   id:`deal-handoff-${p.id}`,
   at:pAt,
   kind:'handoff',
   title:`Handed off to project: ${p.name}`,
   detail:`Owner: ${p.owner} · Window: ${p.start} – ${p.due} · Status: ${p.status}`,
   actor:p.createdBy||p.owner,
   tone:'green'
  });
  for(const w of state.waiting.filter(x=>x.projectId===p.id)){
   events.push({
    id:`deal-wait-${w.id}`,
    at:w.requested||pAt,
    kind:'blocker',
    title:`Blocker (${w.party}): ${w.name}`,
    detail:w.resolved?`Resolved: ${w.resolution}`:`Waiting on ${w.person} · ${w.impact}`,
    actor:w.owner,
    tone:w.resolved?'green':'red'
   });
  }
  for(const a of state.approvals.filter(x=>x.projectId===p.id)){
   events.push({
    id:`deal-appr-${a.id}`,
    at:isoDay(a.decidedAt)||a.due||pAt,
    kind:'approval',
    title:`Approval (${a.status}): ${a.name} v${a.version}`,
    detail:`Reviewer: ${a.reviewer}${a.note?` · ${a.note}`:''}`,
    actor:a.reviewer,
    tone:a.status==='Approved'?'green':a.status==='Changes requested'?'red':'amber'
   });
  }
  if(p.completedAt){
   events.push({
    id:`deal-pcomp-${p.id}`,
    at:isoDay(p.completedAt),
    kind:'closed',
    title:`Project completed: ${p.name}`,
    actor:p.owner,
    tone:'green'
   });
  }
 }
 return events.sort((a,b)=>a.at.localeCompare(b.at));
}

export function buildProjectJourney(state:State,projectId:string,today:string):JourneyEvent[]{
 const project=state.projects.find(p=>p.id===projectId);
 if(!project)return [];
 const events:JourneyEvent[]=[];
 if(project.opportunityId){
  const deal=state.opportunities.find(o=>o.id===project.opportunityId);
  if(deal){
   const dealStart=isoDay(deal.createdAt)||isoDay(deal.stageHistory?.[0]?.at)||project.start||today;
   events.push({
    id:`proj-deal-${deal.id}`,
    at:dealStart,
    kind:'handoff',
    title:`Originated from deal: ${deal.name}`,
    detail:`Stage: ${deal.stage} · Account owner: ${deal.owner}`,
    actor:deal.owner,
    tone:'purple'
   });
   (deal.stageHistory||[]).forEach((h,i)=>{
    events.push({
     id:`proj-dstage-${deal.id}-${i}`,
     at:isoDay(h.at)||dealStart,
     kind:'stage',
     title:`Deal moved: ${h.from} → ${h.to}`,
     actor:h.by||deal.owner,
     tone:h.to==='Contract Signed'?'green':'blue'
    });
   });
  }
 }
 const startIso=project.start||isoDay(project.createdAt)||today;
 events.push({
  id:`proj-start-${project.id}`,
  at:startIso,
  kind:'created',
  title:`Project kicked off — ${project.name}`,
  detail:`Template: ${project.type} · Owner: ${project.owner} · Target: ${project.due}`,
  actor:project.createdBy||project.owner,
  tone:'blue'
 });
 for(const t of state.touchpoints.filter(x=>x.projectId===project.id)){
  events.push({
   id:`proj-touch-${t.id}`,
   at:isoDay(t.createdAt)||t.followup||startIso,
   kind:'touchpoint',
   title:`${t.channel} touchpoint${t.done?' (Done)':''}`,
   detail:t.summary,
   actor:t.owner,
   tone:t.done?'green':'amber'
  });
 }
 for(const w of state.waiting.filter(x=>x.projectId===project.id)){
  const waitDays=w.resolved&&w.resolvedAt?diffDaysSafe(w.requested,w.resolvedAt):diffDaysSafe(w.requested,today);
  events.push({
   id:`proj-wait-${w.id}`,
   at:w.requested||startIso,
   kind:'blocker',
   title:`${w.resolved?'Resolved blocker':'Open blocker'} (${w.party}): ${w.name}`,
   detail:w.resolved?`Resolution: ${w.resolution}`:`Owed by ${w.person} · ${w.impact}`,
   actor:w.owner,
   deltaLabel:waitDays!==null?(w.resolved?`Blocked ${waitDays}d`:`Waiting ${waitDays}d`):undefined,
   tone:w.resolved?'green':'red'
  });
 }
 for(const a of state.approvals.filter(x=>x.projectId===project.id)){
  events.push({
   id:`proj-appr-${a.id}`,
   at:isoDay(a.decidedAt)||a.due||startIso,
   kind:'approval',
   title:`Approval (${a.status}): ${a.name} v${a.version}`,
   detail:`Reviewer: ${a.reviewer}${a.note?` · ${a.note}`:''}`,
   actor:a.reviewer,
   tone:a.status==='Approved'?'green':a.status==='Changes requested'?'red':'amber'
  });
 }
 for(const task of state.tasks.filter(x=>x.projectId===project.id)){
  if(task.reschedules?.length){
   const lastR=task.reschedules[task.reschedules.length-1];
   events.push({
    id:`proj-resched-${task.id}`,
    at:isoDay(lastR.at)||task.due||startIso,
    kind:'task',
    title:`Task rescheduled (${task.reschedules.length}×): ${task.name}`,
    detail:`Moved from ${lastR.from} to ${lastR.to}`,
    actor:lastR.by||task.owner,
    tone:'amber'
   });
  }
  if(task.completedAt){
   events.push({
    id:`proj-tdone-${task.id}`,
    at:isoDay(task.completedAt),
    kind:'task',
    title:`Completed task: ${task.name}`,
    actor:task.owner,
    tone:'green'
   });
  }
 }
 if(project.completedAt||project.status==='Complete'){
  events.push({
   id:`proj-complete-${project.id}`,
   at:isoDay(project.completedAt)||project.due||today,
   kind:'closed',
   title:`Project marked Complete`,
   detail:`Delivery owner: ${project.owner}`,
   actor:project.owner,
   tone:'green'
  });
 }
 return events.sort((a,b)=>a.at.localeCompare(b.at));
}

export type MeetingStatus='Scheduled'|'Completed'|'Canceled';
export type Meeting={
 id:string;
 title:string;
 date:string;
 startTime:string;
 endTime:string;
 owner:string;
 hat?:string;
 attendees:string[];
 locationOrLink?:string;
 agenda?:string;
 status:MeetingStatus;
 companyId?:string;
 brandId?:string;
 opportunityId?:string;
 projectId?:string;
 createdBy?:string;
 createdAt?:string;
};

export function defaultSampleMeetings(today:string,state?:Pick<State,'companies'|'brands'|'opportunities'|'projects'|'people'>):Meeting[]{
 const owner1=state?.people?.[0]?.name||'Maya Santos';
 const owner2=state?.people?.[1]?.name||'Carlo Mendoza';
 const owner3=state?.people?.[2]?.name||'Bea Villanueva';
 const co1=state?.companies?.[0]?.id||'c1';
 const br1=state?.brands?.[0]?.id||'b1';
 const opp1=state?.opportunities?.[0]?.id||'o1';
 const proj1=state?.projects?.[0]?.id||'p1';
 const proj4=state?.projects?.[3]?.id||'p4';
 const co2=state?.companies?.[1]?.id||'c2';
 return [
  {
   id:'mtg-sample-1',
   title:'Kape Solana Portal Creative Walkthrough',
   date:today,
   startTime:'10:00',
   endTime:'11:00',
   owner:owner1,
   hat:'Account management',
   attendees:[owner1,owner3,'Patricia Lim'].filter((v,i,a)=>Boolean(v)&&a.indexOf(v)===i),
   locationOrLink:'Main Studio Room / Video Call',
   agenda:'Walk Patricia through the Kape Solana holiday roast portal banners and lock final launch dates.',
   status:'Scheduled',
   companyId:co1||undefined,
   brandId:br1||undefined,
   opportunityId:opp1||undefined,
   projectId:proj1||undefined,
   createdBy:owner1,
   createdAt:`${today}T08:00:00Z`
  },
  {
   id:'mtg-sample-2',
   title:'Lumina Store Fiber Bid Sync with FiberGrid',
   date:addDays(today,1),
   startTime:'14:00',
   endTime:'14:45',
   owner:owner2,
   hat:'Project lead',
   attendees:[owner2,'Marco Tan','Paolo Bautista'].filter((v,i,a)=>Boolean(v)&&a.indexOf(v)===i),
   locationOrLink:'Studio Conference Room B',
   agenda:'Review 18-store feasibility quotes and finalize bid pricing before submission.',
   status:'Scheduled',
   companyId:co2||undefined,
   projectId:proj4||undefined,
   createdBy:owner2,
   createdAt:`${today}T08:15:00Z`
  },
  {
   id:'mtg-sample-3',
   title:'Solana Oat Q4 Paid Media Optimization Review',
   date:addDays(today,3),
   startTime:'16:00',
   endTime:'17:00',
   owner:owner3,
   hat:'Media operations',
   attendees:[owner3,owner1,'Daryl Ong'].filter((v,i,a)=>Boolean(v)&&a.indexOf(v)===i),
   locationOrLink:'Client HQ / Video Call',
   agenda:'Check Meta & TikTok pixel validation, lookalike audiences, and Q4 pacing.',
   status:'Scheduled',
   companyId:co1||undefined,
   createdBy:owner3,
   createdAt:`${today}T08:30:00Z`
  }
 ];
}
