/**
 * Admin Platform API — dashboard, national recalculation, review queue, backups.
 * Password-guarded. Mounted at /admin/platform.
 */

import { Router }          from 'express'
import { createHash }      from 'node:crypto'
import { prisma }          from '../db/client.js'
import { requireAdminKey } from '../api/middleware/auth.js'
import { recalculateNational } from '../jobs/recompute-strength.js'
import { parsePlayHQUrl }   from '../discovery/playhq-url.js'
import { dispatchWorkflow, listRuns, getRun, githubConfig } from '../integrations/github-dispatch.js'
import { previewCsv, commitCsv, type CsvEntity, type PreviewRow } from '../jobs/csv-import.js'
import { createBackup } from '../jobs/backup.js'
import { sweepDataQuality } from '../jobs/data-quality.js'
import { generateWeeklyDrafts } from '../jobs/generate-articles.js'
import { runWeeklyUpdate } from '../jobs/weekly-update-engine.js'
import { fetchPage, fetchPlayHqStatisticsPage, parseResults, parseFixtures, parseLadder, parseGoalKickers, type ResultRow, type FixtureRow, type GoalKickerRow } from '../football/url-ingest.js'
import { logger }          from '../utils/logger.js'

// Workflow files (the browser-backed execution engine on GitHub Actions).
const WF_URL_IMPORT = 'playhq-import.yml'
const WF_FOOTBALL_BULK = 'playhq-football-bulk-discovery.yml'
const WF_DISCOVER     = 'discover-import.yml'
const WF_WEEKLY_UPDATE = 'weekly-update.yml'

const router = Router()
router.use(requireAdminKey)

const FOOTBALL_SOURCES = ['PLAYHQ_API', 'PLAYHQ_SCRAPER', 'CSV_UPLOAD', 'OCR_UPLOAD', 'MANUAL_ENTRY'] as const
const FOOTBALL_DATA_TYPES = ['FIXTURES', 'RESULTS', 'LADDER', 'TEAMS', 'GRADES', 'ROUNDS'] as const
type FootballSource = typeof FOOTBALL_SOURCES[number]
type FootballDataType = typeof FOOTBALL_DATA_TYPES[number]
type FootballRow = Record<string, unknown>

