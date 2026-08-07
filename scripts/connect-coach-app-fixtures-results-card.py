from pathlib import Path

path = Path('src/pages/CoachApp.tsx')
text = path.read_text()

replacements = [
    (
        "import CoachAppTrainingReport from './CoachAppTrainingReport'",
        "import CoachAppTrainingReport from './CoachAppTrainingReport'\nimport CoachAppFixturesResults from './CoachAppFixturesResults'",
    ),
    (
        "type Screen = 'DASHBOARD' | 'TRAINING_PLAN' | 'TRAINING_REPORT' | 'AVAILABILITY' | 'SELECT_SIDE' | 'MATCH_DAY'",
        "type Screen = 'DASHBOARD' | 'TRAINING_PLAN' | 'TRAINING_REPORT' | 'AVAILABILITY' | 'SELECT_SIDE' | 'MATCH_DAY' | 'FIXTURES_RESULTS'",
    ),
    (
        "type ToolKey = 'training-plan' | 'training-summary' | 'availability' | 'select-team' | 'game-plan' | 'match-day'",
        "type ToolKey = 'training-plan' | 'training-summary' | 'availability' | 'select-team' | 'game-plan' | 'match-day' | 'fixtures-results'",
    ),
    (
        "    if(key==='availability'){setScreen('AVAILABILITY');return}\n    if(key==='game-plan')",
        "    if(key==='availability'){setScreen('AVAILABILITY');return}\n    if(key==='fixtures-results'){setScreen('FIXTURES_RESULTS');return}\n    if(key==='game-plan')",
    ),
    (
        "screen==='AVAILABILITY'?'Player Availability':screen==='SELECT_SIDE'?'Select Side':'Match Day'",
        "screen==='AVAILABILITY'?'Player Availability':screen==='FIXTURES_RESULTS'?'Fixtures & Results':screen==='SELECT_SIDE'?'Select Side':'Match Day'",
    ),
    (
        "        <button onClick={()=>openTool('game-plan')}><FileText/><span><b>Game Plan</b><small>Prepare the plan for this fixture.</small></span></button>\n        <button className=\"match\"",
        "        <button onClick={()=>openTool('game-plan')}><FileText/><span><b>Game Plan</b><small>Prepare the plan for this fixture.</small></span></button>\n        <button onClick={()=>openTool('fixtures-results')}><CalendarCheck/><span><b>Fixtures & Results</b><small>View upcoming matches, recent results and Match Centre.</small></span></button>\n        <button className=\"match\"",
    ),
    (
        "    {screen==='TRAINING_PLAN'?<CoachAppTrainingPlan",
        "    {screen==='FIXTURES_RESULTS'?<CoachAppFixturesResults clubId={context.club.id} clubName={context.club.name} onExit={()=>setScreen('DASHBOARD')}/>:screen==='TRAINING_PLAN'?<CoachAppTrainingPlan",
    ),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Expected CoachApp source pattern not found: {old[:100]}')
    text = text.replace(old, new, 1)

path.write_text(text)
