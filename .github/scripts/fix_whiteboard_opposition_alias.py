from pathlib import Path

path = Path('backend/src/api/routes/club-team-sheets.ts')
text = path.read_text()
start = text.index("    // The Club Portal team sheet can legitimately belong to an authorised team alias")
end = text.index("    if (!rows[0]) return res.json({ data:null })", start)
replacement = r'''    // Prefer any opposition selection already linked to this exact fixture.
    let rows = await prisma.$queryRawUnsafe<Array<{id:string}>>(`
      SELECT s.id::text AS id
      FROM football_team_sheets s
      WHERE s.fixture_id=$1
        AND s.club_id<>$2
        AND s.status IN ('DRAFT','PUBLISHED')
        AND EXISTS (SELECT 1 FROM football_team_sheet_players tsp WHERE tsp.team_sheet_id=s.id)
      ORDER BY CASE WHEN s.status='PUBLISHED' THEN 0 ELSE 1 END,s.updated_at DESC
      LIMIT 1
    `, current.fixtureId, current.clubId)

    // Older Club Portal selections may use an equivalent team id and may not have
    // fixture_id populated. Resolve the actual opponent selection from the football
    // relationship, while preferring exact fixture/date/round metadata when present.
    if (!rows[0]) {
      rows = await prisma.$queryRawUnsafe<Array<{id:string}>>(`
        SELECT s.id::text AS id
        FROM football_team_sheets s
        LEFT JOIN clubs owner ON owner.id::text=s.club_id
        LEFT JOIN clubs canonical ON canonical.id::text=$1
        WHERE s.club_id<>$2
          AND s.status IN ('DRAFT','PUBLISHED')
          AND s.season=$3
          AND ($4::text IS NULL OR s.league_id=$4)
          AND regexp_replace(lower(coalesce(s.grade,'')),'[^a-z0-9]','','g')=
              regexp_replace(lower(coalesce($5,'')),'[^a-z0-9]','','g')
          AND EXISTS (SELECT 1 FROM football_team_sheet_players tsp WHERE tsp.team_sheet_id=s.id)
          AND (
            lower(coalesce(s.opponent_name,'')) LIKE '%' || lower(split_part(coalesce($6,''),' QFA',1)) || '%'
            OR lower(coalesce($6,'')) LIKE '%' || lower(split_part(coalesce(s.opponent_name,''),' QFA',1)) || '%'
          )
          AND (
            s.club_id=$1
            OR lower(coalesce(owner.name,'')) LIKE '%' || lower(split_part(coalesce(canonical.name,''),' QFA',1)) || '%'
            OR lower(coalesce(canonical.name,'')) LIKE '%' || lower(split_part(coalesce(owner.name,''),' QFA',1)) || '%'
          )
        ORDER BY
          CASE WHEN s.fixture_id=$7 THEN 0 ELSE 1 END,
          CASE WHEN s.match_date IS NOT NULL AND $8::date IS NOT NULL AND s.match_date=$8::date THEN 0 ELSE 1 END,
          CASE WHEN s.round_label=$9 THEN 0 ELSE 1 END,
          CASE WHEN s.status='PUBLISHED' THEN 0 ELSE 1 END,
          s.updated_at DESC
        LIMIT 1
      `, opponentClubId, current.clubId, current.season, current.leagueId, current.grade, current.clubName, current.fixtureId, current.matchDate, current.roundLabel)
    }
'''
text = text[:start] + replacement + text[end:]
path.write_text(text)
