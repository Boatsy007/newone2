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
old_state = "  const[oppositionPlayers]=useState<PlayerOption[]>(()=>Array.from({length:22},(_,index)=>({id:`opp-${index+1}`,name:`Opponent ${index+1}`,number:index+1,team:'THEM' as const})))"
new_state = "  const[oppositionPlayers,setOppositionPlayers]=useState<PlayerOption[]>(()=>Array.from({length:22},(_,index)=>({id:`opp-${index+1}`,name:`Opponent ${index+1}`,number:index+1,team:'THEM' as const})))"
text = text.replace(old_state, new_state)

marker = "      }catch{if(live)setOurPlayers([])}finally{if(live)setLoading(false)}"
insert = """        try{
          const oppositionResponse=await fetch(`/api/club-portal/team-sheets/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(sheetId)}/opposition`,{headers,cache:'no-store'})
          const oppositionPayload=await oppositionResponse.json().catch(()=>({}))
          const opposition=Array.isArray(oppositionPayload.data?.players)?oppositionPayload.data.players:[]
          if(live&&opposition.length)setOppositionPlayers(opposition.map((player:any,index:number)=>({
            id:`opposition-${player.clubPlayerId||player.id}`,
            name:player.playerName,
            number:player.jumperNumber,
            team:'THEM' as const,
            position:FIELD_POSITIONS[player.positionCode]||{x:85-(index%6)*14,y:18+Math.floor(index/6)*15},
          })))
        }catch{}
""" + marker
if "sheets/${encodeURIComponent(sheetId)}/opposition" not in text:
    if marker not in text:
        raise SystemExit('Whiteboard load marker not found')
    text = text.replace(marker, insert, 1)
page.write_text(text)