const isFootballSource = (v: unknown): v is FootballSource => typeof v === 'string' && (FOOTBALL_SOURCES as readonly string[]).includes(v)
const isFootballDataType = (v: unknown): v is FootballDataType => typeof v === 'string' && (FOOTBALL_DATA_TYPES as readonly string[]).includes(v)
const stableHash = (v: unknown) => createHash('sha256').update(JSON.stringify(v ?? null)).digest('hex')
const num = (v: unknown, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback
const str = (v: unknown, fallback = '') => typeof v === 'string' && v.trim() ? v.trim() : fallback
const footballPoints = (goals: unknown, behinds: unknown, total?: unknown) => Number.isFinite(Number(total)) ? Number(total) : (num(goals) * 6) + num(behinds)

function sourceFlags(primary?: string | null, fallbacks?: string[]) {
  const set = new Set([primary, ...(fallbacks ?? [])].filter(Boolean))
  return {
    apiEnabled: set.has('PLAYHQ_API'),
    scrapeEnabled: set.has('PLAYHQ_SCRAPER'),
    manualEntryEnabled: set.has('MANUAL_ENTRY') || set.has('CSV_UPLOAD') || set.has('OCR_UPLOAD'),
  }
}

async function createFootballReview(leagueId: string, kind: string, reason: string, payload: unknown, confidence = 0.5) {
  await prisma.reviewItem.create({
    data: { entityType: 'FootballData', entityId: leagueId, kind, reason, confidence, payload: JSON.stringify(payload) },
  }).catch(e => logger.warn('football review item failed', { detail: String(e) }))
}

function generateFootballLadder(rows: { homeName: string; awayName: string; homePoints: number; awayPoints: number }[]) {
  const table = new Map<string, { clubName: string; played: number; wins: number; losses: number; draws: number; pointsFor: number; pointsAgainst: number; premiershipPoints: number }>()
  const ensure = (clubName: string) => {
    if (!table.has(clubName)) table.set(clubName, { clubName, played: 0, wins: 0, losses: 0, draws: 0, pointsFor: 0, pointsAgainst: 0, premiershipPoints: 0 })
    return table.get(clubName)!
  }
  for (const r of rows) {
    const h = ensure(r.homeName), a = ensure(r.awayName)
    h.played++; a.played++
    h.pointsFor += r.homePoints; h.pointsAgainst += r.awayPoints
    a.pointsFor += r.awayPoints; a.pointsAgainst += r.homePoints
    if (r.homePoints > r.awayPoints) { h.wins++; a.losses++; h.premiershipPoints += 4 }
    else if (r.homePoints < r.awayPoints) { a.wins++; h.losses++; a.premiershipPoints += 4 }
    else { h.draws++; a.draws++; h.premiershipPoints += 2; a.premiershipPoints += 2 }
  }
  return [...table.values()]
    .map(r => ({ ...r, percentage: r.pointsAgainst > 0 ? (r.pointsFor / r.pointsAgainst) * 100 : r.pointsFor > 0 ? 100 : 0 }))
    .sort((a, b) => b.premiershipPoints - a.premiershipPoints || b.percentage - a.percentage || b.pointsFor - a.pointsFor)
    .map((r, i) => ({ ...r, position: i + 1 }))
}


type LogoEntity = 'league' | 'club'
const LOGO_BUCKET = process.env.SUPABASE_LOGO_BUCKET || 'playfooty-logos'
const MAX_LOGO_BYTES = 5 * 1024 * 1024
const LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'])
const LOGO_EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' }

function pickString(body: Record<string, unknown>, key: string) {
  const v = body[key]
  return typeof v === 'string' ? v.trim() : undefined
}
function pickNullableString(body: Record<string, unknown>, key: string) {
  if (!(key in body)) return undefined
  const v = body[key]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}
function pickBoolean(body: Record<string, unknown>, key: string) {
  return typeof body[key] === 'boolean' ? body[key] as boolean : undefined
}
function cleanFileName(v: string | undefined, fallback: string) {
  return (v || fallback).replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || fallback
}
function decodeLogoBody(body: Record<string, unknown>) {
  const contentType = pickString(body, 'contentType') || 'image/png'
  if (!LOGO_TYPES.has(contentType)) throw new Error('Unsupported logo type. Use PNG, JPG, WEBP or SVG.')
  const raw = pickString(body, 'dataUrl') || pickString(body, 'base64')
  if (!raw) throw new Error('Logo file data required')
  const base64 = raw.includes(',') ? raw.split(',').pop()! : raw
  const buffer = Buffer.from(base64, 'base64')
  if (!buffer.length) throw new Error('Logo file is empty')
  if (buffer.length > MAX_LOGO_BYTES) throw new Error('Logo must be 5MB or smaller')
  return { buffer, contentType, fileName: cleanFileName(pickString(body, 'fileName'), `logo.${LOGO_EXT[contentType] ?? 'png'}`) }
}
async function uploadLogoToStorage(entity: LogoEntity, entityId: string, body: Record<string, unknown>) {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) throw new Error('Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  const { buffer, contentType, fileName } = decodeLogoBody(body)
  const folder = entity === 'league' ? 'league-logos' : 'club-logos'
  const path = `${folder}/${entityId}/${Date.now()}-${fileName}`
  const upload = await fetch(`${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${LOGO_BUCKET}/${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'content-type': contentType, 'x-upsert': 'true' },
    body: buffer,
  })
  if (!upload.ok) throw new Error(`Logo upload failed: HTTP ${upload.status} ${await upload.text().catch(() => '')}`.trim())
  return { path, publicUrl: `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${LOGO_BUCKET}/${path}` }
}
async function deleteLogoFromStorage(logoUrl: string | null | undefined) {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey || !logoUrl) return
  const marker = `/storage/v1/object/public/${LOGO_BUCKET}/`
  const idx = logoUrl.indexOf(marker)
  if (idx === -1) return
  const path = logoUrl.slice(idx + marker.length)
  await fetch(`${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${LOGO_BUCKET}/${encodeURIComponent(path)}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
  }).catch(() => {})
}

async function audit(action: string, entityType: string, entityId: string | null, after: unknown, source = 'ADMIN') {
  try {
    const u = await prisma.adminUser.upsert({ where: { email: 'admin@cnca.local' }, update: {}, create: { email: 'admin@cnca.local', name: 'Admin', role: 'SUPERADMIN' } })
    await prisma.auditLog.create({ data: { userId: u.id, action, entityType, entityId, after: after ? JSON.stringify(after) : null, source } })
  } catch (e) { logger.warn('platform audit failed', { detail: String(e) }) }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.get('/dashboard', async (_req, res) => {
  const [leaguesActive, leaguesArchived, clubs, clubsArchived, teams, pendingReviews, ocrImports, lastRun, recentLeagues, recentClubs, flaggedLeagues] = await Promise.all([
    prisma.league.count({ where: { isActive: true, archivedAt: null } }),
    prisma.league.count({ where: { archivedAt: { not: null } } }),
    prisma.club.count({ where: { archivedAt: null } }),
    prisma.club.count({ where: { archivedAt: { not: null } } }),
    prisma.clubLeagueSeason.count({ where: { isActive: true } }),
    prisma.reviewItem.count({ where: { status: 'PENDING' } }),
    prisma.ocrImport.count(),
    prisma.rankingRun.findFirst({ where: { status: 'COMPLETED' }, orderBy: { completedAt: 'desc' }, select: { weekLabel: true, completedAt: true, clubCount: true } }),
    prisma.league.findMany({ where: { lastManualUpdateAt: { not: null } }, orderBy: { lastManualUpdateAt: 'desc' }, take: 8, select: { id: true, name: true, lastManualUpdateAt: true, status: true } }),
    prisma.club.findMany({ orderBy: { updatedAt: 'desc' }, take: 8, select: { id: true, name: true, updatedAt: true } }),
    prisma.league.findMany({ where: { OR: [{ needsStrengthReview: true }, { syncError: { not: null } }], isActive: true }, select: { id: true, name: true, syncError: true, needsStrengthReview: true, strengthConfidence: true } }),
  ])
  const lastScrape = await prisma.leagueSource.findFirst({ where: { lastScrapedAt: { not: null } }, orderBy: { lastScrapedAt: 'desc' }, select: { lastScrapedAt: true, sourceType: true } })
  res.json({ data: {
    counts: { leaguesActive, leaguesArchived, clubs, clubsArchived, teams, pendingReviews, ocrImports },
    lastRun, lastScrape,
    warnings: flaggedLeagues.length,
    recentLeagues, recentClubs, flaggedLeagues,
  } })
})

// ─── Audit log ───────────────────────────────────────────────────────────────
router.get('/audit', async (req, res) => {
  const take = Math.min(Number(req.query.limit) || 200, 500)
  const entity = req.query.entityType as string | undefined
  const logs = await prisma.auditLog.findMany({
    where: entity ? { entityType: entity } : {},
    orderBy: { createdAt: 'desc' }, take,
    select: { id: true, action: true, entityType: true, entityId: true, source: true, reason: true, before: true, after: true, createdAt: true, user: { select: { email: true, name: true } } },
  })
  res.json({ data: logs })
})

// ─── Settings (key/value) ────────────────────────────────────────────────────
router.get('/settings', async (_req, res) => {
  const rows = await prisma.setting.findMany({ orderBy: { key: 'asc' } })
  res.json({ data: rows })
})
router.post('/settings', async (req, res) => {
  const { key, value } = req.body as { key?: string; value?: string }
  if (!key) return res.status(400).json({ error: 'key required' })
  const row = await prisma.setting.upsert({ where: { key }, update: { value: value ?? '' }, create: { key, value: value ?? '' } })
  await audit('SET_SETTING', 'Setting', key, { value })
  res.json({ data: row })
})

// ─── Execution engine status ──────────────────────────────────────────────────
// The admin panel dispatches browser-backed work to GitHub Actions (Playwright
// cannot run inside Vercel). These endpoints expose config + run status so the
// UI can stay one-click and poll results.
router.get('/engine', async (_req, res) => {
  const cfg = githubConfig()
  res.json({ data: { repo: cfg.repo, ref: cfg.ref, configured: cfg.hasToken } })
})
router.get('/engine/runs', async (req, res) => {
  const file = (req.query.workflow as string) || WF_URL_IMPORT
  try { res.json({ data: await listRuns(file, Math.min(Number(req.query.limit) || 10, 30)) }) }
  catch (err) { res.status(502).json({ error: err instanceof Error ? err.message : 'failed to list runs' }) }
})
router.get('/engine/runs/:id', async (req, res) => {
  try { res.json({ data: await getRun(Number(req.params.id)) }) }
  catch (err) { res.status(502).json({ error: err instanceof Error ? err.message : 'failed to get run' }) }
})

// ─── PlayHQ URL import (Phase 1) — dispatched to GitHub Actions ───────────────
// Preview: classify a pasted URL without importing (instant, local, no browser).
router.post('/playhq/classify', async (req, res) => {
  const { url } = req.body as { url?: string }
  if (!url) return res.status(400).json({ error: 'url required' })
  res.json({ data: parsePlayHQUrl(url) })
})
// Import: dispatch the browser-backed import workflow with the pasted URL.
router.post('/playhq/import', async (req, res) => {
  const { url } = req.body as { url?: string }
  if (!url) return res.status(400).json({ error: 'url required' })
  const parsed = parsePlayHQUrl(url)
  if (!parsed.ok || !parsed.orgSlug) return res.status(400).json({ error: parsed.warnings.join('; ') || 'Could not parse PlayHQ URL' })
  try {
    const ref = githubConfig().ref
    const out = await dispatchWorkflow(WF_URL_IMPORT, { url })
    const workflowRunUrl = out.run?.htmlUrl ?? out.htmlUrl
    const payload = { submittedUrl: url, dispatchedWorkflow: WF_URL_IMPORT, dispatchedRef: ref, workflowRunUrl, importStatus: 'DISPATCHED', runId: out.run?.id ?? null }
    logger.info('PlayHQ URL import workflow dispatched', payload)
    await audit('PLAYHQ_URL_IMPORT_DISPATCH', 'League', null, payload, 'PLAYHQ_URL')
    res.status(202).json({ data: { ...out, kind: parsed.kind, ...payload } })
  } catch (err) { res.status(502).json({ error: err instanceof Error ? err.message : 'dispatch failed' }) }
})

// ─── League sync (Phase 10) — dispatched to GitHub Actions ────────────────────
router.post('/leagues/:id/sync', async (req, res) => {
  try {
    const out = await dispatchWorkflow(WF_URL_IMPORT, { sync_league_id: req.params.id })
    await audit('SYNC_LEAGUE_DISPATCH', 'League', req.params.id, { runId: out.run?.id ?? null }, 'PLAYHQ_SYNC')
    res.status(202).json({ data: out })
  } catch (err) { res.status(502).json({ error: err instanceof Error ? err.message : 'dispatch failed' }) }
})
// Sync every league that has a stored PlayHQ URL (weekly refresh).
router.post('/playhq/sync-all', async (_req, res) => {
  try {
    const out = await dispatchWorkflow(WF_URL_IMPORT, { sync_all: 'true' })
    await audit('SYNC_ALL_DISPATCH', 'League', null, { runId: out.run?.id ?? null }, 'PLAYHQ_SYNC')
    res.status(202).json({ data: out })
  } catch (err) { res.status(502).json({ error: err instanceof Error ? err.message : 'dispatch failed' }) }
})

// Controlled football bulk discovery/import — safe defaults are VIC, limit=5,
// dryRun=true. The browser-backed workflow runs on GitHub Actions, not Vercel.
router.post('/playhq/football-bulk-discover', async (req, res) => {
  const b = req.body as { state?: string; limit?: string | number; dryRun?: boolean; season?: string; grade?: string; seedUrls?: string; roundLimit?: string | number }
  try {
    const inputs: Record<string, string> = {
      state: str(b.state, 'VIC').toUpperCase(),
      limit: String(b.limit ?? 5),
      dry_run: String(b.dryRun ?? true),
      season: str(b.season, '2026'),
      grade: str(b.grade, 'Senior Football'),
      seed_urls: str(b.seedUrls, ''),
      round_limit: String(b.roundLimit ?? 15),
    }
    const out = await dispatchWorkflow(WF_FOOTBALL_BULK, inputs)
    await audit('PLAYHQ_FOOTBALL_BULK_DISCOVERY_DISPATCH', 'League', null, { runId: out.run?.id ?? null, inputs }, 'PLAYHQ_DISCOVERY')
    res.status(202).json({ data: out })
  } catch (err) { res.status(502).json({ error: err instanceof Error ? err.message : 'dispatch failed' }) }
})

// Discovery scrape (crawl PlayHQ + import discovered A-Grade leagues).
router.post('/playhq/discover', async (req, res) => {
  const { assocFilter, maxAssociations } = req.body as { assocFilter?: string; maxAssociations?: string }
  try {
    const inputs: Record<string, string> = {}
    if (assocFilter) inputs.assoc_filter = assocFilter
    if (maxAssociations) inputs.max_associations = String(maxAssociations)
    const out = await dispatchWorkflow(WF_DISCOVER, inputs)
    await audit('DISCOVERY_DISPATCH', 'League', null, { runId: out.run?.id ?? null, assocFilter, maxAssociations }, 'PLAYHQ_DISCOVERY')
    res.status(202).json({ data: out })
  } catch (err) { res.status(502).json({ error: err instanceof Error ? err.message : 'dispatch failed' }) }
})

// ─── CSV import (Phase 4) — validate → preview → commit ──────────────────────
const CSV_ENTITIES: CsvEntity[] = ['leagues', 'clubs', 'teams', 'ladders', 'mappings', 'rankings']
router.post('/csv/preview', async (req, res) => {
  const { entity, csv } = req.body as { entity?: string; csv?: string }
  if (!entity || !CSV_ENTITIES.includes(entity as CsvEntity)) return res.status(400).json({ error: `entity must be one of ${CSV_ENTITIES.join(', ')}` })
  if (!csv) return res.status(400).json({ error: 'csv required' })
  res.json({ data: previewCsv(entity as CsvEntity, csv) })
})
router.post('/csv/commit', async (req, res) => {
  const { entity, rows } = req.body as { entity?: string; rows?: PreviewRow[] }
  if (!entity || !CSV_ENTITIES.includes(entity as CsvEntity)) return res.status(400).json({ error: 'invalid entity' })
  if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows required' })
  try {
    const result = await commitCsv(entity as CsvEntity, rows)
    await audit('CSV_IMPORT', entity, null, { created: result.created, updated: result.updated, skipped: result.skipped }, 'CSV')
    res.json({ data: result })
  } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'commit failed' }) }
})

