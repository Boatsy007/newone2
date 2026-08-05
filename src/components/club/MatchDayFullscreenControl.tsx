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
  if(fullscreen){
   if(document.exitFullscreen)await document.exitFullscreen().catch(()=>{})
   else await Promise.resolve(doc.webkitExitFullscreen?.()).catch(()=>{})
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
 return createPortal(<button className="md-fullscreen-button" type="button" onClick={()=>void toggle()} aria-label={active?'Exit full screen':'Open Match Day full screen'}>{active?<Minimize2 size={17}/>:<Expand size={17}/>}<span>{active?'Exit full screen':'Full screen'}</span></button>,host)
}
