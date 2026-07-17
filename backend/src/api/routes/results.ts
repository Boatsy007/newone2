/**
 * Results & Fixtures public API (Phase B5) — additive read-only endpoints.
 * ─────────────────────────────────────────────────────────────────────────────
 * Mounted at /api/results and /api/fixtures, plus club/league sub-routers that
 * add /:id/results and /:id/fixtures WITHOUT modifying the existing clubs/leagues
 * routers (they are appended, so they only handle paths the originals 404).
 */

import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { publicRateLimit } from '../middleware/rate-limit.js'
import { cachePublic } from '../middleware/cache-middleware.js'
import { getClubResults, getLeagueResults, getClubMatchHistory } from '../../results/results.service.js'
import { getClubFixtures, getLeagueFixtures } from '../../results/fixtures.service.js'
import { getStatLeaderboards } from '../../results/statistics.js'
import { getRoundSummary } from '../../results/rounds.js'
import { getCurrentLadder, listLadders } from '../../ladder/ladders.service.js'
import { clubUpNext } from '../../ladder/up-next.js'
import { getClubSeasonHistory } from '../../season/timeline.js'
import { logger } from '../../utils/logger.js'

// ── /api/results ──────────────────────────────────────────────────────────────
const results = Router()
results.get('/', publicRateLimit, cachePublic(300), async (req, res) => {
  const { league, season, round, limit } = req.query as Record<string, string>
  const where = { ...(league ? { leagueId: league } : {}), ...(season ? { season } : {}), ...(round ? { round: parseInt(round, 10) } : {}) }
  const data = await prisma.matchResult.findMany({ where, orderBy: [{ matchDate: 'desc' }, { round: 'desc' }], take: Math.min(parseInt(limit ?? '200', 10) || 200, 1000) })
  res.json({ data, meta: { total: data.length } })
})
results.get('/football', publicRateLimit, cachePublic(300), async (req, res) => {
  const { league, season, round, limit } = req.query as Record<string, string>
  const data = await prisma.footballResult.findMany({
    where: {
      published: true,
      ...(league ? { leagueId: league } : {}),
      ...(season ? { season } : {}),
      ...(round ? { round } : {}),
    },
    include: { league: { include: { state: true } } },
    orderBy: [{ matchDate: 'desc' }, { round: 'desc' }],
    take: Math.min(parseInt(limit ?? '500', 10) || 500, 1000),
  })
  res.json({
    data: data.map(row => ({
      id: `football:${row.id}`,
      sourceId: row.id,
      leagueId: row.leagueId,
      leagueName: row.league.name,
      state: row.league.state.code,
      season: row.season,
      grade: row.grade,
      round: row.round,
      matchDate: row.matchDate,
      venue: row.venue,
      homeClubId: row.homeClubId,
      homeClubName: row.homeName,
      awayClubId: row.awayClubId,
      awayClubName: row.awayName,
      homeGoals: row.homeGoals,
      homeBehinds: row.homeBehinds,
      homePoints: row.homePoints,
      homeScore: row.homePoints,
      awayGoals: row.awayGoals,
      awayBehinds: row.awayBehinds,
      awayPoints: row.awayPoints,
      awayScore: row.awayPoints,
      status: 'COMPLETED',
      sourceUrl: row.sourceUrl,
      verified: row.verified,
    })),
    meta: { total: data.length },
  })
})
results.get('/football/:id', publicRateLimit, cachePublic(300), async (req, res) => {
  const row = await prisma.footballResult.findUnique({ where: { id: String(req.params.id) }, include: { league: { include: { state: true } } } })
  if (!row || !row.published) return res.status(404).json({ error: 'result not found' })
  res.json({ data: {
    id: `football:${row.id}`, sourceId: row.id, leagueId: row.leagueId, leagueName: row.league.name, state: row.league.state.code,
    season: row.season, grade: row.grade, round: row.round, matchDate: row.matchDate, venue: row.venue,
    homeClubId: row.homeClubId, homeClubName: row.homeName, awayClubId: row.awayClubId, awayClubName: row.awayName,
    homeGoals: row.homeGoals, homeBehinds: row.homeBehinds, homePoints: row.homePoints, homeScore: row.homePoints,
    awayGoals: row.awayGoals, awayBehinds: row.awayBehinds, awayPoints: row.awayPoints, awayScore: row.awayPoints,
    status: 'COMPLETED', sourceUrl: row.sourceUrl, verified: row.verified,
  } })
})
results.get('/leaderboards', publicRateLimit, cachePublic(600), async (req, res) => {
  const season = (req.query.season as string) || (await prisma.setting.findUnique({ where: { key: 'currentSeason' } }).catch(() => null))?.value
  if (!season) return res.json({ data: null })
  res.json({ data: await getStatLeaderboards(season) })
})
results.get('/insights', publicRateLimit, cachePublic(300), async (req, res) => {
  const { season, kind, round } = req.query as Record<string, string>
  const where = { ...(season ? { season } : {}), ...(kind ? { kind } : {}), ...(round ? { round: parseInt(round, 10) } : {}) }
  res.json({ data: await prisma.matchInsight.findMany({ where, orderBy: { createdAt: 'desc' }, take: 300 }) })
})
results.get('/club/:clubId', publicRateLimit, cachePublic(300), async (req, res) => {
  res.json({ data: await getClubResults(String(req.params.clubId), { season: req.query.season as string | undefined }) })
})
results.get('/club/:clubId/history', publicRateLimit, cachePublic(300), async (req, res) => {
  res.json({ data: await getClubMatchHistory(String(req.params.clubId), req.query.season as string | undefined) })
})
results.get('/league/:leagueId', publicRateLimit, cachePublic(300), async (req, res) => {
  res.json({ data: await getLeagueResults(String(req.params.leagueId), { season: req.query.season as string | undefined, round: req.query.round ? parseInt(String(req.query.round), 10) : undefined }) })
})
results.get('/:id', publicRateLimit, cachePublic(300), async (req, res) => {
  const r = await prisma.matchResult.findUnique({ where: { id: String(req.params.id) } })
  if (!r) return res.status(404).json({ error: 'result not found' })
  res.json({ data: r })
})

