/** Public News API — serves validated PUBLISHED generated articles. */
import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { cachePublic } from '../middleware/cache-middleware.js'
import { publicRateLimit } from '../middleware/rate-limit.js'
import { articlePassesFootballValidation } from '../../newsroom/football-validation.js'

const router = Router()
type ArticleRow = Awaited<ReturnType<typeof prisma.generatedArticle.findFirst>>
type LinkRow = { entityType: string; entityId: string | null; label: string | null }

const parse = <T>(value: string | null, fallback: T): T => { try { return value ? JSON.parse(value) as T : fallback } catch { return fallback } }

function shape(a: NonNullable<ArticleRow>, links: LinkRow[] = []) {
  const tags = parse<Record<string, unknown>>(a.tags, {})
  for (const link of links) {
    if (link.entityType === 'CLUB') { if (!tags.clubId && link.entityId) tags.clubId = link.entityId; if (!tags.club && link.label) tags.club = link.label }
    if (link.entityType === 'LEAGUE') { if (!tags.leagueId && link.entityId) tags.leagueId = link.entityId; if (!tags.league && link.label) tags.league = link.label }
    if (link.entityType === 'PLAYER') { if (!tags.playerId && link.entityId) tags.playerId = link.entityId; if (!tags.player && link.label) tags.player = link.label }
    if (link.entityType === 'MATCH' && link.entityId) tags.matchId = link.entityId
  }
  return {
    id: a.id, slug: a.slug, kind: a.kind, category: a.category, title: a.title, subtitle: a.subtitle,
    summary: a.summary, body: parse(a.body, []), heroSeed: a.heroSeed, tags, author: a.author,
    weekLabel: a.weekLabel, date: a.publishedAt ?? a.updatedAt,
    seoTitle: a.seoTitle, seoDescription: a.seoDescription, confidence: a.confidence,
    reasoning: a.reasoning, triggers: parse(a.triggers, []),
    links: links.map(link => ({ entityType: link.entityType, entityId: link.entityId, label: link.label })),
    shareCardType: 'NEWS_ARTICLE',
  }
}

function matchesEntity(links: LinkRow[], type: string, id?: string) {
  if (!id) return true
  return links.some(link => link.entityType === type && link.entityId === id)
}

router.get('/', publicRateLimit, cachePublic(300), async (req, res) => {
  try {
    const { category, league, leagueId, clubId, playerId, matchId, q } = req.query as Record<string, string>
    const items = await prisma.generatedArticle.findMany({ where: { status: 'PUBLISHED', ...(category ? { category } : {}) }, orderBy: { publishedAt: 'desc' }, take: 120 })
    const valid = items.filter(articlePassesFootballValidation)
    const links = valid.length ? await prisma.articleLink.findMany({ where: { articleId: { in: valid.map(item => item.id) } }, orderBy: { createdAt: 'asc' } }) : []
    const byArticle = new Map<string, LinkRow[]>()
    for (const link of links) byArticle.set(link.articleId, [...(byArticle.get(link.articleId) ?? []), link])
    let data = valid.map(item => shape(item, byArticle.get(item.id) ?? []))
    if (league) data = data.filter(article => String(article.tags.league ?? '') === league)
    if (leagueId) data = data.filter(article => matchesEntity(article.links, 'LEAGUE', leagueId) || article.tags.leagueId === leagueId)
    if (clubId) data = data.filter(article => matchesEntity(article.links, 'CLUB', clubId) || article.tags.clubId === clubId)
    if (playerId) data = data.filter(article => matchesEntity(article.links, 'PLAYER', playerId) || article.tags.playerId === playerId)
    if (matchId) data = data.filter(article => matchesEntity(article.links, 'MATCH', matchId) || article.tags.matchId === matchId)
    if (q?.trim()) {
      const needle = q.trim().toLowerCase()
      data = data.filter(article => [article.title, article.subtitle, article.summary, article.author, ...article.links.map(link => link.label)].filter(Boolean).join(' ').toLowerCase().includes(needle))
    }
    res.json({ data, meta: { total: data.length } })
  } catch (error) { res.status(500).json({ error: 'Internal server error', detail: String(error) }) }
})

router.get('/:slug', publicRateLimit, cachePublic(300), async (req, res) => {
  try {
    const article = await prisma.generatedArticle.findFirst({ where: { slug: req.params.slug, status: 'PUBLISHED' } })
    if (!article || !articlePassesFootballValidation(article)) return res.status(404).json({ error: 'Article not found' })
    const links = await prisma.articleLink.findMany({ where: { articleId: article.id }, orderBy: { createdAt: 'asc' } })
    res.json({ data: shape(article, links) })
  } catch (error) { res.status(500).json({ error: 'Internal server error', detail: String(error) }) }
})

export { router as newsRouter }