// ─── AI Publishing (Phase 4) ──────────────────────────────────────────────────
// Generate weekly drafts from the latest ranking run (real data, templated).
router.post('/articles/generate', async (_req, res) => {
  try {
    const report = await generateWeeklyDrafts()
    await audit('GENERATE_ARTICLES', 'GeneratedArticle', null, { created: report.created, updated: report.updated, week: report.weekLabel }, 'SYSTEM')
    res.json({ data: report })
  } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'generation failed' }) }
})
// List drafts/articles by status.
router.get('/articles', async (req, res) => {
  const status = (req.query.status as string) || 'ALL'
  const items = await prisma.generatedArticle.findMany({
    where: status === 'ALL' ? {} : { status },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }], take: 200,
    select: { id: true, slug: true, kind: true, category: true, title: true, subtitle: true, summary: true, status: true, weekLabel: true, updatedAt: true, publishedAt: true },
  })
  const counts = await prisma.generatedArticle.groupBy({ by: ['status'], _count: { status: true } })
  res.json({ data: items, meta: { counts: counts.map(c => ({ status: c.status, count: c._count.status })) } })
})
router.get('/articles/:id', async (req, res) => {
  const a = await prisma.generatedArticle.findUnique({ where: { id: req.params.id } })
  if (!a) return res.status(404).json({ error: 'not found' })
  res.json({ data: a })
})
// Edit any field (operator polish before publish).
router.patch('/articles/:id', async (req, res) => {
  const b = req.body as Partial<{ title: string; subtitle: string; summary: string; body: unknown; category: string; seoTitle: string; seoDescription: string; heroSeed: string }>
  const data: Record<string, unknown> = {}
  for (const k of ['title', 'subtitle', 'summary', 'category', 'seoTitle', 'seoDescription', 'heroSeed'] as const) if (b[k] != null) data[k] = b[k]
  if (b.body != null) data.body = typeof b.body === 'string' ? b.body : JSON.stringify(b.body)
  const a = await prisma.generatedArticle.update({ where: { id: req.params.id }, data })
  await audit('EDIT_ARTICLE', 'GeneratedArticle', a.id, { title: a.title })
  res.json({ data: a })
})
// Approve / publish / unpublish / archive.
router.post('/articles/:id/status', async (req, res) => {
  const { status } = req.body as { status: 'DRAFT' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED' }
  if (!['DRAFT', 'APPROVED', 'PUBLISHED', 'ARCHIVED'].includes(status)) return res.status(400).json({ error: 'invalid status' })
  const a = await prisma.generatedArticle.update({
    where: { id: req.params.id },
    data: { status, publishedAt: status === 'PUBLISHED' ? new Date() : undefined },
  })
  await audit(`ARTICLE_${status}`, 'GeneratedArticle', a.id, { title: a.title })
  res.json({ data: { id: a.id, status: a.status, publishedAt: a.publishedAt } })
})
// Bulk publish/approve.
router.post('/articles/bulk', async (req, res) => {
  const { ids, status } = req.body as { ids?: string[]; status?: string }
  if (!Array.isArray(ids) || ids.length === 0 || !['APPROVED', 'PUBLISHED', 'ARCHIVED', 'DRAFT'].includes(status ?? '')) return res.status(400).json({ error: 'ids and valid status required' })
  const r = await prisma.generatedArticle.updateMany({ where: { id: { in: ids } }, data: { status: status!, publishedAt: status === 'PUBLISHED' ? new Date() : undefined } })
  await audit('ARTICLES_BULK', 'GeneratedArticle', null, { status, count: r.count })
  res.json({ data: { updated: r.count, status } })
})

// ─── National recalculation ──────────────────────────────────────────────────
router.post('/recalculate', async (_req, res) => {
  const locked = (await prisma.setting.findUnique({ where: { key: 'rankingsLocked' } }).catch(() => null))?.value === 'true'
  if (locked) return res.status(423).json({ error: 'rankings are locked' })
  try {
    const report = await recalculateNational()
    await audit('RECALCULATE_NATIONAL', 'Ranking', null, { clubsRanked: report.clubsRanked, leagues: report.leagues.length }, 'SYSTEM')
    res.json({ data: report })
  } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'recalc failed' }) }
})

// ─── Weekly Update Engine (Backend Phase B1) ──────────────────────────────────
// Serverless-safe run: recalc → sweep → drafts (+ optional pre-run backup), all
// browser-free. The ladder sync step needs Playwright, so for a full run
// (sync=true) we dispatch the browser-backed weekly-update.yml workflow instead.
router.post('/weekly-update', async (req, res) => {
  const b = (req.body ?? {}) as {
    sync?: boolean; leagueId?: string; backupFirst?: boolean
    recalculate?: boolean; sweep?: boolean; generateDrafts?: boolean; dryRun?: boolean
  }
  try {
    // Full run with ladder sync → hand off to GitHub Actions (browser required).
    if (b.sync) {
      const out = await dispatchWorkflow(WF_WEEKLY_UPDATE, {
        ...(b.leagueId ? { league_id: b.leagueId } : {}),
        ...(b.backupFirst === false ? { no_backup: 'true' } : {}),
        ...(b.dryRun ? { dry_run: 'true' } : {}),
      })
      await audit('WEEKLY_UPDATE_DISPATCH', 'System', null, { runId: out.run?.id ?? null, leagueId: b.leagueId ?? null }, 'WEEKLY_ENGINE')
      return res.json({ data: { dispatched: true, run: out.run, htmlUrl: out.htmlUrl } })
    }

    // Serverless-safe steps only (no browser). Runs inline and returns the report.
    const rankingsLocked = (await prisma.setting.findUnique({ where: { key: 'rankingsLocked' } }).catch(() => null))?.value === 'true'
    const report = await runWeeklyUpdate({
      sync: false,
      leagueId: b.leagueId,
      backupFirst: b.backupFirst ?? true,
      recalculate: rankingsLocked ? false : (b.recalculate ?? true),
      sweep: b.sweep ?? true,
      generateDrafts: b.generateDrafts ?? true,
      dryRun: b.dryRun ?? false,
      source: 'ADMIN',
    })
    // The engine writes its own summary AuditLog; nothing more to add here.
    res.json({ data: report })
  } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'weekly update failed' }) }
})

// ─── Review queue ─────────────────────────────────────────────────────────────
router.get('/reviews', async (req, res) => {
  const status = (req.query.status as string) ?? 'PENDING'
  const kind = req.query.kind as string | undefined
  const items = await prisma.reviewItem.findMany({
    where: { ...(status === 'ALL' ? {} : { status }), ...(kind ? { kind } : {}) },
    orderBy: [{ confidence: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],   // least-confident first
    take: 300,
  })
  // Kind counts so the UI can render filter chips with badges.
  const kinds = await prisma.reviewItem.groupBy({ by: ['kind'], where: { status: 'PENDING' }, _count: { kind: true } })
  res.json({ data: items, meta: { kinds: kinds.map(k => ({ kind: k.kind, count: k._count.kind })) } })
})
router.post('/reviews', async (req, res) => {
  const b = req.body as { entityType: string; entityId?: string; kind: string; reason: string; confidence?: number; payload?: unknown }
  if (!b.entityType || !b.kind || !b.reason) return res.status(400).json({ error: 'entityType, kind, reason required' })
  const item = await prisma.reviewItem.create({ data: { entityType: b.entityType, entityId: b.entityId ?? null, kind: b.kind, reason: b.reason, confidence: b.confidence ?? null, payload: b.payload ? JSON.stringify(b.payload) : null } })
  res.status(201).json({ data: item })
})
router.post('/reviews/:id/resolve', async (req, res) => {
  const { action } = req.body as { action: 'APPROVED' | 'REJECTED' | 'MERGED' | 'IGNORED' }
  const item = await prisma.reviewItem.update({ where: { id: req.params.id }, data: { status: action, resolvedAt: new Date(), resolvedBy: 'admin' } })
  await audit('RESOLVE_REVIEW', 'ReviewItem', item.id, { action })
  res.json({ data: item })
})
// Bulk resolve — approve/ignore/reject many items in one click.
router.post('/reviews/bulk', async (req, res) => {
  const { ids, action } = req.body as { ids?: string[]; action?: 'APPROVED' | 'REJECTED' | 'MERGED' | 'IGNORED' }
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids required' })
  if (!action || !['APPROVED', 'REJECTED', 'MERGED', 'IGNORED'].includes(action)) return res.status(400).json({ error: 'invalid action' })
  const result = await prisma.reviewItem.updateMany({ where: { id: { in: ids }, status: 'PENDING' }, data: { status: action, resolvedAt: new Date(), resolvedBy: 'admin' } })
  await audit('RESOLVE_REVIEWS_BULK', 'ReviewItem', null, { action, count: result.count })
  res.json({ data: { resolved: result.count, action } })
})

// ─── Data-quality sweep (Phase 5) ─────────────────────────────────────────────
// Scans for duplicate clubs, missing logos, orphan clubs and stale leagues, and
// raises review items (idempotent — pending items are never duplicated).
router.post('/quality/sweep', async (_req, res) => {
  try {
    const report = await sweepDataQuality()
    await audit('QUALITY_SWEEP', 'ReviewItem', null, report, 'SYSTEM')
    res.json({ data: report })
  } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : 'sweep failed' }) }
})

// ─── Backups / restore points (snapshot/createBackup shared with the nightly job) ─
router.get('/backups', async (_req, res) => {
  const backups = await prisma.backup.findMany({ orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, label: true, kind: true, counts: true, createdAt: true } })
  res.json({ data: backups })
})
router.post('/backups', async (req, res) => {
  const { label } = req.body as { label?: string }
  const backup = await createBackup('MANUAL', label)
  await audit('CREATE_BACKUP', 'Backup', backup.id, backup.counts)
  res.status(201).json({ data: backup })
})
// Restore reseeds core tables from a backup (upsert; takes a safety snapshot first).
router.post('/backups/:id/restore', async (req, res) => {
  const backup = await prisma.backup.findUnique({ where: { id: req.params.id } })
  if (!backup) return res.status(404).json({ error: 'not found' })
  await createBackup('PRE_RESTORE')   // safety snapshot before restore

  const d = JSON.parse(backup.data) as { states: any[]; associations: any[]; leagues: any[]; clubs: any[]; leagueSources: any[]; clubLeagueSeasons: any[] }
  let restored = 0
  for (const s of d.states)  { await prisma.state.upsert({ where: { id: s.id }, update: s, create: s }).catch(() => {}); restored++ }
  for (const a of d.associations) { await prisma.association.upsert({ where: { id: a.id }, update: a, create: a }).catch(() => {}) }
  for (const l of d.leagues) { await prisma.league.upsert({ where: { id: l.id }, update: l, create: l }).catch(() => {}) }
  for (const c of d.clubs)   { await prisma.club.upsert({ where: { id: c.id }, update: c, create: c }).catch(() => {}) }
  for (const cs of d.clubLeagueSeasons) { await prisma.clubLeagueSeason.upsert({ where: { id: cs.id }, update: cs, create: cs }).catch(() => {}) }
  await audit('RESTORE_BACKUP', 'Backup', backup.id, backup.counts, 'SYSTEM')
  res.json({ data: { restored: true, from: backup.label } })
})

