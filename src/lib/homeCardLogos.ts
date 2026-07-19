type RankingLogoRow = { clubId: string; clubName?: string; logoUrl?: string | null }
type GoalKickerLogoRow = { playerId: string; clubId: string | null; clubName: string; clubLogoUrl: string | null }

type RankingsPayload = { data?: RankingLogoRow[] }
type GoalKickersPayload = { data?: GoalKickerLogoRow[] }

export type HomeCardLogoMaps = {
  byClubId: Map<string, string>
  byPlayerId: Map<string, { clubId: string | null; clubName: string; logoUrl: string | null }>
}

export async function loadHomeCardLogoMaps(): Promise<HomeCardLogoMaps> {
  const [rankingsResult, goalKickersResult] = await Promise.allSettled([
    fetch('/api/rankings').then(response => response.ok ? response.json() as Promise<RankingsPayload> : Promise.reject(new Error(`HTTP ${response.status}`))),
    fetch('/api/goal-kickers?mode=raw&limit=1000').then(response => response.ok ? response.json() as Promise<GoalKickersPayload> : Promise.reject(new Error(`HTTP ${response.status}`))),
  ])

  const byClubId = new Map<string, string>()
  const byPlayerId = new Map<string, { clubId: string | null; clubName: string; logoUrl: string | null }>()

  if (rankingsResult.status === 'fulfilled') {
    for (const row of rankingsResult.value.data ?? []) {
      if (row.clubId && row.logoUrl) byClubId.set(row.clubId, row.logoUrl)
    }
  }

  if (goalKickersResult.status === 'fulfilled') {
    for (const row of goalKickersResult.value.data ?? []) {
      if (row.clubId && row.clubLogoUrl && !byClubId.has(row.clubId)) byClubId.set(row.clubId, row.clubLogoUrl)
      if (!byPlayerId.has(row.playerId)) {
        byPlayerId.set(row.playerId, { clubId: row.clubId, clubName: row.clubName, logoUrl: row.clubLogoUrl })
      }
    }
  }

  return { byClubId, byPlayerId }
}
