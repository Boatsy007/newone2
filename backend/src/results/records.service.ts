import { prisma } from '../db/client.js'

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

export type FootballRecordsResponse = {
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

type Query = {
  period?: RecordPeriod
  season?: string
  state?: string
  leagueId?: string
  grade?: string
  limit?: number
  now?: Date
}

type PublicResult = Awaited<ReturnType<typeof loadResults>>[number]

const categoryOrder: RecordCategory[] = [
  'highestScore',
  'lowestScore',
  'lowestWinningScore',
  'mostGoals',
  'mostBehinds',
  'biggestMargin',
  'closestMatch',
  'highestCombinedScore',
  'lowestCombinedScore',
]

function australianWeek(now: Date) {
  const offsetMs = 10 * 60 * 60 * 1000
  const local = new Date(now.getTime() + offsetMs)
  const day = local.getUTCDay()
  const daysSinceMonday = (day + 6) % 7
  const startLocal = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysSinceMonday, 0, 0, 0, 0))
  const endLocal = new Date(startLocal.getTime() + 7 * 86400000)
  return {
    start: new Date(startLocal.getTime() - offsetMs),
    end: new Date(endLocal.getTime() - offsetMs),
  }
}

async function loadResults(query: Query) {
  const now = query.now ?? new Date()
  const week = australianWeek(now)
  return prisma.footballResult.findMany({
    where: {
      published: true,
      ...(query.season ? { season: query.season } : {}),
      ...(query.grade ? { grade: query.grade } : {}),
      ...(query.leagueId ? { leagueId: query.leagueId } : {}),
      ...(query.state ? { league: { state: { code: query.state } } } : {}),
      ...(query.period === 'week' ? { matchDate: { gte: week.start, lt: week.end } } : {}),
    },
    include: { league: { include: { state: true } } },
    orderBy: [{ matchDate: 'desc' }, { round: 'desc' }],
    take: 10000,
  })
}

function baseEntry(result: PublicResult, side: 'home' | 'away', category: RecordCategory, value: number, valueLabel: string): Omit<FootballRecordEntry, 'rank'> {
  const isHome = side === 'home'
  const clubId = isHome ? result.homeClubId : result.awayClubId
  const clubName = isHome ? result.homeName : result.awayName
  const opponentId = isHome ? result.awayClubId : result.homeClubId
  const opponentName = isHome ? result.awayName : result.homeName
  return {
    category,
    value,
    valueLabel,
    resultId: result.id,
    matchUrl: `/match/result/${encodeURIComponent(result.id)}?source=football`,
    leagueId: result.leagueId,
    leagueName: result.league.name,
    leagueUrl: `/league/${encodeURIComponent(result.leagueId)}`,
    state: result.league.state.code,
    season: result.season,
    grade: result.grade,
    round: result.round,
    matchDate: result.matchDate?.toISOString() ?? null,
    clubId,
    clubName,
    clubUrl: clubId ? `/team/${encodeURIComponent(clubId)}` : null,
    opponentId,
    opponentName,
    homeName: result.homeName,
    awayName: result.awayName,
    homePoints: result.homePoints,
    awayPoints: result.awayPoints,
    homeGoals: result.homeGoals,
    awayGoals: result.awayGoals,
    margin: Math.abs(result.homePoints - result.awayPoints),
  }
}

function matchEntry(result: PublicResult, category: RecordCategory, value: number, valueLabel: string, preferredSide: 'home' | 'away' = 'home') {
  return baseEntry(result, preferredSide, category, value, valueLabel)
}

function rank(entries: Array<Omit<FootballRecordEntry, 'rank'>>, limit: number, direction: 'asc' | 'desc' = 'desc') {
  return entries
    .sort((a, b) => direction === 'desc' ? b.value - a.value : a.value - b.value)
    .slice(0, limit)
    .map((entry, index) => ({ ...entry, rank: index + 1 }))
}

