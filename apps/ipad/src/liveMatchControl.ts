import { apiGet, apiRequest } from './api'

export type StatKey='inside50s'|'clearances'|'tackles'|'marks'|'rebound50s'|'onePercenters'|'freesAgainst'
export type TeamStats=Record<StatKey,number>
export type RemoteMatchState={
  sheetId:string
  quarter:number
  elapsed:number
  runningSince:number|null
  trackingUpdatedAt?:number|null
  teamStats?:Partial<TeamStats>
  kpiTargets?:Partial<TeamStats>
  [key:string]:unknown
}

export const EMPTY_STATS:TeamStats={inside50s:0,clearances:0,tackles:0,marks:0,rebound50s:0,onePercenters:0,freesAgainst:0}
export const DEFAULT_TARGETS:TeamStats={inside50s:12,clearances:10,tackles:16,marks:10,rebound50s:8,onePercenters:12,freesAgainst:5}
export const LIVE_STATS:Array<{key:StatKey;label:string;short:string}>=[
  {key:'inside50s',label:'Inside 50s',short:'I50'},
  {key:'clearances',label:'Clearances',short:'CLR'},
  {key:'tackles',label:'Tackles',short:'TKL'},
  {key:'marks',label:'Marks',short:'MRK'},
  {key:'rebound50s',label:'Rebound 50s',short:'R50'},
  {key:'onePercenters',label:'1 Percenters',short:'1%'},
  {key:'freesAgainst',label:'Frees Against',short:'FA'},
]

export const matchDayPath=(clubId:string,sheetId:string)=>`/club-portal/match-day/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(sheetId)}`

export async function loadRemoteMatchState(clubId:string,sheetId:string,token:string){
  const payload=await apiGet<{data?:{state?:RemoteMatchState}|null}>(matchDayPath(clubId,sheetId),token,6500)
  return payload.data?.state??null
}

export async function mutateRemoteMatchState(clubId:string,sheetId:string,token:string,mutator:(latest:RemoteMatchState)=>RemoteMatchState){
  const latest=await loadRemoteMatchState(clubId,sheetId,token)
  if(!latest)throw new Error('Start Match Day once before using remote controls.')
  const next=mutator(latest)
  await apiRequest(matchDayPath(clubId,sheetId),{accessToken:token,method:'PUT',body:{state:next},timeoutMs:6500})
  return next
}

export function remoteElapsed(state:RemoteMatchState,now=Date.now()){
  return Math.max(0,Number(state.elapsed)||0)+(state.runningSince?Math.max(0,Math.floor((now-Number(state.runningSince))/1000)):0)
}

export function formatMatchClock(seconds:number){
  const value=Math.max(0,Math.floor(seconds))
  return `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`
}
