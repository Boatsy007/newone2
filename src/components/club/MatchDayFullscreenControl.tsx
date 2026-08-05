import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Expand, Minimize2 } from 'lucide-react'

type OrientationLock = { lock?: (orientation: string) => Promise<void>; unlock?: () => void }
type FullscreenDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void }
type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }

export default function MatchDayFullscreenControl(){
 const[host,setHost]=useState<HTMLElement|null>(null)
 const[active,setActive]=useState(false)

 useEffect(()=>{
  let mounted=true
  const attach=()=>{
   if(!mounted)return
   const actions=document.querySelector<HTMLElement>('.md-header-actions')
   if(!actions)return
   let next=document.getElementById('pf-match-day-fullscreen-host')
   if(!next){next=document.createElement('div');next.id='pf-match-day-fullscreen-host';actions.prepend(next)}
   setHost(next)
  }
  const sync=()=>{
   const doc=document as FullscreenDocument
   const fullscreen=Boolean(document.fullscreenElement||doc.webkitFullscreenElement)
   setActive(fullscreen||document.body.classList.contains('pf-match-day-focus'))
  }
  attach()
  const observer=new MutationObserver(attach)
  observer.observe(document.body,{childList:true,subtree:true})
  document.addEventListener('fullscreenchange',sync)
  document.addEventListener('webkitfullscreenchange',sync as EventListener)
  return()=>{
   mounted=false
   observer.disconnect()
   document.removeEventListener('fullscreenchange',sync)
   document.removeEventListener('webkitfullscreenchange',sync as EventListener)
   document.getElementById('pf-match-day-fullscreen-host')?.remove()
   document.body.classList.remove('pf-match-day-focus')
   setHost(null)
  }
 },[])

 async function toggle(){
  const board=document.querySelector<HTMLElement>('.md')
  if(!board)return
  const doc=document as FullscreenDocument
  const fullscreen=Boolean(document.fullscreenElement||doc.webkitFullscreenElement)
  if(fullscreen||document.body.classList.contains('pf-match-day-focus')){
   if(fullscreen){
    if(document.exitFullscreen)await document.exitFullscreen().catch(()=>{})
    else await Promise.resolve(doc.webkitExitFullscreen?.()).catch(()=>{})
   }
   document.body.classList.remove('pf-match-day-focus')
   ;(screen.orientation as OrientationLock|undefined)?.unlock?.()
   setActive(false)
   return
  }
  try{
   if(board.requestFullscreen)await board.requestFullscreen({navigationUI:'hide'}).catch(()=>board.requestFullscreen())
   else if((board as FullscreenElement).webkitRequestFullscreen)await Promise.resolve((board as FullscreenElement).webkitRequestFullscreen?.())
   else throw new Error('Fullscreen API unavailable')
  }catch{
   document.body.classList.add('pf-match-day-focus')
  }
  try{await (screen.orientation as OrientationLock|undefined)?.lock?.('landscape')}catch{}
  setActive(true)
 }

 if(!host)return null
 return <>
  {createPortal(<button className="md-fullscreen-button" type="button" onClick={()=>void toggle()} aria-label={active?'Exit full screen':'Open Match Day full screen'}>{active?<Minimize2 size={17}/>:<Expand size={17}/>}<span>{active?'Exit full screen':'Full screen'}</span></button>,host)}
  <style>{fullscreenStyles}</style>
 </>
}

