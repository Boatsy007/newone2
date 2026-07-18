import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { publicRateLimit } from '../middleware/rate-limit.js'

const router = Router()
router.use(publicRateLimit)

const entityTypes = new Set(['CLUB', 'LEAGUE', 'PLAYER'])
const supporterId = (value: unknown) => typeof value === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(value) ? value : null
const followType = (entityType: string, entityId: string) => `FOLLOW_${entityType}:${entityId}`

router.get('/', async (req, res) => {
  const id = supporterId(req.query.supporterId)
  if (!id) return res.status(400).json({ error: 'valid supporterId required' })
  const rows = await prisma.notificationPreference.findMany({
    where: { recipientScope: 'USER', recipientId: id, type: { startsWith: 'FOLLOW_' }, enabled: true },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ data: rows.map(row => parseFollow(row.type)).filter(Boolean) })
})

router.post('/', async (req, res) => {
  const b = (req.body ?? {}) as { supporterId?: string; entityType?: string; entityId?: string }
  const id = supporterId(b.supporterId)
  const entityType = String(b.entityType ?? '').toUpperCase()
  const entityId = String(b.entityId ?? '').trim()
  if (!id || !entityTypes.has(entityType) || !entityId || entityId.length > 120) return res.status(400).json({ error: 'valid supporterId, entityType and entityId required' })
  const type = followType(entityType, entityId)
  const row = await prisma.notificationPreference.upsert({
    where: { recipientScope_recipientId_type_channel: { recipientScope: 'USER', recipientId: id, type, channel: 'IN_APP' } },
    create: { recipientScope: 'USER', recipientId: id, type, channel: 'IN_APP', enabled: true, frequency: 'INSTANT', ...(entityType === 'CLUB' ? { clubId: entityId } : {}), ...(entityType === 'LEAGUE' ? { leagueId: entityId } : {}) },
    update: { enabled: true },
  })
  res.status(201).json({ data: { id: row.id, entityType, entityId } })
})

router.delete('/:entityType/:entityId', async (req, res) => {
  const id = supporterId(req.query.supporterId)
  const entityType = String(req.params.entityType ?? '').toUpperCase()
  const entityId = String(req.params.entityId ?? '')
  if (!id || !entityTypes.has(entityType) || !entityId) return res.status(400).json({ error: 'valid supporterId and follow required' })
  await prisma.notificationPreference.deleteMany({ where: { recipientScope: 'USER', recipientId: id, type: followType(entityType, entityId), channel: 'IN_APP' } })
  res.json({ data: { removed: true } })
})

