import { Router } from 'express'
import { prisma } from '../db/client.js'
import { requireAdminKey } from '../api/middleware/auth.js'
import { parseGoalKickerImage } from '../ocr/parse-goal-kicker-image.js'
import { fuzzyMatchClub, similarity } from '../ocr/fuzzy-match.js'
import { upsertCanonicalGoalKicker } from '../services/canonical-goal-kicker-upsert.js'

const router = Router()
router.use(requireAdminKey)

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
          ...(clubMatch.clubId ? { clubId: clubMatch.clubId } : { clubName: { equals: row.clubName, mode: 'insensitive' } }),
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

        const outcome = await upsertCanonicalGoalKicker({
          requestedPlayerId: raw.playerId,
          playerName,
          clubId: club?.id ?? null,
          clubName: club?.name ?? clubName,
          leagueId: league.id,
          leagueName: league.name,
          season,
          grade,
          goals,
          matches: raw.matches == null || !Number.isFinite(Number(raw.matches)) ? null : Number(raw.matches),
          sourceUrl: null,
          sourceType: 'OCR_UPLOAD',
        })

        imported++
        duplicatesRemoved += outcome.duplicatesRemoved
        feedEvents += outcome.feedEventsCreated
        if (outcome.historyCreated) weeklyChanges++
        if (outcome.unchanged) unchanged++
        if (outcome.staleIncomingTotal) warnings.push({ playerName, warning: `Ignored older total of ${Math.trunc(goals)}; current total remains ${outcome.savedGoals}.` })
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
