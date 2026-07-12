/**
 * Football URL ingestion + parser (Admin V3).
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-side fetch + parse so operators paste URLs instead of rows. Dependency
 * free: given a page it tries, in order, (1) JSON body, (2) Next.js
 * `__NEXT_DATA__` embedded JSON, (3) Australian-football score text/tables in
 * the HTML. Returns normalised rows + a confidence + warnings; when nothing
 * structured can be extracted it returns an empty set with a clear warning so
 * the caller can route the import to review (never fabricated).
 *
 * AFL score notation is goals.behinds (total) — e.g. "12.8 (80)" = 12*6+8.
 */

import { logger } from '../utils/logger.js'

export interface ResultRow { homeName: string; awayName: string; homeGoals?: number; homeBehinds?: number; homePoints?: number; awayGoals?: number; awayBehinds?: number; awayPoints?: number; round?: string; matchDate?: string; time?: string; venue?: string; status?: string; sourceUrl?: string }
export interface FixtureRow { homeName: string; awayName: string; round?: string; matchDate?: string; time?: string; venue?: string; status?: string; sourceUrl?: string }
export interface LadderRow { clubName: string; position?: number; played?: number; wins?: number; losses?: number; draws?: number; byes?: number; pointsFor?: number; pointsAgainst?: number; percentage?: number; points?: number; forfeits?: number; disqualified?: number; adjustedPoints?: number }
export interface GoalKickerRow { playerName: string; clubName: string; leagueName?: string; season?: string; grade?: string; goals: number; matches?: number; sourceUrl?: string }
export interface ParseOutcome<T> { rows: T[]; confidence: number; strategy: string; warnings: string[] }

export interface FetchedPage { url: string; ok: boolean; status: number; contentType: string; body: string; error?: string; diagnostics?: Record<string, unknown> }

/** Fetch a page's text. Never throws — returns ok:false with a reason. */
export async function fetchPage(url: string, timeoutMs = 15000): Promise<FetchedPage> {
  if (shouldRenderPlayHq(url)) {
    const rendered = await fetchRenderedPlayHqPage(url, timeoutMs).catch(e => {
      logger.warn('PlayHQ rendered fetch failed, falling back to plain fetch', { url, detail: String(e) })
      return null
    })
    if (rendered?.ok && rendered.body) return rendered
  }
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': 'PlayFooty/1.0 (+https://playfooty.com.au)', 'Accept': 'text/html,application/json,application/xhtml+xml' },
    })
    const contentType = res.headers.get('content-type') ?? ''
    const body = await res.text()
    return { url, ok: res.ok, status: res.status, contentType, body, error: res.ok ? undefined : `HTTP ${res.status}` }
  } catch (e) {
    logger.warn('fetchPage failed', { url, detail: String(e) })
    return { url, ok: false, status: 0, contentType: '', body: '', error: String(e) }
  }
}

function isPlayHqUrl(url: string): boolean {
  return /\/\/(?:www\.)?playhq\.com\//i.test(url)
}

function shouldRenderPlayHq(url: string): boolean {
  return isPlayHqUrl(url) && process.env.PLAYFOOTY_RENDER_PLAYHQ === '1'
}

export async function fetchPlayHqStatisticsPage(url: string, timeoutMs = 30000): Promise<FetchedPage> {
  const page = await fetchPage(url, timeoutMs)
  if (page.ok || !isPlayHqUrl(url) || page.status !== 403) return {
    ...page,
    diagnostics: {
      ...(page.diagnostics ?? {}),
      attemptedRenderedFetch: false,
      renderedFetchSucceeded: false,
      plainFetchStatus: page.status,
    },
  }

  logger.warn('PlayHQ statistics fetch returned 403; forcing rendered browser retry', { url })
  try {
    const rendered = await fetchRenderedPlayHqPage(url, timeoutMs, { waitForNetworkIdle: true })
    return {
      ...rendered,
      diagnostics: {
        ...(rendered.diagnostics ?? {}),
        attemptedRenderedFetch: true,
        renderedFetchSucceeded: Boolean(rendered.ok && rendered.body),
        plainFetchStatus: page.status,
        fetchStrategy: 'playwright-render',
      },
    }
  } catch (e) {
    const renderedFetchError = e instanceof Error ? `${e.name}: ${e.message}${e.stack ? `\n${e.stack}` : ''}` : String(e)
    logger.warn('PlayHQ statistics rendered fetch failed after 403', { url, detail: renderedFetchError })
    return {
      ...page,
      diagnostics: {
        ...(page.diagnostics ?? {}),
        attemptedRenderedFetch: true,
        renderedFetchSucceeded: false,
        renderedFetchError,
        plainFetchStatus: page.status,
        fetchStrategy: 'plain-fetch-403-render-failed',
      },
    }
  }
}

type RenderDiagnostics = {
  finalUrl?: string
  title?: string
  authWall?: boolean
  appShellLoaded?: boolean
  ladderTabSelected?: boolean
  advancedToggleExists?: boolean
  advancedToggleClicked?: boolean
  tableCount?: number
  rowCount?: number
  textSample?: string
  domRows?: string[][]
  capturedJsonCount?: number
  capturedResponses?: Array<Record<string, unknown>>
  screenshotPath?: string
  htmlPath?: string
}

