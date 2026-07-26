type RankingLogoRow = { clubId: string; clubName?: string; logoUrl?: string | null }
type GoalKickerLogoRow = {
  playerId: string
  playerName: string
  clubId: string | null
  clubName: string
  clubLogoUrl: string | null
  leagueName: string
}

type RankingsPayload = { data?: RankingLogoRow[] }
type GoalKickersPayload = { data?: GoalKickerLogoRow[] }

type PlayerLogo = { clubId: string | null; clubName: string; leagueName: string; logoUrl: string | null }

export type HomeCardLogoMaps = {
  byClubId: Map<string, string>
  byClubName: Map<string, string>
  byPlayerId: Map<string, PlayerLogo>
  byPlayerClubLeague: Map<string, PlayerLogo>
}

function normalise(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(seniors?|senior men|a grade|football club|fc)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function clubNameLogoKey(clubName: string) {
  return normalise(clubName)
}

export function playerClubLeagueKey(playerName: string, clubName: string, leagueName: string) {
  return `${normalise(playerName)}|${normalise(clubName)}|${normalise(leagueName)}`
}

export async function loadHomeCardLogoMaps(): Promise<HomeCardLogoMaps> {
  const [rankingsResult, goalKickersResult] = await Promise.allSettled([
    fetch('/api/rankings').then(response => response.ok ? response.json() as Promise<RankingsPayload> : Promise.reject(new Error(`HTTP ${response.status}`))),
    fetch('/api/goal-kickers?mode=raw&limit=1000').then(response => response.ok ? response.json() as Promise<GoalKickersPayload> : Promise.reject(new Error(`HTTP ${response.status}`))),
  ])

  const byClubId = new Map<string, string>()
  const byClubName = new Map<string, string>()
  const byPlayerId = new Map<string, PlayerLogo>()
  const byPlayerClubLeague = new Map<string, PlayerLogo>()

  if (rankingsResult.status === 'fulfilled') {
    for (const row of rankingsResult.value.data ?? []) {
      if (!row.logoUrl) continue
      if (row.clubId) byClubId.set(row.clubId, row.logoUrl)
      if (row.clubName) byClubName.set(clubNameLogoKey(row.clubName), row.logoUrl)
    }
  }

  if (goalKickersResult.status === 'fulfilled') {
    for (const row of goalKickersResult.value.data ?? []) {
      if (row.clubLogoUrl) {
        if (row.clubId && !byClubId.has(row.clubId)) byClubId.set(row.clubId, row.clubLogoUrl)
        const nameKey = clubNameLogoKey(row.clubName)
        if (nameKey && !byClubName.has(nameKey)) byClubName.set(nameKey, row.clubLogoUrl)
      }
      const resolved: PlayerLogo = {
        clubId: row.clubId,
        clubName: row.clubName,
        leagueName: row.leagueName,
        logoUrl: row.clubLogoUrl ?? (row.clubId ? byClubId.get(row.clubId) ?? null : null) ?? byClubName.get(clubNameLogoKey(row.clubName)) ?? null,
      }
      if (row.playerId && !byPlayerId.has(row.playerId)) byPlayerId.set(row.playerId, resolved)
      const exactKey = playerClubLeagueKey(row.playerName, row.clubName, row.leagueName)
      if (!byPlayerClubLeague.has(exactKey)) byPlayerClubLeague.set(exactKey, resolved)
    }
  }

  return { byClubId, byClubName, byPlayerId, byPlayerClubLeague }
}
