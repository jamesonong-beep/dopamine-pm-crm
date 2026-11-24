'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';

type HoverPreviewProps={
 content:ReactNode;
 children:ReactNode;
 disabled?:boolean;
 delayMs?:number;
 className?:string;
 maxWidth?:number;
};

export default function HoverPreview({
 content,
 children,
 disabled=false,
 delayMs=180,
 className='',
 maxWidth=310
}:HoverPreviewProps){
 const anchorRef=useRef<HTMLDivElement|null>(null);
 const timerRef=useRef<number|null>(null);
 const pointerRef=useRef<{x:number;y:number}|null>(null);
 const [open,setOpen]=useState(false);
 const [pos,setPos]=useState<{top:number;left:number;placement:'top'|'bottom'}|null>(null);

 const clearTimer=()=>{
  if(timerRef.current!==null){
   window.clearTimeout(timerRef.current);
   timerRef.current=null;
  }
 };

 const close=()=>{
  clearTimer();
  setOpen(false);
 };

 useEffect(()=>{
  if(disabled)close();
 },[disabled]);

 useEffect(()=>{
  if(!open)return;
  const onScroll=()=>close();
  const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')close();};
  window.addEventListener('scroll',onScroll,true);
  window.addEventListener('keydown',onKey);
  return()=>{
   window.removeEventListener('scroll',onScroll,true);
   window.removeEventListener('keydown',onKey);
  };
 },[open]);

 useEffect(()=>()=>clearTimer(),[]);

 const computePos=()=>{
  const wrapper=anchorRef.current;
  if(!wrapper)return null;
  // .hover-preview-anchor uses display:contents so measure the real child element's box
  const target=(wrapper.firstElementChild as HTMLElement|null)||wrapper;
  const rect=target.getBoundingClientRect();
  const hasBox=rect.width>0||rect.height>0;
  const margin=8;
  const width=Math.min(maxWidth,window.innerWidth-24);
  const estHeight=210;

  const anchorTop=hasBox?rect.top:(pointerRef.current?.y??120);
  const anchorBottom=hasBox?rect.bottom:(pointerRef.current?.y??120)+16;
  const anchorCenterX=hasBox?(rect.left+rect.width/2):(pointerRef.current?.x??160);

  const spaceBelow=window.innerHeight-anchorBottom;
  const spaceAbove=anchorTop;
  const placement:'top'|'bottom'=spaceBelow<estHeight&&spaceAbove>spaceBelow?'top':'bottom';
  let left=anchorCenterX-width/2;
  left=Math.max(12,Math.min(left,window.innerWidth-width-12));
  const top=placement==='bottom'?anchorBottom+margin:anchorTop-margin;
  return {top,left,placement};
 };

 const handleEnter=(e:React.MouseEvent<HTMLDivElement>)=>{
  if(disabled||!content)return;
  pointerRef.current={x:e.clientX,y:e.clientY};
  clearTimer();
  timerRef.current=window.setTimeout(()=>{
   const next=computePos();
   if(next){
    setPos(next);
    setOpen(true);
   }
  },delayMs);
 };

 return <>
  <div
   ref={anchorRef}
   className={'hover-preview-anchor'+(className?` ${className}`:'')}
   onMouseEnter={handleEnter}
   onMouseLeave={close}
   onPointerDown={close}
  >
   {children}
  </div>
  {open&&pos&&typeof document!=='undefined'&&createPortal(
   <div
    className={`hover-preview-card placement-${pos.placement}`}
    role="tooltip"
    style={{
     top:pos.top,
     left:pos.left,
     width:`min(${maxWidth}px, calc(100vw - 24px))`
    }}
   >
    {content}
   </div>,
   document.body
  )}
 </>;
}
