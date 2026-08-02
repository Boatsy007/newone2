import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export default function TeamSelectionDeepLink(){
  const{pathname,search}=useLocation()
  const navigate=useNavigate()

  useEffect(()=>{
    const handleClick=(event:MouseEvent)=>{
      const graphic=event.target instanceof Element?event.target.closest<HTMLElement>('[data-team-graphic-action]'):null
      if(graphic){
        const clubId=graphic.dataset.clubId
        if(clubId){event.preventDefault();navigate(`/club-portal/${clubId}/team-selection-graphic`)}
        return
      }
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
    const portalMatch=pathname.match(/^\/club-portal\/([^/]+)\/team-selection\/?$/)
    if(!portalMatch)return
    let cancelled=false
    const connect=()=>{
      if(cancelled)return
      const head=document.querySelector<HTMLElement>('.cpts-sheet-head>div:last-child')
      if(!head||head.querySelector('[data-team-graphic-action]'))return
      const button=document.createElement('button')
      button.type='button'
      button.dataset.teamGraphicAction='true'
      button.dataset.clubId=portalMatch[1]
      button.className='team-graphic-action'
      button.textContent='Generate image'
      button.setAttribute('aria-label','Generate team selection social image')
      head.appendChild(button)
    }
    connect()
    const observer=new MutationObserver(connect)
    observer.observe(document.body,{childList:true,subtree:true})
    return()=>{cancelled=true;observer.disconnect()}
  },[pathname])

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
