import { randomUUID } from 'node:crypto'
import { prisma } from '../db/client.js'
import { publishGoalKickerUpdateEvents } from './goal-kicker-update-events.js'

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
  duplicatesRemoved: number
  staleIncomingTotal: boolean
  unchanged: boolean
}

type ExistingGoalKicker = {
  id: string
  playerId: string
  goals: number
  matches: number | null
  importedAt: Date
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
    }) as ExistingGoalKicker[]

    const canonical = (requestedPlayerId ? candidates.find(row => row.playerId === requestedPlayerId) : null) ?? candidates[0] ?? null
    const canonicalPlayerId = canonical?.playerId ?? requestedPlayerId ?? randomUUID()
    const canonicalId = canonical?.id ?? randomUUID()
    const currentGoals = canonical?.goals ?? null
    const currentMatches = canonical?.matches ?? null
    const lowerPrevious = candidates.find(row => row.goals < incomingGoals)
    const previousGoals = lowerPrevious?.goals ?? currentGoals
    const previousMatches = lowerPrevious?.matches ?? currentMatches
    const savedGoals = currentGoals == null ? incomingGoals : Math.max(currentGoals, incomingGoals)
    const savedMatches = incomingMatches == null ? currentMatches : currentMatches == null ? incomingMatches : Math.max(currentMatches, incomingMatches)
    const importedAt = new Date()

    let saved: SavedGoalKicker
    if (canonical) {
      saved = await tx.footballGoalKicker.update({
        where: { id: canonical.id },
        data: {
          playerName,
          clubId: input.clubId,
          clubName,
          leagueId: input.leagueId,
          leagueName: input.leagueName,
          season,
          grade,
          goals: savedGoals,
          matches: savedMatches,
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
          CAST(${canonicalId} AS uuid), CAST(${canonicalPlayerId} AS uuid), ${playerName}, CAST(${input.clubId} AS uuid), ${clubName}, CAST(${input.leagueId} AS uuid), ${input.leagueName},
          ${season}, ${grade}, ${savedGoals}, ${savedMatches}, ${input.sourceUrl}, ${input.sourceType}, ${importedAt}, ${importedAt}, ${importedAt}
        ) RETURNING "id", "playerId"
      `
      const inserted = rows[0]
      if (!inserted?.id || !inserted.playerId) throw new Error(`Goal-kicker row saved without a player identity for ${playerName}`)
      saved = inserted
    }

    const duplicateIds = candidates.filter(row => row.id !== saved.id).map(row => row.id)
    if (duplicateIds.length) await tx.footballGoalKicker.deleteMany({ where: { id: { in: duplicateIds } } })

    const weeklyGoals = previousGoals == null ? 0 : Math.max(0, savedGoals - previousGoals)
    const matchesAdded = previousMatches != null && savedMatches != null ? Math.max(0, savedMatches - previousMatches) : null
    const published = previousGoals == null ? { historyCreated: false, feedEventsCreated: 0 } : await publishGoalKickerUpdateEvents(tx, {
      playerId: saved.playerId,
      playerRowId: saved.id,
      playerName,
      clubId: input.clubId,
      clubName,
      leagueId: input.leagueId,
      leagueName: input.leagueName,
      season,
      grade,
      previousGoals,
      goals: savedGoals,
      weeklyGoals,
      previousMatches,
      matches: savedMatches,
      matchesAdded,
    })

    return {
      playerRowId: saved.id,
      playerId: saved.playerId,
      savedGoals,
      savedMatches,
      weeklyGoals,
      historyCreated: published.historyCreated,
      feedEventsCreated: published.feedEventsCreated,
      duplicatesRemoved: duplicateIds.length,
      staleIncomingTotal: currentGoals != null && incomingGoals < currentGoals,
      unchanged: currentGoals === savedGoals && duplicateIds.length === 0,
    }
  })
}
