import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { BrainCircuit } from 'lucide-react'

type FullscreenDocument=Document&{webkitFullscreenElement?:Element|null}

export default function MatchDayFullscreenFitEnhancer(){
 const[board,setBoard]=useState<HTMLElement|null>(null)
 const[active,setActive]=useState(false)
 useEffect(()=>{
  let mounted=true
  const sync=()=>{
   if(!mounted)return
   const doc=document as FullscreenDocument
   setBoard(document.querySelector<HTMLElement>('.md'))
   setActive(Boolean(document.fullscreenElement||doc.webkitFullscreenElement||document.body.classList.contains('pf-match-day-focus')))
  }
  sync()
  const observer=new MutationObserver(sync)
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']})
  document.addEventListener('fullscreenchange',sync)
  document.addEventListener('webkitfullscreenchange',sync as EventListener)
  return()=>{mounted=false;observer.disconnect();document.removeEventListener('fullscreenchange',sync);document.removeEventListener('webkitfullscreenchange',sync as EventListener)}
 },[])
 return <>
  {active&&board&&createPortal(<section className="md-ai-coach-placeholder" aria-label="AI assistant coach coming soon"><BrainCircuit size={42}/><strong>AI Assistant Coach</strong><span>Live recommendations will appear here.</span></section>,board)}
  <style>{styles}</style>
 </>
}

const styles=`
.md:fullscreen .md-ground-wrap,.md:-webkit-full-screen .md-ground-wrap,body.pf-match-day-focus .md-ground-wrap{inset:68px 10px 142px 10px!important;width:auto!important;height:auto!important;place-items:center!important;transform:translateY(8px)!important;overflow:visible!important}
.md:fullscreen .md-ground,.md:-webkit-full-screen .md-ground,body.pf-match-day-focus .md-ground{width:min(39vw,56vh)!important;height:auto!important;max-height:calc(100vh - 220px)!important;aspect-ratio:.72!important;transform:none!important}
.md:fullscreen .md-bench-head,.md:-webkit-full-screen .md-bench-head,body.pf-match-day-focus .md-bench-head{position:absolute!important;z-index:56!important;left:16px!important;bottom:116px!important;display:block!important;margin:0!important;color:#d9e5ec!important;font-size:8px!important;letter-spacing:.12em!important;text-transform:uppercase!important}
.md:fullscreen .md-bench-head h2,.md:-webkit-full-screen .md-bench-head h2,body.pf-match-day-focus .md-bench-head h2{display:none!important}
.md:fullscreen .md-bench,.md:-webkit-full-screen .md-bench,body.pf-match-day-focus .md-bench{position:absolute!important;z-index:55!important;left:14px!important;right:14px!important;bottom:25px!important;display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:7px!important;width:auto!important;margin:0!important;padding:9px!important;border:1px solid #263946!important;border-radius:11px!important;background:rgba(5,14,22,.93)!important}
.md:fullscreen .md-bench .md-player,.md:-webkit-full-screen .md-bench .md-player,body.pf-match-day-focus .md-bench .md-player{min-width:0!important;border-radius:6px!important;box-shadow:0 3px 9px rgba(0,0,0,.32)!important}
.md:fullscreen .md-bench .md-player-main,.md:-webkit-full-screen .md-bench .md-player-main,body.pf-match-day-focus .md-bench .md-player-main{grid-template-columns:22px minmax(0,1fr) 18px!important}
.md:fullscreen .md-bench .md-player-main .number,.md:-webkit-full-screen .md-bench .md-player-main .number,body.pf-match-day-focus .md-bench .md-player-main .number{min-width:22px!important;font-size:8px!important}
.md:fullscreen .md-bench .md-player-main strong,.md:-webkit-full-screen .md-bench .md-player-main strong,body.pf-match-day-focus .md-bench .md-player-main strong{min-height:18px!important;padding:3px 2px 0!important;font-size:7px!important;line-height:1!important;white-space:normal!important}
.md:fullscreen .md-bench .md-player-main small,.md:-webkit-full-screen .md-bench .md-player-main small,body.pf-match-day-focus .md-bench .md-player-main small{padding:0 2px 2px!important;font-size:5px!important}
.md:fullscreen .md-bench .md-player-main em,.md:-webkit-full-screen .md-bench .md-player-main em,body.pf-match-day-focus .md-bench .md-player-main em{padding:0 2px!important;font-size:7px!important}
.md:fullscreen .md-bench .md-player-score,.md:-webkit-full-screen .md-bench .md-player-score,body.pf-match-day-focus .md-bench .md-player-score{gap:2px!important;padding:2px!important}
.md:fullscreen .md-bench .md-player-score button,.md:-webkit-full-screen .md-bench .md-player-score button,body.pf-match-day-focus .md-bench .md-player-score button{min-height:18px!important;padding:0!important;font-size:7px!important}
.md:fullscreen .md-fs-score,.md:-webkit-full-screen .md-fs-score,body.pf-match-day-focus .md-fs-score{top:10px!important;right:62px!important;width:auto!important;grid-template-columns:repeat(4,minmax(92px,auto))!important}
.md-ai-coach-placeholder{position:absolute;z-index:64;right:12px;bottom:14px;width:calc(50vw - 24px);height:calc(50vh - 78px);display:grid;place-content:center;justify-items:center;gap:8px;border:1px dashed #43515c;border-radius:14px;background:rgba(5,12,19,.72);color:#667480;text-align:center;pointer-events:none}.md-ai-coach-placeholder strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:27px;letter-spacing:.04em;text-transform:uppercase}.md-ai-coach-placeholder span{font-size:11px}
@media(max-height:620px){.md:fullscreen .md-ground-wrap,.md:-webkit-full-screen .md-ground-wrap,body.pf-match-day-focus .md-ground-wrap{inset:62px 10px 126px 10px!important;transform:translateY(6px)!important}.md:fullscreen .md-ground,.md:-webkit-full-screen .md-ground,body.pf-match-day-focus .md-ground{width:min(37vw,52vh)!important;max-height:calc(100vh - 194px)!important}.md:fullscreen .md-bench-head,.md:-webkit-full-screen .md-bench-head,body.pf-match-day-focus .md-bench-head{bottom:101px!important}.md:fullscreen .md-bench,.md:-webkit-full-screen .md-bench,body.pf-match-day-focus .md-bench{bottom:17px!important;padding:6px!important}.md-ai-coach-placeholder{bottom:10px;height:calc(50vh - 68px)}}
`
