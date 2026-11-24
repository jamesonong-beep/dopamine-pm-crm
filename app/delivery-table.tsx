'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
const labels=['Task','Status','Owner / Supplier','Due','Dependency'];
const defaults=[310,155,210,175,220];
const minimums=[220,120,160,155,150];
export default function DeliveryTable({userId,children}:{userId:string;children:ReactNode}){
 const [widths,setWidths]=useState(defaults);const [loaded,setLoaded]=useState(false);
 const drag=useRef<{index:number;x:number;width:number}|null>(null);
 const key=`dopamine:delivery-columns:v1:${userId}`;
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem(key)||'null');setWidths(Array.isArray(saved)&&saved.length===5&&saved.every((v,i)=>typeof v==='number'&&v>=minimums[i]&&v<=800)?saved:defaults)}catch{setWidths(defaults)}setLoaded(true)},[key]);
 useEffect(()=>{if(loaded)try{localStorage.setItem(key,JSON.stringify(widths))}catch{}},[key,loaded,widths]);
 function resize(index:number,width:number){setWidths(w=>w.map((v,i)=>i===index?Math.min(800,Math.max(minimums[i],width)):v))}
 return <><div className="column-tools"><span>Drag a column edge to resize. Or focus an edge and use ← / →. Scroll sideways for more columns.</span><button onClick={()=>setWidths([...defaults])}>Reset Columns</button></div><div className="table-wrap delivery-scroll" tabIndex={0} aria-label="Delivery board, scroll horizontally for more columns"><table className="delivery-table" style={{width:widths.reduce((a,b)=>a+b,0)}}><colgroup>{widths.map((w,i)=><col key={i} style={{width:w}}/>)}</colgroup><thead><tr>{labels.map((label,i)=><th key={label} scope="col">{label}<span className="column-resizer" role="separator" tabIndex={0} aria-label={`Resize ${label} column`} aria-orientation="vertical" aria-valuemin={minimums[i]} aria-valuemax={800} aria-valuenow={widths[i]} title="Drag to resize; arrow keys adjust width" onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();drag.current={index:i,x:e.clientX,width:widths[i]};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(drag.current?.index===i)resize(i,drag.current.width+e.clientX-drag.current.x)}} onPointerUp={e=>{drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}} onPointerCancel={()=>{drag.current=null}} onLostPointerCapture={()=>{drag.current=null}} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home'].includes(e.key)){e.preventDefault();resize(i,e.key==='Home'?defaults[i]:widths[i]+(e.key==='ArrowRight'?20:-20))}}}/></th>)}</tr></thead><tbody>{children}</tbody></table></div></>;
}
