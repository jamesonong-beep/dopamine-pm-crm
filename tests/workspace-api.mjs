import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'workspace-api-'));
const sqlite=new DatabaseSync(':memory:');
sqlite.exec('CREATE TABLE workspaces (owner TEXT PRIMARY KEY,revision INTEGER NOT NULL DEFAULT 0,data TEXT NOT NULL)');
sqlite.exec(await readFile('drizzle/0001_useful_outlaw_kid.sql','utf8'));
globalThis.__workspaceTestDB={prepare(sql){let args=[];return{_sql:sql,get _args(){return args},bind(...v){args=v;return this},async run(){const r=sqlite.prepare(sql).run(...args);return{meta:{changes:r.changes}}},async first(){return sqlite.prepare(sql).get(...args)||null},async all(){return{results:sqlite.prepare(sql).all(...args)}}}}};
globalThis.__workspaceTestDB.batch=async stmts=>{sqlite.exec('BEGIN');try{const results=[];for(const st of stmts)results.push(await st.run());sqlite.exec('COMMIT');return results}catch(e){sqlite.exec('ROLLBACK');throw e}};
await build({entryPoints:['app/api/workspace/route.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'route.mjs'),plugins:[{name:'test-db',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'db',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const env={DB:globalThis.__workspaceTestDB,PILOT_OWNER_EMAIL:"owner@example.test",PILOT_COOWNER_EMAIL:"pilot-start@example.test"};',loader:'js'}))}}]});
const api=await import(join(dir,'route.mjs'));
await build({entryPoints:['app/api/recovery/route.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'recovery.mjs'),plugins:[{name:'test-db',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'db',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const env={DB:globalThis.__workspaceTestDB,PILOT_OWNER_EMAIL:"owner@example.test",PILOT_COOWNER_EMAIL:"pilot-start@example.test"};',loader:'js'}))}}]});
const recovery=await import(join(dir,'recovery.mjs'));
const owner={id:'owner-test',email:'owner@example.test',name:'Owner Test'};
const member={id:'member-test',email:'member@example.test',name:'Member Test'};
const req=(u,method='GET',body)=>new Request('https://workspace.example.test/api/workspace',{method,headers:{origin:'https://workspace.example.test','Content-Type':'application/json',...(u?{'oai-authenticated-user-id':u.id,'oai-authenticated-user-email':u.email,'oai-authenticated-user-full-name':u.name}:{})},body:body?JSON.stringify(body):undefined});
const get=async(u)=>{const r=await api.GET(req(u));assert.equal(r.status,200);return r.json()};
const pilotStart={id:'pilot-start',email:'pilot-start@example.test',name:'Justine'};
assert.equal((await api.GET(req(pilotStart))).status,403,'the co-owner cannot create a separate workspace');
let current=await get(owner);
assert.equal((await get(pilotStart)).session.isOwner,true,'configured co-owner joins the primary workspace after initialization');
assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM workspaces').get().count,1);
assert.equal(current.state.sampleWorkspace,undefined,'new real workspaces have no demo marker');
async function act(u,action,values,status=200){const before=await get(u);const r=await api.POST(req(u,'POST',{action,values,revision:before.revision}));const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));if(r.ok)current=j;return j}
assert.equal((await api.GET(req(null))).status,401);
await act(owner,'sample',{});
assert.equal(current.state.sampleWorkspace,true,'explicit sample load marks the workspace as a demo');
assert.equal(current.state.opportunities.find(o=>o.id==='o1').stage,'Contract Signed');
assert.equal(current.state.opportunities.find(o=>o.id==='o2').stage,'First Pitch and Data Gathering');
const stages=['New leads','First Pitch and Data Gathering','Discovery','Proposal Sent','Negotiations','Verbal Commit','Contract Signed'];
for(const stage of stages){await act(owner,'dealStage',{id:'o2',stage});await act(owner,'dealLost',{id:'o2',reason:'QA declined'});assert.equal(current.state.opportunities.find(o=>o.id==='o2').lostFrom,stage);assert.equal(current.state.opportunities.find(o=>o.id==='o2').stage,'Lost');}
await act(owner,'dealStage',{id:'o2',stage:'Discovery'});
assert(current.state.activity.some(a=>a.text.includes('Reopened')));
await act(owner,'warmth',{id:'ct1',warmth:'Hot'});assert.equal(current.state.contacts[0].warmth,'Hot');
await act(owner,'taskEdit',{id:'t1',owner:'Owner Test',supplierId:'',due:'2026-01-01',hat:'Design'});assert.equal(current.state.tasks[0].hat,'Design');
await act(owner,'touchpoint',{companyId:'c1',contactId:'ct1',opportunityId:'o1',projectId:'p1',channel:'Email',summary:'Reminder test',owner:'Owner Test',hat:'Sales',nextAction:'Follow up',followup:'2026-01-01'});
const touch=current.state.touchpoints.at(-1);const reminder=`touch:${touch.id}:2026-01-01`;
await act(owner,'reminderRead',{id:reminder});assert(current.state.readReminders[owner.id].includes(reminder));assert(!current.state.touchpoints.at(-1).done);
await act(owner,'touchReschedule',{id:touch.id,followup:'2026-01-02'});await act(owner,'reminderRead',{id:reminder},400);
await act(owner,'person',{name:'Member Test',email:member.email,hats:'Sales, Design'});const person=current.state.people.at(-1);
await act(owner,'member',{personId:person.id,sections:['My Day','Notifications','Projects','Task statuses'],canEdit:true,financials:false,scopeMode:'all'});
let view=await get(member);assert.equal(view.session.isOwner,false);assert.equal(view.session.person,'Member Test');assert(view.state.projects.every(p=>!('budget'in p)&&!('cost'in p)));assert.equal(view.state.contacts.length,0);assert.equal(view.state.opportunities.length,0);assert.equal(view.state.activity.length,0);assert.equal(view.state.members.length,0);assert(view.state.people.every(p=>p.email===''));assert.equal(view.state.suppliers.length,0);
await act(member,'person',{name:'Escalation',email:''},403);
await act(member,'member',{personId:person.id,sections:['CRM Pipeline'],canEdit:true,financials:true,scopeMode:'all'},403);
await act(member,'dealStage',{id:'o2',stage:'Contract Signed'},403);
await act(member,'statusSave',{oldName:'',name:'Injected',category:'done'},403);
await act(member,'reminderRead',{id:`touch:${touch.id}:2026-01-02`},400);
await act(member,'taskEdit',{id:'t1',owner:'Member Test',supplierId:'',due:'2026-01-03',hat:'Design'});assert.equal(current.state.tasks[0].owner,'Member Test');assert(current.state.projects.every(p=>!('cost'in p)));
await act(owner,'member',{personId:person.id,sections:['Projects'],canEdit:false,financials:false,scopeMode:'all'});await act(member,'taskEdit',{id:'t1',owner:'Member Test',supplierId:'',due:'2026-01-04'},403);
await act(owner,'memberRemove',{personId:person.id});assert.equal((await api.GET(req(member))).status,403,'revoked membership must never return former shared records');
await act(owner,'member',{personId:person.id,sections:['Projects'],canEdit:false,financials:false,scopeMode:'all'});assert.equal((await get(member)).session.isOwner,false,'restored membership works');
const stale=await api.POST(req(owner,'POST',{action:'company',values:{name:'stale',contact:''},revision:-1}));assert.equal(stale.status,409);
const cross=new Request('https://workspace.example.test/api/workspace',{method:'POST',headers:{origin:'https://attacker.example','oai-authenticated-user-id':owner.id},body:'{}'});assert.equal((await api.POST(cross)).status,403);