// ─── Editable league and club profiles ──────────────────────────────────────
router.get('/leagues/:id', async (req, res) => {
  const league = await prisma.league.findUnique({
    where: { id: req.params.id },
    select: {
      id: true, name: true, shortName: true, stateId: true, isActive: true, strengthScore: true, strengthTier: true,
      strengthConfidence: true, finalStrengthRating: true, manualStrengthOverride: true, needsStrengthReview: true,
      playhqOrgSlug: true, playhqGradeId: true, playhqGradeName: true, ladderUrl: true, currentSeason: true,
      enabled: true, lastSyncedAt: true, primarySource: true, importType: true, sourceUrl: true, status: true,
      manualOverride: true, hidden: true, regionName: true, websiteUrl: true, facebookUrl: true, logoUrl: true,
      sport: true, primaryDataSource: true, fallbackDataSources: true, playhqOrganisationId: true,
      playhqCompetitionId: true, playhqSeasonId: true, playhqGradeId: true, scrapeEnabled: true,
      apiEnabled: true, manualEntryEnabled: true, lastSyncAt: true, lastSuccessfulSyncAt: true, syncStatus: true,
      dataSourceSyncError: true, archivedAt: true, approvalStatus: true, leagueType: true, reviewReason: true,
      strengthReasoning: true, strengthCalculatedAt: true, state: { select: { id: true, code: true, name: true } },
      sources: { select: { id: true, sourceType: true, ladderUrl: true, fixturesUrl: true, resultsUrl: true, season: true, isActive: true, lastScrapedAt: true, lastStatus: true, notes: true } },
      clubSeasons: { select: { id: true, clubId: true, leagueId: true, season: true, grade: true, isActive: true, sport: true, played: true, wins: true, losses: true, draws: true, goalsFor: true, goalsAgainst: true, percentage: true, points: true, position: true, club: { select: { id: true, name: true, shortName: true, logoUrl: true, state: { select: { code: true, name: true } } } } }, orderBy: [{ season: 'desc' }, { grade: 'asc' }] },
      footballFixtures: { orderBy: [{ season: 'desc' }, { round: 'asc' }], take: 100 },
      footballResults: { orderBy: [{ season: 'desc' }, { round: 'asc' }], take: 100 },
      footballLadderEntries: { orderBy: [{ season: 'desc' }, { position: 'asc' }], take: 100 },
      footballImports: { orderBy: { createdAt: 'desc' }, take: 50 },
      _count: { select: { clubSeasons: true, footballFixtures: true, footballResults: true, footballLadderEntries: true, footballImports: true } },
    },
  })
  if (!league) return res.status(404).json({ error: 'league not found' })
  res.json({ data: { ...league, description: null, featuredLeague: false, profileFieldsAvailable: false } })
})

router.patch('/leagues/:id', async (req, res) => {
  const body = req.body as Record<string, unknown>
  const data: Record<string, unknown> = { lastManualUpdateAt: new Date(), manualOverride: true }
  for (const key of ['name', 'shortName', 'regionName', 'websiteUrl', 'facebookUrl', 'sourceUrl', 'primaryDataSource', 'status', 'approvalStatus', 'currentSeason', 'playhqGradeName'] as const) {
    const value = pickNullableString(body, key)
    if (value !== undefined) data[key] = value
  }
  for (const key of ['isActive', 'enabled', 'hidden'] as const) {
    const value = pickBoolean(body, key)
    if (value !== undefined) data[key] = value
  }
  if (typeof body.stateId === 'string' && body.stateId) data.stateId = body.stateId
  if (typeof body.state === 'string' && body.state.trim()) {
    const code = body.state.trim().toUpperCase()
    const state = await prisma.state.upsert({ where: { code }, create: { code, name: code }, update: {} })
    data.stateId = state.id
  }
  const league = await prisma.league.update({ where: { id: req.params.id }, data, select: { id: true, name: true, shortName: true, regionName: true, websiteUrl: true, facebookUrl: true, sourceUrl: true, primaryDataSource: true, status: true, approvalStatus: true, currentSeason: true, playhqGradeName: true, isActive: true, enabled: true, hidden: true, logoUrl: true, sport: true, state: { select: { code: true, name: true } } } })
  await audit('UPDATE_LEAGUE_PROFILE', 'League', league.id, data)
  res.json({ data: { ...league, description: null, featuredLeague: false, profileFieldsAvailable: false } })
})

router.post('/leagues/:id/logo', async (req, res) => {
  const league = await prisma.league.findUnique({ where: { id: req.params.id }, select: { id: true, logoUrl: true } })
  if (!league) return res.status(404).json({ error: 'league not found' })
  try {
    const uploaded = await uploadLogoToStorage('league', league.id, req.body as Record<string, unknown>)
    const updated = await prisma.league.update({ where: { id: league.id }, data: { logoUrl: uploaded.publicUrl, lastManualUpdateAt: new Date(), manualOverride: true }, select: { id: true, name: true, logoUrl: true } })
    await audit('UPLOAD_LEAGUE_LOGO', 'League', league.id, uploaded)
    res.json({ data: updated, logo: uploaded })
  } catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : 'logo upload failed' }) }
})

router.delete('/leagues/:id/logo', async (req, res) => {
  const league = await prisma.league.findUnique({ where: { id: req.params.id }, select: { id: true, logoUrl: true } })
  if (!league) return res.status(404).json({ error: 'league not found' })
  await deleteLogoFromStorage(league.logoUrl)
  const updated = await prisma.league.update({ where: { id: league.id }, data: { logoUrl: null, lastManualUpdateAt: new Date(), manualOverride: true }, select: { id: true, name: true, logoUrl: true } })
  await audit('REMOVE_LEAGUE_LOGO', 'League', league.id, null)
  res.json({ data: updated })
})

router.get('/clubs/:id', async (req, res) => {
  const club = await prisma.club.findUnique({
    where: { id: req.params.id },
    select: {
      id: true, name: true, slug: true, shortName: true, stateId: true, region: true, latitude: true, longitude: true,
      logoUrl: true, primaryColour: true, secondaryColour: true, websiteUrl: true, facebookUrl: true, instagramUrl: true,
      isActive: true, notes: true, manualOverride: true, source: true, bestRank: true, sport: true, playhqClubId: true,
      archivedAt: true, approvalStatus: true, townName: true,
      state: { select: { id: true, code: true, name: true } },
      leagueSeasons: { select: { id: true, clubId: true, leagueId: true, season: true, grade: true, isActive: true, sport: true, played: true, wins: true, losses: true, draws: true, goalsFor: true, goalsAgainst: true, percentage: true, points: true, position: true, league: { select: { id: true, name: true, shortName: true, sport: true, state: { select: { code: true, name: true } } } } }, orderBy: [{ season: 'desc' }, { grade: 'asc' }] },
      rankingEntries: { orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, rank: true, previousRank: true, rankMovement: true, powerRating: true, weekLabel: true, season: true, leagueName: true, state: true, createdAt: true, rankingRun: { select: { weekLabel: true, season: true, completedAt: true } } } },
      nameVariants: { select: { id: true, rawName: true, sourceType: true, confidence: true, createdAt: true } },
    },
  })
  if (!club) return res.status(404).json({ error: 'club not found' })
  res.json({ data: { ...club, description: null, contactEmail: null, featuredClub: false, profileFieldsAvailable: false } })
})

router.patch('/clubs/:id', async (req, res) => {
  const body = req.body as Record<string, unknown>
  const data: Record<string, unknown> = { manualOverride: true }
  for (const key of ['name', 'shortName', 'logoUrl', 'primaryColour', 'secondaryColour', 'websiteUrl', 'facebookUrl', 'instagramUrl', 'region', 'sport', 'approvalStatus', 'townName', 'notes'] as const) {
    const value = pickNullableString(body, key)
    if (value !== undefined) data[key] = value
  }
  for (const key of ['isActive'] as const) {
    const value = pickBoolean(body, key)
    if (value !== undefined) data[key] = value
  }
  if (body.archivedAt === null) data.archivedAt = null
  if (typeof body.stateId === 'string' && body.stateId) data.stateId = body.stateId
  if (typeof body.state === 'string' && body.state.trim()) {
    const code = body.state.trim().toUpperCase()
    const state = await prisma.state.upsert({ where: { code }, create: { code, name: code }, update: {} })
    data.stateId = state.id
  }
  const club = await prisma.club.update({ where: { id: req.params.id }, data, select: { id: true, name: true, shortName: true, logoUrl: true, primaryColour: true, secondaryColour: true, websiteUrl: true, facebookUrl: true, instagramUrl: true, region: true, sport: true, approvalStatus: true, townName: true, notes: true, isActive: true, state: { select: { code: true, name: true } } } })
  await audit('UPDATE_CLUB_PROFILE', 'Club', club.id, data)
  res.json({ data: { ...club, description: null, contactEmail: null, featuredClub: false, profileFieldsAvailable: false } })
})

router.post('/clubs/:id/logo', async (req, res) => {
  const club = await prisma.club.findUnique({ where: { id: req.params.id }, select: { id: true, logoUrl: true } })
  if (!club) return res.status(404).json({ error: 'club not found' })
  try {
    const uploaded = await uploadLogoToStorage('club', club.id, req.body as Record<string, unknown>)
    const updated = await prisma.club.update({ where: { id: club.id }, data: { logoUrl: uploaded.publicUrl, manualOverride: true }, select: { id: true, name: true, logoUrl: true } })
    await audit('UPLOAD_CLUB_LOGO', 'Club', club.id, uploaded)
    res.json({ data: updated, logo: uploaded })
  } catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : 'logo upload failed' }) }
})

router.delete('/clubs/:id/logo', async (req, res) => {
  const club = await prisma.club.findUnique({ where: { id: req.params.id }, select: { id: true, logoUrl: true } })
  if (!club) return res.status(404).json({ error: 'club not found' })
  await deleteLogoFromStorage(club.logoUrl)
  const updated = await prisma.club.update({ where: { id: club.id }, data: { logoUrl: null, manualOverride: true }, select: { id: true, name: true, logoUrl: true } })
  await audit('REMOVE_CLUB_LOGO', 'Club', club.id, null)
  res.json({ data: updated })
})

router.get('/goal-kickers', async (_req, res) => {
  const rows = await prisma.footballGoalKicker.findMany({
    orderBy: [{ goals: 'desc' }, { playerName: 'asc' }],
    take: 500,
    select: { id: true, playerName: true, clubId: true, clubName: true, leagueId: true, leagueName: true, season: true, grade: true, goals: true, matches: true, sourceUrl: true, sourceType: true, importedAt: true },
  })
  res.json({ data: rows })
})

