import test from 'node:test'
import assert from 'node:assert/strict'
import { planGoalKickerUpdate, type GoalKickerCandidate } from './goal-kicker-update-plan.js'
import { publishGoalKickerUpdateEvents } from './goal-kicker-update-events.js'

const playerId = '11111111-1111-4111-8111-111111111111'
const rowId = '22222222-2222-4222-8222-222222222222'
const duplicateRowId = '33333333-3333-4333-8333-333333333333'

function candidate(goals: number, matches: number | null, id = rowId): GoalKickerCandidate {
  return { id, playerId, goals, matches, importedAt: new Date('2026-07-19T00:00:00Z') }
}

test('85 to 92 preserves one canonical row and records a +7 change', () => {
  const plan = planGoalKickerUpdate({
    candidates: [candidate(85, 12)],
    requestedPlayerId: playerId,
    generatedPlayerId: '44444444-4444-4444-8444-444444444444',
    generatedRowId: '55555555-5555-4555-8555-555555555555',
    incomingGoals: 92,
    incomingMatches: 13,
  })

  assert.equal(plan.canonicalId, rowId)
  assert.equal(plan.canonicalPlayerId, playerId)
  assert.equal(plan.savedGoals, 92)
  assert.equal(plan.savedMatches, 13)
  assert.equal(plan.weeklyGoals, 7)
  assert.equal(plan.matchesAdded, 1)
  assert.deepEqual(plan.duplicateIds, [])
  assert.equal(plan.staleIncomingTotal, false)
  assert.equal(plan.unchanged, false)
})

test('reimporting 92 is idempotent', () => {
  const plan = planGoalKickerUpdate({
    candidates: [candidate(92, 13)],
    requestedPlayerId: playerId,
    generatedPlayerId: '44444444-4444-4444-8444-444444444444',
    generatedRowId: '55555555-5555-4555-8555-555555555555',
    incomingGoals: 92,
    incomingMatches: 13,
  })

  assert.equal(plan.savedGoals, 92)
  assert.equal(plan.weeklyGoals, 0)
  assert.equal(plan.staleIncomingTotal, false)
  assert.equal(plan.unchanged, true)
})

test('an older 85 screenshot cannot reduce 92', () => {
  const plan = planGoalKickerUpdate({
    candidates: [candidate(92, 13)],
    requestedPlayerId: playerId,
    generatedPlayerId: '44444444-4444-4444-8444-444444444444',
    generatedRowId: '55555555-5555-4555-8555-555555555555',
    incomingGoals: 85,
    incomingMatches: 12,
  })

  assert.equal(plan.savedGoals, 92)
  assert.equal(plan.savedMatches, 13)
  assert.equal(plan.weeklyGoals, 0)
  assert.equal(plan.staleIncomingTotal, true)
})

test('duplicate historical rows collapse into the highest canonical row', () => {
  const plan = planGoalKickerUpdate({
    candidates: [candidate(92, 13), candidate(85, 12, duplicateRowId)],
    requestedPlayerId: playerId,
    generatedPlayerId: '44444444-4444-4444-8444-444444444444',
    generatedRowId: '55555555-5555-4555-8555-555555555555',
    incomingGoals: 92,
    incomingMatches: 13,
  })

  assert.equal(plan.canonicalId, rowId)
  assert.deepEqual(plan.duplicateIds, [duplicateRowId])
  assert.equal(plan.savedGoals, 92)
})

test('a +7 update publishes one history event and three supporter feed events exactly once', async () => {
  const rows = new Map<string, { id: string }>()
  let sequence = 0
  const tx = {
    notification: {
      findUnique: async ({ where }: { where: { dedupeKey: string } }) => rows.get(where.dedupeKey) ?? null,
      create: async ({ data }: { data: { dedupeKey: string } }) => {
        const saved = { id: `notification-${++sequence}` }
        rows.set(data.dedupeKey, saved)
        return saved
      },
    },
  }
  const input = {
    playerId,
    playerRowId: rowId,
    playerName: 'Matt Hammelmann',
    clubId: '66666666-6666-4666-8666-666666666666',
    clubName: 'Redland Victoria Point',
    leagueId: '77777777-7777-4777-8777-777777777777',
    leagueName: 'QAFL',
    season: '2026',
    grade: 'Senior Football',
    previousGoals: 85,
    goals: 92,
    weeklyGoals: 7,
    previousMatches: 12,
    matches: 13,
    matchesAdded: 1,
  }

  const first = await publishGoalKickerUpdateEvents(tx as never, input)
  const second = await publishGoalKickerUpdateEvents(tx as never, input)

  assert.deepEqual(first, { historyCreated: true, feedEventsCreated: 3 })
  assert.deepEqual(second, { historyCreated: false, feedEventsCreated: 0 })
  assert.equal(rows.size, 4)
})
