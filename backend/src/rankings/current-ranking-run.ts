import type { Prisma } from '@prisma/client'
import { prisma } from '../db/client.js'

export const publicRankedClub = { sport: 'FOOTBALL', archivedAt: null, isActive: true } as const
export const publicRankedLeague = { sport: 'FOOTBALL', archivedAt: null, isActive: true } as const

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
  const [entries, eligibleClubs] = await Promise.all([
    prisma.rankingEntry.findMany({
      where: { runId, club: publicRankedClub, league: publicRankedLeague },
      select: { clubId: true, rank: true, previousRank: true, rankMovement: true, calculatedAt: true },
      orderBy: { rank: 'asc' },
    }),
    prisma.clubLeagueSeason.findMany({
      where: { isActive: true, club: publicRankedClub, league: publicRankedLeague },
      distinct: ['clubId'],
      select: { clubId: true },
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
  const excludedClubIds = eligibleClubs.map(row => row.clubId).filter(id => !ranked.has(id))
  const invalidMovement = entries.filter(row => row.previousRank != null && row.rankMovement !== row.previousRank - row.rank).length
  const expectedRanks = entries.map((_, index) => index + 1)
  const missingRanks = expectedRanks.filter(rank => !rankCounts.has(rank))

  return {
    totalEntries: entries.length,
    eligibleClubs: eligibleClubs.length,
    duplicateClubIds,
    duplicateRanks,
    excludedClubIds,
    missingRanks,
    invalidMovement,
    healthy: duplicateClubIds.length === 0 && duplicateRanks.length === 0 && missingRanks.length === 0 && invalidMovement === 0,
  }
}

export type RankingTransaction = Prisma.TransactionClient
