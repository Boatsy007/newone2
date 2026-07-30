import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { publicRateLimit } from '../middleware/rate-limit.js'
import { loadMatchDetail } from '../../results/match-detail.service.js'

const router = Router()

const roundNumber = (value: unknown) => {
  const match = String(value ?? '').match(/\d+/)
  return match ? Number(match[0]) : null
}

const normaliseName = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const dateKey = (value: Date | null | undefined) => value ? value.toISOString().slice(0, 10) : null

type FootballResultRef = {
  id: string
  published: boolean
  homeClubId: string | null
  awayClubId: string | null
  homeName: string
  awayName: string
  leagueId: string
  season: string
  round: string | null
  matchDate: Date | null
}

async function resolveFootballResult(resultId: string): Promise<FootballResultRef | null> {
  const direct = await prisma.footballResult.findUnique({
    where: { id: resultId },
    select: { id: true, published: true, homeClubId: true, awayClubId: true, homeName: true, awayName: true, leagueId: true, season: true, round: true, matchDate: true },
  })
  if (direct?.published) return direct

  // Some public result cards use the canonical MatchResult ID. Bridge that ID to
  // the corresponding footballResult so both public result systems share one
  // detailed Match Centre record.
  const canonical = await prisma.matchResult.findUnique({
    where: { id: resultId },
    select: { leagueId: true, season: true, round: true, matchDate: true, homeClubId: true, awayClubId: true, homeClubName: true, awayClubName: true },
  })
  if (!canonical) return null

  const expectedRound = canonical.round == null ? null : `Round ${canonical.round}`
  const candidates = await prisma.footballResult.findMany({
    where: {
      leagueId: canonical.leagueId,
      season: canonical.season,
      published: true,
      OR: [
        { homeClubId: canonical.homeClubId, awayClubId: canonical.awayClubId },
        { homeClubId: canonical.awayClubId, awayClubId: canonical.homeClubId },
      ],
    },
    select: { id: true, published: true, homeClubId: true, awayClubId: true, homeName: true, awayName: true, leagueId: true, season: true, round: true, matchDate: true },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  })

  return candidates.find(row => expectedRound == null || row.round === expectedRound)
    ?? candidates.find(row => dateKey(canonical.matchDate) != null && dateKey(canonical.matchDate) === dateKey(row.matchDate))
    ?? (candidates.length === 1 ? candidates[0] : null)
}

function sameTeams(a: FootballResultRef, b: FootballResultRef) {
  if (a.homeClubId && a.awayClubId && b.homeClubId && b.awayClubId) {
    return (a.homeClubId === b.homeClubId && a.awayClubId === b.awayClubId)
      || (a.homeClubId === b.awayClubId && a.awayClubId === b.homeClubId)
  }
  const aHome = normaliseName(a.homeName)
  const aAway = normaliseName(a.awayName)
  const bHome = normaliseName(b.homeName)
  const bAway = normaliseName(b.awayName)
  return (aHome === bHome && aAway === bAway) || (aHome === bAway && aAway === bHome)
}

async function resolveResultWithDetail(result: FootballResultRef) {
  const directDetail = await loadMatchDetail(result.id)
  if (directDetail) return { result, detail: directDetail }

  // Result screenshots and match-detail OCR can resolve to separate canonical
  // footballResult IDs. If the newest score row has no detail attached, continue
  // through the same league, teams, round and date until the saved detail is found.
  const candidates = await prisma.footballResult.findMany({
    where: { leagueId: result.leagueId, season: result.season, published: true, id: { not: result.id } },
    select: { id: true, published: true, homeClubId: true, awayClubId: true, homeName: true, awayName: true, leagueId: true, season: true, round: true, matchDate: true },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })

  const expectedRound = roundNumber(result.round)
  const expectedDate = dateKey(result.matchDate)
  const matching = candidates.filter(candidate => {
    if (!sameTeams(result, candidate)) return false
    const candidateRound = roundNumber(candidate.round)
    if (expectedRound != null && candidateRound != null && expectedRound !== candidateRound) return false
    const candidateDate = dateKey(candidate.matchDate)
    if (expectedDate && candidateDate && expectedDate !== candidateDate) return false
    return true
  })

  for (const candidate of matching) {
    const detail = await loadMatchDetail(candidate.id)
    if (detail) return { result: candidate, detail }
  }
  return { result, detail: null }
}

router.get('/football/:resultId', publicRateLimit, async (req, res) => {
  try {
    const requestedId = String(req.params.resultId)
    const resolved = await resolveFootballResult(requestedId)
    if (!resolved) return res.status(404).json({ error: 'result not found' })

    const { result, detail } = await resolveResultWithDetail(resolved)
    if (!detail) return res.json({ data: null })

    const bestNames = [
      ...((detail.homeBestPlayers as string[] | undefined) ?? []),
      ...((detail.awayBestPlayers as string[] | undefined) ?? []),
    ].map(name => String(name ?? '').trim()).filter(Boolean)
    const kickerNames = [
      ...((detail.homeGoalKickers as Array<{ playerName?: string }> | undefined) ?? []),
      ...((detail.awayGoalKickers as Array<{ playerName?: string }> | undefined) ?? []),
    ].map(row => String(row.playerName ?? '').trim()).filter(Boolean)
    const names = [...new Set([...bestNames, ...kickerNames])]

    const players = names.length ? await prisma.footballGoalKicker.findMany({
      where: { leagueId: result.leagueId, season: result.season, playerName: { in: names, mode: 'insensitive' } },
      select: { id: true, playerName: true, clubId: true },
    }).catch(() => []) : []
    const byName = new Map(players.map(player => [player.playerName.toLowerCase(), player]))

    const linkKickers = (rows: unknown, clubId: string | null) => (Array.isArray(rows) ? rows : []).map(value => {
      const row = value as Record<string, unknown>
      const playerName = String(row.playerName ?? '')
      const player = byName.get(playerName.toLowerCase())
      return { ...row, playerId: player && (!clubId || !player.clubId || player.clubId === clubId) ? player.id : null }
    })
    const linkBest = (rows: unknown, clubId: string | null) => (Array.isArray(rows) ? rows : []).map(value => {
      const playerName = String(value ?? '').trim()
      const player = byName.get(playerName.toLowerCase())
      return { playerName, playerId: player && (!clubId || !player.clubId || player.clubId === clubId) ? player.id : null }
    })

    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')
    res.json({
      data: {
        ...detail,
        resolvedFootballResultId: result.id,
        homeBestPlayerLinks: linkBest(detail.homeBestPlayers, result.homeClubId),
        awayBestPlayerLinks: linkBest(detail.awayBestPlayers, result.awayClubId),
        homeGoalKickers: linkKickers(detail.homeGoalKickers, result.homeClubId),
        awayGoalKickers: linkKickers(detail.awayGoalKickers, result.awayClubId),
      },
    })
  } catch (error) {
    res.status(500).json({ error: 'failed to load match details', detail: String(error) })
  }
})

export { router as matchDetailsRouter }
