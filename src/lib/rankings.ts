/**
 * Shared types + fetch helpers + display utilities for the rankings product.
 */
import { useEffect, useState } from 'react'

export const QUALIFY_CUTOFF = 32
export type FormResult = 'W' | 'L' | 'D'

export interface RankingEntry {
  rank: number; previousRank: number | null; rankMovement: number; clubId: string; clubName: string
  logoUrl?: string | null; leagueName: string; state: string; powerRating: number
  record: { wins: number; losses: number; draws: number; played: number }
  goalsFor: number; goalsAgainst: number; percentage: number; recentForm: FormResult[]
  componentScores: Record<string, number>
}
export interface RankingsResponse { data: RankingEntry[]; meta: { weekLabel: string | null; season: string | null; total: number; generatedAt?: string } }

export interface ClubProfile {
  clubId: string; clubName: string; leagueId: string | null; leagueName: string | null; state: string | null
  rank: number | null; previousRank: number | null; rankMovement: number; powerRating: number | null
  ranked: boolean; qualified: boolean; qualifyCutoff: number
  record: { wins: number; losses: number; draws: number; played: number }
  goalsFor: number; goalsAgainst: number; percentage: number; ladderPosition: number | null
  leagueStrengthScore: number | null; leagueStrengthTier: number | null; recentForm: FormResult[]
  componentScores: Record<string, number>; weekLabel: string; season: string
  history: { weekLabel: string; rank: number; powerRating: number; date: string }[]
  town?: string | null; region?: string | null; stateName?: string | null; logoUrl?: string | null
  primaryColour?: string | null; secondaryColour?: string | null; websiteUrl?: string | null
  facebookUrl?: string | null; instagramUrl?: string | null
  ladder?: { clubId: string; clubName: string; position: number | null; played: number; wins: number; losses: number; draws: number; percentage: number; points: number; isThisClub: boolean }[]
}

export interface LeagueRankedTeam {
  clubId: string; clubName: string; rank: number; previousRank?: number | null; rankMovement?: number
  powerRating: number; state: string; recentForm?: FormResult[]; qualified: boolean
}
export interface LeagueFixture {
  id: string; round: string | null; grade: string; homeClubId: string | null; awayClubId: string | null
  homeName: string; awayName: string; matchDate: string | null; venue: string | null; verified: boolean
}
export interface LeagueResult extends LeagueFixture {
  homeGoals: number; homeBehinds: number; homePoints: number; awayGoals: number; awayBehinds: number; awayPoints: number
}
export interface LeagueGoalKicker {
  id: string; playerId: string | null; rank: number; playerName: string; clubId: string | null
  clubName: string; clubLogoUrl?: string | null; grade?: string | null; goals: number; matches?: number | null; updatedAt: string
}
export interface LeagueDetail {
  id: string; name: string; shortName?: string | null; description?: string | null
  state: string; stateName?: string; association?: string | null; associationId?: string | null
  strengthScore: number; strengthTier?: number; strengthConfidence?: number | null
  strengthReasoning?: string | null; strengthCalculatedAt?: string | null
  regionName?: string | null; currentSeason?: string | null; grade?: string | null
  lastSyncedAt?: string | null; updatedAt?: string | null; logoUrl?: string | null
  websiteUrl?: string | null; facebookUrl?: string | null; featuredLeague?: boolean
  primarySource?: string | null; weekLabel?: string | null; totalRanked?: number; clubCount?: number
  rankedTeams: LeagueRankedTeam[]
  ladder: { clubId: string; clubName: string; logoUrl?: string | null; position: number | null; played: number; wins: number; losses: number; draws: number; goalsFor: number; goalsAgainst: number; percentage: number; points: number }[]
  fixtures?: LeagueFixture[]
  results?: LeagueResult[]
  goalKickers?: LeagueGoalKicker[]
}

export interface LegacySearchResults {
  teams: { clubId: string; clubName: string; leagueName: string; state: string; rank: number }[]
  leagues: { id: string; name: string; strengthScore: number; state: string }[]
}

export interface SearchResults {
  clubs: { id: string; name: string; logoUrl?: string | null; state: string; leagueId?: string | null; leagueName?: string | null; rank?: number | null; powerRating?: number | null; aliases?: string[]; href: string }[]
  leagues: { id: string; name: string; logoUrl?: string | null; strengthScore: number; state: string; href: string }[]
  players: { id: string; name: string; clubId?: string | null; clubName: string; leagueId: string; leagueName: string; goals: number; season: string; logoUrl?: string | null; href: string }[]
  matches: { id: string; kind: 'fixture' | 'result'; title: string; leagueId: string; leagueName: string; date?: string | null; round?: string | null; venue?: string | null; href: string }[]
  news: { id: string; title: string; summary: string; category: string; date?: string | null; heroSeed: string; href: string }[]
  highlights: { id: string; title: string; category: string; playerName: string; clubId?: string | null; clubName: string; leagueId?: string | null; leagueName?: string | null; weekKey: string; winner: boolean; href: string }[]
  records: { id: string; title: string; summary: string; href: string }[]
}
export interface SearchResponse { data: SearchResults; meta: { query: string; total: number; partial: string[] } }

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json() as Promise<T>
}
export const fetchRankings = () => getJson<RankingsResponse>('/api/rankings')
export const fetchTop = (n: 10 | 25 | 100) => getJson<RankingsResponse>(`/api/top${n}`)
export const fetchClub = (id: string) => getJson<{ data: ClubProfile }>(`/api/clubs/${id}`).then(response => response.data)
export const fetchLeague = (id: string) => getJson<{ data: LeagueDetail }>(`/api/leagues/${id}`).then(response => response.data)
export const fetchSearch = (q: string) => getJson<{ data: LegacySearchResults }>(`/api/leagues/search/global?q=${encodeURIComponent(q)}`).then(response => response.data)
export const fetchUnifiedSearch = (q: string) => getJson<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}`)

export interface ClubExplanation {
  clubId: string; clubName: string; rank: number; powerRating: number; weekLabel: string
  reasoning: string; componentScores: Record<string, number>
  league: { name: string; strength: number; confidence: number; reasoning: string | null; calculatedAt: string | null } | null
}
export const fetchClubExplain = (id: string) => getJson<{ data: ClubExplanation }>(`/api/rankings/explain/${id}`).then(response => response.data)

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setLoading(true); setError(null)
    fn().then(value => { if (alive) setData(value) })
      .catch(reason => { if (alive) setError(String(reason)) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return { data, loading, error }
}

export const strengthStars = (score: number | null | undefined) => Math.max(1, Math.min(5, Math.round((score ?? 60) / 20)))
export const strengthLabel = (stars: number) => ['', 'Developing', 'Competitive', 'Strong', 'Elite', 'Premier'][stars] ?? 'Competitive'
export const teamPath = (clubId: string) => `/team/${clubId}`
export const leaguePath = (leagueId: string) => `/league/${leagueId}`
export const ordinal = (n: number) => { const suffixes = ['th', 'st', 'nd', 'rd']; const value = n % 100; return n + (suffixes[(value - 20) % 10] ?? suffixes[value] ?? suffixes[0]) }
