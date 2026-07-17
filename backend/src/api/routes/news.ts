/**
 * Public News API — serves PUBLISHED generated articles.
 * GET /api/news         — published articles (newest first)
 * GET /api/news/:slug   — a single published article
 */
import { Router }          from 'express'
import { prisma }          from '../../db/client.js'
import { cachePublic }     from '../middleware/cache-middleware.js'
import { publicRateLimit } from '../middleware/rate-limit.js'

const router = Router()

function shape(a: Awaited<ReturnType<typeof prisma.generatedArticle.findFirst>>) {
  if (!a) return null
  let body: unknown = []
  let tags: unknown = {}
  try { body = JSON.parse(a.body) } catch { /* keep [] */ }
  try { tags = a.tags ? JSON.parse(a.tags) : {} } catch { /* keep {} */ }
  return {
    slug: a.slug, kind: a.kind, category: a.category, title: a.title, subtitle: a.subtitle,
    summary: a.summary, body, heroSeed: a.heroSeed, tags, author: a.author,
    weekLabel: a.weekLabel, date: a.publishedAt ?? a.updatedAt,
    seoTitle: a.seoTitle, seoDescription: a.seoDescription,
  }
}

function isFootballArticle(a: Awaited<ReturnType<typeof prisma.generatedArticle.findFirst>>) {
  if (!a) return false
  const haystack = [a.title, a.subtitle, a.summary, a.body, a.tags, a.author].filter(Boolean).join(' ')
  return !/(netball|go netty|got netty|cnca|country netball|a grade netball)/i.test(haystack)
}

router.get('/', publicRateLimit, cachePublic(300), async (req, res) => {
  try {
    const { category, league } = req.query as Record<string, string>
    const items = (await prisma.generatedArticle.findMany({
      where: { status: 'PUBLISHED', ...(category ? { category } : {}) },
      orderBy: { publishedAt: 'desc' }, take: 60,
    })).filter(isFootballArticle)
    let data = items.map(shape).filter(Boolean)
    if (league) data = data.filter(a => { try { return JSON.parse((items.find(i => i.slug === a!.slug)?.tags) || '{}').league === league } catch { return false } })
    res.json({ data, meta: { total: data.length } })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:slug', publicRateLimit, cachePublic(300), async (req, res) => {
  try {
    const a = await prisma.generatedArticle.findFirst({ where: { slug: req.params.slug, status: 'PUBLISHED' } })
    if (a && !isFootballArticle(a)) return res.status(404).json({ error: 'Article not found' })
    if (!a) return res.status(404).json({ error: 'Article not found' })
    res.json({ data: shape(a) })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export { router as newsRouter }
