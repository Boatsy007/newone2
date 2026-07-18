import { prisma } from '../db/client.js'
import { recalculateNational } from '../jobs/recompute-strength.js'
import { notify } from '../notifications/notify.js'

export type RankingEffectReport = {
  recalculated: boolean
  clubsRanked: number
  affectedClubs: number
  rankingChanges: number
  notificationsCreated: number
  notificationsSuppressed: number
  notificationDuplicates: number
  error: string | null
}

type RankSnapshot = {
  clubId: string
  clubName: string
  rank: number
  powerRating: number
}

const followType = (entityType: 'CLUB' | 'LEAGUE', entityId: string) => `FOLLOW_${entityType}:${entityId}`

export async function processApprovedResultEffects(input: {
  leagueId: string
  leagueName: string
  season: string
  clubIds: string[]
}): Promise<RankingEffectReport> {
  const clubIds = [...new Set(input.clubIds.filter(Boolean))]
  const report: RankingEffectReport = {
    recalculated: false,
    clubsRanked: 0,
    affectedClubs: clubIds.length,
    rankingChanges: 0,
    notificationsCreated: 0,
    notificationsSuppressed: 0,
    notificationDuplicates: 0,
    error: null,
  }

  try {
    const before = await latestRanks(clubIds)
    const recalculation = await recalculateNational()
    report.recalculated = true
    report.clubsRanked = recalculation.clubsRanked

    const after = await latestRanks(clubIds)
    const changed = clubIds
      .map(clubId => ({ clubId, before: before.get(clubId), after: after.get(clubId) }))
      .filter(row => row.after && (!row.before || row.before.rank !== row.after.rank || row.before.powerRating !== row.after.powerRating))

    report.rankingChanges = changed.length

    const clubFollowers = await prisma.notificationPreference.findMany({
      where: {
        recipientScope: 'USER',
        enabled: true,
        channel: 'IN_APP',
        type: { in: clubIds.map(clubId => followType('CLUB', clubId)) },
      },
      select: { recipientId: true, clubId: true, type: true },
    })

    for (const change of changed) {
      const current = change.after!
      const previousRank = change.before?.rank ?? null
      const movement = previousRank == null ? 0 : previousRank - current.rank
      const notificationType = movement > 0 ? 'CLUB_MOVED_UP' : movement < 0 ? 'CLUB_MOVED_DOWN' : 'RANKINGS_UPDATED'
      const title = previousRank == null
        ? `${current.clubName} entered the national rankings at #${current.rank}`
        : movement > 0
          ? `${current.clubName} moved up to #${current.rank}`
          : movement < 0
            ? `${current.clubName} moved to #${current.rank}`
            : `${current.clubName}'s national rating was updated`
      const body = previousRank == null
        ? `Their PlayFooty power rating is ${current.powerRating.toFixed(1)}.`
        : `Previously #${previousRank}. Current power rating: ${current.powerRating.toFixed(1)}.`

      const followers = clubFollowers.filter(pref => pref.clubId === change.clubId || pref.type === followType('CLUB', change.clubId))
      for (const follower of followers) {
        if (!follower.recipientId) continue
        const result = await notify({
          type: notificationType,
          recipientScope: 'USER',
          recipientId: follower.recipientId,
          title,
          body,
          entityType: 'CLUB',
          entityId: change.clubId,
          dedupeKey: `result-rank:${input.season}:${input.leagueId}:${change.clubId}:${current.rank}:${current.powerRating.toFixed(3)}`,
          data: { leagueId: input.leagueId, previousRank, rank: current.rank, powerRating: current.powerRating },
        })
        countNotification(report, result)
      }
    }

    const leagueFollowers = await prisma.notificationPreference.findMany({
      where: {
        recipientScope: 'USER',
        enabled: true,
        channel: 'IN_APP',
        type: followType('LEAGUE', input.leagueId),
      },
      select: { recipientId: true },
    })

    for (const follower of leagueFollowers) {
      if (!follower.recipientId) continue
      const result = await notify({
        type: 'RANKINGS_UPDATED',
        recipientScope: 'USER',
        recipientId: follower.recipientId,
        title: `${input.leagueName} results updated the national rankings`,
        body: `${changed.length} club ranking${changed.length === 1 ? '' : 's'} changed after approved results.`,
        entityType: 'LEAGUE',
        entityId: input.leagueId,
        dedupeKey: `league-rank:${input.season}:${input.leagueId}:${rankingSignature(changed.map(row => row.after!))}`,
        data: { leagueId: input.leagueId, rankingChanges: changed.length },
      })
      countNotification(report, result)
    }

    await notify({
      type: 'RANKINGS_UPDATED',
      recipientScope: 'ADMIN',
      title: `National rankings recalculated after ${input.leagueName} results`,
      body: `${recalculation.clubsRanked} clubs ranked; ${changed.length} affected club ranking changes.`,
      entityType: 'LEAGUE',
      entityId: input.leagueId,
      dedupeKey: `admin-result-rank:${input.season}:${input.leagueId}:${rankingSignature(changed.map(row => row.after!))}`,
      data: { leagueId: input.leagueId, clubsRanked: recalculation.clubsRanked, rankingChanges: changed.length },
    })

    return report
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error)
    return report
  }
}

async function latestRanks(clubIds: string[]): Promise<Map<string, RankSnapshot>> {
  if (!clubIds.length) return new Map()
  const run = await prisma.rankingRun.findFirst({
    where: { status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
    select: { id: true },
  })
  if (!run) return new Map()
  const rows = await prisma.rankingEntry.findMany({
    where: { runId: run.id, clubId: { in: clubIds } },
    select: { clubId: true, clubName: true, rank: true, powerRating: true },
  })
  return new Map(rows.filter(row => row.clubId).map(row => [row.clubId!, {
    clubId: row.clubId!,
    clubName: row.clubName,
    rank: row.rank,
    powerRating: row.powerRating,
  }]))
}

function rankingSignature(rows: RankSnapshot[]) {
  return rows
    .sort((a, b) => a.clubId.localeCompare(b.clubId))
    .map(row => `${row.clubId}:${row.rank}:${row.powerRating.toFixed(3)}`)
    .join('|') || 'no-change'
}

function countNotification(report: RankingEffectReport, result: { created: boolean; suppressed?: boolean; reason?: string }) {
  if (result.created) report.notificationsCreated += 1
  else if (result.suppressed) report.notificationsSuppressed += 1
  else if (result.reason === 'duplicate') report.notificationDuplicates += 1
}
