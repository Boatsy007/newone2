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
const roundNumber = (value: unknown) => { const match = String(value ?? '').match(/\d+/); return match ? Number(match[0]) : null }
const sameDay = (a: Date | null, b: string | null) => { if (!a || !b) return false; const date = new Date(b); return !Number.isNaN(date.getTime()) && a.toISOString().slice(0, 10) === date.toISOString().slice(0, 10) }
const resultPayload = (row: any) => ({ id: row.id, leagueId: row.leagueId, leagueName: row.league?.name ?? row.leagueName, season: row.season, grade: row.grade, round: row.round, matchDate: row.matchDate, homeClubId: row.homeClubId, homeName: row.homeName, awayClubId: row.awayClubId, awayName: row.awayName, homeGoals: row.homeGoals, homeBehinds: row.homeBehinds, homePoints: row.homePoints, awayGoals: row.awayGoals, awayBehinds: row.awayBehinds, awayPoints: row.awayPoints, detailUrl: `/match/result/${encodeURIComponent(row.id)}?source=football` })

router.get('/results', async (req, res) => {
  try {
    const leagueId = String(req.query.leagueId ?? '').trim(), season = String(req.query.season ?? '').trim()
    const rows = await prisma.footballResult.findMany({ where: { published: true, ...(leagueId ? { leagueId } : {}), ...(season ? { season } : {}) }, orderBy: [{ matchDate: 'desc' }, { round: 'desc' }, { updatedAt: 'desc' }], take: 250, include: { league: { select: { name: true } } } })
    res.json({ data: rows.map(resultPayload) })
  } catch (error) { res.status(500).json({ error: 'Unable to list detailed results', detail: String(error) }) }
})

router.post('/ocr', async (req, res) => {
  try { const image = typeof req.body?.image === 'string' ? req.body.image : ''; if (!image) return res.status(400).json({ error: 'image required' }); res.json({ data: await parseMatchDetailImage(image) }) }
  catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : 'Match detail OCR failed' }) }
})
router.post('/ocr/goal-kickers', async (req, res) => {
  try { const image = typeof req.body?.image === 'string' ? req.body.image : ''; if (!image) return res.status(400).json({ error: 'image required' }); res.json({ data: await parseTeamGoalKickerImage(image) }) }
  catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : 'Goal kicker OCR failed' }) }
})

