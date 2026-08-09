from pathlib import Path

path = Path('backend/src/api/routes/coach-app.ts')
text = path.read_text()

anchor = "async function loadFixture(fixtureId: string, clubId: string): Promise<Fixture | null> {"
helper = r'''async function reconcileExistingAliasSheet(club: { id:string; name:string }, team: { leagueId:string; season:string; grade:string } | null) {
  if (!team) return false
  const candidates = await prisma.club.findMany({
    where: {
      id: { not: club.id },
      name: { equals: club.name, mode: 'insensitive' },
      leagueSeasons: { some: { leagueId:team.leagueId, season:team.season, grade:team.grade, isActive:true } },
    },
    select: { id:true },
  })
  if (!candidates.length) return false
  const sourceIds = candidates.map(item => item.id)
  const sourceSheets = await prisma.$queryRawUnsafe<Array<{clubId:string}>>(`
    SELECT club_id AS "clubId" FROM football_team_sheets
    WHERE club_id = ANY($1::text[]) AND season=$2 AND (league_id=$3 OR league_id IS NULL)
    ORDER BY updated_at DESC LIMIT 1
  `, sourceIds, team.season, team.leagueId)
  const sourceClubId = sourceSheets[0]?.clubId
  if (!sourceClubId) return false

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
    `, club.id, sourceClubId)
    await tx.$executeRawUnsafe(`
      INSERT INTO football_team_sheets (club_id,league_id,season,grade,round_label,opponent_name,match_date,status,published_at,fixture_id,created_at,updated_at)
      SELECT $1,league_id,season,grade,round_label,opponent_name,match_date,status,published_at,fixture_id,created_at,NOW()
      FROM football_team_sheets
      WHERE club_id=$2 AND season=$3 AND (league_id=$4 OR league_id IS NULL)
      ON CONFLICT (club_id,season,grade,round_label) DO UPDATE SET
        league_id=COALESCE(EXCLUDED.league_id,football_team_sheets.league_id),
        opponent_name=COALESCE(EXCLUDED.opponent_name,football_team_sheets.opponent_name),
        match_date=COALESCE(EXCLUDED.match_date,football_team_sheets.match_date),
        status=EXCLUDED.status,published_at=EXCLUDED.published_at,updated_at=NOW()
    `, club.id, sourceClubId, team.season, team.leagueId)
    await tx.$executeRawUnsafe(`
      INSERT INTO football_team_sheet_players (team_sheet_id,club_player_id,position_code)
      SELECT target_sheet.id,target_player.id,source_position.position_code
      FROM football_team_sheets source_sheet
      JOIN football_team_sheets target_sheet ON target_sheet.club_id=$1 AND target_sheet.season=source_sheet.season AND target_sheet.grade=source_sheet.grade AND target_sheet.round_label=source_sheet.round_label
      JOIN football_team_sheet_players source_position ON source_position.team_sheet_id=source_sheet.id
      JOIN football_club_players source_player ON source_player.id=source_position.club_player_id
      JOIN football_club_players target_player ON target_player.club_id=$1 AND lower(target_player.player_name)=lower(source_player.player_name)
      WHERE source_sheet.club_id=$2 AND source_sheet.season=$3 AND (source_sheet.league_id=$4 OR source_sheet.league_id IS NULL)
      ON CONFLICT DO NOTHING
    `, club.id, sourceClubId, team.season, team.leagueId)
  })
  return true
}

'''
if 'async function reconcileExistingAliasSheet' not in text:
    if anchor not in text:
        raise SystemExit('helper anchor not found')
    text = text.replace(anchor, helper + anchor, 1)

old = "    const sheet = await loadSheetForFixture(club.id, fixture)\n"
new = "    let sheet = await loadSheetForFixture(club.id, fixture)\n    if (!sheet && await reconcileExistingAliasSheet(club, team)) sheet = await loadSheetForFixture(club.id, fixture)\n"
if old in text:
    text = text.replace(old, new, 1)
elif new not in text:
    raise SystemExit('sheet anchor not found')

path.write_text(text)
