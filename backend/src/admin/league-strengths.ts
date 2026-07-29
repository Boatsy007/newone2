import { Router } from 'express'
import { prisma } from '../db/client.js'
import { requireAdminKey } from '../api/middleware/auth.js'
import { recalculateNational } from '../jobs/recompute-strength.js'

const router = Router()
router.use(requireAdminKey)

type StrengthUpdate = { leagueId?: unknown; strength?: unknown }

router.get('/', async (_req, res) => {
  try {
    const rows = await prisma.league.findMany({
      where: { sport: 'FOOTBALL', archivedAt: null, isActive: true },
      orderBy: [{ state: { code: 'asc' } }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        shortName: true,
        state: { select: { code: true } },
        manualStrengthOverride: true,
        finalStrengthRating: true,
        automaticStrengthRating: true,
        strengthScore: true,
        strengthTier: true,
        strengthConfidence: true,
        needsStrengthReview: true,
      },
    })
    res.json({
      data: rows.map(row => ({
        id: row.id,
        name: row.name,
        shortName: row.shortName,
        state: row.state.code,
        strength: row.manualStrengthOverride ?? row.finalStrengthRating ?? row.automaticStrengthRating ?? 3,
        automaticStrength: row.automaticStrengthRating,
        strengthScore: row.strengthScore,
        strengthTier: row.strengthTier,
        strengthConfidence: row.strengthConfidence,
        needsStrengthReview: row.needsStrengthReview,
      })),
    })
  } catch (error) {
    res.status(500).json({ error: 'Unable to load league strengths', detail: String(error) })
  }
})

router.post('/publish', async (req, res) => {
  try {
    const updates = Array.isArray(req.body?.updates) ? req.body.updates as StrengthUpdate[] : []
    if (!updates.length) return res.status(400).json({ error: 'No league strengths supplied' })

    const clean = updates.map(item => ({
      leagueId: String(item.leagueId ?? '').trim(),
      strength: Number(item.strength),
    }))
    if (clean.some(item => !item.leagueId || !Number.isFinite(item.strength) || item.strength < 1 || item.strength > 5)) {
      return res.status(400).json({ error: 'Every strength must be a number from 1 to 5' })
    }
    if (new Set(clean.map(item => item.leagueId)).size !== clean.length) {
      return res.status(400).json({ error: 'A league was supplied more than once' })
    }

    const valid = await prisma.league.findMany({
      where: { id: { in: clean.map(item => item.leagueId) }, sport: 'FOOTBALL', archivedAt: null, isActive: true },
      select: { id: true },
    })
    if (valid.length !== clean.length) return res.status(400).json({ error: 'One or more leagues are unavailable' })

    const now = new Date()
    await prisma.$transaction(clean.map(item => {
      const rating = Math.round(item.strength * 10) / 10
      return prisma.league.update({
        where: { id: item.leagueId },
        data: {
          manualStrengthOverride: rating,
          finalStrengthRating: rating,
          strengthScore: rating * 20,
          strengthTier: Math.max(1, Math.min(5, Math.round(rating))),
          strengthConfidence: 1,
          strengthReasoning: 'Manual bulk strength override set by PlayFooty admin',
          strengthCalculatedAt: now,
          needsStrengthReview: false,
          lastManualUpdateAt: now,
          manualOverride: true,
        },
      })
    }))

    const locked = (await prisma.setting.findUnique({ where: { key: 'rankingsLocked' } }).catch(() => null))?.value === 'true'
    if (locked) {
      return res.json({ data: { updated: clean.length, recalculated: false, rankingsLocked: true }, message: `${clean.length} league strengths saved. Rankings are currently locked, so recalculation was not run.` })
    }

    const report = await recalculateNational()
    res.json({
      data: { updated: clean.length, recalculated: true, clubsRanked: report.clubsRanked, leaguesProcessed: report.leagues.length },
      message: `${clean.length} league strengths saved and national rankings recalculated.`,
    })
  } catch (error) {
    res.status(500).json({ error: 'Unable to publish league strengths', detail: String(error) })
  }
})

export { router as adminLeagueStrengthsRouter }
