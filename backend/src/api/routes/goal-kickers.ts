/**
 * Goal Kickers API
 * GET /api/goal-kickers — country-wide football goal kicking ladder.
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

export { router as goalKickersRouter }
