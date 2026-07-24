import { Router } from 'express'
import { prisma } from '../../db/client.js'

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
  return { ...sheet, players }
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
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=180')
    if (!rows[0]) return res.json({ data: null, positions: POSITIONS })
    res.json({ data: await loadSheet(rows[0].id), positions: POSITIONS })
  } catch (error) { res.status(500).json({ error: 'failed to load selected team', detail: String(error) }) }
})

const adminRouter = Router()
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
    const rows = await prisma.$queryRawUnsafe(`
      INSERT INTO football_club_players (club_id, player_id, player_name, jumper_number, preferred_position)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (club_id, lower(player_name)) DO UPDATE SET player_id=COALESCE(EXCLUDED.player_id,football_club_players.player_id), jumper_number=EXCLUDED.jumper_number, preferred_position=EXCLUDED.preferred_position, active=true, updated_at=now()
      RETURNING id::text AS id, player_id AS "playerId", player_name AS "playerName", jumper_number AS "jumperNumber", preferred_position AS "preferredPosition", active
    `, req.params.clubId, req.body?.playerId ? String(req.body.playerId) : null, playerName, Number.isFinite(jumper) ? jumper : null, req.body?.preferredPosition ? String(req.body.preferredPosition) : null)
    res.status(201).json({ data: (rows as any[])[0] })
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
    const roundLabel = String(req.body?.roundLabel ?? '').trim()
    if (!roundLabel) return res.status(400).json({ error: 'roundLabel is required' })
    const rows = await prisma.$queryRawUnsafe<Array<{ id:string }>>(`
      INSERT INTO football_team_sheets (club_id, league_id, season, grade, round_label, opponent_name, match_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (club_id, season, grade, round_label) DO UPDATE SET league_id=EXCLUDED.league_id, opponent_name=EXCLUDED.opponent_name, match_date=EXCLUDED.match_date, updated_at=now()
      RETURNING id::text AS id
    `, req.params.clubId, req.body?.leagueId ? String(req.body.leagueId) : null, season, grade, roundLabel, req.body?.opponentName ? String(req.body.opponentName) : null, req.body?.matchDate || null)
    res.status(201).json({ data: await loadSheet(rows[0].id) })
  } catch (error) { res.status(500).json({ error: 'failed to create team sheet', detail: String(error) }) }
})

adminRouter.put('/:sheetId', async (req, res) => {
  try {
    await ensureTeamSheetTables()
    const status = String(req.body?.status ?? 'DRAFT').toUpperCase() === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT'
    await prisma.$executeRawUnsafe(`UPDATE football_team_sheets SET status=$2, published_at=CASE WHEN $2='PUBLISHED' THEN now() ELSE NULL END, opponent_name=COALESCE($3,opponent_name), match_date=COALESCE($4,match_date), updated_at=now() WHERE id::text=$1`, req.params.sheetId, status, req.body?.opponentName ?? null, req.body?.matchDate ?? null)
    res.json({ data: await loadSheet(req.params.sheetId) })
  } catch (error) { res.status(500).json({ error: 'failed to update team sheet', detail: String(error) }) }
})

adminRouter.put('/:sheetId/positions', async (req, res) => {
  try {
    await ensureTeamSheetTables()
    const incoming = Array.isArray(req.body?.positions) ? req.body.positions : []
    const clean = incoming.map((row:any) => ({ positionCode: String(row.positionCode ?? ''), clubPlayerId: String(row.clubPlayerId ?? '') })).filter((row:any) => POSITIONS.includes(row.positionCode as any) && row.clubPlayerId)
    if (new Set(clean.map((r:any) => r.positionCode)).size !== clean.length || new Set(clean.map((r:any) => r.clubPlayerId)).size !== clean.length) return res.status(400).json({ error: 'Each player and position can only be used once' })
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(`DELETE FROM football_team_sheet_players WHERE team_sheet_id::text=$1`, req.params.sheetId)
      for (const row of clean) await tx.$executeRawUnsafe(`INSERT INTO football_team_sheet_players (team_sheet_id,club_player_id,position_code) VALUES ($1::uuid,$2::uuid,$3)`, req.params.sheetId, row.clubPlayerId, row.positionCode)
    })
    res.json({ data: await loadSheet(req.params.sheetId) })
  } catch (error) { res.status(500).json({ error: 'failed to save positions', detail: String(error) }) }
})

export { publicRouter as teamSheetsRouter, adminRouter as adminTeamSheetsRouter }
