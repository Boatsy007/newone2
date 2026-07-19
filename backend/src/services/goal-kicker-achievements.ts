import type { Prisma } from '@prisma/client'

type AchievementInput = {
  playerId: string
  playerRowId: string
  playerName: string
  clubId: string | null
  clubName: string
  leagueId: string
  leagueName: string
  season: string
  grade: string
  previousGoals: number
  goals: number
  weeklyGoals: number
  previousMatches: number | null
  matches: number | null
}

type Achievement = {
  type: string
  title: string
  body: string
  label: string
  value: string
  qualifier: string
}

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
const rankFor = (rows: Array<{ playerId: string; goals: number }>, playerId: string, goals: number) =>
  1 + rows.filter(row => row.playerId !== playerId && row.goals > goals).length

export async function publishGoalKickerAchievements(tx: Prisma.TransactionClient, input: AchievementInput) {
  if (input.weeklyGoals <= 0) return { achievementsCreated: 0, feedEventsCreated: 0 }

  const [seasonRows, leagueRows, clubRows, careerRows, updateEvents] = await Promise.all([
    tx.footballGoalKicker.findMany({ where: { season: input.season, grade: input.grade }, select: { playerId: true, goals: true, matches: true } }),
    tx.footballGoalKicker.findMany({ where: { season: input.season, grade: input.grade, leagueId: input.leagueId }, select: { playerId: true, goals: true, matches: true } }),
    input.clubId ? tx.footballGoalKicker.findMany({ where: { season: input.season, grade: input.grade, clubId: input.clubId }, select: { playerId: true, goals: true, matches: true } }) : Promise.resolve([]),
    tx.footballGoalKicker.findMany({ where: { playerId: input.playerId, NOT: { id: input.playerRowId } }, select: { goals: true, season: true } }),
    tx.notification.findMany({ where: { type: 'GOAL_KICKER_UPDATED' }, orderBy: { createdAt: 'desc' }, take: 5000, select: { data: true } }),
  ])

  const achievements: Achievement[] = []
  const add = (achievement: Achievement) => achievements.push(achievement)
  for (const milestone of [50, 100] as const) {
    if (input.previousGoals < milestone && input.goals >= milestone) {
      add({ type: `SEASON_${milestone}_GOALS`, title: `${input.playerName} reaches ${milestone} goals`, body: `${input.playerName} has reached ${milestone} season goals for ${input.clubName}.`, label: `${milestone}-goal milestone`, value: `${input.goals} goals`, qualifier: String(milestone) })
      if (input.matches && input.matches > 0) {
        const fastest = seasonRows.filter(row => row.goals >= milestone && row.matches && row.matches > 0).every(row => row.playerId === input.playerId || input.matches! <= row.matches!)
        if (fastest) add({ type: `FASTEST_TO_${milestone}`, title: `${input.playerName} is fastest to ${milestone}`, body: `${input.playerName} reached ${milestone} goals in ${input.matches} matches.`, label: `Fastest to ${milestone}`, value: `${input.matches} matches`, qualifier: `${milestone}-${input.matches}` })
      }
    }
  }

  const currentNationalRank = rankFor(seasonRows, input.playerId, input.goals)
  const previousNationalRank = rankFor(seasonRows, input.playerId, input.previousGoals)
  if (currentNationalRank === 1 && previousNationalRank > 1) add({ type: 'NATIONAL_GOAL_LEADER', title: `${input.playerName} takes the national lead`, body: `${input.playerName} now leads PlayFooty with ${input.goals} goals.`, label: 'National goal leader', value: `${input.goals} goals`, qualifier: String(input.goals) })
  if (currentNationalRank <= 10 && previousNationalRank > 10) add({ type: 'NATIONAL_TOP_10', title: `${input.playerName} enters the national top 10`, body: `${input.playerName} has moved to #${currentNationalRank} nationally with ${input.goals} goals.`, label: 'National top 10', value: `#${currentNationalRank}`, qualifier: `${currentNationalRank}-${input.goals}` })

  const currentLeagueRank = rankFor(leagueRows, input.playerId, input.goals)
  const previousLeagueRank = rankFor(leagueRows, input.playerId, input.previousGoals)
  if (currentLeagueRank === 1 && previousLeagueRank > 1) add({ type: 'LEAGUE_GOAL_LEADER', title: `${input.playerName} takes the ${input.leagueName} lead`, body: `${input.playerName} now leads ${input.leagueName} with ${input.goals} goals.`, label: 'League goal leader', value: `${input.goals} goals`, qualifier: `${input.leagueId}-${input.goals}` })

  if (input.clubId) {
    const currentClubRank = rankFor(clubRows, input.playerId, input.goals)
    const previousClubRank = rankFor(clubRows, input.playerId, input.previousGoals)
    if (currentClubRank === 1 && previousClubRank > 1) add({ type: 'CLUB_GOAL_LEADER', title: `${input.playerName} takes ${input.clubName}'s lead`, body: `${input.playerName} is now ${input.clubName}'s leading goal kicker with ${input.goals} goals.`, label: 'Club goal leader', value: `${input.goals} goals`, qualifier: `${input.clubId}-${input.goals}` })
  }

  const previousCareerBest = careerRows.reduce((best, row) => Math.max(best, row.goals), 0)
  if (input.goals > previousCareerBest && input.previousGoals <= previousCareerBest && previousCareerBest > 0) add({ type: 'CAREER_BEST_SEASON', title: `${input.playerName} sets a new career best`, body: `${input.playerName}'s ${input.goals} goals is their best imported season total on PlayFooty.`, label: 'Career-best season', value: `${input.goals} goals`, qualifier: `${input.season}-${input.goals}` })

  let previousBiggest = 0
  for (const event of updateEvents) {
    try { const data = event.data ? JSON.parse(event.data) as { weeklyGoals?: number; playerId?: string; goals?: number } : {}; if (data.playerId !== input.playerId || data.goals !== input.goals) previousBiggest = Math.max(previousBiggest, Number(data.weeklyGoals) || 0) } catch { /* ignore malformed history */ }
  }
  if (input.weeklyGoals > previousBiggest) add({ type: 'BIGGEST_WEEKLY_GOAL_INCREASE', title: `${input.playerName} records the biggest weekly increase`, body: `${input.playerName} added ${input.weeklyGoals} goals in the latest approved update.`, label: 'Biggest weekly increase', value: `+${input.weeklyGoals}`, qualifier: `${input.goals}-${input.weeklyGoals}` })

  if (input.matches && input.matches > 0) {
    const currentGpg = input.goals / input.matches
    const previousGpg = input.previousMatches && input.previousMatches > 0 ? input.previousGoals / input.previousMatches : 0
    const bestOther = seasonRows.filter(row => row.playerId !== input.playerId && row.matches && row.matches > 0).reduce((best, row) => Math.max(best, row.goals / row.matches!), 0)
    if (currentGpg > bestOther && previousGpg <= bestOther) add({ type: 'GOALS_PER_GAME_LEADER', title: `${input.playerName} takes the goals-per-game lead`, body: `${input.playerName} now averages ${currentGpg.toFixed(2)} goals per match.`, label: 'Goals-per-game leader', value: currentGpg.toFixed(2), qualifier: `${input.goals}-${input.matches}` })
  }

  const playerUrl = `/player/${encodeURIComponent(input.playerRowId)}`
  const clubUrl = input.clubId ? `/team/${encodeURIComponent(input.clubId)}` : null
  const leagueUrl = `/league/${encodeURIComponent(input.leagueId)}`
  let achievementsCreated = 0
  let feedEventsCreated = 0

  for (const achievement of achievements) {
    const baseKey = `goal-achievement:${achievement.type}:${input.season}:${norm(input.grade)}:${input.playerId}:${norm(achievement.qualifier)}`
    const payload = { ...input, achievementType: achievement.type, achievementLabel: achievement.label, achievementValue: achievement.value, playerUrl, clubUrl, leagueUrl, shareCardType: 'GOAL_KICKER_ACHIEVEMENT' }
    const existing = await tx.notification.findUnique({ where: { dedupeKey: baseKey }, select: { id: true } })
    if (!existing) {
      await tx.notification.create({ data: { recipientScope: 'PLATFORM', type: 'GOAL_KICKER_ACHIEVEMENT', category: 'PLAYER', severity: 'SUCCESS', title: achievement.title, body: achievement.body, entityType: 'PLAYER', entityId: input.playerId, data: JSON.stringify(payload), status: 'DELIVERED', dedupeKey: baseKey } })
      achievementsCreated++
    }
    const targets = [
      { suffix: 'player-feed', entityType: 'PLAYER', entityId: input.playerId, href: playerUrl },
      ...(input.clubId ? [{ suffix: 'club-feed', entityType: 'CLUB', entityId: input.clubId, href: playerUrl }] : []),
      { suffix: 'league-feed', entityType: 'LEAGUE', entityId: input.leagueId, href: playerUrl },
    ]
    for (const target of targets) {
      const dedupeKey = `${baseKey}:${target.suffix}`
      const exists = await tx.notification.findUnique({ where: { dedupeKey }, select: { id: true } })
      if (exists) continue
      await tx.notification.create({ data: { recipientScope: 'PLATFORM', type: 'GOAL_KICKER_ACHIEVEMENT', category: 'FEED', severity: 'SUCCESS', title: achievement.title, body: achievement.body, entityType: target.entityType, entityId: target.entityId, data: JSON.stringify({ ...payload, href: target.href }), status: 'DELIVERED', dedupeKey } })
      feedEventsCreated++
    }
  }

  return { achievementsCreated, feedEventsCreated }
}
