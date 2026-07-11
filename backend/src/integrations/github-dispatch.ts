/**
 * GitHub Actions dispatch client — the production execution engine
 * ─────────────────────────────────────────────────────────────────────────────
 * PlayHQ scraping needs a real headless browser (Playwright/Chromium), which
 * cannot run inside a Vercel serverless function. Instead, admin actions
 * (PlayHQ URL import, league sync, discovery scrape) DISPATCH a GitHub Actions
 * workflow — the workflow runs the browser-backed job on GitHub's runners and
 * writes to the same database. The admin panel stays one-click and polls the
 * run status back.
 *
 * Configuration (server env — never logged, never returned to the client):
 *   GITHUB_DISPATCH_TOKEN   fine-grained PAT with "Actions: read & write" on the repo
 *   GITHUB_REPO             "owner/repo" (or derive from GITHUB_REPOSITORY / Vercel git env)
 *   GITHUB_REF              branch to run the workflow on (default: work)
 *
 * If the token is missing, dispatch() throws a clear, non-sensitive error so the
 * admin UI can tell the operator to configure it — it never falls back to
 * running Playwright in-process.
 */

import { logger } from '../utils/logger.js'

const API = 'https://api.github.com'

export interface DispatchConfig { repo: string; ref: string; hasToken: boolean }

export function githubConfig(): DispatchConfig {
  const vercelRepo = process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG
    ? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}`
    : undefined
  const repo = process.env.GITHUB_REPO ?? process.env.GITHUB_REPOSITORY ?? vercelRepo
  if (!repo) throw new Error('GitHub Actions dispatch is not configured: missing repository. Set GITHUB_REPO, GITHUB_REPOSITORY, or both VERCEL_GIT_REPO_OWNER and VERCEL_GIT_REPO_SLUG.')
  return {
    repo,
    ref:  process.env.GITHUB_REF  ?? 'work',
    hasToken: !!process.env.GITHUB_DISPATCH_TOKEN,
  }
}

function token(): string {
  const t = process.env.GITHUB_DISPATCH_TOKEN
  if (!t) throw new Error('GitHub Actions dispatch is not configured: missing GITHUB_DISPATCH_TOKEN. Set it in the Vercel/API environment with GitHub Actions read/write permission, and set GITHUB_REPO plus GITHUB_REF=work (or your intended source-of-truth branch).')
  return t
}

function headers(): Record<string, string> {
  return {
    'Authorization': `Bearer ${token()}`,
    'Accept':        'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent':    'PlayFooty-Admin/1.0',
  }
}

export interface WorkflowRunInfo {
  id:         number
  status:     string          // queued | in_progress | completed
  conclusion: string | null   // success | failure | cancelled | null
  htmlUrl:    string
  createdAt:  string
  name:       string
  event:      string
}

/**
 * Dispatch a workflow_dispatch event, then resolve the run it created so the UI
 * can track it. Returns the (best-effort) newest run for the workflow on the ref.
 */
export async function dispatchWorkflow(workflowFile: string, inputs: Record<string, string> = {}): Promise<{ dispatched: true; run: WorkflowRunInfo | null; htmlUrl: string }> {
  const { repo, ref } = githubConfig()
  const dispatchUrl = `${API}/repos/${repo}/actions/workflows/${workflowFile}/dispatches`

  const before = await latestRun(workflowFile).catch(() => null)

  const res = await fetch(dispatchUrl, { method: 'POST', headers: headers(), body: JSON.stringify({ ref, inputs }) })
  if (res.status !== 204) {
    const body = await res.text().catch(() => '')
    // Do not leak the token; only status + GitHub's message.
    throw new Error(`GitHub dispatch failed (${res.status}): ${body.slice(0, 300)}`)
  }
  logger.info('GitHubDispatch: workflow dispatched', { workflowFile, ref, inputKeys: Object.keys(inputs) })

  // Poll briefly for the newly-created run so we can hand back a run id + URL.
  let run: WorkflowRunInfo | null = null
  for (let i = 0; i < 6; i++) {
    await new Promise(r => setTimeout(r, 1500))
    const newest = await latestRun(workflowFile).catch(() => null)
    if (newest && (!before || newest.id !== before.id)) { run = newest; break }
  }
  const htmlUrl = run?.htmlUrl ?? `https://github.com/${repo}/actions/workflows/${workflowFile}`
  return { dispatched: true, run, htmlUrl }
}

/** Most recent run for a workflow on the configured ref. */
export async function latestRun(workflowFile: string): Promise<WorkflowRunInfo | null> {
  const runs = await listRuns(workflowFile, 1)
  return runs[0] ?? null
}

/** Recent runs for a workflow (newest first). */
export async function listRuns(workflowFile: string, perPage = 10): Promise<WorkflowRunInfo[]> {
  const { repo, ref } = githubConfig()
  const url = `${API}/repos/${repo}/actions/workflows/${workflowFile}/runs?branch=${encodeURIComponent(ref)}&per_page=${perPage}`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) throw new Error(`GitHub list runs failed (${res.status})`)
  const json = await res.json() as { workflow_runs?: Array<Record<string, unknown>> }
  return (json.workflow_runs ?? []).map(mapRun)
}

/** Fetch a single run by id (for polling). */
export async function getRun(runId: number): Promise<WorkflowRunInfo> {
  const { repo } = githubConfig()
  const res = await fetch(`${API}/repos/${repo}/actions/runs/${runId}`, { headers: headers() })
  if (!res.ok) throw new Error(`GitHub get run failed (${res.status})`)
  return mapRun(await res.json() as Record<string, unknown>)
}

function mapRun(r: Record<string, unknown>): WorkflowRunInfo {
  return {
    id:         Number(r.id),
    status:     String(r.status ?? 'unknown'),
    conclusion: (r.conclusion as string | null) ?? null,
    htmlUrl:    String(r.html_url ?? ''),
    createdAt:  String(r.created_at ?? ''),
    name:       String(r.name ?? ''),
    event:      String(r.event ?? ''),
  }
}
