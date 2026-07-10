/**
 * PlayHQ URL Import + League Sync (Phase 1 + Phase 10)
 * ─────────────────────────────────────────────────────────────────────────────
 * Paste ANY PlayHQ URL → the importer classifies it (association / competition /
 * season / grade / ladder), resolves the A-Grade Senior Women's ladder, scrapes
 * it, and upserts the league + clubs + ladder — then re-ranks nationally.
 *
 * The PlayHQ URL is stored PERMANENTLY on the league (playhqOrgSlug / gradeId /
 * ladderUrl / sourceUrl), so the weekly workflow is just "Sync League": re-scrape
 * the stored URL, refresh the ladder + rankings, and leave every manual edit,
 * manual override, logo and piece of league metadata untouched.
 *
 * Builds on the existing proven pieces — it does NOT replace them:
 *   • parsePlayHQUrl        (deterministic URL classifier)
 *   • resolveAGradeLeagues  (association → A-Grade ladder resolver, Playwright)
 *   • PlayHQPlaywrightAdapter.scrapeLadder (ladder scraper w/ __NEXT_DATA__ fast path)
 *   • validateClubIdentity  (real-town / anonymous-name guard)
 *   • rankAndStore          (the untouched ranking engine)
 *
 * Every import/sync returns a validation report (clubs added/updated, ladder
 * updated, ranking recalculated, confidence, warnings). Nothing uncertain is
 * published silently — anonymous/ambiguous clubs raise ReviewItems.
 */

import { createHash }              from 'node:crypto'
import { prisma }                  from '../db/client.js'
import { PlayHQPlaywrightAdapter } from '../adapters/playhq-playwright.adapter.js'
import { rankAndStore }            from './playhq-scrape.js'
import { parsePlayHQUrl }          from '../discovery/playhq-url.js'
import { resolveAGradeLeagues, type DiscoveredLeague, type DiscoveredAssociation } from '../discovery/playhq-discovery.js'
import { validateClubIdentity, canonicalClubKey } from '../validation/club-identity.js'
import { computeAutomaticStrength, finalStrength, strengthScoreFromRating } from '../config/league-strength-auto.js'
import { overrideForLeague }       from '../config/league-overrides.js'
import { getISOWeekLabel }         from '../utils/week-label.js'
import { logger }                  from '../utils/logger.js'
import { fetchPage, parseLadder, parseFixtures, parseResults, parseGoalKickers, type FixtureRow, type ResultRow, type LadderRow, type GoalKickerRow } from '../football/url-ingest.js'

