import type { Prisma } from '@prisma/client'

type GoalKickerUpdateInput = {
  playerId: string
  playerRowId: string
  playerName: string
  clubId: string | null
  clubName: string
  leagueId: string
  leagueName: string
  season: string
  grade: string
  previousGoals: number
  goals: number
  weeklyGoals: number
  previousMatches: number | null
  matches: number | null
  matchesAdded: number | null
}

type GoalKickerUpdateResult = {
  historyCreated: boolean
  feedEventsCreated: number
}

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-')

/**
 * Publishes every persistent downstream event for an approved goal-kicker update.
 * All writes use stable dedupe keys and run in the caller's database transaction.
 */
export async function publishGoalKickerUpdateEvents(
  tx: Prisma.TransactionClient,
  input: GoalKickerUpdateInput,
): Promise<GoalKickerUpdateResult> {
  if (input.weeklyGoals <= 0) return { historyCreated: false, feedEventsCreated: 0 }

  const playerUrl = `/player/${encodeURIComponent(input.playerRowId)}`
  const clubUrl = input.clubId ? `/team/${encodeURIComponent(input.clubId)}` : null
  const leagueUrl = `/league/${encodeURIComponent(input.leagueId)}`
  const baseKey = `goal-kicker:${input.leagueId}:${input.season}:${norm(input.grade)}:${input.playerId}:${input.goals}`
  const title = `${input.playerName} added ${input.weeklyGoals} goal${input.weeklyGoals === 1 ? '' : 's'}`
  const body = `${input.playerName} moved from ${input.previousGoals} to ${input.goals} goals for ${input.clubName}.`
  const payload = {
    ...input,
    playerUrl,
    clubUrl,
    leagueUrl,
  }

  let historyCreated = false
  const existingHistory = await tx.notification.findUnique({ where: { dedupeKey: baseKey }, select: { id: true } })
  if (!existingHistory) {
    await tx.notification.create({
      data: {
        recipientScope: 'PLATFORM',
        type: 'GOAL_KICKER_UPDATED',
        category: 'PLAYER',
        severity: 'INFO',
        title,
        body,
        entityType: 'PLAYER',
        entityId: input.playerId,
        data: JSON.stringify(payload),
        status: 'DELIVERED',
        dedupeKey: baseKey,
      },
    })
    historyCreated = true
  }

  const feedTargets = [
    { suffix: 'player-feed', entityType: 'PLAYER', entityId: input.playerId, href: playerUrl },
    ...(input.clubId ? [{ suffix: 'club-feed', entityType: 'CLUB', entityId: input.clubId, href: clubUrl! }] : []),
    { suffix: 'league-feed', entityType: 'LEAGUE', entityId: input.leagueId, href: playerUrl },
  ]

  let feedEventsCreated = 0
  for (const target of feedTargets) {
    const dedupeKey = `${baseKey}:${target.suffix}`
    const existing = await tx.notification.findUnique({ where: { dedupeKey }, select: { id: true } })
    if (existing) continue

    await tx.notification.create({
      data: {
        recipientScope: 'PLATFORM',
        type: 'GOAL_KICKER_UPDATE',
        category: 'FEED',
        severity: 'INFO',
        title,
        body,
        entityType: target.entityType,
        entityId: target.entityId,
        data: JSON.stringify({ ...payload, href: target.href }),
        status: 'DELIVERED',
        dedupeKey,
      },
    })
    feedEventsCreated++
  }

  return { historyCreated, feedEventsCreated }
}
