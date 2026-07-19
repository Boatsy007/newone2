import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { prisma } from '../db/client.js'
import { requireAdminKey } from '../api/middleware/auth.js'
import { parseGoalKickerImage } from '../ocr/parse-goal-kicker-image.js'
import { fuzzyMatchClub, similarity } from '../ocr/fuzzy-match.js'

const router = Router()
router.use(requireAdminKey)

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-')

type SavedGoalKicker = { id: string; playerId: string }
type ExistingGoalKicker = { id: string; playerId: string; goals: number; matches: number | null; importedAt: Date }

router.post('/parse', async (req, res) => {
  try {
    const { image, leagueId } = (req.body ?? {}) as { image?: string; leagueId?: string }
    if (!image) return res.status(400).json({ error: 'image required' })
    const parsed = await parseGoalKickerImage(image)
    const leagues = await prisma.league.findMany({ where: { sport: 'FOOTBALL', archivedAt: null }, select: { id: true, name: true } })
    let matchedLeagueId = leagueId ?? null
    if (!matchedLeagueId && parsed.league) {
      const ranked = leagues.map(league => ({ league, score: similarity(parsed.league!, league.name) })).sort((a, b) => b.score - a.score)
      if (ranked[0]?.score >= 0.6) matchedLeagueId = ranked[0].league.id
    }
    const clubs = matchedLeagueId
      ? await prisma.club.findMany({ where: { sport: 'FOOTBALL', archivedAt: null, leagueSeasons: { some: { leagueId: matchedLeagueId } } }, select: { id: true, name: true } })
      : await prisma.club.findMany({ where: { sport: 'FOOTBALL', archivedAt: null }, select: { id: true, name: true }, take: 3000 })
    const season = parsed.season ?? new Date().getFullYear().toString()
    const grade = parsed.grade ?? 'Senior Football'
    const rows = await Promise.all(parsed.rows.map(async row => {
      const clubMatch = fuzzyMatchClub(row.clubName, clubs)
      const existing = await prisma.footballGoalKicker.findFirst({
        where: {
          season,
          playerName: { equals: row.playerName, mode: 'insensitive' },
          ...(clubMatch.clubId ? { clubId: clubMatch.clubId } : { clubName: { equals: row.clubName, mode: 'insensitive' } }),
          ...(matchedLeagueId ? { leagueId: matchedLeagueId } : {}),
        },
        orderBy: [{ goals: 'desc' }, { importedAt: 'desc' }],
        select: { id: true, playerName: true, clubName: true, goals: true, matches: true },
      })
      return { ...row, clubMatch, playerMatch: existing ? { id: existing.id, playerName: existing.playerName, clubName: existing.clubName, goals: existing.goals, matches: existing.matches } : null }
    }))
    const uncertain = rows.filter(row => !row.clubMatch.confident).length
    res.json({ data: { league: parsed.league, grade, season, matchedLeagueId, rows, uncertain, notes: parsed.notes } })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'goal-kicker OCR failed' })
  }
})

