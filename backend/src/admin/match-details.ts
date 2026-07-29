import { Router } from 'express'
import { prisma } from '../db/client.js'
import { requireAdminKey } from '../api/middleware/auth.js'
import { loadMatchDetail, saveMatchDetail } from '../results/match-detail.service.js'
import { parseMatchDetailImage, parseTeamGoalKickerImage, type ParsedMatchDetail } from '../ocr/parse-match-detail-image.js'
import { fuzzyMatchClub, similarity } from '../ocr/fuzzy-match.js'
import { importResults } from '../results/results.service.js'
import { publishApprovedMatchImport, type ApprovedMatchRow } from '../results/post-import.service.js'

const router = Router()
router.use(requireAdminKey)

const roundNumber = (value: unknown) => {
  const match = String(value ?? '').match(/\d+/)
  return match ? Number(match[0]) : null
}
const sameDay = (a: Date | null, b: string | null) => {
  if (!a || !b) return false
  const date = new Date(b)
  return !Number.isNaN(date.getTime()) && a.toISOString().slice(0, 10) === date.toISOString().slice(0, 10)
}
const resultPayload = (row: any) => ({
  id: row.id, leagueId: row.leagueId, leagueName: row.league?.name ?? row.leagueName,
  season: row.season, grade: row.grade, round: row.round, matchDate: row.matchDate,
  homeClubId: row.homeClubId, homeName: row.homeName, awayClubId: row.awayClubId, awayName: row.awayName,
  homeGoals: row.homeGoals, homeBehinds: row.homeBehinds, homePoints: row.homePoints,
  awayGoals: row.awayGoals, awayBehinds: row.awayBehinds, awayPoints: row.awayPoints,
  detailUrl: `/match/result/${encodeURIComponent(row.id)}?source=football`,
})

type ResolveFailure = Error & { fallbackRequired?: boolean }
const fail = (message: string, fallbackRequired = true): never => {
  const error = new Error(message) as ResolveFailure
  error.fallbackRequired = fallbackRequired
  throw error
}

type ConfirmedMatch = {
  leagueId?: string | null
  homeClubId?: string | null
  awayClubId?: string | null
  round?: number | string | null
  season?: string | null
  grade?: string | null
  matchDate?: string | null
}

