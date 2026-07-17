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
  const items = (await Promise.all(follows.map(buildEntityFeed))).flat().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 100)
  res.json({ data: items, meta: { follows: follows.length, total: items.length } })
})

type Follow = { entityType: 'CLUB' | 'LEAGUE' | 'PLAYER'; entityId: string }
type FeedItem = { id: string; type: string; title: string; body: string; entityType: string; entityId: string; href: string; createdAt: string }

function parseFollow(type: string): Follow | null {
  const match = /^FOLLOW_(CLUB|LEAGUE|PLAYER):(.+)$/.exec(type)
  return match ? { entityType: match[1] as Follow['entityType'], entityId: match[2] } : null
}

async function buildEntityFeed(follow: Follow): Promise<FeedItem[]> {
  try {
    if (follow.entityType === 'CLUB') return await clubFeed(follow.entityId)
    if (follow.entityType === 'LEAGUE') return await leagueFeed(follow.entityId)
    return await playerFeed(follow.entityId)
  } catch { return [] }
}

async function clubFeed(clubId: string): Promise<FeedItem[]> {
  const [club, fixtures, results, ranking] = await Promise.all([
    prisma.club.findUnique({ where: { id: clubId }, select: { name: true } }),
    prisma.footballFixture.findMany({ where: { OR: [{ homeClubId: clubId }, { awayClubId: clubId }] }, orderBy: { matchDate: 'asc' }, take: 3 }),
    prisma.footballResult.findMany({ where: { OR: [{ homeClubId: clubId }, { awayClubId: clubId }], published: true }, orderBy: { matchDate: 'desc' }, take: 3 }),
    prisma.rankingEntry.findFirst({ where: { clubId }, orderBy: { createdAt: 'desc' }, select: { rank: true, powerRating: true, createdAt: true } }).catch(() => null),
  ])
  const name = club?.name ?? 'Followed club'
  const items: FeedItem[] = []
  if (ranking) items.push({ id: `club-rank-${clubId}-${ranking.createdAt.toISOString()}`, type: 'RANKING', title: `${name} ranking update`, body: `National rank #${ranking.rank} with a ${ranking.powerRating.toFixed(1)} power rating.`, entityType: 'CLUB', entityId: clubId, href: `/team/${clubId}`, createdAt: ranking.createdAt.toISOString() })
  fixtures.forEach(row => items.push({ id: `fixture-${row.id}`, type: 'FIXTURE', title: `${row.homeName} v ${row.awayName}`, body: `${row.leagueId ? 'Upcoming fixture' : 'Fixture'}${row.round ? ` · ${row.round}` : ''}${row.venue ? ` · ${row.venue}` : ''}`, entityType: 'CLUB', entityId: clubId, href: `/match/fixture/${row.id}?source=football`, createdAt: (row.matchDate ?? row.updatedAt).toISOString() }))
  results.forEach(row => items.push({ id: `result-${row.id}`, type: 'RESULT', title: `${row.homeName} ${row.homePoints}–${row.awayPoints} ${row.awayName}`, body: `Final result${row.round ? ` · ${row.round}` : ''}`, entityType: 'CLUB', entityId: clubId, href: `/match/result/${row.id}?source=football`, createdAt: (row.matchDate ?? row.updatedAt).toISOString() }))
  return items
}

async function leagueFeed(leagueId: string): Promise<FeedItem[]> {
  const [league, fixtures, results] = await Promise.all([
    prisma.league.findUnique({ where: { id: leagueId }, select: { name: true, updatedAt: true } }),
    prisma.footballFixture.findMany({ where: { leagueId }, orderBy: { matchDate: 'asc' }, take: 5 }),
    prisma.footballResult.findMany({ where: { leagueId, published: true }, orderBy: { matchDate: 'desc' }, take: 5 }),
  ])
  const name = league?.name ?? 'Followed league'
  const items: FeedItem[] = [{ id: `league-${leagueId}`, type: 'LEAGUE', title: `${name} updates`, body: 'Fixtures, results and ladder updates from this competition.', entityType: 'LEAGUE', entityId: leagueId, href: `/league/${leagueId}`, createdAt: (league?.updatedAt ?? new Date(0)).toISOString() }]
  fixtures.forEach(row => items.push({ id: `fixture-${row.id}`, type: 'FIXTURE', title: `${row.homeName} v ${row.awayName}`, body: `${name}${row.round ? ` · ${row.round}` : ''}`, entityType: 'LEAGUE', entityId: leagueId, href: `/match/fixture/${row.id}?source=football`, createdAt: (row.matchDate ?? row.updatedAt).toISOString() }))
  results.forEach(row => items.push({ id: `result-${row.id}`, type: 'RESULT', title: `${row.homeName} ${row.homePoints}–${row.awayPoints} ${row.awayName}`, body: `${name} final result`, entityType: 'LEAGUE', entityId: leagueId, href: `/match/result/${row.id}?source=football`, createdAt: (row.matchDate ?? row.updatedAt).toISOString() }))
  return items
}

async function playerFeed(playerId: string): Promise<FeedItem[]> {
  const player = await prisma.footballGoalKicker.findUnique({ where: { id: playerId } })
  if (!player) return []
  return [{ id: `player-${player.id}-${player.updatedAt.toISOString()}`, type: 'PLAYER', title: `${player.playerName} goal-kicking update`, body: `${player.goals} goals${player.matches ? ` from ${player.matches} matches` : ''} for ${player.clubName}.`, entityType: 'PLAYER', entityId: playerId, href: `/player/${playerId}`, createdAt: player.updatedAt.toISOString() }]
}

export { router as followsRouter }
