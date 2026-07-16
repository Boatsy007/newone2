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

const FEATURE_ARTICLE = {
  slug: 'woodside-stun-cowwarr-premiership-race-open',
  kind: 'MATCH_REPORT',
  category: 'rankings',
  title: 'Wildcats stun Saints as premiership race blows wide open',
  subtitle: 'Cowwarr lose top spot and fall to third as Woodside climb from ninth to seventh in the PlayFooty rankings.',
  summary: 'Woodside ended Cowwarr’s unbeaten run with a 28-point win, sending the Saints from first to third nationally while the Wildcats rose from ninth to seventh.',
  heroSeed: '/news/woodside-cowwarr.jpg',
  tags: {
    state: 'VIC',
    league: 'North Gippsland Football Netball League',
    club: 'Cowwarr Seniors | Woodside Seniors',
  },
  author: 'PlayFooty',
  weekLabel: '2026-W29',
  date: '2026-07-16',
  seoTitle: 'Woodside beat Cowwarr as North Gippsland race opens up | PlayFooty',
  seoDescription: 'Woodside defeated Cowwarr by 28 points, ending the Saints’ unbeaten run and reshaping the national rankings.',
  body: [
    { type: 'p', text: 'The North Gippsland Football Netball League premiership race has taken a dramatic turn after Woodside handed previously unbeaten Cowwarr its first loss of the 2026 season, throwing the competition wide open with five rounds remaining.' },
    { type: 'p', text: 'Woodside produced one of the performances of the season, defeating the Saints 17.8 (110) to 11.16 (82) at Woodside Recreation Reserve. The result ended Cowwarr’s unbeaten run and reshaped the PlayFooty Power Rankings.' },
    { type: 'h', text: 'Rankings shaken up' },
    { type: 'p', text: 'Cowwarr had held the number one national ranking, but the defeat has dropped the Saints to third. Woodside’s statement victory lifted the Wildcats from ninth to seventh.' },
    { type: 'p', text: 'The contest lived up to expectations early, with both sides bringing finals-like intensity. Woodside set the tone through playing coach Hudson Holmes, whose dominant eight-goal performance proved impossible to contain.' },
    { type: 'p', text: 'Cowwarr fought back after an early deficit and briefly regained control during the third term, but Woodside’s pressure and ability to win crucial centre clearances eventually broke the game open.' },
    { type: 'h', text: 'Holmes leads from the front' },
    { type: 'p', text: 'Holmes was the focal point in the victory, finishing with eight goals. Brody Stainer added four majors, while Adam Janssen, Riley Denovan, Rowan Missen and Ben Johnson were also influential.' },
    { type: 'p', text: 'Tristen Waack was among Cowwarr’s best, alongside Ben Coffey, Mitch McMaster, Jack Johnstone, Tim Johnston and Patrick Tainsh.' },
    { type: 'h', text: 'Still plenty of season left' },
    { type: 'p', text: 'Cowwarr remain firmly in the premiership conversation, but the loss proves the Saints can be beaten. For Woodside, the win could be season-defining after the Wildcats responded strongly to a heavy defeat the previous week.' },
    { type: 'p', text: 'With five rounds remaining and six teams still believing they can play finals, every result now carries enormous weight. There are only five spots available, and the North Gippsland race is far from settled.' },
  ],
}

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
    let data = [FEATURE_ARTICLE, ...items.map(shape).filter(Boolean).filter(a => a?.slug !== FEATURE_ARTICLE.slug)]
    if (category) data = data.filter(a => a?.category === category)
    if (league) data = data.filter(a => (a?.tags as Record<string, string> | undefined)?.league === league)
    res.json({ data, meta: { total: data.length } })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:slug', publicRateLimit, cachePublic(300), async (req, res) => {
  try {
    if (req.params.slug === FEATURE_ARTICLE.slug) return res.json({ data: FEATURE_ARTICLE })
    const a = await prisma.generatedArticle.findFirst({ where: { slug: req.params.slug, status: 'PUBLISHED' } })
    if (a && !isFootballArticle(a)) return res.status(404).json({ error: 'Article not found' })
    if (!a) return res.status(404).json({ error: 'Article not found' })
    res.json({ data: shape(a) })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export { router as newsRouter }
