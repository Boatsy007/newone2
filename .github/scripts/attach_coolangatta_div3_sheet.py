from pathlib import Path
import re

path = Path('backend/src/api/routes/coach-app.ts')
text = path.read_text()

start = text.index('async function reconcileExistingAliasSheet(')
end = text.index('\nasync function loadFixture(', start)

replacement = r'''async function reconcileExistingAliasSheet(club: { id:string; name:string }, team: { leagueId:string; season:string; grade:string } | null, fixture: Fixture | null) {
  if (!team || !fixture) return false
  const isHome = fixture.homeClubId === club.id
  const opponent = isHome ? fixture.awayName : fixture.homeName
  const targetTokens = new Set(normalise(club.name).split(' ').filter(token => token.length > 2 && !['qfa','div','division','gold','coast','senior','football'].includes(token)))

  const rows = await prisma.$queryRawUnsafe<Array<{
    sheetId:string;clubId:string;clubName:string;leagueId:string|null;season:string;grade:string;
    roundLabel:string|null;opponentName:string|null;matchDate:string|null;updatedAt:string
  }>>(`
    SELECT s.id::text AS "sheetId",s.club_id AS "clubId",COALESCE(c.name,'') AS "clubName",
      s.league_id AS "leagueId",s.season,s.grade,s.round_label AS "roundLabel",
      s.opponent_name AS "opponentName",s.match_date AS "matchDate",s.updated_at AS "updatedAt"
    FROM football_team_sheets s
    LEFT JOIN clubs c ON c.id::text=s.club_id
    WHERE s.club_id<>$1 AND s.season=$2 AND (s.league_id=$3 OR s.league_id IS NULL)
    ORDER BY s.updated_at DESC
    LIMIT 100
  `, club.id, team.season, team.leagueId)

  const scored = rows.map(row => {
    const rowTokens = new Set(normalise(row.clubName).split(' ').filter(token => token.length > 2 && !['qfa','div','division','gold','coast','senior','football'].includes(token)))
    const nameScore = [...targetTokens].filter(token => rowTokens.has(token)).length
    const sameGrade = normalise(row.grade) === normalise(fixture.grade)
    const sameOpponent = normalise(row.opponentName) === normalise(opponent)
    const sameRound = normalise(row.roundLabel) === normalise(fixture.round)
    const sameDate = dateKey(row.matchDate) === dateKey(fixture.matchDate)
    const score = nameScore * 20 + (sameGrade ? 8 : 0) + (sameOpponent ? 12 : 0) + (sameRound ? 6 : 0) + (sameDate ? 6 : 0)
    return { row, score, nameScore, sameOpponent, sameRound, sameDate }
  }).filter(item => item.nameScore >= 1 && (item.sameOpponent || item.sameRound || item.sameDate))
    .sort((a,b) => b.score - a.score)

  const source = scored[0]?.row
  if (!source) return false

  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe(`
      INSERT INTO football_club_players (club_id,player_id,player_name,jumper_number,preferred_position,active,created_at,updated_at)
      SELECT $1,player_id,player_name,jumper_number,preferred_position,active,created_at,NOW()
      FROM football_club_players WHERE club_id=$2
      ON CONFLICT (club_id,lower(player_name)) DO UPDATE SET
        player_id=COALESCE(EXCLUDED.player_id,football_club_players.player_id),
        jumper_number=COALESCE(EXCLUDED.jumper_number,football_club_players.jumper_number),
        preferred_position=COALESCE(EXCLUDED.preferred_position,football_club_players.preferred_position),
        active=EXCLUDED.active,updated_at=NOW()
    `, club.id, source.clubId)

    const targetSheets = await tx.$queryRawUnsafe<Array<{id:string}>>(`
      INSERT INTO football_team_sheets
        (club_id,league_id,season,grade,round_label,opponent_name,match_date,status,published_at,fixture_id,created_at,updated_at)
      SELECT $1,$2,$3,$4,round_label,opponent_name,match_date,status,published_at,$5,created_at,NOW()
      FROM football_team_sheets WHERE id::text=$6
      ON CONFLICT (club_id,season,grade,round_label) DO UPDATE SET
        league_id=EXCLUDED.league_id,opponent_name=EXCLUDED.opponent_name,match_date=EXCLUDED.match_date,
        status=EXCLUDED.status,published_at=EXCLUDED.published_at,fixture_id=EXCLUDED.fixture_id,updated_at=NOW()
      RETURNING id::text AS id
    `, club.id, fixture.leagueId, fixture.season, fixture.grade, fixture.id, source.sheetId)
    const targetSheetId = targetSheets[0]?.id
    if (!targetSheetId) throw new Error('Unable to create canonical Coolangatta Div 3 team sheet')

    await tx.$executeRawUnsafe(`DELETE FROM football_team_sheet_players WHERE team_sheet_id::text=$1`, targetSheetId)
    await tx.$executeRawUnsafe(`
      INSERT INTO football_team_sheet_players (team_sheet_id,club_player_id,position_code)
      SELECT $1::uuid,target_player.id,source_position.position_code
      FROM football_team_sheet_players source_position
      JOIN football_club_players source_player ON source_player.id=source_position.club_player_id
      JOIN football_club_players target_player ON target_player.club_id=$2 AND lower(target_player.player_name)=lower(source_player.player_name)
      WHERE source_position.team_sheet_id::text=$3
      ON CONFLICT DO NOTHING
    `, targetSheetId, club.id, source.sheetId)
  })
  return true
}
'''

text = text[:start] + replacement + text[end:]
old = 'if (!sheet && await reconcileExistingAliasSheet(club, team)) sheet = await loadSheetForFixture(club.id, fixture)'
new = 'if (!sheet && await reconcileExistingAliasSheet(club, team, fixture)) sheet = await loadSheetForFixture(club.id, fixture)'
if old not in text:
    raise SystemExit('reconcile call not found')
text = text.replace(old, new, 1)
path.write_text(text)
