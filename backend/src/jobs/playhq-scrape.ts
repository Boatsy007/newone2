/**
 * PlayHQ Multi-League Scrape + Rank Job
 *
 * Scrapes configured ladders, stores their season data and then creates one
 * national ranking run across every active football ladder source.
 */

import { prisma } from '../db/client.js'
import { PlayHQPlaywrightAdapter } from '../adapters/playhq-playwright.adapter.js'
import { RankingEngine } from '../engine/ranking.engine.js'
import { getISOWeekLabel } from '../utils/week-label.js'
import { logger } from '../utils/logger.js'
import { strengthForStars } from '../config/league-strength.js'
import { computeAutomaticStrength, strengthScoreFromRating } from '../config/league-strength-auto.js'
import type { ClubRankingInput, MatchResult, AustralianState } from '../types/index.js'

const SEASON = '2026'
const GRADE = 'A Grade'

export interface LeagueConfig {
  name: string
  shortName: string
  state: AustralianState
  region: string
  slugSuffix: string
  stars: number
  urlEnvVar: string
  defaultUrl?: string
}

export const LEAGUE_CONFIGS: LeagueConfig[] = [
  {
    name: 'Gippsland League - A Grade Netball',
    shortName: 'Gippsland League A Grade',
    state: 'VIC',
    region: 'Gippsland',
    slugSuffix: 'gfl',
    stars: 4.0,
    urlEnvVar: 'GIPPSLAND_PLAYHQ_URL',
  },
  {
    name: 'Geelong & District FNL - A Grade Netball',
    shortName: 'GDFNL A Grade',
    state: 'VIC',
    region: 'Geelong',
    slugSuffix: 'gdfnl',
    stars: 4.0,
    urlEnvVar: 'GDFNL_PLAYHQ_URL',
    defaultUrl: 'https://www.playhq.com/netball-australia/org/geelong-and-district-football-netball-league/gdfnl-netball-winter-competition-2026/a-grade-buckleys-cup/74c225ef/ladder',
  },
  {
    name: 'Bellarine FNL - A Grade Netball',
    shortName: 'Bellarine FNL A Grade',
    state: 'VIC',
    region: 'Bellarine',
    slugSuffix: 'bfnl',
    stars: 5.0,
    urlEnvVar: 'BELLARINE_PLAYHQ_URL',
    defaultUrl: 'https://www.playhq.com/netball-australia/org/geelong-amateur/ada7613a/afl-barwon-fnl-winter-2026/teams/geelong-amateur-a-grade/76aa95bb/ladder',
  },
]

export interface LeagueScrapeOutcome {
  league: string
  status: 'SUCCESS' | 'NO_DATA' | 'FAILED'
  teams: number
  method?: string
  error?: string
}

export interface PlayHQScrapeResult {
  runId: string
  weekLabel: string
  season: string
  clubsRanked: number
  leagues: LeagueScrapeOutcome[]
  status: 'SUCCESS' | 'FAILED'
  error?: string
}

