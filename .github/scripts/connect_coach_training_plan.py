from pathlib import Path

path = Path('src/pages/CoachApp.tsx')
text = path.read_text()
original = text

text = text.replace(
    "import CoachAppMatchDay from './CoachAppMatchDay'",
    "import CoachAppMatchDay from './CoachAppMatchDay'\nimport CoachAppTrainingPlan from './CoachAppTrainingPlan'",
)
text = text.replace(
    "type Screen = 'DASHBOARD' | 'AVAILABILITY' | 'SELECT_SIDE' | 'MATCH_DAY'",
    "type Screen = 'DASHBOARD' | 'TRAINING_PLAN' | 'AVAILABILITY' | 'SELECT_SIDE' | 'MATCH_DAY'",
)
text = text.replace(
    "  const[screen,setScreen]=useState<Screen>('DASHBOARD')",
    "  const[screen,setScreen]=useState<Screen>('DASHBOARD')\n  const[trainingSession,setTrainingSession]=useState<1|2>(1)",
)
text = text.replace(
    "    if(key==='match-day'){setScreen(context.nextStep==='MATCH_DAY'?'MATCH_DAY':'SELECT_SIDE');return}",
    "    if(key==='training-plan'){setTrainingSession(sessionNumber===2?2:1);setScreen('TRAINING_PLAN');return}\n    if(key==='match-day'){setScreen(context.nextStep==='MATCH_DAY'?'MATCH_DAY':'SELECT_SIDE');return}",
)
text = text.replace(
    "const pageLabel=screen==='DASHBOARD'?'Dashboard':screen==='AVAILABILITY'?'Player Availability':screen==='SELECT_SIDE'?'Select Side':'Match Day'",
    "const pageLabel=screen==='DASHBOARD'?'Dashboard':screen==='TRAINING_PLAN'?`Training Plan ${trainingSession}`:screen==='AVAILABILITY'?'Player Availability':screen==='SELECT_SIDE'?'Select Side':'Match Day'",
)

old = """    {screen==='AVAILABILITY'&&context.teamSheet?<CoachAppAvailability clubId={context.club.id} sheetId={context.teamSheet.id} token={session.access_token} onContinue={()=>setScreen('SELECT_SIDE')} onExit={()=>setScreen('DASHBOARD')}/>:screen==='SELECT_SIDE'&&context.teamSheet?<CoachAppSelectSide clubId={context.club.id} sheetId={context.teamSheet.id} token={session.access_token} onContinue={()=>setScreen('MATCH_DAY')} onExit={()=>setScreen('DASHBOARD')}/>:
      screen==='MATCH_DAY'&&context.teamSheet?<CoachAppMatchDay clubId={context.club.id} sheetId={context.teamSheet.id} token={session.access_token} onBack={()=>setScreen('SELECT_SIDE')}/>:screen!=='DASHBOARD'?<section className=\"coach-loading\"><strong>No active team sheet is available.</strong><button onClick={()=>setScreen('DASHBOARD')}>Back to dashboard</button></section>:null}"""
new = """    {screen==='TRAINING_PLAN'?<CoachAppTrainingPlan clubId={context.club.id} token={session.access_token} sessionNumber={trainingSession} fixtureDate={context.fixture?.matchDate} onExit={()=>setScreen('DASHBOARD')} onContinue={()=>navigate(`/club-portal/${encodeURIComponent(context.club.id)}/coaching?source=coach-app&section=training-summary&session=${trainingSession}`)}/>:
      screen==='AVAILABILITY'&&context.teamSheet?<CoachAppAvailability clubId={context.club.id} sheetId={context.teamSheet.id} token={session.access_token} onContinue={()=>setScreen('SELECT_SIDE')} onExit={()=>setScreen('DASHBOARD')}/>:screen==='SELECT_SIDE'&&context.teamSheet?<CoachAppSelectSide clubId={context.club.id} sheetId={context.teamSheet.id} token={session.access_token} onContinue={()=>setScreen('MATCH_DAY')} onExit={()=>setScreen('DASHBOARD')}/>:
      screen==='MATCH_DAY'&&context.teamSheet?<CoachAppMatchDay clubId={context.club.id} sheetId={context.teamSheet.id} token={session.access_token} onBack={()=>setScreen('SELECT_SIDE')}/>:screen!=='DASHBOARD'?<section className=\"coach-loading\"><strong>No active team sheet is available.</strong><button onClick={()=>setScreen('DASHBOARD')}>Back to dashboard</button></section>:null}"""
if old not in text:
    raise SystemExit('Coach App screen renderer not found')
text = text.replace(old, new)

if text == original:
    raise SystemExit('No Coach App changes made')
path.write_text(text)
