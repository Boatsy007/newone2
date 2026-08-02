import type { ReactNode } from 'react'
import { Check, LoaderCircle } from 'lucide-react'

export const MEDIA_WORKFLOW_STEPS=['Choose content','Add details','Choose style','Generate','Review','Use it'] as const

export function MediaCreationWorkflow({currentStep,busy,status,children}:{currentStep:number;busy?:boolean;status?:string;children:ReactNode}){
 return <div className="mcw">
  <ol className="mcw-steps" aria-label="Creation progress">{MEDIA_WORKFLOW_STEPS.map((label,index)=>{const step=index+1;const complete=step<currentStep;const active=step===currentStep;return <li key={label} className={`${complete?'complete ':''}${active?'active':''}`}><span>{complete?<Check size={14}/>:active&&busy?<LoaderCircle className="mcw-spin" size={15}/>:step}</span><strong>{label}</strong></li>})}</ol>
  {status&&<div className="mcw-status" role="status">{busy&&<LoaderCircle className="mcw-spin" size={17}/>}<span>{status}</span></div>}
  {children}
  <style>{styles}</style>
 </div>
}

export function MediaWorkflowPanel({step,title,description,children,className=''}:{step:number;title:string;description?:string;children:ReactNode;className?:string}){
 return <section className={`mcw-panel ${className}`}><header><span>STEP {step}</span><div><h3>{title}</h3>{description&&<p>{description}</p>}</div></header><div className="mcw-panel-body">{children}</div></section>
}

export function MediaReviewActions({children}:{children:ReactNode}){return <div className="mcw-actions">{children}</div>}

const styles=`
.mcw{display:grid;gap:16px}.mcw-steps{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px;margin:0;padding:0;list-style:none}.mcw-steps li{display:flex;min-width:0;align-items:center;gap:7px;padding:9px 10px;border:1px solid #dce4ea;border-radius:12px;background:#f8fafb;color:#89939c}.mcw-steps li>span{display:grid;width:25px;height:25px;flex:0 0 auto;place-items:center;border-radius:50%;background:#e8edf1;font-size:10px;font-weight:950}.mcw-steps strong{overflow:hidden;font-size:9px;text-overflow:ellipsis;text-transform:uppercase;white-space:nowrap}.mcw-steps li.active{border-color:#8ed7ff;background:#edf8ff;color:#0678b8}.mcw-steps li.active>span{background:#129fe9;color:#fff}.mcw-steps li.complete{border-color:#bce8ce;background:#f0fbf5;color:#167343}.mcw-steps li.complete>span{background:#21b96b;color:#fff}.mcw-status{display:flex;align-items:center;gap:8px;padding:11px 13px;border-radius:11px;background:#edf8ff;color:#076ba5;font-size:12px;font-weight:850}.mcw-panel{overflow:hidden;border:1px solid #dce4ea;border-radius:16px;background:#fff}.mcw-panel>header{display:grid;grid-template-columns:auto 1fr;align-items:start;gap:12px;padding:15px 16px;border-bottom:1px solid #edf1f4;background:#fbfcfd}.mcw-panel>header>span{margin-top:3px;padding:5px 7px;border-radius:999px;background:#e6f5fe;color:#087bbf;font-size:8px;font-weight:950;letter-spacing:.08em}.mcw-panel h3{margin:0;font-size:17px}.mcw-panel p{margin:4px 0 0;color:#6d7882;font-size:11px;line-height:1.45}.mcw-panel-body{padding:16px}.mcw-actions{display:flex;flex-wrap:wrap;gap:8px}.mcw-actions button,.mcw-actions a{flex:1;min-width:120px}.mcw-spin{animation:mcw-spin .9s linear infinite}@keyframes mcw-spin{to{transform:rotate(360deg)}}@media(max-width:800px){.mcw-steps{grid-template-columns:repeat(3,1fr)}.mcw-steps strong{white-space:normal}}@media(max-width:480px){.mcw-steps{display:flex;overflow-x:auto;padding-bottom:2px}.mcw-steps li{min-width:112px}.mcw-panel>header{grid-template-columns:1fr}.mcw-panel>header>span{justify-self:start}}
`