export async function runAllPlayHQScrapes(options: { weekLabel?: string } = {}): Promise<PlayHQScrapeResult> {
  const label = options.weekLabel ?? getISOWeekLabel()
  logger.info('PlayHQScrape: starting', { weekLabel: label, leagues: LEAGUE_CONFIGS.length })

  const outcomes: LeagueScrapeOutcome[] = []
  for (const config of LEAGUE_CONFIGS) {
    const url = process.env[config.urlEnvVar] || config.defaultUrl
    if (!url) {
      logger.warn('PlayHQScrape: no URL for league, skipping', { league: config.name, envVar: config.urlEnvVar })
      outcomes.push({ league: config.name, status: 'FAILED', teams: 0, error: `No ladder URL (set ${config.urlEnvVar})` })
      continue
    }
    outcomes.push(await scrapeLeagueData(config, url))
  }

  if (!outcomes.some(outcome => outcome.status === 'SUCCESS')) {
    logger.error('PlayHQScrape: no league produced data — skipping ranking')
    return {
      runId: '',
      weekLabel: label,
      season: SEASON,
      clubsRanked: 0,
      leagues: outcomes,
      status: 'FAILED',
      error: 'No league produced ladder data',
    }
  }

  try {
    const { runId, clubsRanked } = await rankAndStore(label)
    logger.info('PlayHQScrape: complete', {
      runId,
      clubsRanked,
      leagues: outcomes.map(outcome => `${outcome.league}:${outcome.status}(${outcome.teams})`),
    })
    return { runId, weekLabel: label, season: SEASON, clubsRanked, leagues: outcomes, status: 'SUCCESS' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('PlayHQScrape: ranking failed', { error: message })
    return { runId: '', weekLabel: label, season: SEASON, clubsRanked: 0, leagues: outcomes, status: 'FAILED', error: message }
  }
}

async function scrapeLeagueData(config: LeagueConfig, ladderUrl: string): Promise<LeagueScrapeOutcome> {
  logger.info('PlayHQScrape: scraping league', { league: config.name, url: ladderUrl })

  try {
    const adapter = new PlayHQPlaywrightAdapter()
    const scraped = await adapter.scrapeLadder(ladderUrl)
    if (scraped.entries.length === 0) {
      logger.warn('PlayHQScrape: 0 entries', { league: config.name, method: scraped.method })
      return { league: config.name, status: 'NO_DATA', teams: 0, method: scraped.method, error: 'Scraper returned 0 ladder entries' }
    }

    const state = await prisma.state.upsert({
      where: { code: config.state },
      create: { code: config.state, name: config.state },
      update: {},
    })

    const automatic = computeAutomaticStrength(scraped.entries, 1)
    const finalRating = config.stars
    const strengthData = {
      automaticStrengthRating: automatic.rating,
      manualStrengthOverride: config.stars,
      finalStrengthRating: finalRating,
      strengthConfidence: automatic.confidence,
      strengthScore: strengthScoreFromRating(finalRating),
      strengthTier: Math.max(1, Math.min(5, Math.round(finalRating))),
      strengthNotes: `Manual override ${config.stars}★ (auto ${automatic.rating}★, confidence ${automatic.confidence.toFixed(2)}).`,
      sport: 'FOOTBALL',
    }

    let league = await prisma.league.findFirst({ where: { shortName: config.shortName, stateId: state.id } })
    if (!league) {
      league = await prisma.league.create({
        data: { name: config.name, shortName: config.shortName, stateId: state.id, isActive: true, ...strengthData },
      })
    } else {
      league = await prisma.league.update({ where: { id: league.id }, data: strengthData })
    }

    const source = await prisma.leagueSource.findFirst({
      where: { leagueId: league.id, season: SEASON, sourceType: 'PLAYHQ' },
    })
    if (source) {
      await prisma.leagueSource.update({
        where: { id: source.id },
        data: {
          ladderUrl,
          isActive: true,
          lastStatus: 'SUCCESS',
          lastScrapedAt: new Date(),
          notes: `Live PlayHQ scrape (${scraped.method}). Entries: ${scraped.entries.length}.`,
        },
      })
    } else {
      await prisma.leagueSource.create({
        data: {
          leagueId: league.id,
          sourceType: 'PLAYHQ',
          season: SEASON,
          isActive: true,
          ladderUrl,
          notes: `Live PlayHQ scrape (${scraped.method}).`,
          lastStatus: 'SUCCESS',
          lastScrapedAt: new Date(),
        },
      })
    }

    const slugify = (name: string) =>
      `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${config.slugSuffix}`

    const clubIds: string[] = []
    for (const entry of scraped.entries) {
      const club = await prisma.club.upsert({
        where: { slug: slugify(entry.teamRaw) },
        create: {
          name: entry.teamRaw,
          slug: slugify(entry.teamRaw),
          shortName: entry.teamRaw,
          stateId: state.id,
          region: config.region,
          isActive: true,
          sport: 'FOOTBALL',
          approvalStatus: 'APPROVED',
        },
        update: { isActive: true, sport: 'FOOTBALL' },
        select: { id: true },
      })
      clubIds.push(club.id)

      await prisma.clubLeagueSeason.upsert({
        where: {
          clubId_leagueId_season_grade: {
            clubId: club.id,
            leagueId: league.id,
            season: SEASON,
            grade: GRADE,
          },
        },
        create: {
          clubId: club.id,
          leagueId: league.id,
          season: SEASON,
          grade: GRADE,
          sport: 'FOOTBALL',
          isActive: true,
          played: entry.played,
          wins: entry.wins,
          losses: entry.losses,
          draws: entry.draws,
          goalsFor: entry.goalsFor,
          goalsAgainst: entry.goalsAgainst,
          percentage: entry.percentage,
          points: entry.points,
        },
        update: {
          sport: 'FOOTBALL',
          isActive: true,
          played: entry.played,
          wins: entry.wins,
          losses: entry.losses,
          draws: entry.draws,
          goalsFor: entry.goalsFor,
          goalsAgainst: entry.goalsAgainst,
          percentage: entry.percentage,
          points: entry.points,
        },
      })
    }

    const removed = await prisma.clubLeagueSeason.updateMany({
      where: { leagueId: league.id, season: SEASON, grade: GRADE, clubId: { notIn: clubIds } },
      data: { isActive: false },
    })

    logger.info('PlayHQScrape: league stored', {
      league: config.name,
      teams: clubIds.length,
      deactivated: removed.count,
      method: scraped.method,
    })
    return { league: config.name, status: 'SUCCESS', teams: clubIds.length, method: scraped.method }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('PlayHQScrape: league failed', { league: config.name, error: message })
    return { league: config.name, status: 'FAILED', teams: 0, error: message }
  }
}

export async function rankAndStore(label: string): Promise<{ runId: string; clubsRanked: number }> {
  const inputs = await buildPlayHQRankingInputs(SEASON)
  logger.info('PlayHQScrape: ranking inputs', { count: inputs.length })

  if (inputs.length === 0) throw new Error('No active clubs are eligible for national rankings')

  const previousRun = await prisma.rankingRun.findFirst({
    where: { status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
    include: { entries: { select: { clubId: true, rank: true } } },
  })
  const previousRanks = new Map(previousRun?.entries.map(entry => [entry.clubId, entry.rank]) ?? [])

  const engine = new RankingEngine()
  const rankings = engine.rankCohort(inputs, previousRanks, label, SEASON)

  const run = await prisma.rankingRun.create({
    data: {
      weekLabel: label,
      season: SEASON,
      status: 'COMPLETED',
      clubCount: rankings.length,
      completedAt: new Date(),
      notes: 'National ranking — every active football league source; legacy sport fields accepted.',
      entries: {
        create: rankings.map(ranking => ({
          clubId: ranking.clubId,
          clubName: ranking.clubName,
          leagueId: ranking.leagueId,
          leagueName: ranking.leagueName,
          state: ranking.state,
          rank: ranking.rank,
          previousRank: ranking.previousRank ?? null,
          rankMovement: ranking.rankMovement,
          powerRating: ranking.powerRating,
          componentScores: JSON.stringify(ranking.componentScores),
          recentForm: JSON.stringify(ranking.recentForm),
          calculatedAt: ranking.calculatedAt,
        })),
      },
    },
  })

  return { runId: run.id, clubsRanked: rankings.length }
}

/**
 * Build one complete national cohort.
 *
 * Legacy records are deliberately accepted when their additive sport field is
 * null or still carries the old NETBALL default. Their league source and active
 * football league are the source of truth. A manually approved OCR import may
 * retain an identity-review item, so PENDING is accepted only for MANUAL_IMAGE
 * clubs; rejected clubs remain excluded.
 */
async function buildPlayHQRankingInputs(season: string): Promise<ClubRankingInput[]> {
  const sources = await prisma.leagueSource.findMany({
    where: {
      sourceType: { in: ['PLAYHQ', 'PLAYHQ_API', 'PLAYHQ_SCRAPER', 'NETBALL_CONNECT', 'MANUAL_IMAGE', 'OCR_UPLOAD', 'CSV_IMPORT'] },
      season,
      isActive: true,
      league: { archivedAt: null, isActive: true, enabled: true, sport: 'FOOTBALL' },
    },
    select: { leagueId: true },
  })
  const leagueIds = [...new Set(sources.map(source => source.leagueId))]
  if (leagueIds.length === 0) return []

  const seasons = await prisma.clubLeagueSeason.findMany({
    where: {
      leagueId: { in: leagueIds },
      season,
      isActive: true,
      club: {
        archivedAt: null,
        isActive: true,
        OR: [
          { approvalStatus: 'APPROVED' },
          { approvalStatus: 'PENDING', source: 'MANUAL_IMAGE' },
        ],
      },
      league: { archivedAt: null, isActive: true, enabled: true, sport: 'FOOTBALL' },
    },
    include: { club: { include: { state: true } }, league: true },
  })

  const normaliseGrade = (value: string | null | undefined) => (value ?? '').trim().toLowerCase()
  const preferredMembership = (
    candidate: (typeof seasons)[number],
    current: (typeof seasons)[number],
  ) => {
    const candidateConfiguredGrade = normaliseGrade(candidate.league.gradeOverride)
    const currentConfiguredGrade = normaliseGrade(current.league.gradeOverride)
    const candidateMatchesConfigured = Boolean(candidateConfiguredGrade) && normaliseGrade(candidate.grade) === candidateConfiguredGrade
    const currentMatchesConfigured = Boolean(currentConfiguredGrade) && normaliseGrade(current.grade) === currentConfiguredGrade

    if (candidateMatchesConfigured !== currentMatchesConfigured) return candidateMatchesConfigured
    if (candidate.played !== current.played) return candidate.played > current.played

    const candidateStrength = candidate.league.strengthScore ?? 0
    const currentStrength = current.league.strengthScore ?? 0
    if (candidateStrength !== currentStrength) return candidateStrength > currentStrength

    if (candidate.points !== current.points) return candidate.points > current.points
    return candidate.updatedAt.getTime() > current.updatedAt.getTime()
  }

  const bestByClub = new Map<string, (typeof seasons)[number]>()
  for (const clubSeason of seasons) {
    const current = bestByClub.get(clubSeason.clubId)
    if (!current || preferredMembership(clubSeason, current)) {
      bestByClub.set(clubSeason.clubId, clubSeason)
    }
  }

  const bestByTeam = new Map<string, (typeof seasons)[number]>()
  const teamKey = (clubSeason: (typeof seasons)[number]) =>
    `${(clubSeason.club.name || '').toLowerCase().replace(/\ba\s*grade\b/g, '').replace(/[^a-z0-9]/g, '')}|${clubSeason.club.state?.code ?? 'VIC'}`

  for (const clubSeason of bestByClub.values()) {
    const key = teamKey(clubSeason)
    const current = bestByTeam.get(key)
    if (!current || preferredMembership(clubSeason, current)) {
      bestByTeam.set(key, clubSeason)
    }
  }

  return [...bestByTeam.values()].map(clubSeason => ({
    clubId: clubSeason.clubId,
    clubName: clubSeason.club.name,
    leagueId: clubSeason.leagueId,
    leagueName: clubSeason.league.name,
    state: (clubSeason.club.state?.code ?? 'VIC') as AustralianState,
    season,
    played: clubSeason.played,
    wins: clubSeason.wins,
    losses: clubSeason.losses,
    draws: clubSeason.draws,
    goalsFor: clubSeason.goalsFor,
    goalsAgainst: clubSeason.goalsAgainst,
    percentage: clubSeason.percentage,
    recentForm: deriveForm(clubSeason.wins, clubSeason.played),
    leagueStrengthScore: clubSeason.league.strengthScore ?? strengthForStars(3.0).score,
    finalsWins: clubSeason.finalsWins,
    finalsLosses: clubSeason.finalsLosses,
    oppositionRatings: [],
  }))
}

function deriveForm(wins: number, played: number): MatchResult[] {
  if (played === 0) return ['L', 'L', 'L', 'L', 'L']
  const winRate = wins / played
  const estimatedWins = Math.max(0, Math.min(5, Math.round(winRate * 5)))
  return Array.from({ length: 5 }, (_, index) => index < estimatedWins ? 'W' : 'L')
}
