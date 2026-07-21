import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { cachePublic } from '../middleware/cache-middleware.js'
import { publicRateLimit } from '../middleware/rate-limit.js'
import { clubRankingReasoning } from '../../config/ranking-reasoning.js'
import { logger } from '../../utils/logger.js'
import { getCanonicalRankingRun, publicRankedClub, publicRankedLeague, rankingRunIntegrity } from '../../rankings/current-ranking-run.js'

const router = Router()

function logAndRethrow(route: string, err: unknown): never {
  logger.error(`${route} failed`, { detail: String(err) })
  throw err
}

async function getEntries(runId: string, limit?: number, state?: string) {
  return prisma.rankingEntry.findMany({
    where: {
      runId,
      club: publicRankedClub,
      league: publicRankedLeague,
      ...(state ? { state } : {}),
    },
    include: { club: { select: { logoUrl: true } } },
    orderBy: { rank: 'asc' },
    ...(limit ? { take: limit } : {}),
  })
}

type Entry = Awaited<ReturnType<typeof getEntries>>[number]
type Stats = { played: number; wins: number; losses: number; draws: number; goalsFor: number; goalsAgainst: number; percentage: number; points: number }

function formatEntry(entry: Entry, stats?: Stats) {
  let recentForm: unknown = []
  let componentScores: unknown = {}
  try { recentForm = JSON.parse(entry.recentForm || '[]') } catch { recentForm = [] }
  try { componentScores = JSON.parse(entry.componentScores || '{}') } catch { componentScores = {} }
  return {
    rank: entry.rank,
    previousRank: entry.previousRank,
    rankMovement: entry.previousRank == null ? 0 : entry.previousRank - entry.rank,
    clubId: entry.clubId,
    clubName: entry.clubName ?? 'Unknown Club',
    logoUrl: entry.club?.logoUrl ?? null,
    leagueId: entry.leagueId,
    leagueName: entry.leagueName ?? 'Unknown League',
    state: entry.state ?? '—',
    powerRating: Number.isFinite(entry.powerRating) ? entry.powerRating : 0,
    record: { wins: stats?.wins ?? 0, losses: stats?.losses ?? 0, draws: stats?.draws ?? 0, played: stats?.played ?? 0 },
    goalsFor: stats?.goalsFor ?? 0,
    goalsAgainst: stats?.goalsAgainst ?? 0,
    percentage: stats?.percentage ?? 0,
    points: stats?.points ?? 0,
    recentForm,
    componentScores,
    calculatedAt: entry.calculatedAt,
  }
}

function rankingSeasonCandidates(season: string) {
  const calendarYear = season.match(/\b(20\d{2})\b/)?.[1]
  return [...new Set([season, calendarYear].filter((value): value is string => Boolean(value)))]
}

async function formatEntries(entries: Entry[], season: string) {
  const clubIds = entries.map(e => e.clubId)
  const rows = await prisma.clubLeagueSeason.findMany({
    where: { clubId: { in: clubIds }, season: { in: rankingSeasonCandidates(season) }, isActive: true },
    select: { clubId: true, leagueId: true, played: true, wins: true, losses: true, draws: true, goalsFor: true, goalsAgainst: true, percentage: true, points: true, updatedAt: true },
    orderBy: [{ played: 'desc' }, { updatedAt: 'desc' }],
  })
  const exact = new Map<string, Stats>()
  const byClub = new Map<string, Stats>()
  for (const row of rows) {
    const key = `${row.clubId}:${row.leagueId}`
    if (!exact.has(key)) exact.set(key, row)
    if (!byClub.has(row.clubId)) byClub.set(row.clubId, row)
  }
  return entries.map(e => formatEntry(e, exact.get(`${e.clubId}:${e.leagueId}`) ?? byClub.get(e.clubId)))
}

async function getFallbackEntries(limit?: number, state?: string, season?: string) {
  const latestSeason = season ?? (await prisma.clubLeagueSeason.findFirst({
    where: { isActive: true, club: publicRankedClub, league: publicRankedLeague },
    orderBy: { season: 'desc' },
    select: { season: true },
  }))?.season
  const rows = await prisma.clubLeagueSeason.findMany({
    where: {
      isActive: true,
      ...(latestSeason ? { season: latestSeason } : {}),
      league: publicRankedLeague,
      club: { ...publicRankedClub, ...(state ? { state: { code: state } } : {}) },
    },
    orderBy: [{ points: 'desc' }, { percentage: 'desc' }, { wins: 'desc' }, { club: { name: 'asc' } }],
    ...(limit ? { take: limit } : {}),
    select: {
      clubId: true, leagueId: true, played: true, wins: true, losses: true, draws: true, goalsFor: true, goalsAgainst: true, percentage: true, points: true,
      club: { select: { name: true, logoUrl: true, state: { select: { code: true } } } },
      league: { select: { name: true } },
    },
  })
  return {
    season: latestSeason ?? null,
    data: rows.map((row, index) => ({
      rank: index + 1,
      previousRank: null,
      rankMovement: 0,
      clubId: row.clubId,
      clubName: row.club.name,
      logoUrl: row.club.logoUrl,
      leagueId: row.leagueId,
      leagueName: row.league.name,
      state: row.club.state.code,
      powerRating: row.points || row.percentage ? Math.round(((row.points * 4) + row.percentage) * 10) / 10 : 0,
      record: { wins: row.wins, losses: row.losses, draws: row.draws, played: row.played },
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      percentage: row.percentage,
      points: row.points,
      recentForm: [],
      componentScores: {},
      calculatedAt: null,
    })),
  }
}

