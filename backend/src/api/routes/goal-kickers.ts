/**
 * Goal Kickers API
 * GET /api/goal-kickers — country-wide football goal kicking ladder.
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