const usefulResponse = (url: string) => !/rubicon|posthog|split\.io|doubleclick|googlesyndication|adnxs|analytics/i.test(url)
const topKeys = (value: unknown): string[] => value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value as Record<string, unknown>).slice(0, 16) : []
const bodyShape = (value: unknown): Record<string, unknown> => {
  if (Array.isArray(value)) return { type: 'array', length: value.length, firstKeys: topKeys(value[0]) }
  if (value && typeof value === 'object') return { type: 'object', keys: topKeys(value) }
  return { type: typeof value }
}

async function collectRenderedDiagnostics(page: import('playwright').Page): Promise<RenderDiagnostics> {
  return page.evaluate(() => {
    const doc = (globalThis as any).document
    const text = String(doc?.body?.innerText ?? '').replace(/\s+/g, ' ').trim()
    const rows = Array.from(doc?.querySelectorAll?.('table tr, [role="row"]') ?? []).map((el: any) => String(el.innerText ?? '').split('\n').map((x: string) => x.trim()).filter(Boolean)).filter((r: string[]) => r.length >= 2).slice(0, 200)
    const tableCount = Number(doc?.querySelectorAll?.('table, [role="table"], [role="grid"]')?.length ?? 0)
    const advancedToggleExists = /show advanced ladder/i.test(text) || Array.from(doc?.querySelectorAll?.('button,label,[role="button"]') ?? []).some((el: any) => /show advanced ladder/i.test(String(el.innerText ?? el.textContent ?? '')))
    const selected = Array.from(doc?.querySelectorAll?.('[aria-selected="true"], [aria-current="page"], a, button') ?? []).map((el: any) => String(el.innerText ?? el.textContent ?? '').trim()).find((label: string) => /ladder/i.test(label))
    return {
      finalUrl: String((globalThis as any).location?.href ?? ''),
      title: String(doc?.title ?? ''),
      authWall: /\b(log in|login|sign in|unauthori[sz]ed|access denied|authentication required)\b/i.test(text),
      appShellLoaded: Boolean(doc?.querySelector?.('#__next, [data-testid], main')) || /PlayHQ/i.test(text),
      ladderTabSelected: Boolean(selected),
      advancedToggleExists,
      tableCount,
      rowCount: rows.length,
      textSample: text.slice(0, 1200),
      domRows: rows,
    }
  }).catch(e => ({ textSample: `diagnostic evaluate failed: ${String(e)}` }))
}

async function writePlayHqArtifacts(page: import('playwright').Page, url: string, html: string): Promise<Pick<RenderDiagnostics, 'screenshotPath' | 'htmlPath'>> {
  if (process.env.GITHUB_ACTIONS !== 'true' && process.env.PLAYFOOTY_DEBUG_ARTIFACTS !== '1') return {}
  const { mkdir, writeFile } = await import('node:fs/promises')
  const safe = url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 120)
  const dir = process.env.PLAYFOOTY_ARTIFACT_DIR || 'artifacts/playhq'
  await mkdir(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const htmlPath = `${dir}/${stamp}-${safe}.html`
  const screenshotPath = `${dir}/${stamp}-${safe}.png`
  await writeFile(htmlPath, html, 'utf8')
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined)
  return { htmlPath, screenshotPath }
}

