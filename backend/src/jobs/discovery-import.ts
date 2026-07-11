/**
 * Discovery Import Job
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs the PlayHQ discovery crawler, then imports every discovered Senior
 * Women's A Grade league into the DB and re-runs the EXISTING ranking engine.
 *
 * Ranking is untouched — this only changes where the ladder data comes from.
 * New leagues are created with a default 3★ strength and flagged
 * needsStrengthReview until you set the real rating in the admin panel; existing
 * leagues keep their manual strength.
 *
 * Requires the Phase-4 additive migration to have been applied
 * (manual-migrations/2026_discovery_fields.sql).
 *
 * Usage:
 *   tsx src/jobs/discovery-import.ts --max-associations=5
 *   POST /admin/discover
 */

import { prisma }                  from '../db/client.js'
import { PlayHQPlaywrightAdapter } from '../adapters/playhq-playwright.adapter.js'
import { rankAndStore }            from './playhq-scrape.js'
import { discoverAllAGradeLeagues, type DiscoveredLeague } from '../discovery/playhq-discovery.js'
import { computeAutomaticStrength, finalStrength, strengthScoreFromRating } from '../config/league-strength-auto.js'
import { overrideForLeague, normaliseName } from '../config/league-overrides.js'
import { getISOWeekLabel }         from '../utils/week-label.js'
import { logger }                  from '../utils/logger.js'

const GRADE  = 'A Grade'

export interface DiscoveryImportResult {
  runId:            string
  weekLabel:        string
  season:           string
  leaguesDiscovered: number
  leaguesImported:  number
  clubsRanked:      number
  status:           'SUCCESS' | 'FAILED' | 'NO_DATA'
  error?:           string
  imported:         { league: string; teams: number; isNew: boolean }[]
}

export async function runDiscoveryImport(opts: { maxAssociations?: number; weekLabel?: string; assocFilter?: string[] } = {}): Promise<DiscoveryImportResult> {
  const label  = opts.weekLabel ?? getISOWeekLabel()
  const season = '2026'   // ranking cohort season (year); League.currentSeason keeps "Winter 2026"
  const imported: { league: string; teams: number; isNew: boolean }[] = []

  logger.info('DiscoveryImport: starting', { maxAssociations: opts.maxAssociations ?? 'all' })

  try {
    // 1) Discover every Senior Women's A Grade league (crawler). PlayHQ can be
    // flaky and intermittently resolve 0 leagues; that must NOT abort the run,
    // because the cleanup + re-rank below is DB hygiene that has to happen either
    // way (it operates on data already imported in earlier runs).
    let discovered: DiscoveredLeague[] = []
    try {
      discovered = await discoverAllAGradeLeagues({ maxAssociations: opts.maxAssociations, assocFilter: opts.assocFilter })
    } catch (err) {
      logger.warn('DiscoveryImport: discovery crawl failed, continuing with cleanup', { detail: String(err) })
    }
    logger.info('DiscoveryImport: discovered leagues', { count: discovered.length })

    // 2) Import each league (scrape ladder + upsert), skipping admin-disabled ones
    if (discovered.length > 0) {
      const adapter = new PlayHQPlaywrightAdapter()
      for (const dl of discovered) {
        try {
          const outcome = await importLeague(adapter, dl, season)
          if (outcome) imported.push(outcome)
        } catch (err) {
          logger.warn('DiscoveryImport: league import failed', { league: dl.leagueName, detail: String(err) })
        }
      }
    }

    // 2b) Dedupe any leftover same-name league duplicates (e.g. a stale manual
    // row that a discovered league now supersedes). We keep the discovery-owned
    // one and neutralise the others — clear their season stats + deactivate their
    // PlayHQ source so ranking excludes them — without hard-deleting records that
    // ranking history references. Always runs, even on a 0-discovery run.
    const deduped = await dedupeLeaguesByName(season)
    if (deduped.length) logger.info('DiscoveryImport: deduped leagues', { count: deduped.length, names: deduped })

    // 2c) Remove fully-orphaned clubs — rows left in no league at all (e.g. a
    // manual-scrape club whose league discovery has now superseded). Club
    // identity is association-scoped (slug carries the org), so we do NOT merge
    // by name across associations — that would fuse distinct same-named clubs.
    const removedClubs = await deleteFullyOrphanClubs()
    if (removedClubs) logger.info('DiscoveryImport: removed orphaned clubs', { count: removedClubs })

    // 3) Re-run the EXISTING ranking engine across all PlayHQ-sourced leagues.
    // We rank whenever there is any PlayHQ-sourced data (not only when this run
    // imported something), so cleanup-only runs still refresh the standings.
    const rankableSources = await prisma.leagueSource.count({ where: { sourceType: 'PLAYHQ', season, isActive: true } })
    if (rankableSources === 0) {
      return { runId: '', weekLabel: label, season, leaguesDiscovered: discovered.length, leaguesImported: imported.length, clubsRanked: 0, status: 'NO_DATA', imported, error: 'No active PlayHQ leagues to rank' }
    }
    const { runId, clubsRanked } = await rankAndStore(label)
    logger.info('DiscoveryImport: complete', { runId, clubsRanked, leaguesImported: imported.length, discovered: discovered.length })

    return { runId, weekLabel: label, season, leaguesDiscovered: discovered.length, leaguesImported: imported.length, clubsRanked, status: 'SUCCESS', imported }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('DiscoveryImport: failed', { error: msg })
    return { runId: '', weekLabel: label, season, leaguesDiscovered: 0, leaguesImported: 0, clubsRanked: 0, status: 'FAILED', imported, error: msg }
  }
}

