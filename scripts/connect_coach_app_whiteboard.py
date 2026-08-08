from pathlib import Path
p=Path('src/pages/CoachApp.tsx')
s=p.read_text()
repls=[
("import CoachAppStats from './CoachAppStats'", "import CoachAppStats from './CoachAppStats'\nimport CoachAppWhiteboard from './CoachAppWhiteboard'"),
("type Screen = 'CLUB_DASHBOARD' | 'PERMISSIONS' | 'DASHBOARD' | 'TRAINING_PLAN' | 'TRAINING_REPORT' | 'AVAILABILITY' | 'SELECT_SIDE' | 'MATCH_DAY' | 'FIXTURES_RESULTS' | 'LEAGUE_LADDER' | 'GAME_PLAN' | 'STATS'", "type Screen = 'CLUB_DASHBOARD' | 'PERMISSIONS' | 'DASHBOARD' | 'TRAINING_PLAN' | 'TRAINING_REPORT' | 'AVAILABILITY' | 'SELECT_SIDE' | 'MATCH_DAY' | 'FIXTURES_RESULTS' | 'LEAGUE_LADDER' | 'GAME_PLAN' | 'STATS' | 'WHITEBOARD'"),
("type ToolKey = 'training-plan' | 'training-summary' | 'availability' | 'select-team' | 'game-plan' | 'match-day' | 'fixtures-results' | 'league-ladder' | 'stats'", "type ToolKey = 'training-plan' | 'training-summary' | 'availability' | 'select-team' | 'game-plan' | 'match-day' | 'fixtures-results' | 'league-ladder' | 'stats' | 'whiteboard'"),
("  const[gamePlanFromMatch,setGamePlanFromMatch]=useState(false)", "  const[gamePlanFromMatch,setGamePlanFromMatch]=useState(false)\n  const[whiteboardFromMatch,setWhiteboardFromMatch]=useState(false)"),
("    if(key==='stats'){setScreen('STATS');return}", "    if(key==='stats'){setScreen('STATS');return}\n    if(key==='whiteboard'){setWhiteboardFromMatch(false);setScreen('WHITEBOARD');return}"),
("screen==='STATS'?'Stats':screen==='SELECT_SIDE'?'Select Side':'Match Day'", "screen==='STATS'?'Stats':screen==='WHITEBOARD'?'Whiteboard':screen==='SELECT_SIDE'?'Select Side':'Match Day'"),
("        <button onClick={()=>openTool('stats')}><ClipboardCheck/><span><b>Stats</b><small>Record live match statistics from a phone.</small></span></button>", "        <button onClick={()=>openTool('stats')}><ClipboardCheck/><span><b>Stats</b><small>Record live match statistics from a phone.</small></span></button>\n        <button onClick={()=>openTool('whiteboard')}><FileText/><span><b>Whiteboard</b><small>Build, save and present match tactics.</small></span></button>"),
("screen==='STATS'&&context.fixture?<CoachAppStats clubId={context.club.id} sheetId={context.teamSheet?.id} fixtureId={context.fixture.id} token={session.access_token} onExit={()=>setScreen('DASHBOARD')}/>:screen==='MATCH_DAY'", "screen==='STATS'&&context.fixture?<CoachAppStats clubId={context.club.id} sheetId={context.teamSheet?.id} fixtureId={context.fixture.id} token={session.access_token} onExit={()=>setScreen('DASHBOARD')}/>:screen==='WHITEBOARD'&&context.teamSheet?<CoachAppWhiteboard clubId={context.club.id} sheetId={context.teamSheet.id} token={session.access_token} fixtureLabel={fixtureLabel} returnToMatch={whiteboardFromMatch} onExit={()=>{setScreen(whiteboardFromMatch?'MATCH_DAY':'DASHBOARD');setWhiteboardFromMatch(false)}}/>:screen==='MATCH_DAY'"),
("onWhiteboard={()=>navigate(`/club-portal/${encodeURIComponent(context.club.id)}/coaching?source=coach-app&section=whiteboard&returnToMatch=1`)}", "onWhiteboard={()=>{setWhiteboardFromMatch(true);setScreen('WHITEBOARD')}}"),
]
for old,new in repls:
    if old not in s: raise SystemExit('missing: '+old[:100])
    s=s.replace(old,new,1)
p.write_text(s)
print('Connected native Coach App Whiteboard')
