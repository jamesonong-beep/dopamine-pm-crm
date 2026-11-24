import {defaultStudioPins,type StudioPin} from './studio-pins';
import {defaultSampleMeetings,type Meeting,type RetrospectiveEntry} from './workspace-links';
import {dedupeDocLinks,dedupeLinks,primarySectionForTask,syncTaskLinks,taskLinks,type DocLink} from './workspace-links';

export type Attribution={createdBy?:string;createdAt?:string;updatedBy?:string;updatedAt?:string;hat?:string};
export type RecordLinkType='company'|'brand'|'project'|'contact';
export type RecordLink={type:RecordLinkType;id:string};
export type NoteRevision={title?:string;text:string;editedBy:string;editedAt:string};
export type Note=Attribution&{id:string;title?:string;text:string;pinned:boolean;confidential?:boolean;locked?:boolean;passcodeHash?:string;links:RecordLink[];edits?:NoteRevision[]};
export type Person={id:string;name:string;email:string;hats?:string[]};
export type TaskStatus={name:string;category:'todo'|'active'|'done'};
export type ContactType={id:string;name:string};
export const defaultContactTypes=():ContactType[]=>['Client','Agency','Supplier','Partner'].map((name,i)=>({id:`contact-type-${i+1}`,name}));
export type Contact=Attribution&{id:string;companyId:string;brandId:string;name:string;title:string;email:string;phone:string;typeId?:string;warmth?:string;owner:string};
export type Touchpoint=Attribution&{id:string;companyId:string;contactId:string;opportunityId:string;projectId:string;channel:string;summary:string;owner:string;nextAction:string;followup:string;done:boolean;followupTaskId?:string};
export const defaultStatuses=():TaskStatus[]=>[{name:'To do',category:'todo'},{name:'In progress',category:'active'},{name:'Done',category:'done'}];
export type Company=Attribution&{id:string;name:string;contact:string};
export type Brand=Attribution&{id:string;companyId:string;name:string;warmth?:string};
export type StageChange={from:string;to:string;at:string;by:string};
export type TaskReschedule={from:string;to:string;at:string;by:string};
export type ReportKey='pipeline'|'delivery'|'workload'|'followups'|'waiting';
export type SavedReportView={id:string;name:string;report:ReportKey;filters:{from?:string;to?:string;companyId?:string;brandId?:string;projectId?:string;owner?:string;hat?:string};createdAt:string};
export type Project=Attribution&{id:string;companyId:string;brandId:string;name:string;engagement:string;type:string;owner:string;start:string;due:string;status:string;budget?:number;cost?:number;opportunityId?:string;completedAt?:string};
export type Task=Attribution&{id:string;projectId:string;name:string;owner:string;supplierId:string;due:string;originalDue?:string;reschedules?:TaskReschedule[];completedAt?:string;reopenedAt?:string;status:string;dependsOn:string;links?:RecordLink[];sourceNoteId?:string};
export type Waiting=Attribution&{id:string;projectId:string;taskId:string;name:string;party:string;person:string;owner:string;requested:string;due:string;followup:string;impact:string;resolved:boolean;resolution:string;resolvedAt?:string};
export type Approval=Attribution&{id:string;projectId:string;name:string;version:number;reviewer:string;due:string;status:string;note:string;decidedAt:string;documentId?:string;documentVersion?:number;documentUrl?:string};
export type Supplier=Attribution&{id:string;name:string;service:string;contact:string};
export type Opportunity=Attribution&{id:string;companyId:string;brandId:string;name:string;owner:string;value:number;stage:string;nextAction:string;nextActionDate?:string;lostFrom?:string;lostAt?:string;lostReason?:string;retargetDate?:string;stageHistory?:StageChange[]};
export const docTypes=['Brief','Proposal','Contract','Creative','Media Plan','Report','Invoice','Other'] as const;
export const docStatuses=['Draft','For Review','Approved','Superseded'] as const;
export type DocStatus=(typeof docStatuses)[number];
export type DocAudience='internal'|'client-sharing';
export type DocumentRecord=Attribution&{id:string;title:string;url:string;docType:string;owner:string;status:DocStatus;description:string;tags:string[];audience:DocAudience;pinned:boolean;version:number;approvedVersion?:number;approvedUrl?:string;approvedAt?:string;approvedBy?:string;links:DocLink[]};
export const pipelineStages=["New leads","First Pitch and Data Gathering","Discovery","Proposal Sent","Negotiations","Verbal Commit","Contract Signed"] as const;
export const hats=["Sales","Design","Project lead","Account management","Technical","Media operations","General"] as const;
export type AccessMember={email:string;coOwner?:boolean;personId:string;sections:string[];canEdit:boolean;financials:boolean;scopeMode?:'all'|'selected';companyIds?:string[];brandIds?:string[];projectIds?:string[]};
export type ConfidentialNote=Attribution&{id:string;projectId:string;text:string};
export type ProjectTemplate=Attribution&{id:string;name:string;steps:string[];initialStatus:'Planning'|'Bidding';archived:boolean};
export type ReminderPreference={inApp:boolean;email:boolean;dailyDigest:boolean;digestTime:string;timezone:string};
export type DeliveryFailure={id:string;at:string;userId:string;channel:'email';reason:string;reminderCount:number};
export const defaultReminderPreference=():ReminderPreference=>({inApp:true,email:false,dailyDigest:false,digestTime:'08:30',timezone:'Asia/Manila'});
export type State={sampleWorkspace?:true;studioPins?:StudioPin[];meetings?:Meeting[];retrospectives?:RetrospectiveEntry[];contactTypes?:ContactType[];projectTemplates?:ProjectTemplate[];confidentialNotes?:ConfidentialNote[];notes?:Note[];documents?:DocumentRecord[];members?:AccessMember[];readReminders?:Record<string,string[]>;pinnedPriorities?:Record<string,string[]>;reminderPrefs?:Record<string,ReminderPreference>;deliveryFailures?:DeliveryFailure[];savedReportViews?:Record<string,SavedReportView[]>;people:Person[];taskStatuses:TaskStatus[];contacts:Contact[];touchpoints:Touchpoint[];opportunities:Opportunity[];companies:Company[];brands:Brand[];projects:Project[];tasks:Task[];waiting:Waiting[];approvals:Approval[];suppliers:Supplier[];activity:{id:string;at:string;text:string;actor?:string;actorId?:string;owner?:string;section?:string;hat?:string}[]};
export const blank=():State=>({contactTypes:defaultContactTypes(),projectTemplates:defaultProjectTemplates(),notes:[],documents:[],pinnedPriorities:{},reminderPrefs:{},deliveryFailures:[],savedReportViews:{},people:[],taskStatuses:defaultStatuses(),contacts:[],touchpoints:[],opportunities:[],companies:[],brands:[],projects:[],tasks:[],waiting:[],approvals:[],suppliers:[],activity:[]});
export const types=['Happy WiFi advertising','Internet connectivity','Paid media'];
export const templates:Record<string,string[]>={
 'Happy WiFi advertising':['Confirm campaign brief','Collect creative assets','Obtain client approval','Configure portal placement','QA placement and tracking','Launch campaign','Deliver performance report'],
 'Internet connectivity':['Confirm site requirements','Obtain supplier feasibility and quote','Prepare and submit bid','Record award decision','Schedule site deployment','Complete installation and testing','Obtain client acceptance'],
 'Paid media':['Confirm brief and budget','Obtain platform access','Validate conversion tracking','Approve creative assets','Launch campaigns','Optimize performance','Deliver performance report']
};
export const defaultProjectTemplates=():ProjectTemplate[]=>types.map((name,i)=>({id:`template-${i+1}`,name,steps:[...templates[name]],initialStatus:i===1?'Bidding':'Planning',archived:false}));
export const day=(offset=0)=>{const now=new Date();const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const get=(k:string)=>parts.find(x=>x.type===k)!.value;const d=new Date(`${get('year')}-${get('month')}-${get('day')}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10)};
export function sample():State {
 const s=blank();
 s.sampleWorkspace=true;
 s.people=[
  {id:'m1',name:'Maya Santos',email:'maya@studio.example.test',hats:['Account management','Sales','Project lead']},
  {id:'m2',name:'Carlo Mendoza',email:'carlo@studio.example.test',hats:['Project lead','Technical','Sales']},
  {id:'m3',name:'Bea Villanueva',email:'bea@studio.example.test',hats:['Media operations','Design']},
  {id:'m4',name:'Rico Alvarez',email:'rico@studio.example.test',hats:['Sales','Account management']}
 ];
 s.companies=[
  {id:'c1',name:'Solana Consumer Group',contact:'Patricia Lim, VP Marketing',createdBy:'Maya Santos',createdAt:`${day(-30)}T09:00:00.000Z`},
  {id:'c2',name:'Lumina Retail Corp.',contact:'Marco Tan, Head of Procurement',createdBy:'Carlo Mendoza',createdAt:`${day(-25)}T09:00:00.000Z`},
  {id:'c3',name:'Verve Wellness PH',contact:'Elena Cruz, Brand Director',createdBy:'Rico Alvarez',createdAt:`${day(-22)}T09:00:00.000Z`}
 ];
 s.brands=[
  {id:'b1',companyId:'c1',name:'Kape Solana'},
  {id:'b2',companyId:'c1',name:'Solana Oat'},
  {id:'b3',companyId:'c1',name:'Solana Pantry'},
  {id:'b4',companyId:'c2',name:'Lumina Home'},
  {id:'b5',companyId:'c3',name:'Verve Botanicals'}
 ];
 s.suppliers=[
  {id:'s1',name:'Kinetix WiFi Labs',service:'Happy WiFi deployment',contact:'Jules Navarro'},
  {id:'s2',name:'FiberGrid Solutions PH',service:'Enterprise fiber & connectivity',contact:'Paolo Bautista'},
  {id:'s3',name:'PulseCraft Media Desk',service:'Paid social & programmatic ops',contact:'Trixie Soriano'}
 ];
 s.opportunities=[
  {id:'o1',companyId:'c1',brandId:'',name:'Solana Q4 Multi-Brand Media Retainer',owner:'Maya Santos',hat:'Sales',value:540000,stage:'Won',nextAction:'Coordinate brand delivery plans',nextActionDate:day(2),createdBy:'Maya Santos',createdAt:`${day(-18)}T09:00:00.000Z`,stageHistory:[{from:'New leads',to:'Proposal Sent',at:`${day(-12)}T09:00:00.000Z`,by:'Maya Santos'},{from:'Proposal Sent',to:'Contract Signed',at:`${day(-4)}T09:00:00.000Z`,by:'Maya Santos'}]},
  {id:'o2',companyId:'c2',brandId:'',name:'Lumina Flagship Fiber Connectivity Tender',owner:'Carlo Mendoza',hat:'Sales',value:300000,stage:'Bidding',nextAction:'Submit FiberGrid feasibility & quote',nextActionDate:day(1),createdBy:'Carlo Mendoza',createdAt:`${day(-12)}T09:00:00.000Z`,stageHistory:[{from:'New leads',to:'First Pitch and Data Gathering',at:`${day(-5)}T09:00:00.000Z`,by:'Carlo Mendoza'}]},
  {id:'o3',companyId:'c3',brandId:'b5',name:'Verve Botanicals — Summer Launch Campaign',owner:'Rico Alvarez',hat:'Sales',value:215000,stage:'Proposal Sent',nextAction:'Walk Elena through revised media mix',nextActionDate:day(2),createdBy:'Rico Alvarez',createdAt:`${day(-21)}T09:00:00.000Z`,stageHistory:[{from:'New leads',to:'Discovery',at:`${day(-18)}T09:00:00.000Z`,by:'Rico Alvarez'},{from:'Discovery',to:'Proposal Sent',at:`${day(-16)}T09:00:00.000Z`,by:'Rico Alvarez'}]},
  {id:'o4',companyId:'c2',brandId:'b4',name:'Lumina Home — In-Store WiFi Activation',owner:'Rico Alvarez',hat:'Sales',value:160000,stage:'Discovery',nextAction:'',createdBy:'Rico Alvarez',createdAt:`${day(-6)}T09:00:00.000Z`,stageHistory:[{from:'New leads',to:'Discovery',at:`${day(-4)}T09:00:00.000Z`,by:'Rico Alvarez'}]},
  {id:'o5',companyId:'c1',brandId:'b3',name:'Solana Pantry — Summer Sampling Pop-Up',owner:'Maya Santos',hat:'Sales',value:145000,stage:'Lost',nextAction:'Re-pitch for Q1 grocery push',lostFrom:'Negotiations',lostAt:`${day(-9)}T10:00:00.000Z`,lostReason:'Client shifted Q3 promo budget to holiday gift boxes',retargetDate:day(14),createdBy:'Maya Santos',createdAt:`${day(-28)}T09:00:00.000Z`,stageHistory:[{from:'New leads',to:'Negotiations',at:`${day(-18)}T09:00:00.000Z`,by:'Maya Santos'},{from:'Negotiations',to:'Lost',at:`${day(-9)}T10:00:00.000Z`,by:'Maya Santos'}]}
 ];
 s.projects=[
  {id:'p1',companyId:'c1',brandId:'b1',name:'Kape Solana — Happy WiFi Launch',engagement:'Solana Q4 multi-brand engagement',type:types[0],owner:'Maya Santos',hat:'Account management',start:day(-8),due:day(12),status:'In progress',budget:180000,cost:105000,opportunityId:'o1',createdBy:'Maya Santos',createdAt:`${day(-8)}T09:00:00.000Z`},
  {id:'p2',companyId:'c1',brandId:'b2',name:'Solana Oat — Always-On Paid Media',engagement:'Solana Q4 multi-brand engagement',type:types[2],owner:'Bea Villanueva',hat:'Media operations',start:day(-3),due:day(25),status:'In progress',budget:240000,cost:165000,createdBy:'Maya Santos',createdAt:`${day(-3)}T09:00:00.000Z`},
  {id:'p3',companyId:'c1',brandId:'b3',name:'Solana Pantry — Holiday Gift Box Push',engagement:'Solana Q4 multi-brand engagement',type:types[2],owner:'Maya Santos',hat:'Project lead',start:day(5),due:day(35),status:'Planning',budget:120000,cost:70000,createdBy:'Maya Santos',createdAt:`${day(-2)}T09:00:00.000Z`},
  {id:'p4',companyId:'c2',brandId:'',name:'Lumina Retail — Store Fiber Bid',engagement:'Nationwide store internet bid',type:types[1],owner:'Carlo Mendoza',hat:'Project lead',start:day(-10),due:day(8),status:'Bidding',budget:300000,cost:210000,createdBy:'Carlo Mendoza',createdAt:`${day(-10)}T09:00:00.000Z`}
 ];
 s.tasks=[
  {id:'t1',projectId:'p1',name:'Confirm Kape Solana campaign brief',owner:'Maya Santos',hat:'Account management',supplierId:'',due:day(-5),status:'Done',dependsOn:'',completedAt:`${day(-5)}T15:00:00.000Z`,createdBy:'Maya Santos'},
  {id:'t2',projectId:'p1',name:'Approve Kape Solana portal banner creative',owner:'Maya Santos',hat:'Design',supplierId:'',due:day(1),status:'In progress',dependsOn:'t1',createdBy:'Maya Santos'},
  {id:'t3',projectId:'p1',name:'Configure Happy WiFi portal placement',owner:'Carlo Mendoza',hat:'Technical',supplierId:'s1',due:day(5),status:'To do',dependsOn:'t2',createdBy:'Carlo Mendoza'},
  {id:'t4',projectId:'p2',name:'Validate Solana Oat conversion tracking',owner:'Bea Villanueva',hat:'Media operations',supplierId:'s3',due:day(0),status:'In progress',dependsOn:'',createdBy:'Bea Villanueva'},
  {id:'t5',projectId:'p4',name:'Obtain FiberGrid site feasibility & quote',owner:'Carlo Mendoza',hat:'Project lead',supplierId:'s2',due:day(-1),status:'In progress',dependsOn:'',createdBy:'Carlo Mendoza'},
  {id:'t6',projectId:'p3',name:'Confirm Solana Pantry holiday creative brief',owner:'Maya Santos',hat:'Account management',supplierId:'',due:day(7),status:'To do',dependsOn:'',createdBy:'Maya Santos'},
  {id:'t7',projectId:'p2',name:'Finalize Solana Oat Q4 lookalike audiences',owner:'Bea Villanueva',hat:'Media operations',supplierId:'',due:day(2),status:'To do',dependsOn:'t4',createdBy:'Bea Villanueva'}
 ];
 s.waiting=[
  {id:'w1',projectId:'p1',taskId:'t2',name:'Portal banner creative sign-off',party:'Client',person:'Patricia Lim (Kape Solana)',owner:'Maya Santos',hat:'Account management',requested:day(-3),due:day(1),followup:day(),impact:'Kinetix portal setup cannot begin until creative is approved.',resolved:false,resolution:''},
  {id:'w2',projectId:'p4',taskId:'t5',name:'Site feasibility & fiber quotation',party:'Supplier',person:'Paolo Bautista (FiberGrid Solutions PH)',owner:'Carlo Mendoza',hat:'Project lead',requested:day(-6),due:day(-1),followup:day(),impact:'Required to finalize Lumina store bid pricing.',resolved:false,resolution:''},
  {id:'w3',projectId:'p2',taskId:'t4',name:'Meta ad account & pixel access',party:'Client',person:'Daryl Ong (Solana Oat)',owner:'Bea Villanueva',hat:'Media operations',requested:day(-2),due:day(2),followup:day(1),impact:'Conversion tracking cannot be validated before launch.',resolved:false,resolution:''}
 ];
 s.approvals=[
  {id:'a1',projectId:'p1',name:'Kape Solana Portal Creative Concept',version:1,reviewer:'Patricia Lim',due:day(1),status:'Pending',note:'Awaiting review of the holiday roast portal banner concept.',decidedAt:''},
  {id:'a2',projectId:'p2',name:'Solana Oat Media Plan & Channel Mix',version:1,reviewer:'Daryl Ong',due:day(3),status:'Pending',note:'Meta, TikTok, and Google Search Q4 allocation.',decidedAt:''}
 ];
 s.contacts=[
  {id:'ct1',companyId:'c1',brandId:'b1',name:'Patricia Lim',title:'VP Marketing',email:'patricia.lim@solana.example.test',phone:'Viber / 555-0142',typeId:'contact-type-1',owner:'Maya Santos',hat:'Account management',createdBy:'Maya Santos'},
  {id:'ct2',companyId:'c2',brandId:'',name:'Marco Tan',title:'Head of Procurement',email:'marco.tan@lumina.example.test',phone:'Viber / 555-0198',typeId:'contact-type-1',owner:'Carlo Mendoza',hat:'Project lead',createdBy:'Carlo Mendoza'},
  {id:'ct3',companyId:'c1',brandId:'b2',name:'Daryl Ong',title:'Digital Marketing Lead',email:'daryl.ong@solana.example.test',phone:'Viber / 555-0165',typeId:'contact-type-1',owner:'Bea Villanueva',hat:'Media operations',createdBy:'Bea Villanueva'},
  {id:'ct4',companyId:'c3',brandId:'b5',name:'Elena Cruz',title:'Brand Director',email:'elena.cruz@verve.example.test',phone:'Viber / 555-0211',typeId:'contact-type-1',owner:'Rico Alvarez',hat:'Sales',createdBy:'Rico Alvarez'}
 ];
 s.touchpoints=[
  {id:'tp1',companyId:'c1',contactId:'ct1',opportunityId:'o1',projectId:'p1',channel:'Meeting',summary:'Kickoff call with Patricia: confirmed Kape Solana mall list and launch dates.',owner:'Maya Santos',hat:'Account management',nextAction:'Follow up on portal banner sign-off',followup:day(0),done:false,createdBy:'Maya Santos',createdAt:`${day(-1)}T10:30:00.000Z`},
  {id:'tp2',companyId:'c1',contactId:'ct3',opportunityId:'',projectId:'p2',channel:'Viber',summary:'Sent Solana Oat pixel setup instructions to Daryl.',owner:'Bea Villanueva',hat:'Media operations',nextAction:'Confirm Meta Business Manager access',followup:day(1),done:false,createdBy:'Bea Villanueva',createdAt:`${day(-11)}T14:00:00.000Z`},
  {id:'tp3',companyId:'c3',contactId:'ct4',opportunityId:'o3',projectId:'',channel:'Email',summary:'Sent Verve Botanicals Summer Launch proposal deck and media budget.',owner:'Rico Alvarez',hat:'Sales',nextAction:'Call Elena to review media mix feedback',followup:day(-1),done:false,createdBy:'Rico Alvarez',createdAt:`${day(-26)}T11:15:00.000Z`},
  {id:'tp4',companyId:'c2',contactId:'ct2',opportunityId:'o2',projectId:'p4',channel:'Phone',summary:'Confirmed 18 flagship store locations for fiber bid with Marco.',owner:'Carlo Mendoza',hat:'Project lead',nextAction:'Share FiberGrid quote once received',followup:day(2),done:false,createdBy:'Carlo Mendoza',createdAt:`${day(-4)}T16:00:00.000Z`}
 ];
 s.documents=[
  {id:'d1',title:'Kape Solana Q4 Creative Brief',url:'https://files.example.test/kape-solana-brief-v1',docType:'Brief',owner:'Maya Santos',hat:'Account management',status:'For Review',description:'Master brief covering mall Happy WiFi screens, copy, and launch dates.',tags:['brief','q4'],audience:'client-sharing',pinned:true,version:1,links:[{type:'company',id:'c1'},{type:'brand',id:'b1'},{type:'project',id:'p1'}],createdBy:'Maya Santos',createdAt:`${day(-6)}T09:00:00.000Z`,updatedBy:'Maya Santos',updatedAt:`${day(-6)}T09:00:00.000Z`},
  {id:'d2',title:'Solana Q4 Multi-Brand Rate Card',url:'https://files.example.test/solana-rate-card',docType:'Proposal',owner:'Rico Alvarez',hat:'Sales',status:'Approved',description:'Internal pricing & margin breakdown for the Q4 retainer.',tags:['pricing','retainer'],audience:'internal',pinned:false,version:1,approvedVersion:1,approvedUrl:'https://files.example.test/solana-rate-card',approvedAt:`${day(-5)}T11:00:00.000Z`,approvedBy:'Maya Santos',links:[{type:'company',id:'c1'},{type:'opportunity',id:'o1'}],createdBy:'Rico Alvarez',createdAt:`${day(-10)}T09:00:00.000Z`,updatedBy:'Maya Santos',updatedAt:`${day(-5)}T11:00:00.000Z`}
 ];
 s.notes=[
  {id:'n1',title:'Patricia’s Creative Preferences',text:'Prefers warm editorial typography and quick Viber previews before formal email sign-off.',pinned:true,confidential:false,links:[{type:'company',id:'c1'},{type:'brand',id:'b1'},{type:'contact',id:'ct1'}],edits:[],createdBy:'Maya Santos',createdAt:`${day(-5)}T10:00:00.000Z`,updatedBy:'Maya Santos',updatedAt:`${day(-5)}T10:00:00.000Z`},
  {id:'n2',title:'Lumina Store Rollout Checklist',text:'Confirm building admin permits for all 18 flagship locations before scheduling FiberGrid engineers.',pinned:false,confidential:false,links:[{type:'company',id:'c2'},{type:'project',id:'p4'}],edits:[],createdBy:'Carlo Mendoza',createdAt:`${day(-4)}T13:30:00.000Z`,updatedBy:'Carlo Mendoza',updatedAt:`${day(-4)}T13:30:00.000Z`}
 ];
 s.studioPins=defaultStudioPins(day());
 s.meetings=defaultSampleMeetings(day());
 s.activity=[{id:'seed',at:new Date().toISOString(),actor:'Sample data',owner:'Maya Santos',text:'Training sample workspace loaded with Solana Consumer Group, Lumina Retail Corp., and Verve Wellness PH.'}];
 return normalize(s);
}
export type ViewRole='Owner'|'Team'|'Client'|'Supplier';
export function visibleState(s:State,role:ViewRole,scope:string):State {
 const out:State=normalize(JSON.parse(JSON.stringify(s))); if(role==='Owner')return out;out.studioPins=[];out.meetings=[];out.retrospectives=[];out.confidentialNotes=[];out.members=[];out.readReminders={};out.pinnedPriorities={};out.reminderPrefs={};out.deliveryFailures=[];out.savedReportViews={};out.opportunities=[];out.contacts=[];out.touchpoints=[];out.people=out.people.map(p=>({...p,email:''}));out.activity=[];
 if(role==='Client') {out.projects=out.projects.filter(p=>p.companyId===scope);out.suppliers=[];out.waiting=out.waiting.filter(w=>w.party==='Client');out.tasks=[];out.notes=[];out.activity=[];}
 if(role==='Supplier') {out.tasks=out.tasks.filter(t=>t.supplierId===scope);const ids=new Set(out.tasks.map(t=>t.projectId).filter(Boolean));out.projects=out.projects.filter(p=>ids.has(p.id));out.suppliers=out.suppliers.filter(x=>x.id===scope);out.waiting=[];out.approvals=[];out.notes=[];out.documents=[];out.activity=[];}
 const ids=new Set(out.projects.map(p=>p.id));out.tasks=out.tasks.filter(t=>t.projectId?ids.has(t.projectId):role==='Team'&&taskLinks(t).every(l=>l.type==='project'?ids.has(l.id):l.type==='company'?out.companies.some(c=>c.id===l.id):l.type==='brand'?out.brands.some(b=>b.id===l.id):false));out.waiting=out.waiting.filter(w=>ids.has(w.projectId));out.approvals=out.approvals.filter(a=>ids.has(a.projectId));out.companies=out.companies.filter(c=>out.projects.some(p=>p.companyId===c.id));out.brands=out.brands.filter(b=>out.projects.some(p=>p.brandId===b.id));
 {const cids=new Set(out.companies.map(c=>c.id)),bids=new Set(out.brands.map(b=>b.id));
  if(role==='Team'){out.notes=(out.notes||[]).filter(n=>!n.confidential&&n.links.length>0&&n.links.every(l=>l.type==='project'?ids.has(l.id):l.type==='company'?cids.has(l.id):l.type==='brand'?bids.has(l.id):false));const noteIds=new Set(out.notes.map(n=>n.id));for(const t of out.tasks)if(t.sourceNoteId&&!noteIds.has(t.sourceNoteId))delete t.sourceNoteId;}
  if(role==='Client'){out.documents=(out.documents||[]).filter(d=>d.audience==='client-sharing'&&d.links.length>0&&d.links.every(l=>l.type==='project'?ids.has(l.id):l.type==='company'?l.id===scope:l.type==='brand'?bids.has(l.id):false));}
  else if(role==='Team'){out.documents=(out.documents||[]).filter(d=>d.links.length>0&&d.links.every(l=>l.type==='project'?ids.has(l.id):l.type==='company'?cids.has(l.id):l.type==='brand'?bids.has(l.id):false));}
 }
 out.projects=out.projects.map(({budget,cost,...p})=>p);return out;
}

export function normalize(s:State):State {
 if(s.activity?.some(event=>event.id==='seed'&&event.actor==='Sample data'))s.sampleWorkspace=true;
 s.studioPins ??= s.sampleWorkspace?defaultStudioPins(day()):[];
 s.meetings ??= s.sampleWorkspace?defaultSampleMeetings(day()):[];
 s.retrospectives ??= [];
 s.contactTypes ??= defaultContactTypes();for(const b of s.brands)b.warmth||='Unrated';s.projectTemplates ??= defaultProjectTemplates();s.members ||= [];s.readReminders ||= {};s.pinnedPriorities ||= {};s.reminderPrefs ||= {};s.deliveryFailures ||= [];s.savedReportViews ||= {};s.confidentialNotes ||= [];s.notes ||= [];s.documents ||= [];
 s.opportunities ||= [];s.contacts ||= [];s.touchpoints ||= [];s.people ||= [];s.taskStatuses ||= defaultStatuses();
 const stages:Record<string,string>={New:'New leads',Proposal:'Proposal Sent',Bidding:'First Pitch and Data Gathering',Negotiating:'Negotiations',Won:'Contract Signed'};
 for(const o of s.opportunities){if(stages[o.stage])o.stage=stages[o.stage];o.hat||='Sales'}
 for(const c of s.contacts){c.warmth||='Unrated';c.hat||='Account management'}
 for(const p of s.projects)p.hat||='Project lead';
 for(const t of s.tasks){
  t.hat||='General';
  if(t.links?.length){const synced=syncTaskLinks(t.projectId||'',t.links);t.projectId=synced.projectId;t.links=synced.links}
 }
 for(const n of s.notes){n.pinned=Boolean(n.pinned);n.confidential=Boolean(n.confidential);n.locked=Boolean(n.locked||n.passcodeHash);n.links=dedupeLinks(n.links);n.edits||=[];}
 for(const d of s.documents){d.pinned=Boolean(d.pinned);d.version=Math.max(1,Number(d.version||1));d.audience=d.audience==='client-sharing'?'client-sharing':'internal';d.tags=Array.isArray(d.tags)?d.tags.filter(Boolean):[];d.links=dedupeDocLinks(d.links);d.hat||='General';}
 for(const t of s.touchpoints)t.hat||='Sales';
 for(const w of s.waiting)w.hat||='Project lead';
 const assigned=[...s.projects,...s.tasks,...s.waiting,...s.opportunities,...s.contacts,...s.touchpoints,...s.documents].map(x=>x.owner).filter(Boolean);
 for(const name of new Set(assigned))if(!s.people.some(p=>p.name===name))s.people.push({id:`legacy-${s.people.length}`,name,email:''});
 return s;
}
export function category(s:State,status:string){return s.taskStatuses.find(x=>x.name===status)?.category||'todo'}

export function dealMissingNextAction(s:State,o:Opportunity){if(o.stage==='Lost'||o.stage==='Contract Signed')return{missingAction:false,missingDate:false,needsAttention:false};const openTouches=s.touchpoints.filter(t=>!t.done&&t.opportunityId===o.id);const hasAction=Boolean(o.nextAction?.trim())||openTouches.some(t=>Boolean(t.nextAction?.trim()));const hasDate=Boolean(o.nextActionDate?.trim())||openTouches.some(t=>Boolean(t.followup?.trim()));return{missingAction:!hasAction,missingDate:!hasDate,needsAttention:!hasAction||!hasDate}}

export type Reminder={id:string;kind:'task'|'touchpoint'|'waiting'|'handoff'|'retarget';title:string;owner:string;due:string;section:string;recordId:string;projectId?:string;opportunityId?:string;hat?:string};
export function reminders(s:State,on=day()):Reminder[]{
 const taskIds=new Set(s.tasks.map(t=>t.id));
 const raw:Reminder[]=[
  ...s.tasks.filter(t=>category(s,t.status)!=='done').map(t=>({id:`task:${t.id}:${t.due}`,kind:'task' as const,title:t.name,owner:t.owner,due:t.due,section:primarySectionForTask(t),recordId:t.id,projectId:t.projectId||undefined,hat:t.hat})),
  ...s.touchpoints.filter(t=>!t.done&&!(t.followupTaskId&&taskIds.has(t.followupTaskId))).map(t=>({id:`touch:${t.id}:${t.followup}`,kind:'touchpoint' as const,title:t.nextAction,owner:t.owner,due:t.followup,section:'Touchpoints',recordId:t.id,hat:t.hat})),
  ...s.waiting.filter(w=>!w.resolved&&(w.followup<=on||(w.due&&w.due<on))).map(w=>{const overdue=Boolean(w.due&&w.due<on);const effectiveDue=overdue&&(!w.followup||w.due<w.followup)?w.due:(w.followup||w.due);return {id:`wait:${w.id}:${effectiveDue}`,kind:'waiting' as const,title:overdue?`Overdue waiting item — chase ${w.person} (${w.party}): ${w.name}`:`Follow up: ${w.name}`,owner:w.owner,due:effectiveDue,section:'Waiting on',recordId:w.id,projectId:w.projectId,hat:w.hat}}),
  ...s.opportunities.filter(o=>o.stage==='Contract Signed'&&!s.projects.some(p=>p.opportunityId===o.id)).map(o=>({id:`handoff:${o.id}`,kind:'handoff' as const,title:`Create project for signed contract: ${o.name}`,owner:o.owner,due:o.updatedAt?.slice(0,10)||on,section:'CRM Pipeline',recordId:o.id,opportunityId:o.id,hat:o.hat||'Sales'})),
  ...s.opportunities.filter(o=>o.stage==='Lost'&&Boolean(o.retargetDate)).map(o=>({id:`retarget:${o.id}:${o.retargetDate}`,kind:'retarget' as const,title:`Retarget lost deal: ${o.name}`,owner:o.owner,due:o.retargetDate!,section:'CRM Pipeline',recordId:o.id,opportunityId:o.id,hat:o.hat||'Sales'}))
 ].filter(r=>r.due&&r.due<=on);
 return Array.from(new Map(raw.map(r=>[r.id,r])).values()).sort((a,b)=>a.due.localeCompare(b.due));
}
