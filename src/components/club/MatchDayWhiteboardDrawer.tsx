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
.md .md-whiteboard-tab,.md:fullscreen .md-whiteboard-tab,.md:-webkit-full-screen .md-whiteboard-tab,body.pf-match-day-focus .md .md-whiteboard-tab{position:absolute!important;z-index:100097!important;left:0!important;top:calc(50% + 74px)!important;right:auto!important;bottom:auto!important;display:flex!important;flex:0 0 42px!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:7px!important;width:42px!important;min-width:42px!important;max-width:42px!important;height:126px!important;min-height:126px!important;max-height:126px!important;margin:0!important;padding:10px 6px!important;border:1px solid #355064!important;border-left:0!important;border-radius:0 12px 12px 0!important;background:linear-gradient(180deg,#263d50,#132635)!important;color:#fff!important;box-shadow:7px 0 20px rgba(0,0,0,.35)!important;font-size:9px!important;font-weight:950!important;line-height:1!important;text-transform:uppercase!important;transform:none!important;overflow:hidden!important;box-sizing:border-box!important}
.md .md-whiteboard-tab svg,.md:fullscreen .md-whiteboard-tab svg,.md:-webkit-full-screen .md-whiteboard-tab svg,body.pf-match-day-focus .md .md-whiteboard-tab svg{display:block!important;flex:0 0 auto!important;width:17px!important;height:17px!important}
.md .md-whiteboard-tab span,.md:fullscreen .md-whiteboard-tab span,.md:-webkit-full-screen .md-whiteboard-tab span,body.pf-match-day-focus .md .md-whiteboard-tab span{display:block!important;width:auto!important;height:auto!important;writing-mode:vertical-rl!important;transform:rotate(180deg)!important;font-size:9px!important;line-height:1!important;letter-spacing:.08em!important;white-space:nowrap!important}
.md-whiteboard-drawer{position:absolute!important;z-index:100110!important;inset:0!important;overflow:hidden!important;background:#0b1219!important;animation:md-whiteboard-slide-in .24s ease-out both!important}.md-whiteboard-drawer iframe{display:block!important;width:100%!important;height:100%!important;border:0!important;background:#0b1219!important}.md-whiteboard-close{position:absolute!important;z-index:4!important;top:10px!important;right:10px!important;width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important;display:grid!important;place-items:center!important;border:1px solid #40515f!important;border-radius:12px!important;background:rgba(7,17,28,.94)!important;color:#fff!important;box-shadow:0 7px 20px rgba(0,0,0,.35)!important}@keyframes md-whiteboard-slide-in{from{transform:translateX(-102%)}to{transform:translateX(0)}}
`
