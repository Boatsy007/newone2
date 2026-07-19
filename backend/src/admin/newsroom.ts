/** Admin newsroom endpoints — mounted at /admin/newsroom. */
import { Router } from 'express'
import { prisma } from '../db/client.js'
import { requireAdminKey } from '../api/middleware/auth.js'
import { runNewsroom } from '../newsroom/index.js'
import { analyseWeek } from '../newsroom/analysis.js'
import { getEditorialCalendar } from '../newsroom/calendar.js'
import { rebuildSearchIndex } from '../newsroom/search.js'
import { articlePassesFootballValidation, validateFootballDrafts } from '../newsroom/football-validation.js'

const router = Router()
router.use(requireAdminKey)

const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : undefined
const parseJson = <T>(value: string | null, fallback: T): T => { try { return value ? JSON.parse(value) as T : fallback } catch { return fallback } }

router.post('/run', async (req, res) => {
  const b = (req.body ?? {}) as { force?: boolean; dryRun?: boolean; reindex?: boolean }
  try { res.json({ data: await runNewsroom({ force: b.force, dryRun: b.dryRun, reindex: b.reindex }) }) }
  catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'newsroom run failed' }) }
})

router.post('/validate', async (_req, res) => {
  try { res.json({ data: await validateFootballDrafts() }) }
  catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'validation failed' }) }
})

router.get('/articles', async (req, res) => {
  const status = clean(req.query.status, 20)
  const rows = await prisma.generatedArticle.findMany({
    where: status ? { status } : {},
    orderBy: [{ updatedAt: 'desc' }],
    take: 200,
  })
  const links = rows.length ? await prisma.articleLink.findMany({ where: { articleId: { in: rows.map(row => row.id) } }, orderBy: { createdAt: 'asc' } }) : []
  const byArticle = new Map<string, typeof links>()
  for (const link of links) byArticle.set(link.articleId, [...(byArticle.get(link.articleId) ?? []), link])
  res.json({ data: rows.map(row => ({
    id: row.id, slug: row.slug, kind: row.kind, category: row.category, title: row.title, subtitle: row.subtitle, summary: row.summary,
    status: row.status, weekLabel: row.weekLabel, confidence: row.confidence, reasoning: row.reasoning,
    triggers: parseJson(row.triggers, []), sourceData: parseJson(row.sourceData, null), tags: parseJson(row.tags, {}),
    seoTitle: row.seoTitle, seoDescription: row.seoDescription, heroSeed: row.heroSeed,
    createdAt: row.createdAt, updatedAt: row.updatedAt, publishedAt: row.publishedAt,
    validationPassed: articlePassesFootballValidation(row),
    links: (byArticle.get(row.id) ?? []).map(link => ({ id: link.id, entityType: link.entityType, entityId: link.entityId, label: link.label })),
  })) })
})