router.post('/resolve', async (req, res) => {
  try {
    const parsed = (req.body?.match ?? req.body) as ParsedMatchDetail
    if (!parsed?.homeTeam || !parsed?.awayTeam) return res.status(422).json({ error: 'Both team names are required to identify the match', fallbackRequired: true })
    const leagues = await prisma.league.findMany({ where: { isActive: true, archivedAt: null }, include: { association: { select: { name: true } } } })
    let league = null as typeof leagues[number] | null, leagueScore = 0
    for (const candidate of leagues) {
      const score = Math.max(similarity(parsed.league ?? '', candidate.name), similarity(parsed.league ?? '', candidate.association?.name ?? ''))
      if (score > leagueScore) { league = candidate; leagueScore = score }
    }
    if (!league || leagueScore < 0.6) return res.status(409).json({ error: 'League could not be identified confidently. Use the fallback result selector.', fallbackRequired: true })
    const clubs = await prisma.club.findMany({ where: { archivedAt: null, isActive: true, leagueSeasons: { some: { leagueId: league.id, isActive: true } } }, select: { id: true, name: true } })
    const home = fuzzyMatchClub(parsed.homeTeam, clubs), away = fuzzyMatchClub(parsed.awayTeam, clubs)
    if (!home.confident || !away.confident || !home.clubId || !away.clubId || home.clubId === away.clubId) return res.status(409).json({ error: 'Teams could not be matched confidently. Use the fallback result selector.', fallbackRequired: true, matches: { home, away } })
    const round = roundNumber(parsed.round)
    const currentSeason = (await prisma.setting.findUnique({ where: { key: 'currentSeason' } }).catch(() => null))?.value
    const season = parsed.season?.trim() || (parsed.matchDate ? String(new Date(parsed.matchDate).getFullYear()) : '') || currentSeason || String(new Date().getFullYear())
    const grade = parsed.grade?.trim() || 'Senior Football'
    const pairResults = await prisma.footballResult.findMany({ where: { leagueId: league.id, season, published: true, OR: [{ homeClubId: home.clubId, awayClubId: away.clubId }, { homeClubId: away.clubId, awayClubId: home.clubId }] }, include: { league: { select: { name: true } } }, orderBy: { updatedAt: 'desc' }, take: 20 })
    const exact = pairResults.find(row => (round == null || row.round === `Round ${round}`) && (!parsed.matchDate || sameDay(row.matchDate, parsed.matchDate)))
      ?? pairResults.find(row => round != null && row.round === `Round ${round}`)
      ?? (pairResults.length === 1 ? pairResults[0] : null)
    if (exact) return res.json({ data: { action: 'matched', result: resultPayload(exact), confidence: Math.min(home.score, away.score, leagueScore) } })
    if (![parsed.homeScore, parsed.awayScore].every(value => typeof value === 'number' && Number.isFinite(value))) return res.status(422).json({ error: 'No published result matched and final scores were not readable, so a new result cannot be safely created.', fallbackRequired: true })
    const approved: ApprovedMatchRow = {
      round: round ?? undefined, grade, matchDate: parsed.matchDate, matchTime: parsed.matchTime, venue: parsed.venue,
      homeTeam: home.matchedName ?? parsed.homeTeam, awayTeam: away.matchedName ?? parsed.awayTeam,
      homeClubId: home.clubId, awayClubId: away.clubId,
      homeGoals: parsed.homeGoals ?? undefined, homeBehinds: parsed.homeBehinds ?? undefined, homeScore: parsed.homeScore!,
      awayGoals: parsed.awayGoals ?? undefined, awayBehinds: parsed.awayBehinds ?? undefined, awayScore: parsed.awayScore!, status: 'FINAL',
    }
    const imported = await importResults([{ leagueId: league.id, leagueName: league.name, season, grade, round: round ?? undefined, matchDate: parsed.matchDate ?? undefined, homeClubId: home.clubId, homeClubName: approved.homeTeam, awayClubId: away.clubId, awayClubName: approved.awayTeam, homeScore: parsed.homeScore!, awayScore: parsed.awayScore!, status: 'FINAL' }], 'OCR', { raiseReview: true })
    if (imported.invalid > 0) return res.status(422).json({ error: imported.errors[0]?.errors?.join(', ') || 'The result failed validation', fallbackRequired: true })
    await publishApprovedMatchImport({ kind: 'results', leagueId: league.id, leagueName: league.name, season, grade, rows: [approved], actor: 'match-details-ocr' })
    const created = await prisma.footballResult.findUnique({ where: { leagueId_season_grade_round_homeName_awayName: { leagueId: league.id, season, grade, round: round == null ? null : `Round ${round}`, homeName: approved.homeTeam, awayName: approved.awayTeam } }, include: { league: { select: { name: true } } } })
    if (!created) return res.status(500).json({ error: 'Result was published but could not be reloaded' })
    res.json({ data: { action: 'created', result: resultPayload(created), confidence: Math.min(home.score, away.score, leagueScore) } })
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to identify or create result' }) }
})

router.get('/:resultId', async (req, res) => {
  try { const result = await prisma.footballResult.findUnique({ where: { id: String(req.params.resultId) }, include: { league: { select: { name: true } } } }); if (!result) return res.status(404).json({ error: 'Result not found' }); res.json({ data: { result: resultPayload(result), detail: await loadMatchDetail(result.id) } }) }
  catch (error) { res.status(500).json({ error: 'Unable to load detailed result', detail: String(error) }) }
})
router.patch('/:resultId', async (req, res) => {
  try { const result = await prisma.footballResult.findUnique({ where: { id: String(req.params.resultId) }, select: { id: true } }); if (!result) return res.status(404).json({ error: 'Result not found' }); res.json({ data: await saveMatchDetail(result.id, req.body ?? {}), message: 'Detailed result saved and published' }) }
  catch (error) { res.status(500).json({ error: 'Unable to save detailed result', detail: String(error) }) }
})

export { router as adminMatchDetailsRouter }