// ─── Dedupe leagues sharing a name ────────────────────────────────────────────
// Keeps the discovery-owned league (override first, then most-recently synced)
// and neutralises the rest so ranking counts each competition once. No hard
// deletes — ranking history keeps its foreign keys.
async function dedupeLeaguesByName(season: string): Promise<string[]> {
  const leagues = await prisma.league.findMany({
    select: {
      id: true, name: true, manualStrengthOverride: true, lastSyncedAt: true, enabled: true,
      _count: { select: { clubSeasons: true } },
    },
  })

  const groups = new Map<string, typeof leagues>()
  for (const l of leagues) {
    const key = normaliseName(l.name)
    groups.set(key, [...(groups.get(key) ?? []), l])
  }

  const neutralised: string[] = []
  for (const group of groups.values()) {
    if (group.length < 2) continue
    const keeper = [...group].sort((a, b) => {
      if ((b.manualStrengthOverride != null ? 1 : 0) !== (a.manualStrengthOverride != null ? 1 : 0))
        return (b.manualStrengthOverride != null ? 1 : 0) - (a.manualStrengthOverride != null ? 1 : 0)
      const at = a.lastSyncedAt?.getTime() ?? 0, bt = b.lastSyncedAt?.getTime() ?? 0
      if (bt !== at) return bt - at
      return b._count.clubSeasons - a._count.clubSeasons
    })[0]

    for (const loser of group) {
      if (loser.id === keeper.id) continue
      await prisma.clubLeagueSeason.deleteMany({ where: { leagueId: loser.id, season, grade: GRADE } })
      await prisma.leagueSource.updateMany({ where: { leagueId: loser.id }, data: { isActive: false, lastStatus: 'SUPERSEDED' } })
      await prisma.league.update({ where: { id: loser.id }, data: { enabled: false, isActive: false, autoDiscovered: false, syncError: 'Superseded by duplicate (deduped)' } })
      neutralised.push(loser.name)
    }
  }
  return neutralised
}

