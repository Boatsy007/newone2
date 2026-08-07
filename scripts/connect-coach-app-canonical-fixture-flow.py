from pathlib import Path


def replace(path: str, old: str, new: str):
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'Expected pattern not found in {path}: {old[:160]}')
    file.write_text(text.replace(old, new, 1))

# Make the Coach App context choose the real current/upcoming fixture by date.
replace(
    'backend/src/api/routes/coach-app.ts',
    "      AND:[{ OR:[{ matchDate:{ gte:new Date(Date.now()-6*60*60*1000) } },{ matchDate:null }] }],",
    "      // Keep today's match active through match day, then roll automatically to the next dated fixture.\n      AND:[{ OR:[{ matchDate:{ gte:new Date(Date.now()-18*60*60*1000) } },{ matchDate:null }] }],",
)
replace(
    'backend/src/api/routes/coach-app.ts',
    "    orderBy:{ updatedAt:'desc' },",
    "    orderBy:[{ matchDate:'asc' },{ round:'asc' }],",
)

# Expose the full canonical fixture shape to every app tool.
replace(
    'src/pages/CoachApp.tsx',
    "  fixture: { id: string; round: string | null; homeName: string; awayName: string; matchDate: string | null } | null",
    "  fixture: { id: string; leagueId: string; season: string; grade: string; round: string | null; homeClubId: string | null; awayClubId: string | null; homeName: string; awayName: string; matchDate: string | null; venue: string | null } | null",
)

# Correct the actual Match Flow sequence.
replace(
    'src/pages/CoachApp.tsx',
    "screen==='AVAILABILITY'&&context.teamSheet?<CoachAppAvailability clubId={context.club.id} sheetId={context.teamSheet.id} token={session.access_token} onContinue={()=>setScreen('SELECT_SIDE')} onExit={()=>setScreen('DASHBOARD')}/>",
    "screen==='AVAILABILITY'&&context.teamSheet?<CoachAppAvailability clubId={context.club.id} sheetId={context.teamSheet.id} token={session.access_token} onContinue={()=>{setTrainingSession(2);setScreen('TRAINING_PLAN')}} onExit={()=>setScreen('DASHBOARD')}/>",
)
replace(
    'src/pages/CoachApp.tsx',
    "screen==='SELECT_SIDE'&&context.teamSheet?<CoachAppSelectSide clubId={context.club.id} sheetId={context.teamSheet.id} token={session.access_token} onContinue={()=>setScreen('MATCH_DAY')} onExit={()=>setScreen('DASHBOARD')}/>",
    "screen==='SELECT_SIDE'&&context.teamSheet?<CoachAppSelectSide clubId={context.club.id} sheetId={context.teamSheet.id} token={session.access_token} onContinue={()=>setScreen('GAME_PLAN')} onExit={()=>setScreen('DASHBOARD')}/>",
)
replace(
    'src/pages/CoachApp.tsx',
    "screen==='GAME_PLAN'?<CoachAppGamePlan clubId={context.club.id} clubName={context.club.name} token={session.access_token} fixture={context.fixture} onExit={()=>setScreen('DASHBOARD')} onContinue={()=>setScreen('SELECT_SIDE')}/>",
    "screen==='GAME_PLAN'?<CoachAppGamePlan clubId={context.club.id} clubName={context.club.name} token={session.access_token} fixture={context.fixture} onExit={()=>setScreen('DASHBOARD')} onContinue={()=>setScreen('MATCH_DAY')}/>",
)

# Game Plan must use only the fixture selected by Coach App, never fixtures[0].
replace(
    'src/pages/CoachAppGamePlan.tsx',
    "type Props={clubId:string;clubName:string;token:string;fixture:{id:string;round:string|null;homeName:string;awayName:string;matchDate:string|null}|null;onExit:()=>void;onContinue:()=>void}",
    "type Props={clubId:string;clubName:string;token:string;fixture:{id:string;leagueId:string;season:string;grade:string;round:string|null;homeClubId:string|null;awayClubId:string|null;homeName:string;awayName:string;matchDate:string|null;venue:string|null}|null;onExit:()=>void;onContinue:()=>void}",
)
replace(
    'src/pages/CoachAppGamePlan.tsx',
    " const currentFixture=fixtures.find(row=>row.id===fixture?.id)||fixtures[0]||null\n const opponentId=currentFixture?(currentFixture.homeClubId===clubId?currentFixture.awayClubId:currentFixture.homeClubId):null\n const opponentName=currentFixture?(currentFixture.homeClubId===clubId?currentFixture.awayClubName:currentFixture.homeClubName):(fixture?fixture.homeName===clubName?fixture.awayName:fixture.homeName:'Opponent')\n const roundLabel=currentFixture?.round!=null?`Round ${currentFixture.round}`:fixture?.round||'Next match'\n const store=useMemo(()=>storageKey(clubId,currentFixture?.id||fixture?.id||null),[clubId,currentFixture?.id,fixture?.id])",
    " const currentFixture=fixture?fixtures.find(row=>row.id===fixture.id)||null:null\n const opponentId=fixture?(fixture.homeClubId===clubId?fixture.awayClubId:fixture.homeClubId):null\n const opponentName=fixture?(fixture.homeClubId===clubId?fixture.awayName:fixture.homeName):'Opponent'\n const roundLabel=fixture?.round?(/^round\\s/i.test(fixture.round)?fixture.round:`Round ${fixture.round}`):'Next match'\n const store=useMemo(()=>storageKey(clubId,fixture?.id||null),[clubId,fixture?.id])",
)
replace(
    'src/pages/CoachAppGamePlan.tsx',
    " useEffect(()=>{if(!opponentId||!currentFixture){setOpponent(null);setWatch([]);return}let active=true;const season=currentFixture.season||String(new Date().getFullYear());const leagueId=currentFixture.leagueId||'';",
    " useEffect(()=>{if(!opponentId||!fixture){setOpponent(null);setWatch([]);return}let active=true;const season=fixture.season||String(new Date().getFullYear());const leagueId=fixture.leagueId||'';",
)
replace(
    'src/pages/CoachAppGamePlan.tsx',
    "},[opponentId,currentFixture?.id,currentFixture?.season,currentFixture?.leagueId])",
    "},[opponentId,fixture?.id,fixture?.season,fixture?.leagueId])",
)

# Show the real scheduled date/venue on Game Plan so a mismatch is immediately visible.
replace(
    'src/pages/CoachAppGamePlan.tsx',
    "<p>{clubName} v {opponentName}</p>",
    "<p>{clubName} v {opponentName}{fixture?.matchDate?` · ${new Date(fixture.matchDate).toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'})}`:''}{fixture?.venue?` · ${fixture.venue}`:''}</p>",
)
replace(
    'src/pages/CoachAppGamePlan.tsx',
    "Save and continue <ChevronRight/>",
    "Save and continue to Match Day <ChevronRight/>",
)
