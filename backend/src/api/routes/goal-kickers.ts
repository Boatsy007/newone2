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

type GoalEvent = {
  playerId: string
  playerRowId?: string
  playerName: string
  clubId: string | null
  clubName: string
  leagueId: string
  leagueName: string
  season: string
  grade: string
  previousGoals: number
  goals: number
  weeklyGoals: number
  matchesAdded: number | null
  playerUrl: string
  clubUrl: string | null
  leagueUrl: string
  updatedAt: string
}

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

function australianSeason(season: string) {
  const year = Number(season)
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear()
  const offsetMs = 10 * 60 * 60 * 1000
  return {
    start: new Date(Date.UTC(safeYear, 0, 1) - offsetMs),
    end: new Date(Date.UTC(safeYear + 1, 0, 1) - offsetMs),
  }
}

const identityPart = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')

function leaderboardIdentity(row: { playerName: string; clubId: string | null; clubName: string; leagueId: string; season: string }) {
  return [row.season, row.leagueId, row.clubId || identityPart(row.clubName), identityPart(row.playerName)].join(':')
}

function parseGoalEvent(data: string | null, createdAt: Date): GoalEvent | null {
  if (!data) return null
  try {
    const parsed = JSON.parse(data) as Omit<GoalEvent, 'updatedAt'>
    if (!parsed.playerId || !parsed.playerName || !parsed.season || !Number.isFinite(parsed.weeklyGoals) || parsed.weeklyGoals <= 0) return null
    return { ...parsed, updatedAt: createdAt.toISOString() }
  } catch {
    return null
  }
}

router.get('/', publicRateLimit, cachePublic(300), async (req, res) => {
  try {
    const query = req.query as Record<string, string | undefined>
    const mode = modeOf(query.mode)
    const limit = limitOf(query.limit)

    const [rows, events] = await Promise.all([
      prisma.footballGoalKicker.findMany({
        where: {
          ...(query.leagueId ? { leagueId: query.leagueId } : {}),
          ...(query.season ? { season: query.season } : {}),
        },
        orderBy: [{ goals: 'desc' }, { importedAt: 'desc' }, { playerName: 'asc' }],
        take: Math.max(limit * 8, 1000),
        select: {
          id: true,
          playerId: true,
          playerName: true,
          clubId: true,
          clubName: true,
          leagueId: true,
          leagueName: true,
          season: true,
          grade: true,
          goals: true,
          matches: true,
          importedAt: true,
          club: { select: { logoUrl: true } },
          league: { select: { finalStrengthRating: true, manualStrengthOverride: true, strengthTier: true } },
        },
      }),
      prisma.notification.findMany({
        where: { type: 'GOAL_KICKER_UPDATED' },
        orderBy: { createdAt: 'desc' },
        take: 5000,
        select: { data: true, createdAt: true },
      }),
    ])

    const latestDeltaByPlayer = new Map<string, GoalEvent>()
    const latestDeltaByIdentity = new Map<string, GoalEvent>()
    for (const event of events) {
      const parsed = parseGoalEvent(event.data, event.createdAt)
      if (!parsed) continue
      if (!latestDeltaByPlayer.has(parsed.playerId)) latestDeltaByPlayer.set(parsed.playerId, parsed)
      const identity = [parsed.season, parsed.leagueId, parsed.clubId || identityPart(parsed.clubName), identityPart(parsed.playerName)].join(':')
      if (!latestDeltaByIdentity.has(identity)) latestDeltaByIdentity.set(identity, parsed)
    }

    const canonical = new Map<string, typeof rows[number]>()
    for (const row of rows) {
      const key = leaderboardIdentity(row)
      const existing = canonical.get(key)
      if (!existing || row.goals > existing.goals || (row.goals === existing.goals && row.importedAt > existing.importedAt)) canonical.set(key, row)
    }

    const ranked = [...canonical.values()].map(row => {
      const strength = leagueStrength(row.league)
      const identity = leaderboardIdentity(row)
      const delta = latestDeltaByPlayer.get(row.playerId) ?? latestDeltaByIdentity.get(identity)
      return {
        id: row.id,
        playerId: row.playerId,
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
        latestGoalsDelta: delta?.goals === row.goals ? delta.weeklyGoals : null,
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
    const seasonRange = australianSeason(season)

    const [events, seasonRows] = await Promise.all([
      prisma.notification.findMany({
        where: {
          type: 'GOAL_KICKER_UPDATED',
          createdAt: { gte: seasonRange.start, lt: seasonRange.end },
          ...(query.leagueId ? { data: { contains: `\"leagueId\":\"${query.leagueId}\"` } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 5000,
        select: { data: true, createdAt: true },
      }),
      prisma.footballGoalKicker.findMany({
        where: { season, ...(query.leagueId ? { leagueId: query.leagueId } : {}) },
        orderBy: [{ goals: 'desc' }, { importedAt: 'desc' }, { playerName: 'asc' }],
        take: Math.max(limit * 8, 200),
        select: {
          id: true, playerId: true, playerName: true, clubId: true, clubName: true, leagueId: true, leagueName: true,
          season: true, grade: true, goals: true, matches: true, importedAt: true, club: { select: { logoUrl: true } },
        },
      }),
    ])

    const parsedEvents = events.map(event => parseGoalEvent(event.data, event.createdAt)).filter((event): event is GoalEvent => Boolean(event))
    const latestWeeklyByIdentity = new Map<string, GoalEvent>()
    for (const event of parsedEvents) {
      const createdAt = new Date(event.updatedAt)
      if (createdAt < week.start || createdAt >= week.end) continue
      const identity = [event.season, event.leagueId, event.clubId || identityPart(event.clubName), identityPart(event.playerName)].join(':')
      if (!latestWeeklyByIdentity.has(identity)) latestWeeklyByIdentity.set(identity, event)
    }

    const weekly = [...latestWeeklyByIdentity.values()]
      .sort((a, b) => b.weeklyGoals - a.weeklyGoals || b.goals - a.goals || a.playerName.localeCompare(b.playerName))
      .slice(0, limit)
      .map((row, index) => ({ rank: index + 1, ...row }))

    const biggestBags = [...parsedEvents]
      .sort((a, b) => b.weeklyGoals - a.weeklyGoals || b.goals - a.goals || a.playerName.localeCompare(b.playerName))
      .slice(0, limit)
      .map((row, index) => ({ rank: index + 1, ...row }))

    const canonicalSeason = new Map<string, typeof seasonRows[number]>()
    for (const row of seasonRows) {
      const identity = leaderboardIdentity(row)
      const existing = canonicalSeason.get(identity)
      if (!existing || row.goals > existing.goals || (row.goals === existing.goals && row.importedAt > existing.importedAt)) canonicalSeason.set(identity, row)
    }

    const seasonLeaders = [...canonicalSeason.values()]
      .sort((a, b) => b.goals - a.goals || a.playerName.localeCompare(b.playerName))
      .slice(0, limit)
      .map((row, index) => ({
        rank: index + 1,
        playerId: row.playerId,
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
        leagueUrl: `/league/${encodeURIComponent(row.leagueId)}`,
      }))

    res.json({
      data: { weekly, biggestBags, seasonLeaders },
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
        playerId: true,
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
      where: { playerId: current.playerId },
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
        playerId: current.playerId,
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
