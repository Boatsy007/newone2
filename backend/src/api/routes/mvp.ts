import { Router } from 'express'
import { publicRateLimit } from '../middleware/rate-limit.js'
import { listMvpEntries } from '../../services/mvp-table.js'

const router = Router()

router.get('/', publicRateLimit, async (req, res) => {
  try {
    const query = req.query as Record<string, string | undefined>
    const limit = Math.min(Math.max(parseInt(query.limit ?? '100', 10) || 100, 1), 1000)
    const data = await listMvpEntries({ season: query.season, leagueId: query.leagueId, clubId: query.clubId, limit })
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120')
    res.json({ data, meta: { season: query.season ?? new Date().getFullYear().toString(), formula: 'BP × 3 × league strength factor, rounded up' } })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'failed to load MVP leaderboard' })
  }
})

export { router as mvpRouter }
