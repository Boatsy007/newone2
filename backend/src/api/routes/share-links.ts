import { Router } from 'express'
import { prisma } from '../../db/client.js'

const router = Router()
const SITE = 'https://www.playfooty.com.au'

type ShareMeta = {
  title: string
  description: string
  label: string
  logo?: string | null
  stat1?: string | null
  stat2?: string | null
  featureStat?: string | null
  featureLabel?: string | null
}

const esc = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;')

const safePath = (value: unknown) => {
  const raw = typeof value === 'string' ? value : '/'
  return raw.startsWith('/') && !raw.startsWith('//') ? raw.slice(0, 500) : '/'
}

router.get('/', async (req, res) => {
  const path = safePath(req.query.path)
  const meta = await resolveMeta(path).catch(() => defaultMeta(path))
  const card = new URL('/api/share-card', SITE)
  card.searchParams.set('title', meta.title)
  card.searchParams.set('subtitle', meta.description)
  card.searchParams.set('label', meta.label)
  if (meta.logo) card.searchParams.set('logo', meta.logo)
  if (meta.stat1) card.searchParams.set('stat1', meta.stat1)
  if (meta.stat2) card.searchParams.set('stat2', meta.stat2)
  if (meta.featureStat) card.searchParams.set('featureStat', meta.featureStat)
  if (meta.featureLabel) card.searchParams.set('featureLabel', meta.featureLabel)
  const destination = `${SITE}${path}`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=1800')
  res.send(`<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(meta.title)}</title>
<meta name="description" content="${esc(meta.description)}">
<link rel="canonical" href="${esc(destination)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="PlayFooty">
<meta property="og:title" content="${esc(meta.title)}">
<meta property="og:description" content="${esc(meta.description)}">
<meta property="og:url" content="${esc(destination)}">
<meta property="og:image" content="${esc(card.toString())}">
<meta property="og:image:secure_url" content="${esc(card.toString())}">
<meta property="og:image:type" content="image/svg+xml">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(meta.title)}">
<meta name="twitter:description" content="${esc(meta.description)}">
<meta name="twitter:image" content="${esc(card.toString())}">
<meta http-equiv="refresh" content="0;url=${esc(destination)}">
<script>window.location.replace(${JSON.stringify(destination)})</script>
</head><body><p>Opening <a href="${esc(destination)}">${esc(meta.title)}</a>…</p></body></html>`)
})

