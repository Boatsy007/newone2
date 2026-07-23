import { Router } from 'express'
import { prisma } from '../db/client.js'
import { requireAdminKey } from '../api/middleware/auth.js'
import { fuzzyMatchClub, similarity } from '../ocr/fuzzy-match.js'
import { parseMvpImage } from '../ocr/parse-mvp-image.js'
import { calculateMvpPoints, ensureMvpTable, leagueStars, strengthFactor } from '../services/mvp-table.js'

const router = Router()
router.use(requireAdminKey)

type ApprovedRow = {
  playerName?: string
  clubName?: string
  clubId?: string | null
  playerId?: string | null
  bp?: number
  gamesPlayed?: number | null
}

router.post('/parse', async (req, res) => {
  try {
    const { image, leagueId } = (req.body ?? {}) as { image?: string; leagueId?: string }
    if (!image) return res.status(400).json({ error: 'image required' })
    const parsed = await parseMvpImage(image)
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
      const player = clubMatch.clubId ? await prisma.footballGoalKicker.findFirst({
        where: { clubId: clubMatch.clubId, playerName: { equals: row.playerName, mode: 'insensitive' } },
        orderBy: { importedAt: 'desc' },
        select: { playerId: true },
      }) : null
      return { ...row, clubMatch, playerId: player?.playerId ?? null }
    }))
    res.json({ data: { league: parsed.league, grade, season, matchedLeagueId, rows, uncertain: rows.filter(row => !row.clubMatch.confident).length, notes: parsed.notes } })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'MVP OCR failed' })
  }
})

router.post('/commit', async (req, res) => {
  try {
    const body = (req.body ?? {}) as { leagueId?: string; season?: string; grade?: string; rows?: ApprovedRow[] }
    if (!body.leagueId) return res.status(400).json({ error: 'leagueId required' })
    if (!Array.isArray(body.rows) || !body.rows.length) return res.status(400).json({ error: 'approved rows required' })
    const league = await prisma.league.findUnique({ where: { id: body.leagueId }, select: { id: true, name: true, finalStrengthRating: true } })
    if (!league) return res.status(404).json({ error: 'league not found' })
    await ensureMvpTable()
    const season = String(body.season ?? new Date().getFullYear())
    const grade = String(body.grade ?? 'Senior Football')
    const stars = leagueStars(league.finalStrengthRating)
    const factor = strengthFactor(stars)
    let imported = 0
    const errors: Array<{ playerName: string; error: string }> = []
    for (const raw of body.rows) {
      const playerName = String(raw.playerName ?? '').trim()
      const clubName = String(raw.clubName ?? '').trim()
      const bp = Math.max(0, Math.trunc(Number(raw.bp)))
      if (!playerName || !clubName || !raw.clubId || !Number.isFinite(bp)) {
        errors.push({ playerName: playerName || 'Unknown player', error: 'Player, existing club and valid BP are required.' })
        continue
      }
      const club = await prisma.club.findUnique({ where: { id: raw.clubId }, select: { id: true, name: true } })
      if (!club) { errors.push({ playerName, error: 'Selected club no longer exists.' }); continue }
      const existingPlayer = raw.playerId ?? (await prisma.footballGoalKicker.findFirst({
        where: { clubId: club.id, playerName: { equals: playerName, mode: 'insensitive' } },
        orderBy: { importedAt: 'desc' }, select: { playerId: true },
      }))?.playerId ?? null
      const points = calculateMvpPoints(bp, stars)
      await prisma.$executeRawUnsafe(`
        INSERT INTO football_mvp_entries
          (player_id, player_name, club_id, club_name, league_id, league_name, season, grade, bp, games_played, league_stars, strength_factor, mvp_points, source_type, imported_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'OCR_UPLOAD',now(),now())
        ON CONFLICT (league_id, season, grade, lower(player_name), COALESCE(club_id, lower(club_name)))
        DO UPDATE SET player_id=EXCLUDED.player_id, club_id=EXCLUDED.club_id, club_name=EXCLUDED.club_name, bp=EXCLUDED.bp,
          games_played=EXCLUDED.games_played, league_stars=EXCLUDED.league_stars, strength_factor=EXCLUDED.strength_factor,
          mvp_points=EXCLUDED.mvp_points, imported_at=now(), updated_at=now()
      `, existingPlayer, playerName, club.id, club.name, league.id, league.name, season, grade, bp,
        raw.gamesPlayed == null || !Number.isFinite(Number(raw.gamesPlayed)) ? null : Math.max(0, Math.trunc(Number(raw.gamesPlayed))),
        stars, factor, points)
      imported++
    }
    res.json({ data: { imported, errors: errors.length, leagueStars: stars, strengthFactor: factor }, errors })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'MVP import failed' })
  }
})

export { router as adminMvpImagesRouter }
