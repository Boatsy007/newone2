/**
 * Admin data-quality endpoints (Phase B4) — mounted at /admin/quality.
 * ─────────────────────────────────────────────────────────────────────────────
 * Key-protected controls for the integrity engine. Additive; no existing route
 * is modified. Detection is read-only; merges are non-destructive and audited.
 */

import { Router } from 'express'
import { prisma } from '../db/client.js'
import { requireAdminKey } from '../api/middleware/auth.js'
import { runQualityEngine } from '../quality/index.js'
import { detectDuplicates } from '../quality/duplicate-detection.js'
import { generateHealthReport } from '../quality/health-report.js'
import { validateLeagueEligibility, validateAllLeagues } from '../quality/league-eligibility.js'
import { resolveClubIdentity, addClubAlias } from '../quality/identity-resolver.js'
import { mergeClubs, mergeLeagues } from '../quality/merge.js'

const router = Router()
router.use(requireAdminKey)

// Full engine run.
router.post('/run', async (req, res) => {
  const b = (req.body ?? {}) as { raiseReviews?: boolean; storeHealth?: boolean }
  try { res.json({ data: await runQualityEngine({ raiseReviews: b.raiseReviews, storeHealth: b.storeHealth, performedBy: 'ADMIN' }) }) }
  catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'quality run failed' }) }
})

// Health report (read-only; store via ?store=true).
router.get('/health', async (req, res) => {
  try { res.json({ data: await generateHealthReport({ store: req.query.store === 'true', generatedBy: 'ADMIN' }) }) }
  catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'health report failed' }) }
})
router.get('/health/history', async (_req, res) => {
  const snaps = await prisma.dataHealthSnapshot.findMany({ orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, counts: true, createdAt: true } })
  res.json({ data: snaps })
})