const fullscreenStyles=`
.md:fullscreen,.md:-webkit-full-screen,body.pf-match-day-focus .md{position:relative!important;width:100vw!important;height:100vh!important;min-height:100vh!important;max-width:none!important;padding:0!important;overflow:hidden!important;background:#07111c!important}
.md:fullscreen>header,.md:-webkit-full-screen>header,body.pf-match-day-focus .md>header{position:absolute!important;z-index:80!important;top:8px!important;right:8px!important;width:auto!important;margin:0!important;padding:0!important;background:transparent!important}
.md:fullscreen>header>div:first-child,.md:-webkit-full-screen>header>div:first-child,body.pf-match-day-focus .md>header>div:first-child{display:none!important}
.md:fullscreen .md-header-actions>button,.md:-webkit-full-screen .md-header-actions>button,body.pf-match-day-focus .md-header-actions>button{display:none!important}
.md:fullscreen .md-header-actions #pf-match-day-fullscreen-host,.md:-webkit-full-screen .md-header-actions #pf-match-day-fullscreen-host,body.pf-match-day-focus .md-header-actions #pf-match-day-fullscreen-host{display:inline-flex!important}
.md:fullscreen .md-fullscreen-button,.md:-webkit-full-screen .md-fullscreen-button,body.pf-match-day-focus .md-fullscreen-button{display:grid!important;width:38px!important;height:38px!important;padding:0!important;border-radius:10px!important;background:rgba(5,14,22,.88)!important}
.md:fullscreen .md-fullscreen-button span,.md:-webkit-full-screen .md-fullscreen-button span,body.pf-match-day-focus .md-fullscreen-button span{display:none!important}
.md:fullscreen .md-picker,.md:-webkit-full-screen .md-picker,body.pf-match-day-focus .md-picker,.md:fullscreen .md-sync-error,.md:-webkit-full-screen .md-sync-error,body.pf-match-day-focus .md-sync-error{display:none!important}
.md:fullscreen .md-layout,.md:-webkit-full-screen .md-layout,body.pf-match-day-focus .md-layout{position:absolute!important;inset:0!important;display:block!important;width:100%!important;height:100%!important;max-width:none!important;margin:0!important}
.md:fullscreen .md-layout>aside,.md:-webkit-full-screen .md-layout>aside,body.pf-match-day-focus .md-layout>aside,.md:fullscreen .md-bench-head,.md:-webkit-full-screen .md-bench-head,body.pf-match-day-focus .md-bench-head,.md:fullscreen .md-bench,.md:-webkit-full-screen .md-bench,body.pf-match-day-focus .md-bench,.md:fullscreen .md-field-head,.md:-webkit-full-screen .md-field-head,body.pf-match-day-focus .md-field-head{display:none!important}
.md:fullscreen .md-field-panel,.md:-webkit-full-screen .md-field-panel,body.pf-match-day-focus .md-field-panel{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:#07111c!important;overflow:hidden!important}
.md:fullscreen .md-ground-wrap,.md:-webkit-full-screen .md-ground-wrap,body.pf-match-day-focus .md-ground-wrap{position:absolute!important;inset:0!important;display:grid!important;place-items:center!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;margin:0!important;border-radius:0!important;background:#07111c!important;overflow:hidden!important}
.md:fullscreen .md-ground,.md:-webkit-full-screen .md-ground,body.pf-match-day-focus .md-ground{flex:none!important;width:calc(100vh - 18px)!important;height:calc(100vw - 18px)!important;min-height:0!important;max-width:none!important;aspect-ratio:auto!important;border-width:3px!important;transform:rotate(90deg)!important;transform-origin:center!important}
.md:fullscreen .md-player.on-field,.md:-webkit-full-screen .md-player.on-field,body.pf-match-day-focus .md-player.on-field{width:17%!important;max-width:112px!important;transform:translate(-50%,-50%) rotate(-90deg)!important;border-radius:7px!important}
.md:fullscreen .md-player.on-field.selected,.md:-webkit-full-screen .md-player.on-field.selected,body.pf-match-day-focus .md-player.on-field.selected{transform:translate(-50%,-54%) rotate(-90deg)!important}
.md:fullscreen .md-player-main,.md:-webkit-full-screen .md-player-main,body.pf-match-day-focus .md-player-main{grid-template-columns:25px minmax(0,1fr) 20px!important}
.md:fullscreen .md-player-main .number,.md:-webkit-full-screen .md-player-main .number,body.pf-match-day-focus .md-player-main .number{min-width:25px!important;font-size:10px!important}
.md:fullscreen .md-player-main strong,.md:-webkit-full-screen .md-player-main strong,body.pf-match-day-focus .md-player-main strong{min-height:22px!important;padding:4px 3px 0!important;font-size:8px!important;line-height:1!important;white-space:normal!important}
.md:fullscreen .md-player-main small,.md:-webkit-full-screen .md-player-main small,body.pf-match-day-focus .md-player-main small{padding:0 3px 3px!important;font-size:6px!important}
.md:fullscreen .md-player-main em,.md:-webkit-full-screen .md-player-main em,body.pf-match-day-focus .md-player-main em{padding:0 2px!important;font-size:8px!important}
.md:fullscreen .md-player-score,.md:-webkit-full-screen .md-player-score,body.pf-match-day-focus .md-player-score{gap:2px!important;padding:2px!important}
.md:fullscreen .md-player-score button,.md:-webkit-full-screen .md-player-score button,body.pf-match-day-focus .md-player-score button{min-height:20px!important;padding:1px!important;font-size:8px!important}
.md:fullscreen .md-toolbar,.md:-webkit-full-screen .md-toolbar,body.pf-match-day-focus .md-toolbar{position:absolute!important;z-index:60!important;top:8px!important;left:50%!important;transform:translateX(-50%)!important;display:flex!important;align-items:center!important;gap:6px!important;width:auto!important;max-width:calc(100vw - 110px)!important;margin:0!important;padding:5px 7px!important;border:1px solid rgba(255,255,255,.25)!important;border-radius:10px!important;background:rgba(5,14,22,.9)!important;box-shadow:0 5px 18px rgba(0,0,0,.35)!important}
.md:fullscreen .md-clock,.md:-webkit-full-screen .md-clock,body.pf-match-day-focus .md-clock{display:flex!important;gap:4px!important;flex-wrap:nowrap!important}
.md:fullscreen .md-clock>span,.md:-webkit-full-screen .md-clock>span,body.pf-match-day-focus .md-clock>span{width:28px!important;height:28px!important;font-size:10px!important;border-radius:6px!important}
.md:fullscreen .md-clock>strong,.md:-webkit-full-screen .md-clock>strong,body.pf-match-day-focus .md-clock>strong{min-width:52px!important;font-size:17px!important}
.md:fullscreen .md-toolbar button,.md:-webkit-full-screen .md-toolbar button,body.pf-match-day-focus .md-toolbar button{min-height:28px!important;padding:4px 7px!important;border-radius:6px!important;font-size:8px!important}
.md:fullscreen .md-toolbar button svg,.md:-webkit-full-screen .md-toolbar button svg,body.pf-match-day-focus .md-toolbar button svg{width:13px!important;height:13px!important}
.md:fullscreen .md-scoreboard,.md:-webkit-full-screen .md-scoreboard,body.pf-match-day-focus .md-scoreboard{display:grid!important;grid-template-columns:auto auto auto!important;gap:6px!important;min-width:170px!important}
.md:fullscreen .md-scoreboard strong,.md:-webkit-full-screen .md-scoreboard strong,body.pf-match-day-focus .md-scoreboard strong{font-size:22px!important}
.md:fullscreen .md-scoreboard small,.md:-webkit-full-screen .md-scoreboard small,body.pf-match-day-focus .md-scoreboard small{font-size:6px!important;max-width:62px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.md:fullscreen .md-scoreboard div>span,.md:-webkit-full-screen .md-scoreboard div>span,body.pf-match-day-focus .md-scoreboard div>span{display:none!important}
.md:fullscreen .md-scoreboard>b,.md:-webkit-full-screen .md-scoreboard>b,body.pf-match-day-focus .md-scoreboard>b{font-size:8px!important}
.md:fullscreen .md-score-actions,.md:-webkit-full-screen .md-score-actions,body.pf-match-day-focus .md-score-actions{display:flex!important;gap:4px!important;min-width:0!important}
.md:fullscreen .md-team-actions,.md:-webkit-full-screen .md-team-actions,body.pf-match-day-focus .md-team-actions,.md:fullscreen .md-opposition-actions,.md:-webkit-full-screen .md-opposition-actions,body.pf-match-day-focus .md-opposition-actions{display:flex!important;gap:3px!important}
.md:fullscreen .md-team-actions>span,.md:-webkit-full-screen .md-team-actions>span,body.pf-match-day-focus .md-team-actions>span,.md:fullscreen .md-opposition-actions>span,.md:-webkit-full-screen .md-opposition-actions>span,body.pf-match-day-focus .md-opposition-actions>span{display:none!important}
@media(max-height:620px){.md:fullscreen .md-player.on-field,.md:-webkit-full-screen .md-player.on-field,body.pf-match-day-focus .md-player.on-field{width:15%!important;max-width:94px!important}.md:fullscreen .md-toolbar,.md:-webkit-full-screen .md-toolbar,body.pf-match-day-focus .md-toolbar{transform:translateX(-50%) scale(.9)!important;transform-origin:top center!important}}
`
