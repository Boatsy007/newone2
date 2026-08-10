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

    const currentIsHome = fixture.homeClubId === req.params.clubId || fixture.homeClubId === current.clubId
    const opponentCanonicalId = currentIsHome ? fixture.awayClubId : fixture.homeClubId
    const opponentName = currentIsHome ? fixture.awayName : fixture.homeName
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

    // Resolve the opponent's authorised team record the same way the app does, but do not
    // require identical grade label text. League + season + exact team identity own this link;
    // grade is only a preference because legacy/admin labels can differ from fixture labels.
    const authorisedRows = await prisma.$queryRawUnsafe<Array<{clubId:string;grade:string}>>(`
      SELECT c.id::text AS "clubId",COALESCE(cls.grade,'') AS grade
      FROM club_league_seasons cls
      JOIN clubs c ON c.id=cls.club_id
      WHERE cls.league_id::text=$1
        AND cls.season=$2
        AND cls.is_active=true
        AND regexp_replace(lower(coalesce(c.name,'')),'[^a-z0-9]','','g')=
            regexp_replace(lower(coalesce($3,'')),'[^a-z0-9]','','g')
      ORDER BY
        CASE WHEN c.id::text=$4 THEN 0 ELSE 1 END,
        CASE WHEN regexp_replace(lower(coalesce(cls.grade,'')),'[^a-z0-9]','','g')=
                  regexp_replace(lower(coalesce($5,'')),'[^a-z0-9]','','g') THEN 0 ELSE 1 END
      LIMIT 1
    `, fixture.leagueId, fixture.season, opponentName, opponentCanonicalId, fixture.grade)

    const opponentClubId = authorisedRows[0]?.clubId ?? opponentCanonicalId

    // Load the existing selected side owned by that exact opponent team record.
    const sheetRows = await prisma.$queryRawUnsafe<Array<{id:string}>>(`
      SELECT s.id::text AS id
      FROM football_team_sheets s
      JOIN football_team_sheet_players tsp ON tsp.team_sheet_id=s.id
      WHERE s.club_id=$1 AND s.season=$2
        AND (s.league_id=$3 OR s.league_id IS NULL)
        AND s.status IN ('DRAFT','PUBLISHED')
      GROUP BY s.id
      HAVING COUNT(tsp.id)>0
      ORDER BY
        CASE WHEN s.fixture_id=$4 THEN 0 ELSE 1 END,
        CASE WHEN regexp_replace(lower(coalesce(s.grade,'')),'[^a-z0-9]','','g')=
                  regexp_replace(lower(coalesce($5,'')),'[^a-z0-9]','','g') THEN 0 ELSE 1 END,
        CASE WHEN regexp_replace(lower(coalesce(s.round_label,'')),'[^a-z0-9]','','g')=
                  regexp_replace(lower(coalesce($6,'')),'[^a-z0-9]','','g') THEN 0 ELSE 1 END,
        CASE WHEN s.match_date IS NOT NULL AND $7::date IS NOT NULL AND s.match_date=$7::date THEN 0 ELSE 1 END,
        s.updated_at DESC
      LIMIT 1
    `, opponentClubId, fixture.season, fixture.leagueId, current.fixtureId, fixture.grade, fixture.round, fixture.matchDate)

    if (!sheetRows[0]) return res.json({ data:null })
    const opposition = await loadSheet(sheetRows[0].id)
    res.json({ data:opposition ? { ...opposition, clubId:undefined } : null })
  } catch(error) {
    res.status(500).json({ error:'failed to load opposition selected team',detail:String(error) })
  }
})

'''

path.write_text(text[:start] + replacement + text[end:])
