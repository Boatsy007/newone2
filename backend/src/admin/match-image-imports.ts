import { Router } from 'express'
import { prisma } from '../db/client.js'
import { requireAdminKey } from '../api/middleware/auth.js'
import { parseMatchImage, type MatchImageKind } from '../ocr/parse-match-image.js'
import { fuzzyMatchClub, similarity } from '../ocr/fuzzy-match.js'
import { importResults } from '../results/results.service.js'
import { importFixtures } from '../results/fixtures.service.js'
import type { ResultInput, FixtureInput } from '../results/validation.js'

const router = Router()
router.use(requireAdminKey)

type ReviewedMatchRow = {
  round?: number; grade?: string | null; matchDate?: string | null; matchTime?: string | null; venue?: string | null
  homeTeam: string; awayTeam: string; homeClubId?: string | null; awayClubId?: string | null
  homeGoals?: number; homeBehinds?: number; homeScore?: number; awayGoals?: number; awayBehinds?: number; awayScore?: number
  status?: string | null
}

router.post('/parse', async (req, res) => {
  try {
    const { image, kind, leagueId } = req.body as { image?: string; kind?: MatchImageKind; leagueId?: string }
    if (!image) return res.status(400).json({ error: 'image required' })
    if (kind !== 'fixtures' && kind !== 'results') return res.status(400).json({ error: 'kind must be fixtures or results' })
    const parsed = await parseMatchImage(image, kind)
    const leagues = await prisma.league.findMany({ where: { isActive: true }, include: { association: { select: { name: true } } } })
    let matchedLeagueId = leagueId ?? null
    if (!matchedLeagueId && parsed.league) {
      let best: { id: string; score: number } | null = null
      for (const league of leagues) { const score = similarity(parsed.league, league.association?.name ?? league.name); if (!best || score > best.score) best = { id: league.id, score } }
      if (best && best.score >= .6) matchedLeagueId = best.id
    }
    const clubs = matchedLeagueId
      ? await prisma.club.findMany({ where: { leagueSeasons: { some: { leagueId: matchedLeagueId } } }, select: { id: true, name: true } })
      : await prisma.club.findMany({ select: { id: true, name: true }, take: 2500 })
    const rows = parsed.rows.map(row => ({ ...row, homeMatch: fuzzyMatchClub(row.homeTeam, clubs), awayMatch: fuzzyMatchClub(row.awayTeam, clubs) }))
    const uncertain = rows.filter(row => !row.homeMatch.confident || !row.awayMatch.confident).length
    res.json({ data: { ...parsed, matchedLeagueId, rows, uncertain, confidence: rows.length ? rows.reduce((sum, row) => sum + row.homeMatch.score + row.awayMatch.score, 0) / (rows.length * 2) : null } })
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : 'match OCR failed' }) }
})

router.post('/commit', async (req, res) => {
  try {
    const { kind, leagueId, season, grade, rows } = req.body as { kind?: MatchImageKind; leagueId?: string; season?: string; grade?: string; rows?: ReviewedMatchRow[] }
    if (kind !== 'fixtures' && kind !== 'results') return res.status(400).json({ error: 'kind must be fixtures or results' })
    if (!leagueId) return res.status(400).json({ error: 'leagueId required' })
    if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'approved rows required' })
    const league = await prisma.league.findUnique({ where: { id: leagueId }, select: { name: true } })
    if (!league) return res.status(404).json({ error: 'league not found' })
    const resolvedSeason = season?.trim() || '2026'
    const resolvedGrade = grade?.trim() || 'Senior Football'
    const duplicateKeys = new Set<string>()
    for (const row of rows) {
      if (!row.homeClubId || !row.awayClubId) return res.status(400).json({ error: `Both clubs must be matched for ${row.homeTeam} v ${row.awayTeam}` })
      if (row.homeClubId === row.awayClubId) return res.status(400).json({ error: `Home and away clubs cannot be identical for ${row.homeTeam} v ${row.awayTeam}` })
      const key = `${row.round ?? ''}|${row.matchDate ?? ''}|${row.homeClubId}|${row.awayClubId}`
      if (duplicateKeys.has(key)) return res.status(400).json({ error: `Duplicate approved match: ${row.homeTeam} v ${row.awayTeam}` })
      duplicateKeys.add(key)
      if (kind === 'results' && (!Number.isFinite(row.homeScore) || !Number.isFinite(row.awayScore))) return res.status(400).json({ error: `Scores required for ${row.homeTeam} v ${row.awayTeam}` })
    }
    if (kind === 'results') {
      const input: ResultInput[] = rows.map(row => ({ leagueId, leagueName: league.name, season: resolvedSeason, grade: row.grade ?? resolvedGrade, round: row.round, matchDate: row.matchDate ?? undefined, homeClubId: row.homeClubId!, homeClubName: row.homeTeam, awayClubId: row.awayClubId!, awayClubName: row.awayTeam, homeScore: row.homeScore!, awayScore: row.awayScore!, status: row.status ?? 'FINAL' }))
      const report = await importResults(input, 'OCR', { raiseReview: true })
      return res.json({ data: { kind, league: league.name, submitted: rows.length, ...report } })
    }
    const input: FixtureInput[] = rows.map(row => ({ leagueId, leagueName: league.name, season: resolvedSeason, grade: row.grade ?? resolvedGrade, round: row.round, matchDate: row.matchDate ?? undefined, matchTime: row.matchTime ?? undefined, venue: row.venue ?? undefined, homeClubId: row.homeClubId!, homeClubName: row.homeTeam, awayClubId: row.awayClubId!, awayClubName: row.awayTeam, status: row.status ?? 'SCHEDULED' }))
    const report = await importFixtures(input, 'OCR')
    res.json({ data: { kind, league: league.name, submitted: rows.length, ...report } })
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : 'match image commit failed' }) }
})

export { router as adminMatchImageImportsRouter }
