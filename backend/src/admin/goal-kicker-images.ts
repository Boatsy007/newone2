import { Router } from 'express'
import { prisma } from '../db/client.js'
import { requireAdminKey } from '../api/middleware/auth.js'
import { parseGoalKickerImage } from '../ocr/parse-goal-kicker-image.js'
import { fuzzyMatchClub, similarity } from '../ocr/fuzzy-match.js'

const router = Router()
router.use(requireAdminKey)

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-')

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
          season, grade,
          playerName: { equals: row.playerName, mode: 'insensitive' },
          ...(clubMatch.clubId ? { clubId: clubMatch.clubId } : { clubName: { equals: row.clubName, mode: 'insensitive' } }),
          ...(matchedLeagueId ? { leagueId: matchedLeagueId } : {}),
        },
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
    const errors: Array<{ playerName: string; error: string }> = []

    for (const raw of body.rows) {
      const playerName = String(raw.playerName ?? '').trim()
      const clubName = String(raw.clubName ?? '').trim()
      const goals = Number(raw.goals)
      if (!playerName || !clubName || !Number.isFinite(goals) || goals < 0) { errors.push({ playerName, error: 'invalid player, club or goals' }); continue }
      try {
        const club = raw.clubId ? await prisma.club.findUnique({ where: { id: raw.clubId }, select: { id: true, name: true } }) : null
        const storedClubName = club?.name ?? clubName
        const key = { season, grade, playerName, clubName: storedClubName, leagueName: league.name }
        const previous = await prisma.footballGoalKicker.findUnique({
          where: { season_grade_playerName_clubName_leagueName: key },
          select: { id: true, goals: true, matches: true },
        })
        const nextGoals = Math.trunc(goals)
        const nextMatches = raw.matches == null ? null : Math.max(0, Math.trunc(Number(raw.matches)))
        const saved = await prisma.footballGoalKicker.upsert({
          where: { season_grade_playerName_clubName_leagueName: key },
          create: { playerName, clubId: club?.id ?? null, clubName: storedClubName, leagueId: league.id, leagueName: league.name, season, grade, goals: nextGoals, matches: nextMatches, sourceUrl: null, sourceType: 'OCR_UPLOAD', importedAt: new Date() },
          update: { clubId: club?.id ?? null, leagueId: league.id, goals: nextGoals, matches: nextMatches, sourceUrl: null, sourceType: 'OCR_UPLOAD', importedAt: new Date() },
          select: { id: true },
        })

        const weeklyGoals = previous ? Math.max(0, nextGoals - previous.goals) : 0
        const matchesAdded = previous && nextMatches != null && previous.matches != null ? Math.max(0, nextMatches - previous.matches) : null
        if (weeklyGoals > 0) {
          await prisma.notification.upsert({
            where: { dedupeKey: `goal-kicker:${league.id}:${season}:${norm(grade)}:${saved.id}:${nextGoals}` },
            create: {
              recipientScope: 'PLATFORM',
              type: 'GOAL_KICKER_UPDATED',
              category: 'PLAYER',
              severity: 'INFO',
              title: `${playerName} added ${weeklyGoals} goal${weeklyGoals === 1 ? '' : 's'}`,
              body: `${playerName} moved from ${previous!.goals} to ${nextGoals} goals for ${storedClubName}.`,
              entityType: 'PLAYER',
              entityId: saved.id,
              data: JSON.stringify({ playerId: saved.id, playerName, clubId: club?.id ?? null, clubName: storedClubName, leagueId: league.id, leagueName: league.name, season, grade, previousGoals: previous!.goals, goals: nextGoals, weeklyGoals, previousMatches: previous!.matches, matches: nextMatches, matchesAdded, playerUrl: `/player/${encodeURIComponent(saved.id)}`, clubUrl: club?.id ? `/team/${encodeURIComponent(club.id)}` : null, leagueUrl: `/league/${encodeURIComponent(league.id)}` }),
              status: 'DELIVERED',
              dedupeKey: `goal-kicker:${league.id}:${season}:${norm(grade)}:${saved.id}:${nextGoals}`,
            },
            update: {},
          })
          weeklyChanges++
        }
        imported++
      } catch (error) { errors.push({ playerName, error: error instanceof Error ? error.message : String(error) }) }
    }
    res.json({ data: { imported, weeklyChanges, errors: errors.length, league: league.name, season, grade }, errors: errors.slice(0, 20) })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'goal-kicker commit failed' })
  }
})

export { router as adminGoalKickerImagesRouter }
