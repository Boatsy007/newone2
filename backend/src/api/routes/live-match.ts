import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, requireActiveClubMembership, roleCan } from '../../auth/club-auth.js'

const router = Router()
let ready: Promise<void> | null = null

function ensureLiveMatchTable() {
  if (!ready) ready = prisma.$executeRawUnsafe(`
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
  `).then(() => undefined).catch(error => { ready = null; throw error })
  return ready
}

const text = (value: unknown, max = 200) => String(value ?? '').trim().slice(0, max)
const integer = (value: unknown, min: number, max: number) => Math.min(max, Math.max(min, Number.parseInt(String(value ?? 0), 10) || 0))
const numberValue = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0

type LiveRow = {
  clubId:string;clubName:string;teamSheetId:string|null;roundLabel:string|null;opponentName:string|null;matchDate:string|null;quarter:number;elapsedSeconds:number;clockRunning:boolean;homeGoals:number;homeBehinds:number;awayGoals:number;awayBehinds:number;status:string;lastEvent:string|null;updatedAt:string
}

type SharedMatchRow = {
  clubId:string
  clubName:string|null
  sheetId:string
  roundLabel:string|null
  opponentName:string|null
  matchDate:string|null
  sheetStatus:string
  state: Record<string, unknown>
  updatedAt:string
}

const liveSelect = `
  SELECT lm.club_id AS "clubId",c.name AS "clubName",lm.team_sheet_id::text AS "teamSheetId",
    lm.round_label AS "roundLabel",lm.opponent_name AS "opponentName",lm.match_date AS "matchDate",
    lm.quarter,
    CASE
      WHEN lm.clock_running THEN lm.elapsed_seconds + GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - lm.updated_at))))::int
      ELSE lm.elapsed_seconds
    END AS "elapsedSeconds",
    lm.clock_running AS "clockRunning",
    lm.home_goals AS "homeGoals",lm.home_behinds AS "homeBehinds",lm.away_goals AS "awayGoals",lm.away_behinds AS "awayBehinds",
    lm.status,lm.last_event AS "lastEvent",lm.updated_at AS "updatedAt"
  FROM football_live_matches lm
  LEFT JOIN clubs c ON c.id::text=lm.club_id
`

async function sharedMatchDay(clubId: string): Promise<LiveRow | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<SharedMatchRow[]>(`
      SELECT md.club_id AS "clubId",c.name AS "clubName",md.sheet_id AS "sheetId",
        ts.round_label AS "roundLabel",ts.opponent_name AS "opponentName",ts.match_date AS "matchDate",
        ts.status AS "sheetStatus",md.state,md.updated_at AS "updatedAt"
      FROM club_match_day_state md
      JOIN football_team_sheets ts ON ts.id::text=md.sheet_id AND ts.club_id=md.club_id
      LEFT JOIN clubs c ON c.id::text=md.club_id
      WHERE md.club_id=$1
      ORDER BY CASE WHEN ts.status='PUBLISHED' THEN 0 ELSE 1 END,md.updated_at DESC
      LIMIT 1
    `, clubId)
    const row = rows[0]
    if (!row || !row.state || typeof row.state !== 'object') return null
    const state = row.state
    const runningSince = numberValue(state.runningSince)
    const elapsed = numberValue(state.elapsed)
    const elapsedSeconds = elapsed + (runningSince > 0 ? Math.max(0, Math.floor((Date.now() - runningSince) / 1000)) : 0)
    const events = Array.isArray(state.events) ? state.events as Array<{ label?: unknown }> : []
    const homeGoals = numberValue(state.homeGoals)
    const homeBehinds = numberValue(state.homeBehinds)
    const awayGoals = numberValue(state.awayGoals)
    const awayBehinds = numberValue(state.awayBehinds)
    const active = Boolean(runningSince || elapsedSeconds || events.length || homeGoals || homeBehinds || awayGoals || awayBehinds)
    return {
      clubId: row.clubId,
      clubName: row.clubName ?? '',
      teamSheetId: text(state.sheetId, 80) || row.sheetId,
      roundLabel: row.roundLabel,
      opponentName: row.opponentName,
      matchDate: row.matchDate,
      quarter: Math.max(1, numberValue(state.quarter) || 1),
      elapsedSeconds,
      clockRunning: runningSince > 0,
      homeGoals,
      homeBehinds,
      awayGoals,
      awayBehinds,
      status: active ? 'LIVE' : 'READY',
      lastEvent: events[0]?.label ? text(events[0].label, 250) : null,
      updatedAt: row.updatedAt,
    }
  } catch {
    return null
  }
}

