export type GoalKickerCandidate = {
  id: string
  playerId: string
  goals: number
  matches: number | null
  importedAt: Date
}

export type GoalKickerUpdatePlan = {
  canonical: GoalKickerCandidate | null
  canonicalPlayerId: string
  canonicalId: string
  currentGoals: number | null
  currentMatches: number | null
  previousGoals: number | null
  previousMatches: number | null
  savedGoals: number
  savedMatches: number | null
  duplicateIds: string[]
  weeklyGoals: number
  matchesAdded: number | null
  staleIncomingTotal: boolean
  unchanged: boolean
}

export function planGoalKickerUpdate(input: {
  candidates: GoalKickerCandidate[]
  requestedPlayerId: string | null
  generatedPlayerId: string
  generatedRowId: string
  incomingGoals: number
  incomingMatches: number | null
}): GoalKickerUpdatePlan {
  const canonical = (input.requestedPlayerId
    ? input.candidates.find(row => row.playerId === input.requestedPlayerId)
    : null) ?? input.candidates[0] ?? null

  const canonicalPlayerId = canonical?.playerId ?? input.requestedPlayerId ?? input.generatedPlayerId
  const canonicalId = canonical?.id ?? input.generatedRowId
  const currentGoals = canonical?.goals ?? null
  const currentMatches = canonical?.matches ?? null
  const lowerPrevious = input.candidates.find(row => row.goals < input.incomingGoals)
  const previousGoals = lowerPrevious?.goals ?? currentGoals
  const previousMatches = lowerPrevious?.matches ?? currentMatches
  const savedGoals = currentGoals == null ? input.incomingGoals : Math.max(currentGoals, input.incomingGoals)
  const savedMatches = input.incomingMatches == null
    ? currentMatches
    : currentMatches == null
      ? input.incomingMatches
      : Math.max(currentMatches, input.incomingMatches)
  const duplicateIds = input.candidates.filter(row => row.id !== canonicalId).map(row => row.id)
  const weeklyGoals = previousGoals == null ? 0 : Math.max(0, savedGoals - previousGoals)
  const matchesAdded = previousMatches != null && savedMatches != null ? Math.max(0, savedMatches - previousMatches) : null

  return {
    canonical,
    canonicalPlayerId,
    canonicalId,
    currentGoals,
    currentMatches,
    previousGoals,
    previousMatches,
    savedGoals,
    savedMatches,
    duplicateIds,
    weeklyGoals,
    matchesAdded,
    staleIncomingTotal: currentGoals != null && input.incomingGoals < currentGoals,
    unchanged: currentGoals === savedGoals && duplicateIds.length === 0,
  }
}
