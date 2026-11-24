'use client';
import {useEffect,type ReactNode} from 'react';
import {X} from 'lucide-react';

type SideDrawerProps={
 open:boolean;
 onClose:()=>void;
 eyebrow?:string;
 title:string;
 subtitle?:string;
 actions?:ReactNode;
 lockEscape?:boolean;
 children:ReactNode;
};

export default function SideDrawer({
 open,
 onClose,
 eyebrow,
 title,
 subtitle,
 actions,
 lockEscape=false,
 children
}:SideDrawerProps){
 useEffect(()=>{
  if(!open)return;
  const onKey=(e:KeyboardEvent)=>{
   if(e.key==='Escape'&&!lockEscape){
    e.preventDefault();
    onClose();
   }
  };
  const prevOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  window.addEventListener('keydown',onKey);
  return()=>{
   document.body.style.overflow=prevOverflow;
   window.removeEventListener('keydown',onKey);
  };
 },[open,onClose,lockEscape]);

 if(!open)return null;

 return (
  <div className="side-drawer-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!lockEscape)onClose();}}>
   <div
    className="side-drawer-panel"
    role="dialog"
    aria-modal="true"
    aria-label={title}
   >
    <header className="side-drawer-header">
     <div className="side-drawer-title-wrap">
      {eyebrow&&<span className="side-drawer-eyebrow">{eyebrow}</span>}
      <h2>{title}</h2>
      {subtitle&&<p>{subtitle}</p>}
     </div>
     <div className="side-drawer-actions">
      {actions}
      <button type="button" className="mini-btn side-drawer-close" onClick={onClose} aria-label="Close detail panel" title="Close (Esc)">
       <X size={16}/> Close
      </button>
     </div>
    </header>
    <div className="side-drawer-body">
     {children}
    </div>
   </div>
  </div>
 );
}
