from pathlib import Path

path = Path('backend/src/api/routes/club-team-sheets.ts')
text = path.read_text()
start = text.index("router.get('/clubs/:clubId/sheets/:sheetId/opposition'")
end = text.index("router.get('/clubs/:clubId/sheets',", start)

replacement = r'''router.get('/clubs/:clubId/sheets/:sheetId/opposition', async (req,res) => {
  try {
    await ensureTables()
    const current = await sheetForClub(req.params.sheetId, req.params.clubId)
    if (!current) return res.status(404).json({ error:'Team sheet not found for this club' })
    if (!current.fixtureId) return res.json({ data:null })

    const fixtureRows = await prisma.$queryRawUnsafe<Array<{
      homeClubId:string|null;awayClubId:string|null;homeName:string;awayName:string;
      leagueId:string;season:string;grade:string;round:string|null;matchDate:string|null
    }>>(`
      SELECT home_club_id AS "homeClubId",away_club_id AS "awayClubId",
        home_name AS "homeName",away_name AS "awayName",league_id AS "leagueId",
        season,grade,round,match_date AS "matchDate"
      FROM football_fixtures WHERE id::text=$1 LIMIT 1
    `, current.fixtureId)
    const fixture = fixtureRows[0]
    if (!fixture) return res.json({ data:null })

    const normaliseTeam = (value:unknown) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g,'').trim()
    const sameTeam = (left:unknown,right:unknown) => {
      const a=normaliseTeam(left),b=normaliseTeam(right)
      if(!a||!b)return false
      return a===b || a.includes(b) || b.includes(a)
    }

    // Resolve which fixture side the current sheet belongs to. IDs are authoritative when
    // they match; legacy/authorised alias sheets fall back to their saved club/opponent names.
    let currentIsHome:boolean|null=null
    if (fixture.homeClubId===req.params.clubId || fixture.homeClubId===current.clubId) currentIsHome=true
    else if (fixture.awayClubId===req.params.clubId || fixture.awayClubId===current.clubId) currentIsHome=false
    else if (sameTeam(current.opponentName,fixture.awayName)) currentIsHome=true
    else if (sameTeam(current.opponentName,fixture.homeName)) currentIsHome=false
    else if (sameTeam(current.clubName,fixture.homeName)) currentIsHome=true
    else if (sameTeam(current.clubName,fixture.awayName)) currentIsHome=false

    if (currentIsHome===null) return res.json({ data:null })

    const opponentCanonicalId = currentIsHome ? fixture.awayClubId : fixture.homeClubId
    const opponentName = currentIsHome ? fixture.awayName : fixture.homeName
    const currentTeamName = currentIsHome ? fixture.homeName : fixture.awayName
    if (!opponentCanonicalId) return res.json({ data:null })

    // Strongest relationship: the other selected side already linked to this exact fixture.
    const linkedRows = await prisma.$queryRawUnsafe<Array<{id:string}>>(`
      SELECT s.id::text AS id
      FROM football_team_sheets s
      JOIN football_team_sheet_players tsp ON tsp.team_sheet_id=s.id
      WHERE s.fixture_id=$1 AND s.id::text<>$2
        AND s.status IN ('DRAFT','PUBLISHED')
      GROUP BY s.id
      HAVING COUNT(tsp.id)>0
      ORDER BY CASE WHEN s.status='PUBLISHED' THEN 0 ELSE 1 END,s.updated_at DESC
      LIMIT 1
    `, current.fixtureId, current.id)
    if (linkedRows[0]) {
      const opposition = await loadSheet(linkedRows[0].id)
      return res.json({ data:opposition ? { ...opposition, clubId:undefined } : null })
    }

    // Otherwise read existing selected sides for this competition and resolve the actual
    // fixture opponent by both ends of the matchup: owner = opponent, opponent_name = us.
    const candidates = await prisma.$queryRawUnsafe<Array<{
      id:string;clubId:string;clubName:string|null;fixtureId:string|null;grade:string;
      roundLabel:string|null;opponentName:string|null;matchDate:string|null;status:string
    }>>(`
      SELECT s.id::text AS id,s.club_id AS "clubId",c.name AS "clubName",s.fixture_id AS "fixtureId",
        s.grade,s.round_label AS "roundLabel",s.opponent_name AS "opponentName",
        s.match_date AS "matchDate",s.status
      FROM football_team_sheets s
      JOIN football_team_sheet_players tsp ON tsp.team_sheet_id=s.id
      LEFT JOIN clubs c ON c.id::text=s.club_id
      WHERE s.season=$1 AND (s.league_id=$2 OR s.league_id IS NULL)
        AND s.status IN ('DRAFT','PUBLISHED') AND s.id::text<>$3
      GROUP BY s.id,c.name
      HAVING COUNT(tsp.id)>0
      ORDER BY s.updated_at DESC
      LIMIT 100
    `, fixture.season, fixture.leagueId, current.id)

    const dateKey=(value:unknown)=>{
      if(!value)return ''
      const d=new Date(String(value));return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10)
    }
    const ranked = candidates
      .filter(sheet => (sheet.clubId===opponentCanonicalId || sameTeam(sheet.clubName,opponentName)) && sameTeam(sheet.opponentName,currentTeamName))
      .map(sheet => ({
        sheet,
        score:(sheet.clubId===opponentCanonicalId?100:0)
          +(sheet.fixtureId===current.fixtureId?80:0)
          +(normaliseRound(sheet.grade)===normaliseRound(fixture.grade)?20:0)
          +(normaliseRound(sheet.roundLabel)===normaliseRound(fixture.round)?10:0)
          +(dateKey(sheet.matchDate)===dateKey(fixture.matchDate)?10:0)
          +(sheet.status==='PUBLISHED'?2:0)
      }))
      .sort((a,b)=>b.score-a.score)

    const selected=ranked[0]?.sheet
    if (!selected) return res.json({ data:null })
    const opposition = await loadSheet(selected.id)
    res.json({ data:opposition ? { ...opposition, clubId:undefined } : null })
  } catch(error) {
    res.status(500).json({ error:'failed to load opposition selected team',detail:String(error) })
  }
})

'''

path.write_text(text[:start] + replacement + text[end:])
