import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

type Session={access_token:string}
type Sheet={id:string;roundLabel:string;opponentName:string|null;matchDate:string|null}
type Event={label?:string}
type MatchState={sheetId:string;quarter:number;elapsed:number;runningSince:number|null;homeGoals:number;homeBehinds:number;awayGoals:number;awayBehinds:number;events:Event[]}

const SESSION_KEY='playfooty.clubPortal.session.v1'
function session():Session|null{try{const raw=localStorage.getItem(SESSION_KEY);return raw?JSON.parse(raw):null}catch{return null}}
function storageKey(clubId:string,sheetId:string){return `playfooty.matchday.v1.${clubId}.${sheetId}`}

export default function MatchDayLiveSync(){
 const{pathname,search}=useLocation()
 useEffect(()=>{
  const match=pathname.match(/^\/club-portal\/([^/]+)\/coaching$/)
  if(!match||new URLSearchParams(search).get('view')!=='match-day')return
  const clubId=match[1],current=session();if(!current)return
  let active=true,sheets:Sheet[]=[]
  const loadSheets=async()=>{try{const response=await fetch(`/api/club-portal/team-sheets/clubs/${encodeURIComponent(clubId)}/sheets`,{headers:{authorization:`Bearer ${current.access_token}`}});const payload=await response.json().catch(()=>({}));if(response.ok&&active)sheets=Array.isArray(payload.data)?payload.data:[]}catch{}}
  void loadSheets()
  const publish=async()=>{
   const select=document.querySelector<HTMLSelectElement>('.md-picker select')
   let sheetId=select?.value||''
   if(!sheetId){
    const prefix=`playfooty.matchday.v1.${clubId}.`
    sheetId=Object.keys(localStorage).find(key=>key.startsWith(prefix))?.slice(prefix.length)||''
   }
   if(!sheetId)return
   let state:MatchState|null=null
   try{const raw=localStorage.getItem(storageKey(clubId,sheetId));state=raw?JSON.parse(raw):null}catch{}
   if(!state)return
   const sheet=sheets.find(item=>item.id===sheetId)
   const elapsedSeconds=state.elapsed+(state.runningSince?Math.floor((Date.now()-state.runningSince)/1000):0)
   const live=Boolean(state.runningSince||elapsedSeconds>0||state.events.length)
   const body={teamSheetId:sheetId,roundLabel:sheet?.roundLabel||null,opponentName:sheet?.opponentName||null,matchDate:sheet?.matchDate||null,quarter:state.quarter,elapsedSeconds,clockRunning:Boolean(state.runningSince),homeGoals:state.homeGoals,homeBehinds:state.homeBehinds,awayGoals:state.awayGoals,awayBehinds:state.awayBehinds,status:live?'LIVE':'HIDDEN',lastEvent:state.events[0]?.label||null}
   try{await fetch(`/api/live-match/clubs/${encodeURIComponent(clubId)}`,{method:'PUT',headers:{authorization:`Bearer ${current.access_token}`,'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store'})}catch{}
  }
  const timer=window.setInterval(()=>void publish(),750)
  const sheetTimer=window.setInterval(()=>void loadSheets(),10000)
  void publish()
  return()=>{active=false;window.clearInterval(timer);window.clearInterval(sheetTimer)}
 },[pathname,search])
 return null
}
