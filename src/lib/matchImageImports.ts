import { getKey } from './admin'

export type MatchImageKind = 'fixtures' | 'results'
export type MatchDecision = 'import' | 'skip'
export interface ClubMatch { clubId: string | null; matchedName: string | null; score: number; confident: boolean }
export interface MatchImageRow {
  round?: number; grade?: string | null; matchDate?: string | null; matchTime?: string | null; venue?: string | null
  homeTeam: string; awayTeam: string
  homeGoals?: number; homeBehinds?: number; homeScore?: number
  awayGoals?: number; awayBehinds?: number; awayScore?: number
  status?: string | null
  homeMatch: ClubMatch; awayMatch: ClubMatch
}
export interface MatchImagePreview {
  kind: MatchImageKind; league: string | null; grade: string | null; season: string | null; round: number | null
  matchedLeagueId: string | null; rows: MatchImageRow[]; uncertain: number; confidence: number | null; notes: string | null
}

async function request<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${getKey()}` }, body: JSON.stringify(body) })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${response.status}`)
  return json as T
}

export const matchImageImports = {
  parse: (image: string, kind: MatchImageKind, leagueId?: string) => request<{ data: MatchImagePreview }>('/admin/match-images/parse', { image, kind, leagueId }).then(r => r.data),
  commit: (payload: { kind: MatchImageKind; leagueId: string; season: string; grade: string; rows: unknown[] }) => request<{ data: Record<string, unknown> }>('/admin/match-images/commit', payload).then(r => r.data),
}