// Scope boundaries apply to both reads and writes, including guessed IDs.
await act(owner,'confidentialNote',{projectId:'p1',text:'Owner-only pricing strategy'});
await act(owner,'member',{personId:person.id,sections:['Projects','CRM Pipeline','Contacts','Touchpoints','Companies & brands','Suppliers','Activity'],canEdit:true,financials:true,scopeMode:'selected',projectIds:['p1'],brandIds:['b1'],companyIds:[]});
view=await get(member);assert.deepEqual(view.state.projects.map(p=>p.id),['p1']);assert.deepEqual(view.state.contacts.map(p=>p.id),['ct1']);assert.equal(view.state.opportunities.length,0,'company-wide deal must not leak through a brand grant');assert.equal(view.state.confidentialNotes.length,0);assert.equal(view.state.activity.length,0);assert(!JSON.stringify(view).includes('Owner-only pricing'));
await act(member,'taskEdit',{id:'t4',owner:'Member Test',supplierId:'',due:'2026-01-05'},403);
await act(member,'task',{projectId:'p1',name:'Denied cross-project dependency',owner:'Member Test',supplierId:'',dependsOn:'t4',due:'2026-01-05'},403);
await act(member,'touchpoint',{companyId:'c1',contactId:'ct1',opportunityId:'o1',projectId:'p1',channel:'Email',summary:'Denied',owner:'Member Test',nextAction:'Denied',followup:'2026-01-05'},403);
await act(member,'confidentialNote',{projectId:'p1',text:'Attempt'},403);
await act(member,'taskEdit',{id:'t1',owner:'Member Test',supplierId:'',due:'2026-01-05'});
await act(owner,'member',{personId:person.id,sections:['Projects'],canEdit:true,financials:false,scopeMode:'selected',projectIds:[],brandIds:[],companyIds:[]});assert.equal((await get(member)).state.projects.length,0);
const recReq=(u,method='GET',body,query='')=>new Request('https://workspace.example.test/api/recovery'+query,{method,headers:{origin:'https://workspace.example.test','Content-Type':'application/json',...(u?{'oai-authenticated-user-id':u.id,'oai-authenticated-user-email':u.email,'oai-authenticated-user-full-name':u.name}:{})},body:body?JSON.stringify(body):undefined});
async function rec(action,values={},status=200){const rev=(await get(owner)).revision;const r=await recovery.POST(recReq(owner,'POST',{action,revision:rev,...values}));const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j}
assert.equal((await recovery.GET(recReq(null))).status,401);assert.equal((await recovery.GET(recReq(member))).status,403);assert.equal((await recovery.POST(recReq(member,'POST',{action:'backup'}))).status,403);
const saved=await rec('backup');let backup=await (await recovery.GET(recReq(owner,'GET',null,'?format=json'))).json();assert.equal(backup.format,'workspace-backup');assert(!('members'in backup.records));assert(backup.records.confidentialNotes.length);
const preview=await rec('preview',{id:saved.id});assert(preview.counts.projects===4);
await act(owner,'company',{name:'After backup',contact:''});
const staleRestore=await recovery.POST(recReq(owner,'POST',{action:'restore',revision:preview.revision,id:saved.id,checksum:preview.checksum,confirm:'RESTORE WORKSPACE'}));assert.equal(staleRestore.status,409);
let fresh=await rec('preview',{backup});await rec('restore',{backup,checksum:fresh.checksum,confirm:'wrong'},400);
const oldAccess=JSON.stringify((await get(owner)).state.members);
await rec('restore',{backup,checksum:fresh.checksum,confirm:'RESTORE WORKSPACE'});let restored=await get(owner);assert(!restored.state.companies.some(c=>c.name==='After backup'));assert.equal(JSON.stringify(restored.state.members),oldAccess);assert(restored.state.confidentialNotes.length);
let log=await (await recovery.GET(recReq(owner))).json();assert(log.points.some(p=>p.kind==='before-restore'));assert(log.events.some(e=>e.action==='restore'));assert(log.events.some(e=>e.action==='denied-scope'));
const wrong=structuredClone(backup);wrong.workspace='other';await rec('preview',{backup:wrong},400);const corrupt=structuredClone(backup);corrupt.records.projects=[];await rec('preview',{backup:corrupt},400);
sqlite.exec('DELETE FROM request_limits');
// Valid checksum alone cannot allow structurally broken relationships.
const broken=structuredClone(backup);broken.records.tasks[0].projectId='missing';broken.checksum=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(broken.records)))),b=>b.toString(16).padStart(2,'0')).join('');await rec('preview',{backup:broken},400);
await act(owner,'company',{name:'=HYPERLINK("bad")',contact:'@formula'});const exportResponse=await recovery.GET(recReq(owner,'GET',null,'?format=csv&dataset=companies'));assert.equal(exportResponse.status,200);const exported=await exportResponse.text();assert(exported.includes("'=HYPERLINK"));assert(exported.includes("'@formula"));
const eventsBefore=sqlite.prepare('SELECT count(*) AS n FROM security_events').get().n;await act(owner,'clear',{confirm:'CLEAR SAMPLE'});const cleared=await get(owner);assert.equal(cleared.state.projects.length,0);assert.deepEqual(new Set(cleared.state.people.map(person=>person.email)),new Set([owner.email,member.email,pilotStart.email]),'reset retains the primary owner and both configured members');assert(!cleared.state.people.some(p=>p.name==='Account lead'));assert.equal(cleared.state.contacts.length,0);assert.equal(cleared.state.opportunities.length,0);assert.equal(cleared.state.confidentialNotes.length,0);assert.equal(JSON.stringify(cleared.state.members),oldAccess);assert(sqlite.prepare('SELECT count(*) AS n FROM security_events').get().n>eventsBefore);assert(sqlite.prepare("SELECT count(*) AS n FROM recovery_points WHERE kind='before-clear'").get().n>0);
// Template lifecycle, snapshot semantics, permissions, ordering and backup recovery.
sqlite.exec('DELETE FROM request_limits');
await act(owner,'templateSave',{name:'Custom Launch',steps:'Brief\nLaunch',initialStatus:'Planning'});
let tpl=current.state.projectTemplates.at(-1);const tplId=tpl.id;
await act(owner,'company',{name:'Template Test Client',contact:''});const client=current.state.companies.at(-1);
const projectInput={companyId:client.id,brandId:'',name:'First launch',engagement:'Launch',type:tplId,owner:'Owner Test',hat:'Project lead',start:'2026-11-22',due:'2026-12-01',budget:0,cost:0};
await act(owner,'project',projectInput);const built=current.state.projects.at(-1);const originalTasks=current.state.tasks.filter(t=>t.projectId===built.id);
assert.deepEqual(originalTasks.map(t=>t.name),['Brief','Launch']);assert.equal(originalTasks[1].dependsOn,originalTasks[0].id);assert(originalTasks.every(t=>t.createdBy==='Owner Test'));
await act(owner,'templateSave',{id:tplId,name:'Renamed Launch',steps:'Research\nReview\nDeliver',initialStatus:'Bidding'});
assert.equal(current.state.projects.find(p=>p.id===built.id).type,'Custom Launch');assert.deepEqual(current.state.tasks.filter(t=>t.projectId===built.id),originalTasks);
const order=current.state.projectTemplates.map(t=>t.id).reverse();await act(owner,'templateOrder',{ids:order});assert.deepEqual(current.state.projectTemplates.map(t=>t.id),order);
await act(owner,'templateOrder',{ids:[tplId,tplId]},400);
await act(owner,'templateArchive',{id:tplId,archived:true});await act(owner,'project',projectInput,400);assert(!(await get(member)).state.projectTemplates.some(t=>t.id===tplId));
await act(member,'templateArchive',{id:tplId,archived:false},403);await act(member,'templateSave',{name:'Forbidden',steps:'Task',initialStatus:'Planning'},403);await act(member,'templateOrder',{ids:order},403);
await act(owner,'templateArchive',{id:tplId,archived:false});await act(owner,'project',{...projectInput,name:'Second launch'});assert.equal(current.state.projects.at(-1).status,'Bidding');assert.equal(current.state.tasks.filter(t=>t.projectId===current.state.projects.at(-1).id).length,3);
await act(owner,'templateSave',{name:'Empty',steps:'   ',initialStatus:'Planning'},400);
let templateBackup=await (await recovery.GET(recReq(owner,'GET',null,'?format=json'))).json();assert(templateBackup.records.projectTemplates.some(t=>t.id===tplId));
await act(owner,'templateArchive',{id:tplId,archived:true});let templatePreview=await rec('preview',{backup:templateBackup});await rec('restore',{backup:templateBackup,checksum:templatePreview.checksum,confirm:'RESTORE WORKSPACE'});assert.equal((await get(owner)).state.projectTemplates.find(t=>t.id===tplId).archived,false);
console.log('PASS: templates create/edit/archive/restore/reorder; task snapshots and dependencies; member write denial; backup round-trip.');

// Contact type identity survives rename; brand warmth is independent and scoped.
sqlite.exec('DELETE FROM request_limits');
await act(owner,'contactTypeSave',{name:'Decision Maker'});const ctId=current.state.contactTypes.at(-1).id;
await act(owner,'contact',{companyId:client.id,brandId:'',name:'Typed Contact',title:'',email:'',phone:'',owner:'Owner Test',typeId:ctId});const typed=current.state.contacts.at(-1);
await act(owner,'contactTypeSave',{id:ctId,name:'Decision Owner'});assert.equal(current.state.contacts.find(c=>c.id===typed.id).typeId,ctId);assert.equal(current.state.contactTypes.find(t=>t.id===ctId).name,'Decision Owner');
await act(owner,'contactTypeSave',{name:' decision owner '},400);await act(owner,'contactTypeSave',{name:'   '},400);
await act(owner,'contactTypeAssign',{id:typed.id,typeId:'missing'},400);await act(owner,'contactTypeAssign',{id:typed.id,typeId:''});assert.equal(current.state.contacts.find(c=>c.id===typed.id).typeId,'');
await act(owner,'brand',{companyId:client.id,name:'Warm Brand',warmth:'Warm'});const warmBrand=current.state.brands.at(-1);
await act(owner,'brandWarmth',{id:warmBrand.id,warmth:'Hot'});assert.equal(current.state.brands.at(-1).warmth,'Hot');assert.equal(current.state.contacts.find(c=>c.id===typed.id).warmth,'Unrated');
await act(owner,'member',{personId:person.id,sections:['Contacts','Companies & brands'],canEdit:true,financials:false,scopeMode:'selected',companyIds:[],brandIds:[],projectIds:[]});
await act(member,'contactTypeAssign',{id:typed.id,typeId:ctId},403);await act(member,'brandWarmth',{id:warmBrand.id,warmth:'Cold'},403);await act(member,'contactTypeSave',{name:'Injected'},403);
await act(owner,'member',{personId:person.id,sections:['Contacts','Companies & brands'],canEdit:true,financials:false,scopeMode:'selected',companyIds:[client.id]});
await act(member,'contactTypeAssign',{id:typed.id,typeId:ctId});await act(member,'brandWarmth',{id:warmBrand.id,warmth:'Warm'});
const typedBackup=await (await recovery.GET(recReq(owner,'GET',null,'?format=json'))).json();const typedPreview=await rec('preview',{backup:typedBackup});await rec('restore',{backup:typedBackup,checksum:typedPreview.checksum,confirm:'RESTORE WORKSPACE'});const typedState=(await get(owner)).state;assert.equal(typedState.contacts.find(c=>c.id===typed.id).typeId,ctId);assert.equal(typedState.brands.find(b=>b.id===warmBrand.id).warmth,'Warm');assert(typedState.contactTypes.some(t=>t.id===ctId));
console.log('PASS: contact categories, rename identity, validation, contact and brand scope checks, independent brand warmth, backup round-trip.');

