import { Router } from 'express'
import { prisma } from '../db/client.js'
import { requireAdminKey } from '../api/middleware/auth.js'
import { parseMatchImage, type MatchImageKind } from '../ocr/parse-match-image.js'
import { fuzzyMatchClub, similarity } from '../ocr/fuzzy-match.js'
import { validateClubIdentity } from '../validation/club-identity.js'
import { importResults } from '../results/results.service.js'
import { importFixtures } from '../results/fixtures.service.js'
import { publishApprovedMatchImport, type ApprovedMatchRow } from '../results/post-import.service.js'
import { processApprovedResultEffects } from '../results/result-effects.service.js'
import { emitApprovedResultEvents, emitLadderEvents } from '../feeds/events.service.js'
import type { ResultInput, FixtureInput } from '../results/validation.js'

const router = Router()
router.use(requireAdminKey)

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

type ReviewedMatchRow = {
  round?: number
  grade?: string | null
  matchDate?: string | null
  matchTime?: string | null
  venue?: string | null
  homeTeam: string
  awayTeam: string
  homeClubId?: string | null
  awayClubId?: string | null
  createHomeClub?: boolean
  createAwayClub?: boolean
  homeGoals?: number
  homeBehinds?: number
  homeScore?: number
  awayGoals?: number
  awayBehinds?: number
  awayScore?: number
  status?: string | null
}

router.post('/parse', async (req, res) => {
  try {
    const { image, kind, leagueId } = req.body as { image?: string; kind?: MatchImageKind; leagueId?: string }
    if (!image) return res.status(400).json({ error: 'image required' })
    if (kind !== 'fixtures' && kind !== 'results') return res.status(400).json({ error: 'kind must be fixtures or results' })

    const parsed = await parseMatchImage(image, kind)
    const leagues = await prisma.league.findMany({
      where: { isActive: true, archivedAt: null },
      include: { association: { select: { name: true } } },
    })
    let matchedLeagueId = leagueId ?? null
    if (!matchedLeagueId && parsed.league) {
      let best: { id: string; score: number } | null = null
      for (const league of leagues) {
        const score = similarity(parsed.league, league.association?.name ?? league.name)
        if (!best || score > best.score) best = { id: league.id, score }
      }
      if (best && best.score >= 0.6) matchedLeagueId = best.id
    }

    const clubs = matchedLeagueId
      ? await prisma.club.findMany({
          where: { leagueSeasons: { some: { leagueId: matchedLeagueId, isActive: true } }, archivedAt: null, isActive: true },
          select: { id: true, name: true },
        })
      : await prisma.club.findMany({ where: { archivedAt: null, isActive: true }, select: { id: true, name: true }, take: 2500 })

    const rows = parsed.rows.map(row => ({
      ...row,
      homeMatch: fuzzyMatchClub(row.homeTeam, clubs),
      awayMatch: fuzzyMatchClub(row.awayTeam, clubs),
    }))
    const uncertain = rows.filter(row => !row.homeMatch.confident || !row.awayMatch.confident).length
    const confidence = rows.length
      ? rows.reduce((sum, row) => sum + row.homeMatch.score + row.awayMatch.score, 0) / (rows.length * 2)
      : null

    res.json({ data: { ...parsed, matchedLeagueId, rows, uncertain, confidence } })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'match OCR failed' })
  }
})

