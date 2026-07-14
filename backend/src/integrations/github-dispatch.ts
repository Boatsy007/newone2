/**
 * GitHub Actions dispatch client — the production execution engine
 * ─────────────────────────────────────────────────────────────────────────────
 * PlayHQ scraping needs a real headless browser (Playwright/Chromium), which
 * cannot run inside a Vercel serverless function. Instead, admin actions
 * dispatch a GitHub Actions workflow that runs the browser-backed job and writes
 * to the same database.
 */

import { logger } from '../utils/logger.js'

const API = 'https://api.github.com'
const DISPATCH_REPO = 'Boatsy007/newone2'
const DISPATCH_REF = 'newone1'

export interface DispatchConfig { repo: string; ref: string; hasToken: boolean }

export function githubConfig(): DispatchConfig {
  return {
    repo: DISPATCH_REPO,
    ref: DISPATCH_REF,
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
    Authorization: `Bearer ${token()}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'PlayFooty-Admin/1.0',
  }
}

export interface WorkflowRunInfo {
  id: number
  status: string
  conclusion: string | null
  htmlUrl: string
  createdAt: string
  name: string
  event: string
}

export async function dispatchWorkflow(workflowFile: string, inputs: Record<string, string> = {}): Promise<{ dispatched: true; run: WorkflowRunInfo | null; htmlUrl: string }> {
  const { repo, ref } = githubConfig()
  const dispatchUrl = `${API}/repos/${repo}/actions/workflows/${workflowFile}/dispatches`

  const before = await latestRun(workflowFile).catch(() => null)

  const res = await fetch(dispatchUrl, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ ref, inputs }),
  })

  if (res.status !== 204) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub dispatch failed (${res.status}) for ${repo}@${ref}/${workflowFile}: ${body.slice(0, 300)}`)
  }

  logger.info('GitHubDispatch: workflow dispatched', { workflowFile, repo, ref, inputKeys: Object.keys(inputs) })

  let run: WorkflowRunInfo | null = null
  for (let i = 0; i < 6; i++) {
    await new Promise(resolve => setTimeout(resolve, 1500))
    const newest = await latestRun(workflowFile).catch(() => null)
    if (newest && (!before || newest.id !== before.id)) {
      run = newest
      break
    }
  }

  const htmlUrl = run?.htmlUrl ?? `https://github.com/${repo}/actions/workflows/${workflowFile}`
  return { dispatched: true, run, htmlUrl }
}

export async function latestRun(workflowFile: string): Promise<WorkflowRunInfo | null> {
  const runs = await listRuns(workflowFile, 1)
  return runs[0] ?? null
}

export async function listRuns(workflowFile: string, perPage = 10): Promise<WorkflowRunInfo[]> {
  const { repo, ref } = githubConfig()
  const url = `${API}/repos/${repo}/actions/workflows/${workflowFile}/runs?branch=${encodeURIComponent(ref)}&per_page=${perPage}`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) throw new Error(`GitHub list runs failed (${res.status}) for ${repo}@${ref}/${workflowFile}`)
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
    id: Number(r.id),
    status: String(r.status ?? 'unknown'),
    conclusion: (r.conclusion as string | null) ?? null,
    htmlUrl: String(r.html_url ?? ''),
    createdAt: String(r.created_at ?? ''),
    name: String(r.name ?? ''),
    event: String(r.event ?? ''),
  }
}