// Revision 8: Notes and To-dos Across the Workspace (auth/denied, forged/cross-scope IDs, dedup, task compat, My Day, backup/restore, stale revisions).
sqlite.exec('DELETE FROM request_limits');
await build({entryPoints:['lib/workspace-links.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'links.mjs')});
const linkLib=await import(join(dir,'links.mjs'));
await build({entryPoints:['lib/model.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'model.mjs')});
const modelLib=await import(join(dir,'model.mjs'));

// Set up a second company/brand/project/contact outside member scope for cross-scope testing.
await act(owner,'company',{name:'Restricted Client',contact:'Secret'});const otherClient=current.state.companies.at(-1);
await act(owner,'brand',{companyId:otherClient.id,name:'Restricted Brand',warmth:'Cold'});const otherBrand=current.state.brands.at(-1);
await act(owner,'contact',{companyId:otherClient.id,brandId:otherBrand.id,name:'Restricted Contact',title:'',email:'',phone:'',owner:'Owner Test'});const otherContact=current.state.contacts.at(-1);
await act(owner,'project',{companyId:otherClient.id,brandId:otherBrand.id,name:'Restricted Project',engagement:'Secret',type:current.state.projectTemplates.find(t=>!t.archived).id,owner:'Owner Test',hat:'Project lead',start:'2026-11-22',due:'2026-12-05',budget:0,cost:0});const otherProject=current.state.projects.at(-1);
const permittedProject=current.state.projects.find(p=>p.companyId===client.id);
const permittedTask=current.state.tasks.find(t=>t.projectId===permittedProject.id&&t.dependsOn);

// 1. Create note with duplicate links -> deduplicated; authorship, pinning and edit history preserved.
await act(owner,'note',{title:'Kickoff context',text:'Initial client requirements',pinned:false,confidential:false,links:[{type:'company',id:client.id},{type:'company',id:client.id},{type:'brand',id:warmBrand.id},{type:'project',id:permittedProject.id},{type:'contact',id:typed.id}]});
const sharedNote=current.state.notes[0];
assert.equal(sharedNote.links.length,4,'duplicate links must be deduplicated');
assert.equal(sharedNote.createdBy,'Owner Test');assert(sharedNote.createdAt);assert.equal(sharedNote.pinned,false);
await act(owner,'notePin',{id:sharedNote.id,pinned:true});
assert.equal(current.state.notes.find(n=>n.id===sharedNote.id).pinned,true);
await act(owner,'noteEdit',{id:sharedNote.id,title:'Kickoff context v2',text:'Updated requirements after discovery',links:sharedNote.links});
const editedNote=current.state.notes.find(n=>n.id===sharedNote.id);
assert.equal(editedNote.text,'Updated requirements after discovery');
assert.equal(editedNote.edits.length,1);assert.equal(editedNote.edits[0].text,'Initial client requirements');assert.equal(editedNote.edits[0].title,'Kickoff context');

// 2. Confidential workspace note linked to permitted records stays strictly owner-only.
await act(owner,'note',{title:'=CMD("calc") Margin note',text:'Confidential margin floor 35%',pinned:true,confidential:true,links:[{type:'company',id:client.id},{type:'project',id:permittedProject.id}]});
const secretNote=current.state.notes.find(n=>n.confidential);
// Also create a cross-scope shared note (links permitted client + restricted project).
await act(owner,'note',{title:'Cross-client note',text:'Shared across permitted and restricted projects',pinned:false,confidential:false,links:[{type:'company',id:client.id},{type:'project',id:otherProject.id}]});
const crossScopeNote=current.state.notes.find(n=>n.title==='Cross-client note');
// Create a contact-only note for Direct/Related and My Day testing.
await act(owner,'note',{title:'Contact pref',text:'Prefers Viber updates',pinned:false,confidential:false,links:[{type:'contact',id:typed.id}]});
const contactNote=current.state.notes.find(n=>n.title==='Contact pref');

// 3. Member with selected scope (client.id) and sections ['My Day','Notifications','Projects','Contacts','Companies & brands'].
await act(owner,'member',{personId:person.id,sections:['My Day','Notifications','Projects','Contacts','Companies & brands'],canEdit:true,financials:false,scopeMode:'selected',companyIds:[client.id],brandIds:[],projectIds:[]});
let memberView=await get(member);
assert(memberView.state.notes.some(n=>n.id===sharedNote.id),'permitted multi-linked note is visible');
assert(memberView.state.notes.some(n=>n.id===contactNote.id),'permitted contact note is visible');
assert(!memberView.state.notes.some(n=>n.id===secretNote.id),'confidential note must never leak via permitted links');
assert(!JSON.stringify(memberView).includes('Confidential margin floor'),'confidential note text must never appear in member payload');
assert(!memberView.state.notes.some(n=>n.id===crossScopeNote.id),'multi-linked note touching an out-of-scope record must be hidden');

// 4. Denied access & forged/cross-scope linked IDs.
await act(member,'note',{title:'Forbidden',text:'Attempt confidential',confidential:true,links:[{type:'company',id:client.id}]},403);
await act(member,'noteEdit',{id:secretNote.id,text:'Tamper'},403);
await act(member,'notePin',{id:secretNote.id,pinned:false},403);
await act(member,'noteToTask',{noteId:secretNote.id,name:'Leak task',owner:'Member Test',due:'2026-11-23'},403);
await act(member,'noteEdit',{id:crossScopeNote.id,text:'Tamper cross-scope'},403);
await act(member,'note',{title:'Forged link',text:'Bad ID',links:[{type:'contact',id:'forged-id-999'}]},403);
await act(member,'note',{title:'Cross-scope link',text:'Escape',links:[{type:'company',id:client.id},{type:'project',id:otherProject.id}]},403);
await act(member,'noteEdit',{id:contactNote.id,text:'Try widen',links:[{type:'contact',id:typed.id},{type:'company',id:otherClient.id}]},403);
await act(member,'task',{projectId:'',name:'Forged task link',owner:'Member Test',supplierId:'',due:'2026-11-23',dependsOn:'',links:[{type:'contact',id:otherContact.id}]},403);
await act(member,'task',{projectId:'',name:'Confidential sourceNoteId',owner:'Member Test',supplierId:'',due:'2026-11-23',dependsOn:'',links:[{type:'contact',id:typed.id}],sourceNoteId:secretNote.id},403);
await act(owner,'note',{title:'Owner forged',text:'Non-existent ID',links:[{type:'company',id:'missing-co'}]},400);

// Section boundary: member with Contacts only (no Companies & brands) cannot see or edit a note linked to both Contact + Company.
await act(owner,'member',{personId:person.id,sections:['My Day','Notifications','Contacts'],canEdit:true,financials:false,scopeMode:'selected',companyIds:[client.id],brandIds:[],projectIds:[]});
memberView=await get(member);
assert(memberView.state.notes.some(n=>n.id===contactNote.id),'contact-only note visible with Contacts section');
assert(!memberView.state.notes.some(n=>n.id===sharedNote.id),'multi-section note hidden when member lacks Projects/Companies & brands');
await act(member,'noteEdit',{id:sharedNote.id,text:'Missing section'},403);

// 5. Create To-do from Note (reusing existing tasks, My Day visibility & reminders without Projects section!).
await act(member,'noteToTask',{noteId:contactNote.id,name:'Send Viber update to contact',owner:'Member Test',hat:'Account management',due:'2026-11-20',links:[{type:'contact',id:typed.id},{type:'contact',id:typed.id}]});
const contactTask=current.state.tasks.find(t=>t.name==='Send Viber update to contact');
assert(contactTask,'noteToTask creates a record in existing state.tasks');
assert.equal(contactTask.projectId,'');
assert.equal(contactTask.sourceNoteId,contactNote.id);
assert.equal(contactTask.links.length,1,'task links are deduplicated');
const memberReminders=modelLib.reminders((await get(member)).state,'2026-11-23').filter(r=>r.owner==='Member Test');
assert(memberReminders.some(r=>r.recordId===contactTask.id),'contact to-do feeds My Day / reminders even without Projects section');
await act(member,'reminderRead',{id:`task:${contactTask.id}:2026-11-20`});
assert.equal((await get(member)).state.tasks.find(t=>t.id===contactTask.id).status,'To do','reading reminder does not complete task');
await act(member,'taskStatus',{id:contactTask.id,status:'In progress'});
assert.equal((await get(owner)).state.tasks.find(t=>t.id===contactTask.id).status,'In progress','single task updates everywhere');

// Owner creates a task from a confidential note -> member with full scope sees task if links permitted, NEVER sees confidential sourceNoteId.
await act(owner,'member',{personId:person.id,sections:['My Day','Notifications','Projects','Contacts','Companies & brands'],canEdit:true,financials:false,scopeMode:'selected',companyIds:[client.id],brandIds:[],projectIds:[]});
await act(owner,'noteToTask',{noteId:secretNote.id,name:'Review pricing sheet',owner:'Member Test',hat:'Sales',due:'2026-11-24',projectId:permittedProject.id});
const fromSecretTask=current.state.tasks.find(t=>t.name==='Review pricing sheet');
assert.equal(fromSecretTask.sourceNoteId,secretNote.id,'owner retains confidential sourceNoteId');
const memberSecretTask=(await get(member)).state.tasks.find(t=>t.id===fromSecretTask.id);
assert(memberSecretTask&&!memberSecretTask.sourceNoteId,'confidential sourceNoteId is stripped from non-owner views');

// 6. Existing task compatibility: cannot strip project link from a task with project dependencies; Direct vs Related views & deduplication.
await act(owner,'taskEdit',{id:permittedTask.id,owner:'Owner Test',supplierId:'',due:'2026-12-01',links:[{type:'company',id:client.id}]},400);
await act(owner,'taskEdit',{id:permittedTask.id,owner:'Owner Test',supplierId:'',due:'2026-12-01',links:[{type:'project',id:permittedProject.id},{type:'project',id:permittedProject.id},{type:'brand',id:warmBrand.id}]});
const updatedPermittedTask=current.state.tasks.find(t=>t.id===permittedTask.id);
assert.equal(updatedPermittedTask.projectId,permittedProject.id);
assert.equal(updatedPermittedTask.links.length,2,'taskEdit deduplicates links while preserving projectId');

const fullState=(await get(owner)).state;
const companyDirectNotes=fullState.notes.filter(n=>linkLib.matchesCompanyScope(fullState,n.links,client.id,'direct'));
const companyRelatedNotes=fullState.notes.filter(n=>linkLib.matchesCompanyScope(fullState,n.links,client.id,'related'));
assert(!companyDirectNotes.some(n=>n.id===contactNote.id),'contact-only note excluded from company Direct view');
assert(companyRelatedNotes.some(n=>n.id===contactNote.id),'contact-only note included in company Related view');
assert.equal(companyRelatedNotes.filter(n=>n.id===sharedNote.id).length,1,'multi-linked note appears once in Related view');
const origins=linkLib.originLabelsForContext(fullState,sharedNote.links,'company',client.id);
assert(origins.includes('Direct · Company')&&origins.some(x=>x.startsWith('Brand · '))&&origins.some(x=>x.startsWith('Project · '))&&origins.some(x=>x.startsWith('Contact · ')),'origin labels identify Direct and linked contexts');

// 7. Stale revisions on note / noteEdit / notePin / noteToTask return 409.
for(const [action,values] of [
 ['note',{title:'Stale',text:'Stale',links:[{type:'company',id:client.id}]}],
 ['noteEdit',{id:sharedNote.id,text:'Stale edit'}],
 ['notePin',{id:sharedNote.id,pinned:false}],
 ['noteToTask',{noteId:sharedNote.id,name:'Stale task',owner:'Owner Test',due:'2026-11-25'}]
]){
 const staleRes=await api.POST(req(owner,'POST',{action,values,revision:-1}));
 assert.equal(staleRes.status,409,`stale revision on ${action} must return 409`);
}

// 8. Backup/restore round-trip (Rev 8 backup + legacy Rev 7 backup without notes/links + CSV escaping + broken link rejection).
sqlite.exec('DELETE FROM request_limits');
const notesCsvRes=await recovery.GET(recReq(owner,'GET',null,'?format=csv&dataset=notes'));
assert.equal(notesCsvRes.status,200);
const notesCsv=await notesCsvRes.text();
assert(notesCsv.includes("'=CMD"),'notes CSV export must escape formula prefixes');

const rev8Backup=await (await recovery.GET(recReq(owner,'GET',null,'?format=json'))).json();
assert(rev8Backup.records.notes.length>=3);
const brokenNoteBackup=structuredClone(rev8Backup);
brokenNoteBackup.records.notes[0].links.push({type:'project',id:'missing-proj'});
brokenNoteBackup.checksum=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(brokenNoteBackup.records)))),b=>b.toString(16).padStart(2,'0')).join('');
await rec('preview',{backup:brokenNoteBackup},400);

// Legacy Rev 7 backup (no `notes` array, no `links`/`sourceNoteId` on tasks) restores cleanly.
const rev7Backup=structuredClone(typedBackup);
delete rev7Backup.records.notes;
for(const t of rev7Backup.records.tasks){delete t.links;delete t.sourceNoteId;}
rev7Backup.checksum=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(rev7Backup.records)))),b=>b.toString(16).padStart(2,'0')).join('');
const rev7Prev=await rec('preview',{backup:rev7Backup});
await rec('restore',{backup:rev7Backup,checksum:rev7Prev.checksum,confirm:'RESTORE WORKSPACE'});
assert.deepEqual((await get(owner)).state.notes,[],'legacy Rev 7 backup restores with empty notes');

// Restore Rev 8 backup and verify notes, edit history, pinned state, confidential flag, and task links/sourceNoteId survive.
const rev8Prev=await rec('preview',{backup:rev8Backup});
await rec('restore',{backup:rev8Backup,checksum:rev8Prev.checksum,confirm:'RESTORE WORKSPACE'});
const restoredRev8=(await get(owner)).state;
assert.equal(restoredRev8.notes.find(n=>n.id===sharedNote.id).edits.length,1);
assert.equal(restoredRev8.notes.find(n=>n.id===sharedNote.id).pinned,true);
assert.equal(restoredRev8.notes.find(n=>n.id===secretNote.id).confidential,true);
assert.equal(restoredRev8.tasks.find(t=>t.id===contactTask.id).sourceNoteId,contactNote.id);
console.log('PASS: Rev 8 notes & to-dos — auth/denied, confidential isolation, forged/cross-scope IDs, deduplication, Direct/Related views, task compatibility, My Day reminders, stale revisions, Rev 7 & Rev 8 backup/restore, CSV escaping.');

