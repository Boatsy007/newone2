import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { cachePublic } from '../middleware/cache-middleware.js'
import { publicRateLimit } from '../middleware/rate-limit.js'

const router = Router()

router.get('/achievements', publicRateLimit, cachePublic(180), async (req, res) => {
  try {
    const query = req.query as Record<string, string | undefined>
    let playerId = query.playerId ?? ''
    if (!playerId && query.playerRowId) {
      const row = await prisma.footballGoalKicker.findUnique({ where: { id: query.playerRowId }, select: { playerId: true } })
      playerId = row?.playerId ?? ''
    }
    if (!playerId && !query.clubId && !query.leagueId) return res.status(400).json({ error: 'playerId, playerRowId, clubId or leagueId required' })

    const needles = [
      ...(playerId ? [`\"playerId\":\"${playerId}\"`] : []),
      ...(query.clubId ? [`\"clubId\":\"${query.clubId}\"`] : []),
      ...(query.leagueId ? [`\"leagueId\":\"${query.leagueId}\"`] : []),
    ]
    const rows = await prisma.notification.findMany({
      where: {
        type: 'GOAL_KICKER_ACHIEVEMENT',
        category: 'PLAYER',
        status: { not: 'SUPPRESSED' },
        OR: needles.map(needle => ({ data: { contains: needle } })),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, title: true, body: true, data: true, createdAt: true },
    })

    const data = rows.flatMap(row => {
      try {
        const detail = row.data ? JSON.parse(row.data) as Record<string, unknown> : {}
        return [{
          id: row.id,
          type: String(detail.achievementType ?? 'GOAL_KICKER_ACHIEVEMENT'),
          title: row.title,
          body: row.body ?? '',
          label: String(detail.achievementLabel ?? 'Achievement'),
          value: String(detail.achievementValue ?? ''),
          playerName: String(detail.playerName ?? ''),
          clubName: String(detail.clubName ?? ''),
          leagueName: String(detail.leagueName ?? ''),
          playerUrl: String(detail.playerUrl ?? '/goal-kickers'),
          shareCardType: String(detail.shareCardType ?? 'GOAL_KICKER_ACHIEVEMENT'),
          createdAt: row.createdAt.toISOString(),
        }]
      } catch { return [] }
    })
    res.json({ data, meta: { total: data.length } })
  } catch (error) {
    res.status(500).json({ error: 'Unable to load goal-kicker achievements', detail: String(error) })
  }
})

export { router as goalKickerAchievementsRouter }
