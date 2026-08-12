import fs from 'node:fs'

const matchDayPath='apps/ipad/src/screens/MatchDayScreen.tsx'
let text=fs.readFileSync(matchDayPath,'utf8')

const importAnchor="import { loadClubConnections } from '../connections'\n"
const importLine="import { loadRemoteMatchState } from '../liveMatchControl'\n"
if(!text.includes(importLine)){
  if(text.split(importAnchor).length!==2)throw new Error('MatchDay import anchor changed; refusing to patch.')
  text=text.replace(importAnchor,importAnchor+importLine)
}

const cleanupAnchor=" useEffect(()=>()=>{if(saveTimer.current)clearTimeout(saveTimer.current)},[])\n"
const effectMarker='const remote=await loadRemoteMatchState(club.clubId,sheetId,token)'
const effect=` useEffect(()=>{\n  if(!sheetId)return\n  let cancelled=false\n  const refresh=async()=>{\n   try{\n    const remote=await loadRemoteMatchState(club.clubId,sheetId,token)\n    if(cancelled||!remote)return\n    setState(current=>{\n     if(!current)return current\n     const remoteRunning=remote.runningSince==null?null:Number(remote.runningSince)\n     const merged=current.runningSince&&remoteRunning===null?accrue(current):current\n     return {...merged,quarter:Math.max(1,Math.min(4,Number(remote.quarter)||merged.quarter)),elapsed:Math.max(0,Number(remote.elapsed)||0),runningSince:remoteRunning,trackingUpdatedAt:remoteRunning?(Number(remote.trackingUpdatedAt)||remoteRunning):null,teamStats:{...EMPTY_STATS,...merged.teamStats,...(remote.teamStats??{})},kpiTargets:{...DEFAULT_TARGETS,...merged.kpiTargets,...(remote.kpiTargets??{})}}\n    })\n   }catch{}\n  }\n  void refresh()\n  const timer=setInterval(()=>void refresh(),650)\n  return()=>{cancelled=true;clearInterval(timer)}\n },[club.clubId,sheetId,token])\n`
if(!text.includes(effectMarker)){
  if(text.split(cleanupAnchor).length!==2)throw new Error('MatchDay effect anchor changed; refusing to patch.')
  text=text.replace(cleanupAnchor,effect+cleanupAnchor)
}
fs.writeFileSync(matchDayPath,text)

const operationsPath='apps/ipad/src/screens/OperationsScreen.tsx'
let operations=fs.readFileSync(operationsPath,'utf8')
operations=operations.replaceAll("fontWeight:'850'","fontWeight:'800'")
fs.writeFileSync(operationsPath,operations)

console.log('Native remote Match Day sync patch applied safely.')