// Revision 8 Increment 2: Reliability & Daily Work (pinned daily priorities, Waiting On age & resolvedAt, auth/scope/stale checks, backup/restore).
sqlite.exec('DELETE FROM request_limits');
assert.equal(linkLib.waitingAgeDays('2026-11-17','2026-11-23'),6);
assert.equal(linkLib.formatWaitingAge('2026-11-17','2026-11-23'),'Waiting 6 days');
assert.equal(linkLib.formatWaitingAge('2026-11-23','2026-11-23'),'Requested today');
assert.equal(linkLib.addDays('2026-11-23',7),'2026-11-30');

await act(owner,'priorityPin',{taskId:contactTask.id,pinned:true});
assert((await get(owner)).state.pinnedPriorities[owner.id].includes(contactTask.id),'owner can pin daily priority');
await act(owner,'priorityPin',{taskId:'missing-task-999',pinned:true},400);
const stalePin=await api.POST(req(owner,'POST',{action:'priorityPin',values:{taskId:contactTask.id,pinned:false},revision:-1}));
assert.equal(stalePin.status,409,'stale revision on priorityPin must return 409');

// Read-only member with My Day + Contacts can pin a permitted task, but cannot pin out-of-scope tasks or pin without My Day access.
await act(owner,'member',{personId:person.id,sections:['My Day','Contacts'],canEdit:false,financials:false,scopeMode:'selected',companyIds:[client.id],brandIds:[],projectIds:[]});
await act(member,'priorityPin',{taskId:contactTask.id,pinned:true});
assert((await get(member)).state.pinnedPriorities[member.id].includes(contactTask.id),'member pinned priority is isolated to member');
assert(!(await get(member)).state.pinnedPriorities[owner.id],'member must never see owner pinned priorities');
const restrictedTask=(await get(owner)).state.tasks.find(t=>t.projectId===otherProject.id);
await act(member,'priorityPin',{taskId:restrictedTask.id,pinned:true},403);
await act(member,'priorityPin',{taskId:'forged-task',pinned:true},403);
await act(owner,'member',{personId:person.id,sections:['Contacts'],canEdit:true,financials:false,scopeMode:'selected',companyIds:[client.id],brandIds:[],projectIds:[]});
await act(member,'priorityPin',{taskId:contactTask.id,pinned:true},403);

// Waiting On resolution records resolvedAt and survives backup/restore while personal pinnedPriorities stay excluded from backups.
await act(owner,'waiting',{projectId:permittedProject.id,taskId:'',name:'Client brand guidelines',party:'Client',person:'Brand Manager',owner:'Owner Test',hat:'Account management',due:'2026-11-20',followup:'2026-11-23',impact:'Needed before design'});
const addedWait=current.state.waiting.at(-1);
await act(owner,'resolve',{id:addedWait.id,resolution:'Received PDF brand kit'});
const resolvedWait=current.state.waiting.find(w=>w.id===addedWait.id);
assert(resolvedWait.resolved&&resolvedWait.resolvedAt,'resolving waiting item records resolvedAt timestamp');
const inc2Backup=await (await recovery.GET(recReq(owner,'GET',null,'?format=json'))).json();
assert(!('pinnedPriorities'in inc2Backup.records),'personal pinnedPriorities are excluded from downloadable backups');
const inc2Prev=await rec('preview',{backup:inc2Backup});
await rec('restore',{backup:inc2Backup,checksum:inc2Prev.checksum,confirm:'RESTORE WORKSPACE'});
const afterInc2Restore=(await get(owner)).state;
assert.equal(afterInc2Restore.waiting.find(w=>w.id===addedWait.id).resolvedAt,resolvedWait.resolvedAt,'waiting resolvedAt survives backup round-trip');
assert.deepEqual(afterInc2Restore.pinnedPriorities[owner.id],[],'personal pinnedPriorities reset cleanly on restore');
console.log('PASS: Rev 8 Increment 2 — My Day pinned priorities auth/scope/stale/isolation, Waiting On age & resolvedAt, backup/restore compatibility.');

// Revision 8 Increment 3: Reminders & Simple Workflows (prefs, visible delivery failures, overdue waiting chase prompts, signed-contract handoff prompts, touchpoint -> follow-up task deduplication).
sqlite.exec('DELETE FROM request_limits');
await act(owner,'reminderPrefsSave',{inApp:true,email:true,dailyDigest:true,digestTime:'08:00',timezone:'Asia/Manila'});
assert.equal((await get(owner)).state.reminderPrefs[owner.id].email,true);
await act(owner,'reminderTestEmail',{});
const ownerFailures=(await get(owner)).state.deliveryFailures;
assert(ownerFailures.length>=1&&ownerFailures[0].reason.includes('not connected'),'email delivery failure is recorded honestly');
const stalePref=await api.POST(req(owner,'POST',{action:'reminderPrefsSave',values:{inApp:true,email:false,dailyDigest:false,digestTime:'09:00',timezone:'Asia/Manila'},revision:-1}));
assert.equal(stalePref.status,409,'stale revision on reminderPrefsSave returns 409');

// Read-only member with Notifications can manage own prefs and never sees owner delivery failures; denied without Notifications.
await act(owner,'member',{personId:person.id,sections:['Notifications'],canEdit:false,financials:false,scopeMode:'selected',companyIds:[client.id],brandIds:[],projectIds:[]});
await act(member,'reminderPrefsSave',{inApp:true,email:true,dailyDigest:false,digestTime:'09:00',timezone:'Asia/Manila'});
const memberNotifView=await get(member);
assert.equal(memberNotifView.state.deliveryFailures.length,0,'member must not see owner delivery failures');
await act(member,'reminderTestEmail',{});
assert.equal((await get(member)).state.deliveryFailures.length,1,'member sees own delivery failure');
await act(owner,'member',{personId:person.id,sections:['My Day'],canEdit:true,financials:false,scopeMode:'selected',companyIds:[client.id],brandIds:[],projectIds:[]});
await act(member,'reminderPrefsSave',{inApp:true,email:false,dailyDigest:false,digestTime:'09:00',timezone:'Asia/Manila'},403);
await act(member,'reminderTestEmail',{},403);

// Overdue waiting item triggers internal owner chase prompt (even if followup is in future) and is deduplicated & suppressed on resolve.
await act(owner,'waiting',{projectId:permittedProject.id,taskId:'',name:'Signed IO',party:'Client',person:'Media Buyer',owner:'Owner Test',hat:'Sales',due:'2026-11-18',followup:'2026-12-10',impact:'Blocks launch'});
const overdueWait=current.state.waiting.at(-1);
let ownerRems=modelLib.reminders((await get(owner)).state,'2026-11-23').filter(r=>r.owner==='Owner Test');
const waitRems=ownerRems.filter(r=>r.recordId===overdueWait.id);
assert.equal(waitRems.length,1,'overdue waiting item emits one deduplicated chase reminder');
assert(waitRems[0].title.includes('Overdue waiting item — chase Media Buyer'));
await act(owner,'resolve',{id:overdueWait.id,resolution:'IO received'});
ownerRems=modelLib.reminders((await get(owner)).state,'2026-11-23').filter(r=>r.owner==='Owner Test');
assert(!ownerRems.some(r=>r.recordId===overdueWait.id),'resolved waiting item reminder is suppressed');

// Signed contract prompts project creation; creating a linked project suppresses the prompt.
await act(owner,'opportunity',{companyId:client.id,brandId:warmBrand.id,name:'Q1 WiFi Retainer',owner:'Owner Test',hat:'Sales',value:150000,nextAction:'Kick off project'});
const signedDeal=current.state.opportunities.at(-1);
await act(owner,'dealStage',{id:signedDeal.id,stage:'Contract Signed'});
const handoffDate=current.state.opportunities.find(o=>o.id===signedDeal.id).updatedAt.slice(0,10);
ownerRems=modelLib.reminders((await get(owner)).state,handoffDate).filter(r=>r.owner==='Owner Test');
assert(ownerRems.some(r=>r.id===`handoff:${signedDeal.id}`),'signed contract prompts project creation');
await act(owner,'project',{companyId:client.id,brandId:warmBrand.id,name:'Q1 WiFi Retainer Delivery',engagement:'Q1 WiFi Retainer',type:current.state.projectTemplates.find(t=>!t.archived).id,owner:'Owner Test',hat:'Project lead',start:'2026-11-23',due:'2026-12-15',budget:150000,cost:80000,opportunityId:signedDeal.id});
ownerRems=modelLib.reminders((await get(owner)).state,handoffDate).filter(r=>r.owner==='Owner Test');
assert(!ownerRems.some(r=>r.id===`handoff:${signedDeal.id}`),'handoff prompt is suppressed once linked project exists');

// Dated touchpoint with createFollowupTask=true creates one shared task and suppresses duplicate touchpoint reminder.
await act(owner,'touchpoint',{companyId:client.id,contactId:typed.id,opportunityId:signedDeal.id,projectId:'',channel:'Phone',summary:'Confirmed timeline',owner:'Owner Test',hat:'Sales',nextAction:'Send kickoff deck',followup:'2026-11-20',createFollowupTask:true});
const linkedTp=current.state.touchpoints.at(-1);
assert(linkedTp.followupTaskId,'touchpoint stores followupTaskId');
const linkedTpTask=current.state.tasks.find(t=>t.id===linkedTp.followupTaskId);
assert(linkedTpTask&&linkedTpTask.name==='Send kickoff deck'&&linkedTpTask.due==='2026-11-20');
ownerRems=modelLib.reminders((await get(owner)).state,'2026-11-23').filter(r=>r.owner==='Owner Test');
assert(ownerRems.some(r=>r.recordId===linkedTpTask.id),'follow-up task emits reminder');
assert(!ownerRems.some(r=>r.recordId===linkedTp.id),'duplicate touchpoint reminder is suppressed when linked to follow-up task');
await act(owner,'touchReschedule',{id:linkedTp.id,followup:'2026-11-28'});
assert.equal((await get(owner)).state.tasks.find(t=>t.id===linkedTpTask.id).due,'2026-11-28','rescheduling touchpoint updates linked follow-up task due date');

// Backup excludes personal reminderPrefs & deliveryFailures, preserves Project.opportunityId & Touchpoint.followupTaskId.
const inc3Backup=await (await recovery.GET(recReq(owner,'GET',null,'?format=json'))).json();
assert(!('reminderPrefs'in inc3Backup.records)&&!('deliveryFailures'in inc3Backup.records));
const inc3Prev=await rec('preview',{backup:inc3Backup});
await rec('restore',{backup:inc3Backup,checksum:inc3Prev.checksum,confirm:'RESTORE WORKSPACE'});
const afterInc3=(await get(owner)).state;
assert.equal(afterInc3.touchpoints.find(t=>t.id===linkedTp.id).followupTaskId,linkedTpTask.id);
assert.equal(afterInc3.deliveryFailures.length,0,'deliveryFailures reset cleanly on restore');
console.log('PASS: Rev 8 Increment 3 — reminder prefs, visible delivery failures, overdue waiting chase prompts, signed-contract handoff prompts, touchpoint follow-up task deduplication, backup/restore.');

