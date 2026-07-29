import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { publicRateLimit } from '../middleware/rate-limit.js'
import { loadMatchDetail } from '../../results/match-detail.service.js'

const router = Router()

router.get('/football/:resultId', publicRateLimit, async (req, res) => {
  try {
    const resultId = String(req.params.resultId)
    const result = await prisma.footballResult.findUnique({ where: { id: resultId }, select: { id: true, published: true, homeClubId: true, awayClubId: true, leagueId: true, season: true } })
    if (!result || !result.published) return res.status(404).json({ error: 'result not found' })
    const detail = await loadMatchDetail(resultId)
    if (!detail) return res.json({ data: null })

    const names = [
      ...((detail.homeGoalKickers as Array<{ playerName?: string }> | undefined) ?? []),
      ...((detail.awayGoalKickers as Array<{ playerName?: string }> | undefined) ?? []),
    ].map(row => String(row.playerName ?? '').trim()).filter(Boolean)
    const players = names.length ? await prisma.footballGoalKicker.findMany({
      where: { leagueId: result.leagueId, season: result.season, playerName: { in: names, mode: 'insensitive' } },
      select: { id: true, playerName: true, clubId: true },
    }).catch(() => []) : []
    const byName = new Map(players.map(player => [player.playerName.toLowerCase(), player]))
    const link = (rows: unknown, clubId: string | null) => (Array.isArray(rows) ? rows : []).map(value => {
      const row = value as Record<string, unknown>
      const playerName = String(row.playerName ?? '')
      const player = byName.get(playerName.toLowerCase())
      return { ...row, playerId: player && (!clubId || !player.clubId || player.clubId === clubId) ? player.id : null }
    })

    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')
    res.json({ data: { ...detail, homeGoalKickers: link(detail.homeGoalKickers, result.homeClubId), awayGoalKickers: link(detail.awayGoalKickers, result.awayClubId) } })
  } catch (error) {
    res.status(500).json({ error: 'failed to load match details', detail: String(error) })
  }
})

export { router as matchDetailsRouter }
