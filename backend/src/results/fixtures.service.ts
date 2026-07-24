/**
 * Fixtures service (Phase B5).
 * ─────────────────────────────────────────────────────────────────────────────
 * Fixtures are stored independently of results and support future live scores.
 * upsertFixture validates + dedupes; verified/manualOverride fixtures are never
 * overwritten by automatic sources. When a fixture is played it can be linked to
 * its MatchResult.
 */

import { prisma } from '../db/client.js'
import { validateFixtureInput, type FixtureInput } from './validation.js'
import { logger } from '../utils/logger.js'

const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
export function fixtureDedupeKey(leagueId: string, season: string, round: number | null | undefined, homeClubId: string, awayClubId: string): string {
  const pair = [homeClubId, awayClubId].map(norm).sort().join('-')
  return `${norm(leagueId)}:${norm(season)}:r${round ?? 'x'}:${pair}`
}

export type ImportSource = 'PLAYHQ' | 'OCR' | 'CSV' | 'MANUAL'

export interface FixtureUpsert { ok: boolean; status: 'created' | 'updated' | 'skipped' | 'invalid'; id?: string; errors?: string[] }

export async function upsertFixture(input: FixtureInput, source: ImportSource = 'MANUAL'): Promise<FixtureUpsert> {
  const v = await validateFixtureInput(input)
  if (!v.ok) return { ok: false, status: 'invalid', errors: v.errors }
  const f = v.value
  const dedupeKey = fixtureDedupeKey(f.leagueId, f.season, f.round, f.homeClubId, f.awayClubId)
  const existing = await prisma.fixture.findUnique({ where: { dedupeKey } })
  const data = {
    leagueId: f.leagueId, leagueName: f.leagueName, season: f.season, grade: input.grade ?? 'A Grade', round: f.round ?? null, matchDate: f.matchDate ?? null,
    matchTime: f.matchTime ?? null, venue: f.venue ?? null, homeClubId: f.homeClubId, homeClubName: f.homeClubName,
    awayClubId: f.awayClubId, awayClubName: f.awayClubName, status: f.status, importSource: source, sourceUrl: input.sourceUrl ?? null, importedAt: new Date(),
  }
  if (existing) {
    if (existing.manualOverride && source !== 'MANUAL') return { ok: true, status: 'skipped', id: existing.id }
    const u = await prisma.fixture.update({ where: { dedupeKey }, data })
    return { ok: true, status: 'updated', id: u.id }
  }
  const c = await prisma.fixture.create({ data: { ...data, dedupeKey } })
  return { ok: true, status: 'created', id: c.id }
}

export interface FixtureImportReport { source: ImportSource; created: number; updated: number; skipped: number; invalid: number; errors: { row: number; errors: string[] }[] }

export async function importFixtures(rows: FixtureInput[], source: ImportSource = 'MANUAL'): Promise<FixtureImportReport> {
  const report: FixtureImportReport = { source, created: 0, updated: 0, skipped: 0, invalid: 0, errors: [] }
  for (let i = 0; i < rows.length; i++) {
    const r = await upsertFixture(rows[i], source)
    if (r.status === 'created') report.created++
    else if (r.status === 'updated') report.updated++
    else if (r.status === 'skipped') report.skipped++
    else { report.invalid++; report.errors.push({ row: i, errors: r.errors ?? [] }) }
  }
  logger.info('Fixtures import complete', { source, created: report.created, updated: report.updated, invalid: report.invalid })
  return report
}

/** Mark a fixture as played + link it to its result (idempotent). */
export async function linkFixtureToResult(fixtureId: string, resultId: string, homeScore?: number, awayScore?: number) {
  return prisma.fixture.update({ where: { id: fixtureId }, data: { status: 'COMPLETED', resultId, homeScore: homeScore ?? null, awayScore: awayScore ?? null } })
}

export async function getClubFixtures(clubId: string, opts: { season?: string; upcomingOnly?: boolean } = {}) {
  const [legacy, football] = await Promise.all([
    prisma.fixture.findMany({
      where: {
        OR: [{ homeClubId: clubId }, { awayClubId: clubId }],
        ...(opts.season ? { season: opts.season } : {}),
        ...(opts.upcomingOnly ? { status: { in: ['SCHEDULED', 'LIVE'] } } : {}),
      },
      orderBy: [{ matchDate: 'asc' }, { round: 'asc' }],
      take: 200,
    }),
    prisma.footballFixture.findMany({
      where: {
        OR: [{ homeClubId: clubId }, { awayClubId: clubId }],
        ...(opts.season ? { season: opts.season } : {}),
      },
      include: { league: { select: { name: true } } },
      orderBy: [{ matchDate: 'asc' }, { round: 'asc' }],
      take: 200,
    }),
  ])

  const imported = football.map(row => ({
    id: `football:${row.id}`,
    sourceId: row.id,
    leagueId: row.leagueId,
    leagueName: row.league.name,
    season: row.season,
    grade: row.grade,
    round: row.round,
    matchDate: row.matchDate,
    matchTime: null,
    venue: row.venue,
    homeClubId: row.homeClubId,
    homeClubName: row.homeName,
    awayClubId: row.awayClubId,
    awayClubName: row.awayName,
    status: 'SCHEDULED',
    importSource: 'OCR',
    sourceUrl: row.sourceUrl,
    verified: row.verified,
  }))

  const merged = new Map<string, (typeof legacy)[number] | (typeof imported)[number]>()
  for (const row of [...legacy, ...imported]) {
    const pair = [row.homeClubId, row.awayClubId].map(value => norm(String(value ?? ''))).sort().join('-')
    const key = `${norm(String(row.leagueId ?? ''))}:${norm(String(row.season ?? ''))}:${norm(String(row.round ?? ''))}:${pair}`
    merged.set(key, row)
  }

  return [...merged.values()].sort((a, b) => {
    const aDate = a.matchDate ? new Date(a.matchDate).getTime() : Number.MAX_SAFE_INTEGER
    const bDate = b.matchDate ? new Date(b.matchDate).getTime() : Number.MAX_SAFE_INTEGER
    if (aDate !== bDate) return aDate - bDate
    return String(a.round ?? '').localeCompare(String(b.round ?? ''), undefined, { numeric: true })
  })
}

export async function getLeagueFixtures(leagueId: string, opts: { season?: string; round?: number } = {}) {
  return prisma.fixture.findMany({
    where: { leagueId, ...(opts.season ? { season: opts.season } : {}), ...(opts.round != null ? { round: opts.round } : {}) },
    orderBy: [{ round: 'asc' }, { matchDate: 'asc' }], take: 500,
  })
}
