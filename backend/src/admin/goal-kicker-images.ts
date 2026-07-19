import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { prisma } from '../db/client.js'
import { requireAdminKey } from '../api/middleware/auth.js'
import { parseGoalKickerImage } from '../ocr/parse-goal-kicker-image.js'
import { fuzzyMatchClub, similarity } from '../ocr/fuzzy-match.js'
import { publishGoalKickerUpdateEvents } from '../services/goal-kicker-update-events.js'

const router = Router()
router.use(requireAdminKey)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const validUuid = (value: unknown): value is string => typeof value === 'string' && UUID_RE.test(value)

type SavedGoalKicker = { id: string; playerId: string }
type ExistingGoalKicker = { id: string; playerId: string; goals: number; matches: number | null; importedAt: Date }
type ApprovedGoalKicker = {
  playerId?: string | null
  playerName?: string
  clubName?: string
  clubId?: string | null
  goals?: number
  matches?: number | null
}

router.post('/parse', async (req, res) => {
  try {
    const { image, leagueId } = (req.body ?? {}) as { image?: string; leagueId?: string }
    if (!image) return res.status(400).json({ error: 'image required' })

    const parsed = await parseGoalKickerImage(image)
    const leagues = await prisma.league.findMany({
      where: { sport: 'FOOTBALL', archivedAt: null },
      select: { id: true, name: true },
    })

    let matchedLeagueId = leagueId ?? null
    if (!matchedLeagueId && parsed.league) {
      const ranked = leagues
        .map(league => ({ league, score: similarity(parsed.league!, league.name) }))
        .sort((a, b) => b.score - a.score)
      if (ranked[0]?.score >= 0.6) matchedLeagueId = ranked[0].league.id
    }

    const clubs = matchedLeagueId
      ? await prisma.club.findMany({
          where: { sport: 'FOOTBALL', archivedAt: null, leagueSeasons: { some: { leagueId: matchedLeagueId } } },
          select: { id: true, name: true },
        })
      : await prisma.club.findMany({
          where: { sport: 'FOOTBALL', archivedAt: null },
          select: { id: true, name: true },
          take: 3000,
        })

    const season = parsed.season ?? new Date().getFullYear().toString()
    const grade = parsed.grade ?? 'Senior Football'
    const rows = await Promise.all(parsed.rows.map(async row => {
      const clubMatch = fuzzyMatchClub(row.clubName, clubs)
      const existing = await prisma.footballGoalKicker.findFirst({
        where: {
          season,
          grade,
          playerName: { equals: row.playerName, mode: 'insensitive' },
          ...(clubMatch.clubId
            ? { clubId: clubMatch.clubId }
            : { clubName: { equals: row.clubName, mode: 'insensitive' } }),
          ...(matchedLeagueId ? { leagueId: matchedLeagueId } : {}),
        },
        orderBy: [{ goals: 'desc' }, { importedAt: 'desc' }],
        select: { id: true, playerId: true, playerName: true, clubName: true, goals: true, matches: true },
      })
      return {
        ...row,
        clubMatch,
        playerMatch: existing
          ? { id: existing.id, playerId: existing.playerId, playerName: existing.playerName, clubName: existing.clubName, goals: existing.goals, matches: existing.matches }
          : null,
      }
    }))

    res.json({
      data: {
        league: parsed.league,
        grade,
        season,
        matchedLeagueId,
        rows,
        uncertain: rows.filter(row => !row.clubMatch.confident).length,
        notes: parsed.notes,
      },
    })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'goal-kicker OCR failed' })
  }
})