// ── /api/fixtures ─────────────────────────────────────────────────────────────
const fixtures = Router()
fixtures.get('/', publicRateLimit, cachePublic(300), async (req, res) => {
  const { league, season, round, status } = req.query as Record<string, string>
  const where = { ...(league ? { leagueId: league } : {}), ...(season ? { season } : {}), ...(round ? { round: parseInt(round, 10) } : {}), ...(status ? { status } : {}) }
  const data = await prisma.fixture.findMany({ where, orderBy: [{ matchDate: 'asc' }, { round: 'asc' }], take: 500 })
  res.json({ data, meta: { total: data.length } })
})
fixtures.get('/football', publicRateLimit, cachePublic(300), async (req, res) => {
  const { league, season, round, limit } = req.query as Record<string, string>
  const data = await prisma.footballFixture.findMany({
    where: {
      ...(league ? { leagueId: league } : {}),
      ...(season ? { season } : {}),
      ...(round ? { round } : {}),
    },
    include: { league: { include: { state: true } } },
    orderBy: [{ matchDate: 'asc' }, { round: 'asc' }],
    take: Math.min(parseInt(limit ?? '500', 10) || 500, 1000),
  })
  res.json({
    data: data.map(row => ({
      id: `football:${row.id}`,
      sourceId: row.id,
      leagueId: row.leagueId,
      leagueName: row.league.name,
      state: row.league.state.code,
      season: row.season,
      grade: row.grade,
      round: row.round,
      matchDate: row.matchDate,
      venue: row.venue,
      homeClubId: row.homeClubId,
      homeClubName: row.homeName,
      awayClubId: row.awayClubId,
      awayClubName: row.awayName,
      status: 'SCHEDULED',
      sourceUrl: row.sourceUrl,
      verified: row.verified,
    })),
    meta: { total: data.length },
  })
})
fixtures.get('/football/:id', publicRateLimit, cachePublic(300), async (req, res) => {
  const row = await prisma.footballFixture.findUnique({ where: { id: String(req.params.id) }, include: { league: { include: { state: true } } } })
  if (!row) return res.status(404).json({ error: 'fixture not found' })
  res.json({ data: {
    id: `football:${row.id}`, sourceId: row.id, leagueId: row.leagueId, leagueName: row.league.name, state: row.league.state.code,
    season: row.season, grade: row.grade, round: row.round, matchDate: row.matchDate, venue: row.venue,
    homeClubId: row.homeClubId, homeClubName: row.homeName, awayClubId: row.awayClubId, awayClubName: row.awayName,
    status: 'SCHEDULED', sourceUrl: row.sourceUrl, verified: row.verified,
  } })
})
fixtures.get('/club/:clubId', publicRateLimit, cachePublic(300), async (req, res) => {
  res.json({ data: await getClubFixtures(String(req.params.clubId), { season: req.query.season as string | undefined, upcomingOnly: req.query.upcoming === 'true' }) })
})
fixtures.get('/league/:leagueId', publicRateLimit, cachePublic(300), async (req, res) => {
  res.json({ data: await getLeagueFixtures(String(req.params.leagueId), { season: req.query.season as string | undefined, round: req.query.round ? parseInt(String(req.query.round), 10) : undefined }) })
})
fixtures.get('/:id', publicRateLimit, cachePublic(300), async (req, res) => {
  const f = await prisma.fixture.findUnique({ where: { id: String(req.params.id) } })
  if (!f) return res.status(404).json({ error: 'fixture not found' })
  res.json({ data: f })
})

