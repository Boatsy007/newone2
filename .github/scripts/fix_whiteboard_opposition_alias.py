from pathlib import Path

path = Path('backend/src/api/routes/club-team-sheets.ts')
text = path.read_text()
old = """    const rows = await prisma.$queryRawUnsafe<Array<{id:string}>>(`SELECT id::text AS id FROM football_team_sheets WHERE club_id=$1 AND fixture_id=$2 AND status IN ('DRAFT','PUBLISHED') ORDER BY CASE WHEN status='PUBLISHED' THEN 0 ELSE 1 END,updated_at DESC LIMIT 1`, opponentClubId, current.fixtureId)
    if (!rows[0]) return res.json({ data:null })
    const opposition = await loadSheet(rows[0].id)
"""
new = """    // The Club Portal team sheet can legitimately belong to an authorised team alias
    // while the fixture stores the canonical club id. Prefer the other sheet attached to
    // this exact fixture, regardless of which equivalent club id owns it.
    let rows = await prisma.$queryRawUnsafe<Array<{id:string}>>(`
      SELECT id::text AS id
      FROM football_team_sheets
      WHERE fixture_id=$1
        AND club_id<>$2
        AND status IN ('DRAFT','PUBLISHED')
      ORDER BY CASE WHEN status='PUBLISHED' THEN 0 ELSE 1 END,updated_at DESC
      LIMIT 1
    `, current.fixtureId, current.clubId)

    // Older Club Portal selections may not yet have fixture_id populated. Match the
    // opponent's existing selection using the same football context instead of creating
    // or moving records. The opponent name must point back to the current club.
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
          AND lower(regexp_replace(coalesce(s.grade,''),'[^a-z0-9]','','g'))=lower(regexp_replace(coalesce($5,''),'[^a-z0-9]','','g'))
          AND (
            lower(coalesce(s.opponent_name,'')) LIKE '%' || lower(coalesce($6,'')) || '%'
            OR lower(coalesce($6,'')) LIKE '%' || lower(coalesce(s.opponent_name,'')) || '%'
          )
          AND (
            s.round_label=$7
            OR (s.match_date IS NOT NULL AND $8::date IS NOT NULL AND s.match_date=$8::date)
          )
          AND (
            s.club_id=$1
            OR lower(coalesce(owner.name,'')) LIKE '%' || lower(split_part(coalesce(canonical.name,''),' QFA',1)) || '%'
            OR lower(coalesce(canonical.name,'')) LIKE '%' || lower(split_part(coalesce(owner.name,''),' QFA',1)) || '%'
          )
        ORDER BY CASE WHEN s.status='PUBLISHED' THEN 0 ELSE 1 END,s.updated_at DESC
        LIMIT 1
      `, opponentClubId, current.clubId, current.season, current.leagueId, current.grade, current.clubName, current.roundLabel, current.matchDate)
    }
    if (!rows[0]) return res.json({ data:null })
    const opposition = await loadSheet(rows[0].id)
"""
if old not in text:
    raise SystemExit('opposition lookup anchor not found')
path.write_text(text.replace(old, new, 1))
