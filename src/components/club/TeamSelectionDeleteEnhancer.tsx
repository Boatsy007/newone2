import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Trash2 } from 'lucide-react'
import { useLocation } from 'react-router-dom'

const SESSION_KEY='playfooty.clubPortal.session.v1'
function token(){try{const raw=localStorage.getItem(SESSION_KEY);return raw?(JSON.parse(raw) as{access_token?:string}).access_token||'':''}catch{return''}}

export default function TeamSelectionDeleteEnhancer(){
 const{pathname}=useLocation()
 const match=pathname.match(/^\/club-portal\/([^/]+)\/team-selection\/?$/)
 const clubId=match?.[1]||''
 const[host,setHost]=useState<HTMLElement|null>(null)
 const[sheetId,setSheetId]=useState('')
 const[published,setPublished]=useState(false)
 const[busy,setBusy]=useState(false)

 useEffect(()=>{
  if(!clubId){setHost(null);setSheetId('');setPublished(false);return}
  let active=true
  const sync=()=>{
   if(!active)return
   const nextHost=document.querySelector<HTMLElement>('.cpts-sheet-head>div:last-child')
   const status=document.querySelector<HTMLElement>('.cpts-sheet-head>div:first-child>span')?.textContent?.trim().toUpperCase()||''
   const existingLabel=[...document.querySelectorAll<HTMLLabelElement>('.cpts-card label')].find(label=>label.textContent?.includes('Existing selections'))
   const selectedId=existingLabel?.querySelector<HTMLSelectElement>('select')?.value||''
   setHost(nextHost||null)
   setSheetId(selectedId)
   setPublished(status==='PUBLISHED'||status==='FINAL')
  }
  sync()
  const observer=new MutationObserver(sync)
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true})
  document.addEventListener('change',sync,true)
  return()=>{active=false;observer.disconnect();document.removeEventListener('change',sync,true)}
 },[clubId])

 async function removeTeam(){
  if(!clubId||!sheetId||busy)return
  if(!window.confirm('Delete this published team? This removes the team sheet so you can select and publish it again. This cannot be undone.'))return
  setBusy(true)
  try{
   const response=await fetch(`/api/club-portal/team-sheets/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(sheetId)}`,{method:'DELETE',headers:{authorization:`Bearer ${token()}`}})
   const payload=await response.json().catch(()=>({}))
   if(!response.ok)throw new Error(payload.error||'Unable to delete team')
   window.location.reload()
  }catch(error){window.alert(error instanceof Error?error.message:'Unable to delete team');setBusy(false)}
 }

 if(!host||!published||!sheetId)return null
 return createPortal(<button className="cpts-delete-team" type="button" onClick={()=>void removeTeam()} disabled={busy}><Trash2 size={16}/>{busy?'Deleting…':'Delete team'}</button>,host)
}
