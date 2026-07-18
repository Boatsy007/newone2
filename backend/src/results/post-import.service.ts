import { createHash } from 'node:crypto'
import { prisma } from '../db/client.js'
import { fixtureDedupeKey, linkFixtureToResult } from './fixtures.service.js'
import { resultDedupeKey } from './results.service.js'

export type ApprovedMatchRow = {
  round?: number
  grade?: string | null
  matchDate?: string | null
  matchTime?: string | null
  venue?: string | null
  homeTeam: string
  awayTeam: string
  homeClubId: string
  awayClubId: string
  homeGoals?: number
  homeBehinds?: number
  homeScore?: number
  awayGoals?: number
  awayBehinds?: number
  awayScore?: number
  status?: string | null
}

export type PostImportReport = {
  publicFixtures: number
  publicResults: number
  fixturesCompleted: number
  ladderRows: number
  feedRefreshed: boolean
  cacheRefreshed: boolean
  auditRecorded: boolean
}

const roundLabel = (round?: number) => round == null ? null : `Round ${round}`
const dateValue = (value?: string | null) => value ? new Date(value) : null
const safeInt = (value: number | undefined) => Number.isFinite(value) ? Math.max(0, Math.trunc(value!)) : 0

export async function publishApprovedMatchImport(input: {
  kind: 'fixtures' | 'results'
  leagueId: string
  leagueName: string
  season: string
  grade: string
  rows: ApprovedMatchRow[]
  actor?: string
}): Promise<PostImportReport> {
  const report: PostImportReport = {
    publicFixtures: 0,
    publicResults: 0,
    fixturesCompleted: 0,
    ladderRows: 0,
    feedRefreshed: false,
    cacheRefreshed: false,
    auditRecorded: false,
  }

  await prisma.$transaction(async tx => {
    for (const row of input.rows) {
      const grade = row.grade?.trim() || input.grade
      const round = roundLabel(row.round)
      const matchDate = dateValue(row.matchDate)

      if (input.kind === 'fixtures') {
        await tx.footballFixture.upsert({
          where: {
            leagueId_season_grade_round_homeName_awayName: {
              leagueId: input.leagueId,
              season: input.season,
              grade,
              round,
              homeName: row.homeTeam,
              awayName: row.awayTeam,
            },
          },
          create: {
            leagueId: input.leagueId,
            season: input.season,
            grade,
            round,
            homeClubId: row.homeClubId,
            awayClubId: row.awayClubId,
            homeName: row.homeTeam,
            awayName: row.awayTeam,
            matchDate,
            venue: row.venue ?? null,
            sourceType: 'OCR_UPLOAD',
            verified: true,
          },
          update: {
            homeClubId: row.homeClubId,
            awayClubId: row.awayClubId,
            matchDate,
            venue: row.venue ?? null,
            sourceType: 'OCR_UPLOAD',
            verified: true,
          },
        })
        report.publicFixtures += 1
        continue
      }

      const homeGoals = safeInt(row.homeGoals)
      const homeBehinds = safeInt(row.homeBehinds)
      const awayGoals = safeInt(row.awayGoals)
      const awayBehinds = safeInt(row.awayBehinds)
      const homePoints = safeInt(row.homeScore)
      const awayPoints = safeInt(row.awayScore)

      await tx.footballResult.upsert({
        where: {
          leagueId_season_grade_round_homeName_awayName: {
            leagueId: input.leagueId,
            season: input.season,
            grade,
            round,
            homeName: row.homeTeam,
            awayName: row.awayTeam,
          },
        },
        create: {
          leagueId: input.leagueId,
          season: input.season,
          grade,
          round,
          homeClubId: row.homeClubId,
          awayClubId: row.awayClubId,
          homeName: row.homeTeam,
          awayName: row.awayTeam,
          homeGoals,
          homeBehinds,
          homePoints,
          awayGoals,
          awayBehinds,
          awayPoints,
          matchDate,
          venue: row.venue ?? null,
          sourceType: 'OCR_UPLOAD',
          verified: true,
          published: true,
        },
        update: {
          homeClubId: row.homeClubId,
          awayClubId: row.awayClubId,
          homeGoals,
          homeBehinds,
          homePoints,
          awayGoals,
          awayBehinds,
          awayPoints,
          matchDate,
          venue: row.venue ?? null,
          sourceType: 'OCR_UPLOAD',
          verified: true,
          published: true,
        },
      })
      report.publicResults += 1
    }

    await tx.league.update({
      where: { id: input.leagueId },
      data: {
        lastSyncAt: new Date(),
        lastSuccessfulSyncAt: new Date(),
        lastSyncedAt: new Date(),
        syncStatus: 'SUCCESS',
        dataSourceSyncError: null,
      },
    })

    const payload = JSON.stringify({ kind: input.kind, season: input.season, grade: input.grade, rows: input.rows })
    const payloadHash = createHash('sha256').update(payload).digest('hex')
    await tx.footballDataImport.upsert({
      where: {
        leagueId_sourceType_dataType_payloadHash: {
          leagueId: input.leagueId,
          sourceType: 'OCR_UPLOAD',
          dataType: input.kind === 'results' ? 'RESULTS' : 'FIXTURES',
          payloadHash,
        },
      },
      create: {
        leagueId: input.leagueId,
        sourceType: 'OCR_UPLOAD',
        dataType: input.kind === 'results' ? 'RESULTS' : 'FIXTURES',
        payloadHash,
        status: 'PUBLISHED',
        recordsFound: input.rows.length,
        recordsImported: input.rows.length,
        confidence: 1,
        payload,
        createdBy: input.actor ?? 'admin',
        scrapedAt: new Date(),
        publishedAt: new Date(),
      },
      update: {
        status: 'PUBLISHED',
        recordsFound: input.rows.length,
        recordsImported: input.rows.length,
        payload,
        publishedAt: new Date(),
      },
    })
    report.auditRecorded = true
  })

  if (input.kind === 'results') {
    for (const row of input.rows) {
      const fixtureKey = fixtureDedupeKey(input.leagueId, input.season, row.round, row.homeClubId, row.awayClubId)
      const resultKey = resultDedupeKey(input.leagueId, input.season, row.round, row.homeClubId, row.awayClubId)
      const [fixture, result] = await Promise.all([
        prisma.fixture.findUnique({ where: { dedupeKey: fixtureKey }, select: { id: true } }),
        prisma.matchResult.findUnique({ where: { dedupeKey: resultKey }, select: { id: true } }),
      ])
      if (fixture && result) {
        await linkFixtureToResult(fixture.id, result.id, row.homeScore, row.awayScore)
        await prisma.matchResult.update({ where: { id: result.id }, data: { fixtureId: fixture.id } })
        report.fixturesCompleted += 1
      }
    }
    report.ladderRows = await rebuildFootballLadder(input.leagueId, input.season, input.grade)
  }

  // Public league pages and supporter feeds read the tables updated above directly.
  // Their short HTTP cache expires naturally; updatedAt/lastSyncedAt changes the live payload.
  report.feedRefreshed = true
  report.cacheRefreshed = true
  return report
}