export async function getFootballRecords(query: Query = {}): Promise<FootballRecordsResponse> {
  const period: RecordPeriod = query.period === 'week' ? 'week' : 'season'
  const limit = Math.max(1, Math.min(query.limit ?? 5, 20))
  const now = query.now ?? new Date()
  const week = australianWeek(now)
  const rows = await loadResults({ ...query, period, now })

  const teamSides = rows.flatMap(result => [
    { result, side: 'home' as const, points: result.homePoints, goals: result.homeGoals, behinds: result.homeBehinds, won: result.homePoints > result.awayPoints },
    { result, side: 'away' as const, points: result.awayPoints, goals: result.awayGoals, behinds: result.awayBehinds, won: result.awayPoints > result.homePoints },
  ])

  const categories = {} as Record<RecordCategory, FootballRecordEntry[]>
  categories.highestScore = rank(teamSides.map(row => baseEntry(row.result, row.side, 'highestScore', row.points, `${row.points} points`)), limit)
  categories.lowestScore = rank(teamSides.map(row => baseEntry(row.result, row.side, 'lowestScore', row.points, `${row.points} points`)), limit, 'asc')
  categories.lowestWinningScore = rank(teamSides.filter(row => row.won).map(row => baseEntry(row.result, row.side, 'lowestWinningScore', row.points, `${row.points} points`)), limit, 'asc')
  categories.mostGoals = rank(teamSides.map(row => baseEntry(row.result, row.side, 'mostGoals', row.goals, `${row.goals} goals`)), limit)
  categories.mostBehinds = rank(teamSides.map(row => baseEntry(row.result, row.side, 'mostBehinds', row.behinds, `${row.behinds} behinds`)), limit)

  const nonDraws = rows.filter(row => row.homePoints !== row.awayPoints)
  categories.biggestMargin = rank(nonDraws.map(row => {
    const side = row.homePoints > row.awayPoints ? 'home' : 'away'
    const margin = Math.abs(row.homePoints - row.awayPoints)
    return matchEntry(row, 'biggestMargin', margin, `${margin} points`, side)
  }), limit)
  categories.closestMatch = rank(nonDraws.map(row => {
    const side = row.homePoints > row.awayPoints ? 'home' : 'away'
    const margin = Math.abs(row.homePoints - row.awayPoints)
    return matchEntry(row, 'closestMatch', margin, `${margin} point${margin === 1 ? '' : 's'}`, side)
  }), limit, 'asc')
  categories.highestCombinedScore = rank(rows.map(row => {
    const total = row.homePoints + row.awayPoints
    return matchEntry(row, 'highestCombinedScore', total, `${total} combined points`)
  }), limit)
  categories.lowestCombinedScore = rank(rows.map(row => {
    const total = row.homePoints + row.awayPoints
    return matchEntry(row, 'lowestCombinedScore', total, `${total} combined points`)
  }), limit, 'asc')

  for (const category of categoryOrder) categories[category] ??= []

  const optionRows = await prisma.footballResult.findMany({
    where: { published: true },
    include: { league: { include: { state: true } } },
    select: {
      season: true,
      grade: true,
      leagueId: true,
      league: { select: { name: true, state: { select: { code: true } } } },
    },
    take: 10000,
  })

  const leagueMap = new Map<string, string>()
  optionRows.forEach(row => leagueMap.set(row.leagueId, row.league.name))

  return {
    period,
    generatedAt: now.toISOString(),
    weekStart: period === 'week' ? week.start.toISOString() : null,
    weekEnd: period === 'week' ? week.end.toISOString() : null,
    categories,
    options: {
      seasons: [...new Set(optionRows.map(row => row.season))].sort().reverse(),
      states: [...new Set(optionRows.map(row => row.league.state.code))].sort(),
      leagues: [...leagueMap.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      grades: [...new Set(optionRows.map(row => row.grade))].sort(),
    },
  }
}
