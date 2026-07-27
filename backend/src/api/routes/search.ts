import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { publicRateLimit } from '../middleware/rate-limit.js'
import { ensureHighlightTables } from '../../highlights/store.js'

const router = Router()
router.use(publicRateLimit)

const clean = (value: unknown, max = 120) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const score = (label: string, query: string, aliases: string[] = []) => {
  const q = norm(query), value = norm(label), values = [value, ...aliases.map(norm)]
  if (values.some(item => item === q)) return 100
  if (values.some(item => item.startsWith(q))) return 80
  if (values.some(item => item.split(' ').some(word => word.startsWith(q)))) return 60
  if (values.some(item => item.includes(q))) return 40
  return 0
}

type TeamSelectionRow = {
  id: string
  clubId: string
  clubName: string
  leagueName: string | null
  roundLabel: string
  opponentName: string | null
  matchDate: string | null
  publishedAt: string | null
}

router.get('/', async (req, res) => {
  const q = clean(req.query.q)
  if (q.length < 2) return res.json({ data: empty(), meta: { query: q, total: 0, partial: [] } })

  const partial: string[] = []
  const latestRun = await prisma.rankingRun.findFirst({ where: { status: 'COMPLETED' }, orderBy: { completedAt: 'desc' }, select: { id: true } }).catch(() => null)

  const [clubsResult, leaguesResult, playersResult, fixturesResult, resultsResult, newsResult, highlightsResult, teamSelectionsResult] = await Promise.all([
    prisma.club.findMany({
      where: {
        sport: 'FOOTBALL', isActive: true, archivedAt: null, approvalStatus: 'APPROVED',
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { shortName: { contains: q, mode: 'insensitive' } },
          { townName: { contains: q, mode: 'insensitive' } },
          { nameVariants: { some: { rawName: { contains: q, mode: 'insensitive' } } } },
        ],
      },
      take: 30,
      select: {
        id: true, name: true, shortName: true, townName: true, logoUrl: true,
        state: { select: { code: true } },
        nameVariants: { select: { rawName: true }, take: 12 },
        leagueSeasons: { where: { isActive: true, sport: 'FOOTBALL' }, orderBy: { season: 'desc' }, take: 1, select: { leagueId: true, league: { select: { name: true } } } },
      },
    }).catch(() => { partial.push('clubs'); return [] }),
    prisma.league.findMany({
      where: {
        sport: 'FOOTBALL', isActive: true, enabled: true, hidden: false, archivedAt: null,
        OR: [{ name: { contains: q, mode: 'insensitive' } }, { shortName: { contains: q, mode: 'insensitive' } }, { regionName: { contains: q, mode: 'insensitive' } }],
      },
      take: 20,
      select: { id: true, name: true, shortName: true, regionName: true, strengthScore: true, logoUrl: true, state: { select: { code: true } } },
    }).catch(() => { partial.push('leagues'); return [] }),
    prisma.footballGoalKicker.findMany({
      where: { OR: [{ playerName: { contains: q, mode: 'insensitive' } }, { clubName: { contains: q, mode: 'insensitive' } }, { leagueName: { contains: q, mode: 'insensitive' } }] },
      orderBy: [{ goals: 'desc' }, { playerName: 'asc' }], take: 20,
      select: { id: true, playerName: true, clubId: true, clubName: true, leagueId: true, leagueName: true, goals: true, season: true, club: { select: { logoUrl: true } } },
    }).catch(() => { partial.push('players'); return [] }),
    prisma.footballFixture.findMany({
      where: { OR: [{ homeName: { contains: q, mode: 'insensitive' } }, { awayName: { contains: q, mode: 'insensitive' } }, { venue: { contains: q, mode: 'insensitive' } }, { league: { name: { contains: q, mode: 'insensitive' } } }] },
      orderBy: { matchDate: 'asc' }, take: 12,
      select: { id: true, leagueId: true, homeClubId: true, awayClubId: true, homeName: true, awayName: true, matchDate: true, round: true, venue: true, league: { select: { name: true } } },
    }).catch(() => { partial.push('fixtures'); return [] }),
    prisma.footballResult.findMany({
      where: { published: true, OR: [{ homeName: { contains: q, mode: 'insensitive' } }, { awayName: { contains: q, mode: 'insensitive' } }, { venue: { contains: q, mode: 'insensitive' } }, { league: { name: { contains: q, mode: 'insensitive' } } }] },
      orderBy: { matchDate: 'desc' }, take: 12,
      select: { id: true, leagueId: true, homeClubId: true, awayClubId: true, homeName: true, awayName: true, homePoints: true, awayPoints: true, matchDate: true, round: true, venue: true, league: { select: { name: true } } },
    }).catch(() => { partial.push('results'); return [] }),
    prisma.generatedArticle.findMany({
      where: { status: 'PUBLISHED', OR: [{ title: { contains: q, mode: 'insensitive' } }, { subtitle: { contains: q, mode: 'insensitive' } }, { summary: { contains: q, mode: 'insensitive' } }, { tags: { contains: q, mode: 'insensitive' } }] },
      orderBy: { publishedAt: 'desc' }, take: 12,
      select: { slug: true, title: true, summary: true, category: true, publishedAt: true, heroSeed: true },
    }).catch(() => { partial.push('news'); return [] }),
    ensureHighlightTables().then(() => prisma.$queryRawUnsafe<Array<{ id: string; category: string; playerName: string; clubId: string | null; clubName: string; leagueId: string | null; leagueName: string | null; weekKey: string; winner: boolean }>>(`
      SELECT id, category, player_name AS "playerName", club_id AS "clubId", club_name AS "clubName",
        league_id AS "leagueId", league_name AS "leagueName", week_key AS "weekKey", winner
      FROM highlight_submissions
      WHERE status = 'APPROVED' AND (player_name ILIKE $1 OR club_name ILIKE $1 OR COALESCE(league_name, '') ILIKE $1 OR COALESCE(description, '') ILIKE $1)
      ORDER BY winner DESC, published_at DESC NULLS LAST LIMIT 12
    `, `%${q}%`)).catch(() => { partial.push('highlights'); return [] }),
    prisma.$queryRawUnsafe<TeamSelectionRow[]>(`
      SELECT s.id::text AS id, s.club_id AS "clubId", c.name AS "clubName", l.name AS "leagueName",
        s.round_label AS "roundLabel", s.opponent_name AS "opponentName", s.match_date::text AS "matchDate",
        s.published_at::text AS "publishedAt"
      FROM football_team_sheets s
      JOIN clubs c ON c.id::text = s.club_id
      LEFT JOIN leagues l ON l.id::text = s.league_id
      WHERE s.status = 'PUBLISHED'
        AND (c.name ILIKE $1 OR COALESCE(l.name, '') ILIKE $1 OR s.round_label ILIKE $1 OR COALESCE(s.opponent_name, '') ILIKE $1)
      ORDER BY s.published_at DESC NULLS LAST, s.match_date DESC NULLS LAST
      LIMIT 12
    `, `%${q}%`).catch(() => { partial.push('team-selections'); return [] }),
  ])

  const rankings = latestRun && clubsResult.length
    ? await prisma.rankingEntry.findMany({ where: { runId: latestRun.id, clubId: { in: clubsResult.map(club => club.id) } }, select: { clubId: true, rank: true, powerRating: true } }).catch(() => [])
    : []
  const rankByClub = new Map(rankings.map(row => [row.clubId, row]))

  const clubs = clubsResult.map(club => {
    const membership = club.leagueSeasons[0]
    const aliases = [club.shortName ?? '', club.townName ?? '', ...club.nameVariants.map(item => item.rawName)]
    return { id: club.id, name: club.name, logoUrl: club.logoUrl, state: club.state.code, leagueId: membership?.leagueId ?? null, leagueName: membership?.league.name ?? null, rank: rankByClub.get(club.id)?.rank ?? null, powerRating: rankByClub.get(club.id)?.powerRating ?? null, aliases, score: score(club.name, q, aliases), href: `/team/${club.id}` }
  }).sort((a, b) => b.score - a.score || (a.rank ?? 99999) - (b.rank ?? 99999)).slice(0, 12)

  const leagues = leaguesResult.map(league => ({ id: league.id, name: league.name, logoUrl: league.logoUrl, state: league.state.code, strengthScore: league.strengthScore, score: score(league.name, q, [league.shortName ?? '', league.regionName ?? '']), href: `/league/${league.id}` })).sort((a, b) => b.score - a.score || b.strengthScore - a.strengthScore).slice(0, 12)
  const players = playersResult.map(player => ({ id: player.id, name: player.playerName, clubId: player.clubId, clubName: player.clubName, leagueId: player.leagueId, leagueName: player.leagueName, goals: player.goals, season: player.season, logoUrl: player.club?.logoUrl ?? null, score: score(player.playerName, q, [player.clubName, player.leagueName]), href: `/player/${player.id}` })).sort((a, b) => b.score - a.score || b.goals - a.goals).slice(0, 12)
  const matches = [
    ...fixturesResult.map(row => ({ id: row.id, kind: 'fixture', title: `${row.homeName} v ${row.awayName}`, leagueId: row.leagueId, leagueName: row.league.name, date: row.matchDate, round: row.round, venue: row.venue, href: `/match/fixture/${row.id}?source=football` })),
    ...resultsResult.map(row => ({ id: row.id, kind: 'result', title: `${row.homeName} ${row.homePoints}–${row.awayPoints} ${row.awayName}`, leagueId: row.leagueId, leagueName: row.league.name, date: row.matchDate, round: row.round, venue: row.venue, href: `/match/result/${row.id}?source=football` })),
  ].slice(0, 16)
  const news = newsResult.map(article => ({ id: article.slug, title: article.title, summary: article.summary, category: article.category, date: article.publishedAt, heroSeed: article.heroSeed, href: `/news/${article.slug}` }))
  const highlights = highlightsResult.map(row => ({ ...row, title: `${row.playerName} — ${row.category} of the week`, href: `/highlights/${row.id}` }))
  const teamSelections = teamSelectionsResult.map(row => ({
    id: row.id,
    clubId: row.clubId,
    clubName: row.clubName,
    leagueName: row.leagueName,
    roundLabel: row.roundLabel,
    opponentName: row.opponentName,
    matchDate: row.matchDate,
    title: `${row.clubName} team selection`,
    href: `/team/${row.clubId}?tab=team-selection`,
  }))
  const records = /record|records|weekly|season|goal|goals|performance/i.test(q) ? [{ id: 'football-records', title: 'Football records', summary: 'Weekly and season club and player records.', href: '/records' }] : []
  const data = { clubs, leagues, players, matches, teamSelections, news, highlights, records }
  const total = Object.values(data).reduce((sum, rows) => sum + rows.length, 0)

  void prisma.searchQuery.create({ data: { term: q, normalizedTerm: norm(q), scope: 'ALL', resultCount: total, zeroResult: total === 0 } }).catch(() => {})
  res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120')
  res.json({ data, meta: { query: q, total, partial } })
})

function empty() { return { clubs: [], leagues: [], players: [], matches: [], teamSelections: [], news: [], highlights: [], records: [] } }

export { router as searchRouter }