router.post('/commit', async (req, res) => {
  try {
    const body = (req.body ?? {}) as { leagueId?: string; season?: string; grade?: string; rows?: Array<{ playerName?: string; clubName?: string; clubId?: string | null; goals?: number; matches?: number | null }> }
    if (!body.leagueId) return res.status(400).json({ error: 'leagueId required' })
    if (!Array.isArray(body.rows) || body.rows.length === 0) return res.status(400).json({ error: 'approved rows required' })
    const league = await prisma.league.findUnique({ where: { id: body.leagueId }, select: { id: true, name: true } })
    if (!league) return res.status(404).json({ error: 'league not found' })
    const season = String(body.season ?? new Date().getFullYear())
    const grade = String(body.grade ?? 'Senior Football')
    let imported = 0
    let weeklyChanges = 0
    let duplicatesRemoved = 0
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
        const club = raw.clubId ? await prisma.club.findUnique({ where: { id: raw.clubId }, select: { id: true, name: true } }) : null
        if (raw.clubId && !club) throw new Error(`Selected club no longer exists: ${clubName}`)
        const storedClubName = club?.name ?? clubName
        const nextGoals = Math.trunc(goals)
        const nextMatches = raw.matches == null || !Number.isFinite(Number(raw.matches)) ? null : Math.max(0, Math.trunc(Number(raw.matches)))
        const importedAt = new Date()

        const outcome = await prisma.$transaction(async tx => {
          const candidates = await tx.footballGoalKicker.findMany({
            where: {
              season,
              leagueId: league.id,
              playerName: { equals: playerName, mode: 'insensitive' },
              ...(club?.id
                ? { OR: [{ clubId: club.id }, { clubName: { equals: storedClubName, mode: 'insensitive' } }] }
                : { clubName: { equals: storedClubName, mode: 'insensitive' } }),
            },
            orderBy: [{ goals: 'desc' }, { importedAt: 'desc' }],
            select: { id: true, playerId: true, goals: true, matches: true, importedAt: true },
          }) as ExistingGoalKicker[]

          const canonical = candidates[0] ?? null
          const lowerPrevious = candidates.find(row => row.goals < nextGoals)
          const previousGoals = lowerPrevious?.goals ?? canonical?.goals ?? null
          const previousMatches = lowerPrevious?.matches ?? canonical?.matches ?? null
          let saved: SavedGoalKicker

          if (canonical) {
            const updated = await tx.footballGoalKicker.update({
              where: { id: canonical.id },
              data: {
                playerName,
                clubId: club?.id ?? null,
                clubName: storedClubName,
                leagueId: league.id,
                leagueName: league.name,
                season,
                grade,
                goals: nextGoals,
                matches: nextMatches,
                sourceUrl: null,
                sourceType: 'OCR_UPLOAD',
                importedAt,
              },
              select: { id: true, playerId: true },
            })
            saved = { id: updated.id, playerId: updated.playerId }
          } else {
            const stableId = randomUUID()
            const savedRows = await tx.$queryRaw<SavedGoalKicker[]>`
              INSERT INTO "football_goal_kickers" (
                "id", "playerId", "playerName", "clubId", "clubName", "leagueId", "leagueName",
                "season", "grade", "goals", "matches", "sourceUrl", "sourceType", "importedAt", "createdAt", "updatedAt"
              ) VALUES (
                CAST(${stableId} AS uuid), CAST(${stableId} AS uuid), ${playerName}, CAST(${club?.id ?? null} AS uuid), ${storedClubName}, CAST(${league.id} AS uuid), ${league.name},
                ${season}, ${grade}, ${nextGoals}, ${nextMatches}, ${null}, ${'OCR_UPLOAD'}, ${importedAt}, ${importedAt}, ${importedAt}
              )
              RETURNING "id", "playerId"
            `
            const inserted = savedRows[0]
            if (!inserted?.id || !inserted.playerId) throw new Error(`Goal-kicker row saved without a player identity for ${playerName}`)
            saved = inserted
          }

          const duplicateIds = candidates.slice(1).map(row => row.id)
          if (duplicateIds.length > 0) {
            await tx.footballGoalKicker.deleteMany({ where: { id: { in: duplicateIds } } })
          }

          return { saved, previousGoals, previousMatches, duplicatesRemoved: duplicateIds.length }
        })

        imported++
        duplicatesRemoved += outcome.duplicatesRemoved
        const weeklyGoals = outcome.previousGoals == null ? 0 : Math.max(0, nextGoals - outcome.previousGoals)
        const matchesAdded = outcome.previousMatches != null && nextMatches != null ? Math.max(0, nextMatches - outcome.previousMatches) : null

        if (weeklyGoals > 0) {
          try {
            const dedupeKey = `goal-kicker:${league.id}:${season}:${norm(grade)}:${outcome.saved.playerId}:${nextGoals}`
            await prisma.notification.upsert({
              where: { dedupeKey },
              create: {
                recipientScope: 'PLATFORM',
                type: 'GOAL_KICKER_UPDATED',
                category: 'PLAYER',
                severity: 'INFO',
                title: `${playerName} added ${weeklyGoals} goal${weeklyGoals === 1 ? '' : 's'}`,
                body: `${playerName} moved from ${outcome.previousGoals} to ${nextGoals} goals for ${storedClubName}.`,
                entityType: 'PLAYER',
                entityId: outcome.saved.playerId,
                data: JSON.stringify({ playerId: outcome.saved.playerId, playerRowId: outcome.saved.id, playerName, clubId: club?.id ?? null, clubName: storedClubName, leagueId: league.id, leagueName: league.name, season, grade, previousGoals: outcome.previousGoals, goals: nextGoals, weeklyGoals, previousMatches: outcome.previousMatches, matches: nextMatches, matchesAdded, playerUrl: `/player/${encodeURIComponent(outcome.saved.id)}`, clubUrl: club?.id ? `/team/${encodeURIComponent(club.id)}` : null, leagueUrl: `/league/${encodeURIComponent(league.id)}` }),
                status: 'DELIVERED',
                dedupeKey,
              },
              update: {},
            })
            weeklyChanges++
          } catch (error) {
            warnings.push({ playerName, warning: `Goal total saved, but weekly notification failed: ${error instanceof Error ? error.message : String(error)}` })
          }
        }
      } catch (error) {
        errors.push({ playerName: playerName || 'Unknown player', error: error instanceof Error ? error.message : String(error) })
      }
    }

    res.json({
      data: {
        imported,
        weeklyChanges,
        duplicatesRemoved,
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
