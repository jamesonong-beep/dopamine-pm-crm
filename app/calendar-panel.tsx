'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {CalendarDays,Check,ChevronDown,ChevronLeft,ChevronRight,ChevronUp,Clock3,ExternalLink,GripVertical,ListPlus,MessagesSquare,Trash2,Users,Video} from 'lucide-react';
import {ResponsiveModal} from '@/components/ui/responsive-modal';
import {category,type State,type Task} from '../lib/model';
import {addDays,linkName,taskLinks,type Meeting,type MeetingStatus} from '../lib/workspace-links';
import HoverPreview from './hover-preview';

type CalendarPanelProps={
 state:State;
 today:string;
 editable:boolean;
 canInteract:boolean;
 canManageMeetings:boolean;
 busy:boolean;
 matches:(r:{owner?:string;hat?:string})=>boolean;
 meetings:Meeting[];
 onAddMeeting:(initialDate?:string)=>void;
 onAddTodo:(initialDate?:string)=>void;
 onUpdateMeeting:(id:string,patch:Partial<Meeting>)=>void;
 onDeleteMeeting:(id:string)=>void;
 onLogMeetingTouchpoint:(m:Meeting)=>void;
 onCreateTodoFromMeeting:(m:Meeting)=>void;
 onRescheduleTask:(task:Task,newDue:string)=>void;
 onTaskStatus:(taskId:string,status:string)=>void;
 onOpenTaskContext:(task:Task)=>void;
};

