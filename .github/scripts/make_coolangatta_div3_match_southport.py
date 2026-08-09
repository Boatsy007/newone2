from pathlib import Path
import re

path = Path('backend/src/api/routes/coach-app.ts')
text = path.read_text()

helper = r'''async function ensureCanonicalFixtureSheet(club: { id:string; name:string }, team: { leagueId:string; season:string; grade:string } | null, fixture: Fixture | null) {
  const targetClubId = 'ba284591-89e1-4b64-878c-9560e2c74c02'
  if (!team || !fixture || club.id !== targetClubId) return false

  const existing = await prisma.$queryRawUnsafe<Array<{id:string}>>(`
    SELECT id::text AS id FROM football_team_sheets
    WHERE club_id=$1 AND fixture_id=$2
    LIMIT 1
  `, targetClubId, fixture.id)
  if (existing[0]) return false

  const isHome = fixture.homeClubId === targetClubId
  const opponent = isHome ? fixture.awayName : fixture.homeName
  const roundLabel = fixture.round ? `Round ${String(fixture.round).replace(/^Round\\s+/i,'')}` : 'Upcoming fixture'
  const matchDate = fixture.matchDate ? fixture.matchDate.toISOString().slice(0,10) : null

  // Create the canonical fixture-linked sheet first. Squad reconciliation must never block Coach App context.
  await prisma.$executeRawUnsafe(`
    INSERT INTO football_team_sheets
      (club_id,league_id,season,grade,round_label,opponent_name,match_date,status,fixture_id,created_at,updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,'DRAFT',$8,NOW(),NOW())
    ON CONFLICT (club_id,fixture_id) WHERE fixture_id IS NOT NULL DO UPDATE SET
      league_id=EXCLUDED.league_id,season=EXCLUDED.season,grade=EXCLUDED.grade,
      round_label=EXCLUDED.round_label,opponent_name=EXCLUDED.opponent_name,
      match_date=EXCLUDED.match_date,updated_at=NOW()
  `, targetClubId, fixture.leagueId, fixture.season, fixture.grade, roundLabel, opponent, matchDate, fixture.id)

  // Best-effort copy of the existing Coolangatta squad. Any legacy-row mismatch is logged but cannot break login.
  try {
    const sourceClubRows = await prisma.$queryRawUnsafe<Array<{clubId:string}>>(`
      SELECT cp.club_id AS "clubId"
      FROM football_club_players cp
      LEFT JOIN clubs c ON c.id::text=cp.club_id
      WHERE cp.club_id<>$1 AND lower(COALESCE(c.name,'')) LIKE '%coolangatta%'
      GROUP BY cp.club_id
      ORDER BY COUNT(*) DESC
      LIMIT 1
    `, targetClubId)
    const sourceClubId = sourceClubRows[0]?.clubId ?? null
    if (sourceClubId) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO football_club_players
          (club_id,player_id,player_name,jumper_number,preferred_position,active,created_at,updated_at)
        SELECT $1,player_id,player_name,jumper_number,preferred_position,active,created_at,NOW()
        FROM football_club_players WHERE club_id=$2
        ON CONFLICT DO NOTHING
      `, targetClubId, sourceClubId)
    }
  } catch (error) {
    console.warn('Coolangatta Div 3 squad reconciliation skipped', error)
  }

  return true
}

'''
pattern = re.compile(r"async function ensureCanonicalFixtureSheet\([\s\S]*?\n}\n\nasync function loadFixture", re.MULTILINE)
if not pattern.search(text):
    raise SystemExit('ensureCanonicalFixtureSheet function not found')
text = pattern.sub(helper + 'async function loadFixture', text, count=1)
path.write_text(text)