async function fetchRenderedPlayHqPage(url: string, timeoutMs: number, opts: { waitForNetworkIdle?: boolean } = {}): Promise<FetchedPage> {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'] })
  const capturedJson: unknown[] = []
  const capturedResponses: Array<Record<string, unknown>> = []
  try {
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-AU',
      extraHTTPHeaders: {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'accept-language': 'en-AU,en;q=0.9',
      },
    })
    const page = await ctx.newPage()
    page.on('response', async response => {
      const responseUrl = response.url()
      if (!usefulResponse(responseUrl)) return
      const ct = response.headers()['content-type'] ?? ''
      if (!ct.includes('json')) return
      try {
        const json = await response.json()
        capturedJson.push(json)
        capturedResponses.push({ url: responseUrl, status: response.status(), contentType: ct, shape: bodyShape(json) })
      } catch {
        capturedResponses.push({ url: responseUrl, status: response.status(), contentType: ct, shape: { type: 'unreadable-json' } })
      }
    })
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
    if (opts.waitForNetworkIdle) await page.waitForLoadState('networkidle', { timeout: Math.min(timeoutMs, 15000) }).catch(() => undefined)
    let advancedToggleClicked = false
    if (/\/ladder(?:$|[?#])/i.test(url)) advancedToggleClicked = await enableAdvancedLadder(page)
    await page.waitForTimeout(3500)
    const html = await page.content()
    const diagnostics: RenderDiagnostics = {
      ...(await collectRenderedDiagnostics(page)),
      advancedToggleClicked,
      capturedJsonCount: capturedJson.length,
      capturedResponses: capturedResponses.slice(0, 40),
      ...(await writePlayHqArtifacts(page, url, html)),
    }
    logger.info('PlayHQ rendered page loaded', { url, ...diagnostics, textSample: diagnostics.textSample?.slice(0, 240) })
    console.log(`[playhq-render] url=${url}`)
    console.log(`[playhq-render] final page URL=${diagnostics.finalUrl || '(unknown)'}`)
    console.log(`[playhq-render] page title=${diagnostics.title || '(empty)'}`)
    console.log(`[playhq-render] auth wall appears=${diagnostics.authWall ? 'yes' : 'no'}`)
    console.log(`[playhq-render] app shell loaded=${diagnostics.appShellLoaded ? 'yes' : 'no'}`)
    console.log(`[playhq-render] ladder tab selected=${diagnostics.ladderTabSelected ? 'yes' : 'no'}`)
    console.log(`[playhq-render] advanced ladder toggle exists=${diagnostics.advancedToggleExists ? 'yes' : 'no'}`)
    console.log(`[playhq-render] advanced ladder toggle clicked=${diagnostics.advancedToggleClicked ? 'yes' : 'no'}`)
    console.log(`[playhq-render] tables found=${diagnostics.tableCount ?? 0}`)
    console.log(`[playhq-render] rows found=${diagnostics.rowCount ?? 0}`)
    console.log(`[playhq-render] text sample=${diagnostics.textSample || '(empty)'}`)
    console.log(`[playhq-render] captured network response URLs=${capturedResponses.map(r => `${r.status} ${r.url}`).join(' | ') || 'none'}`)
    console.log(`[playhq-render] captured JSON response status codes=${capturedResponses.map(r => r.status).join(',') || 'none'}`)
    console.log(`[playhq-render] sample JSON body shapes=${JSON.stringify(capturedResponses.slice(0, 8).map(r => r.shape))}`)
    if (diagnostics.screenshotPath) console.log(`[playhq-render] screenshot artifact=${diagnostics.screenshotPath}`)
    if (diagnostics.htmlPath) console.log(`[playhq-render] HTML artifact=${diagnostics.htmlPath}`)
    return { url, ok: true, status: 200, contentType: 'text/html; rendered=playwright', body: `${html}\n<script id="__PLAYFOOTY_CAPTURED_JSON__" type="application/json">${JSON.stringify(capturedJson).replace(/</g, '\\u003c')}</script>\n<script id="__PLAYFOOTY_RENDER_DIAGNOSTICS__" type="application/json">${JSON.stringify(diagnostics).replace(/</g, '\\u003c')}</script>`, diagnostics }
  } finally {
    await browser.close()
  }
}

async function enableAdvancedLadder(page: import('playwright').Page): Promise<boolean> {
  const controls = [
    page.getByRole('button', { name: /show advanced ladder/i }),
    page.getByRole('checkbox', { name: /show advanced ladder/i }),
    page.getByText(/show advanced ladder/i),
  ]
  for (const control of controls) {
    try {
      if (await control.first().isVisible({ timeout: 1500 })) {
        await control.first().click({ timeout: 3000 })
        await page.waitForTimeout(1500)
        return true
      }
    } catch { /* try next selector */ }
  }
  return false
}

// ── low-level helpers ─────────────────────────────────────────────────────────
const clean = (s: string) => s.replace(/\s+/g, ' ').trim()
const stripTags = (html: string) => clean(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"'))

/** AFL score token: "12.8 (80)" | "12.8" | "(80)" → {goals,behinds,total}. */
function parseScoreToken(tok: string): { goals?: number; behinds?: number; total?: number } | null {
  const gb = /(\d{1,3})\.(\d{1,2})(?:\s*\((\d{1,3})\))?/.exec(tok)
  if (gb) return { goals: +gb[1], behinds: +gb[2], total: gb[3] != null ? +gb[3] : +gb[1] * 6 + +gb[2] }
  const tot = /\((\d{1,3})\)/.exec(tok)
  if (tot) return { total: +tot[1] }
  return null
}

function extractNextData(html: string): unknown | null {
  const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i.exec(html)
  if (!m) return null
  try { return JSON.parse(m[1]) } catch { return null }
}

function extractCapturedJson(html: string): unknown[] {
  const m = /<script id="__PLAYFOOTY_CAPTURED_JSON__"[^>]*>([\s\S]*?)<\/script>/i.exec(html)
  if (!m) return []
  try { const json = JSON.parse(m[1]); return Array.isArray(json) ? json : [json] } catch { return [] }
}

function extractRenderDiagnostics(html: string): RenderDiagnostics | null {
  const m = /<script id="__PLAYFOOTY_RENDER_DIAGNOSTICS__"[^>]*>([\s\S]*?)<\/script>/i.exec(html)
  if (!m) return null
  try { return JSON.parse(m[1]) as RenderDiagnostics } catch { return null }
}

/** Deep-walk a JSON value collecting objects that satisfy `pick`. */
function walk<T>(root: unknown, pick: (o: Record<string, unknown>) => T | null, out: T[] = [], seen = new Set<unknown>(), depth = 0): T[] {
  if (out.length > 2000 || depth > 12 || root == null || typeof root !== 'object' || seen.has(root)) return out
  seen.add(root)
  if (Array.isArray(root)) { for (const v of root) walk(v, pick, out, seen, depth + 1); return out }
  const o = root as Record<string, unknown>
  const got = pick(o); if (got) out.push(got)
  for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v, pick, out, seen, depth + 1)
  return out
}

const asNum = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined
  if (typeof v !== 'number' && typeof v !== 'string') return undefined
  const n = Number(String(v).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : undefined
}
const teamName = (v: unknown): string | undefined => {
  if (typeof v === 'string' && v.trim()) return clean(v)
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return teamName(o.name ?? o.teamName ?? o.displayName ?? o.title ?? o.clubName ?? o.shortName)
  }
  return undefined
}
const normalKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9%]+/g, '')
const genericTeamNames = new Set(['afl', 'football', 'ladder', 'fixture', 'fixtures', 'statistics', 'stats', 'sport', 'tenant', 'team', 'club'])
const plausibleTeamName = (name: string): boolean => {
  const n = clean(name)
  const key = n.toLowerCase()
  return n.length >= 3 && !genericTeamNames.has(key) && !/^\d+$/.test(n) && !/^https?:\/\//i.test(n)
}
function metric(obj: unknown, keys: string[], seen = new Set<unknown>()): number | undefined {
  if (!obj || typeof obj !== 'object' || seen.has(obj)) return undefined
  seen.add(obj)
  const wanted = keys.map(normalKey)
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (item && typeof item === 'object') {
        const row = item as Record<string, unknown>
        const label = String(row.name ?? row.label ?? row.key ?? row.stat ?? row.statistic ?? row.type ?? '').toLowerCase()
        if (wanted.some(k => normalKey(label) === k || normalKey(label).includes(k))) {
          const n = asNum(row.value ?? row.total ?? row.count ?? row.points)
          if (n != null) return n
        }
      }
      const nested = metric(item, keys, seen)
      if (nested != null) return nested
    }
    return undefined
  }
  const o = obj as Record<string, unknown>
  for (const [k, v] of Object.entries(o)) {
    const nk = normalKey(k)
    if (wanted.some(w => nk === w || nk.includes(w))) {
      const n = asNum(v)
      if (n != null) return n
    }
  }
  for (const v of Object.values(o)) {
    const nested = metric(v, keys, seen)
    if (nested != null) return nested
  }
  return undefined
}