router.patch('/articles/:id', async (req, res) => {
  const existing = await prisma.generatedArticle.findUnique({ where: { id: String(req.params.id) } })
  if (!existing) return res.status(404).json({ error: 'article not found' })
  const body = (req.body ?? {}) as Record<string, unknown>
  const requestedStatus = clean(body.status, 20)
  if (requestedStatus && !['DRAFT', 'APPROVED', 'PUBLISHED', 'ARCHIVED'].includes(requestedStatus)) return res.status(400).json({ error: 'invalid status' })

  const update = {
    ...(clean(body.title, 220) ? { title: clean(body.title, 220)! } : {}),
    ...(body.subtitle !== undefined ? { subtitle: clean(body.subtitle, 300) ?? null } : {}),
    ...(clean(body.summary, 1000) ? { summary: clean(body.summary, 1000)! } : {}),
    ...(clean(body.category, 60) ? { category: clean(body.category, 60)! } : {}),
    ...(clean(body.heroSeed, 500) ? { heroSeed: clean(body.heroSeed, 500)! } : {}),
    ...(body.seoTitle !== undefined ? { seoTitle: clean(body.seoTitle, 220) ?? null } : {}),
    ...(body.seoDescription !== undefined ? { seoDescription: clean(body.seoDescription, 500) ?? null } : {}),
    ...(body.tags && typeof body.tags === 'object' ? { tags: JSON.stringify(body.tags) } : {}),
    ...(requestedStatus ? { status: requestedStatus, publishedAt: requestedStatus === 'PUBLISHED' ? existing.publishedAt ?? new Date() : requestedStatus === 'ARCHIVED' ? existing.publishedAt : null } : {}),
  }
  const candidate = { ...existing, ...update }
  if ((requestedStatus === 'APPROVED' || requestedStatus === 'PUBLISHED') && !articlePassesFootballValidation(candidate)) {
    return res.status(409).json({ error: 'article failed football/source-data validation and cannot be approved or published' })
  }

  const article = await prisma.$transaction(async tx => {
    const saved = await tx.generatedArticle.update({ where: { id: existing.id }, data: update })
    if (Array.isArray(body.links)) {
      await tx.articleLink.deleteMany({ where: { articleId: existing.id } })
      const links = body.links.flatMap(value => {
        if (!value || typeof value !== 'object') return []
        const item = value as Record<string, unknown>
        const entityType = clean(item.entityType, 30)?.toUpperCase()
        if (!entityType || !['CLUB', 'LEAGUE', 'PLAYER', 'MATCH', 'RANKING', 'RECORD', 'STATE'].includes(entityType)) return []
        return [{ articleId: existing.id, entityType, entityId: clean(item.entityId, 100) ?? null, label: clean(item.label, 200) ?? null }]
      })
      if (links.length) await tx.articleLink.createMany({ data: links })
    }
    if (requestedStatus === 'PUBLISHED') {
      const links = await tx.articleLink.findMany({ where: { articleId: existing.id } })
      const targets = links.filter(link => ['CLUB', 'LEAGUE', 'PLAYER'].includes(link.entityType) && link.entityId)
      for (const target of targets) {
        const dedupeKey = `news:${saved.id}:${target.entityType}:${target.entityId}`
        await tx.notification.upsert({
          where: { dedupeKey },
          create: { recipientScope: 'PLATFORM', type: 'NEWS', category: 'FEED', severity: 'INFO', title: saved.title, body: saved.summary, entityType: target.entityType, entityId: target.entityId!, data: JSON.stringify({ href: `/news/${saved.slug}`, slug: saved.slug, articleId: saved.id, shareCardType: 'NEWS_ARTICLE' }), status: 'DELIVERED', dedupeKey },
          update: { title: saved.title, body: saved.summary, data: JSON.stringify({ href: `/news/${saved.slug}`, slug: saved.slug, articleId: saved.id, shareCardType: 'NEWS_ARTICLE' }), status: 'DELIVERED' },
        })
      }
    }
    return saved
  })
  res.json({ data: article })
})

router.get('/analysis', async (_req, res) => {
  const a = await analyseWeek()
  if (!a) return res.status(404).json({ error: 'no completed ranking run' })
  res.json({ data: a })
})

router.get('/signals', async (req, res) => {
  const week = req.query.week as string | undefined
  const signals = await prisma.newsSignal.findMany({ where: week ? { weekLabel: week } : {}, orderBy: [{ weekLabel: 'desc' }, { priority: 'desc' }], take: 300 })
  res.json({ data: signals })
})

router.get('/trends', async (req, res) => {
  const kind = (req.query.kind as string) ?? 'rising'
  const orderBy = kind === 'falling' ? { rank4wkDelta: 'asc' as const } : kind === 'volatile' ? { volatility: 'desc' as const } : kind === 'consistent' ? { volatility: 'asc' as const } : { rank4wkDelta: 'desc' as const }
  const where = kind === 'rising' ? { isRising: true } : kind === 'falling' ? { isFalling: true } : {}
  res.json({ data: await prisma.clubTrend.findMany({ where, orderBy, take: 50 }), meta: { kind } })
})

router.get('/calendar', async (_req, res) => { res.json({ data: await getEditorialCalendar() }) })
router.post('/reindex', async (_req, res) => { try { res.json({ data: await rebuildSearchIndex() }) } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'reindex failed' }) } })
router.get('/search', async (req, res) => {
  const q = ((req.query.q as string) ?? '').trim()
  if (q.length < 2) return res.json({ data: [] })
  res.json({ data: await prisma.searchDoc.findMany({ where: { OR: [{ title: { contains: q, mode: 'insensitive' } }, { body: { contains: q, mode: 'insensitive' } }] }, orderBy: { weight: 'desc' }, take: 50 }) })
})

export { router as adminNewsroomRouter }
