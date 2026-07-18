export type RecordPeriod = 'week' | 'season'
export type RecordCategory =
  | 'highestScore'
  | 'lowestScore'
  | 'lowestWinningScore'
  | 'mostGoals'
  | 'mostBehinds'
  | 'biggestMargin'
  | 'closestMatch'
  | 'highestCombinedScore'
  | 'lowestCombinedScore'

export type FootballRecordEntry = {
  rank: number
  category: RecordCategory
  value: number
  valueLabel: string
  resultId: string
  matchUrl: string
  leagueId: string
  leagueName: string
  leagueUrl: string
  state: string
  season: string
  grade: string
  round: string | null
  matchDate: string | null
  clubId: string | null
  clubName: string
  clubUrl: string | null
  opponentId: string | null
  opponentName: string
  homeName: string
  awayName: string
  homePoints: number
  awayPoints: number
  homeGoals: number
  awayGoals: number
  margin: number
}

export type FootballRecordsPayload = {
  period: RecordPeriod
  generatedAt: string
  weekStart: string | null
  weekEnd: string | null
  categories: Record<RecordCategory, FootballRecordEntry[]>
  options: {
    seasons: string[]
    states: string[]
    leagues: Array<{ id: string; name: string }>
    grades: string[]
  }
}

export const recordLabels: Record<RecordCategory, string> = {
  highestScore: 'Highest score',
  lowestScore: 'Lowest score',
  lowestWinningScore: 'Lowest winning score',
  mostGoals: 'Most goals',
  mostBehinds: 'Most behinds',
  biggestMargin: 'Biggest margin',
  closestMatch: 'Closest match',
  highestCombinedScore: 'Highest combined score',
  lowestCombinedScore: 'Lowest combined score',
}

export const recordCategories: RecordCategory[] = [
  'highestScore',
  'biggestMargin',
  'mostGoals',
  'closestMatch',
  'lowestWinningScore',
  'highestCombinedScore',
  'lowestScore',
  'mostBehinds',
  'lowestCombinedScore',
]

export async function fetchFootballRecords(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value))
  })
  const response = await fetch(`/api/records?${search.toString()}`)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const payload = await response.json() as { data?: FootballRecordsPayload }
  if (!payload.data) throw new Error('Records response did not include data')
  return payload.data
}
