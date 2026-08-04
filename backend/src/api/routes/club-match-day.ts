import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, requireActiveClubMembership } from '../../auth/club-auth.js'
import { publicRateLimit } from '../middleware/rate-limit.js'

const router = Router()
let ready: Promise<void> | null = null

async function ensureTable() {
  if (!ready) {
    ready = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS club_match_day_state (
          club_id TEXT NOT NULL,
          sheet_id TEXT NOT NULL,
          state JSONB NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          updated_by TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (club_id, sheet_id)
        )
      `)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS club_match_day_updated_idx ON club_match_day_state (club_id, updated_at DESC)`)
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS football_live_matches (
          club_id text PRIMARY KEY,
          team_sheet_id uuid NULL,
          round_label text NULL,
          opponent_name text NULL,
          match_date timestamptz NULL,
          quarter integer NOT NULL DEFAULT 1,
          elapsed_seconds integer NOT NULL DEFAULT 0,
          clock_running boolean NOT NULL DEFAULT false,
          home_goals integer NOT NULL DEFAULT 0,
          home_behinds integer NOT NULL DEFAULT 0,
          away_goals integer NOT NULL DEFAULT 0,
          away_behinds integer NOT NULL DEFAULT 0,
          status text NOT NULL DEFAULT 'HIDDEN',
          last_event text NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `)
    })().catch(error => { ready = null; throw error })
  }
  return ready
}

function validState(value: unknown, sheetId: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const state = value as Record<string, unknown>
  return state.sheetId === sheetId
    && Number.isInteger(state.quarter)
    && Array.isArray(state.slots)
    && Array.isArray(state.events)
}

const numeric = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0
const cleanText = (value: unknown, max = 250) => String(value ?? '').trim().slice(0, max)

function publicLiveState(value: Record<string, unknown>) {
  const events = Array.isArray(value.events) ? value.events as Array<{ label?: unknown }> : []
  const runningSince = numeric(value.runningSince)
  const savedElapsed = Math.max(0, Math.floor(numeric(value.elapsed)))
  const elapsedSeconds = savedElapsed + (runningSince > 0 ? Math.max(0, Math.floor((Date.now() - runningSince) / 1000)) : 0)
  return {
    quarter: Math.max(1, Math.min(8, Math.floor(numeric(value.quarter) || 1))),
    elapsedSeconds,
    clockRunning: runningSince > 0,
    homeGoals: Math.max(0, Math.min(99, Math.floor(numeric(value.homeGoals)))),
    homeBehinds: Math.max(0, Math.min(99, Math.floor(numeric(value.homeBehinds)))),
    awayGoals: Math.max(0, Math.min(99, Math.floor(numeric(value.awayGoals)))),
    awayBehinds: Math.max(0, Math.min(99, Math.floor(numeric(value.awayBehinds)))),
    lastEvent: events[0]?.label ? cleanText(events[0].label) : null,
  }
}

async function normaliseTimer(clubId: string, sheetId: string, value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const state = { ...(value as Record<string, unknown>) }
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ elapsedSeconds: number; clockRunning: boolean }>>(`
      SELECT
        CASE
          WHEN clock_running THEN elapsed_seconds + GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - updated_at))))::int
          ELSE elapsed_seconds
        END AS "elapsedSeconds",
        clock_running AS "clockRunning"
      FROM football_live_matches
      WHERE club_id = $1 AND team_sheet_id::text = $2
      LIMIT 1
    `, clubId, sheetId)
    const live = rows[0]
    if (!live) return state

    state.elapsed = Math.max(0, Number(live.elapsedSeconds) || 0)
    state.runningSince = live.clockRunning ? Date.now() : null
    return state
  } catch {
    return state
  }
}

router.use(publicRateLimit)
router.use(authenticateClubUser)
router.use('/clubs/:clubId', requireActiveClubMembership)

router.get('/clubs/:clubId/history', async (req, res) => {
  try {
    await ensureTable()
    const rows = await prisma.$queryRawUnsafe<Array<{
      sheetId: string
      state: unknown
      version: number
      updatedAt: Date
      updatedBy: string | null
    }>>(`
      SELECT sheet_id AS "sheetId", state, version, updated_at AS "updatedAt", updated_by AS "updatedBy"
      FROM club_match_day_state
      WHERE club_id = $1
      ORDER BY updated_at DESC
    `, req.params.clubId)
    res.json({ data: rows })
  } catch (error) {
    res.status(500).json({ error: 'Unable to load Match Day history', detail: error instanceof Error ? error.message : String(error) })
  }
})

router.get('/clubs/:clubId/sheets/:sheetId', async (req, res) => {
  try {
    await ensureTable()
    const rows = await prisma.$queryRawUnsafe<Array<{state: unknown; version: number; updatedAt: Date; updatedBy: string | null}>>(`
      SELECT state, version, updated_at AS "updatedAt", updated_by AS "updatedBy"
      FROM club_match_day_state
      WHERE club_id = $1 AND sheet_id = $2
      LIMIT 1
    `, req.params.clubId, req.params.sheetId)
    const row = rows[0]
    if (!row) return res.json({ data: null })

    const state = await normaliseTimer(req.params.clubId, req.params.sheetId, row.state)
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    res.json({ data: { state, version: row.version, updatedAt: row.updatedAt, updatedBy: row.updatedBy } })
  } catch (error) {
    res.status(500).json({ error: 'Unable to load Match Day state', detail: error instanceof Error ? error.message : String(error) })
  }
})

router.put('/clubs/:clubId/sheets/:sheetId', async (req, res) => {
  try {
    const state = req.body?.state
    if (!validState(state, req.params.sheetId)) return res.status(400).json({ error: 'A valid Match Day state is required' })
    await ensureTable()

    const canonicalState = state as Record<string, unknown>
    const live = publicLiveState(canonicalState)
    const [rows] = await prisma.$transaction([
      prisma.$queryRawUnsafe<Array<{version: number; updatedAt: Date}>>(`
        INSERT INTO club_match_day_state (club_id, sheet_id, state, version, updated_by, updated_at)
        VALUES ($1, $2, $3::jsonb, 1, $4, NOW())
        ON CONFLICT (club_id, sheet_id) DO UPDATE SET
          state = EXCLUDED.state,
          version = club_match_day_state.version + 1,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        RETURNING version, updated_at AS "updatedAt"
      `, req.params.clubId, req.params.sheetId, JSON.stringify(canonicalState), req.clubUser!.id),
      prisma.$executeRawUnsafe(`
        INSERT INTO football_live_matches(
          club_id,team_sheet_id,round_label,opponent_name,match_date,quarter,elapsed_seconds,clock_running,
          home_goals,home_behinds,away_goals,away_behinds,status,last_event,updated_at
        )
        SELECT $1,ts.id,ts.round_label,ts.opponent_name,ts.match_date,$3,$4,$5,$6,$7,$8,$9,'LIVE',$10,NOW()
        FROM football_team_sheets ts
        WHERE ts.id::text=$2 AND ts.club_id=$1
        ON CONFLICT(club_id) DO UPDATE SET
          team_sheet_id=EXCLUDED.team_sheet_id,
          round_label=EXCLUDED.round_label,
          opponent_name=EXCLUDED.opponent_name,
          match_date=EXCLUDED.match_date,
          quarter=EXCLUDED.quarter,
          elapsed_seconds=EXCLUDED.elapsed_seconds,
          clock_running=EXCLUDED.clock_running,
          home_goals=EXCLUDED.home_goals,
          home_behinds=EXCLUDED.home_behinds,
          away_goals=EXCLUDED.away_goals,
          away_behinds=EXCLUDED.away_behinds,
          status='LIVE',
          last_event=EXCLUDED.last_event,
          updated_at=NOW()
      `, req.params.clubId, req.params.sheetId, live.quarter, live.elapsedSeconds, live.clockRunning,
        live.homeGoals, live.homeBehinds, live.awayGoals, live.awayBehinds, live.lastEvent),
    ])

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    res.json({ data: { state: canonicalState, version: rows[0]?.version ?? 1, updatedAt: rows[0]?.updatedAt ?? new Date() }, message: 'Match Day saved and live broadcast updated' })
  } catch (error) {
    res.status(500).json({ error: 'Unable to save Match Day state', detail: error instanceof Error ? error.message : String(error) })
  }
})

router.delete('/clubs/:clubId/sheets/:sheetId', async (req, res) => {
  try {
    await ensureTable()
    await prisma.$transaction([
      prisma.$executeRawUnsafe(`DELETE FROM club_match_day_state WHERE club_id = $1 AND sheet_id = $2`, req.params.clubId, req.params.sheetId),
      prisma.$executeRawUnsafe(`UPDATE football_live_matches SET status='HIDDEN',clock_running=false,updated_at=NOW() WHERE club_id=$1 AND team_sheet_id::text=$2`, req.params.clubId, req.params.sheetId),
    ])
    res.json({ data: { deleted: true }, message: 'Match Day reset' })
  } catch (error) {
    res.status(500).json({ error: 'Unable to reset Match Day state', detail: error instanceof Error ? error.message : String(error) })
  }
})

export { router as clubMatchDayRouter }