// Revision 8 Increment 4: CRM & Project Handoff (missing next action/date flags, dealEdit, multi-brand template dealHandoff + duplicate prevention, lost-deal retargeting & reopening, permissions, stale revisions, backup/restore).
sqlite.exec('DELETE FROM request_limits');
await act(owner,'brand',{companyId:client.id,name:'Brand Beta',warmth:'Warm'});const brandBeta=current.state.brands.at(-1);
await act(owner,'opportunity',{companyId:client.id,brandId:'',name:'Multi-Brand Annual Deal',owner:'Owner Test',hat:'Sales',value:400000,nextAction:''});
const multiDeal=current.state.opportunities.at(-1);
// 1. Open deal missing next action and follow-up date is flagged.
let gap=modelLib.dealMissingNextAction(current.state,multiDeal);
assert.equal(gap.missingAction,true);assert.equal(gap.missingDate,true);assert.equal(gap.needsAttention,true);
await act(owner,'dealEdit',{id:multiDeal.id,brandId:'',owner:'Owner Test',hat:'Sales',value:420000,nextAction:'Send revised proposal',nextActionDate:'2026-11-26'});
gap=modelLib.dealMissingNextAction(current.state,current.state.opportunities.find(o=>o.id===multiDeal.id));
assert.equal(gap.needsAttention,false,'setting nextAction and nextActionDate clears next-action gap');

// 2. Non-signed deal cannot be handed off.
const activeTplId=current.state.projectTemplates.find(t=>!t.archived).id;
await act(owner,'dealHandoff',{opportunityId:multiDeal.id,projects:[{brandId:warmBrand.id,name:'Premature',engagement:'Annual',type:activeTplId,owner:'Owner Test',hat:'Project lead',start:'2026-11-23',due:'2026-12-10',budget:0,cost:0}]},400);

// 3. Sign deal and hand off into two independent brand projects with different owners & timelines.
await act(owner,'dealStage',{id:multiDeal.id,stage:'Contract Signed'});
// Duplicate brand in same batch rejected.
await act(owner,'dealHandoff',{opportunityId:multiDeal.id,projects:[
 {brandId:warmBrand.id,name:'Dup 1',engagement:'Annual',type:activeTplId,owner:'Owner Test',hat:'Project lead',start:'2026-11-23',due:'2026-12-10',budget:0,cost:0},
 {brandId:warmBrand.id,name:'Dup 2',engagement:'Annual',type:activeTplId,owner:'Owner Test',hat:'Project lead',start:'2026-11-24',due:'2026-12-12',budget:0,cost:0}
]},400);
await act(owner,'dealHandoff',{opportunityId:multiDeal.id,projects:[
 {brandId:warmBrand.id,name:'Annual — Warm Brand',engagement:'Multi-Brand Annual Deal',type:activeTplId,owner:'Owner Test',hat:'Project lead',start:'2026-11-23',due:'2026-12-10',budget:200000,cost:110000},
 {brandId:brandBeta.id,name:'Annual — Brand Beta',engagement:'Multi-Brand Annual Deal',type:activeTplId,owner:'Member Test',hat:'Account management',start:'2026-12-01',due:'2026-12-20',budget:220000,cost:120000}
]});
const handedProjects=current.state.projects.filter(p=>p.opportunityId===multiDeal.id);
assert.equal(handedProjects.length,2,'multi-brand handoff creates two independent linked projects');
assert.equal(handedProjects[0].owner,'Owner Test');assert.equal(handedProjects[1].owner,'Member Test');
assert.equal(handedProjects[0].due,'2026-12-10');assert.equal(handedProjects[1].due,'2026-12-20');
assert(current.state.tasks.filter(t=>t.projectId===handedProjects[0].id).length>=1,'template tasks created for brand 1');
assert(current.state.tasks.filter(t=>t.projectId===handedProjects[1].id).length>=1,'template tasks created for brand 2');
// Duplicate handoff against already-created brand rejected via both dealHandoff and project.
await act(owner,'dealHandoff',{opportunityId:multiDeal.id,projects:[{brandId:warmBrand.id,name:'Dup Again',engagement:'Annual',type:activeTplId,owner:'Owner Test',hat:'Project lead',start:'2026-11-23',due:'2026-12-10',budget:0,cost:0}]},400);
await act(owner,'project',{companyId:client.id,brandId:warmBrand.id,name:'Dup Single',engagement:'Annual',type:activeTplId,owner:'Owner Test',hat:'Project lead',start:'2026-11-23',due:'2026-12-10',budget:0,cost:0,opportunityId:multiDeal.id},400);

// 4. Permissions on dealEdit & dealHandoff (dual-section, financial, scope).
await act(owner,'member',{personId:person.id,sections:['CRM Pipeline'],canEdit:true,financials:false,scopeMode:'selected',companyIds:[client.id],brandIds:[],projectIds:[]});
await act(member,'dealHandoff',{opportunityId:multiDeal.id,projects:[{brandId:'',name:'No Projects Sec',engagement:'Annual',type:activeTplId,owner:'Member Test',hat:'Project lead',start:'2026-11-23',due:'2026-12-10',budget:0,cost:0}]},403);
await act(member,'dealEdit',{id:multiDeal.id,owner:'Member Test',value:999999,nextAction:'Try finance',nextActionDate:'2026-11-28'},403);
await act(owner,'member',{personId:person.id,sections:['CRM Pipeline','Projects'],canEdit:true,financials:false,scopeMode:'selected',companyIds:[client.id],brandIds:[],projectIds:[]});
await act(member,'dealHandoff',{opportunityId:multiDeal.id,projects:[{brandId:'',name:'Finance Denied',engagement:'Annual',type:activeTplId,owner:'Member Test',hat:'Project lead',start:'2026-11-23',due:'2026-12-10',budget:50000,cost:0}]},403);
await act(member,'dealHandoff',{opportunityId:multiDeal.id,projects:[{brandId:otherBrand.id,name:'Scope Denied',engagement:'Annual',type:activeTplId,owner:'Member Test',hat:'Project lead',start:'2026-11-23',due:'2026-12-10',budget:0,cost:0}]},403);

// 5. Lost-deal retargeting date, retargeting reminder, and reopening preserving loss history.
await act(owner,'opportunity',{companyId:client.id,brandId:brandBeta.id,name:'Retargetable Campaign',owner:'Owner Test',hat:'Sales',value:180000,nextAction:'Send quote',nextActionDate:'2026-11-25'});
const retargetDeal=current.state.opportunities.at(-1);
await act(owner,'dealStage',{id:retargetDeal.id,stage:'Proposal Sent'});
await act(owner,'dealLost',{id:retargetDeal.id,reason:'Budget frozen until Q1',retargetDate:'2026-11-23'});
const lostRec=current.state.opportunities.find(o=>o.id===retargetDeal.id);
assert.equal(lostRec.stage,'Lost');assert.equal(lostRec.lostFrom,'Proposal Sent');assert.equal(lostRec.retargetDate,'2026-11-23');
let retargetRems=modelLib.reminders((await get(owner)).state,'2026-11-23').filter(r=>r.owner==='Owner Test');
assert(retargetRems.some(r=>r.kind==='retarget'&&r.opportunityId===retargetDeal.id),'lost deal emits retargeting reminder on retargetDate');
await act(owner,'dealReopen',{id:retargetDeal.id,stage:'Negotiations',nextAction:'Re-confirm Q1 scope',nextActionDate:'2026-12-02'});
const reopenedRec=current.state.opportunities.find(o=>o.id===retargetDeal.id);
assert.equal(reopenedRec.stage,'Negotiations');assert.equal(reopenedRec.lostFrom,'Proposal Sent');assert.equal(reopenedRec.lostReason,'Budget frozen until Q1');assert.equal(reopenedRec.nextActionDate,'2026-12-02');
retargetRems=modelLib.reminders((await get(owner)).state,'2026-11-23').filter(r=>r.owner==='Owner Test');
assert(!retargetRems.some(r=>r.kind==='retarget'&&r.opportunityId===retargetDeal.id),'reopened deal suppresses retargeting reminder');

// 6. Stale revision returns 409; backup/restore round-trip preserves nextActionDate, retargetDate, and multi-brand opportunityId links.
const staleHandoff=await api.POST(req(owner,'POST',{action:'dealReopen',values:{id:retargetDeal.id,stage:'Discovery'},revision:-1}));
assert.equal(staleHandoff.status,409,'stale revision on dealReopen returns 409');
const inc4Backup=await (await recovery.GET(recReq(owner,'GET',null,'?format=json'))).json();
const inc4Prev=await rec('preview',{backup:inc4Backup});
await rec('restore',{backup:inc4Backup,checksum:inc4Prev.checksum,confirm:'RESTORE WORKSPACE'});
const afterInc4=(await get(owner)).state;
assert.equal(afterInc4.opportunities.find(o=>o.id===retargetDeal.id).nextActionDate,'2026-12-02');
assert.equal(afterInc4.opportunities.find(o=>o.id===retargetDeal.id).retargetDate,'2026-11-23');
assert.equal(afterInc4.projects.filter(p=>p.opportunityId===multiDeal.id).length,2);
console.log('PASS: Rev 8 Increment 4 — next-action gap flags, dealEdit, multi-brand template handoff & duplicate prevention, lost-deal retargeting & reopening, permissions, backup/restore.');

// Revision 8 Increment 5: Documents & Server-Enforced App-Wide Search.
sqlite.exec('DELETE FROM request_limits');
await build({entryPoints:['app/api/search/route.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'search.mjs'),plugins:[{name:'test-db',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'db',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const env={DB:globalThis.__workspaceTestDB,PILOT_OWNER_EMAIL:"owner@example.test",PILOT_COOWNER_EMAIL:"pilot-start@example.test"};',loader:'js'}))}}]});
const searchApi=await import(join(dir,'search.mjs'));
const searchReq=(u,query='')=>new Request('https://workspace.example.test/api/search'+query,{method:'GET',headers:{origin:'https://workspace.example.test',...(u?{'oai-authenticated-user-id':u.id,'oai-authenticated-user-email':u.email,'oai-authenticated-user-full-name':u.name}:{})}});

// 1. Documents validation, deduplication, pinning, audience labels, and version-locked approval semantics.
await act(owner,'doc',{title:'Bad URL',url:'ftp://files.example.test/brief.pdf',docType:'Brief',owner:'Owner Test',status:'Draft',description:'',tags:'invalid',audience:'internal',pinned:false,links:[{type:'company',id:client.id}]},400);
await act(owner,'doc',{title:'+Campaign Brief',url:'https://files.example.test/brief-v1',docType:'Brief',owner:'Owner Test',hat:'Account management',status:'For Review',description:'Master Q1 creative brief',tags:'brief, q1',audience:'client-sharing',pinned:true,links:[{type:'company',id:client.id},{type:'company',id:client.id},{type:'brand',id:warmBrand.id},{type:'project',id:permittedProject.id}]});
const briefDoc=current.state.documents[0];
assert.equal(briefDoc.links.length,3,'document links are deduplicated');
assert.equal(briefDoc.version,1);assert.equal(briefDoc.pinned,true);assert.equal(briefDoc.audience,'client-sharing');
assert.deepEqual(briefDoc.tags,['brief','q1']);

await act(owner,'doc',{title:'Internal Pricing Model',url:'https://files.example.test/pricing-internal',docType:'Proposal',owner:'Owner Test',hat:'Sales',status:'Draft',description:'Internal margin sheet',tags:'pricing',audience:'internal',pinned:false,links:[{type:'opportunity',id:multiDeal.id},{type:'company',id:client.id}]});
const internalDoc=current.state.documents[0];

// Client preview sees only client-sharing documents, never internal documents.
const clientPreview=modelLib.visibleState((await get(owner)).state,'Client',client.id);
assert(clientPreview.documents.some(d=>d.id===briefDoc.id),'client preview shows client-sharing document');
assert(!clientPreview.documents.some(d=>d.id===internalDoc.id),'client preview hides internal document');

