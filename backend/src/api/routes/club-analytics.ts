import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, requireActiveClubMembership } from '../../auth/club-auth.js'
import { publicRateLimit } from '../middleware/rate-limit.js'

const router = Router()
const DAY = 86400000

router.use(publicRateLimit)
router.use(authenticateClubUser)
router.use('/clubs/:clubId', requireActiveClubMembership)

router.get('/clubs/:clubId', async (req, res) => {
  try {
    const clubId = req.params.clubId
    const now = Date.now()
    const start30 = new Date(now - 30 * DAY)
    const start7 = new Date(now - 7 * DAY)
    const previous30Start = new Date(now - 60 * DAY)

    const [club, views30, views7, previous30, unique30, sponsorImpressions, sponsorClicks, deviceRows, rawViews] = await Promise.all([
      prisma.club.findUnique({ where: { id: clubId }, select: { id: true, name: true } }),
      prisma.analyticsEvent.count({ where: { eventType: 'CLUB_VIEW', entityId: clubId, createdAt: { gte: start30 } } }),
      prisma.analyticsEvent.count({ where: { eventType: 'CLUB_VIEW', entityId: clubId, createdAt: { gte: start7 } } }),
      prisma.analyticsEvent.count({ where: { eventType: 'CLUB_VIEW', entityId: clubId, createdAt: { gte: previous30Start, lt: start30 } } }),
      prisma.analyticsEvent.groupBy({ by: ['visitorId'], where: { eventType: 'CLUB_VIEW', entityId: clubId, visitorId: { not: null }, createdAt: { gte: start30 } } }),
      prisma.analyticsEvent.count({ where: { eventType: 'SPONSOR_IMPRESSION', createdAt: { gte: start30 }, meta: { contains: clubId } } }).catch(() => 0),
      prisma.analyticsEvent.count({ where: { eventType: 'SPONSOR_CLICK', createdAt: { gte: start30 }, meta: { contains: clubId } } }).catch(() => 0),
      prisma.analyticsEvent.groupBy({ by: ['deviceType'], _count: { _all: true }, where: { eventType: 'CLUB_VIEW', entityId: clubId, createdAt: { gte: start30 } } }),
      prisma.analyticsEvent.findMany({ where: { eventType: 'CLUB_VIEW', entityId: clubId, createdAt: { gte: start30 } }, select: { createdAt: true }, orderBy: { createdAt: 'asc' } }),
    ])

    if (!club) return res.status(404).json({ error: 'Club not found' })
    const growthPct = previous30 > 0 ? Number((((views30 - previous30) / previous30) * 100).toFixed(1)) : views30 > 0 ? 100 : 0
    const ctr = sponsorImpressions > 0 ? Number(((sponsorClicks / sponsorImpressions) * 100).toFixed(2)) : 0
    const daily = new Map<string, number>()
    for (const row of rawViews) {
      const key = row.createdAt.toISOString().slice(0, 10)
      daily.set(key, (daily.get(key) ?? 0) + 1)
    }

    res.set('Cache-Control', 'no-store')
    res.json({ data: {
      club,
      period: '30 days',
      profileViews: views30,
      viewsLast7Days: views7,
      uniqueVisitors: unique30.length,
      growthPct,
      sponsorImpressions,
      sponsorClicks,
      sponsorClickThroughRate: ctr,
      devices: deviceRows.map(row => ({ device: row.deviceType || 'UNKNOWN', views: row._count._all })),
      dailyViews: [...daily.entries()].map(([date, views]) => ({ date, views })),
    } })
  } catch (error) {
    res.status(500).json({ error: 'Unable to load club analytics', detail: error instanceof Error ? error.message : String(error) })
  }
})

export { router as clubAnalyticsRouter }
