import { Router } from 'express'
import { prisma } from '../db/client.js'
import { requireAdminKey } from '../api/middleware/auth.js'
import { fetchPlayHqStatisticsPage, parseGoalKickers, type GoalKickerRow } from '../football/url-ingest.js'
import { upsertCanonicalGoalKicker } from '../services/canonical-goal-kicker-upsert.js'

const router = Router()
router.use(requireAdminKey)

const num = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback
const str = (value: unknown, fallback = '') => typeof value === 'string' && value.trim() ? value.trim() : fallback

router.post('/import', async (req, res) => {
  try {
    const body = (req.body ?? {}) as { sourceUrl?: string; url?: string; rows?: Array<Record<string, unknown>> }
    const sourceUrl = str(body.sourceUrl ?? body.url).trim()
    let rows: GoalKickerRow[] = []
    let strategy = 'provided-rows'
    let warnings: string[] = []
    let diagnostics: Record<string, unknown> | null = null
    const importerVersion = 'canonical-goal-kicker-v3'

    if (Array.isArray(body.rows) && body.rows.length) {
      rows = body.rows.map(row => ({
        playerName: str(row.playerName ?? row.player),
        clubName: str(row.clubName ?? row.club),
        leagueName: str(row.leagueName ?? row.league),
        season: str(row.season, new Date().getFullYear().toString()),
        grade: str(row.grade, 'Senior Football'),
        goals: num(row.goals),
        matches: row.matches == null ? undefined : num(row.matches),
        sourceUrl,
      })).filter(row => row.playerName && row.clubName && row.leagueName)
    } else if (sourceUrl) {
      const page = await fetchPlayHqStatisticsPage(sourceUrl, 30000)
      const parsed = parseGoalKickers(page)
      rows = parsed.rows
      strategy = (page.diagnostics as Record<string, unknown> | undefined)?.fetchStrategy === 'playwright-render'
        ? 'playwright-render'
        : parsed.strategy
      warnings = parsed.warnings
      diagnostics = page.diagnostics ?? null
      if (!rows.length) {
        const detail = page.diagnostics ?? {}
        return res.status(422).json({
          error: 'No goal kicker rows could be parsed from this PlayHQ page.',
          goalKickerImporterVersion: importerVersion,
          data: { imported: 0, skipped: 0, errors: 0, sourceUrl, strategy, warnings, diagnostics: detail },
        })
      }
    } else {
      return res.status(400).json({ error: 'Paste a PlayHQ goal kickers/statistics URL.', goalKickerImporterVersion: importerVersion })
    }

    let imported = 0
    let skipped = 0
    let weeklyChanges = 0
    let feedEvents = 0
    let duplicatesRemoved = 0
    let unchanged = 0
    const rowErrors: Array<{ playerName: string; error: string }> = []
    const rowWarnings: Array<{ playerName: string; warning: string }> = []
    const defaultSeason = new Date().getFullYear().toString()

    for (const row of rows) {
      const playerName = str(row.playerName)
      const clubName = str(row.clubName)
      const leagueName = str(row.leagueName)
      const season = str(row.season, defaultSeason)
      const grade = str(row.grade, 'Senior Football')
      const goals = num(row.goals)
      if (!playerName || !clubName || !leagueName || goals < 0) { skipped++; continue }

      try {
        const league = await prisma.league.findFirst({
          where: {
            sport: 'FOOTBALL',
            archivedAt: null,
            OR: [
              { name: { equals: leagueName, mode: 'insensitive' } },
              ...(sourceUrl ? [{ sourceUrl }, { ladderUrl: sourceUrl }] : []),
            ],
          },
          select: { id: true, name: true },
        })
        if (!league) throw new Error(`League could not be matched: ${leagueName}`)

        const club = await prisma.club.findFirst({
          where: { name: { equals: clubName, mode: 'insensitive' }, sport: 'FOOTBALL', archivedAt: null },
          select: { id: true, name: true },
        })

        const outcome = await upsertCanonicalGoalKicker({
          playerName,
          clubId: club?.id ?? null,
          clubName: club?.name ?? clubName,
          leagueId: league.id,
          leagueName: league.name,
          season,
          grade,
          goals,
          matches: row.matches == null || !Number.isFinite(Number(row.matches)) ? null : Number(row.matches),
          sourceUrl: row.sourceUrl ?? sourceUrl || null,
          sourceType: 'PLAYHQ',
        })

        imported++
        duplicatesRemoved += outcome.duplicatesRemoved
        feedEvents += outcome.feedEventsCreated
        if (outcome.historyCreated) weeklyChanges++
        if (outcome.unchanged) unchanged++
        if (outcome.staleIncomingTotal) rowWarnings.push({ playerName, warning: `Ignored older total of ${Math.trunc(goals)}; current total remains ${outcome.savedGoals}.` })
      } catch (error) {
        rowErrors.push({ playerName: playerName || 'Unknown player', error: error instanceof Error ? error.message : String(error) })
      }
    }

    res.json({
      goalKickerImporterVersion: importerVersion,
      data: {
        imported,
        skipped,
        weeklyChanges,
        feedEvents,
        duplicatesRemoved,
        unchanged,
        errors: rowErrors.length,
        warnings: warnings.length + rowWarnings.length,
        sourceUrl: sourceUrl || null,
        strategy,
        parserWarnings: warnings,
        diagnostics,
        note: `Imported ${imported} goal kicker${imported === 1 ? '' : 's'} through the canonical pipeline.`,
      },
      errors: rowErrors.slice(0, 50),
      warnings: rowWarnings.slice(0, 50),
    })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'goal-kicker URL import failed' })
  }
})

export { router as adminGoalKickerUrlImportsRouter }
