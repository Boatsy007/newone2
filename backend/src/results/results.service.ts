/**
 * Results service (Phase B5).
 * ─────────────────────────────────────────────────────────────────────────────
 * The single write path for match results. All import sources (PlayHQ, OCR, CSV,
 * manual) call upsertResult, which validates, dedupes (unique dedupeKey) and
 * protects verified / manually-overridden rows. Also bridges existing scraped
 * rows from the legacy `matches` table (read-only) so PlayHQ data is reused.
 */

import { prisma } from '../db/client.js'
import { validateResultInput, type ResultInput } from './validation.js'
import { fixtureDedupeKey } from './fixtures.service.js'
import { computeClubStats } from './statistics.js'
import { computeLeagueRoundSummaries } from './rounds.js'
import { logger } from '../utils/logger.js'

export type ImportSource = 'PLAYHQ' | 'OCR' | 'CSV' | 'MANUAL' | 'MATCH_BRIDGE'

const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
export function resultDedupeKey(leagueId: string, season: string, round: number | null | undefined, homeClubId: string, awayClubId: string): string {
  // Order-independent on the pairing so home/away swaps don't create a dup.
  const pair = [homeClubId, awayClubId].map(norm).sort().join('-')
  return `${norm(leagueId)}:${norm(season)}:r${round ?? 'x'}:${pair}`
}

export interface UpsertResult { ok: boolean; status: 'created' | 'updated' | 'skipped' | 'invalid'; id?: string; errors?: string[]; reviewRaised?: boolean; fixtureId?: string | null }

/** Insert or update one result and atomically complete its matching fixture. */
export async function upsertResult(input: ResultInput, source: ImportSource, opts: { raiseReview?: boolean } = {}): Promise<UpsertResult> {
  const v = await validateResultInput(input, { raiseReview: opts.raiseReview })
  if (!v.ok) return { ok: false, status: 'invalid', errors: v.errors, reviewRaised: v.reviewRaised }

  const { leagueId, leagueName, season, round, homeClubId, homeClubName, awayClubId, awayClubName, homeScore, awayScore, matchDate, sourceMatchId, status } = v.value
  const isDraw = homeScore === awayScore
  const winnerClubId = isDraw ? null : (homeScore > awayScore ? homeClubId : awayClubId)
  const margin = Math.abs(homeScore - awayScore)
  const dedupeKey = resultDedupeKey(leagueId, season, round, homeClubId, awayClubId)
  const matchingFixtureKey = fixtureDedupeKey(leagueId, season, round, homeClubId, awayClubId)

  return prisma.$transaction(async tx => {
    const [existing, matchingFixture] = await Promise.all([
      tx.matchResult.findUnique({ where: { dedupeKey } }),
      tx.fixture.findUnique({ where: { dedupeKey: matchingFixtureKey } }),
    ])

    const fixtureId = input.fixtureId ?? matchingFixture?.id ?? existing?.fixtureId ?? null
    const data = {
      sourceMatchId: sourceMatchId ?? null, fixtureId, leagueId, leagueName, season,
      grade: input.grade ?? 'A Grade', round: round ?? null, matchDate: matchDate ?? null,
      homeClubId, homeClubName, awayClubId, awayClubName, homeScore, awayScore, winnerClubId, isDraw, margin,
      status: status ?? 'FINAL', importSource: source, sourceUrl: input.sourceUrl ?? null, importedAt: new Date(),
    }

    let result: { id: string }
    let writeStatus: UpsertResult['status']

    if (existing) {
      // Never overwrite verified or manually-overridden results with an automatic source.
      if ((existing.verified || existing.manualOverride) && source !== 'MANUAL') {
        if (matchingFixture && existing.id) {
          const fixtureHomeScore = matchingFixture.homeClubId === existing.homeClubId ? existing.homeScore : existing.awayScore
          const fixtureAwayScore = matchingFixture.awayClubId === existing.awayClubId ? existing.awayScore : existing.homeScore
          await tx.fixture.update({
            where: { id: matchingFixture.id },
            data: { status: 'COMPLETED', resultId: existing.id, homeScore: fixtureHomeScore, awayScore: fixtureAwayScore },
          })
        }
        return { ok: true, status: 'skipped', id: existing.id, fixtureId: matchingFixture?.id ?? existing.fixtureId }
      }
      result = await tx.matchResult.update({ where: { dedupeKey }, data: { ...data, verified: source === 'MANUAL' ? true : existing.verified } })
      writeStatus = 'updated'
    } else {
      result = await tx.matchResult.create({ data: { ...data, dedupeKey, verified: source === 'MANUAL' } })
      writeStatus = 'created'
    }

    if (matchingFixture) {
      const fixtureHomeScore = matchingFixture.homeClubId === homeClubId ? homeScore : awayScore
      const fixtureAwayScore = matchingFixture.awayClubId === awayClubId ? awayScore : homeScore
      await tx.fixture.update({
        where: { id: matchingFixture.id },
        data: { status: 'COMPLETED', resultId: result.id, homeScore: fixtureHomeScore, awayScore: fixtureAwayScore },
      })
    }

    return { ok: true, status: writeStatus, id: result.id, fixtureId }
  }, { maxWait: 15_000, timeout: 30_000 })
}

