/**
 * Newsroom orchestrator (Phase B3).
 * ─────────────────────────────────────────────────────────────────────────────
 * The single entry point that runs the intelligent newsroom for the latest
 * completed ranking run:
 *
 *   analyse (real data) → compute trends + strength history → detect signals
 *   (deduped) → compose journalist-quality DRAFT articles (with reasoning) →
 *   validate football wording/source data → seed editorial calendar → rebuild search index.
 *
 * Performance: results are cached per ranking run. If the newsroom already ran
 * for the current runId it short-circuits (skipped) unless `force` is set, so an
 * unchanged week never regenerates. Nothing here auto-publishes; articles are
 * DRAFTs. Nothing is invented — every step reads stored data.
 */

import { prisma } from '../db/client.js'
import { logger } from '../utils/logger.js'
import { analyseWeek } from './analysis.js'
import { computeTrends } from './trends.js'
import { detectSignals, persistSignals } from './detector.js'
import { composeArticles } from './composer.js'
import { seedEditorialCalendar } from './calendar.js'
import { rebuildSearchIndex } from './search.js'
import { validateFootballDrafts } from './football-validation.js'

const CACHE_KEY = 'newsroomLastRunId'

export interface NewsroomOptions {
  force?: boolean
  dryRun?: boolean
  reindex?: boolean
}

export interface NewsroomReport {
  weekLabel: string | null
  runId: string | null
  ran: boolean
  cached: boolean
  dryRun: boolean
  signals?: { detected: number; created: number; skipped: number }
  articles?: { created: number; updated: number; skipped: number }
  validation?: { checked: number; corrected: number; blocked: number }
  trends?: { clubsAnalysed: number; leaguesSnapshotted: number }
  search?: { articles: number; clubs: number; leagues: number }
  topSignals: { kind: string; headline: string; confidence: number }[]
  warnings: string[]
}

export async function runNewsroom(opts: NewsroomOptions = {}): Promise<NewsroomReport> {
  const { force = false, dryRun = false, reindex = true } = opts
  const report: NewsroomReport = { weekLabel: null, runId: null, ran: false, cached: false, dryRun, topSignals: [], warnings: [] }

  const analysis = await analyseWeek()
  if (!analysis) { report.warnings.push('no completed ranking run to analyse'); return report }
  report.weekLabel = analysis.weekLabel
  report.runId = analysis.runId

  const signals = detectSignals(analysis)
  report.topSignals = [...signals].sort((a, b) => b.priority - a.priority).slice(0, 10).map(s => ({ kind: s.kind, headline: s.headline, confidence: s.confidence }))
  report.signals = { detected: signals.length, created: 0, skipped: 0 }

  if (dryRun) { report.warnings.push('dry run — nothing written'); return report }

  if (!force) {
    const last = await prisma.setting.findUnique({ where: { key: CACHE_KEY } }).catch(() => null)
    if (last?.value === analysis.runId) {
      report.cached = true
      report.warnings.push('newsroom already ran for this ranking run (use force to regenerate)')
      return report
    }
  }

  try {
    const t = await computeTrends()
    report.trends = { clubsAnalysed: t.clubsAnalysed, leaguesSnapshotted: t.leaguesSnapshotted }
  } catch (e) { report.warnings.push(`trends failed: ${String(e)}`) }

  try {
    const s = await persistSignals(analysis, signals)
    report.signals = { detected: signals.length, created: s.created, skipped: s.skipped }
  } catch (e) { report.warnings.push(`signals failed: ${String(e)}`) }

  try {
    const a = await composeArticles(analysis, signals)
    report.articles = { created: a.created, updated: a.updated, skipped: a.skipped }
    report.validation = await validateFootballDrafts(analysis.runId)
    if (report.validation.blocked) report.warnings.push(`${report.validation.blocked} draft article(s) blocked from publication by football validation`)
  } catch (e) { report.warnings.push(`compose/validation failed: ${String(e)}`) }

  try { await seedEditorialCalendar() } catch (e) { report.warnings.push(`calendar failed: ${String(e)}`) }

  if (reindex) {
    try { report.search = await rebuildSearchIndex() } catch (e) { report.warnings.push(`reindex failed: ${String(e)}`) }
  }

  try { await prisma.setting.upsert({ where: { key: CACHE_KEY }, create: { key: CACHE_KEY, value: analysis.runId }, update: { value: analysis.runId } }) } catch { /* non-fatal */ }
  report.ran = true
  logger.info('Newsroom run complete', { week: analysis.weekLabel, signals: report.signals, articles: report.articles, validation: report.validation })
  return report
}