// Approval linked to exact document version (v1); approving marks v1 approved; replacing URL bumps to v2 and clears Approved status!
await act(owner,'approval',{projectId:permittedProject.id,documentId:briefDoc.id,name:'Approve Master Brief',reviewer:'Brand Manager',due:'2026-11-28',note:'Review v1 brief'});
const docApproval=current.state.approvals.at(-1);
assert.equal(docApproval.documentId,briefDoc.id);assert.equal(docApproval.documentVersion,1);assert.equal(docApproval.documentUrl,'https://files.example.test/brief-v1');
await act(owner,'decision',{id:docApproval.id,status:'Approved',note:'Signed off v1'});
assert.equal(current.state.documents.find(d=>d.id===briefDoc.id).status,'Approved');
assert.equal(current.state.documents.find(d=>d.id===briefDoc.id).approvedVersion,1);

await act(owner,'docEdit',{id:briefDoc.id,title:'+Campaign Brief',url:'https://files.example.test/brief-v2',docType:'Brief',owner:'Owner Test',hat:'Account management',description:'Updated Q1 brief',tags:'brief, q1, v2',audience:'client-sharing',links:briefDoc.links});
const briefV2=current.state.documents.find(d=>d.id===briefDoc.id);
assert.equal(briefV2.version,2,'replacing URL increments document version');
assert.equal(briefV2.status,'For Review','replacing URL downgrades Approved status so new content is never auto-approved');
assert.equal(briefV2.approvedVersion,1,'historical approvedVersion stays v1');

// Approval mutations inherit the linked document's access requirements.
const v2Approval={projectId:permittedProject.id,documentId:briefDoc.id,name:'Review updated brief',reviewer:'Brand Manager',due:'2026-11-28',note:'Review v2'};
await act(owner,'approval',v2Approval);
const approvalV2Id=current.state.approvals.at(-1).id;
const approvalDecision={id:approvalV2Id,status:'Approved',note:'Approved v2'};
const approvalRevision={id:approvalV2Id,note:'Request another pass'};
const approveSections=['Approvals','Projects','Documents','Companies & brands'];
const approvalMember={personId:person.id,canEdit:true,financials:false,scopeMode:'selected',companyIds:[client.id],brandIds:[],projectIds:[]};

await act(owner,'member',{...approvalMember,sections:['Approvals','Projects','Companies & brands']});
await act(member,'approval',v2Approval,403);
await act(member,'decision',approvalDecision,403);
await act(member,'revision',approvalRevision,403);
const {documentId:unusedDocument,...standaloneApproval}=v2Approval;
await act(member,'approval',{...standaloneApproval,name:'Unlinked delivery approval'});

await act(owner,'member',{...approvalMember,sections:approveSections,companyIds:[],projectIds:[permittedProject.id]});
await act(member,'decision',approvalDecision,403);
assert.equal((await get(owner)).state.documents.find(d=>d.id===briefDoc.id).status,'For Review');

await act(owner,'member',{...approvalMember,sections:approveSections});
await act(member,'decision',{...approvalDecision,status:'Changes requested'});
assert.equal((await get(owner)).state.approvals.find(a=>a.id===approvalV2Id).status,'Changes requested');
assert.equal((await get(owner)).state.documents.find(d=>d.id===briefDoc.id).status,'For Review');

// Stale revision on docStatus returns 409.
const staleDoc=await api.POST(req(owner,'POST',{action:'docStatus',values:{id:briefDoc.id,status:'Superseded'},revision:-1}));
assert.equal(staleDoc.status,409,'stale revision on docStatus returns 409');

// 2. Document permissions: member without Documents section cannot see/edit; member without CRM Pipeline cannot see deal-linked doc; cross-scope denied.
await act(owner,'member',{personId:person.id,sections:['Projects','Companies & brands'],canEdit:true,financials:false,scopeMode:'selected',companyIds:[client.id],brandIds:[],projectIds:[]});
assert.equal((await get(member)).state.documents.length,0,'member without Documents section receives no documents');
await act(member,'docPin',{id:briefDoc.id,pinned:false},403);
await act(owner,'member',{personId:person.id,sections:['Documents','Projects','Companies & brands'],canEdit:true,financials:false,scopeMode:'selected',companyIds:[client.id],brandIds:[],projectIds:[]});
let memberDocs=(await get(member)).state.documents;
assert(memberDocs.some(d=>d.id===briefDoc.id),'member with Documents + Projects + Companies sees briefDoc');
assert(!memberDocs.some(d=>d.id===internalDoc.id),'member without CRM Pipeline cannot see opportunity-linked document');
await act(member,'doc',{title:'Cross-scope doc',url:'https://files.example.test/file',docType:'Other',owner:'Member Test',status:'Draft',description:'',tags:'',audience:'internal',pinned:false,links:[{type:'company',id:otherClient.id}]},403);

// 3. Server-enforced App-Wide Search (/api/search): auth, filters, snippets, counts, confidentiality & financial redaction.
assert.equal((await searchApi.GET(searchReq(null,'?q=brief'))).status,401,'unauthenticated search returns 401');
const ownerSearchRes=await (await searchApi.GET(searchReq(owner,'?q=Updated+Q1'))).json();
assert(ownerSearchRes.total>=1&&ownerSearchRes.countsByType.document>=1,'owner search matches document metadata');
const ownerSecretSearch=await (await searchApi.GET(searchReq(owner,'?q=margin+floor'))).json();
assert(ownerSecretSearch.countsByType.note>=1,'owner can search own confidential notes');

// Member search MUST hide confidential notes, out-of-scope records, disallowed sections, and financial values in snippets/counts.
const memberSecretSearch=await (await searchApi.GET(searchReq(member,'?q=margin+floor'))).json();
assert.equal(memberSecretSearch.total,0,'member search never leaks confidential note in results or counts');
assert.equal(memberSecretSearch.countsByType.note,0);
const memberRestrictedSearch=await (await searchApi.GET(searchReq(member,'?q=Restricted+Client'))).json();
assert.equal(memberRestrictedSearch.total,0,'member search never leaks out-of-scope company/brand/project');
const memberDealSearch=await (await searchApi.GET(searchReq(member,'?q=Multi-Brand+Annual'))).json();
assert.equal(memberDealSearch.countsByType.opportunity,0,'member without CRM Pipeline sees 0 opportunity matches');
assert(!JSON.stringify(memberDealSearch).includes('420,000'),'member without financial access sees no deal value');

// 4. Documents CSV export escaping & JSON backup/restore round-trip.
const docsCsvRes=await recovery.GET(recReq(owner,'GET',null,'?format=csv&dataset=documents'));
assert.equal(docsCsvRes.status,200);
assert((await docsCsvRes.text()).includes("'+Campaign Brief"),'documents CSV export escapes formula prefixes');
const inc5Backup=await (await recovery.GET(recReq(owner,'GET',null,'?format=json'))).json();
assert(inc5Backup.records.documents.length>=2);
const inc5Prev=await rec('preview',{backup:inc5Backup});
await rec('restore',{backup:inc5Backup,checksum:inc5Prev.checksum,confirm:'RESTORE WORKSPACE'});
const afterInc5=(await get(owner)).state;
assert.equal(afterInc5.documents.find(d=>d.id===briefDoc.id).version,2);
assert.equal(afterInc5.documents.find(d=>d.id===briefDoc.id).approvedVersion,1);
assert.equal(afterInc5.approvals.find(a=>a.id===docApproval.id).documentVersion,1);
console.log('PASS: Rev 8 Increment 5 — Documents CRUD/pinning/audience, version-locked approvals, URL-change approval invalidation, section/scope enforcement, server-enforced /api/search, CSV & backup/restore.');

// Revision 8 Increment 6: Calendar & Reporting (lifecycle history, saved report views, 5 reports, server-enforced CSV export, permissions, backup/restore).
sqlite.exec('DELETE FROM request_limits');
await build({entryPoints:['lib/reports.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'reports.mjs')});
const reportsLib=await import(join(dir,'reports.mjs'));
await build({entryPoints:['app/api/reports/export/route.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'reports-export.mjs'),plugins:[{name:'test-db',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'db',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const env={DB:globalThis.__workspaceTestDB,PILOT_OWNER_EMAIL:"owner@example.test",PILOT_COOWNER_EMAIL:"pilot-start@example.test"};',loader:'js'}))}}]});
const reportsExportApi=await import(join(dir,'reports-export.mjs'));
const reportExpReq=(u,query='')=>new Request('https://workspace.example.test/api/reports/export'+query,{method:'GET',headers:{origin:'https://workspace.example.test',...(u?{'oai-authenticated-user-id':u.id,'oai-authenticated-user-email':u.email,'oai-authenticated-user-full-name':u.name}:{})}});

// 1. Lifecycle history: deal stageHistory, task originalDue/reschedules/completedAt/reopenedAt, project completedAt.
await act(owner,'opportunity',{companyId:client.id,brandId:warmBrand.id,name:'+Tracked Pipeline Deal',owner:'Owner Test',hat:'Sales',value:250000,nextAction:'Send deck',nextActionDate:'2026-11-28'});
const trackedDeal=current.state.opportunities.at(-1);
assert.equal(trackedDeal.stageHistory.length,1);assert.equal(trackedDeal.stageHistory[0].to,'New leads');
await act(owner,'dealStage',{id:trackedDeal.id,stage:'Proposal Sent'});
await act(owner,'dealLost',{id:trackedDeal.id,reason:'Delayed',retargetDate:'2026-12-15'});
await act(owner,'dealReopen',{id:trackedDeal.id,stage:'Negotiations'});
const trackedDealAfter=current.state.opportunities.find(o=>o.id===trackedDeal.id);
assert.equal(trackedDealAfter.stageHistory.length,4,'deal stageHistory records creation, stage move, loss, and reopen');
assert.equal(trackedDealAfter.stageHistory.at(-1).from,'Lost');assert.equal(trackedDealAfter.stageHistory.at(-1).to,'Negotiations');

await act(owner,'task',{projectId:'',name:'Calendar Sync Task',owner:'Owner Test',hat:'Design',supplierId:'',due:'2026-11-24',dependsOn:'',links:[{type:'company',id:client.id}]});
const calTask=current.state.tasks.at(-1);
assert.equal(calTask.originalDue,'2026-11-24');
await act(owner,'taskEdit',{id:calTask.id,owner:'Owner Test',supplierId:'',due:'2026-11-29',hat:'Design'});
const calTaskResched=current.state.tasks.find(t=>t.id===calTask.id);
assert.equal(calTaskResched.due,'2026-11-29');assert.equal(calTaskResched.originalDue,'2026-11-24');
assert.equal(calTaskResched.reschedules.length,1);assert.equal(calTaskResched.reschedules[0].from,'2026-11-24');assert.equal(calTaskResched.reschedules[0].to,'2026-11-29');
await act(owner,'taskStatus',{id:calTask.id,status:'Done'});
assert(current.state.tasks.find(t=>t.id===calTask.id).completedAt,'task completion records completedAt');
await act(owner,'taskStatus',{id:calTask.id,status:'In progress'});
assert(current.state.tasks.find(t=>t.id===calTask.id).reopenedAt,'task reopening records reopenedAt');