// ── structured (JSON / __NEXT_DATA__) extraction ──────────────────────────────
function nested(obj: unknown, ...keys: string[]): unknown {
  if (!obj || typeof obj !== 'object') return undefined
  const o = obj as Record<string, unknown>
  for (const key of keys) {
    if (o[key] != null) return o[key]
  }
  return undefined
}

function roundName(v: unknown): string | undefined {
  if (typeof v === 'number') return `Round ${v}`
  if (typeof v === 'string' && v.trim()) return clean(v)
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return roundName(o.name ?? o.displayName ?? o.label ?? o.roundName ?? o.number ?? o.roundNumber)
  }
  return undefined
}

function scoreFromSide(side: unknown): { goals?: number; behinds?: number; total?: number } | null {
  if (!side || typeof side !== 'object') return null
  const o = side as Record<string, unknown>
  return parseScoreValue(o.score ?? o.points ?? o.total ?? o.result ?? o.matchScore ?? o.latestScore)
    ?? parseScoreValue({ goals: o.goals ?? o.goalCount, behinds: o.behinds ?? o.behindCount, total: o.total ?? o.points ?? o.scoreTotal })
}

function teamFromSide(side: unknown, fallback?: unknown): string | undefined {
  return teamName(fallback) ?? teamName(side) ?? teamName(nested(side, 'team', 'club', 'participant', 'competitor'))
}

function resultsFromJson(root: unknown): ResultRow[] {
  return walk<ResultRow>(root, o => {
    const homeSide = nested(o, 'home', 'homeTeam', 'homeCompetitor', 'homeSide', 'homeParticipant')
    const awaySide = nested(o, 'away', 'awayTeam', 'awayCompetitor', 'awaySide', 'awayParticipant')
    const home = teamFromSide(homeSide, o.homeTeamName ?? o.homeName)
    const away = teamFromSide(awaySide, o.awayTeamName ?? o.awayName)
    if (!home || !away) return null
    const hs = parseScoreValue(o.homeScore ?? o.homePoints ?? o.homeResult ?? o.home) ?? scoreFromSide(homeSide)
    const as = parseScoreValue(o.awayScore ?? o.awayPoints ?? o.awayResult ?? o.away) ?? scoreFromSide(awaySide)
    const hg = asNum(o.homeGoals) ?? asNum(nested(homeSide, 'goals', 'goalCount')) ?? hs?.goals, hb = asNum(o.homeBehinds) ?? asNum(nested(homeSide, 'behinds', 'behindCount')) ?? hs?.behinds, hp = asNum(o.homeScore ?? o.homePoints) ?? hs?.total
    const ag = asNum(o.awayGoals) ?? asNum(nested(awaySide, 'goals', 'goalCount')) ?? as?.goals, ab = asNum(o.awayBehinds) ?? asNum(nested(awaySide, 'behinds', 'behindCount')) ?? as?.behinds, ap = asNum(o.awayScore ?? o.awayPoints) ?? as?.total
    if (hg == null && hp == null && ag == null && ap == null) return null // fixtures, not results
    return { homeName: home, awayName: away, homeGoals: hg, homeBehinds: hb, homePoints: hp, awayGoals: ag, awayBehinds: ab, awayPoints: ap, round: roundName(o.round ?? o.roundName ?? o.roundNumber), matchDate: str(o.date ?? o.startDate ?? o.matchDate ?? o.startTime ?? o.scheduledAt ?? o.scheduledStartTime), time: str(o.time ?? o.matchTime ?? o.startTime), venue: teamName(o.venue ?? o.venueName ?? o.ground), status: str(o.status ?? o.matchStatus ?? o.state ?? o.gameStatus) }
  })
}
function fixturesFromJson(root: unknown): FixtureRow[] {
  return walk<FixtureRow>(root, o => {
    const homeSide = nested(o, 'home', 'homeTeam', 'homeCompetitor', 'homeSide', 'homeParticipant')
    const awaySide = nested(o, 'away', 'awayTeam', 'awayCompetitor', 'awaySide', 'awayParticipant')
    const home = teamFromSide(homeSide, o.homeTeamName ?? o.homeName)
    const away = teamFromSide(awaySide, o.awayTeamName ?? o.awayName)
    if (!home || !away) return null
    if (parseScoreValue(o.homeScore ?? o.homePoints ?? o.homeResult) || parseScoreValue(o.awayScore ?? o.awayPoints ?? o.awayResult) || scoreFromSide(homeSide) || scoreFromSide(awaySide)) return null
    return { homeName: home, awayName: away, round: roundName(o.round ?? o.roundName ?? o.roundNumber), matchDate: str(o.date ?? o.startDate ?? o.matchDate ?? o.startTime ?? o.scheduledAt ?? o.scheduledStartTime), time: str(o.time ?? o.startTime ?? o.matchTime), venue: teamName(o.venue ?? o.venueName ?? o.ground), status: str(o.status ?? o.matchStatus ?? o.state ?? o.gameStatus) ?? 'upcoming' }
  })
}

