import type { Prisma } from '@prisma/client'
import { prisma } from '../db/client.js'

export const publicRankedClub = { sport: 'FOOTBALL', archivedAt: null, isActive: true } as const
export const publicRankedLeague = { sport: 'FOOTBALL', archivedAt: null, isActive: true } as const

const rankingSourceTypes = ['PLAYHQ', 'PLAYHQ_API', 'PLAYHQ_SCRAPER', 'NETBALL_CONNECT', 'MANUAL_IMAGE', 'OCR_UPLOAD', 'CSV_IMPORT'] as const

export async function getCanonicalRankingRun(season?: string) {
  const runs = await prisma.rankingRun.findMany({
    where: { status: 'COMPLETED', ...(season ? { season } : {}) },
    orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
    take: 50,
  })

  for (const run of runs) {
    const visibleEntries = await prisma.rankingEntry.count({
      where: { runId: run.id, club: publicRankedClub, league: publicRankedLeague },
    })
    if (visibleEntries > 0) return { run, visibleEntries }
  }
  return null
}

export async function rankingRunIntegrity(runId: string) {
  const run = await prisma.rankingRun.findUnique({ where: { id: runId }, select: { season: true } })
  if (!run) throw new Error(`Ranking run ${runId} was not found`)

  const [entries, memberships, activeSources] = await Promise.all([
    prisma.rankingEntry.findMany({
      where: { runId, club: publicRankedClub, league: publicRankedLeague },
      select: { clubId: true, rank: true, previousRank: true, rankMovement: true, calculatedAt: true },
      orderBy: { rank: 'asc' },
    }),
    prisma.clubLeagueSeason.findMany({
      where: { isActive: true, club: publicRankedClub, league: publicRankedLeague },
      select: {
        clubId: true,
        leagueId: true,
        season: true,
        grade: true,
        played: true,
        club: { select: { name: true, approvalStatus: true, source: true, state: { select: { code: true } } } },
        league: { select: { name: true, enabled: true } },
      },
      orderBy: [{ played: 'desc' }, { updatedAt: 'desc' }],
    }),
    prisma.leagueSource.findMany({
      where: { season: run.season, isActive: true, sourceType: { in: [...rankingSourceTypes] } },
      select: { leagueId: true },
    }),
  ])

  const clubCounts = new Map<string, number>()
  const rankCounts = new Map<number, number>()
  for (const row of entries) {
    clubCounts.set(row.clubId, (clubCounts.get(row.clubId) ?? 0) + 1)
    rankCounts.set(row.rank, (rankCounts.get(row.rank) ?? 0) + 1)
  }

  const duplicateClubIds = [...clubCounts].filter(([, count]) => count > 1).map(([id]) => id)
  const duplicateRanks = [...rankCounts].filter(([, count]) => count > 1).map(([rank]) => rank)
  const ranked = new Set(entries.map(row => row.clubId))
  const sourceLeagueIds = new Set(activeSources.map(source => source.leagueId))

  const membershipsByClub = new Map<string, typeof memberships>()
  for (const membership of memberships) {
    const rows = membershipsByClub.get(membership.clubId) ?? []
    rows.push(membership)
    membershipsByClub.set(membership.clubId, rows)
  }

  const eligibleClubIds: string[] = []
  const excludedClubs: Array<{ clubId: string; clubName: string; leagueId: string | null; leagueName: string | null; state: string | null; reason: string }> = []

  for (const [clubId, rows] of membershipsByClub) {
    const currentRows = rows.filter(row => row.season === run.season)
    const representative = currentRows[0] ?? rows[0]
    const approved = representative.club.approvalStatus === 'APPROVED' || (representative.club.approvalStatus === 'PENDING' && representative.club.source === 'MANUAL_IMAGE')
    const eligibleRow = currentRows.find(row => row.league.enabled && sourceLeagueIds.has(row.leagueId) && approved)

    if (eligibleRow) {
      eligibleClubIds.push(clubId)
      if (!ranked.has(clubId)) {
        excludedClubs.push({
          clubId,
          clubName: eligibleRow.club.name,
          leagueId: eligibleRow.leagueId,
          leagueName: eligibleRow.league.name,
          state: eligibleRow.club.state?.code ?? null,
          reason: eligibleRow.played === 0 ? 'Current-season membership has no games played' : 'Eligible current-season club was omitted from the ranking run',
        })
      }
      continue
    }

    let reason = 'Not eligible for the current ranking run'
    if (currentRows.length === 0) reason = `No active ${run.season} membership`
    else if (!approved) reason = 'Club is not approved for public rankings'
    else if (currentRows.every(row => !row.league.enabled)) reason = 'League is disabled'
    else if (currentRows.every(row => !sourceLeagueIds.has(row.leagueId))) reason = `League has no active ${run.season} ranking source`

    excludedClubs.push({
      clubId,
      clubName: representative.club.name,
      leagueId: representative.leagueId ?? null,
      leagueName: representative.league.name ?? null,
      state: representative.club.state?.code ?? null,
      reason,
    })
  }

  const excludedClubIds = eligibleClubIds.filter(id => !ranked.has(id))
  const invalidMovement = entries.filter(row => row.previousRank != null && row.rankMovement !== row.previousRank - row.rank).length
  const expectedRanks = entries.map((_, index) => index + 1)
  const missingRanks = expectedRanks.filter(rank => !rankCounts.has(rank))

  return {
    totalEntries: entries.length,
    eligibleClubs: eligibleClubIds.length,
    candidateClubs: membershipsByClub.size,
    duplicateClubIds,
    duplicateRanks,
    excludedClubIds,
    excludedClubs,
    missingRanks,
    invalidMovement,
    healthy: duplicateClubIds.length === 0 && duplicateRanks.length === 0 && missingRanks.length === 0 && invalidMovement === 0 && excludedClubIds.length === 0,
  }
}

export type RankingTransaction = Prisma.TransactionClient