router.get('/feed', async (req, res) => {
  const id = supporterId(req.query.supporterId)
  if (!id) return res.status(400).json({ error: 'valid supporterId required' })
  const prefs = await prisma.notificationPreference.findMany({ where: { recipientScope: 'USER', recipientId: id, type: { startsWith: 'FOLLOW_' }, enabled: true } })
  const follows = prefs.map(row => parseFollow(row.type)).filter((row): row is Follow => !!row)
  if (!follows.length) return res.json({ data: [], meta: { follows: 0, total: 0, persistent: 0 } })

  const [persistent, fallback] = await Promise.all([
    persistentFeed(follows),
    Promise.all(follows.map(buildEntityFeed)).then(items => items.flat()),
  ])
  const seen = new Set<string>()
  const items = [...persistent, ...fallback]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .filter(item => {
      const key = `${item.type}|${item.title}|${item.href}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 100)
  res.json({ data: items, meta: { follows: follows.length, total: items.length, persistent: persistent.length } })
})

type Follow = { entityType: 'CLUB' | 'LEAGUE' | 'PLAYER'; entityId: string }
type FeedItem = { id: string; type: string; title: string; body: string; entityType: string; entityId: string; href: string; createdAt: string }

function parseFollow(type: string): Follow | null {
  const match = /^FOLLOW_(CLUB|LEAGUE|PLAYER):(.+)$/.exec(type)
  return match ? { entityType: match[1] as Follow['entityType'], entityId: match[2] } : null
}

async function persistentFeed(follows: Follow[]): Promise<FeedItem[]> {
  const rows = await prisma.notification.findMany({
    where: {
      recipientScope: 'PLATFORM',
      category: 'FEED',
      status: { not: 'SUPPRESSED' },
      OR: follows.map(follow => ({ entityType: follow.entityType, entityId: follow.entityId })),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return rows.map(row => {
    let data: { href?: string } = {}
    try { data = row.data ? JSON.parse(row.data) as { href?: string } : {} } catch { data = {} }
    return {
      id: `event-${row.id}`,
      type: row.type,
      title: row.title,
      body: row.body ?? '',
      entityType: row.entityType ?? 'PLATFORM',
      entityId: row.entityId ?? '',
      href: data.href ?? '/',
      createdAt: row.createdAt.toISOString(),
    }
  })
}

async function buildEntityFeed(follow: Follow): Promise<FeedItem[]> {
  try {
    if (follow.entityType === 'CLUB') return await clubFeed(follow.entityId)
    if (follow.entityType === 'LEAGUE') return await leagueFeed(follow.entityId)
    return await playerFeed(follow.entityId)
  } catch { return [] }
}

function resultHeadline(homeName: string, homePoints: number, awayName: string, awayPoints: number) {
  if (homePoints === awayPoints) return `${homeName} drew with ${awayName}, ${homePoints}–${awayPoints}`
  return homePoints > awayPoints
    ? `${homeName} defeated ${awayName}, ${homePoints}–${awayPoints}`
    : `${awayName} defeated ${homeName}, ${awayPoints}–${homePoints}`
}

async function clubFeed(clubId: string): Promise<FeedItem[]> {
  const [club, fixtures, results, ranking] = await Promise.all([
    prisma.club.findUnique({ where: { id: clubId }, select: { name: true } }),
    prisma.footballFixture.findMany({ where: { OR: [{ homeClubId: clubId }, { awayClubId: clubId }] }, orderBy: { matchDate: 'asc' }, take: 3 }),
    prisma.footballResult.findMany({ where: { OR: [{ homeClubId: clubId }, { awayClubId: clubId }], published: true }, orderBy: { matchDate: 'desc' }, take: 5 }),
    prisma.rankingEntry.findFirst({ where: { clubId }, orderBy: { createdAt: 'desc' }, select: { rank: true, powerRating: true, createdAt: true } }).catch(() => null),
  ])
  const name = club?.name ?? 'Followed club'
  const items: FeedItem[] = []
  if (ranking) items.push({ id: `club-rank-${clubId}-${ranking.createdAt.toISOString()}`, type: 'RANKING', title: `${name} are ranked #${ranking.rank} nationally`, body: `Their latest PlayFooty power rating is ${ranking.powerRating.toFixed(1)}.`, entityType: 'CLUB', entityId: clubId, href: `/team/${clubId}`, createdAt: ranking.createdAt.toISOString() })
  fixtures.forEach(row => items.push({ id: `fixture-${row.id}`, type: 'FIXTURE', title: `${name}'s next match: ${row.homeName} v ${row.awayName}`, body: `${row.round ? `${row.round} · ` : ''}${row.venue ?? 'Venue to be confirmed'}`, entityType: 'CLUB', entityId: clubId, href: `/match/fixture/${row.id}?source=football`, createdAt: (row.matchDate ?? row.updatedAt).toISOString() }))
  results.forEach(row => items.push({ id: `result-${row.id}`, type: 'RESULT', title: resultHeadline(row.homeName, row.homePoints, row.awayName, row.awayPoints), body: `${row.round ? `${row.round} · ` : ''}Final score`, entityType: 'CLUB', entityId: clubId, href: `/match/result/${row.id}?source=football`, createdAt: (row.matchDate ?? row.updatedAt).toISOString() }))
  return items
}

async function leagueFeed(leagueId: string): Promise<FeedItem[]> {
  const [league, fixtures, results] = await Promise.all([
    prisma.league.findUnique({ where: { id: leagueId }, select: { name: true, updatedAt: true } }),
    prisma.footballFixture.findMany({ where: { leagueId }, orderBy: { matchDate: 'asc' }, take: 8 }),
    prisma.footballResult.findMany({ where: { leagueId, published: true }, orderBy: { matchDate: 'desc' }, take: 20 }),
  ])
  const name = league?.name ?? 'Followed league'
  const items: FeedItem[] = []
  const latestRound = results.find(row => row.round)?.round ?? null
  const latestRoundResults = latestRound ? results.filter(row => row.round === latestRound) : results.slice(0, 5)
  if (latestRoundResults.length) {
    const newest = latestRoundResults.reduce((latest, row) => {
      const value = row.matchDate ?? row.updatedAt
      return value > latest ? value : latest
    }, new Date(0))
    items.push({ id: `league-results-${leagueId}-${latestRound ?? 'latest'}-${newest.toISOString()}`, type: 'LEAGUE_RESULTS', title: `${name} results are in${latestRound ? ` for ${latestRound}` : ''}`, body: `${latestRoundResults.length} final result${latestRoundResults.length === 1 ? '' : 's'} available.`, entityType: 'LEAGUE', entityId: leagueId, href: `/matches?league=${encodeURIComponent(leagueId)}&tab=results`, createdAt: newest.toISOString() })
  }
  const nextRound = fixtures.find(row => row.round)?.round ?? null
  const nextRoundFixtures = nextRound ? fixtures.filter(row => row.round === nextRound) : fixtures.slice(0, 5)
  if (nextRoundFixtures.length) {
    const first = nextRoundFixtures[0]
    items.push({ id: `league-fixtures-${leagueId}-${nextRound ?? 'next'}-${first.updatedAt.toISOString()}`, type: 'LEAGUE_FIXTURES', title: `${name} fixtures are set${nextRound ? ` for ${nextRound}` : ''}`, body: `${nextRoundFixtures.length} upcoming match${nextRoundFixtures.length === 1 ? '' : 'es'} listed.`, entityType: 'LEAGUE', entityId: leagueId, href: `/matches?league=${encodeURIComponent(leagueId)}&tab=fixtures`, createdAt: (first.matchDate ?? first.updatedAt).toISOString() })
  }
  results.slice(0, 5).forEach(row => items.push({ id: `result-${row.id}`, type: 'RESULT', title: resultHeadline(row.homeName, row.homePoints, row.awayName, row.awayPoints), body: `${name}${row.round ? ` · ${row.round}` : ''}`, entityType: 'LEAGUE', entityId: leagueId, href: `/match/result/${row.id}?source=football`, createdAt: (row.matchDate ?? row.updatedAt).toISOString() }))
  return items
}

async function playerFeed(playerId: string): Promise<FeedItem[]> {
  const player = await prisma.footballGoalKicker.findUnique({ where: { id: playerId } })
  if (!player) return []
  return [{ id: `player-${player.id}-${player.updatedAt.toISOString()}`, type: 'PLAYER', title: `${player.playerName} has moved to ${player.goals} goals`, body: `${player.matches ? `${player.goals} goals from ${player.matches} matches` : `${player.goals} goals this season`} for ${player.clubName} in ${player.leagueName}.`, entityType: 'PLAYER', entityId: playerId, href: `/player/${playerId}`, createdAt: player.updatedAt.toISOString() }]
}

export { router as followsRouter }