router.post('/goal-kickers/import', async (req, res) => {
  const b = req.body as { sourceUrl?: string; url?: string; rows?: Array<Record<string, unknown>> }
  const sourceUrl = str(b.sourceUrl ?? b.url, '').trim()
  let rows: GoalKickerRow[] = []
  let strategy = 'provided-rows'
  let warnings: string[] = []
  let diagnostics: Record<string, unknown> | null = null
  const goalKickerImporterVersion = 'playwright-retry-v2'

  if (Array.isArray(b.rows) && b.rows.length) {
    rows = b.rows.map(row => ({
      playerName: str(row.playerName ?? row.player, '').trim(),
      clubName: str(row.clubName ?? row.club, '').trim(),
      leagueName: str(row.leagueName ?? row.league, '').trim(),
      season: str(row.season, '2026'),
      grade: str(row.grade, 'Senior Football'),
      goals: num(row.goals),
      matches: row.matches == null ? undefined : num(row.matches),
      sourceUrl,
    })).filter(row => row.playerName && row.clubName && row.leagueName)
  } else if (sourceUrl) {
    const page = await fetchPlayHqStatisticsPage(sourceUrl, 30000)
    const parsed = parseGoalKickers(page)
    rows = parsed.rows
    const fetchStrategy = (page.diagnostics as Record<string, unknown> | undefined)?.fetchStrategy
    strategy = fetchStrategy === 'playwright-render' ? 'playwright-render' : parsed.strategy
    warnings = parsed.warnings
    diagnostics = page.diagnostics ?? null
    if (rows.length === 0) {
      const d = (page.diagnostics ?? {}) as Record<string, unknown>
      return res.status(422).json({
        error: 'No goal kicker rows could be parsed from this PlayHQ page.',
        goalKickerImporterVersion,
        data: {
          imported: 0,
          skipped: 0,
          errors: 0,
          sourceUrl,
          goalKickerImporterVersion,
          strategy,
          warnings,
          diagnostics: {
            urlLoaded: page.url,
            pageTitle: d.title ?? null,
            tableCount: d.tableCount ?? 0,
            rowCount: d.rowCount ?? 0,
            capturedJsonCount: d.capturedJsonCount ?? 0,
            sampleRenderedText: d.textSample ?? '',
            attemptedRenderedFetch: d.attemptedRenderedFetch ?? false,
            renderedFetchSucceeded: d.renderedFetchSucceeded ?? false,
            renderedFetchError: d.renderedFetchError ?? null,
          },
        },
      })
    }
  } else {
    return res.status(400).json({ error: 'Paste a PlayHQ goal kickers/statistics URL.', goalKickerImporterVersion })
  }

  let imported = 0
  let skipped = 0
  const errors: Array<{ row: GoalKickerRow; error: string }> = []
  const defaultSeason = new Date().getFullYear().toString()

  for (const row of rows) {
    try {
      const playerName = str(row.playerName, '').trim()
      const clubName = str(row.clubName, '').trim()
      const leagueName = str(row.leagueName, '').trim()
      const season = str(row.season, defaultSeason)
      const grade = str(row.grade, 'Senior Football')
      const goals = num(row.goals)
      if (!playerName || !clubName || !leagueName || goals < 0) { skipped++; continue }
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
      const club = await prisma.club.findFirst({ where: { name: { equals: clubName, mode: 'insensitive' }, sport: 'FOOTBALL', archivedAt: null }, select: { id: true, name: true } })
      const storedLeagueName = league?.name ?? leagueName
      await prisma.footballGoalKicker.upsert({
        where: { season_grade_playerName_clubName_leagueName: { season, grade, playerName, clubName, leagueName: storedLeagueName } },
        create: { playerName, clubId: club?.id ?? null, clubName, leagueId: league?.id ?? null, leagueName: storedLeagueName, season, grade, goals, matches: row.matches == null ? null : num(row.matches), sourceUrl: row.sourceUrl ?? sourceUrl, sourceType: 'PLAYHQ', importedAt: new Date() },
        update: { clubId: club?.id ?? null, leagueId: league?.id ?? null, leagueName: storedLeagueName, goals, matches: row.matches == null ? null : num(row.matches), sourceUrl: row.sourceUrl ?? sourceUrl, sourceType: 'PLAYHQ', importedAt: new Date() },
      })
      imported++
    } catch (err) {
      errors.push({ row, error: err instanceof Error ? err.message : String(err) })
    }
  }

  res.json({ goalKickerImporterVersion, data: { imported, skipped, errors: errors.length, sourceUrl: sourceUrl || null, goalKickerImporterVersion, strategy, warnings, diagnostics, note: `Imported ${imported} goal kicker${imported === 1 ? '' : 's'}.` }, errors: errors.slice(0, 20) })
})
// ─── PlayFooty football data-source control centre ───────────────────────────
router.get('/football/leagues', async (_req, res) => {
  const leagues = await prisma.league.findMany({
    where: { sport: 'FOOTBALL', archivedAt: null },
    select: {
      id: true, name: true, shortName: true, strengthScore: true, strengthConfidence: true, manualStrengthOverride: true, finalStrengthRating: true, needsStrengthReview: true,
      status: true, hidden: true, enabled: true, isActive: true, primarySource: true, importType: true, regionName: true, websiteUrl: true, facebookUrl: true, logoUrl: true,
      archivedAt: true, approvalStatus: true, leagueType: true, reviewReason: true, strengthReasoning: true, strengthCalculatedAt: true, sport: true, primaryDataSource: true,
      fallbackDataSources: true, sourceUrl: true, currentSeason: true, playhqOrganisationId: true, playhqCompetitionId: true, playhqSeasonId: true, playhqGradeId: true,
      scrapeEnabled: true, apiEnabled: true, manualEntryEnabled: true, lastSyncAt: true, lastSuccessfulSyncAt: true, syncStatus: true, dataSourceSyncError: true,
      state: { select: { code: true, name: true } },
      _count: { select: { clubSeasons: true, footballFixtures: true, footballResults: true, footballLadderEntries: true, footballImports: true } },
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: 300,
  })
  res.json({ data: leagues })
})

router.post('/football/leagues', async (req, res) => {
  const b = req.body as { name?: string; state?: string; regionName?: string; sourceUrl?: string; primaryDataSource?: string; fallbackDataSources?: string[]; playhqOrganisationId?: string; playhqCompetitionId?: string; playhqSeasonId?: string; playhqGradeId?: string }
  if (!b.name) return res.status(400).json({ error: 'name required' })
  const source = isFootballSource(b.primaryDataSource) ? b.primaryDataSource : 'MANUAL_ENTRY'
  const fallbacks = Array.isArray(b.fallbackDataSources) ? b.fallbackDataSources.filter(isFootballSource) : ['CSV_UPLOAD', 'OCR_UPLOAD']
  const flags = sourceFlags(source, fallbacks)
  const stateCode = (b.state || 'VIC').toUpperCase()
  const state = await prisma.state.upsert({ where: { code: stateCode }, create: { code: stateCode, name: stateCode }, update: {} })
  const league = await prisma.league.create({
    data: {
      name: b.name,
      shortName: b.name,
      stateId: state.id,
      sport: 'FOOTBALL',
      primaryDataSource: source,
      fallbackDataSources: JSON.stringify(fallbacks),
      sourceUrl: b.sourceUrl ?? null,
      playhqOrganisationId: b.playhqOrganisationId ?? null,
      playhqCompetitionId: b.playhqCompetitionId ?? null,
      playhqSeasonId: b.playhqSeasonId ?? null,
      playhqGradeId: b.playhqGradeId ?? null,
      regionName: b.regionName ?? null,
      syncStatus: 'READY',
      dataConfidence: source === 'MANUAL_ENTRY' ? 0.75 : 0.55,
      primarySource: source,
      importType: 'MANUAL',
      manualOverride: true,
      currentSeason: '2026',
      ...flags,
    },
  })
  if (league.sourceUrl && source === 'PLAYHQ_SCRAPER') {
    const existingSource = await prisma.leagueSource.findFirst({
      where: { leagueId: league.id, sourceType: 'PLAYHQ_SCRAPER', season: league.currentSeason ?? '2026' },
      select: { id: true },
    })
    const sourceData = {
      ladderUrl: league.sourceUrl,
      fixturesUrl: league.sourceUrl,
      resultsUrl: league.sourceUrl,
      isActive: true,
      lastStatus: 'PENDING_REVIEW',
      notes: 'Created from football league source URL; scraping is dispatched via GitHub Actions.',
    }
    if (existingSource) {
      await prisma.leagueSource.update({ where: { id: existingSource.id }, data: sourceData })
    } else {
      await prisma.leagueSource.create({
        data: {
          leagueId: league.id,
          sourceType: 'PLAYHQ_SCRAPER',
          season: league.currentSeason ?? '2026',
          ...sourceData,
        },
      })
    }
  }
  await audit('CREATE_FOOTBALL_LEAGUE', 'League', league.id, league)
  res.status(201).json({ data: league })
})

router.patch('/football/leagues/:id/source', async (req, res) => {
  const before = await prisma.league.findUnique({ where: { id: req.params.id } })
  if (!before) return res.status(404).json({ error: 'not found' })
  const b = req.body as Record<string, unknown>
  const source = isFootballSource(b.primaryDataSource) ? b.primaryDataSource : before.primaryDataSource
  const fallbacks = Array.isArray(b.fallbackDataSources) ? b.fallbackDataSources.filter(isFootballSource) : []
  const flags = sourceFlags(source, fallbacks)
  const updated = await prisma.league.update({
    where: { id: req.params.id },
    data: {
      sport: 'FOOTBALL',
      primaryDataSource: source,
      fallbackDataSources: JSON.stringify(fallbacks),
      sourceUrl: typeof b.sourceUrl === 'string' ? b.sourceUrl : before.sourceUrl,
      playhqOrganisationId: typeof b.playhqOrganisationId === 'string' ? b.playhqOrganisationId : before.playhqOrganisationId,
      playhqCompetitionId: typeof b.playhqCompetitionId === 'string' ? b.playhqCompetitionId : before.playhqCompetitionId,
      playhqSeasonId: typeof b.playhqSeasonId === 'string' ? b.playhqSeasonId : before.playhqSeasonId,
      playhqGradeId: typeof b.playhqGradeId === 'string' ? b.playhqGradeId : before.playhqGradeId,
      syncStatus: 'READY',
      dataSourceSyncError: null,
      syncError: null,
      lastManualUpdateAt: new Date(),
      ...flags,
    },
  })
  await audit('SET_FOOTBALL_DATA_SOURCE', 'League', updated.id, { before, after: updated })
  res.json({ data: updated })
})

router.post('/football/leagues/:id/sync', async (req, res) => {
  const league = await prisma.league.findUnique({ where: { id: req.params.id } })
  if (!league) return res.status(404).json({ error: 'not found' })
  const dryRun = req.body?.dryRun !== false
  const source = isFootballSource(req.body?.sourceType) ? req.body.sourceType : (league.primaryDataSource ?? 'PLAYHQ_SCRAPER')
  const now = new Date()
  if (source === 'PLAYHQ_API' && !league.apiEnabled) return res.status(400).json({ error: 'PLAYHQ_API is not enabled for this league' })
  if (source === 'PLAYHQ_SCRAPER' && !league.scrapeEnabled) return res.status(400).json({ error: 'PLAYHQ_SCRAPER is not enabled for this league' })
  if (source === 'PLAYHQ_SCRAPER' && !league.sourceUrl) return res.status(400).json({ error: 'PLAYHQ_SCRAPER requires a saved sourceUrl before dispatching.' })

  const payload = { leagueId: league.id, source, sourceUrl: league.sourceUrl, dryRun, workflow: WF_URL_IMPORT }
  const payloadHash = stableHash(payload)
  const imp = await prisma.footballDataImport.upsert({
    where: { leagueId_sourceType_dataType_payloadHash: { leagueId: league.id, sourceType: source, dataType: 'ROUNDS', payloadHash } },
    create: { leagueId: league.id, sourceType: source, dataType: 'ROUNDS', sourceUrl: league.sourceUrl, payloadHash, dryRun, status: 'PENDING', recordsFound: 0, confidence: 0.5, payload: JSON.stringify(payload), scrapedAt: now },
    update: { dryRun, status: 'PENDING', payload: JSON.stringify(payload), scrapedAt: now },
  })

  try {
    const out = await dispatchWorkflow(WF_URL_IMPORT, { sync_league_id: league.id, dry_run: String(dryRun) })
    await prisma.league.update({ where: { id: league.id }, data: { lastSyncAt: now, syncStatus: 'RUNNING', dataSourceSyncError: null, syncError: null } })
    await prisma.footballDataImport.update({ where: { id: imp.id }, data: { status: dryRun ? 'PREVIEWED' : 'PENDING', payload: JSON.stringify({ ...payload, workflowRun: out.run ?? null, htmlUrl: out.htmlUrl }) } }).catch(() => {})
    await audit('FOOTBALL_SYNC_DISPATCH', 'FootballDataImport', imp.id, { ...payload, workflowRun: out.run ?? null, htmlUrl: out.htmlUrl }, source)
    return res.status(202).json({ data: { importId: imp.id, dryRun, status: 'DISPATCHED', note: `GitHub Actions workflow dispatched (${WF_URL_IMPORT}) on ref ${githubConfig().ref}.`, workflowFile: WF_URL_IMPORT, workflowRun: out.run, htmlUrl: out.htmlUrl } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'GitHub Actions dispatch failed'
    await prisma.league.update({ where: { id: league.id }, data: { lastSyncAt: now, syncStatus: 'FAILED', dataSourceSyncError: message, syncError: message } }).catch(() => {})
    await prisma.footballDataImport.update({ where: { id: imp.id }, data: { status: 'FAILED', error: message, payload: JSON.stringify({ ...payload, error: message }) } }).catch(() => {})
    return res.status(502).json({ error: message })
  }
})

router.post('/football/leagues/:id/import', async (req, res) => {
  const league = await prisma.league.findUnique({ where: { id: req.params.id } })
  if (!league) return res.status(404).json({ error: 'not found' })
  const source = isFootballSource(req.body?.sourceType) ? req.body.sourceType : 'MANUAL_ENTRY'
  const dataType = isFootballDataType(req.body?.dataType) ? req.body.dataType : null
  const rows = Array.isArray(req.body?.rows) ? req.body.rows as FootballRow[] : []
  const dryRun = !!req.body?.dryRun
  if (!dataType) return res.status(400).json({ error: `dataType must be one of ${FOOTBALL_DATA_TYPES.join(', ')}` })
  if (rows.length === 0) return res.status(400).json({ error: 'rows required' })

  const payloadHash = stableHash({ source, dataType, rows })
  const imp = await prisma.footballDataImport.upsert({
    where: { leagueId_sourceType_dataType_payloadHash: { leagueId: league.id, sourceType: source, dataType, payloadHash } },
    create: { leagueId: league.id, sourceType: source, dataType, sourceUrl: str(req.body?.sourceUrl, league.sourceUrl ?? ''), payloadHash, dryRun, status: dryRun ? 'PREVIEWED' : 'COMMITTED', recordsFound: rows.length, confidence: source === 'MANUAL_ENTRY' ? 0.9 : 0.65, payload: JSON.stringify(rows), scrapedAt: source === 'PLAYHQ_SCRAPER' ? new Date() : null },
    update: { dryRun, status: dryRun ? 'PREVIEWED' : 'COMMITTED', recordsFound: rows.length, payload: JSON.stringify(rows) },
  })
  if (dryRun) return res.json({ data: { importId: imp.id, status: imp.status, recordsFound: rows.length, recordsImported: 0 } })

  let imported = 0
  if (dataType === 'FIXTURES') {
    for (const r of rows) {
      await prisma.footballFixture.upsert({
        where: { leagueId_season_grade_round_homeName_awayName: { leagueId: league.id, season: str(r.season, '2026'), grade: str(r.grade, 'Senior Football'), round: str(r.round, 'Round TBC'), homeName: str(r.homeName ?? r.home), awayName: str(r.awayName ?? r.away) } },
        create: { leagueId: league.id, season: str(r.season, '2026'), grade: str(r.grade, 'Senior Football'), round: str(r.round, 'Round TBC'), homeName: str(r.homeName ?? r.home), awayName: str(r.awayName ?? r.away), matchDate: r.matchDate ? new Date(String(r.matchDate)) : null, venue: str(r.venue, ''), sourceType: source, sourceUrl: str(req.body?.sourceUrl, league.sourceUrl ?? ''), verified: source === 'MANUAL_ENTRY' },
        update: { matchDate: r.matchDate ? new Date(String(r.matchDate)) : null, venue: str(r.venue, ''), sourceType: source, verified: source === 'MANUAL_ENTRY' },
      }); imported++
    }
  } else if (dataType === 'RESULTS') {
    for (const r of rows) {
      const homeGoals = num(r.homeGoals), homeBehinds = num(r.homeBehinds), awayGoals = num(r.awayGoals), awayBehinds = num(r.awayBehinds)
      await prisma.footballResult.upsert({
        where: { leagueId_season_grade_round_homeName_awayName: { leagueId: league.id, season: str(r.season, '2026'), grade: str(r.grade, 'Senior Football'), round: str(r.round, 'Round TBC'), homeName: str(r.homeName ?? r.home), awayName: str(r.awayName ?? r.away) } },
        create: { leagueId: league.id, season: str(r.season, '2026'), grade: str(r.grade, 'Senior Football'), round: str(r.round, 'Round TBC'), homeName: str(r.homeName ?? r.home), awayName: str(r.awayName ?? r.away), homeGoals, homeBehinds, homePoints: footballPoints(homeGoals, homeBehinds, r.homePoints), awayGoals, awayBehinds, awayPoints: footballPoints(awayGoals, awayBehinds, r.awayPoints), matchDate: r.matchDate ? new Date(String(r.matchDate)) : null, venue: str(r.venue, ''), sourceType: source, sourceUrl: str(req.body?.sourceUrl, league.sourceUrl ?? ''), verified: source === 'MANUAL_ENTRY', published: false },
        update: { homeGoals, homeBehinds, homePoints: footballPoints(homeGoals, homeBehinds, r.homePoints), awayGoals, awayBehinds, awayPoints: footballPoints(awayGoals, awayBehinds, r.awayPoints), sourceType: source, verified: source === 'MANUAL_ENTRY' },
      }); imported++
    }
  } else if (dataType === 'LADDER') {
    for (const r of rows) {
      await prisma.footballLadderEntry.upsert({
        where: { leagueId_season_grade_clubName: { leagueId: league.id, season: str(r.season, '2026'), grade: str(r.grade, 'Senior Football'), clubName: str(r.clubName ?? r.club) } },
        create: { leagueId: league.id, season: str(r.season, '2026'), grade: str(r.grade, 'Senior Football'), clubName: str(r.clubName ?? r.club), position: num(r.position, imported + 1), played: num(r.played), wins: num(r.wins), losses: num(r.losses), draws: num(r.draws), pointsFor: num(r.pointsFor), pointsAgainst: num(r.pointsAgainst), percentage: num(r.percentage), premiershipPoints: num(r.premiershipPoints ?? r.points), sourceType: source, verified: source === 'MANUAL_ENTRY', published: false },
        update: { position: num(r.position, imported + 1), played: num(r.played), wins: num(r.wins), losses: num(r.losses), draws: num(r.draws), pointsFor: num(r.pointsFor), pointsAgainst: num(r.pointsAgainst), percentage: num(r.percentage), premiershipPoints: num(r.premiershipPoints ?? r.points), sourceType: source, verified: source === 'MANUAL_ENTRY' },
      }); imported++
    }
  }
  await prisma.footballDataImport.update({ where: { id: imp.id }, data: { recordsImported: imported } })
  await prisma.league.update({ where: { id: league.id }, data: { lastSuccessfulSyncAt: new Date(), syncStatus: 'SUCCESS', dataSourceSyncError: null, syncError: null, dataConfidence: source === 'MANUAL_ENTRY' ? 0.9 : 0.65 } })
  await audit('FOOTBALL_IMPORT_COMMIT', 'FootballDataImport', imp.id, { dataType, source, imported }, source)
  res.json({ data: { importId: imp.id, status: 'COMMITTED', recordsFound: rows.length, recordsImported: imported } })
})

router.post('/football/leagues/:id/generate-ladder', async (req, res) => {
  const league = await prisma.league.findUnique({ where: { id: req.params.id } })
  if (!league) return res.status(404).json({ error: 'not found' })
  const season = str(req.body?.season, '2026')
  const grade = str(req.body?.grade, 'Senior Football')
  const results = await prisma.footballResult.findMany({ where: { leagueId: league.id, season, grade } })
  if (results.length === 0) return res.status(400).json({ error: 'No football results available to generate a ladder' })
  const ladder = generateFootballLadder(results)
  if (req.body?.dryRun) return res.json({ data: { season, grade, ladder } })
  for (const r of ladder) {
    await prisma.footballLadderEntry.upsert({
      where: { leagueId_season_grade_clubName: { leagueId: league.id, season, grade, clubName: r.clubName } },
      create: { leagueId: league.id, season, grade, clubName: r.clubName, position: r.position, played: r.played, wins: r.wins, losses: r.losses, draws: r.draws, pointsFor: r.pointsFor, pointsAgainst: r.pointsAgainst, percentage: r.percentage, premiershipPoints: r.premiershipPoints, sourceType: 'MANUAL_ENTRY', verified: true },
      update: { position: r.position, played: r.played, wins: r.wins, losses: r.losses, draws: r.draws, pointsFor: r.pointsFor, pointsAgainst: r.pointsAgainst, percentage: r.percentage, premiershipPoints: r.premiershipPoints, sourceType: 'MANUAL_ENTRY', verified: true },
    })
  }
  await audit('FOOTBALL_GENERATE_LADDER', 'League', league.id, { season, grade, rows: ladder.length })
  res.json({ data: { season, grade, rows: ladder.length, ladder } })
})

router.get('/football/leagues/:id/compare-ladder', async (req, res) => {
  const season = str(req.query.season, '2026')
  const grade = str(req.query.grade, 'Senior Football')
  const [results, stored] = await Promise.all([
    prisma.footballResult.findMany({ where: { leagueId: req.params.id, season, grade } }),
    prisma.footballLadderEntry.findMany({ where: { leagueId: req.params.id, season, grade }, orderBy: { position: 'asc' } }),
  ])
  const generated = generateFootballLadder(results)
  const diffs = generated.map(g => {
    const s = stored.find(x => x.clubName.toLowerCase() === g.clubName.toLowerCase())
    return { clubName: g.clubName, generatedPosition: g.position, storedPosition: s?.position ?? null, generatedPoints: g.premiershipPoints, storedPoints: s?.premiershipPoints ?? null, differs: !s || s.position !== g.position || s.premiershipPoints !== g.premiershipPoints }
  })
  res.json({ data: { season, grade, generatedRows: generated.length, storedRows: stored.length, diffs, conflictCount: diffs.filter(d => d.differs).length } })
})

router.post('/football/leagues/:id/publish', async (req, res) => {
  const season = str(req.body?.season, '2026')
  const grade = str(req.body?.grade, 'Senior Football')
  const [results, ladder] = await Promise.all([
    prisma.footballResult.updateMany({ where: { leagueId: req.params.id, season, grade }, data: { published: true } }),
    prisma.footballLadderEntry.updateMany({ where: { leagueId: req.params.id, season, grade }, data: { published: true } }),
  ])
  await prisma.footballDataImport.updateMany({ where: { leagueId: req.params.id, dataType: { in: ['RESULTS', 'LADDER'] }, status: 'COMMITTED' }, data: { status: 'PUBLISHED', publishedAt: new Date() } })
  const recalc = req.body?.recalculate === true ? await recalculateNational().catch(e => ({ error: e instanceof Error ? e.message : 'recalc failed' })) : null
  await audit('FOOTBALL_PUBLISH_APPROVED', 'League', req.params.id, { season, grade, results: results.count, ladder: ladder.count, recalc })
  res.json({ data: { season, grade, publishedResults: results.count, publishedLadderRows: ladder.count, recalc } })
})

// ═════════════════════════════════════════════════════════════════════════════
// Admin V3 — TRUE URL ingestion. Operators paste URLs; the backend fetches,
// parses, imports (with provenance, dedupe, conflict → review), auto-creates
// clubs, and regenerates the ladder from results. Additive; nothing overwrites
// verified manual data.
// ═════════════════════════════════════════════════════════════════════════════

const slugifyFb = (s: string) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'club'

/** Idempotently resolve/create a football club + its league-season membership. */
async function ensureFootballClub(name: string, league: { id: string; stateId: string }, season: string, grade: string): Promise<{ clubId: string; created: boolean } | null> {
  const trimmed = clean(name)
  if (!trimmed) return null
  let club = await prisma.club.findFirst({ where: { name: { equals: trimmed, mode: 'insensitive' }, sport: 'FOOTBALL', archivedAt: null }, select: { id: true } }).catch(() => null)
  let created = false
  if (!club) {
    let slug = slugifyFb(trimmed); let i = 1
    while (await prisma.club.findUnique({ where: { slug }, select: { id: true } }).catch(() => null)) { slug = `${slugifyFb(trimmed)}-afl${i > 1 ? i : ''}`; i++; if (i > 60) break }
    club = await prisma.club.create({ data: { name: trimmed, slug, stateId: league.stateId, sport: 'FOOTBALL', source: 'PLAYFOOTY_URL_IMPORT', isActive: true, approvalStatus: 'APPROVED' }, select: { id: true } })
    created = true
  }
  await prisma.clubLeagueSeason.upsert({
    where: { clubId_leagueId_season_grade: { clubId: club.id, leagueId: league.id, season, grade } },
    create: { clubId: club.id, leagueId: league.id, season, grade, sport: 'FOOTBALL', isActive: true },
    update: { sport: 'FOOTBALL', isActive: true },
  }).catch(() => {})
  return { clubId: club.id, created }
}
const clean = (s: string) => (s || '').replace(/\s+/g, ' ').trim()

interface RoundReport { round: string; resultsFound: number; resultsImported: number; fixturesFound: number; fixturesImported: number; clubsCreated: number; conflicts: number; reviews: number; ladderRows: number; strategies: string[]; warnings: string[] }

/** Core per-round URL import used by both import-url and import-season. */
async function importRoundFromUrls(
  league: { id: string; stateId: string; sourceUrl: string | null },
  opts: { round: string; season: string; grade: string; resultsUrl?: string; fixtureUrl?: string; source: string; importedBy: string; dryRun: boolean },
): Promise<RoundReport> {
  const rep: RoundReport = { round: opts.round, resultsFound: 0, resultsImported: 0, fixturesFound: 0, fixturesImported: 0, clubsCreated: 0, conflicts: 0, reviews: 0, ladderRows: 0, strategies: [], warnings: [] }
  const verified = opts.source === 'MANUAL_ENTRY'

  // ── Results ──
  if (opts.resultsUrl) {
    const page = await fetchPage(opts.resultsUrl)
    const parsed = parseResults(page)
    rep.resultsFound = parsed.rows.length; rep.strategies.push(`results:${parsed.strategy}`); rep.warnings.push(...parsed.warnings)
    const payloadHash = stableHash({ url: opts.resultsUrl, rows: parsed.rows })
    await prisma.footballDataImport.upsert({
      where: { leagueId_sourceType_dataType_payloadHash: { leagueId: league.id, sourceType: opts.source, dataType: 'RESULTS', payloadHash } },
      create: { leagueId: league.id, sourceType: opts.source, dataType: 'RESULTS', sourceUrl: opts.resultsUrl, payloadHash, dryRun: opts.dryRun, status: opts.dryRun ? 'PREVIEWED' : 'COMMITTED', recordsFound: parsed.rows.length, confidence: parsed.confidence, payload: JSON.stringify({ round: opts.round, season: opts.season, grade: opts.grade, importedBy: opts.importedBy, strategy: parsed.strategy, rows: parsed.rows }), scrapedAt: new Date() },
      update: { dryRun: opts.dryRun, status: opts.dryRun ? 'PREVIEWED' : 'COMMITTED', recordsFound: parsed.rows.length, confidence: parsed.confidence, payload: JSON.stringify({ round: opts.round, importedBy: opts.importedBy, strategy: parsed.strategy, rows: parsed.rows }) },
    })
    if (parsed.rows.length === 0) { await createFootballReview(league.id, 'FOOTBALL_URL_NO_DATA', `Results URL returned no parseable rows for ${opts.round}: ${opts.resultsUrl}`, { url: opts.resultsUrl, warnings: parsed.warnings }, 0.2); rep.reviews++ }
    if (!opts.dryRun) {
      for (const r of parsed.rows as ResultRow[]) {
        const home = await ensureFootballClub(r.homeName, league, opts.season, opts.grade)
        const away = await ensureFootballClub(r.awayName, league, opts.season, opts.grade)
        if (home?.created) rep.clubsCreated++; if (away?.created) rep.clubsCreated++
        const round = str(r.round, opts.round)
        const homePoints = footballPoints(r.homeGoals, r.homeBehinds, r.homePoints)
        const awayPoints = footballPoints(r.awayGoals, r.awayBehinds, r.awayPoints)
        const key = { leagueId: league.id, season: opts.season, grade: opts.grade, round, homeName: str(r.homeName), awayName: str(r.awayName) }
        const existing = await prisma.footballResult.findUnique({ where: { leagueId_season_grade_round_homeName_awayName: key } }).catch(() => null)
        if (existing && existing.verified && (existing.homePoints !== homePoints || existing.awayPoints !== awayPoints)) {
          await createFootballReview(league.id, 'FOOTBALL_RESULT_CONFLICT', `URL result for ${key.homeName} v ${key.awayName} (${round}) conflicts with verified data`, { url: opts.resultsUrl, incoming: { homePoints, awayPoints }, existing: { homePoints: existing.homePoints, awayPoints: existing.awayPoints } }, 0.5)
          rep.conflicts++; rep.reviews++; continue
        }
        await prisma.footballResult.upsert({
          where: { leagueId_season_grade_round_homeName_awayName: key },
          create: { ...key, homeGoals: num(r.homeGoals), homeBehinds: num(r.homeBehinds), homePoints, awayGoals: num(r.awayGoals), awayBehinds: num(r.awayBehinds), awayPoints, matchDate: r.matchDate ? new Date(r.matchDate) : null, venue: str(r.venue), sourceType: opts.source, sourceUrl: opts.resultsUrl, verified, published: false },
          update: { homeGoals: num(r.homeGoals), homeBehinds: num(r.homeBehinds), homePoints, awayGoals: num(r.awayGoals), awayBehinds: num(r.awayBehinds), awayPoints, sourceType: opts.source, verified },
        })
        rep.resultsImported++
      }
    }
  }

  // ── Fixtures (future rounds: venue/date/time/home-away) ──
  const fixtureUrl = opts.fixtureUrl ?? (opts.resultsUrl && /\/R\d+(?:$|[?#])/i.test(opts.resultsUrl) ? opts.resultsUrl : undefined)
  if (fixtureUrl) {
    const page = await fetchPage(fixtureUrl)
    const parsed = parseFixtures(page)
    rep.fixturesFound = parsed.rows.length; rep.strategies.push(`fixtures:${parsed.strategy}`); rep.warnings.push(...parsed.warnings)
    const payloadHash = stableHash({ url: fixtureUrl, rows: parsed.rows })
    await prisma.footballDataImport.upsert({
      where: { leagueId_sourceType_dataType_payloadHash: { leagueId: league.id, sourceType: opts.source, dataType: 'FIXTURES', payloadHash } },
      create: { leagueId: league.id, sourceType: opts.source, dataType: 'FIXTURES', sourceUrl: fixtureUrl, payloadHash, dryRun: opts.dryRun, status: opts.dryRun ? 'PREVIEWED' : 'COMMITTED', recordsFound: parsed.rows.length, confidence: parsed.confidence, payload: JSON.stringify({ round: opts.round, importedBy: opts.importedBy, rows: parsed.rows }), scrapedAt: new Date() },
      update: { dryRun: opts.dryRun, status: opts.dryRun ? 'PREVIEWED' : 'COMMITTED', recordsFound: parsed.rows.length, confidence: parsed.confidence, payload: JSON.stringify({ round: opts.round, rows: parsed.rows }) },
    })
    if (parsed.rows.length === 0 && !(fixtureUrl === opts.resultsUrl && rep.resultsFound > 0)) { await createFootballReview(league.id, 'FOOTBALL_URL_NO_DATA', `Fixture URL returned no parseable rows for ${opts.round}: ${fixtureUrl}`, { url: fixtureUrl, warnings: parsed.warnings }, 0.2); rep.reviews++ }
    if (!opts.dryRun) {
      for (const r of parsed.rows as FixtureRow[]) {
        const home = await ensureFootballClub(r.homeName, league, opts.season, opts.grade)
        const away = await ensureFootballClub(r.awayName, league, opts.season, opts.grade)
        if (home?.created) rep.clubsCreated++; if (away?.created) rep.clubsCreated++
        const round = str(r.round, opts.round)
        const key = { leagueId: league.id, season: opts.season, grade: opts.grade, round, homeName: str(r.homeName), awayName: str(r.awayName) }
        await prisma.footballFixture.upsert({
          where: { leagueId_season_grade_round_homeName_awayName: key },
          create: { ...key, matchDate: r.matchDate ? new Date(r.matchDate) : null, venue: str(r.venue), sourceType: opts.source, sourceUrl: fixtureUrl, verified },
          update: { matchDate: r.matchDate ? new Date(r.matchDate) : null, venue: str(r.venue), sourceType: opts.source, verified },
        })
        rep.fixturesImported++
      }
    }
  }
  return rep
}

/** After results change, rebuild the generated ladder from all season results. */
async function regenerateLadder(leagueId: string, season: string, grade: string): Promise<number> {
  const results = await prisma.footballResult.findMany({ where: { leagueId, season, grade } })
  if (results.length === 0) return 0
  const ladder = generateFootballLadder(results)
  for (const r of ladder) {
    await prisma.footballLadderEntry.upsert({
      where: { leagueId_season_grade_clubName: { leagueId, season, grade, clubName: r.clubName } },
      create: { leagueId, season, grade, clubName: r.clubName, position: r.position, played: r.played, wins: r.wins, losses: r.losses, draws: r.draws, pointsFor: r.pointsFor, pointsAgainst: r.pointsAgainst, percentage: r.percentage, premiershipPoints: r.premiershipPoints, sourceType: 'MANUAL_ENTRY', verified: true },
      update: { position: r.position, played: r.played, wins: r.wins, losses: r.losses, draws: r.draws, pointsFor: r.pointsFor, pointsAgainst: r.pointsAgainst, percentage: r.percentage, premiershipPoints: r.premiershipPoints },
    })
  }
  return ladder.length
}

// POST /football/leagues/:id/import-url — one round from pasted URLs
router.post('/football/leagues/:id/import-url', async (req, res) => {
  const league = await prisma.league.findUnique({ where: { id: req.params.id }, select: { id: true, stateId: true, sourceUrl: true } })
  if (!league) return res.status(404).json({ error: 'not found' })
  const b = req.body as Record<string, unknown>
  const season = str(b.season, '2026'), grade = str(b.grade, 'Senior Football'), round = str(b.round, 'Round TBC')
  const source = isFootballSource(b.source) ? b.source : 'PLAYHQ_SCRAPER'
  const dryRun = b.dryRun === true
  if (!b.resultsUrl && !b.fixtureUrl) return res.status(400).json({ error: 'resultsUrl or fixtureUrl required' })
  const rep = await importRoundFromUrls(league, { round, season, grade, resultsUrl: str(b.resultsUrl) || undefined, fixtureUrl: str(b.fixtureUrl) || undefined, source, importedBy: str(b.importedBy, 'admin'), dryRun })
  let ladderRows = 0
  if (!dryRun && b.generateLadder !== false && rep.resultsImported > 0) ladderRows = await regenerateLadder(league.id, season, grade)
  rep.ladderRows = ladderRows
  await prisma.league.update({ where: { id: league.id }, data: { lastSyncAt: new Date(), lastSuccessfulSyncAt: rep.resultsImported || rep.fixturesImported ? new Date() : undefined, syncStatus: rep.reviews > rep.resultsImported + rep.fixturesImported ? 'NEEDS_REVIEW' : 'SUCCESS' } }).catch(() => {})
  await audit('FOOTBALL_IMPORT_URL', 'League', league.id, rep, source)
  res.json({ data: rep })
})

// POST /football/leagues/:id/import-season — many rounds at once
router.post('/football/leagues/:id/import-season', async (req, res) => {
  const league = await prisma.league.findUnique({ where: { id: req.params.id }, select: { id: true, stateId: true, sourceUrl: true } })
  if (!league) return res.status(404).json({ error: 'not found' })
  const b = req.body as Record<string, unknown>
  const season = str(b.season, '2026'), grade = str(b.grade, 'Senior Football')
  const source = isFootballSource(b.source) ? b.source : 'PLAYHQ_SCRAPER'
  const dryRun = b.dryRun === true
  const rounds = Array.isArray(b.rounds) ? b.rounds as Record<string, unknown>[] : []
  if (rounds.length === 0) return res.status(400).json({ error: 'rounds[] required' })
  const reports: RoundReport[] = []
  for (const r of rounds) {
    if (!str(r.resultsUrl) && !str(r.fixtureUrl)) continue
    reports.push(await importRoundFromUrls(league, { round: str(r.round, 'Round TBC'), season, grade, resultsUrl: str(r.resultsUrl) || undefined, fixtureUrl: str(r.fixtureUrl) || undefined, source, importedBy: str(b.importedBy, 'admin'), dryRun }))
  }
  const totalResults = reports.reduce((n, r) => n + r.resultsImported, 0)
  const ladderRows = !dryRun && totalResults > 0 && b.generateLadder !== false ? await regenerateLadder(league.id, season, grade) : 0
  const totals = { rounds: reports.length, resultsImported: totalResults, fixturesImported: reports.reduce((n, r) => n + r.fixturesImported, 0), clubsCreated: reports.reduce((n, r) => n + r.clubsCreated, 0), conflicts: reports.reduce((n, r) => n + r.conflicts, 0), reviews: reports.reduce((n, r) => n + r.reviews, 0), ladderRows }
  await prisma.league.update({ where: { id: league.id }, data: { lastSyncAt: new Date(), lastSuccessfulSyncAt: totalResults ? new Date() : undefined, syncStatus: totals.reviews > totalResults ? 'NEEDS_REVIEW' : 'SUCCESS' } }).catch(() => {})
  await audit('FOOTBALL_IMPORT_SEASON', 'League', league.id, totals, source)
  res.json({ data: { season, grade, totals, rounds: reports } })
})

// POST /football/leagues/:id/import-ladder-url — fetch + compare imported vs generated
router.post('/football/leagues/:id/import-ladder-url', async (req, res) => {
  const league = await prisma.league.findUnique({ where: { id: req.params.id }, select: { id: true, stateId: true } })
  if (!league) return res.status(404).json({ error: 'not found' })
  const b = req.body as Record<string, unknown>
  const season = str(b.season, '2026'), grade = str(b.grade, 'Senior Football')
  const url = str(b.ladderUrl)
  if (!url) return res.status(400).json({ error: 'ladderUrl required' })
  const page = await fetchPage(url)
  const parsed = parseLadder(page)
  await prisma.footballDataImport.upsert({
    where: { leagueId_sourceType_dataType_payloadHash: { leagueId: league.id, sourceType: 'PLAYHQ_SCRAPER', dataType: 'LADDER', payloadHash: stableHash({ url, rows: parsed.rows }) } },
    create: { leagueId: league.id, sourceType: 'PLAYHQ_SCRAPER', dataType: 'LADDER', sourceUrl: url, payloadHash: stableHash({ url, rows: parsed.rows }), dryRun: true, status: 'PREVIEWED', recordsFound: parsed.rows.length, confidence: parsed.confidence, payload: JSON.stringify({ importedBy: str(b.importedBy, 'admin'), rows: parsed.rows }), scrapedAt: new Date() },
    update: { recordsFound: parsed.rows.length, confidence: parsed.confidence, payload: JSON.stringify({ rows: parsed.rows }) },
  })
  if (parsed.rows.length === 0) await createFootballReview(league.id, 'FOOTBALL_URL_NO_DATA', `Ladder URL returned no parseable rows: ${url}`, { url, warnings: parsed.warnings }, 0.2)
  const results = await prisma.footballResult.findMany({ where: { leagueId: league.id, season, grade } })
  const generated = generateFootballLadder(results)
  const diffs = generated.map(g => {
    const imp = parsed.rows.find(x => x.clubName.toLowerCase() === g.clubName.toLowerCase())
    return { clubName: g.clubName, generatedPosition: g.position, importedPosition: imp?.position ?? null, generatedPoints: g.premiershipPoints, importedPoints: imp?.points ?? null, differs: !imp || (imp.position != null && imp.position !== g.position) }
  })
  await audit('FOOTBALL_IMPORT_LADDER_URL', 'League', league.id, { url, imported: parsed.rows.length, conflictCount: diffs.filter(d => d.differs).length })
  res.json({ data: { season, grade, importedRows: parsed.rows.length, generatedRows: generated.length, conflictCount: diffs.filter(d => d.differs).length, strategy: parsed.strategy, warnings: parsed.warnings, diffs } })
})

export { router as adminPlatformRouter }