const GRADE  = 'A Grade'
const SEASON = '2026'
const AFL_PLAYHQ_RE = /(?:^|\/)afl(?:\/|$)/i
const PLAYHQ_STATISTICS_RE = /\/statistics(?:$|[?#])/i

export interface ImportReport {
  status:       'SUCCESS' | 'NO_DATA' | 'FAILED'
  url?:         string
  kind?:        string
  league?:      string
  leagueId?:    string
  isNew?:       boolean
  clubsAdded:   number
  clubsUpdated: number
  ladderRows:   number
  ladderUpdated: boolean
  rankingRecalculated: boolean
  clubsRanked:  number
  confidence:   number
  warnings:     string[]
  reviewsRaised: number
  error?:       string
}

function emptyReport(status: ImportReport['status']): ImportReport {
  return { status, clubsAdded: 0, clubsUpdated: 0, ladderRows: 0, ladderUpdated: false, rankingRecalculated: false, clubsRanked: 0, confidence: 0, warnings: [], reviewsRaised: 0 }
}

function isAflPlayHqUrl(url: string | null | undefined): boolean {
  if (typeof url !== 'string' || !/playhq\.com/i.test(url)) return false
  try {
    return AFL_PLAYHQ_RE.test(new URL(url.startsWith('http') ? url : `https://${url}`).pathname)
  } catch {
    return /playhq\.com\/afl\//i.test(url)
  }
}

function assertAflImportIsFootball(entity: string, id: string, sport: string | null | undefined): void {
  if (sport !== 'FOOTBALL') throw new Error(`AFL PlayHQ import guard failed: ${entity} ${id} was saved as ${sport ?? 'null'} instead of FOOTBALL.`)
}

// ─── Public: import from a pasted PlayHQ URL ──────────────────────────────────

export async function importFromUrl(rawUrl: string, opts: { rerank?: boolean } = {}): Promise<ImportReport> {
  const parsed = parsePlayHQUrl(rawUrl)
  if (!parsed.ok || !parsed.orgSlug) {
    return { ...emptyReport('FAILED'), url: rawUrl, error: parsed.warnings.join('; ') || 'Could not parse PlayHQ URL' }
  }
  logger.info('URLImport: parsed', { kind: parsed.kind, orgSlug: parsed.orgSlug, gradeId: parsed.gradeId })

  const directFootballLadderUrl = parsed.ladderUrl
  if (/^afl$/i.test(parsed.tenant ?? '')) {
    if (PLAYHQ_STATISTICS_RE.test(rawUrl)) {
      if (directFootballLadderUrl) return importFootballLeagueFromPlayHq(directFootballLadderUrl, rawUrl, { ...opts, statisticsUrl: rawUrl })
      return { ...emptyReport('FAILED'), url: rawUrl, kind: parsed.kind, error: 'PlayHQ AFL goal kicker imports require a grade statistics URL so the football importer can locate the matching ladder and league.' }
    }
    if (directFootballLadderUrl) return importFootballLeagueFromPlayHq(directFootballLadderUrl, rawUrl, opts)
    return { ...emptyReport('FAILED'), url: rawUrl, kind: parsed.kind, error: 'PlayHQ AFL football imports require a grade or ladder URL so the football importer can classify the data as FOOTBALL.' }
  }

  const adapter = new PlayHQPlaywrightAdapter()
  const warnings = [...parsed.warnings]

  // A discovered-league shape to persist. For a direct ladder URL we can scrape
  // immediately; otherwise we resolve the association's A-Grade ladder(s).
  let discovered: DiscoveredLeague[] = []

  if (parsed.kind === 'LADDER' && parsed.ladderUrl) {
    // Direct ladder — derive a minimal DiscoveredLeague; league/association name
    // is refined from the org slug (title-cased) until the ladder tells us more.
    discovered = [{
      associationName: titleFromSlug(parsed.orgSlug),
      associationSlug: parsed.orgSlug,
      state:           null,
      leagueName:      titleFromSlug(parsed.orgSlug),
      gradeName:       parsed.gradeSlug ? titleFromSlug(parsed.gradeSlug) : 'A Grade',
      gradeId:         parsed.gradeId ?? '',
      season:          `Winter ${SEASON}`,
      ladderUrl:       parsed.ladderUrl,
      teams:           0,
    }]
  } else {
    // Association / competition / grade page → resolve A-Grade ladder(s) with a browser.
    const { chromium } = await import('playwright')
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'] })
    try {
      const ctx  = await browser.newContext({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' })
      const page = await ctx.newPage()
      const assoc: DiscoveredAssociation = {
        name: titleFromSlug(parsed.orgSlug), url: parsed.associationUrl ?? `https://www.playhq.com/netball-australia/org/${parsed.orgSlug}`,
        slug: parsed.orgSlug, logo: null, state: null, region: null,
      }
      discovered = await resolveAGradeLeagues(page, assoc)
    } finally {
      await browser.close()
    }
    if (discovered.length === 0) {
      return { ...emptyReport('NO_DATA'), url: rawUrl, kind: parsed.kind, warnings: [...warnings, 'No Senior Women\'s A Grade ladder resolved for this association/competition.'] }
    }
  }

  // Persist the first resolved league (URL import targets one competition).
  const dl = discovered[0]
  const report = await persistLeagueLadder(adapter, dl, rawUrl)
  report.kind = parsed.kind
  report.warnings.push(...warnings)

  // Re-rank nationally unless caller defers it (batch imports).
  if (opts.rerank !== false && report.status === 'SUCCESS') {
    const { clubsRanked } = await rankAndStore(getISOWeekLabel())
    report.rankingRecalculated = true
    report.clubsRanked = clubsRanked
  }
  return report
}

// ─── Public: sync an already-imported league (weekly workflow) ────────────────

export async function syncLeague(leagueId: string, opts: { rerank?: boolean } = {}): Promise<ImportReport> {
  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league) return { ...emptyReport('FAILED'), error: 'League not found' }

  const ladderUrl = league.ladderUrlOverride || league.ladderUrl || league.sourceUrl
  if (!ladderUrl) return { ...emptyReport('FAILED'), leagueId, league: league.name, error: 'No stored PlayHQ URL on this league — import it once by URL first.' }

  const dl: DiscoveredLeague = {
    associationName: league.name, associationSlug: league.playhqOrgSlug ?? '', state: null,
    leagueName: league.name, gradeName: league.playhqGradeName ?? 'A Grade', gradeId: league.playhqGradeId ?? '',
    season: league.currentSeason ?? `Winter ${SEASON}`, ladderUrl, teams: 0,
  }
  const adapter = new PlayHQPlaywrightAdapter()
  const report = await persistLeagueLadder(adapter, dl, ladderUrl, { syncOnly: true, existingLeagueId: league.id })

  if (opts.rerank !== false && report.status === 'SUCCESS') {
    const { clubsRanked } = await rankAndStore(getISOWeekLabel())
    report.rankingRecalculated = true
    report.clubsRanked = clubsRanked
  }
  return report
}

// ─── Shared persistence: scrape a ladder → upsert league/clubs/ladder ─────────
// Mirrors discovery-import.importLeague but adds club-identity validation, review
// queue population, and permanent URL storage. Respects manual overrides and, in
// syncOnly mode, never touches league metadata/logo/strength override.

async function persistLeagueLadder(
  adapter: PlayHQPlaywrightAdapter,
  dl: DiscoveredLeague,
  sourceUrl: string,
  opts: { syncOnly?: boolean; existingLeagueId?: string } = {},
): Promise<ImportReport> {
  const report = emptyReport('SUCCESS')
  report.url = sourceUrl
  const shouldMirrorFootballLadder = isAflPlayHqUrl(sourceUrl) || isAflPlayHqUrl(dl.ladderUrl)

  // Scrape first — if the ladder is empty we bail without mutating anything.
  const scraped = await adapter.scrapeLadder(dl.ladderUrl)
  if (scraped.entries.length === 0) {
    if (opts.existingLeagueId) await prisma.league.update({ where: { id: opts.existingLeagueId }, data: { syncError: 'Ladder scrape returned 0 entries', lastSyncedAt: new Date() } })
    return { ...report, status: 'NO_DATA', warnings: ['Ladder scrape returned 0 entries — page structure may have changed, or wrong URL.'] }
  }
  report.ladderRows = scraped.entries.length

  // State + association
  const stateCode = dl.state ?? 'VIC'
  const state = await prisma.state.upsert({ where: { code: stateCode }, create: { code: stateCode, name: stateCode }, update: {} })
  const association = dl.associationSlug
    ? await prisma.association.upsert({
        where:  { playhqOrgSlug: dl.associationSlug },
        create: { name: dl.associationName, playhqOrgSlug: dl.associationSlug, playhqUrl: `https://www.playhq.com/netball-australia/org/${dl.associationSlug}`, stateCode: dl.state, active: true, lastDiscoveredAt: new Date() },
        update: { lastDiscoveredAt: new Date() },
      })
    : null

  // Locate the league. Prefer an explicit id (sync), then PlayHQ keys, then name.
  let league =
    (opts.existingLeagueId ? await prisma.league.findUnique({ where: { id: opts.existingLeagueId } }) : null) ||
    (dl.associationSlug ? await prisma.league.findFirst({ where: { playhqOrgSlug: dl.associationSlug } }) : null) ||
    (await prisma.league.findFirst({ where: { name: dl.associationName } }))
  const isNew = !league
  report.isNew = isNew

  if (!league) {
    league = await prisma.league.create({
      data: {
        name: dl.associationName, shortName: dl.associationName, stateId: state.id, associationId: association?.id ?? null,
        ...(shouldMirrorFootballLadder ? { sport: 'FOOTBALL', approvalStatus: 'APPROVED', archivedAt: null, status: 'ACTIVE', primaryDataSource: 'PLAYHQ_SCRAPER' } : {}),
        isActive: true, enabled: true, autoDiscovered: true, needsStrengthReview: false,
        strengthScore: 60, strengthTier: 3, automaticStrengthRating: 3.0, finalStrengthRating: 3.0, strengthConfidence: 0.3,
        strengthNotes: 'Imported by PlayHQ URL — strength calculated from ladder data.',
        playhqOrgSlug: dl.associationSlug || null, playhqGradeId: dl.gradeId || null, playhqGradeName: dl.gradeName,
        ladderUrl: dl.ladderUrl, sourceUrl, currentSeason: dl.season, lastSyncedAt: new Date(),
      },
    })
  } else if (opts.syncOnly) {
    // Sync: refresh ONLY the sync-related fields; leave name/logo/metadata/strength override untouched.
    league = await prisma.league.update({
      where: { id: league.id },
      data: {
        lastSyncedAt: new Date(), syncError: null, lastManualUpdateAt: league.lastManualUpdateAt,
        ...(shouldMirrorFootballLadder ? { sport: 'FOOTBALL', approvalStatus: 'APPROVED', archivedAt: null, status: 'ACTIVE', primaryDataSource: 'PLAYHQ_SCRAPER' } : {}),
      },
    })
  } else {
    if (league.manualOverride && !opts.existingLeagueId) {
      report.warnings.push('League is manual-override protected — ladder refreshed but metadata preserved.')
    }
    // Attach/refresh PlayHQ ownership + store the URL permanently (metadata preserved).
    league = await prisma.league.update({
      where: { id: league.id },
      data: {
        associationId: association?.id ?? league.associationId, autoDiscovered: true, isActive: true,
        ...(shouldMirrorFootballLadder ? { sport: 'FOOTBALL', approvalStatus: 'APPROVED', archivedAt: null, status: 'ACTIVE', primaryDataSource: 'PLAYHQ_SCRAPER' } : {}),
        playhqOrgSlug: dl.associationSlug || league.playhqOrgSlug, playhqGradeId: dl.gradeId || league.playhqGradeId,
        playhqGradeName: dl.gradeName || league.playhqGradeName, ladderUrl: dl.ladderUrl, sourceUrl,
        currentSeason: dl.season, lastSyncedAt: new Date(), syncError: null,
      },
    })
  }
  if (shouldMirrorFootballLadder) assertAflImportIsFootball('league', league.id, league.sport)
  report.league = league.name
  report.leagueId = league.id

  // ── Strength (respect manual override; never recompute override in syncOnly) ──
  const auto = computeAutomaticStrength(scraped.entries, 1)
  report.confidence = auto.confidence
  const override = league.manualStrengthOverride ?? (opts.syncOnly ? null : overrideForLeague(league.name, dl.leagueName))
  const final = finalStrength(auto.rating, override)
  await prisma.league.update({
    where: { id: league.id },
    data: {
      automaticStrengthRating: auto.rating,
      ...(opts.syncOnly ? {} : { manualStrengthOverride: override }),
      finalStrengthRating: final, strengthConfidence: auto.confidence,
      strengthScore: strengthScoreFromRating(final), strengthTier: Math.max(1, Math.min(5, Math.round(final))),
    },
  })

  // ── League source (PLAYHQ) so the ranking engine includes this league ──
  const existingSource = await prisma.leagueSource.findFirst({ where: { leagueId: league.id, season: SEASON, sourceType: 'PLAYHQ' } })
  if (!existingSource) await prisma.leagueSource.create({ data: { leagueId: league.id, sourceType: 'PLAYHQ', season: SEASON, isActive: true, ladderUrl: dl.ladderUrl, notes: `Imported by URL (${scraped.method}).`, lastStatus: 'SUCCESS', lastScrapedAt: new Date() } })
  else await prisma.leagueSource.update({ where: { id: existingSource.id }, data: { ladderUrl: dl.ladderUrl, isActive: true, lastStatus: 'SUCCESS', lastScrapedAt: new Date() } })

  // ── Clubs + ladder, with real-town / anonymous-name validation ──
  const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + (dl.associationSlug || 'league')
  const clubIds: string[] = []
  for (const e of scraped.entries) {
    const verdict = validateClubIdentity(e.teamRaw)
    const displayName = verdict.canonical ?? e.teamRaw
    const slug = slugify(displayName)

    const existing = await prisma.club.findUnique({ where: { slug }, select: { id: true } })
    const club = await prisma.club.upsert({
      where:  { slug },
      create: { name: displayName, slug, shortName: e.teamRaw, stateId: state.id, region: dl.leagueName, townName: verdict.isAnonymous ? null : displayName, isActive: true, source: 'PLAYHQ_URL', approvalStatus: shouldMirrorFootballLadder ? 'APPROVED' : (verdict.verdict === 'VALID' ? 'APPROVED' : 'PENDING'), ...(shouldMirrorFootballLadder ? { sport: 'FOOTBALL', archivedAt: null } : {}) },
      update: shouldMirrorFootballLadder ? { sport: 'FOOTBALL', isActive: true, archivedAt: null, approvalStatus: 'APPROVED' } : {},   // never overwrite manual club edits
      select: { id: true, sport: true },
    })
    if (shouldMirrorFootballLadder) assertAflImportIsFootball('club', club.id, club.sport)
    if (existing) report.clubsUpdated++; else report.clubsAdded++
    clubIds.push(club.id)

    // Record the raw name as an alias/variant for future duplicate detection.
    await prisma.clubNameVariant.upsert({
      where:  { rawName_sourceType: { rawName: e.teamRaw, sourceType: 'PLAYHQ' } },
      create: { clubId: club.id, rawName: e.teamRaw, sourceType: 'PLAYHQ', confidence: verdict.confidence },
      update: {},
    }).catch(() => {})

    // Anything not clearly a real club → review queue (never blocks the import).
    if (verdict.verdict !== 'VALID') {
      await prisma.reviewItem.create({ data: {
        entityType: 'Club', entityId: club.id, kind: verdict.isAnonymous ? 'ANONYMOUS_CLUB' : 'UNCERTAIN_CLUB',
        reason: `${verdict.reason} — "${e.teamRaw}" in ${league.name}`, confidence: verdict.confidence,
        payload: JSON.stringify({ raw: e.teamRaw, leagueId: league.id, canonicalKey: canonicalClubKey(e.teamRaw) }),
      } }).catch(() => {})
      report.reviewsRaised++
    }

    await prisma.clubLeagueSeason.upsert({
      where:  { clubId_leagueId_season_grade: { clubId: club.id, leagueId: league.id, season: SEASON, grade: GRADE } },
      create: { clubId: club.id, leagueId: league.id, season: SEASON, grade: GRADE, sport: shouldMirrorFootballLadder ? 'FOOTBALL' : undefined, isActive: true, position: e.rank, played: e.played, wins: e.wins, losses: e.losses, draws: e.draws, goalsFor: e.goalsFor, goalsAgainst: e.goalsAgainst, percentage: e.percentage, points: e.points },
      update: { sport: shouldMirrorFootballLadder ? 'FOOTBALL' : undefined, isActive: true, position: e.rank, played: e.played, wins: e.wins, losses: e.losses, draws: e.draws, goalsFor: e.goalsFor, goalsAgainst: e.goalsAgainst, percentage: e.percentage, points: e.points },
    })
    if (shouldMirrorFootballLadder) {
      await prisma.footballLadderEntry.upsert({
        where: { leagueId_season_grade_clubName: { leagueId: league.id, season: SEASON, grade: FOOTBALL_GRADE, clubName: displayName } },
        create: { leagueId: league.id, season: SEASON, grade: FOOTBALL_GRADE, clubId: club.id, clubName: displayName, position: e.rank ?? 999, played: e.played, wins: e.wins, losses: e.losses, draws: e.draws, pointsFor: e.goalsFor, pointsAgainst: e.goalsAgainst, percentage: e.percentage, premiershipPoints: e.points, sourceType: 'PLAYHQ_SCRAPER' },
        update: { clubId: club.id, position: e.rank ?? 999, played: e.played, wins: e.wins, losses: e.losses, draws: e.draws, pointsFor: e.goalsFor, pointsAgainst: e.goalsAgainst, percentage: e.percentage, premiershipPoints: e.points, sourceType: 'PLAYHQ_SCRAPER' },
      })
    }
  }
  // Prune teams no longer on the ladder (keeps the season accurate).
  await prisma.clubLeagueSeason.deleteMany({ where: { leagueId: league.id, season: SEASON, grade: GRADE, clubId: { notIn: clubIds } } })
  report.ladderUpdated = true

  logger.info('URLImport: league persisted', { league: league.name, teams: clubIds.length, added: report.clubsAdded, updated: report.clubsUpdated, reviews: report.reviewsRaised })
  return report
}


// ─── Football direct import: PlayHQ AFL ladder URL → league, clubs, ladder, rounds ──

const FOOTBALL_SPORT = 'FOOTBALL'
const FOOTBALL_GRADE = 'Senior Football'
const FOOTBALL_SEASON = '2026'
const stableHash = (v: unknown) => createHash('sha256').update(JSON.stringify(v ?? null)).digest('hex')
const num = (v: unknown, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback
const points = (goals?: number, behinds?: number, total?: number) => Number.isFinite(Number(total)) ? Number(total) : num(goals) * 6 + num(behinds)
const visibleFootballLeagueFields = { sport: FOOTBALL_SPORT, isActive: true, enabled: true, hidden: false, archivedAt: null, status: 'ACTIVE', approvalStatus: 'APPROVED', primaryDataSource: 'PLAYHQ_SCRAPER', scrapeEnabled: true } as const

async function importFootballLeagueFromPlayHq(ladderUrl: string, rawUrl: string, opts: { rerank?: boolean; statisticsUrl?: string } = {}): Promise<ImportReport> {
  const report = emptyReport('SUCCESS')
  report.url = rawUrl
  report.kind = opts.statisticsUrl ? 'GOAL_KICKERS' : 'LADDER'

  const parsed = parsePlayHQUrl(ladderUrl)
  const baseUrl = ladderUrl.replace(/\/ladder\/?$/i, '')
  const leagueName = titleFromSlug(parsed.orgSlug || 'gippsland-league')
  const gradeName = parsed.gradeSlug ? titleFromSlug(parsed.gradeSlug) : FOOTBALL_GRADE
  const season = FOOTBALL_SEASON
  const grade = /senior/i.test(gradeName) ? FOOTBALL_GRADE : gradeName

  logger.info('FootballURLImport: starting real PlayHQ import', { ladderUrl, baseUrl, leagueName, season, grade })
  console.log(`[playhq-football] URL loaded: ${ladderUrl}`)

  const ladderPage = await fetchPage(ladderUrl, 45_000)
  console.log(`[playhq-football] ladder status=${ladderPage.status} contentType=${ladderPage.contentType} bytes=${ladderPage.body.length}`)
  const ladder = parseLadder(ladderPage)
  console.log(`[playhq-football] ladder strategy=${ladder.strategy} rows=${ladder.rows.length} warnings=${ladder.warnings.join(' | ') || 'none'}`)
  report.ladderRows = ladder.rows.length
  report.confidence = ladder.confidence
  report.warnings.push(...ladder.warnings)
  if (ladder.rows.length === 0) {
    await recordFootballImport(null, 'LADDER', ladderUrl, ladder.rows.length, 0, ladder.confidence, 'FAILED', { warnings: ladder.warnings, strategy: ladder.strategy }, 'No ladder rows parsed from PlayHQ ladder URL')
    return { ...report, status: 'NO_DATA', error: `No ladder rows parsed from ${ladderUrl}: ${ladder.warnings.join('; ') || 'unknown parser failure'}` }
  }

  const state = await prisma.state.upsert({ where: { code: 'VIC' }, create: { code: 'VIC', name: 'Victoria' }, update: {} })
  let league = await prisma.league.findFirst({ where: { OR: [{ sourceUrl: baseUrl }, { ladderUrl }, ...(parsed.orgSlug ? [{ playhqOrgSlug: parsed.orgSlug }] : []), { name: leagueName }] } })
  const isNew = !league
  if (!league) {
    league = await prisma.league.create({ data: {
      name: leagueName, shortName: leagueName, stateId: state.id, ...visibleFootballLeagueFields,
      sourceUrl: baseUrl, ladderUrl, playhqOrgSlug: parsed.orgSlug || null, playhqGradeId: parsed.gradeId || null, playhqGradeName: grade, currentSeason: season,
      syncStatus: 'RUNNING', lastSyncAt: new Date(), dataSourceSyncError: null, syncError: null, strengthScore: 60, strengthTier: 3, automaticStrengthRating: 3, finalStrengthRating: 3, strengthConfidence: 0.5,
    } })
  } else {
    league = await prisma.league.update({ where: { id: league.id }, data: { ...visibleFootballLeagueFields, sourceUrl: baseUrl, ladderUrl, playhqOrgSlug: parsed.orgSlug || league.playhqOrgSlug, playhqGradeId: parsed.gradeId || league.playhqGradeId, playhqGradeName: grade, currentSeason: season, syncStatus: 'RUNNING', lastSyncAt: new Date(), dataSourceSyncError: null, syncError: null } })
  }
  report.league = league.name; report.leagueId = league.id; report.isNew = isNew
  console.log(`[playhq-football] league ${isNew ? 'created' : 'updated'}: ${league.name} (${league.id})`)
  await ensurePlayHqLeagueSource(league.id, season, ladderUrl, baseUrl)

  const clubByName = new Map<string, string>()
  let ladderWritten = 0
  for (const row of ladder.rows) {
    const clubId = await resolveFootballClub(row.clubName, state.id, league.name, league.id, season, grade, row)
    clubByName.set(row.clubName.toLowerCase(), clubId)
    const written = await upsertFootballLadder(league.id, season, grade, row, clubId)
    if (written) ladderWritten++
  }
  report.clubsAdded = ladder.rows.length
  report.ladderUpdated = true
  await recordFootballImport(league.id, 'LADDER', ladderUrl, ladder.rows.length, ladderWritten, ladder.confidence, 'COMMITTED', { strategy: ladder.strategy, warnings: ladder.warnings, rows: ladder.rows })
  console.log(`[playhq-football] clubs/ladder written: clubs=${clubByName.size} ladderRows=${ladderWritten}`)

  let goalKickerRows = 0, goalKickersWritten = 0
  if (opts.statisticsUrl) {
    const statisticsPage = await fetchPage(opts.statisticsUrl, 45_000)
    const goalKickers = parseGoalKickers(statisticsPage)
    goalKickerRows = goalKickers.rows.length
    report.confidence = Math.max(report.confidence, goalKickers.confidence)
    report.warnings.push(...goalKickers.warnings)
    for (const row of goalKickers.rows) {
      if (await upsertFootballGoalKicker(league.id, league.name, season, grade, row, clubByName, opts.statisticsUrl)) goalKickersWritten++
    }
    await recordFootballImport(league.id, 'GOAL_KICKERS', opts.statisticsUrl, goalKickerRows, goalKickersWritten, goalKickers.confidence, goalKickerRows ? 'COMMITTED' : 'PREVIEWED', { strategy: goalKickers.strategy, warnings: goalKickers.warnings, rows: goalKickers.rows }, goalKickerRows ? undefined : 'No goal kicker rows parsed from PlayHQ statistics URL')
    console.log(`[playhq-football] goal kickers parsed=${goalKickerRows}; written=${goalKickersWritten}`)
  }

  const roundUrls = discoverRoundUrls(baseUrl, ladderPage.body)
  console.log(`[playhq-football] round URLs discovered/generated: ${roundUrls.length}`)
  let fixtureRows = 0, resultRows = 0, fixturesWritten = 0, resultsWritten = 0
  const roundSummaries: unknown[] = []
  for (const roundUrl of roundUrls) {
    const page = await fetchPage(roundUrl, 45_000)
    const fixtures = parseFixtures(page)
    const results = parseResults(page)
    fixtureRows += fixtures.rows.length; resultRows += results.rows.length
    const round = roundLabel(roundUrl)
    for (const r of fixtures.rows) { if (await upsertFootballFixture(league.id, season, grade, { ...r, round: r.round || round, sourceUrl: roundUrl }, clubByName)) fixturesWritten++ }
    for (const r of results.rows) { if (await upsertFootballResult(league.id, season, grade, { ...r, round: r.round || round, sourceUrl: roundUrl }, clubByName)) resultsWritten++ }
    roundSummaries.push({ roundUrl, status: page.status, bytes: page.body.length, fixtureRows: fixtures.rows.length, resultRows: results.rows.length, fixtureStrategy: fixtures.strategy, resultStrategy: results.strategy, fixtureWarnings: fixtures.warnings, resultWarnings: results.warnings })
    console.log(`[playhq-football] ${round}: status=${page.status} fixtures=${fixtures.rows.length} results=${results.rows.length}`)
  }
  await recordFootballImport(league.id, 'FIXTURES', baseUrl, fixtureRows, fixturesWritten, fixtureRows ? 0.8 : 0.2, fixtureRows ? 'COMMITTED' : 'PREVIEWED', { roundSummaries })
  await recordFootballImport(league.id, 'RESULTS', baseUrl, resultRows, resultsWritten, resultRows ? 0.8 : 0.2, resultRows ? 'COMMITTED' : 'PREVIEWED', { roundSummaries })
  console.log(`[playhq-football] parsed fixtures=${fixtureRows} results=${resultRows}; written fixtures=${fixturesWritten} results=${resultsWritten}`)

  await prisma.league.update({ where: { id: league.id }, data: { ...visibleFootballLeagueFields, syncStatus: 'SUCCESS', lastSuccessfulSyncAt: new Date(), lastSuccessAt: new Date(), lastSyncedAt: new Date(), syncError: null, dataSourceSyncError: null } })

  if (opts.rerank !== false) {
    const { clubsRanked } = await rankAndStore(getISOWeekLabel())
    report.rankingRecalculated = true
    report.clubsRanked = clubsRanked
  }
  console.log(`[playhq-football] database records written: ladder=${ladderWritten} goalKickers=${goalKickersWritten} fixtures=${fixturesWritten} results=${resultsWritten} rankings=${report.rankingRecalculated}`)
  return report
}


async function ensurePlayHqLeagueSource(leagueId: string, season: string, ladderUrl: string, baseUrl: string): Promise<void> {
  const existing = await prisma.leagueSource.findFirst({ where: { leagueId, season, sourceType: 'PLAYHQ' } })
  const data = { ladderUrl, fixturesUrl: baseUrl, resultsUrl: baseUrl, isActive: true, lastStatus: 'SUCCESS', lastScrapedAt: new Date(), notes: 'Imported by PlayHQ URL workflow.' }
  if (existing) await prisma.leagueSource.update({ where: { id: existing.id }, data })
  else await prisma.leagueSource.create({ data: { leagueId, sourceType: 'PLAYHQ', season, ...data } })
}

function discoverRoundUrls(baseUrl: string, html: string): string[] {
  const found = new Set<string>()
  for (const m of html.matchAll(/href=["']([^"']+\/R\d{1,2}(?:[?#][^"']*)?)["']/gi)) {
    const href = m[1].replace(/[?#].*$/, '')
    found.add(href.startsWith('http') ? href : `https://www.playhq.com${href}`)
  }
  for (let round = 1; round <= 25; round++) found.add(`${baseUrl}/R${round}`)
  return [...found].sort((a, b) => Number((/\/R(\d+)/i.exec(a)?.[1]) ?? 0) - Number((/\/R(\d+)/i.exec(b)?.[1]) ?? 0))
}

function roundLabel(url: string): string { return `Round ${(/\/R(\d+)/i.exec(url)?.[1]) ?? 'TBC'}` }

async function resolveFootballClub(name: string, stateId: string, region: string, leagueId: string, season: string, grade: string, row?: LadderRow): Promise<string> {
  const clean = name.trim()
  const slug = `${clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${leagueId.slice(0, 8)}`
  const existing = await prisma.club.findUnique({ where: { slug }, select: { id: true } })
  const club = await prisma.club.upsert({ where: { slug }, create: { name: clean, slug, shortName: clean, stateId, region, sport: FOOTBALL_SPORT, isActive: true, source: 'PLAYHQ_SCRAPER', approvalStatus: 'APPROVED', archivedAt: null, townName: clean }, update: { sport: FOOTBALL_SPORT, isActive: true, archivedAt: null, approvalStatus: 'APPROVED' }, select: { id: true } })
  await prisma.clubNameVariant.upsert({ where: { rawName_sourceType: { rawName: clean, sourceType: 'PLAYHQ_SCRAPER' } }, create: { clubId: club.id, rawName: clean, sourceType: 'PLAYHQ_SCRAPER', confidence: 1 }, update: {} }).catch(() => {})
  await prisma.clubLeagueSeason.upsert({
    where: { clubId_leagueId_season_grade: { clubId: club.id, leagueId, season, grade } },
    create: { clubId: club.id, leagueId, season, grade, sport: FOOTBALL_SPORT, isActive: true, position: row?.position, played: num(row?.played), wins: num(row?.wins), losses: num(row?.losses), draws: num(row?.draws), byes: num(row?.byes), forfeits: num(row?.forfeits), disqualifications: num(row?.disqualified), adjustments: num(row?.adjustedPoints), goalsFor: num(row?.pointsFor), goalsAgainst: num(row?.pointsAgainst), percentage: num(row?.percentage), points: num(row?.points) },
    update: { sport: FOOTBALL_SPORT, isActive: true, position: row?.position, played: num(row?.played), wins: num(row?.wins), losses: num(row?.losses), draws: num(row?.draws), byes: num(row?.byes), forfeits: num(row?.forfeits), disqualifications: num(row?.disqualified), adjustments: num(row?.adjustedPoints), goalsFor: num(row?.pointsFor), goalsAgainst: num(row?.pointsAgainst), percentage: num(row?.percentage), points: num(row?.points) },
  })
  if (!existing) console.log(`[playhq-football] club created: ${clean}`)
  return club.id
}

async function upsertFootballLadder(leagueId: string, season: string, grade: string, r: LadderRow, clubId: string): Promise<boolean> {
  await prisma.footballLadderEntry.upsert({
    where: { leagueId_season_grade_clubName: { leagueId, season, grade, clubName: r.clubName } },
    create: { leagueId, season, grade, clubId, clubName: r.clubName, position: num(r.position, 999), played: num(r.played), wins: num(r.wins), losses: num(r.losses), draws: num(r.draws), pointsFor: num(r.pointsFor), pointsAgainst: num(r.pointsAgainst), percentage: num(r.percentage), premiershipPoints: num(r.points), sourceType: 'PLAYHQ_SCRAPER' },
    update: { clubId, position: num(r.position, 999), played: num(r.played), wins: num(r.wins), losses: num(r.losses), draws: num(r.draws), pointsFor: num(r.pointsFor), pointsAgainst: num(r.pointsAgainst), percentage: num(r.percentage), premiershipPoints: num(r.points), sourceType: 'PLAYHQ_SCRAPER' },
  })
  return true
}

async function upsertFootballGoalKicker(leagueId: string, leagueName: string, season: string, grade: string, r: GoalKickerRow, clubs: Map<string, string>, sourceUrl: string): Promise<boolean> {
  const playerName = r.playerName.trim()
  const clubName = r.clubName.trim()
  const rowSeason = r.season ?? season
  const rowGrade = r.grade ?? grade
  const goals = num(r.goals)
  if (!playerName || !clubName || goals < 0) return false
  const clubId = clubs.get(clubName.toLowerCase()) ?? (await prisma.club.findFirst({ where: { name: { equals: clubName, mode: 'insensitive' }, sport: FOOTBALL_SPORT, archivedAt: null }, select: { id: true } }))?.id ?? null
  await prisma.footballGoalKicker.upsert({
    where: { season_grade_playerName_clubName_leagueName: { season: rowSeason, grade: rowGrade, playerName, clubName, leagueName } },
    create: { playerName, clubId, clubName, leagueId, leagueName, season: rowSeason, grade: rowGrade, goals, matches: r.matches == null ? null : num(r.matches), sourceUrl: r.sourceUrl ?? sourceUrl, sourceType: 'PLAYHQ', importedAt: new Date() },
    update: { clubId, leagueId, leagueName, goals, matches: r.matches == null ? null : num(r.matches), sourceUrl: r.sourceUrl ?? sourceUrl, sourceType: 'PLAYHQ', importedAt: new Date() },
  })
  return true
}

async function upsertFootballFixture(leagueId: string, season: string, grade: string, r: FixtureRow, clubs: Map<string, string>): Promise<boolean> {
  await prisma.footballFixture.upsert({
    where: { leagueId_season_grade_round_homeName_awayName: { leagueId, season, grade, round: r.round ?? 'Round TBC', homeName: r.homeName, awayName: r.awayName } },
    create: { leagueId, season, grade, round: r.round ?? 'Round TBC', homeClubId: clubs.get(r.homeName.toLowerCase()) ?? null, awayClubId: clubs.get(r.awayName.toLowerCase()) ?? null, homeName: r.homeName, awayName: r.awayName, matchDate: r.matchDate ? new Date(r.matchDate) : null, venue: r.venue ?? null, sourceType: 'PLAYHQ_SCRAPER', sourceUrl: r.sourceUrl ?? null },
    update: { matchDate: r.matchDate ? new Date(r.matchDate) : null, venue: r.venue ?? null, sourceType: 'PLAYHQ_SCRAPER', sourceUrl: r.sourceUrl ?? null },
  })
  return true
}

async function upsertFootballResult(leagueId: string, season: string, grade: string, r: ResultRow, clubs: Map<string, string>): Promise<boolean> {
  await prisma.footballResult.upsert({
    where: { leagueId_season_grade_round_homeName_awayName: { leagueId, season, grade, round: r.round ?? 'Round TBC', homeName: r.homeName, awayName: r.awayName } },
    create: { leagueId, season, grade, round: r.round ?? 'Round TBC', homeClubId: clubs.get(r.homeName.toLowerCase()) ?? null, awayClubId: clubs.get(r.awayName.toLowerCase()) ?? null, homeName: r.homeName, awayName: r.awayName, homeGoals: num(r.homeGoals), homeBehinds: num(r.homeBehinds), homePoints: points(r.homeGoals, r.homeBehinds, r.homePoints), awayGoals: num(r.awayGoals), awayBehinds: num(r.awayBehinds), awayPoints: points(r.awayGoals, r.awayBehinds, r.awayPoints), matchDate: r.matchDate ? new Date(r.matchDate) : null, venue: r.venue ?? null, sourceType: 'PLAYHQ_SCRAPER', sourceUrl: r.sourceUrl ?? null },
    update: { homeGoals: num(r.homeGoals), homeBehinds: num(r.homeBehinds), homePoints: points(r.homeGoals, r.homeBehinds, r.homePoints), awayGoals: num(r.awayGoals), awayBehinds: num(r.awayBehinds), awayPoints: points(r.awayGoals, r.awayBehinds, r.awayPoints), matchDate: r.matchDate ? new Date(r.matchDate) : null, venue: r.venue ?? null, sourceType: 'PLAYHQ_SCRAPER', sourceUrl: r.sourceUrl ?? null },
  })
  return true
}

async function recordFootballImport(leagueId: string | null, dataType: 'LADDER' | 'FIXTURES' | 'RESULTS' | 'GOAL_KICKERS', sourceUrl: string, found: number, imported: number, confidence: number, status: string, payload: unknown, error?: string): Promise<void> {
  if (!leagueId) return
  await prisma.footballDataImport.upsert({
    where: { leagueId_sourceType_dataType_payloadHash: { leagueId, sourceType: 'PLAYHQ_SCRAPER', dataType, payloadHash: stableHash({ sourceUrl, dataType }) } },
    create: { leagueId, sourceType: 'PLAYHQ_SCRAPER', dataType, sourceUrl, payloadHash: stableHash({ sourceUrl, dataType }), dryRun: false, status, recordsFound: found, recordsImported: imported, confidence, error, payload: JSON.stringify(payload), scrapedAt: new Date(), createdBy: 'github-actions' },
    update: { status, recordsFound: found, recordsImported: imported, confidence, error, payload: JSON.stringify(payload), scrapedAt: new Date() },
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function titleFromSlug(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim()
}
