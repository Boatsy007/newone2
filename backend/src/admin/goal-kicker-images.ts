import { Router } from 'express'
import { prisma } from '../db/client.js'
import { requireAdminKey } from '../api/middleware/auth.js'
import { parseGoalKickerImage } from '../ocr/parse-goal-kicker-image.js'
import { fuzzyMatchClub, similarity } from '../ocr/fuzzy-match.js'
import { upsertCanonicalGoalKicker } from '../services/canonical-goal-kicker-upsert.js'
import {
  createGoalKickerImportBatch,
  failGoalKickerImportBatch,
  finaliseGoalKickerImportBatch,
  goalKickerEventDedupeBase,
  listGoalKickerImportBatches,
  undoGoalKickerImportBatch,
  type GoalKickerAuditRow,
  type GoalKickerSnapshot,
} from '../services/goal-kicker-import-audit.js'

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

type ReviewAuditRow = ApprovedGoalKicker & {
  decision?: 'import' | 'skip'
  confidence?: number | null
  warning?: string | null
}

const snapshotSelect = {
  id: true, playerId: true, playerName: true, clubId: true, clubName: true, leagueId: true, leagueName: true,
  season: true, grade: true, goals: true, matches: true, sourceUrl: true, sourceType: true,
  importedAt: true, createdAt: true, updatedAt: true,
} as const

router.get('/records', async (req, res) => {
  try {
    const query = req.query as Record<string, string | undefined>
    const season = query.season?.trim()
    const leagueId = query.leagueId?.trim()
    const rows = await prisma.footballGoalKicker.findMany({
      where: { ...(season ? { season } : {}), ...(leagueId ? { leagueId } : {}) },
      orderBy: [{ goals: 'desc' }, { playerName: 'asc' }],
      take: 1000,
      select: {
        id: true, playerId: true, playerName: true, clubId: true, clubName: true, leagueId: true, leagueName: true,
        season: true, grade: true, goals: true, matches: true, sourceType: true, importedAt: true,
      },
    })
    res.json({ data: rows })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'failed to load goal-kicker records' })
  }
})

router.delete('/records/:id', async (req, res) => {
  try {
    const confirmation = String((req.body as { confirmation?: string } | undefined)?.confirmation ?? '')
    const row = await prisma.footballGoalKicker.findUnique({
      where: { id: req.params.id },
      select: { id: true, playerId: true, playerName: true, clubName: true, goals: true, season: true, grade: true },
    })
    if (!row) return res.status(404).json({ error: 'Goal-kicker record not found.' })
    if (confirmation !== `DELETE ${row.playerName}`) return res.status(400).json({ error: `Type DELETE ${row.playerName} to confirm.` })

    const result = await prisma.$transaction(async tx => {
      const linkedNotifications = await tx.notification.deleteMany({
        where: { type: { in: ['GOAL_KICKER_UPDATED', 'GOAL_KICKER_UPDATE'] }, data: { contains: `\"playerRowId\":\"${row.id}\"` } },
      })
      await tx.footballGoalKicker.delete({ where: { id: row.id } })
      return { notificationsRemoved: linkedNotifications.count }
    })

    res.json({ data: { deleted: true, ...row, notificationsRemoved: result.notificationsRemoved } })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'goal-kicker deletion failed' })
  }
})

router.get('/imports', async (req, res) => {
  try {
    const limit = Number((req.query as Record<string, string | undefined>).limit) || 50
    res.json({ data: await listGoalKickerImportBatches(limit) })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'failed to load goal-kicker import history' })
  }
})