function playerName(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim()) return clean(v)
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return playerName(o.name ?? o.playerName ?? o.fullName ?? o.displayName ?? o.title)
  }
  return undefined
}

function goalKickersFromJson(root: unknown): GoalKickerRow[] {
  const rows = walk<GoalKickerRow>(root, o => {
    const player = playerName(o.player ?? o.person ?? o.participant ?? o.playerName ?? o.name ?? o.fullName)
    const club = teamName(o.club ?? o.team ?? o.organisation ?? o.clubName ?? o.teamName)
    const goals = metric(o, ['goals', 'goal', 'totalGoals', 'G']) ?? asNum(o.goals ?? o.totalGoals ?? o.value)
    if (!player || !club || goals == null) return null
    const matches = metric(o, ['matches', 'games', 'played', 'appearances']) ?? asNum(o.matches ?? o.games ?? o.played)
    return {
      playerName: player,
      clubName: club,
      leagueName: teamName(o.league ?? o.competition ?? o.association ?? o.leagueName ?? o.competitionName),
      season: str(o.season ?? o.seasonName),
      grade: str(o.grade ?? o.gradeName ?? o.division ?? o.competitionDivisionName),
      goals,
      matches,
    }
  })
  return dedupeGoalKickers(rows)
}

function goalKickersFromCellRows(rows: string[][]): GoalKickerRow[] {
  if (rows.length < 2) return []
  const headerAt = rows.findIndex(r => r.some(c => /player|name/i.test(c)) && r.some(c => /goal/i.test(c)) && r.length >= 3)
  if (headerAt < 0) return []
  const headers = rows[headerAt].map(h => h.toUpperCase())
  const playerIdx = ladderHeaderIndex(headers, ['PLAYER', 'PLAYER NAME', 'NAME'])
  const clubIdx = ladderHeaderIndex(headers, ['CLUB', 'TEAM'])
  const goalsIdx = ladderHeaderIndex(headers, ['GOALS', 'GOAL', 'G'])
  const matchesIdx = ladderHeaderIndex(headers, ['MATCHES', 'GAMES', 'PLAYED', 'M'])
  const leagueIdx = ladderHeaderIndex(headers, ['LEAGUE', 'COMPETITION', 'ASSOCIATION'])
  const gradeIdx = ladderHeaderIndex(headers, ['GRADE', 'DIVISION'])
  if (playerIdx < 0 || clubIdx < 0 || goalsIdx < 0) return []
  const out = rows.slice(headerAt + 1).map((r): GoalKickerRow | null => {
    const player = clean(r[playerIdx] ?? '')
    const club = clean(r[clubIdx] ?? '')
    const goals = asNum(r[goalsIdx])
    if (!player || !club || goals == null || /^(player|name)$/i.test(player)) return null
    return {
      playerName: player,
      clubName: club,
      leagueName: leagueIdx >= 0 ? clean(r[leagueIdx] ?? '') || undefined : undefined,
      grade: gradeIdx >= 0 ? clean(r[gradeIdx] ?? '') || undefined : undefined,
      goals,
      matches: matchesIdx >= 0 ? asNum(r[matchesIdx]) : undefined,
    }
  }).filter((r): r is GoalKickerRow => !!r)
  return out.length ? dedupeGoalKickers(out) : []
}

function goalKickersFromHtml(html: string): GoalKickerRow[] {
  const tableMatches = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map(m => m[0])
  for (const table of tableMatches) {
    const rowHtml = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map(m => m[0])
    const rows = rowHtml.map(r => [...r.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => stripTags(c[1]))).filter(r => r.length >= 3)
    const out = goalKickersFromCellRows(rows)
    if (out.length) return out
  }
  const diagnostics = extractRenderDiagnostics(html)
  const domRows = diagnostics?.domRows ?? []
  return goalKickersFromCellRows(domRows)
}

function dedupeGoalKickers(rows: GoalKickerRow[]): GoalKickerRow[] {
  const seen = new Set<string>()
  return rows.filter(r => {
    const key = `${r.playerName}|${r.clubName}|${r.leagueName ?? ''}|${r.grade ?? ''}`.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return r.goals >= 0
  })
}