// League rollout and coverage. Read-only and derived from canonical football data.
router.get('/coverage', async (_req, res) => {
  try {
    const [leagues, duplicateReport, pendingReviews, pendingConflicts] = await Promise.all([
      prisma.league.findMany({
        where: { sport: 'FOOTBALL', archivedAt: null },
        orderBy: [{ state: { code: 'asc' } }, { name: 'asc' }],
        select: {
          id: true, name: true, shortName: true, enabled: true, hidden: true, approvalStatus: true, status: true,
          syncStatus: true, syncError: true, dataSourceSyncError: true, sourceUrl: true, primaryDataSource: true,
          lastSyncAt: true, lastSuccessfulSyncAt: true, lastManualUpdateAt: true, updatedAt: true, dataConfidence: true,
          state: { select: { code: true } },
          clubSeasons: {
            where: { isActive: true, sport: 'FOOTBALL', club: { isActive: true, archivedAt: null } },
            select: { clubId: true, club: { select: { name: true, logoUrl: true, approvalStatus: true } } },
          },
          footballImports: {
            orderBy: { createdAt: 'desc' }, take: 12,
            select: { id: true, dataType: true, sourceType: true, status: true, recordsFound: true, recordsImported: true, conflictsFound: true, confidence: true, error: true, createdAt: true, publishedAt: true },
          },
          _count: { select: { footballFixtures: true, footballResults: true, footballLadderEntries: true, footballGoalKickers: true } },
        },
      }),
      detectDuplicates({ raiseReviews: false }),
      prisma.reviewItem.findMany({ where: { status: 'PENDING', entityType: 'League', entityId: { not: null } }, select: { entityId: true } }),
      prisma.footballDataConflict.groupBy({ by: ['leagueId'], where: { status: 'PENDING' }, _count: { leagueId: true } }),
    ])

    const duplicateLeagueIds = new Set([
      ...duplicateReport.duplicateLeagues.flatMap(item => item.ids),
      ...duplicateReport.duplicateLeagueSources.flatMap(item => item.ids),
    ])
    const reviewCounts = new Map<string, number>()
    for (const review of pendingReviews) if (review.entityId) reviewCounts.set(review.entityId, (reviewCounts.get(review.entityId) ?? 0) + 1)
    const conflictCounts = new Map(pendingConflicts.map(row => [row.leagueId, row._count.leagueId]))
    const staleCutoff = Date.now() - 21 * 24 * 60 * 60 * 1000

    const items = leagues.map(league => {
      const uniqueClubs = [...new Map(league.clubSeasons.map(row => [row.clubId, row.club])).values()]
      const missingLogos = uniqueClubs.filter(club => !club.logoUrl).length
      const pendingClubs = uniqueClubs.filter(club => club.approvalStatus !== 'APPROVED').length
      const latestImport = league.footballImports[0] ?? null
      const successfulImport = league.footballImports.find(item => ['COMMITTED', 'PUBLISHED'].includes(item.status)) ?? null
      const failedImports = league.footballImports.filter(item => item.status === 'FAILED').length
      const pendingReviewCount = reviewCounts.get(league.id) ?? 0
      const conflictCount = conflictCounts.get(league.id) ?? 0
      const duplicateRisk = duplicateLeagueIds.has(league.id)
      const lastUpdated = league.lastSuccessfulSyncAt ?? league.lastManualUpdateAt ?? successfulImport?.publishedAt ?? successfulImport?.createdAt ?? league.updatedAt
      const stale = lastUpdated.getTime() < staleCutoff
      const sourceConfigured = Boolean(league.primaryDataSource || league.sourceUrl)
      const publicVisible = league.enabled && !league.hidden && league.approvalStatus === 'APPROVED'
      const checks = {
        sourceConfigured,
        clubs: uniqueClubs.length >= 2,
        clubLogos: uniqueClubs.length > 0 && missingLogos === 0,
        ladder: league._count.footballLadderEntries > 0,
        fixtures: league._count.footballFixtures > 0,
        results: league._count.footballResults > 0,
        goalKickers: league._count.footballGoalKickers > 0,
        clean: !league.syncError && !league.dataSourceSyncError && failedImports === 0 && pendingReviewCount === 0 && conflictCount === 0 && !duplicateRisk,
        publicVisible,
        current: !stale,
      }
      const passed = Object.values(checks).filter(Boolean).length
      const completion = Math.round((passed / Object.keys(checks).length) * 100)
      let readiness: 'NOT_STARTED' | 'IMPORTING' | 'NEEDS_REVIEW' | 'PUBLIC_INCOMPLETE' | 'LAUNCH_READY' = 'NOT_STARTED'
      if (league.syncStatus === 'RUNNING' || latestImport?.status === 'PENDING') readiness = 'IMPORTING'
      else if (pendingReviewCount || conflictCount || duplicateRisk || league.syncStatus === 'NEEDS_REVIEW' || league.status === 'NEEDS_REVIEW') readiness = 'NEEDS_REVIEW'
      else if (completion === 100) readiness = 'LAUNCH_READY'
      else if (publicVisible || uniqueClubs.length || league._count.footballLadderEntries || league._count.footballResults) readiness = 'PUBLIC_INCOMPLETE'

      const missing: string[] = []
      if (!checks.sourceConfigured) missing.push('data source')
      if (!checks.clubs) missing.push('clubs')
      if (!checks.clubLogos) missing.push(`${missingLogos} club logo${missingLogos === 1 ? '' : 's'}`)
      if (!checks.ladder) missing.push('ladder')
      if (!checks.fixtures) missing.push('fixtures')
      if (!checks.results) missing.push('results')
      if (!checks.goalKickers) missing.push('goal kickers')
      if (!checks.publicVisible) missing.push('public approval')
      if (!checks.current) missing.push('current update')

      return {
        id: league.id, name: league.name, shortName: league.shortName, state: league.state.code,
        readiness, completion, checks, missing, stale, lastUpdated: lastUpdated.toISOString(),
        counts: { clubs: uniqueClubs.length, missingLogos, pendingClubs, ladder: league._count.footballLadderEntries, fixtures: league._count.footballFixtures, results: league._count.footballResults, goalKickers: league._count.footballGoalKickers, reviews: pendingReviewCount, conflicts: conflictCount, failedImports },
        sync: { status: league.syncStatus, error: league.dataSourceSyncError ?? league.syncError, confidence: league.dataConfidence },
        duplicateRisk,
        latestImport,
        importHistory: league.footballImports,
        actions: { league: `/league/${league.id}`, admin: `/admin?leagueId=${league.id}`, import: `/admin/universal-imports?leagueId=${league.id}`, reviews: '/admin' },
      }
    })

    const summary = {
      leagues: items.length,
      launchReady: items.filter(item => item.readiness === 'LAUNCH_READY').length,
      needsReview: items.filter(item => item.readiness === 'NEEDS_REVIEW').length,
      importing: items.filter(item => item.readiness === 'IMPORTING').length,
      publicIncomplete: items.filter(item => item.readiness === 'PUBLIC_INCOMPLETE').length,
      notStarted: items.filter(item => item.readiness === 'NOT_STARTED').length,
      averageCompletion: items.length ? Math.round(items.reduce((sum, item) => sum + item.completion, 0) / items.length) : 0,
      stale: items.filter(item => item.stale).length,
    }
    res.json({ data: { generatedAt: new Date().toISOString(), summary, items } })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'coverage report failed' })
  }
})

