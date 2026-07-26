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
const NEWS_BUCKET = process.env.SUPABASE_NEWS_BUCKET || process.env.SUPABASE_LOGO_BUCKET || 'playfooty-logos'
const MAX_NEWS_IMAGE_BYTES = 8 * 1024 * 1024
const NEWS_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
const NEWS_IMAGE_EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp' }

function safeFileName(value: unknown, fallback: string) {
  const raw = typeof value === 'string' ? value : fallback
  return raw.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || fallback
}

function decodeNewsImage(body: Record<string, unknown>) {
  const contentType = typeof body.contentType === 'string' ? body.contentType : 'image/jpeg'
  if (!NEWS_IMAGE_TYPES.has(contentType)) throw new Error('Unsupported image type. Use PNG, JPG or WEBP.')
  const raw = typeof body.dataUrl === 'string' ? body.dataUrl : typeof body.base64 === 'string' ? body.base64 : ''
  if (!raw) throw new Error('Image file data required')
  const base64 = raw.includes(',') ? raw.split(',').pop()! : raw
  const buffer = Buffer.from(base64, 'base64')
  if (!buffer.length) throw new Error('Image file is empty')
  if (buffer.length > MAX_NEWS_IMAGE_BYTES) throw new Error('News images must be 8 MB or smaller')
  const fallback = `hero.${NEWS_IMAGE_EXT[contentType] ?? 'jpg'}`
  return { buffer, contentType, fileName: safeFileName(body.fileName, fallback) }
}

async function uploadNewsImage(articleId: string, body: Record<string, unknown>) {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) throw new Error('Supabase Storage is not configured.')
  const { buffer, contentType, fileName } = decodeNewsImage(body)
  const path = `news-images/${articleId}/${Date.now()}-${fileName}`
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${NEWS_BUCKET}/${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'content-type': contentType, 'x-upsert': 'true' },
    body: buffer,
  })
  if (!response.ok) throw new Error(`News image upload failed: HTTP ${response.status} ${await response.text().catch(() => '')}`.trim())
  return { path, publicUrl: `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${NEWS_BUCKET}/${path}` }
}

async function removeStoredNewsImage(imageUrl: string | null | undefined) {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey || !imageUrl) return
  const marker = `/storage/v1/object/public/${NEWS_BUCKET}/`
  const index = imageUrl.indexOf(marker)
  if (index === -1) return
  const path = imageUrl.slice(index + marker.length)
  await fetch(`${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${NEWS_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'DELETE', headers: { authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
  }).catch(() => {})
}

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

router.post('/articles/:id/image', async (req, res) => {
  const article = await prisma.generatedArticle.findUnique({ where: { id: String(req.params.id) } })
  if (!article) return res.status(404).json({ error: 'article not found' })
  try {
    const uploaded = await uploadNewsImage(article.id, (req.body ?? {}) as Record<string, unknown>)
    await removeStoredNewsImage(article.heroSeed)
    const updated = await prisma.generatedArticle.update({ where: { id: article.id }, data: { heroSeed: uploaded.publicUrl } })
    res.json({ data: updated, image: uploaded })
  } catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : 'news image upload failed' }) }
})

router.delete('/articles/:id/image', async (req, res) => {
  const article = await prisma.generatedArticle.findUnique({ where: { id: String(req.params.id) } })
  if (!article) return res.status(404).json({ error: 'article not found' })
  await removeStoredNewsImage(article.heroSeed)
  const updated = await prisma.generatedArticle.update({ where: { id: article.id }, data: { heroSeed: article.slug } })
  res.json({ data: updated })
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
    ...(clean(body.heroSeed, 1000) ? { heroSeed: clean(body.heroSeed, 1000)! } : {}),
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
