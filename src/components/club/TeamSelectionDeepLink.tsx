import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export default function TeamSelectionDeepLink(){
  const{pathname,search}=useLocation()
  const navigate=useNavigate()

  useEffect(()=>{
    const handleClick=(event:MouseEvent)=>{
      const anchor=event.target instanceof Element?event.target.closest<HTMLAnchorElement>('.club-feature-game-card footer a'):null
      if(!anchor)return
      const url=new URL(anchor.href,window.location.origin)
      const match=url.pathname.match(/^\/team\/([^/]+)$/)
      if(!match)return
      event.preventDefault()
      navigate(`/team/${match[1]}?tab=team-selection`)
    }
    document.addEventListener('click',handleClick)
    return()=>document.removeEventListener('click',handleClick)
  },[navigate])

  useEffect(()=>{
    if(!/^\/team\/[^/]+$/.test(pathname)||new URLSearchParams(search).get('tab')!=='team-selection')return
    let observer:MutationObserver|null=null
    let timeout=0
    const open=()=>{
      const stack=document.querySelector<HTMLElement>('.club-team-selection-stack')
      if(!stack||stack.getAttribute('aria-hidden')==='true')return false
      window.setTimeout(()=>stack.scrollIntoView({behavior:'smooth',block:'start'}),120)
      return true
    }
    if(!open()){
      observer=new MutationObserver(()=>{if(open())observer?.disconnect()})
      observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-hidden','style']})
      timeout=window.setTimeout(()=>observer?.disconnect(),10000)
    }
    return()=>{observer?.disconnect();window.clearTimeout(timeout)}
  },[pathname,search])

  return null
}