router.get('/', async (_req, res) => {
  try {
    await ensureLiveMatchTable()
    const rows = await prisma.$queryRawUnsafe<LiveRow[]>(`${liveSelect}
      WHERE lm.status='LIVE' AND lm.updated_at > now() - interval '8 hours'
      ORDER BY lm.updated_at DESC
      LIMIT 100
    `)
    const data = rows.map(row => ({
      id: `live:${row.clubId}`,
      sourceId: row.teamSheetId,
      sourceType: 'portal',
      homeClubId: row.clubId,
      homeClubName: row.clubName,
      awayClubName: row.opponentName || 'Opposition',
      round: row.roundLabel,
      matchDate: row.matchDate,
      homeScore: row.homeGoals * 6 + row.homeBehinds,
      awayScore: row.awayGoals * 6 + row.awayBehinds,
      status: 'LIVE',
      quarter: row.quarter,
      elapsedSeconds: row.elapsedSeconds,
      clockRunning: row.clockRunning,
      lastEvent: row.lastEvent,
    }))
    res.set('Cache-Control', 'no-store')
    res.json({ data })
  } catch (error) {
    res.status(500).json({ error: 'Unable to load live matches', detail: String(error) })
  }
})

router.get('/clubs/:clubId', async (req, res) => {
  try {
    const shared = await sharedMatchDay(req.params.clubId)
    if (shared) {
      res.set('Cache-Control', 'no-store')
      return res.json({ data: shared })
    }
    await ensureLiveMatchTable()
    const rows = await prisma.$queryRawUnsafe<LiveRow[]>(`${liveSelect}
      WHERE lm.club_id=$1 AND lm.status='LIVE'
        AND lm.updated_at > now() - interval '8 hours'
      LIMIT 1
    `, req.params.clubId)
    res.set('Cache-Control', 'no-store')
    res.json({ data: rows[0] ?? null })
  } catch (error) {
    res.status(500).json({ error: 'Unable to load live match', detail: String(error) })
  }
})

router.put('/clubs/:clubId', authenticateClubUser, requireActiveClubMembership, async (req, res) => {
  try {
    const membership = res.locals.clubMembership as { role: Parameters<typeof roleCan>[0] } | undefined
    if (!membership || !roleCan(membership.role, 'team_selection')) return res.status(403).json({ error: 'Your club role cannot manage Match Day' })
    await ensureLiveMatchTable()

    const teamSheetId = text(req.body?.teamSheetId, 80) || null
    const roundLabel = text(req.body?.roundLabel, 100) || null
    const opponentName = text(req.body?.opponentName, 160) || null
    const matchDateValue = req.body?.matchDate ? new Date(String(req.body.matchDate)) : null
    const matchDate = matchDateValue && !Number.isNaN(matchDateValue.getTime()) ? matchDateValue.toISOString() : null
    const status = req.body?.status === 'LIVE' ? 'LIVE' : 'HIDDEN'

    await prisma.$executeRawUnsafe(`
      INSERT INTO football_live_matches(
        club_id,team_sheet_id,round_label,opponent_name,match_date,quarter,elapsed_seconds,clock_running,
        home_goals,home_behinds,away_goals,away_behinds,status,last_event,updated_at
      ) VALUES($1,$2::uuid,$3,$4,$5::timestamptz,$6,$7,$8,$9,$10,$11,$12,$13,$14,now())
      ON CONFLICT(club_id) DO UPDATE SET
        team_sheet_id=EXCLUDED.team_sheet_id,round_label=EXCLUDED.round_label,opponent_name=EXCLUDED.opponent_name,
        match_date=EXCLUDED.match_date,quarter=EXCLUDED.quarter,elapsed_seconds=EXCLUDED.elapsed_seconds,
        clock_running=EXCLUDED.clock_running,home_goals=EXCLUDED.home_goals,home_behinds=EXCLUDED.home_behinds,
        away_goals=EXCLUDED.away_goals,away_behinds=EXCLUDED.away_behinds,status=EXCLUDED.status,
        last_event=EXCLUDED.last_event,updated_at=now()
    `,
      req.params.clubId, teamSheetId, roundLabel, opponentName, matchDate,
      integer(req.body?.quarter, 1, 8), integer(req.body?.elapsedSeconds, 0, 10800), Boolean(req.body?.clockRunning),
      integer(req.body?.homeGoals, 0, 99), integer(req.body?.homeBehinds, 0, 99),
      integer(req.body?.awayGoals, 0, 99), integer(req.body?.awayBehinds, 0, 99),
      status, text(req.body?.lastEvent, 250) || null,
    )
    res.json({ message: status === 'LIVE' ? 'Live match updated' : 'Live match hidden' })
  } catch (error) {
    res.status(500).json({ error: 'Unable to update live match', detail: String(error) })
  }
})

export { router as liveMatchRouter }
