import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export default function ClubPortalPlanLink(){
 const{pathname}=useLocation();const navigate=useNavigate()
 useEffect(()=>{
  const match=pathname.match(/^\/club-portal\/([^/]+)$/);if(!match)return
  const clubId=match[1];let observer:MutationObserver|null=null
  const attach=()=>{const tools=document.querySelector<HTMLElement>('.cp-tools');if(!tools||tools.querySelector('[data-club-plan-link]'))return false
   const link=document.createElement('a');link.href=`/club-portal/${clubId}/plans`;link.dataset.clubPlanLink='true';link.innerHTML='<span aria-hidden="true" style="font-size:23px;width:23px;text-align:center">♛</span><div><strong>Plans & access</strong><span>View usage, limits and upgrades</span></div><span aria-hidden="true">→</span>'
   link.addEventListener('click',event=>{event.preventDefault();navigate(`/club-portal/${clubId}/plans`)})
   tools.append(link);return true}
  if(!attach()){observer=new MutationObserver(()=>{if(attach())observer?.disconnect()});observer.observe(document.body,{childList:true,subtree:true})}
  return()=>{observer?.disconnect();document.querySelectorAll('[data-club-plan-link]').forEach(node=>node.remove())}
 },[navigate,pathname]);return null
}
