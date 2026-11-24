import {env} from 'cloudflare:workers';
import {day,type State} from './model';
export class HttpError extends Error {constructor(message:string,public status=400){super(message)}}
const db=()=>env.DB!;
export async function rateLimit(user:string,bucket:string,max:number){
 const window=Math.floor(Date.now()/60000);const key=`${user}:${bucket}`;
 const row=await db().prepare('INSERT INTO request_limits (key,window,count) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET window=excluded.window,count=CASE WHEN request_limits.window=excluded.window THEN request_limits.count+1 ELSE 1 END RETURNING count').bind(key,window).first<{count:number}>();
 if(!row||row.count>max)throw new HttpError('Too many requests. Please wait a minute and try again.',429);
}
export async function securityLog(owner:string,actor:string,action:string,detail=''){
 await db().prepare('INSERT INTO security_events (id,owner,actor,at,action,detail) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),owner,actor,new Date().toISOString(),action,detail.slice(0,500)).run();
}
export type WorkspaceRow={owner:string;revision:number;data:string};
// D1 batches are atomic. All three writes use the same optimistic revision guard.
export async function commitWorkspace(row:WorkspaceRow,state:State,actor:string,action:string){
 const now=new Date().toISOString();const safety=['restore','clear'].includes(action);const id=safety?crypto.randomUUID():`${row.owner}:daily:${day()}`;
 const results=await db().batch([
 db().prepare('INSERT OR IGNORE INTO recovery_points (id,owner,created_at,kind,revision,data) SELECT ?,owner,?,?,revision,data FROM workspaces WHERE owner=? AND revision=?').bind(id,now,safety?'before-'+action:'daily',row.owner,row.revision),
 db().prepare('INSERT INTO security_events (id,owner,actor,at,action,detail) SELECT ?,owner,?,?,?,? FROM workspaces WHERE owner=? AND revision=?').bind(crypto.randomUUID(),actor,now,action,`Revision ${row.revision} to ${row.revision+1}`,row.owner,row.revision),
 db().prepare('UPDATE workspaces SET data=?,revision=revision+1 WHERE owner=? AND revision=?').bind(JSON.stringify(state),row.owner,row.revision)
 ]);
 if(!results[2].meta.changes)throw new HttpError('Workspace changed. Refresh and review again before saving.',409);
 // Cleanup is best effort; a retained extra backup is safer than misreporting a saved edit.
 try{await prune(row.owner)}catch{}
}
export async function prune(owner:string){
 const cutoff=new Date(Date.now()-30*86400000).toISOString();
 await db().batch([
 db().prepare("DELETE FROM recovery_points WHERE owner=? AND kind='daily' AND created_at<?").bind(owner,cutoff),
 db().prepare("DELETE FROM recovery_points WHERE owner=? AND kind='manual' AND id NOT IN (SELECT id FROM recovery_points WHERE owner=? AND kind='manual' ORDER BY created_at DESC LIMIT 20)").bind(owner,owner),
 db().prepare("DELETE FROM recovery_points WHERE owner=? AND kind LIKE 'before-%' AND id NOT IN (SELECT id FROM recovery_points WHERE owner=? AND kind LIKE 'before-%' ORDER BY created_at DESC LIMIT 20)").bind(owner,owner)
 ]);
}
export async function manualBackup(row:WorkspaceRow,actor:string){
 const id=crypto.randomUUID();const now=new Date().toISOString();
 const result=await db().batch([
 db().prepare("INSERT INTO recovery_points (id,owner,created_at,kind,revision,data) SELECT ?,owner,?,'manual',revision,data FROM workspaces WHERE owner=? AND revision=?").bind(id,now,row.owner,row.revision),
 db().prepare("INSERT INTO security_events (id,owner,actor,at,action,detail) SELECT ?,owner,?,?,'backup-created',? FROM workspaces WHERE owner=? AND revision=?").bind(crypto.randomUUID(),actor,now,id,row.owner,row.revision)
 ]);if(!result[0].meta.changes)throw new HttpError('Workspace changed. Refresh and back up again.',409);await prune(row.owner);return id;
}