// ── Club/league sub-routers (append to /api/clubs and /api/leagues) ───────────
const clubMatch = Router()
clubMatch.get('/:id/results', publicRateLimit, cachePublic(300), async (req, res) => {
  try { res.json({ data: await getClubResults(String(req.params.id), { season: req.query.season as string | undefined }) }) }
  catch (err) { logger.error('GET /clubs/:id/results', { detail: String(err) }); res.status(500).json({ error: 'failed' }) }
})
clubMatch.get('/:id/fixtures', publicRateLimit, cachePublic(300), async (req, res) => {
  res.json({ data: await getClubFixtures(String(req.params.id), { season: req.query.season as string | undefined, upcomingOnly: req.query.upcoming === 'true' }) })
})
clubMatch.get('/:id/up-next', publicRateLimit, cachePublic(300), async (req, res) => {
  res.json({ data: await clubUpNext(String(req.params.id), { season: req.query.season as string | undefined }) })
})
clubMatch.get('/:id/season-history', publicRateLimit, cachePublic(300), async (req, res) => {
  res.json({ data: await getClubSeasonHistory(String(req.params.id), { season: req.query.season as string | undefined, leagueId: req.query.league as string | undefined, grade: req.query.grade as string | undefined }) })
})

const leagueMatch = Router()
leagueMatch.get('/:id/results', publicRateLimit, cachePublic(300), async (req, res) => {
  res.json({ data: await getLeagueResults(String(req.params.id), { season: req.query.season as string | undefined, round: req.query.round ? parseInt(String(req.query.round), 10) : undefined }) })
})
leagueMatch.get('/:id/fixtures', publicRateLimit, cachePublic(300), async (req, res) => {
  res.json({ data: await getLeagueFixtures(String(req.params.id), { season: req.query.season as string | undefined, round: req.query.round ? parseInt(String(req.query.round), 10) : undefined }) })
})
leagueMatch.get('/:id/rounds/:round/summary', publicRateLimit, cachePublic(600), async (req, res) => {
  const summary = await getRoundSummary(String(req.params.id), parseInt(String(req.params.round), 10), { season: req.query.season as string | undefined, grade: req.query.grade as string | undefined })
  if (!summary) return res.status(404).json({ error: 'no summary for this round' })
  res.json({ data: summary })
})
leagueMatch.get('/:id/ladder', publicRateLimit, cachePublic(300), async (req, res) => {
  const ladder = await getCurrentLadder(String(req.params.id), { season: req.query.season as string | undefined, grade: req.query.grade as string | undefined })
  if (!ladder) return res.status(404).json({ error: 'no current ladder' })
  res.json({ data: ladder })
})
leagueMatch.get('/:id/ladders', publicRateLimit, cachePublic(300), async (req, res) => {
  res.json({ data: await listLadders(String(req.params.id), { season: req.query.season as string | undefined, grade: req.query.grade as string | undefined }) })
})
leagueMatch.get('/:id/rounds', publicRateLimit, cachePublic(300), async (req, res) => {
  const where = { leagueId: String(req.params.id), ...(req.query.season ? { season: String(req.query.season) } : {}), ...(req.query.grade ? { grade: String(req.query.grade) } : {}) }
  const rounds = await prisma.roundSummary.findMany({ where, orderBy: { round: 'asc' }, select: { round: true, season: true, grade: true, matchesPlayed: true, averageMargin: true, biggestMargin: true, closestMargin: true, upsetDetected: true, generatedAt: true } })
  res.json({ data: rounds, meta: { total: rounds.length } })
})

export { results as resultsRouter, fixtures as fixturesRouter, clubMatch as clubMatchRouter, leagueMatch as leagueMatchRouter }