async function sendRankings(res: any, limit?: number, state?: string, season?: string) {
  const canonical = await getCanonicalRankingRun(season)
  if (!canonical) {
    const fallback = await getFallbackEntries(limit, state, season)
    return res.json({ data: fallback.data, meta: { weekLabel: null, season: fallback.season, total: fallback.data.length, filteredTotal: fallback.data.length, source: 'clubs-fallback', healthy: false } })
  }
  const { run, visibleEntries } = canonical
  const entries = await getEntries(run.id, limit, state)
  if (!entries.length && !state) {
    const fallback = await getFallbackEntries(limit, state, run.season)
    return res.json({ data: fallback.data, meta: { weekLabel: run.weekLabel, season: run.season, total: visibleEntries, filteredTotal: fallback.data.length, generatedAt: run.completedAt, source: 'clubs-fallback', healthy: false } })
  }
  return res.json({ data: await formatEntries(entries, run.season), meta: { weekLabel: run.weekLabel, season: run.season, total: visibleEntries, filteredTotal: entries.length, generatedAt: run.completedAt, source: 'ranking-run', healthy: true } })
}

router.get('/', publicRateLimit, cachePublic(600), async (req, res) => {
  try { await sendRankings(res, undefined, String(req.query.state || '') || undefined, String(req.query.season || '') || undefined) }
  catch (err) { logAndRethrow('GET /api/rankings', err) }
})

router.get('/health', publicRateLimit, cachePublic(120), async (req, res) => {
  try {
    const canonical = await getCanonicalRankingRun(String(req.query.season || '') || undefined)
    if (!canonical) return res.json({ data: { status: 'NO_RUN', healthy: false, stale: true, run: null, integrity: null } })
    const integrity = await rankingRunIntegrity(canonical.run.id)
    const ageHours = canonical.run.completedAt ? Math.max(0, (Date.now() - canonical.run.completedAt.getTime()) / 3_600_000) : null
    const stale = ageHours == null || ageHours > 192
    res.json({ data: { status: integrity.healthy && !stale ? 'HEALTHY' : stale ? 'STALE' : 'NEEDS_REVIEW', healthy: integrity.healthy && !stale, stale, ageHours, run: { id: canonical.run.id, weekLabel: canonical.run.weekLabel, season: canonical.run.season, completedAt: canonical.run.completedAt }, integrity } })
  } catch (err) { logAndRethrow('GET /api/rankings/health', err) }
})

router.get('/week/:weekLabel', publicRateLimit, cachePublic(3600), async (req, res) => {
  try {
    const run = await prisma.rankingRun.findFirst({ where: { weekLabel: String(req.params.weekLabel), status: 'COMPLETED' }, orderBy: { completedAt: 'desc' } })
    if (!run) return res.status(404).json({ error: 'No rankings found for this week' })
    const entries = await getEntries(run.id)
    res.json({ data: await formatEntries(entries, run.season), meta: { weekLabel: run.weekLabel, season: run.season, total: entries.length, filteredTotal: entries.length, generatedAt: run.completedAt } })
  } catch (err) { logAndRethrow('GET /api/rankings/week/:weekLabel', err) }
})

for (const [path, limit] of [['/top10', 10], ['/top25', 25], ['/top100', 100]] as const) {
  router.get(path, publicRateLimit, cachePublic(600), async (req, res) => {
    try { await sendRankings(res, limit, String(req.query.state || '') || undefined, String(req.query.season || '') || undefined) }
    catch (err) { logAndRethrow(`GET /api/rankings${path}`, err) }
  })
}

router.get('/explain/:clubId', publicRateLimit, cachePublic(600), async (req, res) => {
  try {
    const canonical = await getCanonicalRankingRun()
    if (!canonical) return res.status(404).json({ error: 'No completed ranking run' })
    const entry = await prisma.rankingEntry.findUnique({ where: { runId_clubId: { runId: canonical.run.id, clubId: String(req.params.clubId) } } })
    if (!entry) return res.status(404).json({ error: 'Club not found in the current rankings' })
    const league = await prisma.league.findFirst({
      where: { id: entry.leagueId, ...publicRankedLeague },
      select: { name: true, finalStrengthRating: true, automaticStrengthRating: true, manualStrengthOverride: true, strengthConfidence: true, strengthReasoning: true, strengthCalculatedAt: true },
    })
    if (!league) return res.status(404).json({ error: 'Club not found in the current rankings' })
    let componentScores: Record<string, number> = {}
    let recentForm: string[] = []
    try { componentScores = JSON.parse(entry.componentScores || '{}') } catch { componentScores = {} }
    try { recentForm = JSON.parse(entry.recentForm || '[]') } catch { recentForm = [] }
    const config = await prisma.rankingConfig.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'desc' } })
    let weights
    try { weights = config?.weights ? JSON.parse(config.weights) : undefined } catch { weights = undefined }
    res.json({ data: {
      clubId: entry.clubId,
      clubName: entry.clubName,
      rank: entry.rank,
      previousRank: entry.previousRank,
      rankMovement: entry.previousRank == null ? 0 : entry.previousRank - entry.rank,
      powerRating: entry.powerRating,
      weekLabel: canonical.run.weekLabel,
      reasoning: clubRankingReasoning({ clubName: entry.clubName, leagueName: entry.leagueName, rank: entry.rank, powerRating: entry.powerRating, rankMovement: entry.previousRank == null ? 0 : entry.previousRank - entry.rank, componentScores, recentForm, weights }),
      componentScores,
      league: { name: league.name, strength: league.finalStrengthRating, automaticStrength: league.automaticStrengthRating, manualOverride: league.manualStrengthOverride, confidence: league.strengthConfidence, reasoning: league.strengthReasoning, calculatedAt: league.strengthCalculatedAt },
    } })
  } catch (err) { logAndRethrow('GET /api/rankings/explain/:clubId', err) }
})

export { router as rankingsRouter }
