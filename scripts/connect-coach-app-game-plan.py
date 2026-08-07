from pathlib import Path

path = Path('src/pages/CoachApp.tsx')
text = path.read_text()

replacements = [
    (
        "import CoachAppLeagueLadder from './CoachAppLeagueLadder'",
        "import CoachAppLeagueLadder from './CoachAppLeagueLadder'\nimport CoachAppGamePlan from './CoachAppGamePlan'",
    ),
    (
        "type Screen = 'DASHBOARD' | 'TRAINING_PLAN' | 'TRAINING_REPORT' | 'AVAILABILITY' | 'SELECT_SIDE' | 'MATCH_DAY' | 'FIXTURES_RESULTS' | 'LEAGUE_LADDER'",
        "type Screen = 'DASHBOARD' | 'TRAINING_PLAN' | 'TRAINING_REPORT' | 'AVAILABILITY' | 'SELECT_SIDE' | 'MATCH_DAY' | 'FIXTURES_RESULTS' | 'LEAGUE_LADDER' | 'GAME_PLAN'",
    ),
    (
        "    if(key==='league-ladder'){setScreen('LEAGUE_LADDER');return}\n    if(key==='game-plan'){navigate(`/club-portal/${id}/whiteboard?source=coach-app&mode=game-plan`);return}",
        "    if(key==='league-ladder'){setScreen('LEAGUE_LADDER');return}\n    if(key==='game-plan'){setScreen('GAME_PLAN');return}",
    ),
    (
        "screen==='FIXTURES_RESULTS'?'Fixtures & Results':screen==='LEAGUE_LADDER'?'League Ladder':screen==='SELECT_SIDE'?'Select Side':'Match Day'",
        "screen==='FIXTURES_RESULTS'?'Fixtures & Results':screen==='LEAGUE_LADDER'?'League Ladder':screen==='GAME_PLAN'?'Game Plan':screen==='SELECT_SIDE'?'Select Side':'Match Day'",
    ),
    (
        "    {screen==='LEAGUE_LADDER'?<CoachAppLeagueLadder clubId={context.club.id} onExit={()=>setScreen('DASHBOARD')}/>:screen==='FIXTURES_RESULTS'?",
        "    {screen==='GAME_PLAN'?<CoachAppGamePlan clubId={context.club.id} clubName={context.club.name} token={session.access_token} fixture={context.fixture} onExit={()=>setScreen('DASHBOARD')} onContinue={()=>setScreen('SELECT_SIDE')}/>:screen==='LEAGUE_LADDER'?<CoachAppLeagueLadder clubId={context.club.id} onExit={()=>setScreen('DASHBOARD')}/>:screen==='FIXTURES_RESULTS'?",
    ),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Expected CoachApp source pattern not found: {old[:120]}')
    text = text.replace(old, new, 1)

path.write_text(text)