router.post('/imports/:id/undo', async (req, res) => {
  try {
    const confirmation = String((req.body as { confirmation?: string } | undefined)?.confirmation ?? '')
    const result = await undoGoalKickerImportBatch(req.params.id, confirmation)
    res.json({ data: { undone: true, ...result } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'goal-kicker import undo failed'
    res.status(message.startsWith('Undo blocked') ? 409 : 400).json({ error: message })
  }
})

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
          season, grade, playerName: { equals: row.playerName, mode: 'insensitive' },
          ...(clubMatch.clubId ? { clubId: clubMatch.clubId } : { clubName: { equals: row.clubName, mode: 'insensitive' } }),
          ...(matchedLeagueId ? { leagueId: matchedLeagueId } : {}),
        },
        orderBy: [{ goals: 'desc' }, { importedAt: 'desc' }],
        select: { id: true, playerId: true, playerName: true, clubName: true, goals: true, matches: true },
      })
      return {
        ...row,
        clubMatch,
        playerMatch: existing ? { id: existing.id, playerId: existing.playerId, playerName: existing.playerName, clubName: existing.clubName, goals: existing.goals, matches: existing.matches } : null,
      }
    }))

    res.json({ data: { league: parsed.league, grade, season, matchedLeagueId, rows, uncertain: rows.filter(row => !row.clubMatch.confident).length, notes: parsed.notes } })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'goal-kicker OCR failed' })
  }
})