// ─── Delete fully-orphaned clubs ──────────────────────────────────────────────
// A club that belongs to NO league (0 clubLeagueSeason rows) is a stale leftover
// — e.g. a manual-scrape club whose league discovery has superseded. Delete it
// and its child rows. We do NOT merge by name across associations; distinct
// same-named clubs in different orgs are legitimately different clubs.
async function deleteFullyOrphanClubs(): Promise<number> {
  const orphans = await prisma.club.findMany({
    where:  { leagueSeasons: { none: {} } },
    select: { id: true },
  })

  let removed = 0
  for (const orphan of orphans) {
    await prisma.rankingEntry.deleteMany({ where: { clubId: orphan.id } })
    await prisma.rankingSnapshot.deleteMany({ where: { clubId: orphan.id } })
    await prisma.clubNameVariant.deleteMany({ where: { clubId: orphan.id } })
    await prisma.match.deleteMany({ where: { OR: [{ homeClubId: orphan.id }, { awayClubId: orphan.id }] } })
    await prisma.club.delete({ where: { id: orphan.id } })
    removed++
  }
  return removed
}

// ─── Import a single discovered league ────────────────────────────────────────

async function importLeague(
  adapter: PlayHQPlaywrightAdapter,
  dl: DiscoveredLeague,
  season: string,
): Promise<{ league: string; teams: number; isNew: boolean } | null> {

  // State
  const stateCode = dl.state ?? 'VIC'
  const state = await prisma.state.upsert({
    where:  { code: stateCode },
    create: { code: stateCode, name: stateCode },
    update: {},
  })

  // Association (by PlayHQ org slug)
  const association = await prisma.association.upsert({
    where:  { playhqOrgSlug: dl.associationSlug },
    create: { name: dl.associationName, playhqOrgSlug: dl.associationSlug, playhqUrl: `https://www.playhq.com/netball-australia/org/${dl.associationSlug}`, stateCode: dl.state, active: true, lastDiscoveredAt: new Date() },
    update: { name: dl.associationName, lastDiscoveredAt: new Date() },
  })

  // Public league name is the OFFICIAL ASSOCIATION name (never a competition,
  // division or grade name). The competition is kept in playhqGradeName.
  const fullName  = dl.associationName
  const shortName = dl.associationName

  // Find by PlayHQ keys first, then by association, then by legacy name — so we
  // adopt an existing row instead of creating a parallel duplicate.
  let league =
    (await prisma.league.findFirst({ where: { playhqOrgSlug: dl.associationSlug, playhqGradeName: dl.gradeName } })) ||
    (await prisma.league.findFirst({ where: { playhqOrgSlug: dl.associationSlug } })) ||
    (await prisma.league.findFirst({ where: { OR: [{ name: fullName }, { name: `${dl.leagueName} - A Grade Netball` }] } }))
  const isNew = !league

  // Respect an admin ladder-URL override if present
  const ladderUrl = league?.ladderUrlOverride || dl.ladderUrl

  if (!league) {
    league = await prisma.league.create({
      data: {
        name: fullName, shortName, stateId: state.id, associationId: association.id,
        isActive: true, enabled: true, autoDiscovered: true, needsStrengthReview: false,
        // Strength is computed from the ladder below; these are placeholders.
        strengthScore: 60, strengthTier: 3, automaticStrengthRating: 3.0, finalStrengthRating: 3.0, strengthConfidence: 0.3,
        strengthNotes: 'Auto-discovered — strength calculated from ladder data.',
        playhqOrgSlug: dl.associationSlug, playhqGradeId: dl.gradeId, playhqGradeName: dl.gradeName,
        ladderUrl, currentSeason: dl.season, lastSyncedAt: new Date(),
      },
    })
  } else {
    if (!league.enabled) { logger.info('DiscoveryImport: league disabled, skipping', { league: league.name }); return null }
    // Never overwrite operator-edited data — auto imports skip manual-override leagues.
    if (league.manualOverride) { logger.info('DiscoveryImport: manual override, skipping', { league: league.name }); return null }
    // Adopt it under discovery ownership (attach PlayHQ metadata, mark auto).
    league = await prisma.league.update({
      where: { id: league.id },
      data:  {
        associationId: association.id, autoDiscovered: true, isActive: true,
        playhqOrgSlug: dl.associationSlug, playhqGradeId: dl.gradeId, playhqGradeName: dl.gradeName,
        ladderUrl, currentSeason: dl.season, lastSyncedAt: new Date(), syncError: null,
      },
    })
  }

  // Scrape the ladder (full stats) via the proven adapter
  const scraped = await adapter.scrapeLadder(ladderUrl)
  if (scraped.entries.length === 0) {
    await prisma.league.update({ where: { id: league.id }, data: { syncError: 'Ladder scrape returned 0 entries', lastSyncedAt: new Date() } })
    return null
  }

  // ── Automatic league strength from the ladder ──────────────────────────────
  // manual override (if the admin set one) wins; otherwise use the automatic
  // rating. strengthScore (0–100) is derived so the ranking engine is untouched.
  const auto = computeAutomaticStrength(scraped.entries, 1)
  // Manual override precedence: an override already set on the league wins;
  // otherwise seed from the configured override map (carries the operator's
  // ratings onto discovered leagues); otherwise stay fully automatic.
  const override = league.manualStrengthOverride ?? overrideForLeague(fullName, shortName, dl.leagueName)
  const final = finalStrength(auto.rating, override)
  await prisma.league.update({
    where: { id: league.id },
    data: {
      automaticStrengthRating: auto.rating,
      manualStrengthOverride:  override,
      finalStrengthRating:     final,
      strengthConfidence:      auto.confidence,
      strengthScore:           strengthScoreFromRating(final),
      strengthTier:            Math.max(1, Math.min(5, Math.round(final))),
    },
  })
  logger.info('DiscoveryImport: strength computed', { league: league.name, auto: auto.rating, final, confidence: auto.confidence.toFixed(2) })

  // League source (PLAYHQ) so the ranking engine includes this league
  const existingSource = await prisma.leagueSource.findFirst({ where: { leagueId: league.id, season, sourceType: 'PLAYHQ' } })
  if (!existingSource) {
    await prisma.leagueSource.create({ data: { leagueId: league.id, sourceType: 'PLAYHQ', season, isActive: true, ladderUrl, notes: `Auto-discovered (${scraped.method}).`, lastStatus: 'SUCCESS', lastScrapedAt: new Date() } })
  } else {
    await prisma.leagueSource.update({ where: { id: existingSource.id }, data: { ladderUrl, lastStatus: 'SUCCESS', lastScrapedAt: new Date() } })
  }

  // Clubs + season stats. Club identity is association-scoped (slug carries the
  // PlayHQ org), so two same-named clubs in different associations stay distinct.
  const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + dl.associationSlug
  const clubIds: string[] = []
  for (let i = 0; i < scraped.entries.length; i++) {
    const e = scraped.entries[i]
    const club = await prisma.club.upsert({
      where:  { slug: slugify(e.teamRaw) },
      create: { name: e.teamRaw, slug: slugify(e.teamRaw), shortName: e.teamRaw, stateId: state.id, region: dl.leagueName, isActive: true },
      update: {},
      select: { id: true },
    })
    clubIds.push(club.id)
    await prisma.clubLeagueSeason.upsert({
      where:  { clubId_leagueId_season_grade: { clubId: club.id, leagueId: league.id, season, grade: GRADE } },
      create: { clubId: club.id, leagueId: league.id, season, grade: GRADE, isActive: true, position: e.rank, played: e.played, wins: e.wins, losses: e.losses, draws: e.draws, goalsFor: e.goalsFor, goalsAgainst: e.goalsAgainst, percentage: e.percentage, points: e.points },
      update: { position: e.rank, played: e.played, wins: e.wins, losses: e.losses, draws: e.draws, goalsFor: e.goalsFor, goalsAgainst: e.goalsAgainst, percentage: e.percentage, points: e.points },
    })
  }
  // Prune teams no longer on the ladder
  await prisma.clubLeagueSeason.deleteMany({ where: { leagueId: league.id, season, grade: GRADE, clubId: { notIn: clubIds } } })

  logger.info('DiscoveryImport: league imported', { league: league.name, teams: clubIds.length, isNew })
  return { league: league.name, teams: clubIds.length, isNew }
}
