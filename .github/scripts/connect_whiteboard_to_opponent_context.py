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
    const exactTeam = (left:unknown,right:unknown) => {
      const a=normaliseTeam(left),b=normaliseTeam(right)
      return Boolean(a&&b&&a===b)
    }

    // The saved sheet already knows who it is playing. Use that first to identify which
    // side of the canonical fixture is the logged-in team; IDs remain a fallback for clubs
    // whose team-sheet owner id already matches the fixture club id.
    let currentIsHome:boolean|null=null
    if (sameTeam(current.opponentName,fixture.awayName)) currentIsHome=true
    else if (sameTeam(current.opponentName,fixture.homeName)) currentIsHome=false
    else if (fixture.homeClubId===req.params.clubId || fixture.homeClubId===current.clubId) currentIsHome=true
    else if (fixture.awayClubId===req.params.clubId || fixture.awayClubId===current.clubId) currentIsHome=false
    else if (sameTeam(current.clubName,fixture.homeName)) currentIsHome=true
    else if (sameTeam(current.clubName,fixture.awayName)) currentIsHome=false

    if (currentIsHome===null) return res.json({ data:null })

    const opponentCanonicalId = currentIsHome ? fixture.awayClubId : fixture.homeClubId
    const opponentName = currentIsHome ? fixture.awayName : fixture.homeName
    const currentTeamName = currentIsHome ? fixture.homeName : fixture.awayName
    if (!opponentCanonicalId || !opponentName) return res.json({ data:null })

    // If both teams saved against the same canonical fixture, this is the exact opposition.
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

    // Otherwise the fixture still tells us exactly which team to load. Search the existing
    // selected sides for that team. Do not require the sheet to share the same alias club id,
    // league-id mapping or opponent metadata; those are legacy/admin details. They only rank
    // otherwise valid saved selections for the fixture opponent.
    const candidates = await prisma.$queryRawUnsafe<Array<{
      id:string;clubId:string;clubName:string|null;leagueId:string|null;fixtureId:string|null;
      season:string;grade:string;roundLabel:string|null;opponentName:string|null;
      matchDate:string|null;status:string;updatedAt:string
    }>>(`
      SELECT s.id::text AS id,s.club_id AS "clubId",c.name AS "clubName",s.league_id AS "leagueId",
        s.fixture_id AS "fixtureId",s.season,s.grade,s.round_label AS "roundLabel",
        s.opponent_name AS "opponentName",s.match_date AS "matchDate",s.status,
        s.updated_at AS "updatedAt"
      FROM football_team_sheets s
      JOIN football_team_sheet_players tsp ON tsp.team_sheet_id=s.id
      LEFT JOIN clubs c ON c.id::text=s.club_id
      WHERE s.season=$1 AND s.status IN ('DRAFT','PUBLISHED') AND s.id::text<>$2
      GROUP BY s.id,c.name
      HAVING COUNT(tsp.id)>0
      ORDER BY s.updated_at DESC
      LIMIT 250
    `, fixture.season, current.id)

    const dateKey=(value:unknown)=>{
      if(!value)return ''
      const d=new Date(String(value))
      return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10)
    }

    const ranked = candidates
      .filter(sheet => sheet.clubId===opponentCanonicalId || sameTeam(sheet.clubName,opponentName))
      .map(sheet => ({
        sheet,
        score:(sheet.clubId===opponentCanonicalId?200:0)
          +(exactTeam(sheet.clubName,opponentName)?160:0)
          +(sameTeam(sheet.clubName,opponentName)?80:0)
          +(sheet.fixtureId===current.fixtureId?150:0)
          +(sheet.leagueId===fixture.leagueId?40:0)
          +(normaliseRound(sheet.grade)===normaliseRound(fixture.grade)?35:0)
          +(sameTeam(sheet.opponentName,currentTeamName)?30:0)
          +(normaliseRound(sheet.roundLabel)===normaliseRound(fixture.round)?15:0)
          +(dateKey(sheet.matchDate)===dateKey(fixture.matchDate)?15:0)
          +(sheet.status==='PUBLISHED'?3:0)
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
