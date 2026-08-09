import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { upsertCanonicalGoalKicker } from '../../services/canonical-goal-kicker-upsert.js'

const POSITIONS = ['BP_LEFT','FB','BP_RIGHT','HBF_LEFT','CHB','HBF_RIGHT','WING_LEFT','CENTRE','WING_RIGHT','HFF_LEFT','CHF','HFF_RIGHT','FP_LEFT','FF','FP_RIGHT','RUCK','RUCK_ROVER','ROVER','INTERCHANGE_1','INTERCHANGE_2','INTERCHANGE_3','INTERCHANGE_4','EMERGENCY_1','EMERGENCY_2','EMERGENCY_3'] as const

let teamSheetTablesPromise: Promise<void> | null = null

function ensureTeamSheetTables() {
  if (teamSheetTablesPromise) return teamSheetTablesPromise
  teamSheetTablesPromise = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS football_club_players (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        club_id text NOT NULL,
        player_id text NULL,
        player_name text NOT NULL,
        jumper_number integer NULL,
        preferred_position text NULL,
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS football_club_players_identity ON football_club_players (club_id, lower(player_name))`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS football_club_players_club ON football_club_players (club_id, active, player_name)`)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS football_team_sheets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        club_id text NOT NULL,
        league_id text NULL,
        season text NOT NULL,
        grade text NOT NULL DEFAULT 'Senior Football',
        round_label text NOT NULL,
        opponent_name text NULL,
        match_date date NULL,
        status text NOT NULL DEFAULT 'DRAFT',
        published_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    await prisma.$executeRawUnsafe(`ALTER TABLE football_team_sheets ADD COLUMN IF NOT EXISTS fixture_id text NULL`)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS football_team_sheets_identity ON football_team_sheets (club_id, season, grade, round_label)`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS football_team_sheets_public ON football_team_sheets (club_id, status, match_date DESC, created_at DESC)`)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS football_team_sheet_players (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        team_sheet_id uuid NOT NULL REFERENCES football_team_sheets(id) ON DELETE CASCADE,
        club_player_id uuid NOT NULL REFERENCES football_club_players(id) ON DELETE CASCADE,
        position_code text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (team_sheet_id, club_player_id),
        UNIQUE (team_sheet_id, position_code)
      )
    `)
  })().catch(error => {
    teamSheetTablesPromise = null
    throw error
  })
  return teamSheetTablesPromise
}

function normaliseRoundLabel(value: unknown) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (!/^round\b/i.test(raw)) return raw
  const numberOrName = raw.replace(/^(?:round\s+)+/i, '').trim()
  return numberOrName ? `Round ${numberOrName}` : 'Round'
}

function normaliseTeamName(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

type PlayerContext = {
  clubId: string
  clubName: string
  leagueId: string
  leagueName: string
  season: string
  grade: string
}

type ClubPlayerRow = {
  id: string
  playerId: string | null
  playerName: string
  jumperNumber: number | null
  preferredPosition: string | null
  active: boolean
}

async function resolvePlayerContext(clubId: string, preferred?: Partial<Pick<PlayerContext, 'leagueId' | 'season' | 'grade'>>): Promise<PlayerContext | null> {
  const club = await prisma.club.findUnique({ where: { id: clubId }, select: { id: true, name: true } })
  if (!club) return null

  if (preferred?.leagueId) {
    const league = await prisma.league.findUnique({ where: { id: preferred.leagueId }, select: { id: true, name: true } })
    if (league) return {
      clubId: club.id,
      clubName: club.name,
      leagueId: league.id,
      leagueName: league.name,
      season: String(preferred.season ?? new Date().getFullYear()),
      grade: String(preferred.grade ?? 'Senior Football'),
    }
  }

  const latestSheet = await prisma.$queryRawUnsafe<Array<{ leagueId: string | null; season: string; grade: string }>>(`
    SELECT league_id AS "leagueId", season, grade
    FROM football_team_sheets
    WHERE club_id = $1 AND league_id IS NOT NULL
    ORDER BY match_date DESC NULLS LAST, created_at DESC
    LIMIT 1
  `, clubId)
  if (latestSheet[0]?.leagueId) {
    const league = await prisma.league.findUnique({ where: { id: latestSheet[0].leagueId }, select: { id: true, name: true } })
    if (league) return { clubId: club.id, clubName: club.name, leagueId: league.id, leagueName: league.name, season: latestSheet[0].season, grade: latestSheet[0].grade }
  }

  const membership = await prisma.clubLeagueSeason.findFirst({
    where: { clubId, isActive: true },
    orderBy: [{ season: 'desc' }, { updatedAt: 'desc' }],
    select: { season: true, grade: true, league: { select: { id: true, name: true } } },
  })
  if (!membership) return null
  return {
    clubId: club.id,
    clubName: club.name,
    leagueId: membership.league.id,
    leagueName: membership.league.name,
    season: membership.season,
    grade: membership.grade || 'Senior Football',
  }
}

async function ensurePlayerProfile(player: ClubPlayerRow, context: PlayerContext): Promise<string> {
  if (player.playerId) {
    const existing = await prisma.footballGoalKicker.findUnique({ where: { id: player.playerId }, select: { id: true } }).catch(() => null)
    if (existing) return existing.id
  }

  const outcome = await upsertCanonicalGoalKicker({
    playerName: player.playerName,
    clubId: context.clubId,
    clubName: context.clubName,
    leagueId: context.leagueId,
    leagueName: context.leagueName,
    season: context.season,
    grade: context.grade,
    goals: 0,
    matches: null,
    sourceUrl: null,
    sourceType: 'MANUAL_ENTRY',
  })
  await prisma.$executeRawUnsafe(`UPDATE football_club_players SET player_id=$2::text, updated_at=now() WHERE id::text=$1::text`, player.id, outcome.playerRowId)
  return outcome.playerRowId
}

type SheetRow = {
  id: string; clubId: string; clubName: string | null; clubLogoUrl: string | null; primaryColour: string | null; secondaryColour: string | null
  leagueId: string | null; leagueName: string | null; season: string; grade: string; roundLabel: string; opponentName: string | null
  matchDate: string | null; status: string; publishedAt: string | null
}

async function loadSheet(sheetId: string) {
  const sheets = await prisma.$queryRawUnsafe<SheetRow[]>(`
    SELECT s.id, s.club_id AS "clubId", c.name AS "clubName", c."logoUrl" AS "clubLogoUrl",
      c."primaryColour" AS "primaryColour", c."secondaryColour" AS "secondaryColour",
      s.league_id AS "leagueId", l.name AS "leagueName", s.season, s.grade,
      s.round_label AS "roundLabel", s.opponent_name AS "opponentName", s.match_date AS "matchDate",
      s.status, s.published_at AS "publishedAt"
    FROM football_team_sheets s
    LEFT JOIN clubs c ON c.id::text = s.club_id
    LEFT JOIN leagues l ON l.id::text = s.league_id
    WHERE s.id::text = $1
  `, sheetId)
  const sheet = sheets[0]
  if (!sheet) return null
  const players = await prisma.$queryRawUnsafe<Array<{ id:string; clubPlayerId:string; playerId:string|null; playerName:string; jumperNumber:number|null; positionCode:string }>>(`
    SELECT tsp.id, cp.id::text AS "clubPlayerId", cp.player_id AS "playerId", cp.player_name AS "playerName",
      cp.jumper_number AS "jumperNumber", tsp.position_code AS "positionCode"
    FROM football_team_sheet_players tsp
    JOIN football_club_players cp ON cp.id = tsp.club_player_id
    WHERE tsp.team_sheet_id::text = $1
    ORDER BY tsp.position_code
  `, sheetId)
  return { ...sheet, roundLabel: normaliseRoundLabel(sheet.roundLabel), players }
}

const publicRouter = Router()
publicRouter.get('/club/:clubId', async (req, res) => {
  try {
    const { clubId } = req.params
    const rows = await prisma.$queryRawUnsafe<Array<{ id:string }>>(`
      SELECT id::text AS id FROM football_team_sheets
      WHERE club_id = $1 AND status = 'PUBLISHED'
      ORDER BY match_date DESC NULLS LAST, published_at DESC NULLS LAST, created_at DESC LIMIT 1
    `, clubId)
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    if (!rows[0]) return res.json({ data: null, positions: POSITIONS })
    res.json({ data: await loadSheet(rows[0].id), positions: POSITIONS })
  } catch (error) { res.status(500).json({ error: 'failed to load selected team', detail: String(error) }) }
})

const adminRouter = Router()
adminRouter.get('/clubs', async (_req, res) => {
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

adminRouter.get('/club/:clubId/players', async (req, res) => {
  try {
    await ensureTeamSheetTables()
    const rows = await prisma.$queryRawUnsafe(`SELECT id::text AS id, player_id AS "playerId", player_name AS "playerName", jumper_number AS "jumperNumber", preferred_position AS "preferredPosition", active FROM football_club_players WHERE club_id=$1 ORDER BY active DESC, player_name`, req.params.clubId)
    res.json({ data: rows, positions: POSITIONS })
  } catch (error) { res.status(500).json({ error: 'failed to load club players', detail: String(error) }) }
})

adminRouter.post('/club/:clubId/players', async (req, res) => {
  try {
    await ensureTeamSheetTables()
    const playerName = String(req.body?.playerName ?? '').trim()
    if (!playerName) return res.status(400).json({ error: 'playerName is required' })
    const jumper = req.body?.jumperNumber === '' || req.body?.jumperNumber == null ? null : Number(req.body.jumperNumber)
    const rows = await prisma.$queryRawUnsafe<ClubPlayerRow[]>(`
      INSERT INTO football_club_players (club_id, player_id, player_name, jumper_number, preferred_position)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (club_id, lower(player_name)) DO UPDATE SET player_id=COALESCE(EXCLUDED.player_id,football_club_players.player_id), jumper_number=EXCLUDED.jumper_number, preferred_position=EXCLUDED.preferred_position, active=true, updated_at=now()
      RETURNING id::text AS id, player_id AS "playerId", player_name AS "playerName", jumper_number AS "jumperNumber", preferred_position AS "preferredPosition", active
    `, req.params.clubId, req.body?.playerId ? String(req.body.playerId) : null, playerName, Number.isFinite(jumper) ? jumper : null, req.body?.preferredPosition ? String(req.body.preferredPosition) : null)
    const player = rows[0]
    const context = await resolvePlayerContext(req.params.clubId)
    if (context) player.playerId = await ensurePlayerProfile(player, context)
    res.status(201).json({ data: player, profileCreated: Boolean(context), playerProfileUrl: player.playerId ? `/player/${encodeURIComponent(player.playerId)}` : null })
  } catch (error) { res.status(500).json({ error: 'failed to save club player', detail: String(error) }) }
})

adminRouter.get('/club/:clubId/sheets', async (req, res) => {
  try {
    await ensureTeamSheetTables()
    const rows = await prisma.$queryRawUnsafe<Array<{ id:string }>>(`SELECT id::text AS id FROM football_team_sheets WHERE club_id=$1 ORDER BY match_date DESC NULLS LAST, created_at DESC`, req.params.clubId)
    const data = await Promise.all(rows.map(row => loadSheet(row.id)))
    res.json({ data: data.filter(Boolean), positions: POSITIONS })
  } catch (error) { res.status(500).json({ error: 'failed to load team sheets', detail: String(error) }) }
})

adminRouter.post('/club/:clubId/sheets', async (req, res) => {
  try {
    await ensureTeamSheetTables()
    const season = String(req.body?.season ?? new Date().getFullYear())
    const grade = String(req.body?.grade ?? 'Senior Football').trim()
    const roundLabel = normaliseRoundLabel(req.body?.roundLabel)
    if (!roundLabel) return res.status(400).json({ error: 'roundLabel is required' })
    const rows = await prisma.$queryRawUnsafe<Array<{ id:string }>>(`
      INSERT INTO football_team_sheets (club_id, league_id, season, grade, round_label, opponent_name, match_date)
      VALUES ($1::text,$2::text,$3::text,$4::text,$5::text,$6::text,$7::date)
      ON CONFLICT (club_id, season, grade, round_label) DO UPDATE SET league_id=EXCLUDED.league_id, opponent_name=EXCLUDED.opponent_name, match_date=EXCLUDED.match_date, updated_at=now()
      RETURNING id::text AS id
    `, String(req.params.clubId), req.body?.leagueId ? String(req.body.leagueId) : null, season, grade, roundLabel, req.body?.opponentName ? String(req.body.opponentName) : null, req.body?.matchDate ? String(req.body.matchDate).slice(0,10) : null)
    res.status(201).json({ data: await loadSheet(rows[0].id) })
  } catch (error) { res.status(500).json({ error: 'failed to create team sheet', detail: String(error) }) }
})

adminRouter.put('/:sheetId', async (req, res) => {
  try {
    await ensureTeamSheetTables()
    const status = String(req.body?.status ?? 'DRAFT').toUpperCase() === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT'
    if (status === 'PUBLISHED') {
      const counts = await prisma.$queryRawUnsafe<Array<{ count:number }>>(`SELECT COUNT(*)::int AS count FROM football_team_sheet_players WHERE team_sheet_id=$1::uuid`, req.params.sheetId)
      if (!counts[0]?.count) return res.status(400).json({ error: 'Save at least one player position before publishing the team' })
    }
    await prisma.$executeRawUnsafe(`UPDATE football_team_sheets SET status=$2::text, published_at=CASE WHEN $2::text='PUBLISHED' THEN now() ELSE NULL END, opponent_name=COALESCE($3::text,opponent_name), match_date=COALESCE($4::date,match_date), updated_at=now() WHERE id::text=$1::text`, req.params.sheetId, status, req.body?.opponentName ?? null, req.body?.matchDate ? String(req.body.matchDate).slice(0,10) : null)
    res.json({ data: await loadSheet(req.params.sheetId) })
  } catch (error) { res.status(500).json({ error: 'failed to update team sheet', detail: String(error) }) }
})

adminRouter.put('/:sheetId/positions', async (req, res) => {
  try {
    await ensureTeamSheetTables()
    const incoming = Array.isArray(req.body?.positions) ? req.body.positions : []
    const clean = incoming.map((row:any) => ({ positionCode: String(row.positionCode ?? ''), clubPlayerId: String(row.clubPlayerId ?? '') })).filter((row:any) => POSITIONS.includes(row.positionCode as any) && row.clubPlayerId)
    if (new Set(clean.map((r:any) => r.positionCode)).size !== clean.length || new Set(clean.map((r:any) => r.clubPlayerId)).size !== clean.length) return res.status(400).json({ error: 'Each player and position can only be used once' })

    const sheet = await loadSheet(req.params.sheetId)
    if (!sheet) return res.status(404).json({ error: 'Team sheet not found' })
    if (!sheet.leagueId || !sheet.leagueName || !sheet.clubName) return res.status(400).json({ error: 'The selected fixture must be connected to a club and league before saving players' })
    const context: PlayerContext = { clubId: sheet.clubId, clubName: sheet.clubName, leagueId: sheet.leagueId, leagueName: sheet.leagueName, season: sheet.season, grade: sheet.grade }
    const selectedPlayers = clean.length ? await prisma.$queryRawUnsafe<ClubPlayerRow[]>(`
      SELECT id::text AS id, player_id AS "playerId", player_name AS "playerName", jumper_number AS "jumperNumber", preferred_position AS "preferredPosition", active
      FROM football_club_players WHERE club_id=$1 AND id = ANY($2::uuid[])
    `, sheet.clubId, clean.map((row:any) => row.clubPlayerId)) : []
    for (const player of selectedPlayers) await ensurePlayerProfile(player, context)

    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(`DELETE FROM football_team_sheet_players WHERE team_sheet_id::text=$1`, req.params.sheetId)
      for (const row of clean) await tx.$executeRawUnsafe(`INSERT INTO football_team_sheet_players (team_sheet_id,club_player_id,position_code) VALUES ($1::uuid,$2::uuid,$3)`, req.params.sheetId, row.clubPlayerId, row.positionCode)
    })
    res.json({ data: await loadSheet(req.params.sheetId), profilesLinked: selectedPlayers.length })
  } catch (error) { res.status(500).json({ error: 'failed to save positions', detail: String(error) }) }
})

export { publicRouter as teamSheetsRouter, adminRouter as adminTeamSheetsRouter }
