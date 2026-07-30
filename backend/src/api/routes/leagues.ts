/**
 * Canonical public league API.
 * League identity and branding come from leagues.id; names in derived tables are snapshots only.
 */
import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { cachePublic } from '../middleware/cache-middleware.js'
import { publicRateLimit } from '../middleware/rate-limit.js'

const router = Router()

router.get('/', publicRateLimit, cachePublic(120), async (req, res) => {
  try {
    const { state } = req.query as Record<string, string>
    const leagues = await prisma.league.findMany({
      where: {
        sport: 'FOOTBALL', isActive: true, enabled: true, hidden: false, archivedAt: null,
        ...(state ? { state: { code: state.toUpperCase() } } : {}),
      },
      select: {
        id: true, name: true, shortName: true, logoUrl: true, regionName: true,
        strengthScore: true, strengthTier: true, currentSeason: true, lastSyncedAt: true,
        featuredLeague: true, state: { select: { code: true, name: true } },
        association: { select: { name: true } },
        _count: { select: { clubSeasons: true } },
      },
      orderBy: [{ state: { name: 'asc' } }, { name: 'asc' }],
    })
    res.json({
      data: leagues.map(league => ({
        id: league.id, name: league.name, shortName: league.shortName, logoUrl: league.logoUrl,
        state: league.state.code, stateName: league.state.name,
        association: league.association?.name ?? null, regionName: league.regionName,
        strengthScore: league.strengthScore, strengthTier: league.strengthTier,
        currentSeason: league.currentSeason, clubCount: league._count.clubSeasons,
        lastSyncedAt: league.lastSyncedAt, featuredLeague: league.featuredLeague,
      })),
      meta: { total: leagues.length, generatedAt: new Date().toISOString() },
    })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', detail: String(error) })
  }
})