async function resolveOrCreateResult(parsed: ParsedMatchDetail, fallbackResultId?: string | null, confirmed: ConfirmedMatch = {}) {
  if (fallbackResultId) {
    const selected = await prisma.footballResult.findUnique({ where: { id: fallbackResultId }, include: { league: { select: { name: true } } } })
    if (!selected || !selected.published) fail('The selected result no longer exists.')
    return { action: 'matched' as const, result: selected, confidence: 1 }
  }

  if (!parsed?.homeTeam || !parsed?.awayTeam) fail('Both team names are required to publish this match.')

  const leagues = await prisma.league.findMany({
    where: { isActive: true, archivedAt: null },
    include: { association: { select: { name: true } } },
  })

  let league = confirmed.leagueId ? leagues.find(item => item.id === confirmed.leagueId) ?? null : null
  let leagueScore = league ? 1 : 0
  if (!league) {
    for (const candidate of leagues) {
      const score = Math.max(
        similarity(parsed.league ?? '', candidate.name),
        similarity(parsed.league ?? '', candidate.association?.name ?? ''),
      )
      if (score > leagueScore) { league = candidate; leagueScore = score }
    }
  }
  if (!league || leagueScore < 0.6) fail('Choose the league before publishing.')

  const clubs = await prisma.club.findMany({
    where: { archivedAt: null, isActive: true, leagueSeasons: { some: { leagueId: league.id, isActive: true } } },
    select: { id: true, name: true },
  })

  const confirmedHome = confirmed.homeClubId ? clubs.find(item => item.id === confirmed.homeClubId) ?? null : null
  const confirmedAway = confirmed.awayClubId ? clubs.find(item => item.id === confirmed.awayClubId) ?? null : null
  const homeMatch = confirmedHome ? { clubId: confirmedHome.id, matchedName: confirmedHome.name, score: 1, confident: true } : fuzzyMatchClub(parsed.homeTeam, clubs)
  const awayMatch = confirmedAway ? { clubId: confirmedAway.id, matchedName: confirmedAway.name, score: 1, confident: true } : fuzzyMatchClub(parsed.awayTeam, clubs)

  if (!homeMatch.confident || !awayMatch.confident || !homeMatch.clubId || !awayMatch.clubId) {
    fail('Choose both teams before publishing.')
  }
  if (homeMatch.clubId === awayMatch.clubId) fail('Home and away teams must be different.')

  const round = roundNumber(confirmed.round ?? parsed.round)
  const selectedDate = String(confirmed.matchDate ?? parsed.matchDate ?? '').trim() || null
  const currentSeason = (await prisma.setting.findUnique({ where: { key: 'currentSeason' } }).catch(() => null))?.value
  const season = String(confirmed.season ?? '').trim()
    || parsed.season?.trim()
    || (selectedDate && !Number.isNaN(new Date(selectedDate).getTime()) ? String(new Date(selectedDate).getFullYear()) : '')
    || currentSeason
    || String(new Date().getFullYear())
  const grade = String(confirmed.grade ?? '').trim() || parsed.grade?.trim() || 'Senior Football'

  const pairResults = await prisma.footballResult.findMany({
    where: {
      leagueId: league.id,
      season,
      published: true,
      OR: [
        { homeClubId: homeMatch.clubId, awayClubId: awayMatch.clubId },
        { homeClubId: awayMatch.clubId, awayClubId: homeMatch.clubId },
      ],
    },
    include: { league: { select: { name: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  })
  const existing = pairResults.find(row =>
    (round == null || row.round === `Round ${round}`) && (!selectedDate || sameDay(row.matchDate, selectedDate)),
  ) ?? pairResults.find(row => round != null && row.round === `Round ${round}`)

  if (existing) return { action: 'matched' as const, result: existing, confidence: Math.min(homeMatch.score, awayMatch.score, leagueScore) }

  if (![parsed.homeScore, parsed.awayScore].every(value => typeof value === 'number' && Number.isFinite(value))) {
    fail('Final scores are required to create a new result from this detailed screenshot.')
  }

  const approved: ApprovedMatchRow = {
    round: round ?? undefined,
    grade,
    matchDate: selectedDate,
    matchTime: parsed.matchTime,
    venue: parsed.venue,
    homeTeam: homeMatch.matchedName ?? parsed.homeTeam,
    awayTeam: awayMatch.matchedName ?? parsed.awayTeam,
    homeClubId: homeMatch.clubId,
    awayClubId: awayMatch.clubId,
    homeGoals: parsed.homeGoals ?? undefined,
    homeBehinds: parsed.homeBehinds ?? undefined,
    homeScore: parsed.homeScore!,
    awayGoals: parsed.awayGoals ?? undefined,
    awayBehinds: parsed.awayBehinds ?? undefined,
    awayScore: parsed.awayScore!,
    status: 'FINAL',
  }

  const imported = await importResults([{
    leagueId: league.id,
    leagueName: league.name,
    season,
    grade,
    round: round ?? undefined,
    matchDate: selectedDate ?? undefined,
    homeClubId: homeMatch.clubId,
    homeClubName: approved.homeTeam,
    awayClubId: awayMatch.clubId,
    awayClubName: approved.awayTeam,
    homeScore: parsed.homeScore!,
    awayScore: parsed.awayScore!,
    status: 'FINAL',
  }], 'OCR', { raiseReview: true })
  if (imported.invalid > 0) fail(imported.errors[0]?.errors?.join(', ') || 'The result failed validation.')

  await publishApprovedMatchImport({
    kind: 'results', leagueId: league.id, leagueName: league.name, season, grade,
    rows: [approved], actor: 'match-details-ocr',
  })

  const created = await prisma.footballResult.findFirst({
    where: {
      leagueId: league.id,
      season,
      published: true,
      ...(round == null ? {} : { round: `Round ${round}` }),
      OR: [
        { homeClubId: homeMatch.clubId, awayClubId: awayMatch.clubId },
        { homeClubId: awayMatch.clubId, awayClubId: homeMatch.clubId },
      ],
    },
    include: { league: { select: { name: true } } },
    orderBy: { updatedAt: 'desc' },
  })
  if (!created) fail('The result was created but could not be reloaded.', false)
  return { action: 'created' as const, result: created, confidence: Math.min(homeMatch.score, awayMatch.score, leagueScore) }
}

router.get('/options', async (_req, res) => {
  try {
    const leagues = await prisma.league.findMany({
      where: { isActive: true, archivedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, currentSeason: true,
        clubSeasons: {
          where: { isActive: true },
          select: { season: true, grade: true, club: { select: { id: true, name: true } } },
          orderBy: { club: { name: 'asc' } },
        },
      },
    })
    res.json({ data: leagues.map(league => ({
      id: league.id,
      name: league.name,
      currentSeason: league.currentSeason,
      clubs: [...new Map(league.clubSeasons.map(row => [row.club.id, row.club])).values()],
      seasons: [...new Set(league.clubSeasons.map(row => row.season).filter(Boolean))],
      grades: [...new Set(league.clubSeasons.map(row => row.grade).filter(Boolean))],
    })) })
  } catch (error) { res.status(500).json({ error: 'Unable to load league and club options', detail: String(error) }) }
})

router.get('/results', async (req, res) => {
  try {
    const leagueId = String(req.query.leagueId ?? '').trim()
    const season = String(req.query.season ?? '').trim()
    const rows = await prisma.footballResult.findMany({
      where: { published: true, ...(leagueId ? { leagueId } : {}), ...(season ? { season } : {}) },
      orderBy: [{ matchDate: 'desc' }, { round: 'desc' }, { updatedAt: 'desc' }],
      take: 250,
      include: { league: { select: { name: true } } },
    })
    res.json({ data: rows.map(resultPayload) })
  } catch (error) { res.status(500).json({ error: 'Unable to list detailed results', detail: String(error) }) }
})

router.post('/ocr', async (req, res) => {
  try {
    const image = typeof req.body?.image === 'string' ? req.body.image : ''
    if (!image) return res.status(400).json({ error: 'image required' })
    res.json({ data: await parseMatchDetailImage(image) })
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : 'Match detail OCR failed' }) }
})
router.post('/ocr/goal-kickers', async (req, res) => {
  try {
    const image = typeof req.body?.image === 'string' ? req.body.image : ''
    if (!image) return res.status(400).json({ error: 'image required' })
    res.json({ data: await parseTeamGoalKickerImage(image) })
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : 'Goal kicker OCR failed' }) }
})

