/**
 * CNCA Rankings API Server
 */
import express from 'express'
import cors from 'cors'
import { rankingsRouter } from './api/routes/rankings.js'
import { clubsRouter } from './api/routes/clubs.js'
import { leaguesRouter } from './api/routes/leagues.js'
import { directoryRouter } from './api/routes/directory.js'
import { goalKickerLeaderboardRouter } from './api/routes/goal-kicker-leaderboard.js'
import { goalKickerAchievementsRouter } from './api/routes/goal-kicker-achievements.js'
import { goalKickerAlertControlsRouter } from './api/routes/goal-kicker-alert-controls.js'
import { goalKickerRecordsSafeRouter } from './api/routes/goal-kicker-records-safe.js'
import { goalKickerContextRouter } from './api/routes/goal-kicker-context.js'
import { goalKickersRouter } from './api/routes/goal-kickers.js'
import { playerProfileDetailsRouter } from './api/routes/player-profile-details.js'
import { mvpRouter } from './api/routes/mvp.js'
import { teamSheetsRouter, adminTeamSheetsRouter } from './api/routes/team-sheets.js'
import { playerAvailabilityRouter } from './api/routes/player-availability.js'
import { matchDetailsRouter } from './api/routes/match-details.js'
import { featuredGamesRouter, adminFeaturedGamesRouter } from './api/routes/featured-games.js'
import { newsRouter } from './api/routes/news.js'
import { highlightsRouter } from './api/routes/highlights.js'
import { searchRouter } from './api/routes/search.js'
import { seoRouter } from './api/routes/seo.js'
import { clubPortalAccessRouter } from './api/routes/club-portal-access.js'
import { leaguePortalRouter } from './api/routes/league-portal.js'
import { leaguePortalContactsRouter } from './api/routes/league-portal-contacts.js'
import { portalAuthRouter } from './api/routes/portal-auth.js'
import { followsRouter } from './api/routes/follows.js'
import { shareCardsRouter } from './api/routes/share-cards.js'
import { shareLinksRouter } from './api/routes/share-links.js'
import { clubCoversRouter, clubPortalCoversRouter, adminClubCoversRouter } from './api/routes/club-covers.js'
import { adminDashboardRouter } from './admin/dashboard.js'
import { adminSettingsRouter } from './admin/settings.js'
import { adminManageRouter } from './admin/manage.js'
import { adminPlayersRouter } from './admin/players.js'
import { adminOcrRouter } from './admin/ocr.js'
import { adminMatchImageImportsRouter } from './admin/match-image-imports.js'
import { adminMatchDetailsRouter } from './admin/match-details.js'
import { adminGoalKickerImagesRouter } from './admin/goal-kicker-images.js'
import { adminMvpImagesRouter } from './admin/mvp-images.js'
import { adminGoalKickerUrlImportsRouter } from './admin/goal-kicker-url-imports.js'
import { adminProfileImageImportsRouter } from './admin/profile-image-imports.js'
import { adminUniversalImportsRouter } from './admin/universal-imports.js'
import { integratedLeaguesRouter } from './admin/integrated-leagues.js'
import { adminPlatformRouter } from './admin/platform.js'
import { adminClaimingRouter } from './admin/claiming.js'
import { adminNewsroomRouter } from './admin/newsroom.js'
import { adminQualityRouter } from './admin/quality.js'
import { adminResultsRouter } from './admin/results.js'
import { adminHistoryRouter } from './admin/history.js'
import { adminChampionshipsRouter } from './admin/championships.js'
import { adminCommercialRouter } from './admin/commercial.js'
import { adminNotificationsRouter } from './admin/notifications.js'
import { adminAnalyticsRouter } from './admin/analytics.js'
import { adminLadderRouter } from './admin/ladder.js'
import { adminSeasonRouter } from './admin/season.js'
import { adminPlayhqRouter } from './admin/playhq.js'
import { adminHighlightsRouter } from './admin/highlights.js'
import { adminLeagueStrengthsRouter } from './admin/league-strengths.js'
import { resultsRouter, fixturesRouter, clubMatchRouter, leagueMatchRouter } from './api/routes/results.js'
import { historyRouter } from './api/routes/history.js'
import { championshipsRouter } from './api/routes/championships.js'
import { sponsorsRouter, commercialRouter, commercialClubRouter, commercialLeagueRouter, commercialPlayerRouter } from './api/routes/sponsors.js'
import { notificationsRouter } from './api/routes/notifications.js'
import { analyticsRouter } from './api/routes/analytics.js'
import { claimsRouter } from './api/routes/claims.js'
import { portalRouter } from './api/routes/portal.js'
import { getFootballRecords, type RecordPeriod } from './results/records.service.js'
import { logger } from './utils/logger.js'

