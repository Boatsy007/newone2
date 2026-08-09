from pathlib import Path

backend = Path('backend/src/api/routes/team-sheets.ts')
text = backend.read_text()

text = text.replace(
"""    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS football_team_sheets_identity ON football_team_sheets (club_id, season, grade, round_label)`)
""",
"""    await prisma.$executeRawUnsafe(`ALTER TABLE football_team_sheets ADD COLUMN IF NOT EXISTS fixture_id text NULL`)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS football_team_sheets_identity ON football_team_sheets (club_id, season, grade, round_label)`)
""",
1,
)

round_anchor = """function normaliseRoundLabel(value: unknown) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (!/^round\\b/i.test(raw)) return raw
  const numberOrName = raw.replace(/^(?:round\\s+)+/i, '').trim()
  return numberOrName ? `Round ${numberOrName}` : 'Round'
}
"""
round_replacement = round_anchor + """
function normaliseTeamName(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
"""
if round_anchor not in text:
    raise SystemExit('normaliseRoundLabel anchor not found')
text = text.replace(round_anchor, round_replacement, 1)

start = text.index("adminRouter.get('/clubs', async (_req, res) => {")
end = text.index("adminRouter.get('/club/:clubId/players'", start)
new_clubs = """adminRouter.get('/clubs', async (_req, res) => {
  try {
    const clubs = await prisma.club.findMany({
      where: {
        sport: 'FOOTBALL',
        archivedAt: null,
        isActive: true,
        leagueSeasons: { some: { isActive: true, league: { sport: 'FOOTBALL', archivedAt: null, isActive: true } } },
      },
      select: {
        id: true,
        name: true,
        leagueSeasons: {
          where: { isActive: true, league: { sport: 'FOOTBALL', archivedAt: null, isActive: true } },
          orderBy: [{ season: 'desc' }, { updatedAt: 'desc' }],
          take: 1,
          select: { leagueId: true, season: true, grade: true, league: { select: { name: true } } },
        },
      },
      orderBy: { name: 'asc' },
    })

    const mapped = await Promise.all(clubs.map(async club => {
      const team = club.leagueSeasons[0]
      if (!team) return null
      const fixtures = await prisma.footballFixture.findMany({
        where: { leagueId: team.leagueId, season: team.season, grade: team.grade },
        select: { homeClubId: true, awayClubId: true, homeName: true, awayName: true },
        orderBy: [{ matchDate: 'desc' }, { round: 'desc' }],
        take: 80,
      })
      const direct = fixtures.some(fixture => fixture.homeClubId === club.id || fixture.awayClubId === club.id)
      let canonicalClubId = club.id
      if (!direct) {
        const expected = normaliseTeamName(club.name)
        const fixture = fixtures.find(item => normaliseTeamName(item.homeName) === expected || normaliseTeamName(item.awayName) === expected)
        if (fixture) canonicalClubId = normaliseTeamName(fixture.homeName) === expected ? fixture.homeClubId ?? club.id : fixture.awayClubId ?? club.id
      }
      return {
        clubId: canonicalClubId,
        sourceClubId: canonicalClubId === club.id ? null : club.id,
        clubName: club.name,
        leagueId: team.leagueId,
        leagueName: team.league.name,
        season: team.season,
        grade: team.grade,
      }
    }))
    const data = [...new Map(mapped.filter(Boolean).map(item => [`${item!.leagueId}:${item!.clubId}`, item!])).values()]
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    res.json({ data })
  } catch (error) {
    res.status(500).json({ error: 'failed to load team sheet clubs', detail: String(error) })
  }
})

adminRouter.post('/club/:clubId/reconcile-source', async (req, res) => {
  try {
    await ensureTeamSheetTables()
    const canonicalClubId = String(req.params.clubId)
    const sourceClubId = String(req.body?.sourceClubId ?? '')
    const leagueId = String(req.body?.leagueId ?? '')
    const season = String(req.body?.season ?? '')
    const grade = String(req.body?.grade ?? '')
    if (!sourceClubId || sourceClubId === canonicalClubId) return res.json({ data: { reconciled: false } })
    if (!leagueId || !season || !grade) return res.status(400).json({ error: 'leagueId, season and grade are required' })

    const [canonicalClub, sourceClub, sourceMembership, canonicalFixture] = await Promise.all([
      prisma.club.findUnique({ where: { id: canonicalClubId }, select: { id: true, name: true } }),
      prisma.club.findUnique({ where: { id: sourceClubId }, select: { id: true, name: true } }),
      prisma.clubLeagueSeason.findFirst({ where: { clubId: sourceClubId, leagueId, season, grade, isActive: true }, select: { id: true } }),
      prisma.footballFixture.findFirst({ where: { leagueId, season, grade, OR: [{ homeClubId: canonicalClubId }, { awayClubId: canonicalClubId }] }, select: { id: true } }),
    ])
    if (!canonicalClub || !sourceClub || !sourceMembership || !canonicalFixture) return res.status(400).json({ error: 'The selected source and fixture-linked team could not be validated' })
    if (normaliseTeamName(canonicalClub.name) !== normaliseTeamName(sourceClub.name)) return res.status(400).json({ error: 'The selected source does not match the fixture-linked team' })

    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(`
        INSERT INTO football_club_players (club_id,player_id,player_name,jumper_number,preferred_position,active,created_at,updated_at)
        SELECT $1,player_id,player_name,jumper_number,preferred_position,active,created_at,now()
        FROM football_club_players WHERE club_id=$2
        ON CONFLICT (club_id,lower(player_name)) DO UPDATE SET
          player_id=COALESCE(EXCLUDED.player_id,football_club_players.player_id),
          jumper_number=COALESCE(EXCLUDED.jumper_number,football_club_players.jumper_number),
          preferred_position=COALESCE(EXCLUDED.preferred_position,football_club_players.preferred_position),
          active=EXCLUDED.active,updated_at=now()
      `, canonicalClubId, sourceClubId)
      await tx.$executeRawUnsafe(`
        INSERT INTO football_team_sheets (club_id,league_id,season,grade,round_label,opponent_name,match_date,status,published_at,fixture_id,created_at,updated_at)
        SELECT $1,league_id,season,grade,round_label,opponent_name,match_date,status,published_at,fixture_id,created_at,now()
        FROM football_team_sheets
        WHERE club_id=$2 AND season=$3 AND grade=$4 AND (league_id=$5 OR league_id IS NULL)
        ON CONFLICT (club_id,season,grade,round_label) DO UPDATE SET
          league_id=COALESCE(EXCLUDED.league_id,football_team_sheets.league_id),
          opponent_name=COALESCE(EXCLUDED.opponent_name,football_team_sheets.opponent_name),
          match_date=COALESCE(EXCLUDED.match_date,football_team_sheets.match_date),
          fixture_id=COALESCE(EXCLUDED.fixture_id,football_team_sheets.fixture_id),
          updated_at=now()
      `, canonicalClubId, sourceClubId, season, grade, leagueId)
      await tx.$executeRawUnsafe(`
        INSERT INTO football_team_sheet_players (team_sheet_id,club_player_id,position_code)
        SELECT target_sheet.id,target_player.id,source_position.position_code
        FROM football_team_sheets source_sheet
        JOIN football_team_sheets target_sheet ON target_sheet.club_id=$1 AND target_sheet.season=source_sheet.season AND target_sheet.grade=source_sheet.grade AND target_sheet.round_label=source_sheet.round_label
        JOIN football_team_sheet_players source_position ON source_position.team_sheet_id=source_sheet.id
        JOIN football_club_players source_player ON source_player.id=source_position.club_player_id
        JOIN football_club_players target_player ON target_player.club_id=$1 AND lower(target_player.player_name)=lower(source_player.player_name)
        WHERE source_sheet.club_id=$2 AND source_sheet.season=$3 AND source_sheet.grade=$4 AND (source_sheet.league_id=$5 OR source_sheet.league_id IS NULL)
        ON CONFLICT DO NOTHING
      `, canonicalClubId, sourceClubId, season, grade, leagueId)
    })
    res.json({ data: { reconciled: true, canonicalClubId, sourceClubId } })
  } catch (error) {
    res.status(500).json({ error: 'failed to reconcile team sheet mapping', detail: String(error) })
  }
})

"""
text = text[:start] + new_clubs + text[end:]
backend.write_text(text)

