from pathlib import Path

path = Path('backend/src/api/routes/club-team-sheets.ts')
text = path.read_text()
start = text.index("router.get('/clubs/:clubId/sheets/:sheetId/opposition'")
end = text.index("router.get('/clubs/:clubId/sheets',", start)
new_endpoint = r'''router.get('/clubs/:clubId/sheets/:sheetId/opposition', async (req,res) => {
  try {
    await ensureTables()
    const current = await sheetForClub(req.params.sheetId, req.params.clubId)
    if (!current) return res.status(404).json({ error:'Team sheet not found for this club' })
    if (!current.fixtureId) return res.json({ data:null })

    const fixtures = await prisma.$queryRawUnsafe<Array<{
      homeClubId:string|null;awayClubId:string|null;homeName:string;awayName:string;
      leagueId:string;season:string;grade:string;round:string|null;matchDate:string|null
    }>>(`
      SELECT home_club_id AS "homeClubId",away_club_id AS "awayClubId",
        home_name AS "homeName",away_name AS "awayName",league_id AS "leagueId",
        season,grade,round,match_date AS "matchDate"
      FROM football_fixtures WHERE id::text=$1 LIMIT 1
    `, current.fixtureId)
    const fixture = fixtures[0]
    if (!fixture) return res.json({ data:null })

    const currentIsHome = fixture.homeClubId === req.params.clubId
    const opponentClubId = currentIsHome ? fixture.awayClubId : fixture.homeClubId
    const opponentName = currentIsHome ? fixture.awayName : fixture.homeName
    const currentClubName = currentIsHome ? fixture.homeName : fixture.awayName
    if (!opponentClubId) return res.json({ data:null })

    // First use the exact selected side attached to this fixture, regardless of whether
    // the opponent logs in through an authorised alias id.
    const linked = await prisma.$queryRawUnsafe<Array<{id:string}>>(`
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
    if (linked[0]) {
      const opposition = await loadSheet(linked[0].id)
      return res.json({ data:opposition ? { ...opposition, clubId:undefined } : null })
    }

    // The Club Portal can own the opponent's selected side under an authorised alias.
    // Read the same saved selection by football identity, never by a hard-coded club id.
    const candidates = await prisma.$queryRawUnsafe<Array<{
      id:string;clubId:string;clubName:string;fixtureId:string|null;season:string;grade:string;
      roundLabel:string|null;opponentName:string|null;matchDate:string|null;status:string;playerCount:number
    }>>(`
      SELECT s.id::text AS id,s.club_id AS "clubId",COALESCE(c.name,'') AS "clubName",
        s.fixture_id AS "fixtureId",s.season,s.grade,s.round_label AS "roundLabel",
        s.opponent_name AS "opponentName",s.match_date AS "matchDate",s.status,
        COUNT(tsp.id)::int AS "playerCount"
      FROM football_team_sheets s
      JOIN football_team_sheet_players tsp ON tsp.team_sheet_id=s.id
      LEFT JOIN clubs c ON c.id::text=s.club_id
      WHERE s.id::text<>$1 AND s.season=$2
        AND (s.league_id=$3 OR s.league_id IS NULL)
        AND s.status IN ('DRAFT','PUBLISHED')
      GROUP BY s.id,c.name
      HAVING COUNT(tsp.id)>0
      ORDER BY s.updated_at DESC
      LIMIT 100
    `, current.id, fixture.season, fixture.leagueId)

    const ignored = new Set(['qfa','ofa','div','division','gold','coast','senior','seniors','football','fc','afc','gc'])
    const tokens = (value:unknown) => normaliseRound(String(value ?? ''))
      .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(' ')
      .filter(token => token.length>2 && !ignored.has(token))
    const overlap = (left:unknown,right:unknown) => {
      const a=tokens(left),b=new Set(tokens(right)); return a.filter(token=>b.has(token)).length
    }
    const sameDate = (left:unknown,right:unknown) => {
      if(!left||!right)return false
      const a=new Date(String(left)),b=new Date(String(right))
      return !Number.isNaN(a.getTime())&&!Number.isNaN(b.getTime())&&a.toISOString().slice(0,10)===b.toISOString().slice(0,10)
    }

    const ranked = candidates.map(sheet => {
      const ownerMatch = sheet.clubId===opponentClubId || overlap(sheet.clubName,opponentName)>=1
      const opponentMatch = overlap(sheet.opponentName,currentClubName)>=1
      if (!ownerMatch || !opponentMatch) return null
      const score =
        (sheet.clubId===opponentClubId?100:0) +
        overlap(sheet.clubName,opponentName)*30 +
        overlap(sheet.opponentName,currentClubName)*25 +
        (sheet.fixtureId===current.fixtureId?80:0) +
        (normaliseRound(sheet.grade)===normaliseRound(fixture.grade)?15:0) +
        (normaliseRound(sheet.roundLabel)===normaliseRound(fixture.round)?12:0) +
        (sameDate(sheet.matchDate,fixture.matchDate)?12:0) +
        (sheet.status==='PUBLISHED'?2:0)
      return { sheet,score }
    }).filter((item): item is {sheet:(typeof candidates)[number];score:number} => Boolean(item))
      .sort((a,b)=>b.score-a.score)

    const selected = ranked[0]?.sheet
    if (!selected) return res.json({ data:null })
    const opposition = await loadSheet(selected.id)
    res.json({ data:opposition ? { ...opposition, clubId:undefined } : null })
  } catch(error) {
    res.status(500).json({ error:'failed to load opposition selected team',detail:String(error) })
  }
})

'''
path.write_text(text[:start] + new_endpoint + text[end:])
