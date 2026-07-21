export type RankingEffectReport = {
  recalculated: boolean
  clubsRanked: number
  affectedClubs: number
  rankingChanges: number
  notificationsCreated: number
  notificationsSuppressed: number
  notificationDuplicates: number
  error: string | null
}

/**
 * Approved result imports deliberately do not recalculate the national rankings.
 *
 * Match screenshots are commonly uploaded one round or one image at a time, so
 * the stored result history can be incomplete during an import session. Running
 * a national recalculation at that point caused partial results to distort club
 * ratings and ranks even though the published ladder remained correct.
 *
 * Results continue to feed Match Centre, recent form, records, feeds and other
 * result-derived views. National rankings are recalculated only through the
 * explicit full-ranking workflow after the league ladder/data has been checked.
 */
export async function processApprovedResultEffects(input: {
  leagueId: string
  leagueName: string
  season: string
  clubIds: string[]
}): Promise<RankingEffectReport> {
  const affectedClubs = new Set(input.clubIds.filter(Boolean)).size

  return {
    recalculated: false,
    clubsRanked: 0,
    affectedClubs,
    rankingChanges: 0,
    notificationsCreated: 0,
    notificationsSuppressed: 0,
    notificationDuplicates: 0,
    error: null,
  }
}