router.get('/:id', publicRateLimit, cachePublic(60), async (req, res) => {
  try {
    const league = await prisma.league.findFirst({
      where: { id: req.params.id, sport: 'FOOTBALL', isActive: true, enabled: true, hidden: false, archivedAt: null },
      select: {
        id: true, name: true, shortName: true, description: true, logoUrl: true,
        websiteUrl: true, facebookUrl: true, regionName: true, featuredLeague: true,
        strengthScore: true, strengthTier: true, strengthConfidence: true,
        strengthReasoning: true, strengthCalculatedAt: true, currentSeason: true, gradeOverride: true,
        lastSyncedAt: true, lastSuccessfulSyncAt: true, primarySource: true,
        primaryDataSource: true, state: { select: { code: true, name: true } },
        association: { select: { id: true, name: true, shortName: true, logoUrl: true } },
        _count: { select: { clubSeasons: true } },
      },
    })
    if (!league) return res.status(404).json({ error: 'League not found' })

    const latestMembership = await prisma.clubLeagueSeason.findFirst({
      where: { leagueId: league.id, isActive: true },
      orderBy: [{ updatedAt: 'desc' }, { season: 'desc' }],
      select: { season: true, grade: true },
    })
    const season = league.currentSeason ?? latestMembership?.season ?? String(new Date().getFullYear())
    const grade = league.gradeOverride ?? latestMembership?.grade ?? 'Senior Football'

    const [footballLadder, legacyLadder, latestRun, fixtures, results, goalKickers] = await Promise.all([
      prisma.footballLadderEntry.findMany({
        where: { leagueId: league.id, season, grade, published: true }, orderBy: { position: 'asc' },
        select: { clubId: true, clubName: true, position: true, played: true, wins: true, losses: true, draws: true, pointsFor: true, pointsAgainst: true, percentage: true, premiershipPoints: true },
      }),
      prisma.clubLeagueSeason.findMany({
        where: { leagueId: league.id, isActive: true, season, grade },
        orderBy: [{ position: 'asc' }, { points: 'desc' }, { club: { name: 'asc' } }],
        select: { clubId: true, played: true, wins: true, losses: true, draws: true, goalsFor: true, goalsAgainst: true, percentage: true, points: true, position: true, club: { select: { name: true, logoUrl: true } } },
      }),
      prisma.rankingRun.findFirst({ where: { status: 'COMPLETED' }, orderBy: { completedAt: 'desc' }, select: { id: true, weekLabel: true, season: true, completedAt: true } }),
      prisma.footballFixture.findMany({
        where: { leagueId: league.id, season }, orderBy: [{ matchDate: 'asc' }, { round: 'asc' }], take: 100,
        select: { id: true, round: true, grade: true, homeClubId: true, awayClubId: true, homeName: true, awayName: true, matchDate: true, venue: true, verified: true },
      }),
      prisma.footballResult.findMany({
        where: { leagueId: league.id, season, published: true }, orderBy: [{ matchDate: 'desc' }, { round: 'desc' }], take: 100,
        select: { id: true, round: true, grade: true, homeClubId: true, awayClubId: true, homeName: true, awayName: true, homeGoals: true, homeBehinds: true, homePoints: true, awayGoals: true, awayBehinds: true, awayPoints: true, matchDate: true, venue: true, verified: true },
      }),
      prisma.footballGoalKicker.findMany({
        where: { leagueId: league.id, season }, orderBy: [{ goals: 'desc' }, { playerName: 'asc' }], take: 20,
        select: { id: true, playerName: true, clubId: true, clubName: true, grade: true, goals: true, matches: true, updatedAt: true, club: { select: { logoUrl: true } } },
      }),
    ])

    const publishedClubIds = [...new Set(footballLadder.flatMap(row => row.clubId ? [row.clubId] : []))]
    const publishedClubs = publishedClubIds.length
      ? await prisma.club.findMany({ where: { id: { in: publishedClubIds } }, select: { id: true, logoUrl: true } })
      : []
    const publishedLogoByClubId = new Map(publishedClubs.map(club => [club.id, club.logoUrl]))

    const rankedTeams = latestRun
      ? await prisma.rankingEntry.findMany({
          where: { runId: latestRun.id, leagueId: league.id }, orderBy: { rank: 'asc' },
          select: { clubId: true, clubName: true, rank: true, previousRank: true, rankMovement: true, powerRating: true, state: true, recentForm: true },
        })
      : []

    const usesOcrLadder = league.primaryDataSource === 'OCR_UPLOAD' || league.primarySource === 'MANUAL_IMAGE'
    const ladder = usesOcrLadder && legacyLadder.length
      ? legacyLadder.map(row => ({
          clubId: row.clubId, clubName: row.club.name, logoUrl: row.club.logoUrl,
          position: row.position, played: row.played, wins: row.wins, losses: row.losses,
          draws: row.draws, goalsFor: row.goalsFor, goalsAgainst: row.goalsAgainst,
          percentage: row.percentage, points: row.points,
        }))
      : footballLadder.length
        ? footballLadder.filter(row => row.clubId).map(row => ({
            clubId: row.clubId!, clubName: row.clubName, logoUrl: publishedLogoByClubId.get(row.clubId!) ?? null,
            position: row.position, played: row.played, wins: row.wins, losses: row.losses, draws: row.draws,
            goalsFor: row.pointsFor, goalsAgainst: row.pointsAgainst,
            percentage: row.percentage, points: row.premiershipPoints,
          }))
        : legacyLadder.map(row => ({
            clubId: row.clubId, clubName: row.club.name, logoUrl: row.club.logoUrl,
            position: row.position, played: row.played, wins: row.wins, losses: row.losses,
            draws: row.draws, goalsFor: row.goalsFor, goalsAgainst: row.goalsAgainst,
            percentage: row.percentage, points: row.points,
          }))

    res.json({
      data: {
        id: league.id, name: league.name, shortName: league.shortName, description: league.description,
        state: league.state.code, stateName: league.state.name,
        association: league.association?.name ?? null, associationId: league.association?.id ?? null,
        regionName: league.regionName, logoUrl: league.logoUrl,
        websiteUrl: league.websiteUrl, facebookUrl: league.facebookUrl,
        featuredLeague: league.featuredLeague, strengthScore: league.strengthScore,
        strengthTier: league.strengthTier, strengthConfidence: league.strengthConfidence,
        strengthReasoning: league.strengthReasoning, strengthCalculatedAt: league.strengthCalculatedAt,
        currentSeason: season, grade,
        lastSyncedAt: league.lastSuccessfulSyncAt ?? league.lastSyncedAt,
        primarySource: league.primaryDataSource ?? league.primarySource,
        weekLabel: latestRun?.weekLabel ?? null, totalRanked: rankedTeams.length,
        clubCount: league._count.clubSeasons,
        rankedTeams: rankedTeams.map(team => ({ ...team, recentForm: JSON.parse(team.recentForm || '[]'), qualified: true })),
        ladder, fixtures, results,
        goalKickers: goalKickers.map((row, index) => ({
          id: row.id, playerId: null, rank: index + 1, playerName: row.playerName,
          clubId: row.clubId, clubName: row.clubName, clubLogoUrl: row.club?.logoUrl ?? null,
          grade: row.grade, goals: row.goals, matches: row.matches, updatedAt: row.updatedAt,
        })),
        updatedAt: league.lastSuccessfulSyncAt ?? league.lastSyncedAt ?? league.strengthCalculatedAt,
      },
      meta: { generatedAt: new Date().toISOString(), canonicalLeagueId: league.id },
    })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', detail: String(error) })
  }
})

router.get('/search/global', publicRateLimit, cachePublic(120), async (req, res) => {
  try {
    const q = String((req.query as Record<string, string>).q ?? '').trim()
    if (q.length < 2) return res.json({ data: { teams: [], leagues: [] } })
    const run = await prisma.rankingRun.findFirst({ where: { status: 'COMPLETED' }, orderBy: { completedAt: 'desc' } })
    const teams = run ? await prisma.rankingEntry.findMany({
      where: { runId: run.id, clubName: { contains: q, mode: 'insensitive' }, league: { sport: 'FOOTBALL', archivedAt: null, isActive: true } },
      orderBy: { rank: 'asc' }, take: 12,
      select: { clubId: true, clubName: true, leagueName: true, state: true, rank: true },
    }) : []
    const leagues = await prisma.league.findMany({
      where: { sport: 'FOOTBALL', isActive: true, enabled: true, hidden: false, archivedAt: null, name: { contains: q, mode: 'insensitive' } },
      orderBy: { strengthScore: 'desc' }, take: 12,
      select: { id: true, name: true, strengthScore: true, state: { select: { code: true } } },
    })
    res.json({ data: { teams, leagues: leagues.map(league => ({ id: league.id, name: league.name, strengthScore: league.strengthScore, state: league.state.code })) } })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', detail: String(error) })
  }
})

export { router as leaguesRouter }
