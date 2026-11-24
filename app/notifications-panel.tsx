'use client';
import {useState} from 'react';
import {Bell,Mail,AlertTriangle,FolderPlus,Clock3,CheckCircle2} from 'lucide-react';
import {defaultReminderPreference,type DeliveryFailure,type Opportunity,type Reminder,type ReminderPreference} from '../lib/model';

type Props={
 personName:string;
 userId:string;
 today:string;
 reminders:Reminder[];
 readIds:string[];
 pref?:ReminderPreference;
 failures:DeliveryFailure[];
 opportunities:Opportunity[];
 canCreateProject:boolean;
 busy:boolean;
 signed:boolean;
 onOpenReminder:(r:Reminder)=>void;
 onMarkRead:(id:string)=>void;
 onCreateProjectFromDeal:(o:Opportunity)=>void;
 onSavePrefs:(pref:ReminderPreference)=>void;
 onTestEmail:()=>void;
 onOpenMyDay:()=>void;
};

const formatDate=(s:string)=>s?new Date(s+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'}):'—';

export default function NotificationsPanel({
 personName,
 today,
 reminders,
 readIds,
 pref,
 failures,
 opportunities,
 canCreateProject,
 busy,
 signed,
 onOpenReminder,
 onMarkRead,
 onCreateProjectFromDeal,
 onSavePrefs,
 onTestEmail,
 onOpenMyDay
}:Props){
 const initial=pref||defaultReminderPreference();
 const [inApp,setInApp]=useState(initial.inApp);
 const [email,setEmail]=useState(initial.email);
 const [dailyDigest,setDailyDigest]=useState(initial.dailyDigest);
 const [digestTime,setDigestTime]=useState(initial.digestTime);

 const unreadCount=reminders.filter(r=>!readIds.includes(r.id)).length;
 const taskItems=reminders.filter(r=>r.kind==='task');
 const waitingItems=reminders.filter(r=>r.kind==='waiting');
 const touchItems=reminders.filter(r=>r.kind==='touchpoint');
 const handoffItems=reminders.filter(r=>r.kind==='handoff');

 return <>
  <div className="notification-banner">
   <strong>Reminders for {personName}</strong>
   <p>Due/overdue tasks, overdue waiting items to chase, dated touchpoint follow-ups, and signed contracts needing project creation appear here automatically. Completed, rescheduled, or handed-off items are suppressed as obsolete. Reading a reminder never completes the underlying work.</p>
   <small>Email provider status: not connected (no approved sending account configured in this local package). No email is labeled as sent until delivery is confirmed.</small>
  </div>

  <section className="panel">
   <div className="section-heading">
    <div>
     <h2>{unreadCount} unread reminders</h2>
     <p>{reminders.length} active deduplicated reminders across your permitted work.</p>
    </div>
    <button onClick={onOpenMyDay}>Open My Day</button>
   </div>
   {reminders.map(r=>{
    const deal=r.kind==='handoff'&&r.opportunityId?opportunities.find(o=>o.id===r.opportunityId):undefined;
    return <article className={'approval-card '+(readIds.includes(r.id)?'read':'unread')} key={r.id}>
     <div className="row">
      {r.kind==='handoff'?<FolderPlus size={18}/>:r.kind==='waiting'?<Clock3 size={18}/>:<Bell size={18}/>}
      <div className="grow">
       <strong>{r.title}</strong>
       <small>
        {r.section} · {r.hat||'General'} · Due {formatDate(r.due)}
        {r.due<today&&r.kind!=='handoff'?' · Overdue':''}
        {r.kind==='handoff'?' · Contract Signed':''}
       </small>
      </div>
     </div>
     <div className="actions">
      {deal&&canCreateProject&&<button className="primary" disabled={busy} onClick={()=>onCreateProjectFromDeal(deal)}>Create Project</button>}
      <button onClick={()=>onOpenReminder(r)}>Open work</button>
      {!readIds.includes(r.id)&&<button disabled={busy||!signed} onClick={()=>onMarkRead(r.id)}>Mark read</button>}
     </div>
    </article>;
   })}
   {!reminders.length&&<div className="empty">Nothing due for you right now. Assign work to your name with a due or follow-up date, or sign a deal to see handoff prompts.</div>}
  </section>

  <div className="two-column">
   <section className="panel access">
    <div className="section-heading" style={{padding:'0 0 12px'}}>
     <div>
      <h2><Mail size={17} style={{display:'inline',marginRight:6,verticalAlign:'-3px'}}/>Personal Delivery Preferences</h2>
      <p>Configure in-app reminders and your workspace-timezone (Asia/Manila) daily email digest.</p>
     </div>
    </div>
    <div className="permission-list">
     <label><input type="checkbox" checked={inApp} disabled={!signed||busy} onChange={e=>setInApp(e.target.checked)}/>In-app reminders</label>
     <label><input type="checkbox" checked={email} disabled={!signed||busy} onChange={e=>setEmail(e.target.checked)}/>Email reminders (pending sending account)</label>
     <label><input type="checkbox" checked={dailyDigest} disabled={!signed||busy} onChange={e=>setDailyDigest(e.target.checked)}/>Daily email digest</label>
    </div>
    <div className="day-toolbar" style={{margin:'8px 0 16px'}}>
     <label>Digest time (Asia/Manila) <input type="time" value={digestTime} disabled={!signed||busy} onChange={e=>setDigestTime(e.target.value||'08:30')}/></label>
    </div>
    <div className="actions">
     <button className="primary" disabled={!signed||busy} onClick={()=>onSavePrefs({inApp,email,dailyDigest,digestTime,timezone:'Asia/Manila'})}>Save Preferences</button>
     <button disabled={!signed||busy||(!email&&!dailyDigest)} onClick={onTestEmail}>Test Email Delivery</button>
    </div>
    <p className="form-note" style={{marginTop:14}}>Automatic client/supplier emails are out of scope. Email delivery requires an approved sending account; testing delivery without one logs a visible delivery failure below.</p>
   </section>

   <section className="panel access">
    <h2><CheckCircle2 size={17} style={{display:'inline',marginRight:6,verticalAlign:'-3px'}}/>Daily Digest Preview (Asia/Manila · {digestTime})</h2>
    <p>Exact items ready for your daily summary on {formatDate(today)}:</p>
    <div className="waiting-facts" style={{marginTop:10}}>
     <span><strong>Tasks due/overdue:</strong> {taskItems.length}</span>
     <span><strong>Waiting items to chase:</strong> {waitingItems.length}</span>
     <span><strong>Touchpoint follow-ups:</strong> {touchItems.length}</span>
     <span><strong>Signed contracts to hand off:</strong> {handoffItems.length}</span>
    </div>
    <h3 style={{marginTop:18,marginBottom:8,display:'flex',alignItems:'center',gap:6}}><AlertTriangle size={16}/>Delivery Failures ({failures.length})</h3>
    {failures.slice(0,5).map(f=><div className="confidential-note" key={f.id}>
     <strong>Email delivery failed ({f.reminderCount} {f.reminderCount===1?'item':'items'})</strong>
     <p style={{margin:'4px 0'}}>{f.reason}</p>
     <small>{new Date(f.at).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}</small>
    </div>)}
    {!failures.length&&<p className="muted">No delivery failures recorded.</p>}
   </section>
  </div>
 </>;
}
