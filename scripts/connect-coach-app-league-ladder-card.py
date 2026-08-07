from pathlib import Path

path = Path('src/pages/CoachApp.tsx')
text = path.read_text()

replacements = [
    (
        "import CoachAppFixturesResults from './CoachAppFixturesResults'",
        "import CoachAppFixturesResults from './CoachAppFixturesResults'\nimport CoachAppLeagueLadder from './CoachAppLeagueLadder'",
    ),
    (
        "type Screen = 'DASHBOARD' | 'TRAINING_PLAN' | 'TRAINING_REPORT' | 'AVAILABILITY' | 'SELECT_SIDE' | 'MATCH_DAY' | 'FIXTURES_RESULTS'",
        "type Screen = 'DASHBOARD' | 'TRAINING_PLAN' | 'TRAINING_REPORT' | 'AVAILABILITY' | 'SELECT_SIDE' | 'MATCH_DAY' | 'FIXTURES_RESULTS' | 'LEAGUE_LADDER'",
    ),
    (
        "type ToolKey = 'training-plan' | 'training-summary' | 'availability' | 'select-team' | 'game-plan' | 'match-day' | 'fixtures-results'",
        "type ToolKey = 'training-plan' | 'training-summary' | 'availability' | 'select-team' | 'game-plan' | 'match-day' | 'fixtures-results' | 'league-ladder'",
    ),
    (
        "    if(key==='fixtures-results'){setScreen('FIXTURES_RESULTS');return}\n    if(key==='game-plan')",
        "    if(key==='fixtures-results'){setScreen('FIXTURES_RESULTS');return}\n    if(key==='league-ladder'){setScreen('LEAGUE_LADDER');return}\n    if(key==='game-plan')",
    ),
    (
        "screen==='AVAILABILITY'?'Player Availability':screen==='FIXTURES_RESULTS'?'Fixtures & Results':screen==='SELECT_SIDE'?'Select Side':'Match Day'",
        "screen==='AVAILABILITY'?'Player Availability':screen==='FIXTURES_RESULTS'?'Fixtures & Results':screen==='LEAGUE_LADDER'?'League Ladder':screen==='SELECT_SIDE'?'Select Side':'Match Day'",
    ),
    (
        "        <button onClick={()=>openTool('fixtures-results')}><CalendarCheck/><span><b>Fixtures & Results</b><small>View upcoming matches, recent results and Match Centre.</small></span></button>\n        <button className=\"match\"",
        "        <button onClick={()=>openTool('fixtures-results')}><CalendarCheck/><span><b>Fixtures & Results</b><small>View upcoming matches, recent results and Match Centre.</small></span></button>\n        <button onClick={()=>openTool('league-ladder')}><Sparkles/><span><b>League Ladder</b><small>View the current published ladder for your league.</small></span></button>\n        <button className=\"match\"",
    ),
    (
        "    {screen==='FIXTURES_RESULTS'?<CoachAppFixturesResults clubId={context.club.id} clubName={context.club.name} onExit={()=>setScreen('DASHBOARD')}/>:screen==='TRAINING_PLAN'?<CoachAppTrainingPlan",
        "    {screen==='LEAGUE_LADDER'?<CoachAppLeagueLadder clubId={context.club.id} onExit={()=>setScreen('DASHBOARD')}/>:screen==='FIXTURES_RESULTS'?<CoachAppFixturesResults clubId={context.club.id} clubName={context.club.name} onExit={()=>setScreen('DASHBOARD')}/>:screen==='TRAINING_PLAN'?<CoachAppTrainingPlan",
    ),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Expected CoachApp source pattern not found: {old[:120]}')
    text = text.replace(old, new, 1)

path.write_text(text)