// Project completion records completedAt.
await act(owner,'project',{companyId:client.id,brandId:warmBrand.id,name:'Closeout History Project',engagement:'Closeout',type:activeTplId,owner:'Owner Test',hat:'Project lead',start:'2026-11-20',due:'2026-11-25',budget:50000,cost:20000});
const closeProj=current.state.projects.at(-1);
for(const t of current.state.tasks.filter(x=>x.projectId===closeProj.id)){await act(owner,'taskStatus',{id:t.id,status:'Done'});}
await act(owner,'projectStatus',{id:closeProj.id,status:'Complete'});
const closedProj=current.state.projects.find(p=>p.id===closeProj.id);
assert(closedProj.completedAt,'project closeout records completedAt');

// 2. All 5 reports build cleanly with metrics, definitions, asOf timestamp, and explicit "Not recorded (earlier release)" labels where history is absent.
const ownerFull=(await get(owner)).state;
for(const rk of ['pipeline','delivery','workload','followups','waiting']){
 const rep=reportsLib.buildReport(ownerFull,rk,{},{financials:true,on:'2026-11-23'});
 assert(rep.title&&rep.definition&&rep.asOf.includes('PHT'),`${rk} report has title, definition, and PHT timestamp`);
 assert(rep.metrics.length>=3,`${rk} report has clickable KPI metrics`);
}
const deliveryRep=reportsLib.buildReport(ownerFull,'delivery',{},{financials:true,on:'2026-11-23'});
assert(deliveryRep.rows.some(r=>r._id===closeProj.id&&r.completedAt&&r.completedAt!=='Not recorded (earlier release)'),'completed project shows recorded completedAt');
assert(deliveryRep.rows.some(r=>r._id===permittedProject.id&&r.completedAt==='—'),'open project shows dash for completedAt');
const legacyState=structuredClone(ownerFull);
legacyState.projects.find(p=>p.id===closeProj.id).completedAt=undefined;
const legacyDelivery=reportsLib.buildReport(legacyState,'delivery',{},{financials:true,on:'2026-11-23'});
assert(legacyDelivery.rows.some(r=>r._id===closeProj.id&&r.completedAt==='Not recorded (earlier release)'),'earlier completed project without completedAt is labeled honestly');

// 3. Saved report views: per-user isolation, read-only member with Reports allowed, 403 without Reports, 409 stale revision.
await act(owner,'reportViewSave',{name:'Q4 Pipeline',report:'pipeline',filters:{companyId:client.id}});
const staleReportView=await api.POST(req(owner,'POST',{action:'reportViewSave',values:{name:'Stale',report:'delivery',filters:{}},revision:-1}));
assert.equal(staleReportView.status,409,'stale revision on reportViewSave returns 409');

await act(owner,'member',{personId:person.id,sections:['Reports','Projects','CRM Pipeline','Companies & brands'],canEdit:false,financials:false,scopeMode:'selected',companyIds:[client.id],brandIds:[],projectIds:[]});
await act(member,'reportViewSave',{name:'Member Delivery View',report:'delivery',filters:{companyId:client.id}});
const memberViews=(await get(member)).state.savedReportViews;
assert.equal(memberViews[member.id].length,1,'read-only member with Reports can save personal view');
assert(!memberViews[owner.id],'member never sees owner saved report views');
await act(member,'reportViewDelete',{id:memberViews[member.id][0].id});
assert.equal((await get(member)).state.savedReportViews[member.id].length,0,'member can delete own saved view');

// 4. Server-enforced CSV export (/api/reports/export): 401 unauthenticated, 403 without Reports, financial redaction, scope isolation, CSV formula escaping.
assert.equal((await reportsExportApi.GET(reportExpReq(null,'?report=pipeline'))).status,401,'unauthenticated report CSV export returns 401');
const ownerPipeCsvRes=await reportsExportApi.GET(reportExpReq(owner,'?report=pipeline'));
assert.equal(ownerPipeCsvRes.status,200);
const ownerPipeCsv=await ownerPipeCsvRes.text();
assert(ownerPipeCsv.includes('Value (PHP)'),'owner pipeline CSV includes financial column');
assert(ownerPipeCsv.includes("'+Tracked Pipeline Deal"),'report CSV escapes formula prefixes');

const memberPipeCsvRes=await reportsExportApi.GET(reportExpReq(member,'?report=pipeline'));
assert.equal(memberPipeCsvRes.status,200);
const memberPipeCsv=await memberPipeCsvRes.text();
assert(!memberPipeCsv.includes('Value (PHP)'),'non-financial member pipeline CSV omits financial column');
assert(!memberPipeCsv.includes('Restricted Client'),'member report CSV never leaks out-of-scope companies');

await act(owner,'member',{personId:person.id,sections:['Projects'],canEdit:false,financials:false,scopeMode:'selected',companyIds:[client.id],brandIds:[],projectIds:[]});
await act(member,'reportViewSave',{name:'Denied',report:'delivery',filters:{}},403);
assert.equal((await reportsExportApi.GET(reportExpReq(member,'?report=delivery'))).status,403,'member without Reports section gets 403 on report CSV export');

// 5. Backup/restore preserves lifecycle history and excludes personal savedReportViews.
const inc6Backup=await (await recovery.GET(recReq(owner,'GET',null,'?format=json'))).json();
assert(!('savedReportViews'in inc6Backup.records),'personal savedReportViews are excluded from downloadable backups');
const inc6Prev=await rec('preview',{backup:inc6Backup});
await rec('restore',{backup:inc6Backup,checksum:inc6Prev.checksum,confirm:'RESTORE WORKSPACE'});
const afterInc6=(await get(owner)).state;
assert.equal(afterInc6.opportunities.find(o=>o.id===trackedDeal.id).stageHistory.length,4,'deal stageHistory survives backup/restore');
assert.equal(afterInc6.tasks.find(t=>t.id===calTask.id).reschedules.length,1,'task reschedules survive backup/restore');
assert(afterInc6.tasks.find(t=>t.id===calTask.id).completedAt&&afterInc6.tasks.find(t=>t.id===calTask.id).reopenedAt,'task completedAt and reopenedAt survive backup/restore');
assert.equal(afterInc6.projects.find(p=>p.id===closeProj.id).completedAt,closedProj.completedAt,'project completedAt survives backup/restore');
assert.deepEqual(afterInc6.savedReportViews[owner.id],[],'personal savedReportViews reset cleanly on restore');
console.log('PASS: Rev 8 Increment 6 — lifecycle history, Task Calendar sync, 5 reports, saved views isolation, permission-controlled CSV export, financial redaction, backup/restore.');

// Co-owners share one workspace, with independent actor identity and full permissions.
sqlite.exec('DELETE FROM request_limits');
const coOwner={id:'co-owner-test',email:'co-owner@example.test',name:'Co-owner Test'};
await act(owner,'person',{name:coOwner.name,email:coOwner.email,hats:''});
const coOwnerPerson=current.state.people.find(p=>p.email===coOwner.email);
const coOwnerGrant={personId:coOwnerPerson.id,coOwner:true,sections:[],canEdit:false,financials:false};
assert.equal((await api.GET(req(coOwner))).status,403);
await act(owner,'member',coOwnerGrant);
const shared=await get(coOwner);
assert.equal(shared.session.isOwner,true);
assert.equal(shared.session.financials,true);
assert.equal(shared.session.canEdit,true);
assert.equal(shared.session.id,coOwner.id);
assert.deepEqual(shared.session.sections,(await get(owner)).session.sections);
assert.deepEqual(shared.state.projects,(await get(owner)).state.projects);

await act(coOwner,'note',{title:'Private co-owner test',text:'Owner-only shared note',confidential:true,links:[{type:'project',id:permittedProject.id}]});
assert((await get(owner)).state.notes.some(n=>n.title==='Private co-owner test'));
const coOwnerBackup=await recovery.GET(recReq(coOwner,'GET',null,'?format=json'));
assert.equal(coOwnerBackup.status,200);
assert.equal((await coOwnerBackup.json()).workspace,owner.id,'backups use the shared workspace identity');

await act(coOwner,'person',{name:'Pilot Restricted Tester',email:'pilot-tester@example.test',hats:''});
const restrictedPerson=current.state.people.find(p=>p.name==='Pilot Restricted Tester');
await act(coOwner,'member',{personId:restrictedPerson.id,sections:['My Day'],canEdit:false,financials:false});
const restrictedPilot={id:'pilot-restricted',email:restrictedPerson.email,name:restrictedPerson.name};
assert.equal((await get(restrictedPilot)).session.isOwner,false);
await act(restrictedPilot,'member',coOwnerGrant,403);

// Updates from one browser account are readable by the other account and survive restore.
const sharedPin={id:'pin-pilot-test',kind:'announcement',title:'Team planning pin',body:'Shared board test',pinned:false,author:'client-supplied',createdAt:'2026-11-24T00:00:00.000Z'};
const sharedMeeting={id:'meeting-pilot-test',title:'Shared kickoff',date:'2026-11-25',startTime:'09:00',endTime:'10:00',owner:coOwner.name,attendees:[coOwner.name],status:'Scheduled',projectId:permittedProject.id};
const sharedRetro={id:'project:'+permittedProject.id,targetType:'project',targetId:permittedProject.id,rating:'Smooth win',wentWell:'Team handoff',couldImprove:'',playbook:'',updatedAt:'2026-11-24T00:00:00.000Z',updatedBy:'client-supplied'};
await act(coOwner,'sharedWork',{collection:'studioPins',upserts:[sharedPin],removeIds:[]});
await act(coOwner,'sharedWork',{collection:'meetings',upserts:[sharedMeeting],removeIds:[]});
await act(coOwner,'sharedWork',{collection:'retrospectives',upserts:[sharedRetro],removeIds:[]});
let sharedOwner=await get(owner);
assert.equal(sharedOwner.state.studioPins.find(p=>p.id===sharedPin.id).author,coOwner.name);
assert.equal(sharedOwner.state.meetings.find(m=>m.id===sharedMeeting.id).createdBy,coOwner.name);
assert.equal(sharedOwner.state.retrospectives.find(r=>r.id===sharedRetro.id).updatedBy,coOwner.name);
await act(restrictedPilot,'sharedWork',{collection:'studioPins',upserts:[sharedPin],removeIds:[]},403);
assert.deepEqual((await get(restrictedPilot)).state.studioPins,[]);
assert.deepEqual((await get(restrictedPilot)).state.meetings,[]);
assert.deepEqual((await get(restrictedPilot)).state.retrospectives,[]);
await act(owner,'sharedWork',{collection:'meetings',upserts:[{...sharedMeeting,projectId:'missing'}],removeIds:[]},400);
const sharedBackup=await (await recovery.GET(recReq(owner,'GET',null,'?format=json'))).json();
assert(sharedBackup.records.studioPins.some(p=>p.id===sharedPin.id));
assert(sharedBackup.records.meetings.some(m=>m.id===sharedMeeting.id));
assert(sharedBackup.records.retrospectives.some(r=>r.id===sharedRetro.id));
await act(owner,'sharedWork',{collection:'meetings',upserts:[{...sharedMeeting,date:'2026-11-26'}],removeIds:[]});
assert.equal((await get(coOwner)).state.meetings.find(m=>m.id===sharedMeeting.id).date,'2026-11-26');
sqlite.exec('DELETE FROM request_limits');
const sharedPreview=await rec('preview',{backup:sharedBackup});
await rec('restore',{backup:sharedBackup,checksum:sharedPreview.checksum,confirm:'RESTORE WORKSPACE'});
assert.equal((await get(coOwner)).state.meetings.find(m=>m.id===sharedMeeting.id).date,'2026-11-25');
console.log('PASS: shared Studio Board, meetings and retrospectives cross-account sync, access and backup restore.');

