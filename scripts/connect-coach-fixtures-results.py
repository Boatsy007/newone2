from pathlib import Path
p=Path('src/pages/CoachApp.tsx')
s=p.read_text()
s=s.replace("import CoachAppTrainingReport from './CoachAppTrainingReport'", "import CoachAppTrainingReport from './CoachAppTrainingReport'\nimport CoachAppFixturesResults from './CoachAppFixturesResults'")
s=s.replace("type Screen = 'DASHBOARD' | 'TRAINING_PLAN' | 'TRAINING_REPORT' | 'AVAILABILITY' | 'SELECT_SIDE' | 'MATCH_DAY'", "type Screen = 'DASHBOARD' | 'TRAINING_PLAN' | 'TRAINING_REPORT' | 'AVAILABILITY' | 'SELECT_SIDE' | 'FIXTURES_RESULTS' | 'MATCH_DAY'")
s=s.replace("type ToolKey = 'training-plan' | 'training-summary' | 'availability' | 'select-team' | 'game-plan' | 'match-day'", "type ToolKey = 'training-plan' | 'training-summary' | 'availability' | 'select-team' | 'game-plan' | 'fixtures-results' | 'match-day'")
s=s.replace("    if(key==='availability'){setScreen('AVAILABILITY');return}\n", "    if(key==='availability'){setScreen('AVAILABILITY');return}\n    if(key==='fixtures-results'){setScreen('FIXTURES_RESULTS');return}\n")
s=s.replace("screen==='AVAILABILITY'?'Player Availability':screen==='SELECT_SIDE'?'Select Side':'Match Day'", "screen==='AVAILABILITY'?'Player Availability':screen==='FIXTURES_RESULTS'?'Fixtures & Results':screen==='SELECT_SIDE'?'Select Side':'Match Day'")
anchor="""        <button onClick={()=>openTool('game-plan')}><FileText/><span><b>Game Plan</b><small>Prepare the plan for this fixture.</small></span></button>
        <button className=\"match\" onClick={()=>openTool('match-day')}><Trophy/><span><b>Match Day</b><small>Select the side and run the live game.</small></span></button>"""
replacement="""        <button onClick={()=>openTool('game-plan')}><FileText/><span><b>Game Plan</b><small>Prepare the plan for this fixture.</small></span></button>
        <button onClick={()=>openTool('fixtures-results')}><CalendarDays/><span><b>Fixtures & Results</b><small>Upcoming matches, recent results and Match Centre.</small></span></button>
        <button className=\"match\" onClick={()=>openTool('match-day')}><Trophy/><span><b>Match Day</b><small>Select the side and run the live game.</small></span></button>"""
if anchor not in s: raise SystemExit('tool card anchor not found')
s=s.replace(anchor,replacement)
anchor2="""    {screen==='TRAINING_PLAN'?<CoachAppTrainingPlan"""
s=s.replace(anchor2,"""    {screen==='FIXTURES_RESULTS'?<CoachAppFixturesResults clubId={context.club.id} clubName={context.club.name} onExit={()=>setScreen('DASHBOARD')}/>:\n      screen==='TRAINING_PLAN'?<CoachAppTrainingPlan""")
p.write_text(s)
