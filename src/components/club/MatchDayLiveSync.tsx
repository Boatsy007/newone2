import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

type Session={access_token:string}
type Sheet={id:string;roundLabel:string;opponentName:string|null;matchDate:string|null}
type Event={label?:string}
type MatchState={sheetId:string;quarter:number;elapsed:number;runningSince:number|null;homeGoals:number;homeBehinds:number;awayGoals:number;awayBehinds:number;events:Event[]}

const SESSION_KEY='playfooty.clubPortal.session.v1'
function session():Session|null{try{const raw=localStorage.getItem(SESSION_KEY);return raw?JSON.parse(raw):null}catch{return null}}
function storageKey(clubId:string,sheetId:string){return `playfooty.matchday.v1.${clubId}.${sheetId}`}

export default function MatchDayLiveSync(){
 const{pathname,search}=useLocation();const lastPayload=useRef('')
 useEffect(()=>{
  const match=pathname.match(/^\/club-portal\/([^/]+)\/coaching$/)
  if(!match||new URLSearchParams(search).get('view')!=='match-day')return
  const clubId=match[1],current=session();if(!current)return
  let active=true,sheets:Sheet[]=[]
  void fetch(`/api/club-portal/team-sheets/clubs/${encodeURIComponent(clubId)}/sheets`,{headers:{authorization:`Bearer ${current.access_token}`}}).then(async response=>{const payload=await response.json();if(response.ok&&active)sheets=Array.isArray(payload.data)?payload.data:[]}).catch(()=>{})
  const publish=async()=>{
   const select=document.querySelector<HTMLSelectElement>('.md-picker select')
   const sheetId=select?.value||''
   if(!sheetId)return
   let state:MatchState|null=null
   try{const raw=localStorage.getItem(storageKey(clubId,sheetId));state=raw?JSON.parse(raw):null}catch{}
   if(!state)return
   const sheet=sheets.find(item=>item.id===sheetId)
   const elapsedSeconds=state.elapsed+(state.runningSince?Math.floor((Date.now()-state.runningSince)/1000):0)
   const live=Boolean(state.runningSince||elapsedSeconds>0||state.events.length)
   const body={teamSheetId:sheetId,roundLabel:sheet?.roundLabel||null,opponentName:sheet?.opponentName||null,matchDate:sheet?.matchDate||null,quarter:state.quarter,elapsedSeconds,clockRunning:Boolean(state.runningSince),homeGoals:state.homeGoals,homeBehinds:state.homeBehinds,awayGoals:state.awayGoals,awayBehinds:state.awayBehinds,status:live?'LIVE':'HIDDEN',lastEvent:state.events[0]?.label||null}
   const encoded=JSON.stringify(body)
   if(encoded===lastPayload.current)return
   try{const response=await fetch(`/api/live-match/clubs/${encodeURIComponent(clubId)}`,{method:'PUT',headers:{authorization:`Bearer ${current.access_token}`,'content-type':'application/json'},body:encoded});if(response.ok)lastPayload.current=encoded}catch{}
  }
  const timer=window.setInterval(()=>void publish(),1500)
  void publish()
  return()=>{active=false;window.clearInterval(timer)}
 },[pathname,search])
 return null
}
