import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { cachePublic } from '../middleware/cache-middleware.js'
import { publicRateLimit } from '../middleware/rate-limit.js'

const router = Router()

type SortMode = 'goals' | 'gpg' | 'adjusted'

type GoalEvent = {
  playerId?: string
  playerRowId?: string
  previousGoals?: number
  goals?: number
  weeklyGoals?: number
  updatedAt?: string
}

function strength(league: { finalStrengthRating: number | null; manualStrengthOverride: number | null; strengthTier: number | null } | null) {
  return league?.finalStrengthRating ?? league?.manualStrengthOverride ?? league?.strengthTier ?? 3
}

function safeLimit(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(1, Math.min(1000, Math.trunc(parsed))) : 500
}

router.get('/', publicRateLimit, cachePublic(180), async (req, res, next) => {
  try {
    const query = req.query as Record<string, string | undefined>
    const sort: SortMode = query.sort === 'gpg' ? 'gpg' : query.mode === 'adjusted' || query.sort === 'adjusted' ? 'adjusted' : 'goals'
    const limit = safeLimit(query.limit)

    const rows = await prisma.footballGoalKicker.findMany({
      where: {
        ...(query.season ? { season: query.season } : {}),
        ...(query.leagueId ? { leagueId: query.leagueId } : {}),
        ...(query.clubId ? { clubId: query.clubId } : {}),
      },
      orderBy: [{ goals: 'desc' }, { playerName: 'asc' }],
      take: 5000,
      select: {
        id: true, playerId: true, playerName: true, clubId: true, clubName: true, leagueId: true, leagueName: true,
        season: true, grade: true, goals: true, matches: true, importedAt: true, updatedAt: true,
        club: { select: { logoUrl: true } },
        league: { select: { finalStrengthRating: true, manualStrengthOverride: true, strengthTier: true } },
      },
    })

    const events = await prisma.notification.findMany({
      where: {
        type: 'GOAL_KICKER_UPDATED',
        ...(query.season ? { data: { contains: `\"season\":\"${query.season}\"` } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 10000,
      select: { data: true, createdAt: true },
    })

    const latestByPlayer = new Map<string, GoalEvent & { createdAt: Date }>()
    for (const event of events) {
      if (!event.data) continue
      try {
        const payload = JSON.parse(event.data) as GoalEvent
        const key = payload.playerId || payload.playerRowId
        if (key && !latestByPlayer.has(key)) latestByPlayer.set(key, { ...payload, createdAt: event.createdAt })
      } catch { /* ignore malformed historical notifications */ }
    }

    const enriched = rows.map(row => {
      const leagueStrength = strength(row.league)
      const goalsPerGame = row.matches && row.matches > 0 ? Math.round((row.goals / row.matches) * 100) / 100 : null
      const latest = latestByPlayer.get(row.playerId) ?? latestByPlayer.get(row.id)
      const previousGoals = Number.isFinite(latest?.previousGoals) ? Number(latest?.previousGoals) : row.goals
      return {
        id: row.id,
        playerId: row.playerId,
        playerName: row.playerName,
        clubId: row.clubId,
        clubName: row.clubName,
        clubLogoUrl: row.club?.logoUrl ?? null,
        leagueId: row.leagueId,
        leagueName: row.leagueName,
        season: row.season,
        grade: row.grade,
        goals: row.goals,
        previousGoals,
        matches: row.matches,
        goalsPerGame,
        latestGoalsDelta: Number.isFinite(latest?.weeklyGoals) ? Number(latest?.weeklyGoals) : Math.max(0, row.goals - previousGoals),
        latestUpdatedAt: latest?.createdAt.toISOString() ?? row.updatedAt.toISOString(),
        importedAt: row.importedAt.toISOString(),
        leagueStrength,
        adjustedGoals: Math.round(row.goals * (leagueStrength / 4) * 100) / 100,
        milestone: row.goals >= 100 ? 100 : row.goals >= 50 ? 50 : null,
      }
    })

    const score = (row: typeof enriched[number], previous = false) => {
      const goals = previous ? row.previousGoals : row.goals
      if (sort === 'gpg') return row.matches && row.matches > 0 ? goals / row.matches : -1
      if (sort === 'adjusted') return goals * (row.leagueStrength / 4)
      return goals
    }

    enriched.sort((a, b) => score(b) - score(a) || b.goals - a.goals || a.playerName.localeCompare(b.playerName))
    const previousOrder = [...enriched].sort((a, b) => score(b, true) - score(a, true) || b.previousGoals - a.previousGoals || a.playerName.localeCompare(b.playerName))
    const previousRanks = new Map(previousOrder.map((row, index) => [row.playerId, index + 1]))

    const data = enriched.slice(0, limit).map((row, index) => {
      const rank = index + 1
      const previousRank = previousRanks.get(row.playerId) ?? rank
      return { ...row, rank, previousRank, rankMovement: previousRank - rank }
    })

    const facets = {
      seasons: [...new Set(rows.map(row => row.season))].sort().reverse(),
      leagues: [...new Map(rows.filter(row => row.leagueId).map(row => [row.leagueId!, { id: row.leagueId!, name: row.leagueName }])).values()].sort((a, b) => a.name.localeCompare(b.name)),
      clubs: [...new Map(rows.filter(row => row.clubId).map(row => [row.clubId!, { id: row.clubId!, name: row.clubName, leagueId: row.leagueId }])).values()].sort((a, b) => a.name.localeCompare(b.name)),
    }

    res.json({ data, facets, meta: { total: enriched.length, limit, sort, lastUpdated: data[0]?.latestUpdatedAt ?? null, source: 'Approved screenshot imports' } })
  } catch (error) {
    next(error)
  }
})

export { router as goalKickerLeaderboardRouter }
