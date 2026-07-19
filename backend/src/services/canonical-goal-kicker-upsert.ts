import { randomUUID } from 'node:crypto'
import { prisma } from '../db/client.js'
import { publishGoalKickerAchievements } from './goal-kicker-achievements.js'
import { publishGoalKickerUpdateEvents } from './goal-kicker-update-events.js'
import { planGoalKickerUpdate, type GoalKickerCandidate } from './goal-kicker-update-plan.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type CanonicalGoalKickerInput = {
  requestedPlayerId?: string | null
  playerName: string
  clubId: string | null
  clubName: string
  leagueId: string
  leagueName: string
  season: string
  grade: string
  goals: number
  matches: number | null
  sourceUrl: string | null
  sourceType: 'OCR_UPLOAD' | 'PLAYHQ' | 'CSV_UPLOAD' | 'MANUAL_ENTRY'
}

export type CanonicalGoalKickerOutcome = {
  playerRowId: string
  playerId: string
  savedGoals: number
  savedMatches: number | null
  weeklyGoals: number
  historyCreated: boolean
  feedEventsCreated: number
  achievementsCreated: number
  achievementFeedEventsCreated: number
  duplicatesRemoved: number
  staleIncomingTotal: boolean
  unchanged: boolean
}

type SavedGoalKicker = { id: string; playerId: string }

export async function upsertCanonicalGoalKicker(input: CanonicalGoalKickerInput): Promise<CanonicalGoalKickerOutcome> {
  const playerName = input.playerName.trim()
  const clubName = input.clubName.trim()
  const season = input.season.trim()
  const grade = input.grade.trim()
  const incomingGoals = Math.trunc(input.goals)
  const incomingMatches = input.matches == null ? null : Math.max(0, Math.trunc(input.matches))
  const requestedPlayerId = input.requestedPlayerId && UUID_RE.test(input.requestedPlayerId) ? input.requestedPlayerId : null

  if (!playerName || !clubName || !season || !grade || !Number.isFinite(incomingGoals) || incomingGoals < 0) {
    throw new Error('Invalid player name, club, season, grade or goal total.')
  }

  return prisma.$transaction(async tx => {
    const candidates = await tx.footballGoalKicker.findMany({
      where: {
        season,
        grade,
        leagueId: input.leagueId,
        OR: [
          ...(requestedPlayerId ? [{ playerId: requestedPlayerId }] : []),
          {
            playerName: { equals: playerName, mode: 'insensitive' as const },
            ...(input.clubId
              ? { OR: [{ clubId: input.clubId }, { clubName: { equals: clubName, mode: 'insensitive' as const } }] }
              : { clubName: { equals: clubName, mode: 'insensitive' as const } }),
          },
        ],
      },
      orderBy: [{ goals: 'desc' }, { importedAt: 'desc' }],
      select: { id: true, playerId: true, goals: true, matches: true, importedAt: true },
    }) as GoalKickerCandidate[]

    const plan = planGoalKickerUpdate({
      candidates,
      requestedPlayerId,
      generatedPlayerId: randomUUID(),
      generatedRowId: randomUUID(),
      incomingGoals,
      incomingMatches,
    })
    const importedAt = new Date()

    let saved: SavedGoalKicker
    if (plan.canonical) {
      saved = await tx.footballGoalKicker.update({
        where: { id: plan.canonical.id },
        data: {
          playerName,
          clubId: input.clubId,
          clubName,
          leagueId: input.leagueId,
          leagueName: input.leagueName,
          season,
          grade,
          goals: plan.savedGoals,
          matches: plan.savedMatches,
          sourceUrl: input.sourceUrl,
          sourceType: input.sourceType,
          importedAt,
        },
        select: { id: true, playerId: true },
      })
    } else {
      const rows = await tx.$queryRaw<SavedGoalKicker[]>`
        INSERT INTO "football_goal_kickers" (
          "id", "playerId", "playerName", "clubId", "clubName", "leagueId", "leagueName",
          "season", "grade", "goals", "matches", "sourceUrl", "sourceType", "importedAt", "createdAt", "updatedAt"
        ) VALUES (
          CAST(${plan.canonicalId} AS uuid), CAST(${plan.canonicalPlayerId} AS uuid), ${playerName}, CAST(${input.clubId} AS uuid), ${clubName}, CAST(${input.leagueId} AS uuid), ${input.leagueName},
          ${season}, ${grade}, ${plan.savedGoals}, ${plan.savedMatches}, ${input.sourceUrl}, ${input.sourceType}, ${importedAt}, ${importedAt}, ${importedAt}
        ) RETURNING "id", "playerId"
      `
      const inserted = rows[0]
      if (!inserted?.id || !inserted.playerId) throw new Error(`Goal-kicker row saved without a player identity for ${playerName}`)
      saved = inserted
    }

    if (plan.duplicateIds.length) await tx.footballGoalKicker.deleteMany({ where: { id: { in: plan.duplicateIds } } })

    const published = plan.previousGoals == null ? { historyCreated: false, feedEventsCreated: 0 } : await publishGoalKickerUpdateEvents(tx, {
      playerId: saved.playerId,
      playerRowId: saved.id,
      playerName,
      clubId: input.clubId,
      clubName,
      leagueId: input.leagueId,
      leagueName: input.leagueName,
      season,
      grade,
      previousGoals: plan.previousGoals,
      goals: plan.savedGoals,
      weeklyGoals: plan.weeklyGoals,
      previousMatches: plan.previousMatches,
      matches: plan.savedMatches,
      matchesAdded: plan.matchesAdded,
    })

    const achievementResult = plan.previousGoals == null ? { achievementsCreated: 0, feedEventsCreated: 0 } : await publishGoalKickerAchievements(tx, {
      playerId: saved.playerId,
      playerRowId: saved.id,
      playerName,
      clubId: input.clubId,
      clubName,
      leagueId: input.leagueId,
      leagueName: input.leagueName,
      season,
      grade,
      previousGoals: plan.previousGoals,
      goals: plan.savedGoals,
      weeklyGoals: plan.weeklyGoals,
      previousMatches: plan.previousMatches,
      matches: plan.savedMatches,
    })

    return {
      playerRowId: saved.id,
      playerId: saved.playerId,
      savedGoals: plan.savedGoals,
      savedMatches: plan.savedMatches,
      weeklyGoals: plan.weeklyGoals,
      historyCreated: published.historyCreated,
      feedEventsCreated: published.feedEventsCreated,
      achievementsCreated: achievementResult.achievementsCreated,
      achievementFeedEventsCreated: achievementResult.feedEventsCreated,
      duplicatesRemoved: plan.duplicateIds.length,
      staleIncomingTotal: plan.staleIncomingTotal,
      unchanged: plan.unchanged,
    }
  })
}
