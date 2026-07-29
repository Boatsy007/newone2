import { Router } from 'express'
import { prisma } from '../db/client.js'
import { requireAdminKey } from '../api/middleware/auth.js'
import { loadMatchDetail, saveMatchDetail } from '../results/match-detail.service.js'
import { parseMatchDetailImage, parseTeamGoalKickerImage } from '../ocr/parse-match-detail-image.js'

const router = Router()
router.use(requireAdminKey)

router.get('/results', async (req, res) => {
  try {
    const leagueId = String(req.query.leagueId ?? '').trim()
    const season = String(req.query.season ?? '').trim()
    const rows = await prisma.footballResult.findMany({
      where: { published: true, ...(leagueId ? { leagueId } : {}), ...(season ? { season } : {}) },
      orderBy: [{ matchDate: 'desc' }, { round: 'desc' }, { updatedAt: 'desc' }],
      take: 250,
      include: { league: { select: { name: true } } },
    })
    res.json({ data: rows.map(row => ({
      id: row.id, leagueId: row.leagueId, leagueName: row.league.name, season: row.season, grade: row.grade,
      round: row.round, matchDate: row.matchDate, homeClubId: row.homeClubId, homeName: row.homeName,
      awayClubId: row.awayClubId, awayName: row.awayName, homeGoals: row.homeGoals, homeBehinds: row.homeBehinds,
      homePoints: row.homePoints, awayGoals: row.awayGoals, awayBehinds: row.awayBehinds, awayPoints: row.awayPoints,
      detailUrl: `/match/result/${encodeURIComponent(row.id)}?source=football`,
    })) })
  } catch (error) {
    res.status(500).json({ error: 'Unable to list detailed results', detail: String(error) })
  }
})

router.post('/ocr', async (req, res) => {
  try {
    const image = typeof req.body?.image === 'string' ? req.body.image : ''
    if (!image) return res.status(400).json({ error: 'image required' })
    const data = await parseMatchDetailImage(image)
    res.json({ data })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Match detail OCR failed' })
  }
})

router.post('/ocr/goal-kickers', async (req, res) => {
  try {
    const image = typeof req.body?.image === 'string' ? req.body.image : ''
    if (!image) return res.status(400).json({ error: 'image required' })
    const data = await parseTeamGoalKickerImage(image)
    res.json({ data })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Goal kicker OCR failed' })
  }
})

router.get('/:resultId', async (req, res) => {
  try {
    const result = await prisma.footballResult.findUnique({ where: { id: String(req.params.resultId) }, include: { league: { select: { name: true } } } })
    if (!result) return res.status(404).json({ error: 'Result not found' })
    const detail = await loadMatchDetail(result.id)
    res.json({ data: { result: { id: result.id, leagueId: result.leagueId, leagueName: result.league.name, season: result.season, grade: result.grade, round: result.round, matchDate: result.matchDate, homeClubId: result.homeClubId, homeName: result.homeName, awayClubId: result.awayClubId, awayName: result.awayName, homeGoals: result.homeGoals, homeBehinds: result.homeBehinds, homePoints: result.homePoints, awayGoals: result.awayGoals, awayBehinds: result.awayBehinds, awayPoints: result.awayPoints }, detail } })
  } catch (error) {
    res.status(500).json({ error: 'Unable to load detailed result', detail: String(error) })
  }
})

router.patch('/:resultId', async (req, res) => {
  try {
    const result = await prisma.footballResult.findUnique({ where: { id: String(req.params.resultId) }, select: { id: true, published: true } })
    if (!result) return res.status(404).json({ error: 'Result not found' })
    const detail = await saveMatchDetail(result.id, req.body ?? {})
    res.json({ data: detail, message: 'Detailed result saved and published' })
  } catch (error) {
    res.status(500).json({ error: 'Unable to save detailed result', detail: String(error) })
  }
})

export { router as adminMatchDetailsRouter }
