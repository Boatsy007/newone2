import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { cachePublic } from '../middleware/cache-middleware.js'
import { publicRateLimit } from '../middleware/rate-limit.js'

const router = Router()

type GoalChange = {
  playerId?: string
  playerRowId?: string
  playerName: string
  clubId?: string | null
  clubName: string
  leagueId?: string | null
  leagueName: string
  season: string
  grade: string
  previousGoals: number
  goals: number
  weeklyGoals: number
  previousMatches?: number | null
  matches?: number | null
  matchesAdded?: number | null
  playerUrl?: string
  clubUrl?: string | null
  leagueUrl?: string
  updatedAt: string
}

function australianWeek(now = new Date()) {
  const offsetMs = 10 * 60 * 60 * 1000
  const local = new Date(now.getTime() + offsetMs)
  const daysSinceMonday = (local.getUTCDay() + 6) % 7
  const startLocal = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysSinceMonday))
  const endLocal = new Date(startLocal.getTime() + 7 * 86400000)
  return { start: new Date(startLocal.getTime() - offsetMs), end: new Date(endLocal.getTime() - offsetMs) }
}

function parseEvents(events: Array<{ data: string | null; createdAt: Date }>, season: string): GoalChange[] {
  return events.flatMap(event => {
    if (!event.data) return []
    try {
      const data = JSON.parse(event.data) as Omit<GoalChange, 'updatedAt'>
      if (data.season !== season || !data.playerName || !Number.isFinite(data.weeklyGoals) || data.weeklyGoals <= 0) return []
      return [{ ...data, updatedAt: event.createdAt.toISOString() }]
    } catch {
      return []
    }
  })
}

const keyOf = (row: { playerName: string; clubName: string; leagueName: string; season: string; grade: string }) =>
  `${row.season}|${row.grade}|${row.leagueName}|${row.clubName}|${row.playerName}`.trim().toLowerCase()

router.get('/records', publicRateLimit, cachePublic(120), async (req, res) => {
  try {
    const query = req.query as Record<string, string | undefined>
    const limit = Math.max(1, Math.min(Number(query.limit) || 5, 20))
    const season = query.season || new Date().getFullYear().toString()
    const week = australianWeek()

    const [rows, events] = await Promise.all([
      prisma.footballGoalKicker.findMany({
        where: { season, ...(query.leagueId ? { leagueId: query.leagueId } : {}) },
        orderBy: [{ goals: 'desc' }, { playerName: 'asc' }],
        take: 5000,
        select: {
          id: true,
          playerName: true,
          clubId: true,
          clubName: true,
          leagueId: true,
          leagueName: true,
          season: true,
          grade: true,
          goals: true,
          matches: true,
          club: { select: { logoUrl: true } },
        },
      }),
      prisma.notification.findMany({
        where: { type: 'GOAL_KICKER_UPDATED' },
        orderBy: { createdAt: 'desc' },
        take: 5000,
        select: { data: true, createdAt: true },
      }).catch(() => []),
    ])

    const deduped = new Map<string, (typeof rows)[number]>()
    for (const row of rows) {
      const key = keyOf(row)
      const current = deduped.get(key)
      if (!current || row.goals > current.goals || (row.goals === current.goals && (row.matches ?? 0) > (current.matches ?? 0))) deduped.set(key, row)
    }

    const publicRows = [...deduped.values()]
      .sort((a, b) => b.goals - a.goals || a.playerName.localeCompare(b.playerName))
      .map(row => ({
        playerId: row.id,
        playerRowId: row.id,
        playerName: row.playerName,
        clubId: row.clubId,
        clubName: row.clubName,
        clubLogoUrl: row.club?.logoUrl ?? null,
        leagueId: row.leagueId,
        leagueName: row.leagueName,
        season: row.season,
        grade: row.grade,
        goals: row.goals,
        matches: row.matches,
        goalsPerGame: row.matches && row.matches > 0 ? Math.round((row.goals / row.matches) * 100) / 100 : null,
        playerUrl: `/player/${encodeURIComponent(row.id)}`,
        clubUrl: row.clubId ? `/team/${encodeURIComponent(row.clubId)}` : null,
        leagueUrl: row.leagueId ? `/league/${encodeURIComponent(row.leagueId)}` : '/leagues',
      }))

    const parsed = parseEvents(events, season)
    const identity = (change: GoalChange) => change.playerId || change.playerRowId || keyOf(change)
    const weeklyByPlayer = new Map<string, GoalChange>()
    for (const change of parsed) {
      const changedAt = new Date(change.updatedAt)
      const key = identity(change)
      if (changedAt < week.start || changedAt >= week.end || weeklyByPlayer.has(key)) continue
      weeklyByPlayer.set(key, change)
    }

    const decorate = (change: GoalChange, index: number) => ({
      rank: index + 1,
      ...change,
      playerId: change.playerId || change.playerRowId || identity(change),
      playerUrl: change.playerUrl || (change.playerRowId ? `/player/${encodeURIComponent(change.playerRowId)}` : '/goal-kickers'),
    })

    const weekly = [...weeklyByPlayer.values()]
      .sort((a, b) => b.weeklyGoals - a.weeklyGoals || b.goals - a.goals || a.playerName.localeCompare(b.playerName))
      .slice(0, limit)
      .map(decorate)

    const biggestBags = [...parsed]
      .sort((a, b) => b.weeklyGoals - a.weeklyGoals || b.goals - a.goals || a.playerName.localeCompare(b.playerName))
      .slice(0, limit)
      .map(decorate)

    const seasonLeaders = publicRows.slice(0, limit).map((row, index) => ({ rank: index + 1, ...row }))
    const goalsPerGameLeaders = publicRows
      .filter(row => row.goalsPerGame != null)
      .sort((a, b) => (b.goalsPerGame ?? 0) - (a.goalsPerGame ?? 0) || b.goals - a.goals)
      .slice(0, limit)
      .map((row, index) => ({ rank: index + 1, ...row }))

    res.json({
      data: { weekly, biggestBags, seasonLeaders, goalsPerGameLeaders, fastestTo50: [], fastestTo100: [] },
      meta: { season, weekStart: week.start.toISOString(), weekEnd: week.end.toISOString(), limit, deduplicated: rows.length - publicRows.length },
    })
  } catch (error) {
    res.status(500).json({ error: 'Unable to load goal-kicker records', detail: String(error) })
  }
})

export { router as goalKickerRecordsSafeRouter }
