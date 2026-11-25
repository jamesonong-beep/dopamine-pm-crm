'use client';
import {useEffect,useRef,useState} from 'react';
import {Upload} from 'lucide-react';
const datasets=['contactTypes','projectTemplates','projects','tasks','notes','documents','studioPins','meetings','retrospectives','opportunities','contacts','touchpoints','companies','brands','suppliers','waiting','approvals','people','activity','confidentialNotes'];
type Point={id:string;created_at:string;kind:string;revision:number};type Event={id:string;actor:string;at:string;action:string;detail:string};
type Preview={counts:Record<string,number>;currentCounts:Record<string,number>;checksum:string;revision:number};
export default function RecoveryPanel({onRestore}:{onRestore:()=>Promise<void>}){
 const [points,setPoints]=useState<Point[]>([]),[events,setEvents]=useState<Event[]>([]);
 const [revision,setRevision]=useState<number|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [dataset,setDataset]=useState('projects');
 const [source,setSource]=useState<Record<string,unknown>|null>(null);
 const [preview,setPreview]=useState<Preview|null>(null),[confirm,setConfirm]=useState('');
 const [pickedFile,setPickedFile]=useState<File|null>(null);
 const [deleteId,setDeleteId]=useState('');
 const [feedbackArea,setFeedbackArea]=useState<'backup'|'restore'>('backup');
 const fileInputRef=useRef<HTMLInputElement|null>(null);

 async function refresh(){
  const r=await fetch('/api/recovery');
  const j=await r.json() as {error?:string;points:Point[];events:Event[];revision:number};
  if(!r.ok)throw Error(j.error||'Could not load recovery points');
  setPoints(j.points);setEvents(j.events);setRevision(j.revision);
 }
 useEffect(()=>{refresh().catch(e=>setError(e.message))},[]);

 function clearPreview(){
  setPreview(null);setSource(null);setConfirm('');
 }
 async function refreshPoints(){
  setBusy(true);setFeedbackArea('backup');setError('');setNotice('');setDeleteId('');clearPreview();
  try{await refresh()}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function action(kind:'backup'|'preview'|'restore'|'deletePoint',extra:Record<string,unknown>={}){
  setFeedbackArea(kind==='backup'?'backup':'restore');
  setBusy(true);setError('');setNotice('');
  const expectedRevision=preview?.revision??revision;
  if(kind!=='restore')clearPreview();
  if(kind!=='deletePoint')setDeleteId('');
  try{
   const r=await fetch('/api/recovery',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:kind,revision:expectedRevision,...extra})
   });
   const j=await r.json() as Preview&{error?:string};
   if(!r.ok)throw Error(j.error||'Recovery request failed');
   if(kind==='preview'){
    setPreview(j);setRevision(j.revision);setSource(extra);
    return;
   }
   clearPreview();
   if(kind==='deletePoint'){
    setPoints(current=>current.filter(point=>point.id!==extra.id));
    setDeleteId('');
    setNotice('Recovery point deleted.');
   }else if(kind==='restore'){
    setNotice('Records restored. A recovery point of the replaced records was saved.');
    await onRestore();
   }else{
    setNotice('Recovery point saved. Download a JSON copy to keep an independent backup.');
   }
   await refresh();
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function loadBackup(file:File){
  setFeedbackArea('restore');setError('');setNotice('');setDeleteId('');clearPreview();setBusy(true);
  try{
   if(file.size>6000000)throw Error('Choose a backup smaller than 6 MB.');
   const contents=await file.text();
   let backup:unknown;
   try{backup=JSON.parse(contents.replace(/^\uFEFF/,''))}
   catch{throw Error('This file could not be read as JSON. Choose a DOPAMINE JSON backup.')}
   await action('preview',{backup});
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 const feedback=<>{error&&<p className="error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}</>;
 return <div className="recovery-panels"><section className="panel access"><h2>Backups & Recovery</h2><p>Owner only. Before the first saved change each Manila day, the app keeps a recovery point for 30 days. It also retains the latest 20 manual backups and 20 pre-restore / pre-clear copies. No changes means no new daily copy.</p><p>These recovery points share the app’s storage. Download a separate copy regularly so a storage or account problem does not affect every backup.</p><div className="actions"><button className="primary" disabled={busy||revision===null} onClick={()=>action('backup')}>Back Up Now</button><a className="download-link" href="/api/recovery?format=json">Download Full JSON Backup</a><button disabled={busy} onClick={refreshPoints}>Refresh Recovery Points</button></div><p className="form-note">Downloaded files contain personal and confidential records and are not encrypted. Keep them in a private, encrypted location. Sign-in settings and member permissions are not included in the downloadable backup; restoration preserves current permissions.</p>{feedbackArea==='backup'&&feedback}</section>
 <section className="panel access"><h2>Export For Excel</h2><p>Choose a dataset to download as CSV. Record IDs preserve relationships between files. CSV is for reporting or migration; use JSON for a complete restore.</p><div className="actions"><select aria-label="Export dataset" value={dataset} onChange={e=>setDataset(e.target.value)}>{datasets.map(k=><option key={k} value={k}>{k==='studioPins'?'Studio Board Pins':k==='contactTypes'?'Contact Types':k==='projectTemplates'?'Project Templates':k==='confidentialNotes'?'Confidential Notes':k[0].toUpperCase()+k.slice(1)}</option>)}</select><a className="download-link" href={'/api/recovery?format=csv&dataset='+dataset}>Download CSV</a></div></section>
 <section className="panel access">
  <h2>Restore Records</h2>
  <p>Preview the record counts before restoring. Restoring replaces business records, including ordinary activity history. Current member access and the separate security log remain unchanged.</p>
  <div className="file-pill-field" style={{marginBottom:'1rem'}}>
   <span className="file-pill-label">Open A Downloaded JSON Backup</span>
   <div className="file-pill-row">
    <input ref={fileInputRef} disabled={busy} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-label="Choose a JSON backup" onChange={e=>{
     const file=e.currentTarget.files?.[0];
     if(!file)return;
     setPickedFile(file);setFeedbackArea('restore');setError('');setNotice('');setDeleteId('');clearPreview();
     e.currentTarget.value='';
    }}/>
    <button type="button" className="file-pill-btn" disabled={busy} onClick={()=>fileInputRef.current?.click()}><Upload size={14}/>Choose File</button>
    <span className="file-pill-name">{pickedFile?.name||'No file selected'}</span>
   </div>
   <div className="actions" style={{marginTop:8}}>
    <button type="button" className="primary" disabled={!pickedFile||busy||revision===null} onClick={()=>{if(pickedFile)void loadBackup(pickedFile)}}>Load Backup</button>
   </div>
  </div>
  {feedbackArea==='restore'&&feedback}
  <div className="table-wrap">
   <table>
    <thead><tr><th>Saved</th><th>Type</th><th>Revision</th><th>Actions</th></tr></thead>
    <tbody>{points.map(p=><tr key={p.id}>
     <td>{new Date(p.created_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}</td>
     <td>{p.kind}</td><td>{p.revision}</td>
     <td>
      <div className="actions">
       <button type="button" disabled={busy} onClick={()=>action('preview',{id:p.id})}>Preview Restore</button>
       <a href={'/api/recovery?format=json&id='+encodeURIComponent(p.id)}>Download</a>
       <button type="button" disabled={busy} aria-expanded={deleteId===p.id} onClick={()=>{
        setDeleteId(p.id);setFeedbackArea('restore');setError('');setNotice('');clearPreview();
       }}>Delete</button>
      </div>
      {deleteId===p.id&&<div>
       <p>Delete this saved recovery point permanently?</p>
       <div className="actions">
        <button type="button" className="danger-button" disabled={busy} onClick={()=>action('deletePoint',{id:p.id,pointRevision:p.revision,confirm:'DELETE RECOVERY POINT'})}>Delete Recovery Point</button>
        <button type="button" disabled={busy} onClick={()=>setDeleteId('')}>Cancel</button>
       </div>
      </div>}
     </td>
    </tr>)}</tbody>
   </table>
  </div>
  {!points.length&&<p>No recovery points yet. Use Back Up Now to save the current records.</p>}
  {preview&&<div className="restore-preview">
   <h3>Review Before Replacing Records</h3>
   <div className="table-wrap">
    <table>
     <thead><tr><th>Dataset</th><th>Current</th><th>After Restore</th></tr></thead>
     <tbody>{Object.entries(preview.counts).map(([k,n])=><tr key={k}><td>{k}</td><td>{preview.currentCounts[k]}</td><td>{n}</td></tr>)}</tbody>
    </table>
   </div>
   <label>Type RESTORE WORKSPACE<input value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="off"/></label>
   <div className="actions">
    <button type="button" className="danger-button" disabled={busy||confirm!=='RESTORE WORKSPACE'||!source} onClick={()=>action('restore',{...source,checksum:preview.checksum,confirm})}>Replace Workspace Records</button>
    <button type="button" disabled={busy} onClick={clearPreview}>Cancel Restore</button>
   </div>
  </div>}
 </section>
 <section className="panel access"><h2>Security Log</h2><p>The latest 100 events. This separate server log survives record restores and clearing the workspace. It has no edit or delete action in the app; it is not a tamper-proof external archive.</p><div className="table-wrap"><table><thead><tr><th>When</th><th>Account ID</th><th>Action</th><th>Details</th></tr></thead><tbody>{events.map(e=><tr key={e.id}><td>{new Date(e.at).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}</td><td>{e.actor}</td><td>{e.action}</td><td>{e.detail}</td></tr>)}</tbody></table></div></section></div>
}