async function resolveMeta(path: string): Promise<ShareMeta> {
  const club = path.match(/^\/team\/([^/?#]+)/)
  if (club) {
    const id = decodeURIComponent(club[1])
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
      SELECT c.name, c."logoUrl", s.code AS state,
             re.rank, re."powerRating", re."leagueName"
      FROM clubs c
      LEFT JOIN states s ON s.id = c."stateId"
      LEFT JOIN LATERAL (
        SELECT rank, "powerRating", "leagueName" FROM ranking_entries
        WHERE "clubId" = c.id ORDER BY "createdAt" DESC LIMIT 1
      ) re ON true
      WHERE c.id = $1 LIMIT 1`, id)
    const row = rows[0]
    if (row) return {
      title: `${String(row.name)} | PlayFooty Club Profile`,
      description: [row.rank ? `National rank #${row.rank}` : null, row.powerRating != null ? `Power rating ${Number(row.powerRating).toFixed(1)}` : null, row.leagueName, row.state].filter(Boolean).join(' · ') || 'Club profile, rankings, fixtures and results on PlayFooty.',
      label: 'CLUB PROFILE', logo: text(row.logoUrl),
      stat1: row.rank ? `#${row.rank} NATIONAL` : null,
      stat2: row.powerRating != null ? `${Number(row.powerRating).toFixed(1)} RATING` : null,
    }
  }

  const player = path.match(/^\/player\/([^/?#]+)/)
  if (player) {
    const id = decodeURIComponent(player[1])
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
      SELECT g.id, g."playerId", g."playerName", g.goals, g.matches, g.season, g.grade,
             g."clubName", g."leagueName", c."logoUrl",
             1 + (SELECT COUNT(*) FROM football_goal_kickers other
                  WHERE other.season = g.season AND other.goals > g.goals) AS rank,
             n.data AS "latestEventData", n."createdAt" AS "latestEventAt"
      FROM football_goal_kickers g
      LEFT JOIN clubs c ON c.id = g."clubId"
      LEFT JOIN LATERAL (
        SELECT data, "createdAt" FROM notifications
        WHERE type = 'GOAL_KICKER_UPDATED'
          AND ("entityId" = g."playerId" OR data LIKE '%"playerRowId":"' || g.id || '"%')
        ORDER BY "createdAt" DESC LIMIT 1
      ) n ON true
      WHERE g.id = $1 LIMIT 1`, id)
    const row = rows[0]
    if (row) {
      let latestGoals = 0
      let previousGoals: number | null = null
      try {
        const event = typeof row.latestEventData === 'string' ? JSON.parse(row.latestEventData) as Record<string, unknown> : null
        latestGoals = event && Number.isFinite(Number(event.weeklyGoals)) ? Number(event.weeklyGoals) : 0
        previousGoals = event && Number.isFinite(Number(event.previousGoals)) ? Number(event.previousGoals) : null
      } catch {
        latestGoals = 0
      }
      const rank = Number(row.rank)
      const goals = Number(row.goals) || 0
      const matches = row.matches == null ? null : Number(row.matches)
      const performance = latestGoals > 0 ? `${latestGoals} goals in the latest recorded game` : `${goals} season goals`
      const movement = latestGoals > 0 && previousGoals != null ? `Moved from ${previousGoals} to ${goals}` : null
      return {
        title: `${String(row.playerName)} | Goal Kicker on PlayFooty`,
        description: [performance, movement, row.clubName, row.leagueName].filter(Boolean).join(' · '),
        label: latestGoals > 0 ? 'LATEST GOAL-KICKING PERFORMANCE' : 'PLAYER PROFILE',
        logo: text(row.logoUrl),
        featureStat: latestGoals > 0 ? `+${latestGoals}` : `${goals}`,
        featureLabel: latestGoals > 0 ? 'GOALS THIS UPDATE' : 'SEASON GOALS',
        stat1: `${goals} GOALS`,
        stat2: Number.isFinite(rank) && rank > 0 ? `#${rank} NATIONAL` : matches ? `${matches} MATCHES` : null,
      }
    }
  }

  const league = path.match(/^\/league\/([^/?#]+)/)
  if (league) {
    const id = decodeURIComponent(league[1])
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT name, state, "logoUrl", "strengthScore" FROM leagues WHERE id = $1 LIMIT 1`, id)
    const row = rows[0]
    if (row) return {
      title: `${String(row.name)} | PlayFooty League Profile`,
      description: `${row.state ?? 'Australian community football'}${row.strengthScore != null ? ` · Strength ${Number(row.strengthScore).toFixed(1)}` : ''}`,
      label: 'LEAGUE PROFILE', logo: text(row.logoUrl),
      stat1: row.strengthScore != null ? `${Number(row.strengthScore).toFixed(1)} STRENGTH` : null,
    }
  }

  const match = path.match(/^\/match\/(fixture|result)\/([^/?#]+)/)
  if (match) {
    const kind = match[1]
    const encoded = decodeURIComponent(match[2])
    const [source, id] = encoded.includes(':') ? encoded.split(':', 2) : ['legacy', encoded]
    let rows: Array<Record<string, unknown>> = []
    if (source === 'football') {
      const table = kind === 'result' ? 'football_results' : 'football_fixtures'
      rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT f.*, l.name AS "leagueName" FROM ${table} f LEFT JOIN leagues l ON l.id=f."leagueId" WHERE f.id=$1 LIMIT 1`, id)
    } else {
      rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT m.*, l.name AS "leagueName", hc.name AS "homeName", ac.name AS "awayName" FROM matches m LEFT JOIN leagues l ON l.id=m."leagueId" LEFT JOIN clubs hc ON hc.id=m."homeClubId" LEFT JOIN clubs ac ON ac.id=m."awayClubId" WHERE m.id=$1 LIMIT 1`, id)
    }
    const row = rows[0]
    if (row) {
      const home = String(row.homeClubName ?? row.homeName ?? 'Home')
      const away = String(row.awayClubName ?? row.awayName ?? 'Away')
      const homeScore = row.homePoints ?? row.homeScore
      const awayScore = row.awayPoints ?? row.awayScore
      const score = kind === 'result' && homeScore != null && awayScore != null ? `${homeScore}–${awayScore}` : 'VS'
      return {
        title: `${home} ${score} ${away}`,
        description: [row.leagueName, row.round != null ? `Round ${row.round}` : null, row.venue].filter(Boolean).join(' · ') || 'Match details on PlayFooty.',
        label: kind === 'result' ? 'FINAL RESULT' : 'UPCOMING FIXTURE',
        stat1: kind === 'result' ? score : null,
      }
    }
  }

  if (path.startsWith('/rankings')) return { title: 'Australia’s National Community Football Rankings', description: 'See the latest National Top 20, club movement and power ratings on PlayFooty.', label: 'NATIONAL RANKINGS', stat1: 'TOP 20' }
  if (path.startsWith('/goal-kickers')) return { title: 'Australia’s Community Football Goal Kicking Leaders', description: 'View the leading goal kickers, clubs and leagues on PlayFooty.', label: 'GOAL KICKERS' }
  if (path.startsWith('/highlights')) return { title: 'PlayFooty Highlights', description: 'Watch and vote for Goal of the Week, Mark of the Week and the best community football moments.', label: 'HIGHLIGHTS' }
  if (path.startsWith('/matches')) return { title: 'PlayFooty Match Centre', description: 'Upcoming fixtures and recent results from community football leagues across Australia.', label: 'MATCH CENTRE' }
  if (path.startsWith('/news')) return { title: 'Latest Community Football News | PlayFooty', description: 'Rankings, match reports and stories from community football around Australia.', label: 'LATEST NEWS' }
  return defaultMeta(path)
}

function defaultMeta(_path: string): ShareMeta {
  return { title: 'PlayFooty — Australia’s Home of Community Football', description: 'Real clubs. Real rankings. Real community football.', label: 'PLAYFOOTY' }
}

function text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value : null }

export { router as shareLinksRouter }
