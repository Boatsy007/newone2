import { Router }          from 'express'
import { prisma }          from '../../db/client.js'
import { cachePublic }     from '../middleware/cache-middleware.js'
import { publicRateLimit } from '../middleware/rate-limit.js'

const router = Router()

router.get('/', publicRateLimit, cachePublic(600), async (req, res) => {
  try {
    const { state, league, season } = req.query as Record<string, string>
    const clubWhere = {
      sport: 'FOOTBALL', archivedAt: null, isActive: true,
      ...(state ? { state: { code: state } } : {}),
      leagueSeasons: { some: { isActive: true, ...(season ? { season } : {}), league: { sport: 'FOOTBALL', archivedAt: null, isActive: true, ...(league ? { name: { contains: league, mode: 'insensitive' as const } } : {}) } } },
    }
    const runs = await prisma.rankingRun.findMany({ where: { status: 'COMPLETED', ...(season ? { season } : {}) }, orderBy: { completedAt: 'desc' }, take: 25 })
    let run = null as (typeof runs)[number] | null
    for (const candidate of runs) {
      const visibleRows = await prisma.rankingEntry.count({ where: { runId: candidate.id, league: { sport: 'FOOTBALL', archivedAt: null, isActive: true }, club: { sport: 'FOOTBALL', archivedAt: null, isActive: true } } })
      if (visibleRows > 0) { run = candidate; break }
    }
    if (!run) {
      const clubs = await prisma.club.findMany({ where: clubWhere, select: { id: true, name: true, state: { select: { code: true } }, leagueSeasons: { where: { isActive: true, league: { sport: 'FOOTBALL', archivedAt: null, isActive: true } }, select: { league: { select: { name: true } } }, take: 1 } }, orderBy: { name: 'asc' }, take: 200 })
      return res.json({ data: clubs.map(c => ({ clubId: c.id, clubName: c.name, leagueName: c.leagueSeasons[0]?.league?.name ?? '—', state: c.state?.code ?? '—', rank: null, powerRating: null, logoUrl: null })), meta: { weekLabel: null, season: season ?? null, total: clubs.length, source: 'clubs' } })
    }
    const entries = await prisma.rankingEntry.findMany({ where: { runId: run.id, league: { sport: 'FOOTBALL', archivedAt: null, isActive: true }, club: { sport: 'FOOTBALL', archivedAt: null, isActive: true }, ...(state ? { state } : {}), ...(league ? { leagueName: { contains: league, mode: 'insensitive' as const } } : {}) }, orderBy: { rank: 'asc' }, take: 200 })
    if (entries.length === 0) {
      const clubs = await prisma.club.findMany({ where: clubWhere, select: { id: true, name: true, state: { select: { code: true } }, leagueSeasons: { where: { isActive: true, league: { sport: 'FOOTBALL', archivedAt: null, isActive: true } }, select: { league: { select: { name: true } } }, take: 1 } }, orderBy: { name: 'asc' }, take: 200 })
      return res.json({ data: clubs.map((c, index) => ({ clubId: c.id, clubName: c.name, leagueName: c.leagueSeasons[0]?.league?.name ?? '—', state: c.state?.code ?? '—', rank: index + 1, powerRating: null, logoUrl: null })), meta: { weekLabel: run.weekLabel, season: run.season, total: clubs.length, source: 'clubs-fallback' } })
    }
    res.json({ data: entries.map(e => ({ clubId: e.clubId, clubName: e.clubName, leagueName: e.leagueName, state: e.state, rank: e.rank, powerRating: e.powerRating, logoUrl: null })), meta: { weekLabel: run.weekLabel, season: run.season, total: entries.length, source: 'rankings' } })
  } catch { res.status(500).json({ error: 'Internal server error' }) }
})

const QUALIFY_CUTOFF = 32

