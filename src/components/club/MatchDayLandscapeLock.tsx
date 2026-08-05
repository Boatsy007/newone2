import { useEffect, useState } from 'react'

type FullscreenDocument=Document&{webkitFullscreenElement?:Element|null}

export default function MatchDayLandscapeLock(){
 const[active,setActive]=useState(false)
 useEffect(()=>{
  const sync=()=>{
   const doc=document as FullscreenDocument
   const next=Boolean(document.fullscreenElement||doc.webkitFullscreenElement||document.body.classList.contains('pf-match-day-focus'))
   setActive(next)
   document.body.classList.toggle('pf-match-day-landscape-lock',next)
  }
  sync()
  const observer=new MutationObserver(sync)
  observer.observe(document.body,{attributes:true,attributeFilter:['class']})
  document.addEventListener('fullscreenchange',sync)
  document.addEventListener('webkitfullscreenchange',sync as EventListener)
  window.addEventListener('orientationchange',sync)
  window.addEventListener('resize',sync)
  return()=>{observer.disconnect();document.removeEventListener('fullscreenchange',sync);document.removeEventListener('webkitfullscreenchange',sync as EventListener);window.removeEventListener('orientationchange',sync);window.removeEventListener('resize',sync);document.body.classList.remove('pf-match-day-landscape-lock')}
 },[])
 if(!active)return null
 return <style>{styles}</style>
}

const styles=`
body.pf-match-day-landscape-lock{overscroll-behavior:none;touch-action:manipulation}
@media(orientation:portrait){
 body.pf-match-day-landscape-lock .coach-workspace-content{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;overflow:hidden!important}
 body.pf-match-day-landscape-lock .md{position:fixed!important;z-index:2147483600!important;left:50%!important;top:50%!important;width:100vh!important;height:100vw!important;min-width:100vh!important;min-height:100vw!important;max-width:none!important;max-height:none!important;transform:translate(-50%,-50%) rotate(90deg)!important;transform-origin:center center!important;overflow:hidden!important}
 body.pf-match-day-landscape-lock .md .md-layout{width:100%!important;height:100%!important}
}
`
