/**
 * Goal Kickers API
 * GET /api/goal-kickers — country-wide football goal kicking ladder.
 * GET /api/goal-kickers/records — weekly goal gains and current season player records.
 * GET /api/goal-kickers/player/:id — a player profile built from imported goal-kicker records.
 */

import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { cachePublic } from '../middleware/cache-middleware.js'
import { publicRateLimit } from '../middleware/rate-limit.js'

const router = Router()

type Mode = 'raw' | 'adjusted'

type GoalChange = {
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
  previousMatches?: number | null
  matches?: number | null
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

function seasonRange(season: string) {
  const year = Number(season)
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear()
  return { start: new Date(Date.UTC(safeYear, 0, 1)), end: new Date(Date.UTC(safeYear + 1, 0, 1)) }
}

function parseGoalChanges(events: Array<{ entityId: string | null; data: string | null; createdAt: Date }>, season?: string): GoalChange[] {
  return events.flatMap(event => {
    if (!event.data) return []
    try {
      const data = JSON.parse(event.data) as Omit<GoalChange, 'updatedAt'>
      if (season && data.season !== season) return []
      if (!data.playerId || !Number.isFinite(data.weeklyGoals) || data.weeklyGoals <= 0) return []
      return [{ ...data, updatedAt: event.createdAt.toISOString() }]
    } catch {
      return []
    }
  })
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
    const year = seasonRange(season)

    const [events, seasonRows] = await Promise.all([
      prisma.notification.findMany({
        where: {
          type: 'GOAL_KICKER_UPDATED',
          createdAt: { gte: year.start, lt: year.end },
          ...(query.leagueId ? { data: { contains: `\"leagueId\":\"${query.leagueId}\"` } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 5000,
        select: { entityId: true, data: true, createdAt: true },
      }),
      prisma.footballGoalKicker.findMany({
        where: { season, ...(query.leagueId ? { leagueId: query.leagueId } : {}) },
        orderBy: [{ goals: 'desc' }, { playerName: 'asc' }],
        take: 5000,
        select: {
          id: true, playerId: true, playerName: true, clubId: true, clubName: true, leagueId: true, leagueName: true,
          season: true, grade: true, goals: true, matches: true, club: { select: { logoUrl: true } },
        },
      }),
    ])

    const parsed = parseGoalChanges(events, season)
    const latestWeekly = new Map<string, GoalChange>()
    for (const change of parsed) {
      const changedAt = new Date(change.updatedAt)
      if (changedAt < week.start || changedAt >= week.end || latestWeekly.has(change.playerId)) continue
      latestWeekly.set(change.playerId, change)
    }

    const weekly = [...latestWeekly.values()]
      .sort((a, b) => b.weeklyGoals - a.weeklyGoals || b.goals - a.goals || a.playerName.localeCompare(b.playerName))
      .slice(0, limit)
      .map((row, index) => ({ rank: index + 1, ...row }))

    const biggestBags = [...parsed]
      .sort((a, b) => b.weeklyGoals - a.weeklyGoals || b.goals - a.goals || a.playerName.localeCompare(b.playerName))
      .slice(0, limit)
      .map((row, index) => ({ rank: index + 1, ...row }))

    const publicRows = seasonRows.map(row => ({
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

    const seasonLeaders = publicRows
      .slice(0, limit)
      .map((row, index) => ({ rank: index + 1, ...row }))

    const goalsPerGameLeaders = publicRows
      .filter(row => row.goalsPerGame != null)
      .sort((a, b) => (b.goalsPerGame ?? 0) - (a.goalsPerGame ?? 0) || b.goals - a.goals || a.playerName.localeCompare(b.playerName))
      .slice(0, limit)
      .map((row, index) => ({ rank: index + 1, ...row }))

    const milestoneLeaders = (threshold: 50 | 100) => {
      const bestByPlayer = new Map<string, GoalChange>()
      for (const change of parsed) {
        if (change.previousGoals >= threshold || change.goals < threshold || !change.matches || change.matches <= 0) continue
        const current = bestByPlayer.get(change.playerId)
        if (!current || !current.matches || change.matches < current.matches) bestByPlayer.set(change.playerId, change)
      }
      return [...bestByPlayer.values()]
        .sort((a, b) => (a.matches ?? Number.MAX_SAFE_INTEGER) - (b.matches ?? Number.MAX_SAFE_INTEGER) || new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
        .slice(0, limit)
        .map((row, index) => ({ rank: index + 1, milestone: threshold, milestoneMatches: row.matches!, ...row }))
    }

    res.json({
      data: {
        weekly,
        biggestBags,
        seasonLeaders,
        goalsPerGameLeaders,
        fastestTo50: milestoneLeaders(50),
        fastestTo100: milestoneLeaders(100),
      },
      meta: { season, weekStart: week.start.toISOString(), weekEnd: week.end.toISOString(), limit },
    })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', detail: String(err) })
  }
})

router.get('/player/:id', publicRateLimit, cachePublic(300), async (req, res) => {
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

    const year = seasonRange(current.season)
    const [seasonRows, history, events] = await Promise.all([
      prisma.footballGoalKicker.findMany({
        where: { season: current.season },
        orderBy: [{ goals: 'desc' }, { playerName: 'asc' }],
        select: { id: true, playerId: true, goals: true, matches: true, playerName: true },
      }),
      prisma.footballGoalKicker.findMany({
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
      }),
      prisma.notification.findMany({
        where: {
          type: 'GOAL_KICKER_UPDATED',
          createdAt: { gte: year.start, lt: year.end },
          OR: [
            { entityId: current.playerId },
            { data: { contains: `\"playerId\":\"${current.playerId}\"` } },
            { data: { contains: `\"playerRowId\":\"${current.id}\"` } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { entityId: true, data: true, createdAt: true },
      }),
    ])

    const rank = seasonRows.findIndex(row => row.id === current.id || row.playerId === current.playerId) + 1
    const goalHistory = parseGoalChanges(events, current.season)
      .filter(change => change.playerId === current.playerId || change.playerRowId === current.id)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

    const latestChange = goalHistory.find(change =>
      change.leagueId === current.leagueId && change.grade === current.grade && change.goals === current.goals
    ) ?? goalHistory[0] ?? null

    const biggestBagRank = goalHistory.length === 0 ? null : 1 + goalHistory.filter(change => change.weeklyGoals > (latestChange?.weeklyGoals ?? 0)).length
    const goalsPerGame = current.matches && current.matches > 0 ? Math.round((current.goals / current.matches) * 100) / 100 : null
    const goalsPerGameRank = goalsPerGame == null ? null : 1 + seasonRows.filter(row => {
      if (!row.matches || row.matches <= 0) return false
      return row.goals / row.matches > current.goals / current.matches!
    }).length

    const records: Array<{ key: string; label: string; value: string }> = []
    if (rank === 1) records.push({ key: 'season-leader', label: 'Season goal leader', value: `${current.goals} goals` })
    if (latestChange && biggestBagRank === 1) records.push({ key: 'biggest-bag', label: 'Biggest recorded bag', value: `${latestChange.weeklyGoals} goals` })
    if (goalsPerGameRank === 1 && goalsPerGame != null) records.push({ key: 'goals-per-game', label: 'Goals per game leader', value: goalsPerGame.toFixed(2) })

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
        goalsPerGame,
        latestGoals: latestChange?.weeklyGoals ?? 0,
        latestPreviousGoals: latestChange?.previousGoals ?? null,
        latestUpdatedAt: latestChange?.updatedAt ?? null,
        rank: rank > 0 ? rank : null,
        goalsPerGameRank,
        biggestBagRank,
        leagueStrength: strength,
        adjustedGoals: Math.round(current.goals * (strength / 4) * 100) / 100,
        town: current.club?.townName ?? null,
        state: current.club?.state?.code ?? null,
        stateName: current.club?.state?.name ?? null,
        records,
        goalHistory,
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