router.post('/resolve', async (req, res) => {
  try {
    const resolved = await resolveOrCreateResult((req.body?.match ?? req.body) as ParsedMatchDetail, null, req.body?.confirmed ?? {})
    res.json({ data: { ...resolved, result: resultPayload(resolved.result) } })
  } catch (error) {
    const failure = error as ResolveFailure
    res.status(failure.fallbackRequired === false ? 500 : 422).json({ error: failure.message, fallbackRequired: failure.fallbackRequired !== false })
  }
})

router.post('/publish', async (req, res) => {
  try {
    const parsed = req.body?.match as ParsedMatchDetail
    const detail = req.body?.detail ?? {}
    const fallbackResultId = typeof req.body?.fallbackResultId === 'string' ? req.body.fallbackResultId : null
    const resolved = await resolveOrCreateResult(parsed, fallbackResultId, req.body?.confirmed ?? {})
    const savedDetail = await saveMatchDetail(resolved.result.id, detail)
    res.json({
      data: { action: resolved.action, result: resultPayload(resolved.result), detail: savedDetail },
      message: resolved.action === 'created'
        ? 'Result and detailed match information created and published'
        : 'Existing result updated with detailed match information',
    })
  } catch (error) {
    const failure = error as ResolveFailure
    res.status(failure.fallbackRequired === false ? 500 : 422).json({ error: failure.message, fallbackRequired: failure.fallbackRequired !== false })
  }
})

router.get('/:resultId', async (req, res) => {
  try {
    const result = await prisma.footballResult.findUnique({ where: { id: String(req.params.resultId) }, include: { league: { select: { name: true } } } })
    if (!result) return res.status(404).json({ error: 'Result not found' })
    res.json({ data: { result: resultPayload(result), detail: await loadMatchDetail(result.id) } })
  } catch (error) { res.status(500).json({ error: 'Unable to load detailed result', detail: String(error) }) }
})
router.patch('/:resultId', async (req, res) => {
  try {
    const result = await prisma.footballResult.findUnique({ where: { id: String(req.params.resultId) }, select: { id: true } })
    if (!result) return res.status(404).json({ error: 'Result not found' })
    res.json({ data: await saveMatchDetail(result.id, req.body ?? {}), message: 'Detailed result saved and published' })
  } catch (error) { res.status(500).json({ error: 'Unable to save detailed result', detail: String(error) }) }
})

export { router as adminMatchDetailsRouter }