router.get('/:id', publicRateLimit, cachePublic(600), async (req, res) => {
  try {
    const clubId = req.params.id
    const club = await prisma.club.findFirst({ where: { id: clubId, sport: 'FOOTBALL', archivedAt: null, isActive: true }, select: { id: true, name: true, region: true, state: { select: { code: true, name: true } } } })
    const cls = await prisma.clubLeagueSeason.findFirst({ where: { clubId, isActive: true, league: { sport: 'FOOTBALL', archivedAt: null, isActive: true } }, orderBy: { season: 'desc' }, select: { leagueId: true, season: true, played: true, wins: true, losses: true, draws: true, goalsFor: true, goalsAgainst: true, percentage: true, points: true, league: { select: { id: true, name: true, strengthScore: true, strengthTier: true } } } })
    if (!club && !cls) return res.status(404).json({ error: 'Club not found' })

    let currentEntry: any = null
    try {
      currentEntry = await prisma.rankingEntry.findFirst({ where: { clubId, league: { sport: 'FOOTBALL', archivedAt: null, isActive: true } }, orderBy: { rankingRun: { completedAt: 'desc' } }, select: { rank: true, previousRank: true, rankMovement: true, powerRating: true, clubName: true, leagueId: true, leagueName: true, state: true, recentForm: true, componentScores: true, rankingRun: { select: { weekLabel: true, season: true, completedAt: true } } } })
    } catch { currentEntry = null }

    const leagueId = currentEntry?.leagueId ?? cls?.leagueId ?? null
    const season = currentEntry?.rankingRun.season ?? cls?.season ?? null
    const clubName = currentEntry?.clubName ?? club?.name ?? 'Unknown Club'
    const ladderRows = leagueId && season ? await prisma.clubLeagueSeason.findMany({ where: { leagueId, season, isActive: true }, orderBy: [{ points: 'desc' }, { percentage: 'desc' }, { club: { name: 'asc' } }], select: { clubId: true, played: true, wins: true, losses: true, draws: true, percentage: true, points: true, club: { select: { name: true } } } }) : []

    let recentForm: unknown[] = []
    let componentScores: Record<string, unknown> = {}
    if (currentEntry) {
      try { recentForm = JSON.parse(currentEntry.recentForm || '[]') } catch { recentForm = [] }
      try { componentScores = JSON.parse(currentEntry.componentScores || '{}') } catch { componentScores = {} }
    }

    const leadingGoalKicker = season ? await prisma.footballGoalKicker.findFirst({
      where: { season, ...(leagueId ? { leagueId } : {}), OR: [{ clubId }, { clubName: { equals: clubName, mode: 'insensitive' } }] },
      orderBy: [{ goals: 'desc' }, { playerName: 'asc' }],
      select: { playerName: true, goals: true, matches: true, clubName: true, leagueName: true },
    }) : null

    const rank = currentEntry?.rank ?? null
    const league = cls?.league ?? null
    const ladderIndex = ladderRows.findIndex(r => r.clubId === clubId)

    res.json({ data: {
      clubId, clubName, leagueId, leagueName: currentEntry?.leagueName ?? league?.name ?? null, state: currentEntry?.state ?? club?.state?.code ?? null,
      rank, previousRank: currentEntry?.previousRank ?? null, rankMovement: currentEntry?.rankMovement ?? 0, powerRating: currentEntry?.powerRating ?? null,
      ranked: !!currentEntry, qualified: rank != null && rank <= QUALIFY_CUTOFF, qualifyCutoff: QUALIFY_CUTOFF,
      record: { wins: cls?.wins ?? 0, losses: cls?.losses ?? 0, draws: cls?.draws ?? 0, played: cls?.played ?? 0 }, goalsFor: cls?.goalsFor ?? 0,
      goalsAgainst: cls?.goalsAgainst ?? 0, percentage: cls?.percentage ?? 0, ladderPosition: ladderIndex >= 0 ? ladderIndex + 1 : null,
      leagueStrengthScore: league?.strengthScore ?? null, leagueStrengthTier: league?.strengthTier ?? null,
      recentForm, componentScores, weekLabel: currentEntry?.rankingRun.weekLabel ?? null, season,
      history: [], town: null, region: club?.region ?? null, stateName: club?.state?.name ?? null, logoUrl: null,
      primaryColour: null, secondaryColour: null, websiteUrl: null, facebookUrl: null, instagramUrl: null, bio: null,
      ranking: rank == null ? null : { rank, powerRating: currentEntry?.powerRating ?? null, movement: currentEntry?.rankMovement ?? null },
      leadingGoalKicker, fixtures: [], results: [], teams: [],
      ladder: ladderRows.map((r, index) => ({ clubId: r.clubId, clubName: r.club.name, position: index + 1, played: r.played, wins: r.wins, losses: r.losses, draws: r.draws, percentage: r.percentage, points: r.points, isThisClub: r.clubId === clubId })),
    } })
  } catch (err) { res.status(500).json({ error: 'Internal server error', detail: String(err) }) }
})

router.get('/history/:clubId', publicRateLimit, cachePublic(3600), async (req, res) => {
  try {
    const { clubId } = req.params
    const { season } = req.query as Record<string, string>
    const limit = Math.min(parseInt(String(req.query.limit), 10) || 52, 52)
    const history = await prisma.rankingEntry.findMany({ where: { clubId, ...(season ? { rankingRun: { season } } : {}), league: { sport: 'FOOTBALL', archivedAt: null, isActive: true } }, orderBy: { rankingRun: { completedAt: 'desc' } }, take: limit, include: { rankingRun: { select: { weekLabel: true, season: true, completedAt: true } } } })
    if (history.length === 0) return res.status(404).json({ error: 'No history found for this club' })
    res.json({ data: history.map(h => ({ weekLabel: h.rankingRun.weekLabel, season: h.rankingRun.season, rank: h.rank, powerRating: h.powerRating, rankMovement: h.rankMovement, date: h.rankingRun.completedAt })), meta: { clubId, total: history.length } })
  } catch { res.status(500).json({ error: 'Internal server error' }) }
})

export { router as clubsRouter }
