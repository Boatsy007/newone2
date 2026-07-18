import { prisma } from '../db/client.js'

export type FeedEventInput = {
  type: string
  title: string
  body?: string
  entityType: 'LEAGUE' | 'CLUB' | 'PLAYER' | 'RESULT' | 'LADDER'
  entityId: string
  href: string
  dedupeKey: string
  data?: Record<string, unknown>
  createdAt?: Date
}

export async function persistFeedEvent(input: FeedEventInput): Promise<boolean> {
  const existing = await prisma.notification.findUnique({ where: { dedupeKey: input.dedupeKey }, select: { id: true } })
  if (existing) return false
  await prisma.notification.create({
    data: {
      recipientScope: 'PLATFORM',
      recipientId: null,
      type: input.type,
      category: 'FEED',
      severity: 'INFO',
      title: input.title,
      body: input.body ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      data: JSON.stringify({ ...(input.data ?? {}), href: input.href }),
      channel: 'IN_APP',
      status: 'DELIVERED',
      dedupeKey: input.dedupeKey,
      sentAt: input.createdAt ?? new Date(),
      createdAt: input.createdAt ?? new Date(),
    },
  })
  return true
}

function resultHeadline(homeName: string, homePoints: number, awayName: string, awayPoints: number) {
  if (homePoints === awayPoints) return `${homeName} drew with ${awayName}, ${homePoints}–${awayPoints}`
  return homePoints > awayPoints
    ? `${homeName} defeated ${awayName}, ${homePoints}–${awayPoints}`
    : `${awayName} defeated ${homeName}, ${awayPoints}–${homePoints}`
}

export async function emitApprovedResultEvents(input: {
  leagueId: string
  leagueName: string
  season: string
  grade: string
  rows: Array<{
    round?: number
    homeClubId: string
    awayClubId: string
    homeTeam: string
    awayTeam: string
    homeScore?: number
    awayScore?: number
  }>
}): Promise<number> {
  let created = 0
  for (const row of input.rows) {
    const round = row.round == null ? null : `Round ${row.round}`
    const result = await prisma.footballResult.findUnique({
      where: {
        leagueId_season_grade_round_homeName_awayName: {
          leagueId: input.leagueId,
          season: input.season,
          grade: input.grade,
          round,
          homeName: row.homeTeam,
          awayName: row.awayTeam,
        },
      },
      select: { id: true, updatedAt: true, homePoints: true, awayPoints: true },
    })
    if (!result) continue
    const title = resultHeadline(row.homeTeam, result.homePoints, row.awayTeam, result.awayPoints)
    const href = `/match/result/${result.id}?source=football`
    const data = {
      leagueId: input.leagueId,
      leagueName: input.leagueName,
      homeClubId: row.homeClubId,
      awayClubId: row.awayClubId,
      resultId: result.id,
      round,
      season: input.season,
      grade: input.grade,
    }
    const scopes = [
      { entityType: 'LEAGUE' as const, entityId: input.leagueId },
      { entityType: 'CLUB' as const, entityId: row.homeClubId },
      { entityType: 'CLUB' as const, entityId: row.awayClubId },
    ]
    for (const scope of scopes) {
      if (await persistFeedEvent({
        type: 'RESULT_POSTED',
        title,
        body: `${input.leagueName}${round ? ` · ${round}` : ''}`,
        entityType: scope.entityType,
        entityId: scope.entityId,
        href,
        dedupeKey: `feed:result:${result.id}:${scope.entityType}:${scope.entityId}`,
        data,
        createdAt: result.updatedAt,
      })) created += 1
    }
  }
  return created
}

export async function emitLadderEvents(input: {
  leagueId: string
  leagueName: string
  season: string
  grade: string
  before: Array<{ clubId: string | null; clubName: string; position: number }>
  after: Array<{ clubId: string | null; clubName: string; position: number; updatedAt: Date }>
}): Promise<number> {
  if (!input.after.length) return 0
  let created = 0
  const newest = input.after.reduce((latest, row) => row.updatedAt > latest ? row.updatedAt : latest, new Date(0))
  const version = newest.toISOString()
  if (await persistFeedEvent({
    type: 'LADDER_UPDATED',
    title: `${input.leagueName} ladder updated`,
    body: `${input.after.length} clubs ranked for ${input.season} ${input.grade}.`,
    entityType: 'LEAGUE',
    entityId: input.leagueId,
    href: `/league/${input.leagueId}`,
    dedupeKey: `feed:ladder:${input.leagueId}:${input.season}:${input.grade}:${version}`,
    data: { leagueId: input.leagueId, season: input.season, grade: input.grade },
    createdAt: newest,
  })) created += 1

  const previous = new Map(input.before.map(row => [row.clubId || row.clubName.toLowerCase(), row.position]))
  for (const row of input.after) {
    const key = row.clubId || row.clubName.toLowerCase()
    const oldPosition = previous.get(key)
    if (!row.clubId || oldPosition == null || oldPosition === row.position) continue
    const movedUp = row.position < oldPosition
    if (await persistFeedEvent({
      type: 'LADDER_MOVEMENT',
      title: `${row.clubName} moved to ${ordinal(row.position)} on the ladder`,
      body: movedUp
        ? `${row.clubName} climbed ${oldPosition - row.position} position${oldPosition - row.position === 1 ? '' : 's'}.`
        : `${row.clubName} dropped ${row.position - oldPosition} position${row.position - oldPosition === 1 ? '' : 's'}.`,
      entityType: 'CLUB',
      entityId: row.clubId,
      href: `/league/${input.leagueId}`,
      dedupeKey: `feed:ladder-movement:${input.leagueId}:${input.season}:${input.grade}:${row.clubId}:${oldPosition}:${row.position}:${version}`,
      data: { leagueId: input.leagueId, clubId: row.clubId, oldPosition, newPosition: row.position },
      createdAt: row.updatedAt,
    })) created += 1
  }
  return created
}

function ordinal(value: number) {
  const mod100 = value % 100
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`
  if (value % 10 === 1) return `${value}st`
  if (value % 10 === 2) return `${value}nd`
  if (value % 10 === 3) return `${value}rd`
  return `${value}th`
}