frontend = Path('src/pages/AdminTeamSheets.tsx')
ui = frontend.read_text()
old_type = "type Club={clubId:string;clubName:string;leagueName:string;leagueId?:string|null}"
new_type = "type Club={clubId:string;sourceClubId?:string|null;clubName:string;leagueName:string;leagueId?:string|null;season?:string|null;grade?:string|null}"
if old_type not in ui:
    raise SystemExit('Club type anchor not found')
ui = ui.replace(old_type, new_type, 1)
old_effect = "useEffect(()=>{if(!clubId){setPlayers([]);setSheets([]);setFixtures([]);setFixtureId('');return}void reload(clubId);void loadFixtures(clubId)},[clubId])"
new_effect = """useEffect(()=>{if(!clubId){setPlayers([]);setSheets([]);setFixtures([]);setFixtureId('');return}let cancelled=false;void(async()=>{const team=clubs.find(item=>item.clubId===clubId);if(team?.sourceClubId&&team.sourceClubId!==clubId){setMessage('Connecting this team to its fixture record…');const response=await fetch(`/admin/team-sheets/club/${encodeURIComponent(clubId)}/reconcile-source`,{method:'POST',headers:jsonHeaders(),body:JSON.stringify({sourceClubId:team.sourceClubId,leagueId:team.leagueId,season:team.season,grade:team.grade})});if(!response.ok){const payload=await response.json().catch(()=>({})) as{error?:string};if(!cancelled)setMessage(payload.error||'The team mapping could not be repaired');return}}if(cancelled)return;await reload(clubId);await loadFixtures(clubId);if(team?.sourceClubId&&!cancelled)setMessage('Team connected to the correct league and fixture record.')} )();return()=>{cancelled=true}},[clubId,clubs])"""
if old_effect not in ui:
    raise SystemExit('club loading effect anchor not found')
ui = ui.replace(old_effect, new_effect, 1)
frontend.write_text(ui)
