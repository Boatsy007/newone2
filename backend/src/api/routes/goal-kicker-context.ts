import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { cachePublic } from '../middleware/cache-middleware.js'
import { publicRateLimit } from '../middleware/rate-limit.js'

const router = Router()

const safeLimit = (value: unknown) => Math.max(1, Math.min(20, Math.trunc(Number(value) || 8)))

router.get('/context', publicRateLimit, cachePublic(300), async (req, res) => {
  try {
    const query = req.query as Record<string, string | undefined>
    const leagueId = query.leagueId?.trim()
    const clubId = query.clubId?.trim()
    const season = query.season?.trim() || new Date().getFullYear().toString()
    if (!leagueId && !clubId) return res.status(400).json({ error: 'leagueId or clubId required' })

    const rows = await prisma.footballGoalKicker.findMany({
      where: {
        season,
        ...(leagueId ? { leagueId } : {}),
        ...(clubId ? { clubId } : {}),
      },
      orderBy: [{ goals: 'desc' }, { playerName: 'asc' }],
      take: safeLimit(query.limit),
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
        club: { select: { logoUrl: true } },
      },
    })

    res.json({
      data: rows.map((row, index) => ({
        rank: index + 1,
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
        matches: row.matches,
        goalsPerGame: row.matches && row.matches > 0 ? Math.round((row.goals / row.matches) * 100) / 100 : null,
        playerUrl: `/player/${encodeURIComponent(row.id)}`,
        clubUrl: row.clubId ? `/team/${encodeURIComponent(row.clubId)}` : null,
        leagueUrl: row.leagueId ? `/league/${encodeURIComponent(row.leagueId)}` : null,
      })),
      meta: { season, leagueId: leagueId ?? null, clubId: clubId ?? null },
    })
  } catch (error) {
    res.status(500).json({ error: 'failed to load contextual goal kickers', detail: String(error) })
  }
})

export { router as goalKickerContextRouter }
