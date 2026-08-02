/**
 * Analytics public API (Phase B11) — additive.
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/analytics/event   ingest a single event or a batch (public, rate-
 *                             limited, privacy-conscious — no PII stored)
 * GET  /api/analytics/*       reports + insights (admin-gated via attachActor +
 *                             requireAdminActor; may include commercial data)
 * No existing route modified.
 */

import { Router } from 'express'
import type { Request } from 'express'
import { publicRateLimit } from '../middleware/rate-limit.js'
import { attachActor, requireAdminActor } from '../middleware/permissions.js'
import { recordEvent, recordEvents, type RawEventInput } from '../../analytics/track.js'
import { overview, clubReport, leagueReport, newsReport, searchReport, trendingReport, commercialReport, topReferrers } from '../../analytics/reports.js'
import { clubInsights, leagueInsights } from '../../analytics/insights.js'
import { logger } from '../../utils/logger.js'
import { clubAnalyticsRouter } from './club-analytics.js'

const router = Router()

function ctxOf(req: Request) {
  const xf = req.headers['x-forwarded-for']
  const ip = (typeof xf === 'string' ? xf.split(',')[0].trim() : undefined) ?? req.socket?.remoteAddress ?? undefined
  return { ip, userAgent: req.headers['user-agent'] as string | undefined }
}

// ── Ingest (public, rate-limited) ─────────────────────────────────────────────
router.post('/event', publicRateLimit, async (req, res) => {
  try {
    const body = (req.body ?? {}) as { event?: RawEventInput; events?: RawEventInput[] }
    const ctx = ctxOf(req)
    if (Array.isArray(body.events)) {
      const r = await recordEvents(body.events.slice(0, 50), ctx)
      return res.status(202).json({ data: r })
    }
    if (body.event) {
      const r = await recordEvent(body.event, ctx)
      return res.status(r.ok ? 202 : 400).json(r.ok ? { data: { accepted: 1 } } : { error: r.error })
    }
    const r = await recordEvent(body as RawEventInput, ctx)
    return res.status(r.ok ? 202 : 400).json(r.ok ? { data: { accepted: 1 } } : { error: r.error })
  } catch (err) { logger.error('POST /analytics/event', { detail: String(err) }); res.status(500).json({ error: 'ingest failed' }) }
})

// Club-authorised dashboard report. Kept under the already-mounted analytics API.
router.use('/club-portal', clubAnalyticsRouter)

// ── Reports (admin-gated) ─────────────────────────────────────────────────────
router.use(attachActor)
const win = (req: Request) => (req.query.window as string) || 'ALL'

router.get('/overview', requireAdminActor, async (_req, res) => { res.json({ data: await overview() }) })
router.get('/clubs', requireAdminActor, async (req, res) => { res.json({ data: await clubReport(win(req)) }) })
router.get('/leagues', requireAdminActor, async (req, res) => { res.json({ data: await leagueReport(win(req)) }) })
router.get('/news', requireAdminActor, async (req, res) => { res.json({ data: await newsReport(win(req)) }) })
router.get('/search', requireAdminActor, async (req, res) => { res.json({ data: await searchReport(win(req)) }) })
router.get('/trending', requireAdminActor, async (_req, res) => { res.json({ data: await trendingReport() }) })
router.get('/commercial', requireAdminActor, async (_req, res) => { res.json({ data: await commercialReport() }) })
router.get('/referrers', requireAdminActor, async (_req, res) => { res.json({ data: await topReferrers() }) })
router.get('/clubs/:id', requireAdminActor, async (req, res) => { res.json({ data: await clubInsights(String(req.params.id)) }) })
router.get('/leagues/:id', requireAdminActor, async (req, res) => { res.json({ data: await leagueInsights(String(req.params.id)) }) })

export { router as analyticsRouter }
