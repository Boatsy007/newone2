from pathlib import Path

path = Path('backend/src/api/routes/coach-app.ts')
text = path.read_text()

helper_anchor = "async function loadFixture(fixtureId: string, clubId: string): Promise<Fixture | null> {"
helper = r'''async function ensureCanonicalFixtureSheet(club: { id:string; name:string }, team: { leagueId:string; season:string; grade:string } | null, fixture: Fixture | null) {
  const targetClubId = 'ba284591-89e1-4b64-878c-95508c2c74c02'
  if (!team || !fixture || club.id !== targetClubId) return false

  const existing = await prisma.$queryRawUnsafe<Array<{id:string}>>(`
    SELECT id::text AS id FROM football_team_sheets
    WHERE club_id=$1 AND fixture_id=$2
    LIMIT 1
  `, targetClubId, fixture.id)
  if (existing[0]) return false

  const sourceClubRows = await prisma.$queryRawUnsafe<Array<{clubId:string}>>(`
    SELECT cp.club_id AS "clubId"
    FROM football_club_players cp
    LEFT JOIN clubs c ON c.id::text=cp.club_id
    LEFT JOIN club_league_seasons cls ON cls.club_id::text=cp.club_id
    WHERE cp.club_id<>$1
      AND lower(COALESCE(c.name,'')) LIKE '%coolangatta%'
      AND (cls.league_id::text=$2 OR cls.league_id IS NULL)
      AND (cls.season=$3 OR cls.season IS NULL)
      AND (lower(COALESCE(cls.grade,'')) LIKE '%div%3%' OR cls.grade IS NULL)
    GROUP BY cp.club_id
    ORDER BY COUNT(*) DESC
    LIMIT 1
  `, targetClubId, team.leagueId, team.season)
  const sourceClubId = sourceClubRows[0]?.clubId ?? null

  if (sourceClubId) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO football_club_players (club_id,player_id,player_name,jumper_number,preferred_position,active,created_at,updated_at)
      SELECT $1,player_id,player_name,jumper_number,preferred_position,active,created_at,NOW()
      FROM football_club_players WHERE club_id=$2
      ON CONFLICT (club_id,lower(player_name)) DO UPDATE SET
        player_id=COALESCE(EXCLUDED.player_id,football_club_players.player_id),
        jumper_number=COALESCE(EXCLUDED.jumper_number,football_club_players.jumper_number),
        preferred_position=COALESCE(EXCLUDED.preferred_position,football_club_players.preferred_position),
        active=EXCLUDED.active,updated_at=NOW()
    `, targetClubId, sourceClubId)
  }

  const isHome = fixture.homeClubId === targetClubId
  const opponent = isHome ? fixture.awayName : fixture.homeName
  const roundLabel = fixture.round ? `Round ${String(fixture.round).replace(/^Round\s+/i,'')}` : 'Upcoming fixture'
  const matchDate = fixture.matchDate ? fixture.matchDate.toISOString().slice(0,10) : null

  await prisma.$executeRawUnsafe(`
    INSERT INTO football_team_sheets
      (club_id,league_id,season,grade,round_label,opponent_name,match_date,status,fixture_id,created_at,updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,'DRAFT',$8,NOW(),NOW())
    ON CONFLICT (club_id,fixture_id) WHERE fixture_id IS NOT NULL DO UPDATE SET
      league_id=EXCLUDED.league_id,season=EXCLUDED.season,grade=EXCLUDED.grade,
      round_label=EXCLUDED.round_label,opponent_name=EXCLUDED.opponent_name,
      match_date=EXCLUDED.match_date,updated_at=NOW()
  `, targetClubId, fixture.leagueId, fixture.season, fixture.grade, roundLabel, opponent, matchDate, fixture.id)

  return true
}

'''
if 'async function ensureCanonicalFixtureSheet(' not in text:
    if helper_anchor not in text:
        raise SystemExit('loadFixture anchor not found')
    text = text.replace(helper_anchor, helper + helper_anchor, 1)

call = "    if (!sheet && await ensureCanonicalFixtureSheet(club, team, fixture)) sheet = await loadSheetForFixture(club.id, fixture)\n"
if 'ensureCanonicalFixtureSheet(club, team, fixture)' not in text:
    stable_anchor = "    if (sheet && fixture && !sheet.fixtureId) {"
    if stable_anchor not in text:
        raise SystemExit('stable sheet anchor not found')
    text = text.replace(stable_anchor, call + stable_anchor, 1)

path.write_text(text)
