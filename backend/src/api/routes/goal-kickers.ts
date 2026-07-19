/**
 * Goal Kickers API
 * GET /api/goal-kickers — country-wide football goal kicking ladder.
 * GET /api/goal-kickers/records — weekly goal gains and current season leaders.
 * GET /api/goal-kickers/player/:id — a player profile built from imported goal-kicker records.
 */

import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { cachePublic } from '../middleware/cache-middleware.js'
import { publicRateLimit } from '../middleware/rate-limit.js'

const router = Router()

type Mode = 'raw' | 'adjusted'

function modeOf(value: unknown): Mode {
  return value === 'adjusted' ? 'adjusted' : 'raw'
}

function limitOf(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 100
  return Math.max(1, Math.min(500, Math.trunc(n)))
}

function leagueStrength(league: { finalStrengthRating: number | null; manualStrengthOverride: number | null; strengthTier: number | null } | null | undefined): number {
  return league?.finalStrengthRating ?? league?.manualStrengthOverride ?? league?.strengthTier ?? 3
}

function australianWeek(now = new Date()) {
  const offsetMs = 10 * 60 * 60 * 1000
  const local = new Date(now.getTime() + offsetMs)
  const day = local.getUTCDay()
  const daysSinceMonday = (day + 6) % 7
  const startLocal = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysSinceMonday, 0, 0, 0, 0))
  const endLocal = new Date(startLocal.getTime() + 7 * 86400000)
  return { start: new Date(startLocal.getTime() - offsetMs), end: new Date(endLocal.getTime() - offsetMs) }
}

router.get('/', publicRateLimit, cachePublic(600), async (req, res) => {
  try {
    const query = req.query as Record<string, string | undefined>
    const mode = modeOf(query.mode)
    const limit = limitOf(query.limit)

    const rows = await prisma.footballGoalKicker.findMany({
      where: {
        ...(query.leagueId ? { leagueId: query.leagueId } : {}),
        ...(query.season ? { season: query.season } : {}),
      },
      orderBy: [{ goals: 'desc' }, { playerName: 'asc' }],
      take: Math.max(limit, 500),
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
        league: { select: { finalStrengthRating: true, manualStrengthOverride: true, strengthTier: true } },
      },
    })

    const ranked = rows.map(row => {
      const strength = leagueStrength(row.league)
      return {
        id: row.id,
        playerName: row.playerName,
        clubName: row.clubName,
        clubId: row.clubId,
        clubLogoUrl: row.club?.logoUrl ?? null,
        leagueName: row.leagueName,
        leagueId: row.leagueId,
        season: row.season,
        grade: row.grade,
        goals: row.goals,
        matches: row.matches,
        leagueStrength: strength,
        adjustedGoals: Math.round(row.goals * (strength / 4) * 100) / 100,
      }
    })

    ranked.sort((a, b) => {
      const primary = mode === 'adjusted' ? b.adjustedGoals - a.adjustedGoals : b.goals - a.goals
      return primary || b.goals - a.goals || a.playerName.localeCompare(b.playerName)
    })

    res.json({
      data: ranked.slice(0, limit).map((row, index) => ({ rank: index + 1, ...row })),
      meta: { total: ranked.length, mode, limit },
    })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', detail: String(err) })
  }
})