function ladderFromJson(root: unknown): LadderRow[] {
  const rows = walk<LadderRow>(root, o => {
    const club = teamName(o.team ?? o.club ?? o.competitor ?? o.organisation ?? o.participant ?? o.clubName ?? o.teamName)
    const played = metric(o, ['played', 'games', 'gamesPlayed', 'P', 'GP'])
    const pts = metric(o, ['points', 'premiershipPoints', 'competitionPoints', 'PTS'])
    if (!club || !plausibleTeamName(club) || (played == null && pts == null && metric(o, ['wins', 'won', 'W']) == null)) return null
    return {
      clubName: club,
      position: metric(o, ['position', 'rank', 'pos']),
      played,
      wins: metric(o, ['wins', 'won', 'W']),
      losses: metric(o, ['losses', 'lost', 'L']),
      draws: metric(o, ['draws', 'drawn', 'D']),
      byes: metric(o, ['bye', 'byes']),
      pointsFor: metric(o, ['pointsFor', 'scoreFor', 'for', 'F', 'PF']),
      pointsAgainst: metric(o, ['pointsAgainst', 'scoreAgainst', 'against', 'A', 'PA']),
      percentage: metric(o, ['percentage', 'percent', 'pct', '%']),
      points: pts,
      forfeits: metric(o, ['forfeit', 'forfeits']),
      disqualified: metric(o, ['disqualified', 'disqualifications']),
      adjustedPoints: metric(o, ['adjustedPoints', 'adjusted', 'adjustments']),
    }
  })
  return dedupeLadderRows(rows)
}

function meaningfulLadderNumbers(row: LadderRow): number {
  const values = [row.position, row.played, row.wins, row.losses, row.draws, row.byes, row.pointsFor, row.pointsAgainst, row.percentage, row.points, row.forfeits, row.disqualified, row.adjustedPoints]
  return values.filter(v => v != null && Number.isFinite(v)).length
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? clean(v) : undefined)
const parseScoreValue = (v: unknown): { goals?: number; behinds?: number; total?: number } | null => {
  if (typeof v === 'number') return { total: v }
  if (typeof v === 'string') return parseScoreToken(v)
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    const goals = asNum(o.goals), behinds = asNum(o.behinds), total = asNum(o.total ?? o.points ?? o.score)
    if (goals != null || behinds != null || total != null) return { goals, behinds, total: total ?? ((goals ?? 0) * 6 + (behinds ?? 0)) }
  }
  return null
}

// ── HTML text fallback (AFL score lines) ──────────────────────────────────────
/** "Home Team 12.8 (80) def/d/v/beat Away Team 9.10 (64)". */
function resultsFromText(text: string): ResultRow[] {
  const out: ResultRow[] = []
  // Team names exclude digits so round labels ("Round 1") can't bleed into them.
  const re = /([A-Z][A-Za-z'&./ -]{1,40}?)\s+(\d{1,3}\.\d{1,2}\s*\(\d{1,3}\))\s+(?:def(?:eated)?|beat|d|drew\s+with|lt|lost\s+to|v|vs|-)\s+([A-Z][A-Za-z'&./ -]{1,40}?)\s+(\d{1,3}\.\d{1,2}\s*\(\d{1,3}\))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const hs = parseScoreToken(m[2]), as = parseScoreToken(m[4])
    if (!hs || !as) continue
    out.push({ homeName: clean(m[1]), awayName: clean(m[3]), homeGoals: hs.goals, homeBehinds: hs.behinds, homePoints: hs.total, awayGoals: as.goals, awayBehinds: as.behinds, awayPoints: as.total })
    if (out.length > 500) break
  }
  return out
}