router.post('/commit', async (req, res) => {
  try {
    const { kind, leagueId, season, grade, rows } = req.body as {
      kind?: MatchImageKind
      leagueId?: string
      season?: string
      grade?: string
      rows?: ReviewedMatchRow[]
    }
    if (kind !== 'fixtures' && kind !== 'results') return res.status(400).json({ error: 'kind must be fixtures or results' })
    if (!leagueId) return res.status(400).json({ error: 'leagueId required' })
    if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'approved rows required' })

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { id: true, name: true, stateId: true, archivedAt: true, isActive: true },
    })
    if (!league || league.archivedAt || !league.isActive) return res.status(404).json({ error: 'active league not found' })

    const resolvedSeason = season?.trim() || '2026'
    const resolvedGrade = grade?.trim() || 'Senior Football'
    const duplicateKeys = new Set<string>()
    for (const row of rows) {
      if (!row.homeTeam?.trim() || !row.awayTeam?.trim()) return res.status(400).json({ error: 'Every approved match requires both team names' })
      const key = `${row.round ?? ''}|${row.matchDate ?? ''}|${slugify(row.homeTeam)}|${slugify(row.awayTeam)}`
      if (duplicateKeys.has(key)) return res.status(400).json({ error: `Duplicate approved match: ${row.homeTeam} v ${row.awayTeam}` })
      duplicateKeys.add(key)
      if (kind === 'results' && (!Number.isFinite(row.homeScore) || !Number.isFinite(row.awayScore))) {
        return res.status(400).json({ error: `Scores required for ${row.homeTeam} v ${row.awayTeam}` })
      }
    }

    const resolved = await prisma.$transaction(async transaction => {
      let createdClubs = 0
      const resolveClub = async (clubId: string | null | undefined, rawName: string) => {
        if (clubId) {
          const club = await transaction.club.findFirst({
            where: { id: clubId, archivedAt: null, isActive: true },
            select: { id: true, name: true },
          })
          if (!club) throw new Error(`Selected club no longer exists for ${rawName}`)
          return club
        }

        const verdict = validateClubIdentity(rawName)
        const name = (verdict.canonical ?? rawName).trim()
        const existing = await transaction.club.findFirst({
          where: { stateId: league.stateId, name: { equals: name, mode: 'insensitive' }, archivedAt: null },
          select: { id: true, name: true },
        })
        if (existing) return existing

        const baseSlug = slugify(name) || 'club'
        let slug = `${baseSlug}-${league.id.slice(0, 8)}`
        const collision = await transaction.club.findUnique({ where: { slug }, select: { id: true } })
        if (collision) slug = `${slug}-${Date.now().toString(36)}`
        const club = await transaction.club.create({
          data: {
            name,
            shortName: rawName.trim(),
            slug,
            stateId: league.stateId,
            region: league.name,
            townName: verdict.isAnonymous ? null : name,
            isActive: true,
            source: 'MANUAL_IMAGE',
            manualOverride: true,
            approvalStatus: 'APPROVED',
            sport: 'FOOTBALL',
          },
          select: { id: true, name: true },
        })
        createdClubs += 1
        if (verdict.verdict !== 'VALID') {
          await transaction.reviewItem.create({
            data: {
              entityType: 'Club',
              entityId: club.id,
              kind: verdict.isAnonymous ? 'ANONYMOUS_CLUB' : 'UNCERTAIN_CLUB',
              reason: `${verdict.reason} — "${rawName}" approved in ${kind} image import for ${league.name}`,
              confidence: verdict.confidence,
              payload: JSON.stringify({ raw: rawName, leagueId, kind }),
            },
          })
        }
        return club
      }

      const approved: ApprovedMatchRow[] = []
      for (const row of rows) {
        const home = await resolveClub(row.homeClubId, row.homeTeam)
        const away = await resolveClub(row.awayClubId, row.awayTeam)
        if (home.id === away.id) throw new Error(`Home and away clubs cannot be identical for ${row.homeTeam} v ${row.awayTeam}`)

        for (const club of [home, away]) {
          await transaction.clubLeagueSeason.upsert({
            where: { clubId_leagueId_season_grade: { clubId: club.id, leagueId, season: resolvedSeason, grade: resolvedGrade } },
            create: { clubId: club.id, leagueId, season: resolvedSeason, grade: resolvedGrade, sport: 'FOOTBALL', isActive: true },
            update: { sport: 'FOOTBALL', isActive: true },
          })
        }

        approved.push({
          ...row,
          homeClubId: home.id,
          awayClubId: away.id,
          homeTeam: home.name,
          awayTeam: away.name,
        } as ApprovedMatchRow)
      }
      return { approved, createdClubs }
    }, { maxWait: 15_000, timeout: 60_000 })

    const approvedRows = resolved.approved
    if (kind === 'results') {
      const ladderBefore = await prisma.footballLadderEntry.findMany({
        where: { leagueId, season: resolvedSeason, grade: resolvedGrade, published: true },
        select: { clubId: true, clubName: true, position: true },
      })
      const input: ResultInput[] = approvedRows.map(row => ({
        leagueId,
        leagueName: league.name,
        season: resolvedSeason,
        grade: row.grade ?? resolvedGrade,
        round: row.round,
        matchDate: row.matchDate ?? undefined,
        homeClubId: row.homeClubId,
        homeClubName: row.homeTeam,
        awayClubId: row.awayClubId,
        awayClubName: row.awayTeam,
        homeScore: row.homeScore!,
        awayScore: row.awayScore!,
        status: row.status ?? 'FINAL',
      }))
      const imported = await importResults(input, 'OCR', { raiseReview: true })
      if (imported.invalid > 0) return res.status(422).json({ error: 'Some approved results failed validation', data: imported })
      const downstream = await publishApprovedMatchImport({ kind, leagueId, leagueName: league.name, season: resolvedSeason, grade: resolvedGrade, rows: approvedRows, actor: 'admin' })
      const ladderAfter = await prisma.footballLadderEntry.findMany({
        where: { leagueId, season: resolvedSeason, grade: resolvedGrade, published: true },
        select: { clubId: true, clubName: true, position: true, updatedAt: true },
      })
      const [rankingEffects, resultEvents, ladderEvents] = await Promise.all([
        processApprovedResultEffects({ leagueId, leagueName: league.name, season: resolvedSeason, clubIds: approvedRows.flatMap(row => [row.homeClubId, row.awayClubId]) }),
        emitApprovedResultEvents({ leagueId, leagueName: league.name, season: resolvedSeason, grade: resolvedGrade, rows: approvedRows }),
        emitLadderEvents({ leagueId, leagueName: league.name, season: resolvedSeason, grade: resolvedGrade, before: ladderBefore, after: ladderAfter }),
      ])
      return res.json({ data: { kind, league: league.name, submitted: rows.length, createdClubs: resolved.createdClubs, import: imported, downstream: { ...downstream, feedEventsCreated: resultEvents + ladderEvents, resultEvents, ladderEvents }, rankingEffects } })
    }

    const input: FixtureInput[] = approvedRows.map(row => ({
      leagueId,
      leagueName: league.name,
      season: resolvedSeason,
      grade: row.grade ?? resolvedGrade,
      round: row.round,
      matchDate: row.matchDate ?? undefined,
      matchTime: row.matchTime ?? undefined,
      venue: row.venue ?? undefined,
      homeClubId: row.homeClubId,
      homeClubName: row.homeTeam,
      awayClubId: row.awayClubId,
      awayClubName: row.awayTeam,
      status: row.status ?? 'SCHEDULED',
    }))
    const imported = await importFixtures(input, 'OCR')
    if (imported.invalid > 0) return res.status(422).json({ error: 'Some approved fixtures failed validation', data: imported })
    const downstream = await publishApprovedMatchImport({ kind, leagueId, leagueName: league.name, season: resolvedSeason, grade: resolvedGrade, rows: approvedRows, actor: 'admin' })
    res.json({ data: { kind, league: league.name, submitted: rows.length, createdClubs: resolved.createdClubs, import: imported, downstream } })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'match image commit failed' })
  }
})

export { router as adminMatchImageImportsRouter }