export interface ImportReport {
  source: ImportSource
  created: number
  updated: number
  skipped: number
  invalid: number
  reviewsRaised: number
  errors: { row: number; errors: string[] }[]
  derived?: {
    seasonsRefreshed: number
    clubStatsRefreshed: number
    roundSummariesRefreshed: number
    errors: string[]
  }
}

/** Bulk import results from a source, then refresh all derived live-data views. */
export async function importResults(rows: ResultInput[], source: ImportSource, opts: { raiseReview?: boolean } = {}): Promise<ImportReport> {
  const report: ImportReport = { source, created: 0, updated: 0, skipped: 0, invalid: 0, reviewsRaised: 0, errors: [] }
  for (let i = 0; i < rows.length; i++) {
    const r = await upsertResult(rows[i], source, opts)
    if (r.reviewRaised) report.reviewsRaised++
    if (r.status === 'created') report.created++
    else if (r.status === 'updated') report.updated++
    else if (r.status === 'skipped') report.skipped++
    else { report.invalid++; report.errors.push({ row: i, errors: r.errors ?? [] }) }
  }

  const accepted = report.created + report.updated + report.skipped
  if (accepted > 0) {
    const seasons = [...new Set(rows.map(row => row.season.trim()).filter(Boolean))]
    const leagueSeasons = [...new Map(rows.map(row => {
      const season = row.season.trim()
      const grade = row.grade?.trim() || 'A Grade'
      return [`${row.leagueId}|${season}|${grade}`, { leagueId: row.leagueId, season, grade }]
    })).values()]
    const derivedErrors: string[] = []
    let clubStatsRefreshed = 0
    let roundSummariesRefreshed = 0

    for (const season of seasons) {
      try {
        const stats = await computeClubStats(season)
        clubStatsRefreshed += stats.clubs
      } catch (error) {
        derivedErrors.push(`Club statistics (${season}): ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    for (const item of leagueSeasons) {
      try {
        const summaries = await computeLeagueRoundSummaries(item.leagueId, item.season, item.grade)
        roundSummariesRefreshed += summaries.rounds
      } catch (error) {
        derivedErrors.push(`Round summaries (${item.leagueId}/${item.season}/${item.grade}): ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    report.derived = {
      seasonsRefreshed: seasons.length,
      clubStatsRefreshed,
      roundSummariesRefreshed,
      errors: derivedErrors,
    }
  }

  logger.info('Results import complete', {
    source,
    created: report.created,
    updated: report.updated,
    skipped: report.skipped,
    invalid: report.invalid,
    derived: report.derived,
  })
  return report
}

/**
 * Bridge: ingest verified/scraped rows from the legacy `matches` table into
 * MatchResult without modifying `matches`. Read-only against the source table.
 */
export async function bridgeFromMatches(opts: { season?: string; limit?: number } = {}): Promise<ImportReport> {
  const matches = await prisma.match.findMany({
    where: { ...(opts.season ? { season: opts.season } : {}) },
    orderBy: { matchDate: 'desc' }, take: opts.limit ?? 5000,
  })
  // Resolve club + league display names once.
  const clubIds = [...new Set(matches.flatMap(m => [m.homeClubId, m.awayClubId]))]
  const leagueIds = [...new Set(matches.map(m => m.leagueId))]
  const [clubs, leagues] = await Promise.all([
    prisma.club.findMany({ where: { id: { in: clubIds } }, select: { id: true, name: true } }),
    prisma.league.findMany({ where: { id: { in: leagueIds } }, select: { id: true, name: true } }),
  ])
  const clubName = new Map(clubs.map(c => [c.id, c.name]))
  const leagueName = new Map(leagues.map(l => [l.id, l.name]))

  const rows: ResultInput[] = matches.map(m => ({
    sourceMatchId: m.id, leagueId: m.leagueId, leagueName: leagueName.get(m.leagueId) ?? m.leagueId,
    season: m.season, round: m.round ?? undefined, matchDate: m.matchDate ?? undefined,
    homeClubId: m.homeClubId, homeClubName: clubName.get(m.homeClubId) ?? m.homeClubId,
    awayClubId: m.awayClubId, awayClubName: clubName.get(m.awayClubId) ?? m.awayClubId,
    homeScore: m.homeGoals, awayScore: m.awayGoals, status: 'FINAL',
  }))
  return importResults(rows, 'MATCH_BRIDGE', { raiseReview: false })
}

// ── Reads: club/league results + match history ────────────────────────────────

const publicResultWhere = { status: { notIn: ['CANCELLED', 'VOID'] } }

export async function getClubResults(clubId: string, opts: { season?: string; limit?: number } = {}) {
  return prisma.matchResult.findMany({
    where: { ...publicResultWhere, OR: [{ homeClubId: clubId }, { awayClubId: clubId }], ...(opts.season ? { season: opts.season } : {}) },
    orderBy: [{ matchDate: 'desc' }, { round: 'desc' }], take: opts.limit ?? 200,
  })
}

export async function getLeagueResults(leagueId: string, opts: { season?: string; round?: number; limit?: number } = {}) {
  return prisma.matchResult.findMany({
    where: { ...publicResultWhere, leagueId, ...(opts.season ? { season: opts.season } : {}), ...(opts.round != null ? { round: opts.round } : {}) },
    orderBy: [{ round: 'desc' }, { matchDate: 'desc' }], take: opts.limit ?? 500,
  })
}

/** Match history buckets for a club: last 5, last 10, this season, all-time. */
export async function getClubMatchHistory(clubId: string, season?: string) {
  const all = await prisma.matchResult.findMany({
    where: { ...publicResultWhere, OR: [{ homeClubId: clubId }, { awayClubId: clubId }] },
    orderBy: [{ matchDate: 'desc' }, { round: 'desc' }],
  })
  const forSeason = season ? all.filter(m => m.season === season) : all
  const detail = (m: typeof all[number]) => {
    const isHome = m.homeClubId === clubId
    const clubScore = isHome ? m.homeScore : m.awayScore
    const opponentScore = isHome ? m.awayScore : m.homeScore
    const opponentId = isHome ? m.awayClubId : m.homeClubId
    const opponentName = isHome ? m.awayClubName : m.homeClubName
    const outcome = m.isDraw ? 'D' : (m.winnerClubId === clubId ? 'W' : 'L')
    return {
      id: m.id,
      resultId: m.id,
      fixtureId: m.fixtureId,
      leagueId: m.leagueId,
      leagueName: m.leagueName,
      season: m.season,
      grade: m.grade,
      round: m.round,
      matchDate: m.matchDate,
      homeClubId: m.homeClubId,
      homeClubName: m.homeClubName,
      awayClubId: m.awayClubId,
      awayClubName: m.awayClubName,
      opponentId,
      opponentName,
      venueSide: isHome ? 'HOME' : 'AWAY',
      clubScore,
      opponentScore,
      outcome,
      margin: Math.abs(clubScore - opponentScore),
      status: m.status,
    }
  }
  return {
    last5: all.slice(0, 5).map(detail),
    last10: all.slice(0, 10).map(detail),
    season: forSeason.map(detail),
    historical: all.map(detail),
    form: all.slice(0, 10).map(m => m.isDraw ? 'D' : (m.winnerClubId === clubId ? 'W' : 'L')),
  }
}
