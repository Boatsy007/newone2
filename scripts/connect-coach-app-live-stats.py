from pathlib import Path

coach_path=Path('src/pages/CoachApp.tsx')
match_path=Path('src/pages/CoachAppMatchDay.tsx')
coach=coach_path.read_text()
match=match_path.read_text()

if "import CoachAppStats from './CoachAppStats'" not in coach:
    coach=coach.replace("import CoachAppGamePlan from './CoachAppGamePlan'", "import CoachAppGamePlan from './CoachAppGamePlan'\nimport CoachAppStats from './CoachAppStats'")
coach=coach.replace("| 'GAME_PLAN'", "| 'GAME_PLAN' | 'STATS'")
coach=coach.replace("| 'league-ladder'", "| 'league-ladder' | 'stats'")
coach=coach.replace("if(key==='game-plan'){setScreen('GAME_PLAN');return}", "if(key==='game-plan'){setScreen('GAME_PLAN');return}\n    if(key==='stats'){setScreen('STATS');return}")
coach=coach.replace("screen==='GAME_PLAN'?'Game Plan':screen==='SELECT_SIDE'", "screen==='GAME_PLAN'?'Game Plan':screen==='STATS'?'Stats':screen==='SELECT_SIDE'")
ladder_card="""        <button onClick={()=>openTool('league-ladder')}><Sparkles/><span><b>League Ladder</b><small>View the current published ladder for your league.</small></span></button>"""
stats_card="""        <button onClick={()=>openTool('stats')}><ClipboardCheck/><span><b>Stats</b><small>Record live match statistics from a phone.</small></span></button>"""
if stats_card not in coach:
    coach=coach.replace(ladder_card, ladder_card+'\n'+stats_card)
render_marker="""    {screen==='GAME_PLAN'?<CoachAppGamePlan"""
if "screen==='STATS'" not in coach:
    coach=coach.replace(render_marker, "    {screen==='STATS'&&context.teamSheet?<CoachAppStats clubId={context.club.id} sheetId={context.teamSheet.id} token={session.access_token} onExit={()=>setScreen('DASHBOARD')}/>:screen==='GAME_PLAN'?<CoachAppGamePlan")
coach_path.write_text(coach)

poll_code="""
  useEffect(()=>{
    if(!sheet)return
    let cancelled=false
    const refresh=async()=>{
      try{
        const response=await fetch(`/api/club-portal/match-day/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(sheetId)}`,{headers,cache:'no-store'})
        const payload=await response.json().catch(()=>({}))
        const remote=payload.data?.state as MatchState|undefined
        if(cancelled||!response.ok||!remote)return
        const remoteStats={...EMPTY_STATS,...(remote.teamStats||{})}
        setState(current=>current?{...current,teamStats:remoteStats}:current)
      }catch{}
    }
    const timer=window.setInterval(()=>void refresh(),1500)
    return()=>{cancelled=true;window.clearInterval(timer)}
  },[clubId,sheetId,headers,sheet])
"""
anchor="  useEffect(()=>{if(!state||!sheet)return;setSync('saving');"
if poll_code.strip() not in match:
    match=match.replace(anchor,poll_code+'\n'+anchor)
match_path.write_text(match)
