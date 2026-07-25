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
    const ids = await readSelection()
    res.json({ data: await buildFeaturedGames(ids), meta: { selected: ids.length } })
  } catch (error) {
    res.status(500).json({ error: 'failed to load featured games', detail: String(error) })
  }
})

const adminRouter = Router()
adminRouter.use(requireAdminKey)
adminRouter.get('/', async (_req, res) => {
  const fixtureIds = await readSelection()
  res.json({ data: { fixtureIds } })
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
  res.json({ data: { fixtureIds, games: await buildFeaturedGames(fixtureIds) } })
})

export { publicRouter as featuredGamesRouter, adminRouter as adminFeaturedGamesRouter }