// Duplicate detection (read-only unless ?raise=true).
router.get('/duplicates', async (req, res) => {
  try { res.json({ data: await detectDuplicates({ raiseReviews: req.query.raise === 'true' }) }) }
  catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'duplicate detection failed' }) }
})

// League eligibility.
router.post('/eligibility/run', async (_req, res) => {
  try { res.json({ data: await validateAllLeagues({ raiseReview: true }) }) }
  catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'eligibility run failed' }) }
})
router.post('/eligibility/:leagueId', async (req, res) => {
  const r = await validateLeagueEligibility(req.params.leagueId, { raiseReview: true })
  if (!r) return res.status(404).json({ error: 'league not found' })
  res.json({ data: r })
})
router.get('/eligibility', async (req, res) => {
  const verdict = req.query.verdict as string | undefined
  const items = await prisma.leagueEligibility.findMany({ where: verdict ? { verdict } : {}, orderBy: { checkedAt: 'desc' }, take: 500 })
  res.json({ data: items })
})

// Identity resolver.
router.get('/identity/resolve', async (req, res) => {
  const name = (req.query.name as string) ?? ''
  if (!name.trim()) return res.status(400).json({ error: 'name required' })
  res.json({ data: await resolveClubIdentity(name) })
})
router.post('/aliases', async (req, res) => {
  const { alias, clubId, source, confidence } = (req.body ?? {}) as { alias?: string; clubId?: string; source?: string; confidence?: number }
  if (!alias || !clubId) return res.status(400).json({ error: 'alias and clubId required' })
  const r = await addClubAlias(alias, clubId, source, confidence)
  res.status(r.ok ? 201 : 400).json(r.ok ? { data: { alias, clubId } } : { error: r.error })
})
router.get('/aliases', async (_req, res) => {
  res.json({ data: await prisma.clubAlias.findMany({ orderBy: { createdAt: 'desc' }, take: 500 }) })
})

// Safe merges (non-destructive, audited).
router.post('/clubs/merge', async (req, res) => {
  const { sourceId, targetId, reason, force } = (req.body ?? {}) as { sourceId?: string; targetId?: string; reason?: string; force?: boolean }
  if (!sourceId || !targetId) return res.status(400).json({ error: 'sourceId and targetId required' })
  const r = await mergeClubs(sourceId, targetId, { reason, force, performedBy: 'admin' })
  res.status(r.status).json(r.ok ? { data: { mergeRecordId: r.mergeRecordId, movedCounts: r.movedCounts } } : { error: r.error })
})
router.post('/leagues/merge', async (req, res) => {
  const { sourceId, targetId, reason, force } = (req.body ?? {}) as { sourceId?: string; targetId?: string; reason?: string; force?: boolean }
  if (!sourceId || !targetId) return res.status(400).json({ error: 'sourceId and targetId required' })
  const r = await mergeLeagues(sourceId, targetId, { reason, force, performedBy: 'admin' })
  res.status(r.status).json(r.ok ? { data: { mergeRecordId: r.mergeRecordId, movedCounts: r.movedCounts } } : { error: r.error })
})
router.get('/merges', async (_req, res) => {
  res.json({ data: await prisma.mergeRecord.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }) })
})

export { router as adminQualityRouter }
