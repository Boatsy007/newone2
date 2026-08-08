from pathlib import Path

path = Path('src/pages/CoachApp.tsx')
text = path.read_text()

old = "    {screen==='GAME_PLAN'?<CoachAppGamePlan"
new = "    {screen==='PERMISSIONS'?<CoachAppPermissions clubId={context.club.id} token={session.access_token} onExit={()=>setScreen('CLUB_DASHBOARD')}/>:screen==='GAME_PLAN'?<CoachAppGamePlan"
if old not in text and "screen==='PERMISSIONS'?<CoachAppPermissions" not in text:
    raise SystemExit('Permissions render insertion point not found')
if old in text:
    text = text.replace(old, new, 1)

text = text.replace(
    "screen!=='DASHBOARD'&&screen!=='CLUB_DASHBOARD'&&screen!=='PERMISSIONS'?",
    "screen!=='DASHBOARD'&&screen!=='CLUB_DASHBOARD'?",
    1,
)

path.write_text(text)
print('CoachApp Permissions render branch fixed')
