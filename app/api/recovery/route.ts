import {env} from 'cloudflare:workers';
import {context,ensureOwner} from '../../../lib/access';
import {commitWorkspace,deleteRecoveryPoint,manualBackup,rateLimit,securityLog,HttpError} from '../../../lib/security-storage';
import {csv,digest,envelope,exportSets,parseBackup,recordsOnly,validateRecords} from '../../../lib/backup-format';
import {normalize,type State} from '../../../lib/model';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const counts=(s:State)=>Object.fromEntries(exportSets.map(k=>[k,s[k]?.length||0]));
async function owner(req:Request){if(!req.headers.get('oai-authenticated-user-id'))throw new HttpError('Sign in required',401);await rateLimit(req.headers.get('oai-authenticated-user-id')!,'recovery-access',60);const c=await context(req);if(!c.isOwner){await securityLog(c.row.owner,c.user.id,'denied-recovery');throw new HttpError('Only the workspace owner can back up, export or restore records',403)}return c}
const failure=(e:unknown)=>reply({error:e instanceof HttpError?e.message:e instanceof Error&&!(e as any).issues?e.message:'Invalid backup file or request'},e instanceof HttpError?e.status:400);
export async function GET(req:Request){try{
 const c=await owner(req);const url=new URL(req.url);const format=url.searchParams.get('format');await rateLimit(c.user.id,'recovery-read',30);
 if(format){let state=c.state;let revision=c.row.revision;const id=url.searchParams.get('id');if(id){const r=await env.DB!.prepare('SELECT data,revision FROM recovery_points WHERE id=? AND owner=?').bind(id,c.row.owner).first<{data:string;revision:number}>();if(!r)throw new HttpError('Recovery point not found',404);state=normalize(JSON.parse(r.data));revision=r.revision}
 let data:string,type:string,name:string;
 if(format==='json'){data=JSON.stringify(await envelope(state,c.row.owner,revision),null,2);type='application/json';name='dopamine-backup'}
 else if(format==='csv'){const key=url.searchParams.get('dataset') as typeof exportSets[number];if(!exportSets.includes(key))throw Error('Choose a supported dataset');data=csv((state[key]||[]) as Record<string,unknown>[]);type='text/csv; charset=utf-8';name=`dopamine-${key}`}
 else throw Error('Choose JSON or CSV');
 await securityLog(c.row.owner,c.user.id,'export',`${format}:${url.searchParams.get('dataset')||'records'} revision ${revision}`);
 return new Response(data,{headers:{'Content-Type':type,'Content-Disposition':`attachment; filename="${name}-${new Date().toISOString().slice(0,10)}.${format}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})
 }
 const points=await env.DB!.prepare('SELECT id,created_at,kind,revision FROM recovery_points WHERE owner=? ORDER BY created_at DESC LIMIT 75').bind(c.row.owner).all();
 const events=await env.DB!.prepare('SELECT id,actor,at,action,detail FROM security_events WHERE owner=? ORDER BY at DESC LIMIT 100').bind(c.row.owner).all();return reply({points:points.results,events:events.results,revision:c.row.revision});
 }catch(e){return failure(e)}}
export async function POST(req:Request){try{
 if(req.headers.get('origin')!==new URL(req.url).origin)throw new HttpError('Origin not allowed',403);
 const c=await owner(req);await rateLimit(c.user.id,'recovery-write',10);
 if(Number(req.headers.get('content-length')||0)>6000000)throw Error('Backup exceeds 6 MB');const raw=await req.text();if(raw.length>6000000)throw Error('Backup exceeds 6 MB');const body=JSON.parse(raw);
 if(body.action==='deletePoint'){
  if(typeof body.id!=='string'||!body.id||!Number.isSafeInteger(body.pointRevision)||body.pointRevision<0||body.confirm!=='DELETE RECOVERY POINT')throw Error('Confirm which recovery point to delete.');
  await deleteRecoveryPoint(c.row.owner,c.user.id,body.id,body.pointRevision);
  return reply({deleted:true});
 }
 if(body.action!=='preview'&&body.revision!==c.row.revision)throw new HttpError('Workspace changed. Refresh and preview again.',409);
 if(body.action==='backup'){const id=await manualBackup(c.row,c.user.id);return reply({id})}
 if(!['preview','restore'].includes(body.action))throw Error('Unknown recovery action');
 let state:State;
 if(Object.hasOwn(body,'backup')){state=await parseBackup(body.backup,c.row.owner)}else{const point=await env.DB!.prepare('SELECT data FROM recovery_points WHERE id=? AND owner=?').bind(String(body.id||''),c.row.owner).first<{data:string}>();if(!point)throw new HttpError('Recovery point not found',404);state=validateRecords(recordsOnly(normalize(JSON.parse(point.data))))}
 const checksum=await digest(recordsOnly(state));
 if(body.action==='preview')return reply({counts:counts(state),currentCounts:counts(c.state),checksum,revision:c.row.revision});
 if(body.confirm!=='RESTORE WORKSPACE'||body.checksum!==checksum)throw Error('Preview this backup and type RESTORE WORKSPACE before restoring');
 state.members=c.state.members;state.readReminders={};state.pinnedPriorities={};state.reminderPrefs={};state.deliveryFailures=[];state.savedReportViews={};
 // A restore must not change who a membership refers to, even when its directory is older.
 for(const m of state.members||[]){const current=c.state.people.find(p=>p.id===m.personId);if(current){state.people=state.people.filter(p=>p.id!==current.id);state.people.push(current)}}
 ensureOwner(state,c.user);state.activity.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),text:'Owner restored workspace records from a recovery copy. Access permissions were preserved.',actor:c.user.name,actorId:c.user.id,section:'Access design'});
 if(JSON.stringify(state).length>2000000)throw Error('Restored workspace exceeds the size limit');
 await commitWorkspace(c.row,state,c.user.id,'restore');return reply({restored:true,revision:c.row.revision+1});
 }catch(e){return failure(e)}}
