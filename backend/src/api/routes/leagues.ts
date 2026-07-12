/**
 * Leagues API Routes
 * GET /api/leagues         — all leagues with latest club counts
 * GET /api/leagues/:id     — single league detail
 */

import { Router }          from 'express'
import { prisma }          from '../../db/client.js'
import { cachePublic }     from '../middleware/cache-middleware.js'
import { publicRateLimit } from '../middleware/rate-limit.js'

const router = Router()

// GET /api/leagues
// The public directory intentionally returns every league row. Visibility/status
// fields are administrative metadata and must not hide existing leagues here.
router.get('/', publicRateLimit, cachePublic(60), async (req, res) => {
  try {
    const { state } = req.query as Record<string, string>

    const leagues = await prisma.league.findMany({
      where: state ? { state: { code: state } } : undefined,
      select: {
        id: true,
        name: true,
        strengthScore: true,
        lastSyncedAt: true,
        stateId: true,
      },
      orderBy: { name: 'asc' },
    })

    const stateIds = [...new Set(leagues.map(l => l.stateId).filter(Boolean))]
    const states = stateIds.length
      ? await prisma.state.findMany({
          where: { id: { in: stateIds } },
          select: { id: true, code: true, name: true },
        })
      : []
    const stateById = new Map(states.map(s => [s.id, s]))

    const clubCountByLeague = new Map<string, number>()
    if (leagues.length) {
      try {
        const counts = await prisma.clubLeagueSeason.groupBy({
          by: ['leagueId'],
          where: { leagueId: { in: leagues.map(l => l.id) }, isActive: true },
          _count: { _all: true },
        })
        for (const row of counts) clubCountByLeague.set(row.leagueId, row._count._all)
      } catch (err) {
        console.error('Public leagues club-count query failed; returning leagues with zero counts', err)
      }
    }

    const data = leagues.map(l => {
      const leagueState = stateById.get(l.stateId)
      return {
        id: l.id,
        name: l.name,
        state: leagueState?.code ?? '',
        stateName: leagueState?.name ?? leagueState?.code ?? '',
        strengthScore: l.strengthScore,
        sourceTypes: [],
        clubCount: clubCountByLeague.get(l.id) ?? 0,
        lastSyncedAt: l.lastSyncedAt,
      }
    })

    res.setHeader('X-PlayFooty-League-Count', String(data.length))
    res.json({ data, meta: { total: data.length } })
  } catch (err) {
    console.error('GET /api/leagues failed', err)
    res.setHeader('Cache-Control', 'no-store')
    res.status(500).json({ error: 'Unable to load leagues', detail: String(err) })
  }
})

// GET /api/leagues/search/global?q=…  → teams + leagues matching the query.
// This route must be declared before /:id so "search" is not treated as a league id.
router.get('/search/global', publicRateLimit, cachePublic(120), async (req, res) => {
  try {
    const q = String((req.query as Record<string, string>).q ?? '').trim()
    if (q.length < 2) return res.json({ data: { teams: [], leagues: [] } })

    const run = await prisma.rankingRun.findFirst({ where: { status: 'COMPLETED' }, orderBy: { completedAt: 'desc' } })
    const teams = run
      ? await prisma.rankingEntry.findMany({
          where:   { runId: run.id, clubName: { contains: q, mode: 'insensitive' as const } },
          orderBy: { rank: 'asc' },
          take:    12,
          select:  { clubId: true, clubName: true, leagueName: true, state: true, rank: true },
        })
      : []

    const leagues = await prisma.league.findMany({
      where:   { name: { contains: q, mode: 'insensitive' as const } },
      orderBy: { strengthScore: 'desc' },
      take:    12,
      select:  { id: true, name: true, strengthScore: true, state: { select: { code: true } } },
    })

    res.json({
      data: {
        teams:   teams.map(t => ({ clubId: t.clubId, clubName: t.clubName, leagueName: t.leagueName, state: t.state, rank: t.rank })),
        leagues: leagues.map(l => ({ id: l.id, name: l.name, strengthScore: l.strengthScore, state: l.state?.code ?? '' })),
      },
    })
  } catch (err) {
    console.error('GET /api/leagues/search/global failed', err)
    res.setHeader('Cache-Control', 'no-store')
    res.status(500).json({ error: 'Internal server error', detail: String(err) })
  }
})

// GET /api/leagues/:id
router.get('/:id', publicRateLimit, cachePublic(60), async (req, res) => {
  try {
    const league = await prisma.league.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        strengthScore: true,
        strengthTier: true,
        lastSyncedAt: true,
        state: { select: { code: true, name: true } },
        _count: { select: { clubSeasons: true } },
      },
    })

    if (!league) return res.status(404).json({ error: 'League not found' })

    const latestSeason = await prisma.clubLeagueSeason.findFirst({
      where: { leagueId: league.id, isActive: true },
      orderBy: { season: 'desc' },
      select: { season: true },
    })

    const ladderRows = await prisma.clubLeagueSeason.findMany({
      where: { leagueId: league.id, isActive: true, ...(latestSeason?.season ? { season: latestSeason.season } : {}) },
      orderBy: [{ position: 'asc' }, { points: 'desc' }, { club: { name: 'asc' } }],
      select: {
        clubId: true,
        played: true,
        wins: true,
        losses: true,
        draws: true,
        goalsFor: true,
        goalsAgainst: true,
        percentage: true,
        points: true,
        position: true,
        club: { select: { name: true } },
      },
    })

    res.json({
      data: {
        id: league.id,
        name: league.name,
        state: league.state?.code ?? '',
        stateName: league.state?.name ?? '',
        association: null,
        strengthScore: league.strengthScore,
        strengthTier: league.strengthTier,
        strengthConfidence: null,
        strengthReasoning: null,
        strengthCalculatedAt: null,
        regionName: null,
        currentSeason: latestSeason?.season ?? null,
        lastSyncedAt: league.lastSyncedAt,
        logoUrl: null,
        primarySource: null,
        weekLabel: null,
        totalRanked: 0,
        clubCount: league._count.clubSeasons,
        rankedTeams: [],
        ladder: ladderRows.map(r => ({
          clubId: r.clubId,
          clubName: r.club.name,
          position: r.position,
          played: r.played,
          wins: r.wins,
          losses: r.losses,
          draws: r.draws,
          goalsFor: r.goalsFor,
          goalsAgainst: r.goalsAgainst,
          percentage: r.percentage,
          points: r.points,
        })),
        sources: [],
        fixtures: [],
        results: [],
        ranking: null,
        bio: null,
      },
    })
  } catch (err) {
    console.error('GET /api/leagues/:id failed', err)
    res.setHeader('Cache-Control', 'no-store')
    res.status(500).json({ error: 'Internal server error', detail: String(err) })
  }
})

export { router as leaguesRouter }