router.post('/commit', async (req, res) => {
  try {
    const body = (req.body ?? {}) as { leagueId?: string; season?: string; grade?: string; rows?: ApprovedGoalKicker[] }
    if (!body.leagueId) return res.status(400).json({ error: 'leagueId required' })
    if (!Array.isArray(body.rows) || body.rows.length === 0) return res.status(400).json({ error: 'approved rows required' })

    const league = await prisma.league.findUnique({ where: { id: body.leagueId }, select: { id: true, name: true } })
    if (!league) return res.status(404).json({ error: 'league not found' })

    const season = String(body.season ?? new Date().getFullYear())
    const grade = String(body.grade ?? 'Senior Football')
    let imported = 0
    let weeklyChanges = 0
    let feedEvents = 0
    let duplicatesRemoved = 0
    let unchanged = 0
    const errors: Array<{ playerName: string; error: string }> = []
    const warnings: Array<{ playerName: string; warning: string }> = []

    for (const raw of body.rows) {
      const playerName = String(raw.playerName ?? '').trim()
      const clubName = String(raw.clubName ?? '').trim()
      const goals = Number(raw.goals)
      if (!playerName || !clubName || !Number.isFinite(goals) || goals < 0) {
        errors.push({ playerName: playerName || 'Unknown player', error: 'Invalid player name, club name or goal total.' })
        continue
      }

      try {
        const club = raw.clubId
          ? await prisma.club.findUnique({ where: { id: raw.clubId }, select: { id: true, name: true } })
          : null
        if (raw.clubId && !club) throw new Error(`Selected club no longer exists: ${clubName}`)

        const storedClubName = club?.name ?? clubName
        const incomingGoals = Math.trunc(goals)
        const incomingMatches = raw.matches == null || !Number.isFinite(Number(raw.matches))
          ? null
          : Math.max(0, Math.trunc(Number(raw.matches)))
        const requestedPlayerId = validUuid(raw.playerId) ? raw.playerId : null
        const importedAt = new Date()

        const outcome = await prisma.$transaction(async tx => {
          const candidates = await tx.footballGoalKicker.findMany({
            where: {
              season,
              grade,
              leagueId: league.id,
              OR: [
                ...(requestedPlayerId ? [{ playerId: requestedPlayerId }] : []),
                {
                  playerName: { equals: playerName, mode: 'insensitive' as const },
                  ...(club?.id
                    ? { OR: [{ clubId: club.id }, { clubName: { equals: storedClubName, mode: 'insensitive' as const } }] }
                    : { clubName: { equals: storedClubName, mode: 'insensitive' as const } }),
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
          const savedMatches = incomingMatches == null
            ? currentMatches
            : currentMatches == null
              ? incomingMatches
              : Math.max(currentMatches, incomingMatches)

          let saved: SavedGoalKicker
          if (canonical) {
            saved = await tx.footballGoalKicker.update({
              where: { id: canonical.id },
              data: {
                playerName,
                clubId: club?.id ?? null,
                clubName: storedClubName,
                leagueId: league.id,
                leagueName: league.name,
                season,
                grade,
                goals: savedGoals,
                matches: savedMatches,
                sourceUrl: null,
                sourceType: 'OCR_UPLOAD',
                importedAt,
              },
              select: { id: true, playerId: true },
            })
          } else {
            const savedRows = await tx.$queryRaw<SavedGoalKicker[]>`
              INSERT INTO "football_goal_kickers" (
                "id", "playerId", "playerName", "clubId", "clubName", "leagueId", "leagueName",
                "season", "grade", "goals", "matches", "sourceUrl", "sourceType", "importedAt", "createdAt", "updatedAt"
              ) VALUES (
                CAST(${canonicalId} AS uuid), CAST(${canonicalPlayerId} AS uuid), ${playerName}, CAST(${club?.id ?? null} AS uuid), ${storedClubName}, CAST(${league.id} AS uuid), ${league.name},
                ${season}, ${grade}, ${savedGoals}, ${savedMatches}, ${null}, ${'OCR_UPLOAD'}, ${importedAt}, ${importedAt}, ${importedAt}
              )
              RETURNING "id", "playerId"
            `
            const inserted = savedRows[0]
            if (!inserted?.id || !inserted.playerId) throw new Error(`Goal-kicker row saved without a player identity for ${playerName}`)
            saved = inserted
          }

          const duplicateIds = candidates.filter(row => row.id !== saved.id).map(row => row.id)
          if (duplicateIds.length > 0) await tx.footballGoalKicker.deleteMany({ where: { id: { in: duplicateIds } } })

          const weeklyGoals = previousGoals == null ? 0 : Math.max(0, savedGoals - previousGoals)
          const matchesAdded = previousMatches != null && savedMatches != null ? Math.max(0, savedMatches - previousMatches) : null
          const published = previousGoals == null
            ? { historyCreated: false, feedEventsCreated: 0 }
            : await publishGoalKickerUpdateEvents(tx, {
                playerId: saved.playerId,
                playerRowId: saved.id,
                playerName,
                clubId: club?.id ?? null,
                clubName: storedClubName,
                leagueId: league.id,
                leagueName: league.name,
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
            savedGoals,
            weeklyGoals,
            historyCreated: published.historyCreated,
            feedEventsCreated: published.feedEventsCreated,
            duplicatesRemoved: duplicateIds.length,
            staleIncomingTotal: currentGoals != null && incomingGoals < currentGoals,
            unchanged: currentGoals === savedGoals && duplicateIds.length === 0,
          }
        })

        imported++
        duplicatesRemoved += outcome.duplicatesRemoved
        feedEvents += outcome.feedEventsCreated
        if (outcome.historyCreated) weeklyChanges++
        if (outcome.unchanged) unchanged++
        if (outcome.staleIncomingTotal) {
          warnings.push({ playerName, warning: `Ignored older total of ${incomingGoals}; current total remains ${outcome.savedGoals}.` })
        }
      } catch (error) {
        errors.push({ playerName: playerName || 'Unknown player', error: error instanceof Error ? error.message : String(error) })
      }
    }

    res.json({
      data: {
        imported,
        weeklyChanges,
        feedEvents,
        duplicatesRemoved,
        unchanged,
        errors: errors.length,
        warnings: warnings.length,
        league: league.name,
        season,
        grade,
      },
      errors: errors.slice(0, 50),
      warnings: warnings.slice(0, 50),
    })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'goal-kicker commit failed' })
  }
})

export { router as adminGoalKickerImagesRouter }
