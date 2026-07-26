import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { requireAdminKey } from '../middleware/auth.js'
import { publicRateLimit } from '../middleware/rate-limit.js'
import { cachePublic } from '../middleware/cache-middleware.js'

const SETTING_KEY = 'homepageFeaturedGames'
const MAX_FEATURED_GAMES = 3

const cleanIds = (value: unknown) => {
  const rows = Array.isArray(value) ? value : []
  return [...new Set(rows.map(item => String(item ?? '').replace(/^football:/, '').trim()).filter(Boolean))].slice(0, MAX_FEATURED_GAMES)
}

async function readSelection() {
  const setting = await prisma.setting.findUnique({ where: { key: SETTING_KEY } }).catch(() => null)
  if (!setting?.value) return [] as string[]
  try { return cleanIds(JSON.parse(setting.value)) } catch { return [] as string[] }
}

type TeamMetric = {
  clubId: string
  clubName: string
  logoUrl: string | null
  nationalRank: number | null
  ladderPosition: number | null
  attackRating: number
  defensiveRating: number
  wins: number
  losses: number
  draws: number
  percentage: number
  teamSelectionUrl: string
}

type AutoCandidate = {
  id: string
  leagueId: string
  matchDate: Date
  score: number
}

async function automaticallySelectGames(limit: number, excludedIds: string[] = []) {
  if (limit <= 0) return [] as string[]

  const now = new Date()
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const horizon = new Date(now)
  horizon.setDate(horizon.getDate() + 120)

  const fixtures = await prisma.footballFixture.findMany({
    where: {
      id: excludedIds.length ? { notIn: excludedIds } : undefined,
      matchDate: { gte: startOfToday, lte: horizon },
      homeClubId: { not: null },
      awayClubId: { not: null },
    },
    orderBy: { matchDate: 'asc' },
    take: 600,
    select: {
      id: true,
      leagueId: true,
      season: true,
      matchDate: true,
      homeClubId: true,
      awayClubId: true,
    },
  })
  if (!fixtures.length) return [] as string[]

  const clubIds = [...new Set(fixtures.flatMap(row => [row.homeClubId, row.awayClubId]).filter((value): value is string => Boolean(value)))]
  const leagueIds = [...new Set(fixtures.map(row => row.leagueId))]
  const seasons = [...new Set(fixtures.map(row => row.season))]

  const latestRun = await prisma.rankingRun.findFirst({
    where: { status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
    select: { id: true },
  })

  const [rankingRows, footballRows, legacyRows] = await Promise.all([
    latestRun
      ? prisma.rankingEntry.findMany({
          where: { runId: latestRun.id, clubId: { in: clubIds } },
          select: { clubId: true, rank: true },
        })
      : Promise.resolve([]),
    prisma.footballLadderEntry.findMany({
      where: { leagueId: { in: leagueIds }, season: { in: seasons }, published: true },
      select: { leagueId: true, season: true, clubId: true, position: true },
    }),
    prisma.clubLeagueSeason.findMany({
      where: { leagueId: { in: leagueIds }, season: { in: seasons }, clubId: { in: clubIds }, isActive: true },
      select: { leagueId: true, season: true, clubId: true, position: true },
    }),
  ])

  const rankByClub = new Map(rankingRows.map(row => [row.clubId, row.rank]))
  const ladderByLeagueSeasonClub = new Map<string, number>()
  for (const row of footballRows) {
    if (row.clubId && row.position != null) ladderByLeagueSeasonClub.set(`${row.leagueId}:${row.season}:${row.clubId}`, row.position)
  }
  for (const row of legacyRows) {
    const key = `${row.leagueId}:${row.season}:${row.clubId}`
    if (!ladderByLeagueSeasonClub.has(key) && row.position != null) ladderByLeagueSeasonClub.set(key, row.position)
  }

  const candidates: AutoCandidate[] = fixtures.flatMap(fixture => {
    if (!fixture.homeClubId || !fixture.awayClubId || !fixture.matchDate) return []
    const homePosition = ladderByLeagueSeasonClub.get(`${fixture.leagueId}:${fixture.season}:${fixture.homeClubId}`) ?? null
    const awayPosition = ladderByLeagueSeasonClub.get(`${fixture.leagueId}:${fixture.season}:${fixture.awayClubId}`) ?? null
    const homeRank = rankByClub.get(fixture.homeClubId) ?? null
    const awayRank = rankByClub.get(fixture.awayClubId) ?? null
    const daysAway = Math.max(0, Math.floor((fixture.matchDate.getTime() - now.getTime()) / 86_400_000))

    let score = Math.max(0, 1200 - daysAway * 10)

    if (homePosition != null && awayPosition != null) {
      const low = Math.min(homePosition, awayPosition)
      const high = Math.max(homePosition, awayPosition)
      const gap = high - low

      if (low === 1 && high === 2) score += 20_000
      else if (high <= 4) score += 14_000
      else if (high <= 6) score += 9_000
      else score += Math.max(0, 7_000 - (homePosition + awayPosition) * 350)

      score += Math.max(0, 2_000 - gap * 300)
      score += Math.max(0, 1_500 - (homePosition + awayPosition) * 100)
    } else if (homePosition != null || awayPosition != null) {
      score += Math.max(0, 4_000 - (homePosition ?? awayPosition ?? 12) * 250)
    }

    if (homeRank != null && awayRank != null) {
      score += Math.max(0, 6_000 - (homeRank + awayRank) * 25)
      score += Math.max(0, 1_000 - Math.abs(homeRank - awayRank) * 15)
    } else if (homeRank != null || awayRank != null) {
      score += Math.max(0, 2_500 - (homeRank ?? awayRank ?? 100) * 15)
    }

    if (homePosition != null && awayPosition != null) score += 750
    if (homeRank != null && awayRank != null) score += 500

    return [{ id: fixture.id, leagueId: fixture.leagueId, matchDate: fixture.matchDate, score }]
  })

  candidates.sort((a, b) => b.score - a.score || a.matchDate.getTime() - b.matchDate.getTime())

  const selected: string[] = []
  const usedLeagues = new Set<string>()

  for (const candidate of candidates) {
    if (selected.length >= limit) break
    if (usedLeagues.has(candidate.leagueId)) continue
    selected.push(candidate.id)
    usedLeagues.add(candidate.leagueId)
  }
  for (const candidate of candidates) {
    if (selected.length >= limit) break
    if (!selected.includes(candidate.id)) selected.push(candidate.id)
  }

  return selected
}

async function resolveFeaturedGameIds() {
  const manualIds = await readSelection()
  const automaticIds = await automaticallySelectGames(MAX_FEATURED_GAMES - manualIds.length, manualIds)
  return { manualIds, automaticIds, ids: [...manualIds, ...automaticIds].slice(0, MAX_FEATURED_GAMES) }
}

async function buildFeaturedGames(ids: string[]) {
  if (!ids.length) return []

  const fixtures = await prisma.footballFixture.findMany({
    where: { id: { in: ids } },
    include: { league: { include: { state: true } } },
  })
  const order = new Map(ids.map((id, index) => [id, index]))
  fixtures.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999))

  const clubIds = [...new Set(fixtures.flatMap(row => [row.homeClubId, row.awayClubId]).filter((value): value is string => Boolean(value)))]
  const clubs = await prisma.club.findMany({ where: { id: { in: clubIds } }, select: { id: true, name: true, logoUrl: true } })
  const clubsById = new Map(clubs.map(row => [row.id, row]))

  const latestRun = await prisma.rankingRun.findFirst({ where: { status: 'COMPLETED' }, orderBy: { completedAt: 'desc' }, select: { id: true } })
  const rankings = latestRun ? await prisma.rankingEntry.findMany({ where: { runId: latestRun.id, clubId: { in: clubIds } }, select: { clubId: true, rank: true } }) : []
  const rankByClub = new Map(rankings.map(row => [row.clubId, row.rank]))

  const metricByFixtureClub = new Map<string, TeamMetric>()
  for (const fixture of fixtures) {
    const fixtureClubIds = [fixture.homeClubId, fixture.awayClubId].filter((value): value is string => Boolean(value))
    const [footballRows, legacyRows] = await Promise.all([
      prisma.footballLadderEntry.findMany({
        where: { leagueId: fixture.leagueId, season: fixture.season, published: true },
        orderBy: { position: 'asc' },
        select: { clubId: true, clubName: true, position: true, played: true, wins: true, losses: true, draws: true, pointsFor: true, pointsAgainst: true, percentage: true },
      }),
      prisma.clubLeagueSeason.findMany({
        where: { leagueId: fixture.leagueId, season: fixture.season, clubId: { in: fixtureClubIds }, isActive: true },
        select: { clubId: true, position: true, played: true, wins: true, losses: true, draws: true, goalsFor: true, goalsAgainst: true, percentage: true },
      }),
    ])
    const footballByClub = new Map(footballRows.filter(row => row.clubId).map(row => [row.clubId as string, row]))
    const legacyByClub = new Map(legacyRows.map(row => [row.clubId, row]))

    for (const clubId of fixtureClubIds) {
      const club = clubsById.get(clubId)
      const football = footballByClub.get(clubId)
      const legacy = legacyByClub.get(clubId)
      const played = football?.played ?? legacy?.played ?? 0
      const pointsFor = football?.pointsFor ?? legacy?.goalsFor ?? 0
      const pointsAgainst = football?.pointsAgainst ?? legacy?.goalsAgainst ?? 0
      metricByFixtureClub.set(`${fixture.id}:${clubId}`, {
        clubId,
        clubName: club?.name ?? football?.clubName ?? (clubId === fixture.homeClubId ? fixture.homeName : fixture.awayName),
        logoUrl: club?.logoUrl ?? null,
        nationalRank: rankByClub.get(clubId) ?? null,
        ladderPosition: football?.position ?? legacy?.position ?? null,
        attackRating: played > 0 ? Math.round((pointsFor / played) * 10) / 10 : 0,
        defensiveRating: played > 0 ? Math.round((pointsAgainst / played) * 10) / 10 : 0,
        wins: football?.wins ?? legacy?.wins ?? 0,
        losses: football?.losses ?? legacy?.losses ?? 0,
        draws: football?.draws ?? legacy?.draws ?? 0,
        percentage: Number(football?.percentage ?? legacy?.percentage ?? 0),
        teamSelectionUrl: `/team/${encodeURIComponent(clubId)}?tab=team-selection`,
      })
    }
  }

  return fixtures.map(row => ({
    id: row.id,
    fixtureId: `football:${row.id}`,
    leagueId: row.leagueId,
    leagueName: row.league.name,
    state: row.league.state.code,
    season: row.season,
    grade: row.grade,
    round: row.round,
    matchDate: row.matchDate,
    venue: row.venue,
    home: row.homeClubId ? metricByFixtureClub.get(`${row.id}:${row.homeClubId}`) ?? null : null,
    away: row.awayClubId ? metricByFixtureClub.get(`${row.id}:${row.awayClubId}`) ?? null : null,
  })).filter(row => row.home && row.away)
}