router.get('/records', publicRateLimit, cachePublic(300), async (req, res) => {
  try {
    const query = req.query as Record<string, string | undefined>
    const limit = Math.max(1, Math.min(Number(query.limit) || 5, 20))
    const season = query.season || new Date().getFullYear().toString()
    const week = australianWeek()

    const [events, seasonRows] = await Promise.all([
      prisma.notification.findMany({
        where: {
          type: 'GOAL_KICKER_UPDATED',
          createdAt: { gte: week.start, lt: week.end },
          ...(query.leagueId ? { data: { contains: `\"leagueId\":\"${query.leagueId}\"` } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 2000,
        select: { entityId: true, data: true, createdAt: true },
      }),
      prisma.footballGoalKicker.findMany({
        where: { season, ...(query.leagueId ? { leagueId: query.leagueId } : {}) },
        orderBy: [{ goals: 'desc' }, { playerName: 'asc' }],
        take: limit,
        select: {
          id: true, playerName: true, clubId: true, clubName: true, leagueId: true, leagueName: true,
          season: true, grade: true, goals: true, matches: true, club: { select: { logoUrl: true } },
        },
      }),
    ])

    type Weekly = {
      playerId: string; playerName: string; clubId: string | null; clubName: string; leagueId: string; leagueName: string;
      season: string; grade: string; previousGoals: number; goals: number; weeklyGoals: number; matchesAdded: number | null;
      playerUrl: string; clubUrl: string | null; leagueUrl: string; updatedAt: string;
    }
    const latestByPlayer = new Map<string, Weekly>()
    for (const event of events) {
      if (!event.data || !event.entityId || latestByPlayer.has(event.entityId)) continue
      try {
        const parsed = JSON.parse(event.data) as Omit<Weekly, 'updatedAt'>
        if (parsed.season !== season || !Number.isFinite(parsed.weeklyGoals) || parsed.weeklyGoals <= 0) continue
        latestByPlayer.set(event.entityId, { ...parsed, updatedAt: event.createdAt.toISOString() })
      } catch { /* ignore malformed legacy event payloads */ }
    }
    const weekly = [...latestByPlayer.values()]
      .sort((a, b) => b.weeklyGoals - a.weeklyGoals || b.goals - a.goals || a.playerName.localeCompare(b.playerName))
      .slice(0, limit)
      .map((row, index) => ({ rank: index + 1, ...row }))

    const seasonLeaders = seasonRows.map((row, index) => ({
      rank: index + 1,
      playerId: row.id,
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
      leagueUrl: `/league/${encodeURIComponent(row.leagueId)}`,
    }))

    res.json({
      data: { weekly, seasonLeaders },
      meta: { season, weekStart: week.start.toISOString(), weekEnd: week.end.toISOString(), limit },
    })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', detail: String(err) })
  }
})

router.get('/player/:id', publicRateLimit, cachePublic(600), async (req, res) => {
  try {
    const current = await prisma.footballGoalKicker.findUnique({
      where: { id: req.params.id },
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
        club: { select: { logoUrl: true, townName: true, state: { select: { code: true, name: true } } } },
        league: { select: { finalStrengthRating: true, manualStrengthOverride: true, strengthTier: true } },
      },
    })
    if (!current) return res.status(404).json({ error: 'Player not found' })

    const seasonRows = await prisma.footballGoalKicker.findMany({
      where: { season: current.season },
      orderBy: [{ goals: 'desc' }, { playerName: 'asc' }],
      select: { id: true, goals: true, playerName: true },
    })
    const rank = seasonRows.findIndex(row => row.id === current.id) + 1

    const history = await prisma.footballGoalKicker.findMany({
      where: { playerName: { equals: current.playerName, mode: 'insensitive' } },
      orderBy: [{ season: 'desc' }, { goals: 'desc' }],
      select: {
        id: true,
        season: true,
        grade: true,
        goals: true,
        matches: true,
        clubId: true,
        clubName: true,
        leagueId: true,
        leagueName: true,
        club: { select: { logoUrl: true } },
        league: { select: { finalStrengthRating: true, manualStrengthOverride: true, strengthTier: true } },
      },
    })

    const strength = leagueStrength(current.league)
    res.json({
      data: {
        id: current.id,
        playerName: current.playerName,
        clubId: current.clubId,
        clubName: current.clubName,
        clubLogoUrl: current.club?.logoUrl ?? null,
        leagueId: current.leagueId,
        leagueName: current.leagueName,
        season: current.season,
        grade: current.grade,
        goals: current.goals,
        matches: current.matches,
        goalsPerGame: current.matches && current.matches > 0 ? Math.round((current.goals / current.matches) * 100) / 100 : null,
        rank: rank > 0 ? rank : null,
        leagueStrength: strength,
        adjustedGoals: Math.round(current.goals * (strength / 4) * 100) / 100,
        town: current.club?.townName ?? null,
        state: current.club?.state?.code ?? null,
        stateName: current.club?.state?.name ?? null,
        history: history.map(row => {
          const rowStrength = leagueStrength(row.league)
          return {
            id: row.id,
            season: row.season,
            grade: row.grade,
            goals: row.goals,
            matches: row.matches,
            goalsPerGame: row.matches && row.matches > 0 ? Math.round((row.goals / row.matches) * 100) / 100 : null,
            adjustedGoals: Math.round(row.goals * (rowStrength / 4) * 100) / 100,
            clubId: row.clubId,
            clubName: row.clubName,
            clubLogoUrl: row.club?.logoUrl ?? null,
            leagueId: row.leagueId,
            leagueName: row.leagueName,
          }
        }),
      },
    })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', detail: String(err) })
  }
})

export { router as goalKickersRouter }