const app = express()
const PORT = parseInt(process.env.PORT ?? '3001', 10)
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*', methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }))
app.use('/admin/ocr', express.json({ limit: '20mb' }))
app.use('/admin/match-images', express.json({ limit: '20mb' }))
app.use('/admin/match-details', express.json({ limit: '20mb' }))
app.use('/admin/goal-kicker-images', express.json({ limit: '20mb' }))
app.use('/admin/mvp-images', express.json({ limit: '20mb' }))
app.use('/admin/profile-images', express.json({ limit: '20mb' }))
app.use('/admin/club-covers', express.json({ limit: '12mb' }))
app.use('/api/club-portal/club-covers', express.json({ limit: '12mb' }))
app.use('/admin/universal-imports', express.json({ limit: '20mb' }))
app.use('/admin/platform/csv', express.json({ limit: '20mb' }))
app.use('/admin/platform/leagues', express.json({ limit: '8mb' }))
app.use('/admin/platform/clubs', express.json({ limit: '8mb' }))
app.use('/admin/newsroom', express.json({ limit: '12mb' }))
app.use('/admin/season', express.json({ limit: '25mb' }))
app.use('/admin/players', express.json({ limit: '10mb' }))
app.use(express.json({ limit: '1mb' }))

app.get('/api/records', async (req, res) => {
  try {
    const query = req.query as Record<string, string>
    const data = await getFootballRecords({
      period: query.period === 'week' ? 'week' : 'season' as RecordPeriod,
      season: query.season || undefined,
      state: query.state || undefined,
      leagueId: query.league || undefined,
      grade: query.grade || undefined,
      limit: Math.min(Math.max(parseInt(query.limit || '5', 10) || 5, 1), 20),
    })
    res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=300')
    res.json({ data })
  } catch (error) {
    logger.error('GET /api/records failed', { detail: String(error) })
    res.status(500).json({ error: 'failed to load football records' })
  }
})

