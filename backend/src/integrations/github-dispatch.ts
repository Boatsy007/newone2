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
 *
 * The production repository and branch are intentionally fixed here so stale
 * Vercel environment values cannot redirect imports to an old repository.
 */

import { logger } from '../utils/logger.js'

const API = 'https://api.github.com'
const REPO = 'Boatsy007/newone2'
const REF = 'newone1'
const PLAYHQ_WORKFLOW = 'playhq-ladder-import.yml'

export interface DispatchConfig { repo: string; ref: string; hasToken: boolean }

export function githubConfig(): DispatchConfig {
  return {
    repo: REPO,
    ref: REF,
    hasToken: !!process.env.GITHUB_DISPATCH_TOKEN,
  }
}

function token(): string {
  const t = process.env.GITHUB_DISPATCH_TOKEN
  if (!t) throw new Error('GitHub Actions dispatch is not configured: missing GITHUB_DISPATCH_TOKEN. Set it in the Vercel/API environment with GitHub Actions read/write permission.')
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

function resolveWorkflowFile(workflowFile: string): string {
  return workflowFile === 'playhq-import.yml' ? PLAYHQ_WORKFLOW : workflowFile
}

export interface WorkflowRunInfo {
  id:         number
  status:     string
  conclusion: string | null
  htmlUrl:    string
  createdAt:  string
  name:       string
  event:      string
}

export async function dispatchWorkflow(workflowFile: string, inputs: Record<string, string> = {}): Promise<{ dispatched: true; run: WorkflowRunInfo | null; htmlUrl: string }> {
  const { repo, ref } = githubConfig()
  const resolvedWorkflowFile = resolveWorkflowFile(workflowFile)
  const dispatchUrl = `${API}/repos/${repo}/actions/workflows/${resolvedWorkflowFile}/dispatches`

  const before = await latestRun(resolvedWorkflowFile).catch(() => null)

  const res = await fetch(dispatchUrl, { method: 'POST', headers: headers(), body: JSON.stringify({ ref, inputs }) })
  if (res.status !== 204) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub dispatch failed (${res.status}) for ${repo}@${ref}/${resolvedWorkflowFile}: ${body.slice(0, 300)}`)
  }
  logger.info('GitHubDispatch: workflow dispatched', { workflowFile: resolvedWorkflowFile, repo, ref, inputKeys: Object.keys(inputs) })

  let run: WorkflowRunInfo | null = null
  for (let i = 0; i < 6; i++) {
    await new Promise(r => setTimeout(r, 1500))
    const newest = await latestRun(resolvedWorkflowFile).catch(() => null)
    if (newest && (!before || newest.id !== before.id)) { run = newest; break }
  }
  const htmlUrl = run?.htmlUrl ?? `https://github.com/${repo}/actions/workflows/${resolvedWorkflowFile}`
  return { dispatched: true, run, htmlUrl }
}

export async function latestRun(workflowFile: string): Promise<WorkflowRunInfo | null> {
  const runs = await listRuns(workflowFile, 1)
  return runs[0] ?? null
}

export async function listRuns(workflowFile: string, perPage = 10): Promise<WorkflowRunInfo[]> {
  const { repo, ref } = githubConfig()
  const resolvedWorkflowFile = resolveWorkflowFile(workflowFile)
  const url = `${API}/repos/${repo}/actions/workflows/${resolvedWorkflowFile}/runs?branch=${encodeURIComponent(ref)}&per_page=${perPage}`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) throw new Error(`GitHub list runs failed (${res.status})`)
  const json = await res.json() as { workflow_runs?: Array<Record<string, unknown>> }
  return (json.workflow_runs ?? []).map(mapRun)
}

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
