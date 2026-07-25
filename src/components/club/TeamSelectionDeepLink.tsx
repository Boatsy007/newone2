import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function TeamSelectionDeepLink(){
  const{pathname,search}=useLocation()
  useEffect(()=>{
    if(!/^\/team\/[^/]+$/.test(pathname)||new URLSearchParams(search).get('tab')!=='team-selection')return
    let observer:MutationObserver|null=null
    let timeout=0
    const open=()=>{
      const button=Array.from(document.querySelectorAll<HTMLButtonElement>('.club-profile-tabs button')).find(item=>item.textContent?.trim().toLowerCase()==='team selection')
      if(!button)return false
      if(button.getAttribute('aria-selected')!=='true')button.click()
      window.setTimeout(()=>document.querySelector('.club-team-selection-stack')?.scrollIntoView({behavior:'smooth',block:'start'}),120)
      return true
    }
    if(!open()){
      observer=new MutationObserver(()=>{if(open())observer?.disconnect()})
      observer.observe(document.body,{childList:true,subtree:true})
      timeout=window.setTimeout(()=>observer?.disconnect(),10000)
    }
    return()=>{observer?.disconnect();window.clearTimeout(timeout)}
  },[pathname,search])
  return null
}
