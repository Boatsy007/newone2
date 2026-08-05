import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { PenTool, X } from 'lucide-react'

export default function MatchDayWhiteboardDrawer({clubId}:{clubId:string}){
 const[board,setBoard]=useState<HTMLElement|null>(null)
 const[active,setActive]=useState(false)
 const[open,setOpen]=useState(false)

 useEffect(()=>{
  let mounted=true
  const sync=()=>{
   if(!mounted)return
   const matchBoard=document.querySelector<HTMLElement>('.md')
   const fullscreen=Boolean(document.fullscreenElement||(document as Document&{webkitFullscreenElement?:Element|null}).webkitFullscreenElement||document.body.classList.contains('pf-match-day-focus'))
   setBoard(matchBoard)
   setActive(fullscreen)
   if(!fullscreen)setOpen(false)
  }
  sync()
  const observer=new MutationObserver(sync)
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']})
  document.addEventListener('fullscreenchange',sync)
  document.addEventListener('webkitfullscreenchange',sync as EventListener)
  return()=>{mounted=false;observer.disconnect();document.removeEventListener('fullscreenchange',sync);document.removeEventListener('webkitfullscreenchange',sync as EventListener)}
 },[])

 if(!active||!board)return null
 return createPortal(<>
  <button className="md-whiteboard-tab" type="button" onClick={()=>setOpen(true)} aria-label="Open whiteboard"><PenTool size={17}/><span>Whiteboard</span></button>
  {open?<section className="md-whiteboard-drawer" role="dialog" aria-modal="true" aria-label="Coaching whiteboard">
   <button className="md-whiteboard-close" type="button" onClick={()=>setOpen(false)} aria-label="Close whiteboard"><X size={24}/></button>
   <iframe title="PlayFooty coaching whiteboard" src={`/club-portal/${encodeURIComponent(clubId)}/whiteboard?embed=match-day`} />
  </section>:null}
  <style>{styles}</style>
 </>,board)
}

const styles=`
.md-whiteboard-tab{position:absolute;z-index:100097;left:0;top:calc(50% + 74px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;width:42px;min-height:126px;padding:10px 6px;border:1px solid #355064;border-left:0;border-radius:0 12px 12px 0;background:linear-gradient(180deg,#263d50,#132635);color:#fff;box-shadow:7px 0 20px rgba(0,0,0,.35);font-weight:950;text-transform:uppercase}.md-whiteboard-tab span{writing-mode:vertical-rl;transform:rotate(180deg);font-size:9px;letter-spacing:.08em}.md-whiteboard-drawer{position:absolute;z-index:100110;inset:0;overflow:hidden;background:#0b1219;animation:md-whiteboard-slide-in .24s ease-out both}.md-whiteboard-drawer iframe{display:block;width:100%;height:100%;border:0;background:#0b1219}.md-whiteboard-close{position:absolute;z-index:4;top:10px;right:10px;width:44px;height:44px;display:grid;place-items:center;border:1px solid #40515f;border-radius:12px;background:rgba(7,17,28,.94);color:#fff;box-shadow:0 7px 20px rgba(0,0,0,.35)}@keyframes md-whiteboard-slide-in{from{transform:translateX(-102%)}to{transform:translateX(0)}}
`
