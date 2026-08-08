from pathlib import Path

path=Path('src/pages/CoachApp.tsx')
text=path.read_text()

if "import CoachAppClubDashboard" not in text:
    marker="import CoachAppLoading from '../components/CoachAppLoading'"
    text=text.replace(marker, marker+"\nimport CoachAppClubDashboard, { type ClubAppArea } from '../components/CoachAppClubDashboard'")

text=text.replace("type Screen = 'DASHBOARD' |", "type Screen = 'CLUB_DASHBOARD' | 'DASHBOARD' |")
text=text.replace("const[screen,setScreen]=useState<Screen>(()=>new URLSearchParams(window.location.search).get('screen')==='match-day'?'MATCH_DAY':'DASHBOARD')", "const[screen,setScreen]=useState<Screen>(()=>new URLSearchParams(window.location.search).get('screen')==='match-day'?'MATCH_DAY':'CLUB_DASHBOARD')")
text=text.replace("setClubs([]);setContext(next);setScreen(new URLSearchParams(window.location.search).get('screen')==='match-day'?'MATCH_DAY':'DASHBOARD')", "setClubs([]);setContext(next);setScreen(new URLSearchParams(window.location.search).get('screen')==='match-day'?'MATCH_DAY':'CLUB_DASHBOARD')")

old="  const pageLabel=screen==='DASHBOARD'?'Dashboard':screen==='TRAINING_PLAN'?"
new="  const pageLabel=screen==='CLUB_DASHBOARD'?'Club Dashboard':screen==='DASHBOARD'?'Coaching Dashboard':screen==='TRAINING_PLAN'?"
text=text.replace(old,new)

text=text.replace("<button className=\"coach-club\" onClick={()=>setScreen('DASHBOARD')}", "<button className=\"coach-club\" onClick={()=>setScreen('CLUB_DASHBOARD')}")

insert="""    {screen==='CLUB_DASHBOARD'&&<CoachAppClubDashboard clubName={context.club.name} logoUrl={context.club.logoUrl} onOpen={(area:ClubAppArea)=>{if(area==='coaching')setScreen('DASHBOARD')}}/>}\n"""
needle="    {screen==='DASHBOARD'&&<section className=\"coach-dashboard\">"
if insert.strip() not in text:
    text=text.replace(needle, insert+needle)

# Ensure fallback does not appear on club dashboard.
text=text.replace("screen!=='DASHBOARD'?<section", "screen!=='DASHBOARD'&&screen!=='CLUB_DASHBOARD'?<section")

path.write_text(text)
print('Club Dashboard wired into Coach App')