app.use('/api/search', searchRouter)
app.use('/api/rankings', rankingsRouter)
app.use('/api/clubs', clubsRouter)
app.use('/api/club-covers', clubCoversRouter)
app.use('/api/leagues', leaguesRouter)
app.use('/api/directory', directoryRouter)
app.use('/api/goal-kicker-controls', goalKickerAlertControlsRouter)
app.use('/api/goal-kickers', goalKickerLeaderboardRouter)
app.use('/api/goal-kickers', goalKickerAchievementsRouter)
app.use('/api/goal-kickers', goalKickerRecordsSafeRouter)
app.use('/api/goal-kickers', goalKickerContextRouter)
app.use('/api/goal-kickers', goalKickersRouter)
app.use('/api/player-profile-details', playerProfileDetailsRouter)
app.use('/api/mvp', mvpRouter)
app.use('/api/team-sheets', teamSheetsRouter)
app.use('/api/player-availability', playerAvailabilityRouter)
app.use('/api/match-details', matchDetailsRouter)
app.use('/api/featured-games', featuredGamesRouter)
app.use('/api/news', newsRouter)
app.use('/api/highlights', highlightsRouter)
app.use('/api/portal-auth', portalAuthRouter)
app.use('/api/club-portal/club-covers', clubPortalCoversRouter)
app.use('/api/club-portal', clubPortalAccessRouter)
app.use('/api/league-portal', leaguePortalRouter)
app.use('/api/league-portal', leaguePortalContactsRouter)
app.use('/api/follows', followsRouter)
app.use('/api/share-card', shareCardsRouter)
app.use('/api/share-link', shareLinksRouter)
app.use('/api/claims', claimsRouter)
app.use('/api/portal', portalRouter)
app.use('/api/results', resultsRouter)
app.use('/api/fixtures', fixturesRouter)
app.use('/api/clubs', clubMatchRouter)
app.use('/api/leagues', leagueMatchRouter)
app.use('/api/championships', championshipsRouter)
app.use('/api/sponsors', sponsorsRouter)
app.use('/api/commercial', commercialRouter)
app.use('/api/clubs', commercialClubRouter)
app.use('/api/leagues', commercialLeagueRouter)
app.use('/api/players', playerProfileDetailsRouter)
app.use('/api/players', commercialPlayerRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/analytics', analyticsRouter)
app.use('/api', rankingsRouter)
app.use('/api/history', historyRouter)
app.use('/api/history', (req, res, next) => { req.url = `/history${req.url}`; clubsRouter(req, res, next) })

app.use('/admin', adminDashboardRouter)
app.use('/admin/settings', adminSettingsRouter)
app.use('/admin/manage', adminManageRouter)
app.use('/admin/club-covers', adminClubCoversRouter)
app.use('/admin/players', adminPlayersRouter)
app.use('/admin/ocr', adminOcrRouter)
app.use('/admin/match-images', adminMatchImageImportsRouter)
app.use('/admin/match-details', adminMatchDetailsRouter)
app.use('/admin/goal-kicker-images', adminGoalKickerImagesRouter)
app.use('/admin/mvp-images', adminMvpImagesRouter)
app.use('/admin/profile-images', adminProfileImageImportsRouter)
app.use('/admin/universal-imports', adminUniversalImportsRouter)
app.use('/admin/platform/goal-kickers', adminGoalKickerUrlImportsRouter)
app.use('/admin/platform', integratedLeaguesRouter)
app.use('/admin/platform', adminPlatformRouter)
app.use('/admin/claiming', adminClaimingRouter)
app.use('/admin/newsroom', adminNewsroomRouter)
app.use('/admin/quality', adminQualityRouter)
app.use('/admin/results', adminResultsRouter)
app.use('/admin/history', adminHistoryRouter)
app.use('/admin/championships', adminChampionshipsRouter)
app.use('/admin/commercial', adminCommercialRouter)
app.use('/admin/notifications', adminNotificationsRouter)
app.use('/admin/analytics', adminAnalyticsRouter)
app.use('/admin/ladder', adminLadderRouter)
app.use('/admin/season', adminSeasonRouter)
app.use('/admin/playhq', adminPlayhqRouter)
app.use('/admin/highlights', adminHighlightsRouter)
app.use('/admin/featured-games', adminFeaturedGamesRouter)
app.use('/admin/team-sheets', adminTeamSheetsRouter)
app.use('/admin/league-strengths', adminLeagueStrengthsRouter)
app.use('/admin/goal-kicker-achievements', goalKickerAlertControlsRouter)

app.get('/health', (_req, res) => res.json({ status: 'ok', version: process.env.npm_package_version ?? '1.0.0' }))
app.get('/api/debug', async (_req, res) => {
  const hasDbUrl = !!process.env.DATABASE_URL, hasDirectUrl = !!process.env.DIRECT_URL, hasAdminKey = !!process.env.ADMIN_API_KEY
  let dbPing: string
  try { const { PrismaClient } = await import('@prisma/client'); const pc = new PrismaClient(); await pc.$queryRaw`SELECT 1`; await pc.$disconnect(); dbPing = 'ok' } catch (e) { dbPing = String(e) }
  res.json({ hasDbUrl, hasDirectUrl, hasAdminKey, dbPing })
})
app.use('/', seoRouter)
app.use((_req, res) => res.status(404).json({ error: 'Not found' }))
if (process.env.VERCEL !== '1') app.listen(PORT, () => logger.info(`CNCA Rankings API listening on port ${PORT}`))
export default app
