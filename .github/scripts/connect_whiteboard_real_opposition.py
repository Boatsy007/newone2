from pathlib import Path

route = Path('backend/src/api/routes/club-team-sheets.ts')
text = route.read_text()
anchor = "router.get('/clubs/:clubId/sheets', async (req,res) => {"
endpoint = r'''router.get('/clubs/:clubId/sheets/:sheetId/opposition', async (req,res) => {
  try {
    await ensureTables()
    const current = await sheetForClub(req.params.sheetId, req.params.clubId)
    if (!current) return res.status(404).json({ error:'Team sheet not found for this club' })
    if (!current.fixtureId) return res.json({ data:null })
    const fixtures = await prisma.$queryRawUnsafe<Array<{homeClubId:string|null;awayClubId:string|null}>>(`SELECT home_club_id AS "homeClubId",away_club_id AS "awayClubId" FROM football_fixtures WHERE id::text=$1 LIMIT 1`, current.fixtureId)
    const fixture = fixtures[0]
    if (!fixture) return res.json({ data:null })
    const opponentClubId = fixture.homeClubId === req.params.clubId ? fixture.awayClubId : fixture.homeClubId
    if (!opponentClubId) return res.json({ data:null })
    const rows = await prisma.$queryRawUnsafe<Array<{id:string}>>(`SELECT id::text AS id FROM football_team_sheets WHERE club_id=$1 AND fixture_id=$2 AND status IN ('DRAFT','PUBLISHED') ORDER BY CASE WHEN status='PUBLISHED' THEN 0 ELSE 1 END,updated_at DESC LIMIT 1`, opponentClubId, current.fixtureId)
    if (!rows[0]) return res.json({ data:null })
    const opposition = await loadSheet(rows[0].id)
    res.json({ data:opposition ? { ...opposition, clubId:undefined } : null })
  } catch(error) {
    res.status(500).json({ error:'failed to load opposition selected team',detail:String(error) })
  }
})

'''
if endpoint.strip() not in text:
    if anchor not in text:
        raise SystemExit('route anchor not found')
    text = text.replace(anchor, endpoint + anchor, 1)
    route.write_text(text)

page = Path('src/pages/CoachAppWhiteboardStage2.tsx')
text = page.read_text()
text = text.replace("  const[oppositionPlayers]=useState<PlayerOption[]>(()=>Array.from({length:22},(_,index)=>({id:`opp-${index+1}`,name:`Opponent ${index+1}`,number:index+1,team:'THEM' as const})))", "  const[oppositionPlayers,setOppositionPlayers]=useState<PlayerOption[]>(()=>Array.from({length:22},(_,index)=>({id:`opp-${index+1}`,name:`Opponent ${index+1}`,number:index+1,team:'THEM' as const})))")
old = """    fetch(`/api/club-portal/match-day/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(sheetId)}`,{headers:{authorization:`Bearer ${token}`}})
      .then(async response=>{const payload=await response.json() as SheetPayload;if(!response.ok)throw new Error('Unable to load selected team');const slots=payload.data?.state?.slots||[];setOurPlayers(slots.map((slot,index)=>({id:slot.clubPlayerId,name:slot.playerName,number:slot.jumperNumber,team:'US' as const,position:FIELD_POSITIONS[slot.positionCode]||{x:15+(index%6)*14,y:18+Math.floor(index/6)*15}})));setPlay(newPlay(emptyBoard))})
      .catch(()=>setPlay(newPlay(emptyBoard))).finally(()=>setLoading(false))"""
if old not in text:
    # accommodate selected-team fallback implementation by locating final load block
    start = text.find("    Promise.all([fetch(`/api/club-portal/team-sheets/clubs/${encodeURIComponent(clubId)}/sheets`")
    if start < 0:
        raise SystemExit('Whiteboard load block not found')
    end_marker = ".finally(()=>setLoading(false))"
    end = text.find(end_marker, start)
    if end < 0:
        raise SystemExit('Whiteboard load block end not found')
    end += len(end_marker)
    block = text[start:end]
    # append opposition fetch to existing promise chain without changing canonical own-team logic
    replacement = block.replace("Promise.all([", "Promise.all([")
    # easiest: retain block, then add separate fetch before final loading completion by converting finally
    replacement = replacement.replace(".finally(()=>setLoading(false))", ".finally(()=>setLoading(false))")
    text = text[:end] + "\n    fetch(`/api/club-portal/team-sheets/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(sheetId)}/opposition`,{headers:{authorization:`Bearer ${token}`},cache:'no-store'})\n      .then(async response=>{const payload=await response.json().catch(()=>({}));if(!response.ok||!payload.data?.players?.length)return;setOppositionPlayers(payload.data.players.map((player:any,index:number)=>({id:`opposition-${player.clubPlayerId||player.id}`,name:player.playerName,number:player.jumperNumber,team:'THEM' as const,position:FIELD_POSITIONS[player.positionCode]||{x:85-(index%6)*14,y:18+Math.floor(index/6)*15}})))})\n      .catch(()=>undefined)" + text[end:]
else:
    replacement = old + "\n    fetch(`/api/club-portal/team-sheets/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(sheetId)}/opposition`,{headers:{authorization:`Bearer ${token}`},cache:'no-store'})\n      .then(async response=>{const payload=await response.json().catch(()=>({}));if(!response.ok||!payload.data?.players?.length)return;setOppositionPlayers(payload.data.players.map((player:any,index:number)=>({id:`opposition-${player.clubPlayerId||player.id}`,name:player.playerName,number:player.jumperNumber,team:'THEM' as const,position:FIELD_POSITIONS[player.positionCode]||{x:85-(index%6)*14,y:18+Math.floor(index/6)*15}})))})\n      .catch(()=>undefined)"
    text = text.replace(old, replacement, 1)
page.write_text(text)