const ladderHeaderIndex = (headers: string[], labels: string[]) => headers.findIndex(h => labels.some(n => h === n || h.includes(n)))
function ladderFromCellRows(rows: string[][]): LadderRow[] {
  if (rows.length < 2) return []
  const headerAt = rows.findIndex(r => r.some(c => /team|club/i.test(c)) && r.length >= 4)
  if (headerAt < 0) return []
  const headers = rows[headerAt].map(h => h.toUpperCase())
  const teamIdx = ladderHeaderIndex(headers, ['TEAM', 'CLUB'])
  if (teamIdx < 0) return []
  const posIdx = ladderHeaderIndex(headers, ['POS', 'POSITION', '#'])
  const playedIdx = ladderHeaderIndex(headers, ['PLAYED', 'PLD', 'P'])
  const pointsIdx = ladderHeaderIndex(headers, ['PTS', 'POINTS'])
  const pctIdx = ladderHeaderIndex(headers, ['%', 'PERC', 'PCT'])
  const winsIdx = ladderHeaderIndex(headers, ['WINS', 'WON', 'W'])
  const lossesIdx = ladderHeaderIndex(headers, ['LOSSES', 'LOST', 'L'])
  const drawsIdx = ladderHeaderIndex(headers, ['DRAWS', 'DRAWN', 'D'])
  const byeIdx = ladderHeaderIndex(headers, ['BYE'])
  const forIdx = ladderHeaderIndex(headers, ['FOR', 'F', 'PF'])
  const againstIdx = ladderHeaderIndex(headers, ['AGAINST', 'A', 'PA'])
  const forfeitIdx = ladderHeaderIndex(headers, ['FORFEIT'])
  const dqIdx = ladderHeaderIndex(headers, ['DISQUALIFIED'])
  const adjustedIdx = ladderHeaderIndex(headers, ['ADJUSTED'])
  const numAt = (r: string[], i: number) => i >= 0 ? asNum(r[i]) : undefined
  const out = rows.slice(headerAt + 1).map((r, i): LadderRow | null => {
    const clubName = clean(r[teamIdx] ?? '')
    if (!clubName || !plausibleTeamName(clubName)) return null
    const row: LadderRow = { clubName, position: numAt(r, posIdx) ?? i + 1, played: numAt(r, playedIdx), wins: numAt(r, winsIdx), losses: numAt(r, lossesIdx), draws: numAt(r, drawsIdx), byes: numAt(r, byeIdx), pointsFor: numAt(r, forIdx), pointsAgainst: numAt(r, againstIdx), percentage: numAt(r, pctIdx), points: numAt(r, pointsIdx), forfeits: numAt(r, forfeitIdx), disqualified: numAt(r, dqIdx), adjustedPoints: numAt(r, adjustedIdx) }
    return meaningfulLadderNumbers(row) >= 2 ? row : null
  }).filter((r): r is LadderRow => !!r)
  return out.length >= 4 ? out : []
}
function dedupeLadderRows(rows: LadderRow[]): LadderRow[] {
  const seen = new Set<string>()
  return rows.filter(r => {
    if (!plausibleTeamName(r.clubName) || meaningfulLadderNumbers(r) < 2) return false
    const key = r.clubName.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
}

function ladderFromHtml(html: string): LadderRow[] {
  const tableMatches = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map(m => m[0])
  console.log(`[playhq-parse] HTML tables found=${tableMatches.length}`)
  for (const table of tableMatches) {
    const rowHtml = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map(m => m[0])
    const rows = rowHtml.map(r => [...r.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => stripTags(c[1]))).filter(r => r.length >= 4)
    const out = ladderFromCellRows(rows)
    if (out.length) return out
  }
  const diagnostics = extractRenderDiagnostics(html)
  const domRows = diagnostics?.domRows ?? []
  if (domRows.length) {
    const out = ladderFromCellRows(domRows)
    if (out.length) {
      console.log(`[playhq-parse] ladder rows parsed=${out.length} strategy=rendered-dom-rows`)
      return out
    }
  }
  return []
}

// ── public parse API ──────────────────────────────────────────────────────────

export function parseGoalKickers(page: FetchedPage): ParseOutcome<GoalKickerRow> {
  const warnings: string[] = []
  if (!page.ok) return { rows: [], confidence: 0, strategy: 'none', warnings: [page.error ?? 'fetch failed'] }
  if (page.contentType.includes('json')) {
    try {
      const rows = goalKickersFromJson(JSON.parse(page.body))
      if (rows.length) return { rows: rows.map(r => ({ ...r, sourceUrl: page.url })), confidence: 0.85, strategy: 'json', warnings }
    } catch { warnings.push('json parse failed') }
  }
  const nd = extractNextData(page.body)
  if (nd) {
    const rows = goalKickersFromJson(nd)
    if (rows.length) return { rows: rows.map(r => ({ ...r, sourceUrl: page.url })), confidence: 0.8, strategy: '__NEXT_DATA__', warnings }
  }
  for (const json of extractCapturedJson(page.body)) {
    const rows = goalKickersFromJson(json)
    if (rows.length) return { rows: rows.map(r => ({ ...r, sourceUrl: page.url })), confidence: 0.9, strategy: 'playwright-json', warnings }
  }
  const rows = goalKickersFromHtml(page.body)
  if (rows.length) return { rows: rows.map(r => ({ ...r, sourceUrl: page.url })), confidence: 0.7, strategy: 'html-table', warnings }
  const diagnostics = extractRenderDiagnostics(page.body) ?? page.diagnostics as RenderDiagnostics | undefined
  if (diagnostics) {
    warnings.push(`no goal kickers parsed: finalUrl=${diagnostics.finalUrl ?? page.url}; title=${diagnostics.title ?? 'unknown'}; tables=${diagnostics.tableCount ?? 0}; rows=${diagnostics.rowCount ?? 0}; jsonResponses=${diagnostics.capturedJsonCount ?? 0}; sample=${(diagnostics.textSample ?? '').slice(0, 300)}`)
  } else {
    warnings.push('no goal kickers could be extracted from rendered DOM, embedded JSON, captured network JSON, or HTML tables')
  }
  return { rows: [], confidence: 0, strategy: 'none', warnings }
}

export function parseResults(page: FetchedPage): ParseOutcome<ResultRow> {
  const warnings: string[] = []
  if (!page.ok) return { rows: [], confidence: 0, strategy: 'none', warnings: [page.error ?? 'fetch failed'] }
  // 1) JSON body
  if (page.contentType.includes('json')) {
    try { const rows = resultsFromJson(JSON.parse(page.body)); if (rows.length) return { rows: rows.map(r => ({ ...r, sourceUrl: page.url })), confidence: 0.85, strategy: 'json', warnings } } catch { warnings.push('json parse failed') }
  }
  // 2) __NEXT_DATA__
  const nd = extractNextData(page.body)
  if (nd) { const rows = resultsFromJson(nd); if (rows.length) return { rows: rows.map(r => ({ ...r, sourceUrl: page.url })), confidence: 0.8, strategy: '__NEXT_DATA__', warnings } }
  for (const json of extractCapturedJson(page.body)) {
    const rows = resultsFromJson(json)
    if (rows.length) { console.log(`[playhq-parse] result rows parsed=${rows.length} strategy=playwright-json`); return { rows: rows.map(r => ({ ...r, sourceUrl: page.url })), confidence: 0.9, strategy: 'playwright-json', warnings } }
  }
  // 3) HTML text
  const rows = resultsFromText(stripTags(page.body))
  if (rows.length) { console.log(`[playhq-parse] result rows parsed=${rows.length} strategy=html-text`); return { rows: rows.map(r => ({ ...r, sourceUrl: page.url })), confidence: 0.6, strategy: 'html-text', warnings } }
  warnings.push('no results could be extracted from this page (JS-rendered page or unsupported format — PlayHQ API credentials may be required)')
  return { rows: [], confidence: 0, strategy: 'none', warnings }
}

export function parseFixtures(page: FetchedPage): ParseOutcome<FixtureRow> {
  const warnings: string[] = []
  if (!page.ok) return { rows: [], confidence: 0, strategy: 'none', warnings: [page.error ?? 'fetch failed'] }
  if (page.contentType.includes('json')) {
    try { const rows = fixturesFromJson(JSON.parse(page.body)); if (rows.length) return { rows: rows.map(r => ({ ...r, sourceUrl: page.url })), confidence: 0.85, strategy: 'json', warnings } } catch { warnings.push('json parse failed') }
  }
  const nd = extractNextData(page.body)
  if (nd) { const rows = fixturesFromJson(nd); if (rows.length) return { rows: rows.map(r => ({ ...r, sourceUrl: page.url })), confidence: 0.8, strategy: '__NEXT_DATA__', warnings } }
  for (const json of extractCapturedJson(page.body)) {
    const rows = fixturesFromJson(json)
    if (rows.length) { console.log(`[playhq-parse] fixture rows parsed=${rows.length} strategy=playwright-json`); return { rows: rows.map(r => ({ ...r, sourceUrl: page.url })), confidence: 0.9, strategy: 'playwright-json', warnings } }
  }
  warnings.push('no fixtures could be extracted (JS-rendered page or unsupported format — PlayHQ API credentials may be required)')
  return { rows: [], confidence: 0, strategy: 'none', warnings }
}

export function parseLadder(page: FetchedPage): ParseOutcome<LadderRow> {
  const warnings: string[] = []
  if (!page.ok) return { rows: [], confidence: 0, strategy: 'none', warnings: [page.error ?? 'fetch failed'] }
  if (page.contentType.includes('json')) {
    try { const rows = ladderFromJson(JSON.parse(page.body)); if (rows.length) return { rows, confidence: 0.85, strategy: 'json', warnings } } catch { warnings.push('json parse failed') }
  }
  const nd = extractNextData(page.body)
  if (nd) { const rows = ladderFromJson(nd); if (rows.length) return { rows, confidence: 0.8, strategy: '__NEXT_DATA__', warnings } }
  for (const json of extractCapturedJson(page.body)) {
    const rows = ladderFromJson(json)
    if (rows.length) { console.log(`[playhq-parse] ladder rows parsed=${rows.length} strategy=playwright-json`); return { rows, confidence: 0.9, strategy: 'playwright-json', warnings } }
  }
  const rows = ladderFromHtml(page.body)
  if (rows.length) { console.log(`[playhq-parse] ladder rows parsed=${rows.length} strategy=html-table`); return { rows, confidence: 0.7, strategy: 'html-table', warnings } }
  const diagnostics = extractRenderDiagnostics(page.body) ?? page.diagnostics as RenderDiagnostics | undefined
  if (diagnostics) {
    if (diagnostics.authWall) warnings.push('PlayHQ rendered page appears to show an authentication wall')
    warnings.push(`rendered diagnostics: finalUrl=${diagnostics.finalUrl ?? page.url}; title=${diagnostics.title ?? 'unknown'}; appShellLoaded=${diagnostics.appShellLoaded ? 'yes' : 'no'}; ladderTabSelected=${diagnostics.ladderTabSelected ? 'yes' : 'no'}; advancedToggleExists=${diagnostics.advancedToggleExists ? 'yes' : 'no'}; advancedToggleClicked=${diagnostics.advancedToggleClicked ? 'yes' : 'no'}; tables=${diagnostics.tableCount ?? 0}; rows=${diagnostics.rowCount ?? 0}; jsonResponses=${diagnostics.capturedJsonCount ?? 0}; screenshot=${diagnostics.screenshotPath ?? 'not-written'}; html=${diagnostics.htmlPath ?? 'not-written'}`)
    const endpoints = (diagnostics.capturedResponses ?? []).map(r => `${r.status ?? '?'} ${r.url ?? 'unknown'}`).slice(0, 12).join(' | ')
    if (endpoints) warnings.push(`captured JSON endpoints: ${endpoints}`)
  }
  warnings.push('no ladder could be extracted from rendered DOM, embedded JSON, or captured network JSON')
  return { rows: [], confidence: 0, strategy: 'none', warnings }
}
