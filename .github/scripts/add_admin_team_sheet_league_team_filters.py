from pathlib import Path

path = Path('src/pages/AdminTeamSheets.tsx')
text = path.read_text()

old_state = "const[clubs,setClubs]=useState<Club[]>([]),[clubId,setClubId]=useState(''),[players,setPlayers]=useState<Player[]>([]),[sheets,setSheets]=useState<Sheet[]>([]),[sheetId,setSheetId]=useState(''),[selected,setSelected]=useState<Selected[]>([]),[message,setMessage]=useState('')"
new_state = "const[clubs,setClubs]=useState<Club[]>([]),[leagueId,setLeagueId]=useState(''),[clubId,setClubId]=useState(''),[players,setPlayers]=useState<Player[]>([]),[sheets,setSheets]=useState<Sheet[]>([]),[sheetId,setSheetId]=useState(''),[selected,setSelected]=useState<Selected[]>([]),[message,setMessage]=useState('')"
if old_state in text:
    text = text.replace(old_state, new_state, 1)
elif "[leagueId,setLeagueId]" not in text:
    raise SystemExit('Team sheet state anchor not found')

old_used = "const usedPlayers=useMemo(()=>new Set(selected.map(item=>item.clubPlayerId)),[selected])"
new_used = """const usedPlayers=useMemo(()=>new Set(selected.map(item=>item.clubPlayerId)),[selected])
 const leagues=useMemo(()=>Array.from(new Map(clubs.filter(club=>club.leagueId).map(club=>[club.leagueId as string,{id:club.leagueId as string,name:club.leagueName}])).values()).sort((a,b)=>a.name.localeCompare(b.name)),[clubs])
 const filteredClubs=useMemo(()=>clubs.filter(club=>club.leagueId===leagueId).sort((a,b)=>a.clubName.localeCompare(b.clubName)),[clubs,leagueId])"""
if old_used in text:
    text = text.replace(old_used, new_used, 1)
elif "const filteredClubs=" not in text:
    raise SystemExit('Memo anchor not found')

old_picker = """<section className=\"ats-card\"><label>Club<select value={clubId} onChange={e=>{setClubId(e.target.value);setSheetId('');setFixtureId('')}}><option value=\"\">Select a club</option>{clubs.map(club=><option key={club.clubId} value={club.clubId}>{club.clubName} · {club.leagueName}</option>)}</select></label></section>"""
new_picker = """<section className=\"ats-card ats-club-filters\"><label>League<select value={leagueId} onChange={e=>{setLeagueId(e.target.value);setClubId('');setSheetId('');setFixtureId('')}}><option value=\"\">Select a league</option>{leagues.map(league=><option key={league.id} value={league.id}>{league.name}</option>)}</select></label><label>Team<select value={clubId} disabled={!leagueId} onChange={e=>{setClubId(e.target.value);setSheetId('');setFixtureId('')}}><option value=\"\">{leagueId?'Select a team':'Select a league first'}</option>{filteredClubs.map(club=><option key={club.clubId} value={club.clubId}>{club.clubName}</option>)}</select></label></section>"""
if old_picker in text:
    text = text.replace(old_picker, new_picker, 1)
elif "ats-club-filters" not in text:
    raise SystemExit('Club picker anchor not found')

style_anchor = ".ats-card{background:#fff;"
style_replacement = ".ats-club-filters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.ats-club-filters select:disabled{background:#f3f6f8;color:#8a95a2}.ats-card{background:#fff;"
if style_anchor in text:
    text = text.replace(style_anchor, style_replacement, 1)
elif ".ats-club-filters{" not in text:
    raise SystemExit('Style anchor not found')

mobile_anchor = "@media(max-width:760px){"
if mobile_anchor in text and ".ats-club-filters{grid-template-columns:1fr}" not in text:
    text = text.replace(mobile_anchor, mobile_anchor + ".ats-club-filters{grid-template-columns:1fr}", 1)

path.write_text(text)
