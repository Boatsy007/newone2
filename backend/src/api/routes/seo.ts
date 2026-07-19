import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { ensureHighlightTables } from '../../highlights/store.js'

const router = Router()
const SITE = 'https://playfooty.com.au'
const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
const url = (path: string, lastmod?: Date | string | null, priority = '0.6', changefreq = 'weekly') => `<url><loc>${esc(SITE + path)}</loc>${lastmod ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ''}<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`

router.get('/sitemap.xml', async (_req, res) => {
  try {
    const [clubs, leagues, players, articles, fixtures, results, highlights] = await Promise.all([
      prisma.club.findMany({ where: { sport: 'FOOTBALL', isActive: true, archivedAt: null, approvalStatus: 'APPROVED' }, select: { id: true, updatedAt: true } }),
      prisma.league.findMany({ where: { sport: 'FOOTBALL', isActive: true, enabled: true, hidden: false, archivedAt: null }, select: { id: true, updatedAt: true } }),
      prisma.footballGoalKicker.findMany({ distinct: ['id'], select: { id: true, updatedAt: true } }),
      prisma.generatedArticle.findMany({ where: { status: 'PUBLISHED' }, select: { slug: true, updatedAt: true } }),
      prisma.footballFixture.findMany({ select: { id: true, updatedAt: true } }),
      prisma.footballResult.findMany({ where: { published: true }, select: { id: true, updatedAt: true } }),
      ensureHighlightTables().then(() => prisma.$queryRawUnsafe<Array<{ id: string; updatedAt: Date }>>(`SELECT id, updated_at AS "updatedAt" FROM highlight_submissions WHERE status = 'APPROVED'`)).catch(() => []),
    ])

    const staticUrls = [
      url('/', null, '1.0', 'daily'), url('/rankings', null, '0.9', 'weekly'), url('/leagues', null, '0.9', 'daily'),
      url('/directory', null, '0.9', 'daily'), url('/matches', null, '0.9', 'daily'), url('/goal-kickers', null, '0.9', 'daily'),
      url('/records', null, '0.8', 'weekly'), url('/news', null, '0.9', 'daily'), url('/highlights', null, '0.8', 'daily'),
      url('/about', null, '0.5', 'monthly'), url('/support', null, '0.5', 'monthly'), url('/privacy', null, '0.4', 'yearly'),
      url('/terms', null, '0.4', 'yearly'), url('/disclaimer', null, '0.4', 'yearly'), url('/community-guidelines', null, '0.4', 'yearly'),
    ]
    const dynamic = [
      ...clubs.map(row => url(`/team/${row.id}`, row.updatedAt, '0.8', 'weekly')),
      ...leagues.map(row => url(`/league/${row.id}`, row.updatedAt, '0.8', 'weekly')),
      ...players.map(row => url(`/player/${row.id}`, row.updatedAt, '0.7', 'weekly')),
      ...articles.map(row => url(`/news/${row.slug}`, row.updatedAt, '0.7', 'monthly')),
      ...fixtures.map(row => url(`/match/fixture/${row.id}?source=football`, row.updatedAt, '0.6', 'weekly')),
      ...results.map(row => url(`/match/result/${row.id}?source=football`, row.updatedAt, '0.6', 'monthly')),
      ...highlights.map(row => url(`/highlights/${row.id}`, row.updatedAt, '0.6', 'monthly')),
    ]
    res.type('application/xml').set('Cache-Control', 'public, max-age=900, stale-while-revalidate=3600').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...staticUrls, ...dynamic].join('')}</urlset>`)
  } catch {
    res.status(500).type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><error>Unable to generate sitemap</error>')
  }
})

export { router as seoRouter }
