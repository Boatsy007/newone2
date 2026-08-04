import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { publicRateLimit } from '../middleware/rate-limit.js'

const router = Router()
const text = (value: unknown, max = 240) => String(value ?? '').trim().slice(0, max)
const numberValue = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0

function eventTime(event: Record<string, unknown>) {
  return numberValue(event.elapsedSeconds ?? event.elapsed ?? event.seconds ?? event.matchSeconds ?? event.timeSeconds)
}

function eventQuarter(event: Record<string, unknown>, fallback: number) {
  return Math.max(1, Math.min(8, numberValue(event.quarter ?? event.period ?? fallback) || fallback || 1))
}

function eventType(event: Record<string, unknown>) {
  const raw = text(event.type ?? event.eventType ?? event.kind ?? event.action, 60).toUpperCase()
  const label = text(event.label ?? event.title ?? event.description, 240).toUpperCase()
  if (raw.includes('INTERCHANGE') || raw.includes('SWAP') || label.includes('INTERCHANGE') || label.includes('SWAPPED')) return 'INTERCHANGE'
  if (raw.includes('GOAL') || /(^|\s)GOAL(\s|$|[·:—-])/.test(label)) return 'GOAL'
  if (raw.includes('BEHIND') || label.includes('BEHIND')) return 'BEHIND'
  if (raw.includes('QUARTER') || raw.includes('PERIOD') || label.includes('QUARTER TIME') || label.includes('HALF TIME') || label.includes('THREE QUARTER')) return 'QUARTER'
  if (raw.includes('FINAL') || raw.includes('SIREN') || label.includes('FINAL SIREN')) return 'FINAL'
  return raw || 'UPDATE'
}

function normaliseEvent(value: unknown, index: number, fallbackQuarter: number) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const event = value as Record<string, unknown>
  const type = eventType(event)
  const playerName = text(event.playerName ?? event.player ?? event.scorerName ?? event.scorer, 140) || null
  const playerOff = text(event.playerOff ?? event.offPlayer ?? event.offName, 140) || null
  const playerOn = text(event.playerOn ?? event.onPlayer ?? event.onName, 140) || null
  const team = text(event.teamName ?? event.team ?? event.side ?? event.clubName, 160) || null
  let label = text(event.label ?? event.title ?? event.description, 240)
  if (!label) {
    if (type === 'INTERCHANGE' && (playerOff || playerOn)) label = `${playerOff || 'Player'} off · ${playerOn || 'Player'} on`
    else if (playerName) label = `${type === 'GOAL' ? 'Goal' : type === 'BEHIND' ? 'Behind' : 'Update'} — ${playerName}`
    else label = type === 'UPDATE' ? 'Match update' : type.charAt(0) + type.slice(1).toLowerCase()
  }
  const createdAt = text(event.createdAt ?? event.timestamp ?? event.at ?? event.time, 80) || null
  const id = text(event.id ?? event.eventId, 100) || `${type.toLowerCase()}-${eventQuarter(event, fallbackQuarter)}-${eventTime(event)}-${index}`
  return {
    id,
    type,
    label,
    playerName,
    playerOff,
    playerOn,
    team,
    quarter: eventQuarter(event, fallbackQuarter),
    elapsedSeconds: eventTime(event),
    createdAt,
  }
}

router.use(publicRateLimit)
router.get('/clubs/:clubId', async (req, res) => {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ sheetId: string; state: Record<string, unknown>; updatedAt: Date }>>(`
      SELECT md.sheet_id AS "sheetId", md.state, md.updated_at AS "updatedAt"
      FROM club_match_day_state md
      JOIN football_team_sheets ts ON ts.id::text=md.sheet_id AND ts.club_id=md.club_id
      WHERE md.club_id=$1
      ORDER BY CASE WHEN ts.status='PUBLISHED' THEN 0 ELSE 1 END, md.updated_at DESC
      LIMIT 1
    `, req.params.clubId)
    const row = rows[0]
    const state = row?.state && typeof row.state === 'object' ? row.state : {}
    const quarter = Math.max(1, numberValue(state.quarter) || 1)
    const rawEvents = Array.isArray(state.events) ? state.events : []
    const events = rawEvents
      .map((event, index) => normaliseEvent(event, index, quarter))
      .filter(Boolean)
      .slice(0, 80)

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.json({ data: { clubId: req.params.clubId, sheetId: row?.sheetId ?? null, events, updatedAt: row?.updatedAt ?? null } })
  } catch (error) {
    res.status(500).json({ error: 'Unable to load live match timeline', detail: error instanceof Error ? error.message : String(error) })
  }
})

export { router as liveTimelineRouter }
