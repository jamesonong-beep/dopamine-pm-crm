import {category,day,dealMissingNextAction,effectiveDealValue,type ReportKey,type State} from './model';
import {formatWaitingAge,waitingAgeDays} from './workspace-links';

export type ReportFilters={
 from?:string;
 to?:string;
 companyId?:string;
 brandId?:string;
 projectId?:string;
 owner?:string;
 hat?:string;
};

export type ReportMetric={
 key:string;
 label:string;
 value:string|number;
 sub:string;
};

export type ReportOutput={
 key:ReportKey;
 title:string;
 definition:string;
 asOf:string;
 metrics:ReportMetric[];
 columns:{key:string;label:string}[];
 rows:Record<string,string|number>[];
};

const inDateRange=(d:string|undefined,from?:string,to?:string)=>{
 if(!from&&!to)return true;
 if(!d)return false;
 const iso=d.slice(0,10);
 if(from&&iso<from)return false;
 if(to&&iso>to)return false;
 return true;
};

const money=(v:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:0}).format(v);

export function buildReport(
 s:State,
 key:ReportKey,
 filters:ReportFilters,
 options:{financials:boolean;on?:string}
):ReportOutput{
 const today=options.on||day();
 const asOf=new Date().toLocaleString('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'})+' PHT';
 const cname=(id?:string)=>id?s.companies.find(c=>c.id===id)?.name||'—':'—';
 const bname=(id?:string)=>id?s.brands.find(b=>b.id===id)?.name||'Company-wide':'Company-wide';
 const pname=(id?:string)=>id?s.projects.find(p=>p.id===id)?.name||'—':'—';

 if(key==='pipeline'){
  const deals=s.opportunities.filter(o=>{
   if(filters.companyId&&o.companyId!==filters.companyId)return false;
   if(filters.brandId&&o.brandId!==filters.brandId)return false;
   if(filters.owner&&o.owner!==filters.owner)return false;
   if(filters.hat&&o.hat!==filters.hat)return false;
   const refDate=o.nextActionDate||o.updatedAt||o.createdAt;
   if((filters.from||filters.to)&&!inDateRange(refDate,filters.from,filters.to))return false;
   return true;
  });
  const open=deals.filter(o=>o.stage!=='Lost'&&o.stage!=='Contract Signed');
  const signed=deals.filter(o=>o.stage==='Contract Signed');
  const lost=deals.filter(o=>o.stage==='Lost');
  const gaps=open.filter(o=>dealMissingNextAction(s,o).needsAttention);
  const columns=[
   {key:'name',label:'Opportunity'},
   {key:'company',label:'Company / Brand'},
   {key:'stage',label:'Stage'},
   ...(options.financials?[{key:'value',label:'Value (PHP)'}]:[]),
   {key:'owner',label:'Owner'},
   {key:'gap',label:'Next-Action Status'},
   {key:'lostReason',label:'Lost Reason / Retarget'},
   {key:'history',label:'Stage Changes'}
  ];
  const rows=deals.map(o=>{
   const g=dealMissingNextAction(s,o);
   const histCount=o.stageHistory?.length||0;
   const effVal=effectiveDealValue(o);
   return{
    _bucket:o.stage==='Lost'?'lost':o.stage==='Contract Signed'?'signed':g.needsAttention?'gap':'open',
    _id:o.id,
    name:o.name,
    company:`${cname(o.companyId)} / ${bname(o.brandId)}`,
    stage:o.stage,
    ...(options.financials?{value:effVal}:{}),
    owner:o.owner,
    gap:o.stage==='Lost'?'Lost':o.stage==='Contract Signed'?'Signed':g.needsAttention?(g.missingAction?'Missing next action':'Missing follow-up date'):`OK (${o.nextActionDate||'Touchpoint'})`,
    lostReason:o.stage==='Lost'?`${o.lostReason||'Not recorded'}${o.retargetDate?` · Retarget ${o.retargetDate}`:''}`:'—',
    history:histCount>0?`${histCount} recorded`:'Not recorded (earlier release)'
   };
  });
  return{
   key,title:'Sales Pipeline Report',
   definition:'Counts and values across permitted opportunities, flagging open deals without a next action or follow-up date and summarizing lost reasons. Earlier stage changes before structured history tracking are labeled rather than fabricated.',
   asOf,
   metrics:[
    {key:'all',label:'Total Opportunities',value:deals.length,sub:`${open.length} open · ${signed.length} signed`},
    {key:'open',label:'Open Pipeline',value:options.financials?money(open.reduce((n,o)=>n+effectiveDealValue(o),0)):open.length,sub:options.financials?`${open.length} active deals`:'Values restricted'},
    {key:'gap',label:'Missing Next Action / Date',value:gaps.length,sub:'Open deals needing follow-up'},
    {key:'lost',label:'Lost Deals',value:lost.length,sub:`${lost.filter(o=>o.retargetDate).length} with retarget date`}
   ],
   columns,rows
  };
 }

 if(key==='delivery'){
  const projects=s.projects.filter(p=>{
   if(filters.companyId&&p.companyId!==filters.companyId)return false;
   if(filters.brandId&&p.brandId!==filters.brandId)return false;
   if(filters.projectId&&p.id!==filters.projectId)return false;
   if(filters.owner&&p.owner!==filters.owner)return false;
   if(filters.hat&&p.hat!==filters.hat)return false;
   if((filters.from||filters.to)&&!inDateRange(p.due,filters.from,filters.to))return false;
   return true;
  });
  const rows=projects.map(p=>{
   const pTasks=s.tasks.filter(t=>t.projectId===p.id);
   const doneTasks=pTasks.filter(t=>category(s,t.status)==='done').length;
   const overdueTasks=pTasks.filter(t=>category(s,t.status)!=='done'&&t.due<today).length;
   const openWait=s.waiting.filter(w=>w.projectId===p.id&&!w.resolved).length;
   const pendApp=s.approvals.filter(a=>a.projectId===p.id&&a.status==='Pending').length;
   const pct=pTasks.length?Math.round((doneTasks/pTasks.length)*100):0;
   return{
    _bucket:p.status==='Complete'?'complete':overdueTasks>0||openWait>0?'at_risk':'active',
    _id:p.id,
    name:p.name,
    account:`${cname(p.companyId)} / ${bname(p.brandId)}`,
    status:p.status,
    owner:p.owner,
    timeline:`${p.start} – ${p.due}`,
    progress:`${doneTasks}/${pTasks.length} (${pct}%)`,
    overdueTasks,
    openWaiting:openWait,
    pendingApprovals:pendApp,
    completedAt:p.status==='Complete'?(p.completedAt?p.completedAt.slice(0,10):'Not recorded (earlier release)'):'—'
   };
  });
  const totalOverdue=rows.reduce((n,r)=>n+Number(r.overdueTasks),0);
  const totalWait=rows.reduce((n,r)=>n+Number(r.openWaiting),0);
  const totalApp=rows.reduce((n,r)=>n+Number(r.pendingApprovals),0);
  return{
   key,title:'Project Delivery Report',
   definition:'Tracks task progress, timelines, overdue tasks, open waiting items, pending approvals, and structured completion dates per permitted project.',
   asOf,
   metrics:[
    {key:'all',label:'Projects',value:rows.length,sub:`${rows.filter(r=>r.status!=='Complete').length} active`},
    {key:'at_risk',label:'With Overdue / Blockers',value:rows.filter(r=>r._bucket==='at_risk').length,sub:`${totalOverdue} overdue tasks`},
    {key:'active',label:'Open Waiting & Approvals',value:totalWait+totalApp,sub:`${totalWait} waiting · ${totalApp} approvals`},
    {key:'complete',label:'Completed Projects',value:rows.filter(r=>r.status==='Complete').length,sub:'Completion date recorded on close'}
   ],
   columns:[
    {key:'name',label:'Project'},
    {key:'account',label:'Company / Brand'},
    {key:'status',label:'Status'},
    {key:'owner',label:'Owner'},
    {key:'timeline',label:'Timeline'},
    {key:'progress',label:'Task Progress'},
    {key:'overdueTasks',label:'Overdue Tasks'},
    {key:'openWaiting',label:'Open Waiting'},
    {key:'pendingApprovals',label:'Pending Approvals'},
    {key:'completedAt',label:'Completed Date'}
   ],
   rows
  };
 }

 if(key==='workload'){
  const tasks=s.tasks.filter(t=>{
   const p=t.projectId?s.projects.find(x=>x.id===t.projectId):undefined;
   if(filters.companyId&&p?.companyId!==filters.companyId)return false;
   if(filters.brandId&&p?.brandId!==filters.brandId)return false;
   if(filters.projectId&&t.projectId!==filters.projectId)return false;
   if(filters.owner&&t.owner!==filters.owner)return false;
   if(filters.hat&&t.hat!==filters.hat)return false;
   if((filters.from||filters.to)&&!inDateRange(t.due,filters.from,filters.to))return false;
   return true;
  });
  const byKey=new Map<string,{owner:string;hat:string;open:number;overdue:number;dueToday:number;completed:number;reschedules:number}>();
  for(const t of tasks){
   const k=`${t.owner}::${t.hat||'General'}`;
   const cur=byKey.get(k)||{owner:t.owner,hat:t.hat||'General',open:0,overdue:0,dueToday:0,completed:0,reschedules:0};
   const isDone=category(s,t.status)==='done';
   if(isDone)cur.completed++;
   else{
    cur.open++;
    if(t.due<today)cur.overdue++;
    else if(t.due===today)cur.dueToday++;
   }
   cur.reschedules+=(t.reschedules?.length||0);
   byKey.set(k,cur);
  }
  const rows=Array.from(byKey.values()).sort((a,b)=>b.overdue-a.overdue||b.open-a.open).map(r=>({
   _bucket:r.overdue>0?'overdue':r.open>0?'open':'completed',
   ...r
  }));
  const openCount=rows.reduce((n,r)=>n+r.open,0);
  const overdueCount=rows.reduce((n,r)=>n+r.overdue,0);
  const completedCount=rows.reduce((n,r)=>n+r.completed,0);
  const rescheduleCount=rows.reduce((n,r)=>n+r.reschedules,0);
  return{
   key,title:'Team Workload Report',
   definition:'Assigned task counts grouped by owner and work role. Important: task count reflects assigned items only, not effort, complexity, or productivity.',
   asOf,
   metrics:[
    {key:'all',label:'People / Role Rows',value:rows.length,sub:`${tasks.length} tasks in filter`},
    {key:'open',label:'Open Assigned Tasks',value:openCount,sub:'Not yet completed'},
    {key:'overdue',label:'Overdue Tasks',value:overdueCount,sub:`${rescheduleCount} recorded reschedules`},
    {key:'completed',label:'Completed Tasks',value:completedCount,sub:'Across selected filters'}
   ],
   columns:[
    {key:'owner',label:'Owner'},
    {key:'hat',label:'Work Role'},
    {key:'open',label:'Open Tasks'},
    {key:'overdue',label:'Overdue'},
    {key:'dueToday',label:'Due Today'},
    {key:'completed',label:'Completed'},
    {key:'reschedules',label:'Recorded Reschedules'}
   ],
   rows
  };
 }

 if(key==='followups'){
  const contacts=s.contacts.filter(c=>{
   if(filters.companyId&&c.companyId!==filters.companyId)return false;
   if(filters.brandId&&c.brandId!==filters.brandId)return false;
   if(filters.owner&&c.owner!==filters.owner)return false;
   if(filters.hat&&c.hat!==filters.hat)return false;
   return true;
  });
  const rows=contacts.map(c=>{
   const touches=s.touchpoints.filter(t=>t.contactId===c.id&&(!(filters.from||filters.to)||inDateRange(t.followup,filters.from,filters.to)));
   const last=[...touches].sort((a,b)=>(b.createdAt||b.followup||'').localeCompare(a.createdAt||a.followup||''))[0];
   const openTouches=touches.filter(t=>!t.done);
   const overdue=openTouches.filter(t=>t.followup<today);
   const nextUp=[...openTouches].sort((a,b)=>a.followup.localeCompare(b.followup))[0];
   return{
    _bucket:overdue.length>0?'overdue':openTouches.length>0?'upcoming':'none',
    _id:c.id,
    contact:c.name,
    account:`${cname(c.companyId)} / ${bname(c.brandId)}`,
    owner:c.owner,
    warmth:c.warmth||'Unrated',
    lastTouchpoint:last?`${last.channel} · ${(last.createdAt||last.followup).slice(0,10)}`:'No touchpoints recorded',
    nextFollowup:nextUp?`${nextUp.nextAction} (${nextUp.followup})`:'None scheduled',
    overdueCount:overdue.length
   };
  });
  return{
   key,title:'Client Follow-ups Report',
   definition:'Shows last recorded touchpoint, upcoming or overdue follow-up actions, relationship owner, and contact warmth for permitted contacts.',
   asOf,
   metrics:[
    {key:'all',label:'Contacts Covered',value:rows.length,sub:`${rows.filter(r=>r.warmth==='Hot'||r.warmth==='Warm').length} warm/hot`},
    {key:'overdue',label:'With Overdue Follow-ups',value:rows.filter(r=>r._bucket==='overdue').length,sub:'Past follow-up date'},
    {key:'upcoming',label:'With Open Follow-ups',value:rows.filter(r=>r._bucket==='upcoming').length,sub:'Scheduled next actions'},
    {key:'none',label:'No Open Follow-up',value:rows.filter(r=>r._bucket==='none').length,sub:'Consider logging a check-in'}
   ],
   columns:[
    {key:'contact',label:'Contact'},
    {key:'account',label:'Company / Brand'},
    {key:'owner',label:'Owner'},
    {key:'warmth',label:'Warmth'},
    {key:'lastTouchpoint',label:'Last Touchpoint'},
    {key:'nextFollowup',label:'Next Follow-up'},
    {key:'overdueCount',label:'Overdue Follow-ups'}
   ],
   rows
  };
 }

 // waiting
 const waitingItems=s.waiting.filter(w=>{
  const p=s.projects.find(x=>x.id===w.projectId);
  if(filters.companyId&&p?.companyId!==filters.companyId)return false;
  if(filters.brandId&&p?.brandId!==filters.brandId)return false;
  if(filters.projectId&&w.projectId!==filters.projectId)return false;
  if(filters.owner&&w.owner!==filters.owner)return false;
  if(filters.hat&&w.hat!==filters.hat)return false;
  if((filters.from||filters.to)&&!inDateRange(w.due,filters.from,filters.to))return false;
  return true;
 });
 const rows=waitingItems.map(w=>{
  const age=w.resolved?(w.resolvedAt?waitingAgeDays(w.requested,w.resolvedAt.slice(0,10)):null):waitingAgeDays(w.requested,today);
  const isOverdue=!w.resolved&&w.due<today;
  return{
   _bucket:w.resolved?'resolved':isOverdue?'overdue':'open',
   _id:w.id,
   item:w.name,
   project:pname(w.projectId),
   debtor:`${w.person} (${w.party})`,
   chasingOwner:w.owner,
   requested:w.requested||'Not recorded',
   expected:w.due,
   age:w.resolved?(age!==null?`Resolved in ${age}d`:'Resolved (earlier release)'):formatWaitingAge(w.requested,today),
   status:w.resolved?`Resolved ${w.resolvedAt?w.resolvedAt.slice(0,10):'(earlier release)'}`:isOverdue?'Overdue':'Open'
  };
 });
 return{
  key:'waiting',title:'Waiting On & Blockers Report',
  definition:'Tracks who owes each dependency, the internal chasing owner, waiting age from request date, expected date, resolution date, and affected project.',
  asOf,
  metrics:[
   {key:'all',label:'Total Waiting Items',value:rows.length,sub:`${rows.filter(r=>r._bucket!=='resolved').length} open`},
   {key:'overdue',label:'Overdue Blockers',value:rows.filter(r=>r._bucket==='overdue').length,sub:'Past expected date'},
   {key:'open',label:'Open On-Track',value:rows.filter(r=>r._bucket==='open').length,sub:'Awaiting input'},
   {key:'resolved',label:'Resolved',value:rows.filter(r=>r._bucket==='resolved').length,sub:'Resolution dates tracked'}
  ],
  columns:[
   {key:'item',label:'Waiting Item'},
   {key:'project',label:'Affected Project'},
   {key:'debtor',label:'Owed By'},
   {key:'chasingOwner',label:'Chasing Owner'},
   {key:'requested',label:'Requested'},
   {key:'expected',label:'Expected Date'},
   {key:'age',label:'Age'},
   {key:'status',label:'Status'}
  ],
  rows
 };
}