const publicRouter = Router()
publicRouter.get('/', publicRateLimit, cachePublic(120), async (_req, res) => {
  try {
    const selection = await resolveFeaturedGameIds()
    res.json({
      data: await buildFeaturedGames(selection.ids),
      meta: {
        selected: selection.ids.length,
        manual: selection.manualIds.length,
        automatic: selection.automaticIds.length,
        mode: selection.manualIds.length ? 'MANUAL_WITH_AUTOMATIC_FILL' : 'AUTOMATIC',
      },
    })
  } catch (error) {
    res.status(500).json({ error: 'failed to load featured games', detail: String(error) })
  }
})

const adminRouter = Router()
adminRouter.use(requireAdminKey)
adminRouter.get('/', async (_req, res) => {
  const fixtureIds = await readSelection()
  res.json({ data: { fixtureIds, automaticWhenEmpty: true } })
})
adminRouter.put('/', async (req, res) => {
  const fixtureIds = cleanIds(req.body?.fixtureIds)
  if (fixtureIds.length) {
    const count = await prisma.footballFixture.count({ where: { id: { in: fixtureIds } } })
    if (count !== fixtureIds.length) return res.status(400).json({ error: 'One or more selected fixtures no longer exist' })
  }
  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: JSON.stringify(fixtureIds) },
    update: { value: JSON.stringify(fixtureIds) },
  })
  const selection = await resolveFeaturedGameIds()
  res.json({ data: { fixtureIds, automaticFixtureIds: selection.automaticIds, games: await buildFeaturedGames(selection.ids) } })
})

export { publicRouter as featuredGamesRouter, adminRouter as adminFeaturedGamesRouter }