await act(coOwner,'clear',{confirm:'CLEAR SAMPLE'});
assert.equal((await get(owner)).state.projects.length,0);
assert.equal((await get(coOwner)).session.isOwner,true);
await act(coOwner,'sample',{});
assert.equal((await get(owner)).state.sampleWorkspace,true);
assert.equal((await get(coOwner)).session.isOwner,true,'loading sample data keeps co-owner access');
await act(owner,'memberRemove',{personId:coOwnerPerson.id});
assert.equal((await api.GET(req(coOwner))).status,403);
console.log('PASS: co-owner shared records, confidential access, member management, backups, reset, sample loading and revocation.');

// Full record editing across Contacts, Companies, Brands, Suppliers, People, Touchpoints, Waiting On, Approvals, Projects, Deals & Tasks.
sqlite.exec('DELETE FROM request_limits');
const editState=(await get(owner)).state;
const editCo1=editState.companies[0];
const editCo2=editState.companies[1];
const editBr1=editState.brands.find(b=>b.companyId===editCo1.id);
const editBr2=editState.brands.find(b=>b.companyId===editCo2.id);
const editCt1=editState.contacts.find(c=>c.companyId===editCo1.id);
const editCt2=editState.contacts.find(c=>c.companyId===editCo2.id);
const editSup1=editState.suppliers[0];
const editProj1=editState.projects.find(p=>p.companyId===editCo1.id);
const editProjTasks=editState.tasks.filter(t=>t.projectId===editProj1.id);
const editDeal1=editState.opportunities.find(o=>o.companyId===editCo1.id);
const editWait1=editState.waiting.find(w=>w.projectId===editProj1.id);
const editAppr1=editState.approvals.find(a=>a.projectId===editProj1.id);

// Owner edits across all newly editable cards + expanded fields.
await act(owner,'contactEdit',{id:editCt1.id,companyId:editCo1.id,brandId:editBr1?.id||'',name:'Updated Contact Name',title:'VP Marketing',email:'updated.contact@example.test',phone:'+63 917 555 0199',typeId:'',owner:'Owner Test',hat:'Account management'});
assert.equal(current.state.contacts.find(c=>c.id===editCt1.id).name,'Updated Contact Name');
assert.equal(current.state.contacts.find(c=>c.id===editCt1.id).title,'VP Marketing');

await act(owner,'companyEdit',{id:editCo1.id,name:'Updated Client Corp',contact:'Updated Main Contact'});
assert.equal(current.state.companies.find(c=>c.id===editCo1.id).name,'Updated Client Corp');

await act(owner,'brandEdit',{id:editBr1.id,name:'Updated Brand Name'});
assert.equal(current.state.brands.find(b=>b.id===editBr1.id).name,'Updated Brand Name');

await act(owner,'supplierEdit',{id:editSup1.id,name:'Updated Supplier Co',service:'LED & Audio Production',contact:'Rico Tan'});
assert.equal(current.state.suppliers.find(x=>x.id===editSup1.id).service,'LED & Audio Production');

// personEdit cascades owner rename across records & validates unique names / member email rules.
await act(owner,'person',{name:'Cascade Tester',email:'',hats:'Sales'});
const cascadePerson=current.state.people.find(p=>p.name==='Cascade Tester');
await act(owner,'contactEdit',{id:editCt1.id,companyId:editCo1.id,brandId:editBr1?.id||'',name:'Updated Contact Name',title:'VP Marketing',email:'updated.contact@example.test',phone:'+63 917 555 0199',typeId:'',owner:'Cascade Tester',hat:'Account management'});
await act(owner,'personEdit',{id:cascadePerson.id,name:'Cascade Renamed',email:'cascade@example.test',hats:'Sales, Project lead'});
assert.equal(current.state.people.find(p=>p.id===cascadePerson.id).name,'Cascade Renamed');
assert.equal(current.state.contacts.find(c=>c.id===editCt1.id).owner,'Cascade Renamed','personEdit cascades renamed owner to assigned records');
await act(owner,'personEdit',{id:cascadePerson.id,name:'Owner Test',email:'cascade@example.test',hats:'Sales'},400);
await act(owner,'personEdit',{id:person.id,name:'Member Test',email:'',hats:'Sales'},400);

// touchpointEdit updates fields and syncs linked follow-up task due date.
await act(owner,'touchpoint',{companyId:editCo1.id,contactId:editCt1.id,opportunityId:'',projectId:editProj1.id,channel:'Phone',summary:'Initial sync',owner:'Owner Test',hat:'Sales',nextAction:'Send deck',followup:'2026-11-26',createFollowupTask:true});
const editTp=current.state.touchpoints.at(-1);
await act(owner,'touchpointEdit',{id:editTp.id,companyId:editCo1.id,contactId:editCt1.id,opportunityId:'',projectId:editProj1.id,channel:'Meeting',summary:'Revised sync summary',owner:'Owner Test',hat:'Account management',nextAction:'Send updated deck',followup:'2026-12-03'});
assert.equal(current.state.touchpoints.find(t=>t.id===editTp.id).summary,'Revised sync summary');
assert.equal(current.state.tasks.find(t=>t.id===editTp.followupTaskId).due,'2026-12-03','touchpointEdit syncs linked follow-up task due date');

// waitingEdit & approvalEdit.
await act(owner,'waitingEdit',{id:editWait1.id,taskId:editWait1.taskId||'',name:'Updated waiting item',party:'Supplier',person:'Updated Vendor',owner:'Owner Test',hat:'Project lead',due:'2026-12-04',followup:'2026-12-01',impact:'Updated impact'});
assert.equal(current.state.waiting.find(w=>w.id===editWait1.id).party,'Supplier');

await act(owner,'doc',{title:'Edit Approval Doc',url:'https://files.example.test/edit-approval-doc',docType:'Brief',owner:'Owner Test',hat:'Account management',status:'For Review',description:'Linked doc',tags:'',audience:'internal',pinned:false,links:[{type:'project',id:editProj1.id}]});
const editApprovalDoc=current.state.documents[0];
await act(owner,'approvalEdit',{id:editAppr1.id,name:'Updated approval title',reviewer:'New Reviewer',due:'2026-12-06',note:'Updated version note',documentId:editApprovalDoc.id});
const updatedAppr=current.state.approvals.find(a=>a.id===editAppr1.id);
assert.equal(updatedAppr.name,'Updated approval title');
assert.equal(updatedAppr.documentId,editApprovalDoc.id);

// Expanded dealEdit, projectEdit, taskEdit.
await act(owner,'dealEdit',{id:editDeal1.id,name:'Renamed Deal',brandId:editBr1.id,owner:'Owner Test',hat:'Sales',value:330000,nextAction:'Confirm budget',nextActionDate:'2026-12-05'});
assert.equal(current.state.opportunities.find(o=>o.id===editDeal1.id).name,'Renamed Deal');

await act(owner,'projectEdit',{id:editProj1.id,name:'Renamed Project',engagement:'Renamed Engagement',brandId:editBr1.id,owner:'Owner Test',hat:'Project lead',start:'2026-11-20',due:'2026-12-20',budget:500000,cost:250000});
const updatedProj=current.state.projects.find(p=>p.id===editProj1.id);
assert.equal(updatedProj.name,'Renamed Project');assert.equal(updatedProj.budget,500000);

await act(owner,'taskEdit',{id:editProjTasks[0].id,name:'Renamed Task',owner:'Owner Test',supplierId:editSup1.id,due:'2026-12-08',hat:'Design',dependsOn:''});
assert.equal(current.state.tasks.find(t=>t.id===editProjTasks[0].id).name,'Renamed Task');
await act(owner,'taskEdit',{id:editProjTasks[0].id,name:'Self Dep',owner:'Owner Test',supplierId:'',due:'2026-12-08',dependsOn:editProjTasks[0].id},400);

// Restricted-member permission & scope checks on all new/expanded edit actions.
await act(owner,'member',{personId:person.id,sections:['Projects','CRM Pipeline','Contacts','Touchpoints','Companies & brands','Waiting on','Approvals','Suppliers'],canEdit:true,financials:false,scopeMode:'selected',companyIds:[editCo1.id],brandIds:[],projectIds:[]});
await act(member,'personEdit',{id:cascadePerson.id,name:'Forbidden Rename',email:'cascade@example.test',hats:''},403);
await act(member,'supplierEdit',{id:editSup1.id,name:'Out Of Scope Supplier',service:'',contact:''},403);
await act(member,'companyEdit',{id:editCo2.id,name:'Out Of Scope Co',contact:''},403);
await act(member,'brandEdit',{id:editBr2.id,name:'Out Of Scope Brand'},403);
await act(member,'contactEdit',{id:editCt2.id,companyId:editCo2.id,brandId:'',name:'Out Of Scope Contact',title:'',email:'',phone:'',typeId:'',owner:'Member Test'},403);
await act(member,'projectEdit',{id:editProj1.id,name:'Try Finance',owner:'Member Test',start:'2026-11-20',due:'2026-12-20',budget:999999,cost:100},403);
await act(member,'approvalEdit',{id:editAppr1.id,name:'Missing Docs Section',reviewer:'New Reviewer',due:'2026-12-06',note:'Denied without Documents section'},403);
// Permitted in-scope edits succeed for member.
await act(member,'companyEdit',{id:editCo1.id,name:'Member Updated Client',contact:'Member Contact'});
await act(member,'brandEdit',{id:editBr1.id,name:'Member Updated Brand'});
await act(member,'contactEdit',{id:editCt1.id,companyId:editCo1.id,brandId:editBr1.id,name:'Member Updated Contact',title:'Lead',email:'',phone:'',typeId:'',owner:'Member Test',hat:'Account management'});
await act(member,'projectEdit',{id:editProj1.id,name:'Member Renamed Project',owner:'Member Test',start:'2026-11-20',due:'2026-12-20'});
assert.equal((await get(owner)).state.projects.find(p=>p.id===editProj1.id).budget,500000,'non-financial member projectEdit preserves existing budget');
console.log('PASS: full card editing — contacts, companies, brands, suppliers, people (with owner cascade), touchpoints (with task due sync), waiting on, approvals, projects, deals, tasks, and scope/financial/document permissions.');

// Recovery points are bounded; old daily copies are pruned without deleting audit history.
sqlite.exec('DELETE FROM request_limits');
for(let i=0;i<22;i++)sqlite.prepare("INSERT INTO recovery_points VALUES (?,?,?,'manual',0,'{}')").run('old-'+i,owner.id,new Date(i*1000).toISOString());await rec('backup');assert.equal(sqlite.prepare("SELECT count(*) AS n FROM recovery_points WHERE owner=? AND kind='manual'").get(owner.id).n,20);
// Requests are bounded per account and do not allow further writes once exhausted.
sqlite.prepare('INSERT OR REPLACE INTO request_limits VALUES (?,?,?)').run(owner.id+':write',Math.floor(Date.now()/60000),120);await act(owner,'company',{name:'Rate denied',contact:''},429);
console.log('PASS: record scope isolation, cross-record writes denied, owner-only notes, backup ownership, JSON round-trip, stale/confirmed restore, membership preservation, checksum/schema rejection, CSV formula escaping, retention, separate security log, request limits.');
sqlite.close();await rm(dir,{recursive:true,force:true});
console.log('PASS: stage migration; lost at all 7 stages; reopening/history; contact warmth; work-role edits; reminder ownership/read/reschedule; member projection; forbidden writes; hidden finances; read-only membership; revocation; stale/origin guards.');