const fmtShort=(iso:string)=>iso?new Date(iso+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'}):'—';
const fmtFullDay=(iso:string)=>iso?new Date(iso+'T00:00:00').toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric',year:'numeric'}):'';
const isUrl=(v?:string)=>Boolean(v&&/^https?:\/\//i.test(v.trim()));
const fmtTimeRange=(start:string,end:string)=>start&&end?`${start}–${end}`:start||'All day';

type DragItem=
 | {kind:'task';task:Task;x:number;y:number;active:boolean}
 | {kind:'meeting';meeting:Meeting;x:number;y:number;active:boolean};

export default function CalendarPanel({
 state,today,editable,canInteract,canManageMeetings,busy,matches,meetings,onAddMeeting,onAddTodo,onUpdateMeeting,onDeleteMeeting,onLogMeetingTouchpoint,onCreateTodoFromMeeting,onRescheduleTask,onTaskStatus,onOpenTaskContext
}:CalendarPanelProps){
 const [monthStr,setMonthStr]=useState(()=>today.slice(0,7));
 const [companyFilter,setCompanyFilter]=useState('');
 const [showDone,setShowDone]=useState(false);
 const [showMeetings,setShowMeetings]=useState(true);
 const [expandedIds,setExpandedIds]=useState<Record<string,boolean>>({});
 const [expandedDate,setExpandedDate]=useState('');
 const [draggingKey,setDraggingKey]=useState('');
 const [dragPoint,setDragPoint]=useState<{x:number;y:number}|null>(null);
 const [dropDate,setDropDate]=useState('');
 const dragRef=useRef<DragItem|null>(null);
 const suppressClickRef=useRef(false);

 const doneStatusName=state.taskStatuses.find(st=>st.category==='done')?.name||'Done';
 const [year,month]=monthStr.split('-').map(Number);
 const monthLabel=new Date(Date.UTC(year,month-1,1)).toLocaleDateString('en-PH',{month:'long',year:'numeric',timeZone:'UTC'});

 const shiftMonth=(delta:number)=>{
  const d=new Date(Date.UTC(year,month-1+delta,1));
  setMonthStr(d.toISOString().slice(0,7));
 };

 const visibleTasks=useMemo(()=>state.tasks.filter(t=>{
  if(!matches(t))return false;
  if(!showDone&&category(state,t.status)==='done')return false;
  if(companyFilter){
   const p=t.projectId?state.projects.find(x=>x.id===t.projectId):undefined;
   const links=taskLinks(t);
   const matchesCo=p?.companyId===companyFilter||links.some(l=>l.type==='company'&&l.id===companyFilter);
   if(!matchesCo)return false;
  }
  return Boolean(t.due);
 }),[state,matches,showDone,companyFilter]);

 const visibleMeetings=useMemo(()=>{
  if(!showMeetings)return [];
  return meetings.filter(m=>{
   if(!matches(m))return false;
   if(companyFilter){
    const p=m.projectId?state.projects.find(x=>x.id===m.projectId):undefined;
    const o=m.opportunityId?state.opportunities.find(x=>x.id===m.opportunityId):undefined;
    const co=m.companyId||p?.companyId||o?.companyId||'';
    if(co!==companyFilter)return false;
   }
   return Boolean(m.date);
  });
 },[meetings,showMeetings,matches,companyFilter,state.projects,state.opportunities]);

 const cells=useMemo(()=>{
  const firstDow=new Date(Date.UTC(year,month-1,1)).getUTCDay();
  const daysInMonth=new Date(Date.UTC(year,month,0)).getUTCDate();
  const out:{iso:string|null;dayNum:number|null}[]=[];
  for(let i=0;i<firstDow;i++)out.push({iso:null,dayNum:null});
  for(let d=1;d<=daysInMonth;d++){
   const iso=`${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
   out.push({iso,dayNum:d});
  }
  while(out.length%7!==0)out.push({iso:null,dayNum:null});
  return out;
 },[year,month]);

 const tasksByDay=useMemo(()=>{
  const map=new Map<string,Task[]>();
  for(const t of visibleTasks){
   const list=map.get(t.due)||[];
   list.push(t);
   map.set(t.due,list);
  }
  return map;
 },[visibleTasks]);

 const meetingsByDay=useMemo(()=>{
  const map=new Map<string,Meeting[]>();
  for(const m of visibleMeetings){
   const list=map.get(m.date)||[];
   list.push(m);
   map.set(m.date,list);
  }
  for(const list of map.values()){
   list.sort((a,b)=>(a.startTime||'').localeCompare(b.startTime||''));
  }
  return map;
 },[visibleMeetings]);

 const toggleExpanded=(key:string)=>{
  setExpandedIds(prev=>({...prev,[key]:!prev[key]}));
 };

 useEffect(()=>{
  const clearDrag=()=>{
   dragRef.current=null;
   setDraggingKey('');
   setDragPoint(null);
   setDropDate('');
  };
  const onMove=(e:PointerEvent)=>{
   const d=dragRef.current;
   if(!d)return;
   if(e.buttons===0){clearDrag();return;}
   if(!d.active){
    if(Math.hypot(e.clientX-d.x,e.clientY-d.y)<6)return;
    d.active=true;
    suppressClickRef.current=true;
    setDraggingKey(d.kind==='task'?`task:${d.task.id}`:`meeting:${d.meeting.id}`);
   }
   const px=Math.max(8,Math.min(e.clientX+16,window.innerWidth-256));
   const py=Math.max(8,Math.min(e.clientY+16,window.innerHeight-110));
   setDragPoint({x:px,y:py});
   const cellEl=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-calendar-date]');
   setDropDate(cellEl?.dataset.calendarDate||'');
  };
  const onUp=(e:PointerEvent)=>{
   const d=dragRef.current;
   if(!d)return;
   const targetDate=d.active?document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-calendar-date]')?.dataset.calendarDate:'';
   clearDrag();
   if(d.active){
    setTimeout(()=>{suppressClickRef.current=false;},0);
    if(targetDate&&canInteract&&!busy&&(d.kind!=='meeting'||canManageMeetings)){
     if(d.kind==='task'&&targetDate!==d.task.due){
      onRescheduleTask(d.task,targetDate);
     }else if(d.kind==='meeting'&&targetDate!==d.meeting.date){
      onUpdateMeeting(d.meeting.id,{date:targetDate});
     }
    }
   }
  };
  const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')clearDrag();};
  window.addEventListener('pointermove',onMove);
  window.addEventListener('pointerup',onUp);
  window.addEventListener('pointercancel',clearDrag);
  window.addEventListener('blur',clearDrag);
  window.addEventListener('keydown',onKey);
  return()=>{
   window.removeEventListener('pointermove',onMove);
   window.removeEventListener('pointerup',onUp);
   window.removeEventListener('pointercancel',clearDrag);
   window.removeEventListener('blur',clearDrag);
   window.removeEventListener('keydown',onKey);
  };
 },[canInteract,canManageMeetings,busy,onRescheduleTask,onUpdateMeeting]);

 const startTaskPointer=(e:React.PointerEvent<HTMLElement>,task:Task)=>{
  if(!canInteract||busy||e.button!==0)return;
  if((e.target as HTMLElement).closest('select,input,textarea,button,a,label'))return;
  e.preventDefault();
  dragRef.current={kind:'task',task,x:e.clientX,y:e.clientY,active:false};
 };

 const startMeetingPointer=(e:React.PointerEvent<HTMLElement>,meeting:Meeting)=>{
  if(!canManageMeetings||busy||e.button!==0)return;
  if((e.target as HTMLElement).closest('select,input,textarea,button,a,label'))return;
  e.preventDefault();
  dragRef.current={kind:'meeting',meeting,x:e.clientX,y:e.clientY,active:false};
 };

 const draggingTask=draggingKey.startsWith('task:')?state.tasks.find(t=>t.id===draggingKey.slice(5)):undefined;
 const draggingMeeting=draggingKey.startsWith('meeting:')?meetings.find(m=>m.id===draggingKey.slice(8)):undefined;

 const meetingContextLabel=(m:Meeting)=>{
  const parts:string[]=[];
  if(m.companyId){const c=state.companies.find(x=>x.id===m.companyId);if(c)parts.push(c.name);}
  if(m.brandId){const b=state.brands.find(x=>x.id===m.brandId);if(b)parts.push(b.name);}
  if(m.opportunityId){const o=state.opportunities.find(x=>x.id===m.opportunityId);if(o)parts.push(`Deal: ${o.name}`);}
  if(m.projectId){const p=state.projects.find(x=>x.id===m.projectId);if(p)parts.push(`Project: ${p.name}`);}
  return parts.join(' · ')||'General meeting';
 };

 const expandedDayMeetings=expandedDate?(meetingsByDay.get(expandedDate)||[]):[];
 const expandedDayTasks=expandedDate?(tasksByDay.get(expandedDate)||[]):[];

 return <>
  {dragPoint&&draggingTask&&<div className="deal-pointer-preview" aria-live="polite" style={{transform:`translate3d(${dragPoint.x}px,${dragPoint.y}px,0)`}}>
   <strong>{draggingTask.name}</strong>
   <small>To-do · {draggingTask.owner} · {draggingTask.status}</small>
   <span>{dropDate?`Move to ${fmtShort(dropDate)}`:'Drag onto a date'}</span>
  </div>}
  {dragPoint&&draggingMeeting&&<div className="deal-pointer-preview" aria-live="polite" style={{transform:`translate3d(${dragPoint.x}px,${dragPoint.y}px,0)`}}>
   <strong>{draggingMeeting.title}</strong>
   <small>Meeting · {fmtTimeRange(draggingMeeting.startTime,draggingMeeting.endTime)} · {draggingMeeting.owner}</small>
   <span>{dropDate?`Reschedule to ${fmtShort(dropDate)}`:'Drag onto a date'}</span>
  </div>}

  <div className="toolbar cal-toolbar">
   <div className="actions">
    <button type="button" aria-label="Previous month" onClick={()=>shiftMonth(-1)}><ChevronLeft size={16}/></button>
    <strong className="cal-month-label"><CalendarDays size={15}/>{monthLabel}</strong>
    <button type="button" aria-label="Next month" onClick={()=>shiftMonth(1)}><ChevronRight size={16}/></button>
    <button type="button" onClick={()=>setMonthStr(today.slice(0,7))}>Today</button>
   </div>
   <select aria-label="Calendar company filter" value={companyFilter} onChange={e=>setCompanyFilter(e.target.value)}>
    <option value="">All companies</option>
    {state.companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
   </select>
   <label className="cal-done-toggle">
    <input type="checkbox" checked={showMeetings} onChange={e=>setShowMeetings(e.target.checked)}/>
    Show meetings
   </label>
   <label className="cal-done-toggle">
    <input type="checkbox" checked={showDone} onChange={e=>setShowDone(e.target.checked)}/>
    Show completed tasks
   </label>
   {canInteract&&<div className="actions">
    {canManageMeetings&&<button type="button" className="mini-btn" onClick={()=>onAddMeeting(today)}><Video size={13}/>+ Add meeting</button>}
    <button type="button" className="mini-btn" onClick={()=>onAddTodo(today)}><ListPlus size={13}/>+ Add to-do</button>
   </div>}
   <small className="muted">Click any date box to expand the day and add meetings or to-dos, or drag cards onto another date.</small>
  </div>

  <section className="panel cal-panel">
   <div className="cal-grid">
    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,i)=><div key={d} className={'cal-weekday'+(i===0||i===6?' cal-weekday-weekend':'')}>{d}</div>)}
    {cells.map((cell,idx)=>{
     const dayMeetings=cell.iso?(meetingsByDay.get(cell.iso)||[]):[];
     const items=cell.iso?(tasksByDay.get(cell.iso)||[]):[];
     const totalCount=dayMeetings.length+items.length;
     const isToday=cell.iso===today;
     const isWeekend=idx%7===0||idx%7===6;
     const isDropTarget=Boolean(cell.iso&&dropDate===cell.iso);
     return <div
      key={idx}
      data-calendar-date={cell.iso||undefined}
      onClick={e=>{
       if(!cell.iso||suppressClickRef.current)return;
       if((e.target as HTMLElement).closest('.cal-task-card,.cal-meeting-card,button,a,input,select,textarea,label'))return;
       setExpandedDate(cell.iso);
      }}
      className={'cal-cell'+(cell.iso?' cal-cell-clickable':' cal-cell-empty')+(isWeekend&&cell.iso?' cal-cell-weekend':'')+(isToday?' cal-cell-today':'')+(isDropTarget?' calendar-drop-target':'')}
     >
      {cell.dayNum&&cell.iso&&<div className="cal-day-head">
       <button type="button" className="cal-day-num-btn" title={`Open ${fmtFullDay(cell.iso)}`} onClick={()=>setExpandedDate(cell.iso!)}>{cell.dayNum}</button>
       <div className="cal-day-badges">
        {totalCount>0&&!isToday&&<span className="cal-day-count">{totalCount}</span>}
        {isToday&&<span className="badge red">Today</span>}
       </div>
      </div>}
      <div className="cal-day-items">
       {dayMeetings.map(m=>{
        const mKey=`meeting:${m.id}`;
        const isExpanded=Boolean(expandedIds[mKey]);
        const isDragging=draggingKey===mKey;
        const ctxLabel=meetingContextLabel(m);
        const mTone=m.status==='Completed'?'green':m.status==='Canceled'?'red':'blue';
        const hoverContent=<div className="hp-body">
         <div className="hp-head">
          <strong>{m.title}</strong>
          <span className={`badge ${mTone}`}>{m.status}</span>
         </div>
         <div className="hp-sub">{ctxLabel}{m.hat?` · ${m.hat}`:''}</div>
         <div className="hp-grid">
          <div><span>Time</span><strong>{fmtTimeRange(m.startTime,m.endTime)}</strong></div>
          <div><span>Host</span><strong>{m.owner}</strong></div>
         </div>
         {m.attendees.length>0&&<div className="hp-note"><strong>Attendees:</strong> {m.attendees.join(', ')}</div>}
         {m.locationOrLink&&<div className="hp-note"><strong>Where:</strong> {m.locationOrLink}</div>}
         {m.agenda&&<div className="hp-note"><strong>Agenda:</strong> {m.agenda}</div>}
         <div className="hp-hint">Meeting · Click for quick actions &amp; editing · Drag to reschedule</div>
        </div>;
        return <HoverPreview key={m.id} content={hoverContent} disabled={Boolean(draggingKey)||isExpanded}>
         <article
          draggable={false}
          onDragStart={e=>e.preventDefault()}
          onPointerDown={e=>startMeetingPointer(e,m)}
          onClick={e=>{
           if(suppressClickRef.current)return;
           if((e.target as HTMLElement).closest('select,input,textarea,button,a,label'))return;
           toggleExpanded(mKey);
          }}
          className={'cal-meeting-card'+(m.status==='Completed'?' is-completed':m.status==='Canceled'?' is-canceled':'')+(isExpanded?' cal-task-expanded':'')+(isDragging?' cal-task-dragging':'')}
          style={{cursor:canInteract?'grab':'pointer'}}
         >
          <div className="cal-task-head">
           <span className="cal-meeting-time"><Clock3 size={10}/>{fmtTimeRange(m.startTime,m.endTime)}</span>
           <span className="cal-task-grip">
            {canInteract&&<GripVertical size={11} aria-hidden="true"/>}
            {isExpanded?<ChevronUp size={11}/>:<ChevronDown size={11}/>}
           </span>
          </div>
          <div className="cal-task-title">{m.title}</div>
          <div className="cal-task-meta"><Video size={10} style={{display:'inline',marginRight:3}}/>{m.owner}{m.attendees.length>1?` · ${m.attendees.length} people`:''}</div>

          {isExpanded&&<div className="cal-task-body">
           <div className="cal-task-sub">{ctxLabel}</div>
           {m.attendees.length>0&&<div className="cal-task-sub"><Users size={10} style={{display:'inline',marginRight:3}}/>{m.attendees.join(', ')}</div>}
           {m.agenda&&<div className="cal-task-sub">{m.agenda}</div>}
           {m.locationOrLink&&(isUrl(m.locationOrLink)
            ?<a className="studio-link" href={m.locationOrLink} target="_blank" rel="noopener noreferrer" style={{fontSize:11}}>Join meeting <ExternalLink size={10}/></a>
            :<div className="cal-task-sub">Location: {m.locationOrLink}</div>)}
           <label className="cal-task-field">
            Date
            <input
             key={`${m.id}-${m.date}`}
             type="date"
             defaultValue={m.date}
             disabled={!canManageMeetings||busy}
             onChange={e=>{if(e.target.value&&e.target.value!==m.date)onUpdateMeeting(m.id,{date:e.target.value});}}
            />
           </label>
           <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
            <label className="cal-task-field">
             Start
             <input type="time" value={m.startTime} disabled={!canManageMeetings||busy} onChange={e=>onUpdateMeeting(m.id,{startTime:e.target.value})}/>
            </label>
            <label className="cal-task-field">
             End
             <input type="time" value={m.endTime} disabled={!canManageMeetings||busy} onChange={e=>onUpdateMeeting(m.id,{endTime:e.target.value})}/>
            </label>
           </div>
           <label className="cal-task-field">
            Status
            <select value={m.status} disabled={!canManageMeetings||busy} onChange={e=>onUpdateMeeting(m.id,{status:e.target.value as MeetingStatus})}>
             <option value="Scheduled">Scheduled</option>
             <option value="Completed">Completed</option>
             <option value="Canceled">Canceled</option>
            </select>
           </label>
           <div className="cal-meeting-actions">
            <button type="button" className="mini-btn" onClick={()=>onLogMeetingTouchpoint(m)}><MessagesSquare size={10}/>Log Touchpoint</button>
            <button type="button" className="mini-btn" onClick={()=>onCreateTodoFromMeeting(m)}><ListPlus size={10}/>Create To-do</button>
           </div>
           <div className="cal-task-actions">
            {canManageMeetings&&<button type="button" className="mini-btn danger-button" onClick={()=>onDeleteMeeting(m.id)}><Trash2 size={10}/>Delete</button>}
            <button type="button" className="mini-btn" onClick={()=>toggleExpanded(mKey)}>Collapse</button>
           </div>
          </div>}
         </article>
        </HoverPreview>;
       })}

       {items.map(t=>{
        const tKey=`task:${t.id}`;
        const isDone=category(state,t.status)==='done';
        const isOverdue=!isDone&&t.due<today;
        const isExpanded=Boolean(expandedIds[tKey]);
        const isDragging=draggingKey===tKey;
        const tLinks=taskLinks(t);
        const linkedLabel=tLinks.map(l=>linkName(state,l)).join(' · ')||'Workspace task';
        const openBlockers=state.waiting.filter(w=>!w.resolved&&w.taskId===t.id);
        const depTask=t.dependsOn?state.tasks.find(x=>x.id===t.dependsOn):undefined;
        const hoverContent=<div className="hp-body">
         <div className="hp-head">
          <strong>{t.name}</strong>
          <span className={`badge ${isDone?'green':isOverdue?'red':'blue'}`}>{t.status}</span>
         </div>
         <div className="hp-sub">{linkedLabel}{t.hat?` · ${t.hat}`:''}</div>
         <div className="hp-grid">
          <div><span>Owner</span><strong>{t.owner}</strong></div>
          <div><span>Due</span><strong>{fmtShort(t.due)}{isOverdue?' (Overdue)':''}</strong></div>
         </div>
         {t.reschedules?.length?<div className="hp-note">Rescheduled {t.reschedules.length}× (orig: {fmtShort(t.originalDue||t.reschedules[0].from)})</div>:null}
         {depTask&&<div className="hp-note">Depends on: {depTask.name} ({depTask.status})</div>}
         {openBlockers.length>0&&<div className="hp-alert">Blocked by: {openBlockers.map(w=>`${w.name} (${w.person})`).join(', ')}</div>}
         <div className="hp-hint">To-do · Click to edit inline · Drag onto another date to reschedule</div>
        </div>;
        return <HoverPreview key={t.id} content={hoverContent} disabled={Boolean(draggingKey)||isExpanded}>
         <article
          draggable={false}
          onDragStart={e=>e.preventDefault()}
          onPointerDown={e=>startTaskPointer(e,t)}
          onClick={e=>{
           if(suppressClickRef.current)return;
           if((e.target as HTMLElement).closest('select,input,textarea,button,a,label'))return;
           toggleExpanded(tKey);
          }}
          className={'cal-task-card'+(isDone?' cal-task-done':isOverdue?' cal-task-overdue':'')+(isExpanded?' cal-task-expanded':'')+(isDragging?' cal-task-dragging':'')}
          style={{cursor:canInteract?'grab':'pointer'}}
         >
          <div className="cal-task-head">
           <div className="cal-task-title">{t.name}</div>
           <span className="cal-task-grip">
            {canInteract&&<GripVertical size={12} aria-hidden="true"/>}
            {isExpanded?<ChevronUp size={12}/>:<ChevronDown size={12}/>}
           </span>
          </div>
          <div className="cal-task-meta">{t.owner} · {t.status}</div>

          {isExpanded&&<div className="cal-task-body">
           <div className="cal-task-sub">
            {linkedLabel}
            {t.hat?` · ${t.hat}`:''}
           </div>
           <div className="cal-task-sub small">
            {t.reschedules?.length?`Rescheduled ${t.reschedules.length}× (orig: ${fmtShort(t.originalDue||t.reschedules[0].from)})`:`Due ${fmtShort(t.due)}`}
           </div>
           <label className="cal-task-field">
            Due date
            <input
             key={`${t.id}-${t.due}`}
             type="date"
             aria-label={`Reschedule calendar task: ${t.name}`}
             defaultValue={t.due}
             disabled={!canInteract||busy}
             onChange={e=>{if(e.target.value&&e.target.value!==t.due)onRescheduleTask(t,e.target.value)}}
            />
           </label>
           <label className="cal-task-field">
            Status
            <select
             aria-label={`Calendar task status: ${t.name}`}
             disabled={!canInteract||busy}
             value={t.status}
             onChange={e=>onTaskStatus(t.id,e.target.value)}
            >
             {state.taskStatuses.map(st=><option key={st.name} value={st.name}>{st.name}</option>)}
            </select>
           </label>
           <div className="cal-task-actions">
            <button type="button" className="mini-btn" onClick={()=>onOpenTaskContext(t)}>Open record</button>
            <button type="button" className="mini-btn" onClick={()=>toggleExpanded(tKey)}>Collapse</button>
           </div>
           {!editable&&canInteract&&<small style={{fontSize:10}}>Preview mode — sign in to save changes.</small>}
          </div>}
         </article>
        </HoverPreview>;
       })}
      </div>
     </div>;
    })}
   </div>
  </section>

  <ResponsiveModal
   open={Boolean(expandedDate)}
   onOpenChange={open=>{if(!open)setExpandedDate('');}}
   title={expandedDate?fmtFullDay(expandedDate):'Day Details'}
  >
   {expandedDate&&<div className="cal-day-modal">
    <div className="cal-day-modal-bar">
     <div className="actions">
      <button type="button" className="mini-btn" aria-label="Previous day" onClick={()=>setExpandedDate(addDays(expandedDate,-1))}><ChevronLeft size={14}/>Prev day</button>
      <button type="button" className="mini-btn" aria-label="Next day" onClick={()=>setExpandedDate(addDays(expandedDate,1))}>Next day<ChevronRight size={14}/></button>
      {expandedDate!==today&&<button type="button" className="mini-btn" onClick={()=>setExpandedDate(today)}>Today</button>}
     </div>
     {canInteract&&<div className="actions">
      {canManageMeetings&&<button type="button" className="primary" onClick={()=>{const d=expandedDate;setExpandedDate('');onAddMeeting(d);}}><Video size={14}/>+ Add meeting</button>}
      <button type="button" onClick={()=>{const d=expandedDate;setExpandedDate('');onAddTodo(d);}}><ListPlus size={14}/>+ Add to-do</button>
     </div>}
    </div>

    <div className="cal-day-section">
     <div className="cal-day-section-head">
      <h3><Video size={15}/> Meetings ({expandedDayMeetings.length})</h3>
     </div>
     {expandedDayMeetings.length>0?(
      <div className="cal-day-modal-list">
       {expandedDayMeetings.map(m=><div key={m.id} className={'cal-day-modal-item meeting'+(m.status==='Completed'?' is-completed':m.status==='Canceled'?' is-canceled':'')}>
        <div className="cal-day-modal-item-top">
         <span className="cal-meeting-time"><Clock3 size={11}/>{fmtTimeRange(m.startTime,m.endTime)}</span>
         <strong>{m.title}</strong>
         <select value={m.status} disabled={!canManageMeetings||busy} onChange={e=>onUpdateMeeting(m.id,{status:e.target.value as MeetingStatus})} style={{marginLeft:'auto',padding:'4px 8px',fontSize:12}}>
          <option value="Scheduled">Scheduled</option>
          <option value="Completed">Completed</option>
          <option value="Canceled">Canceled</option>
         </select>
        </div>
        <small>{meetingContextLabel(m)} · Host: {m.owner}{m.attendees.length>0?` · Attendees: ${m.attendees.join(', ')}`:''}</small>
        {m.agenda&&<p>{m.agenda}</p>}
        <div className="actions" style={{marginTop:6}}>
         {m.locationOrLink&&(isUrl(m.locationOrLink)
          ?<a className="edit-pill" href={m.locationOrLink} target="_blank" rel="noopener noreferrer">Join <ExternalLink size={12}/></a>
          :<span className="origin-pill">{m.locationOrLink}</span>)}
         {canInteract&&<button type="button" className="mini-btn" onClick={()=>{setExpandedDate('');onLogMeetingTouchpoint(m);}}><MessagesSquare size={11}/>Log Touchpoint</button>}
         {canInteract&&<button type="button" className="mini-btn" onClick={()=>{setExpandedDate('');onCreateTodoFromMeeting(m);}}><ListPlus size={11}/>Create To-do</button>}
         {canManageMeetings&&<button type="button" className="mini-btn danger-button" onClick={()=>onDeleteMeeting(m.id)}><Trash2 size={11}/>Delete</button>}
        </div>
       </div>)}
      </div>
     ):<p className="muted" style={{fontSize:13}}>No meetings scheduled for this day.</p>}
    </div>

    <div className="cal-day-section">
     <div className="cal-day-section-head">
      <h3><ListPlus size={15}/> To-dos ({expandedDayTasks.length})</h3>
     </div>
     {expandedDayTasks.length>0?(
      <div className="cal-day-modal-list">
       {expandedDayTasks.map(t=>{
        const isDone=category(state,t.status)==='done';
        const linked=taskLinks(t).map(l=>linkName(state,l)).join(' · ')||'Workspace task';
        return <div key={t.id} className={'cal-day-modal-item task'+(isDone?' is-completed':'')}>
         <div className="cal-day-modal-item-top">
          <strong>{t.name}</strong>
          <select value={t.status} disabled={!canInteract||busy} onChange={e=>onTaskStatus(t.id,e.target.value)} style={{marginLeft:'auto',padding:'4px 8px',fontSize:12}}>
           {state.taskStatuses.map(st=><option key={st.name} value={st.name}>{st.name}</option>)}
          </select>
         </div>
         <small>{linked} · Owner: {t.owner}{t.hat?` (${t.hat})`:''}</small>
         <div className="actions" style={{marginTop:6}}>
          {canInteract&&!isDone&&<button type="button" className="mini-btn" onClick={()=>onTaskStatus(t.id,doneStatusName)}><Check size={12}/>Mark Done</button>}
          <button type="button" className="mini-btn" onClick={()=>{setExpandedDate('');onOpenTaskContext(t);}}>Open record</button>
         </div>
        </div>;
       })}
      </div>
     ):<p className="muted" style={{fontSize:13}}>No to-dos due on this day.</p>}
    </div>
   </div>}
  </ResponsiveModal>
 </>;
}