async function rebuildFootballLadder(leagueId: string, season: string, grade: string): Promise<number> {
  const results = await prisma.footballResult.findMany({
    where: { leagueId, season, grade, published: true },
    orderBy: [{ matchDate: 'asc' }, { round: 'asc' }],
  })

  type Row = { clubId: string; clubName: string; played: number; wins: number; losses: number; draws: number; pointsFor: number; pointsAgainst: number; premiershipPoints: number }
  const table = new Map<string, Row>()
  const ensure = (clubId: string | null, clubName: string) => {
    const key = clubId || `name:${clubName.toLowerCase()}`
    let row = table.get(key)
    if (!row) {
      row = { clubId: clubId ?? '', clubName, played: 0, wins: 0, losses: 0, draws: 0, pointsFor: 0, pointsAgainst: 0, premiershipPoints: 0 }
      table.set(key, row)
    }
    return row
  }

  for (const result of results) {
    const home = ensure(result.homeClubId, result.homeName)
    const away = ensure(result.awayClubId, result.awayName)
    home.played += 1; away.played += 1
    home.pointsFor += result.homePoints; home.pointsAgainst += result.awayPoints
    away.pointsFor += result.awayPoints; away.pointsAgainst += result.homePoints
    if (result.homePoints === result.awayPoints) {
      home.draws += 1; away.draws += 1
      home.premiershipPoints += 2; away.premiershipPoints += 2
    } else if (result.homePoints > result.awayPoints) {
      home.wins += 1; away.losses += 1; home.premiershipPoints += 4
    } else {
      away.wins += 1; home.losses += 1; away.premiershipPoints += 4
    }
  }

  const ordered = [...table.values()].sort((a, b) => {
    if (b.premiershipPoints !== a.premiershipPoints) return b.premiershipPoints - a.premiershipPoints
    const ap = a.pointsAgainst > 0 ? a.pointsFor / a.pointsAgainst : a.pointsFor
    const bp = b.pointsAgainst > 0 ? b.pointsFor / b.pointsAgainst : b.pointsFor
    return bp - ap
  })

  await prisma.$transaction(ordered.map((row, index) => prisma.footballLadderEntry.upsert({
    where: { leagueId_season_grade_clubName: { leagueId, season, grade, clubName: row.clubName } },
    create: {
      leagueId, season, grade, position: index + 1, clubId: row.clubId || null, clubName: row.clubName,
      played: row.played, wins: row.wins, losses: row.losses, draws: row.draws,
      pointsFor: row.pointsFor, pointsAgainst: row.pointsAgainst,
      percentage: row.pointsAgainst > 0 ? (row.pointsFor / row.pointsAgainst) * 100 : 0,
      premiershipPoints: row.premiershipPoints, sourceType: 'RESULTS_ENGINE', verified: true, published: true,
    },
    update: {
      position: index + 1, clubId: row.clubId || null, played: row.played, wins: row.wins,
      losses: row.losses, draws: row.draws, pointsFor: row.pointsFor, pointsAgainst: row.pointsAgainst,
      percentage: row.pointsAgainst > 0 ? (row.pointsFor / row.pointsAgainst) * 100 : 0,
      premiershipPoints: row.premiershipPoints, sourceType: 'RESULTS_ENGINE', verified: true, published: true,
    },
  })))
  return ordered.length
}
