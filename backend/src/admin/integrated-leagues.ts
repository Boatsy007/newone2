import { Router } from 'express'
import { prisma } from '../db/client.js'
import { requireAdminKey } from '../api/middleware/auth.js'
import { recalculateNational } from '../jobs/recompute-strength.js'
import { logger } from '../utils/logger.js'

const router = Router()
router.use(requireAdminKey)

const nullable = (body: Record<string, unknown>, key: string) => {
  if (!(key in body)) return undefined
  const value = body[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

async function writeAudit(action: string, leagueId: string, before: unknown, after: unknown) {
  try {
    const user = await prisma.adminUser.upsert({
      where: { email: 'admin@cnca.local' },
      update: {},
      create: { email: 'admin@cnca.local', name: 'Admin', role: 'SUPERADMIN' },
    })
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action,
        entityType: 'League',
        entityId: leagueId,
        before: JSON.stringify(before),
        after: JSON.stringify(after),
        source: 'ADMIN',
      },
    })
  } catch (error) {
    logger.warn('league integration audit failed', { detail: String(error) })
  }
}

const detailSelect = {
  id: true, name: true, shortName: true, description: true, regionName: true,
  websiteUrl: true, facebookUrl: true, logoUrl: true, featuredLeague: true,
  stateId: true, state: { select: { id: true, code: true, name: true } },
  association: { select: { id: true, name: true, shortName: true, logoUrl: true } },
  isActive: true, enabled: true, hidden: true, archivedAt: true, approvalStatus: true,
  sport: true, currentSeason: true, primarySource: true, primaryDataSource: true,
  sourceUrl: true, status: true, syncStatus: true, lastSyncedAt: true,
  lastSuccessfulSyncAt: true, dataSourceSyncError: true,
  strengthScore: true, strengthTier: true, automaticStrengthRating: true,
  manualStrengthOverride: true, finalStrengthRating: true,
  strengthConfidence: true, strengthReasoning: true, strengthCalculatedAt: true,
  needsStrengthReview: true, updatedAt: true,
  _count: { select: { clubSeasons: true, footballFixtures: true, footballResults: true, footballLadderEntries: true } },
} as const

router.get('/leagues/:id', async (req, res, next) => {
  try {
    const league = await prisma.league.findUnique({ where: { id: req.params.id }, select: detailSelect })
    if (!league) return res.status(404).json({ error: 'league not found' })
    return res.json({ data: { ...league, profileFieldsAvailable: true } })
  } catch (error) {
    logger.error('integrated league read failed', { detail: String(error) })
    return next(error)
  }
})

router.patch('/leagues/:id', async (req, res, next) => {
  try {
    const before = await prisma.league.findUnique({ where: { id: req.params.id }, select: detailSelect })
    if (!before) return res.status(404).json({ error: 'league not found' })

    const body = req.body as Record<string, unknown>
    const data: Record<string, unknown> = { lastManualUpdateAt: new Date(), manualOverride: true }

    for (const key of ['name', 'shortName', 'description', 'regionName', 'websiteUrl', 'facebookUrl', 'currentSeason', 'status', 'approvalStatus'] as const) {
      const value = nullable(body, key)
      if (value !== undefined) data[key] = value
    }
    for (const key of ['isActive', 'enabled', 'hidden', 'featuredLeague'] as const) {
      if (typeof body[key] === 'boolean') data[key] = body[key]
    }

    if (typeof body.state === 'string' && body.state.trim()) {
      const code = body.state.trim().toUpperCase()
      const state = await prisma.state.upsert({ where: { code }, update: {}, create: { code, name: code } })
      data.stateId = state.id
    } else if (typeof body.stateId === 'string' && body.stateId) {
      data.stateId = body.stateId
    }

    let strengthChanged = false
    if ('manualStrengthOverride' in body) {
      const raw = body.manualStrengthOverride
      const override = raw === '' || raw === null ? null : Number(raw)
      if (override !== null && (!Number.isFinite(override) || override < 0 || override > 5)) {
        return res.status(400).json({ error: 'Strength override must be between 0 and 5.' })
      }
      const finalRating = override ?? before.automaticStrengthRating
      data.manualStrengthOverride = override
      data.finalStrengthRating = finalRating
      data.strengthScore = finalRating * 20
      data.strengthTier = Math.max(1, Math.min(5, Math.round(finalRating)))
      data.needsStrengthReview = false
      data.strengthCalculatedAt = new Date()
      data.strengthReasoning = override == null ? before.strengthReasoning : 'Manual league-strength override set in PlayFooty Control Centre.'
      strengthChanged = override !== before.manualStrengthOverride
    }

    const updated = await prisma.league.update({ where: { id: before.id }, data, select: detailSelect })
    await writeAudit('UPDATE_LEAGUE_INTEGRATED', before.id, before, updated)

    let recalculation: { clubsRanked?: number } | null = null
    if (strengthChanged) {
      try {
        const report = await recalculateNational()
        recalculation = { clubsRanked: report.clubsRanked }
      } catch (error) {
        logger.warn('league strength saved but ranking recalculation failed', { detail: String(error), leagueId: before.id })
      }
    }

    return res.json({ data: { ...updated, profileFieldsAvailable: true }, meta: { strengthChanged, recalculation } })
  } catch (error) {
    logger.error('integrated league update failed', { detail: String(error) })
    return next(error)
  }
})

export { router as integratedLeaguesRouter }
