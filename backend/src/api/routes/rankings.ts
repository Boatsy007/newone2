import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { cachePublic } from '../middleware/cache-middleware.js'
import { publicRateLimit } from '../middleware/rate-limit.js'
import { clubRankingReasoning } from '../../config/ranking-reasoning.js'
import { logger } from '../../utils/logger.js'

const router = Router()
const publicClub = { sport: 'FOOTBALL', archivedAt: null, isActive: true } as const
const publicLeague = { sport: 'FOOTBALL', archivedAt: null, isActive: true } as const

function logAndRethrow(route: string, err: unknown): never {
  logger.error(`${route} failed`, { detail: String(err) })
  throw err
}

async function getLatestRun(season?: string) {
  const runs = await prisma.rankingRun.findMany({
    where: { status: 'COMPLETED', ...(season ? { season } : {}) },
    orderBy: { completedAt: 'desc' },
    take: 25,
  })
  for (const run of runs) {
    const count = await prisma.rankingEntry.count({
      where: { runId: run.id, club: publicClub, league: publicLeague },
    })
    if (count > 0) return run
  }
  return null
}

async function getEntries(runId: string, limit?: number, state?: string) {
  return prisma.rankingEntry.findMany({
    where: {
      runId,
      club: publicClub,
      league: publicLeague,
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
    rankMovement: entry.rankMovement ?? 0,
    clubId: entry.clubId,
    clubName: entry.clubName ?? 'Unknown Club',
    logoUrl: entry.club?.logoUrl ?? null,
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

async function formatEntries(entries: Entry[], season: string) {
  const clubIds = entries.map(e => e.clubId)
  const rows = await prisma.clubLeagueSeason.findMany({
    where: { clubId: { in: clubIds }, season },
    select: { clubId: true, leagueId: true, played: true, wins: true, losses: true, draws: true, goalsFor: true, goalsAgainst: true, percentage: true, points: true },
  })
  const exact = new Map(rows.map(r => [`${r.clubId}:${r.leagueId}`, r]))
  const byClub = new Map(rows.map(r => [r.clubId, r]))
  return entries.map(e => formatEntry(e, exact.get(`${e.clubId}:${e.leagueId}`) ?? byClub.get(e.clubId)))
}

async function getFallbackEntries(limit?: number, state?: string, season?: string) {
  const latestSeason = season ?? (await prisma.clubLeagueSeason.findFirst({
    where: { isActive: true, club: publicClub, league: publicLeague },
    orderBy: { season: 'desc' },
    select: { season: true },
  }))?.season
  const rows = await prisma.clubLeagueSeason.findMany({
    where: {
      isActive: true,
      ...(season ? { season } : {}),
      league: publicLeague,
      club: { ...publicClub, ...(state ? { state: { code: state } } : {}) },
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
  const run = await getLatestRun(season)
  if (!run) {
    const fallback = await getFallbackEntries(limit, state, season)
    return res.json({ data: fallback.data, meta: { weekLabel: null, season: fallback.season, total: fallback.data.length, source: 'clubs-fallback' } })
  }
  const entries = await getEntries(run.id, limit, state)
  if (!entries.length) {
    const fallback = await getFallbackEntries(limit, state, run.season)
    return res.json({ data: fallback.data, meta: { weekLabel: run.weekLabel, season: run.season, total: fallback.data.length, generatedAt: run.completedAt, source: 'clubs-fallback' } })
  }
  return res.json({ data: await formatEntries(entries, run.season), meta: { weekLabel: run.weekLabel, season: run.season, total: entries.length, generatedAt: run.completedAt } })
}

router.get('/', publicRateLimit, cachePublic(600), async (req, res) => {
  try { await sendRankings(res, undefined, String(req.query.state || '') || undefined, String(req.query.season || '') || undefined) }
  catch (err) { logAndRethrow('GET /api/rankings', err) }
})

router.get('/week/:weekLabel', publicRateLimit, cachePublic(3600), async (req, res) => {
  try {
    const run = await prisma.rankingRun.findFirst({ where: { weekLabel: String(req.params.weekLabel), status: 'COMPLETED' }, orderBy: { completedAt: 'desc' } })
    if (!run) return res.status(404).json({ error: 'No rankings found for this week' })
    const entries = await getEntries(run.id)
    res.json({ data: await formatEntries(entries, run.season), meta: { weekLabel: run.weekLabel, season: run.season, total: entries.length } })
  } catch (err) { logAndRethrow('GET /api/rankings/week/:weekLabel', err) }
})

for (const [path, limit] of [['/top10', 10], ['/top25', 25], ['/top100', 100]] as const) {
  router.get(path, publicRateLimit, cachePublic(600), async (req, res) => {
    try { await sendRankings(res, limit, String(req.query.state || '') || undefined) }
    catch (err) { logAndRethrow(`GET /api${path}`, err) }
  })
}

router.get('/explain/:clubId', publicRateLimit, cachePublic(600), async (req, res) => {
  try {
    const run = await getLatestRun()
    if (!run) return res.status(404).json({ error: 'No completed ranking run' })
    const entry = await prisma.rankingEntry.findUnique({ where: { runId_clubId: { runId: run.id, clubId: String(req.params.clubId) } } })
    if (!entry) return res.status(404).json({ error: 'Club not found in the current rankings' })
    const league = await prisma.league.findFirst({ where: { id: entry.leagueId, ...publicLeague }, select: { id: true } })
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
      powerRating: entry.powerRating,
      weekLabel: run.weekLabel,
      reasoning: clubRankingReasoning({ clubName: entry.clubName, leagueName: entry.leagueName, rank: entry.rank, powerRating: entry.powerRating, rankMovement: entry.rankMovement, componentScores, recentForm, weights }),
      componentScores,
      league: entry.leagueId ? { name: entry.leagueName, strength: null, confidence: null, reasoning: null, calculatedAt: null } : null,
    } })
  } catch (err) { logAndRethrow('GET /api/rankings/explain/:clubId', err) }
})

export { router as rankingsRouter }