router.post('/commit', async (req, res) => {
  let batchId: string | null = null
  try {
    const body = (req.body ?? {}) as {
      leagueId?: string
      season?: string
      grade?: string
      rows?: ApprovedGoalKicker[]
      reviewRows?: ReviewAuditRow[]
      fileName?: string
      image?: string
      uncertainCount?: number
    }
    if (!body.leagueId) return res.status(400).json({ error: 'leagueId required' })
    if (!Array.isArray(body.rows) || body.rows.length === 0) return res.status(400).json({ error: 'approved rows required' })
    if (!body.image) return res.status(400).json({ error: 'original screenshot required for import audit' })

    const league = await prisma.league.findUnique({ where: { id: body.leagueId }, select: { id: true, name: true } })
    if (!league) return res.status(404).json({ error: 'league not found' })

    const season = String(body.season ?? new Date().getFullYear())
    const grade = String(body.grade ?? 'Senior Football')
    const reviewRows = Array.isArray(body.reviewRows) ? body.reviewRows : body.rows.map(row => ({ ...row, decision: 'import' as const }))
    const batch = await createGoalKickerImportBatch({
      image: body.image,
      fileName: String(body.fileName ?? 'Goal-kicker screenshot'),
      leagueId: league.id,
      leagueName: league.name,
      season,
      grade,
      reviewRows,
      uncertainCount: Math.max(0, Number(body.uncertainCount) || 0),
    })
    batchId = batch.id

    let imported = 0
    let weeklyChanges = 0
    let feedEvents = 0
    let duplicatesRemoved = 0
    let unchanged = 0
    const errors: Array<{ playerName: string; error: string }> = []
    const warnings: Array<{ playerName: string; warning: string }> = []
    const auditRows: GoalKickerAuditRow[] = reviewRows
      .filter(row => row.decision === 'skip')
      .map((row, rowIndex) => ({
        rowIndex,
        decision: 'skip',
        playerName: String(row.playerName ?? '').trim() || 'Unknown player',
        clubName: String(row.clubName ?? '').trim(),
        clubId: row.clubId ?? null,
        goals: Number(row.goals) || 0,
        matches: row.matches == null ? null : Number(row.matches),
        confidence: row.confidence ?? null,
        warning: row.warning ?? null,
      }))

    for (const [rowIndex, raw] of body.rows.entries()) {
      const playerName = String(raw.playerName ?? '').trim()
      const clubName = String(raw.clubName ?? '').trim()
      const goals = Number(raw.goals)
      if (!playerName || !clubName || !Number.isFinite(goals) || goals < 0) {
        const error = 'Invalid player name, club name or goal total.'
        errors.push({ playerName: playerName || 'Unknown player', error })
        auditRows.push({ rowIndex, decision: 'import', playerName: playerName || 'Unknown player', clubName, clubId: raw.clubId ?? null, goals: Number.isFinite(goals) ? goals : 0, matches: raw.matches == null ? null : Number(raw.matches), error })
        continue
      }

      try {
        const club = raw.clubId ? await prisma.club.findUnique({ where: { id: raw.clubId }, select: { id: true, name: true } }) : null
        if (raw.clubId && !club) throw new Error(`Selected club no longer exists: ${clubName}`)
        const storedClubName = club?.name ?? clubName
        const beforeRows = await prisma.footballGoalKicker.findMany({
          where: {
            season,
            grade,
            leagueId: league.id,
            OR: [
              ...(raw.playerId ? [{ playerId: raw.playerId }] : []),
              {
                playerName: { equals: playerName, mode: 'insensitive' },
                ...(club?.id ? { OR: [{ clubId: club.id }, { clubName: { equals: storedClubName, mode: 'insensitive' } }] } : { clubName: { equals: storedClubName, mode: 'insensitive' } }),
              },
            ],
          },
          orderBy: [{ goals: 'desc' }, { importedAt: 'desc' }],
          select: snapshotSelect,
        }) as GoalKickerSnapshot[]

        const outcome = await upsertCanonicalGoalKicker({
          requestedPlayerId: raw.playerId,
          playerName,
          clubId: club?.id ?? null,
          clubName: storedClubName,
          leagueId: league.id,
          leagueName: league.name,
          season,
          grade,
          goals,
          matches: raw.matches == null || !Number.isFinite(Number(raw.matches)) ? null : Number(raw.matches),
          sourceUrl: null,
          sourceType: 'OCR_UPLOAD',
        })
        const afterRow = await prisma.footballGoalKicker.findUnique({ where: { id: outcome.playerRowId }, select: snapshotSelect }) as GoalKickerSnapshot | null
        if (!afterRow) throw new Error(`Saved player row could not be audited for ${playerName}`)

        imported++
        duplicatesRemoved += outcome.duplicatesRemoved
        feedEvents += outcome.feedEventsCreated
        if (outcome.historyCreated) weeklyChanges++
        if (outcome.unchanged) unchanged++
        const staleWarning = outcome.staleIncomingTotal ? `Ignored older total of ${Math.trunc(goals)}; current total remains ${outcome.savedGoals}.` : null
        if (staleWarning) warnings.push({ playerName, warning: staleWarning })
        auditRows.push({
          rowIndex,
          decision: 'import',
          playerName,
          clubName: storedClubName,
          clubId: club?.id ?? null,
          goals,
          matches: raw.matches == null ? null : Number(raw.matches),
          beforeRows,
          afterRow,
          warning: staleWarning,
          outcome: {
            savedGoals: outcome.savedGoals,
            savedMatches: outcome.savedMatches,
            weeklyGoals: outcome.weeklyGoals,
            historyCreated: outcome.historyCreated,
            feedEventsCreated: outcome.feedEventsCreated,
            duplicatesRemoved: outcome.duplicatesRemoved,
            staleIncomingTotal: outcome.staleIncomingTotal,
            unchanged: outcome.unchanged,
          },
          eventDedupeBase: goalKickerEventDedupeBase({ leagueId: league.id, season, grade, playerId: outcome.playerId, goals: outcome.savedGoals }),
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        errors.push({ playerName: playerName || 'Unknown player', error: message })
        auditRows.push({ rowIndex, decision: 'import', playerName: playerName || 'Unknown player', clubName, clubId: raw.clubId ?? null, goals, matches: raw.matches == null ? null : Number(raw.matches), error: message })
      }
    }

    const report = { imported, weeklyChanges, feedEvents, duplicatesRemoved, unchanged, errors: errors.length, warnings: warnings.length, league: league.name, season, grade }
    await finaliseGoalKickerImportBatch({ batchId, rows: auditRows, report })
    res.json({ data: { ...report, batchId }, errors: errors.slice(0, 50), warnings: warnings.slice(0, 50) })
  } catch (error) {
    if (batchId) await failGoalKickerImportBatch(batchId, error instanceof Error ? error.message : String(error)).catch(() => {})
    res.status(500).json({ error: error instanceof Error ? error.message : 'goal-kicker commit failed' })
  }
})

export { router as adminGoalKickerImagesRouter }
