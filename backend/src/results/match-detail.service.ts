import { prisma } from '../db/client.js'

export type MatchPlayerInput = { playerName: string; playerId?: string | null }
export type MatchGoalKickerInput = MatchPlayerInput & { goals: number }
export type MatchDetailInput = {
  homeQuarterScores?: Array<string | null>
  awayQuarterScores?: Array<string | null>
  homeBestPlayers?: string[]
  awayBestPlayers?: string[]
  homeGoalKickers?: MatchGoalKickerInput[]
  awayGoalKickers?: MatchGoalKickerInput[]
  notes?: string | null
  sourceImageUrl?: string | null
}

let ready: Promise<void> | null = null
export function ensureMatchDetailTable() {
  if (!ready) ready = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS football_match_details (
        result_id text PRIMARY KEY,
        home_quarter_scores jsonb NOT NULL DEFAULT '[]'::jsonb,
        away_quarter_scores jsonb NOT NULL DEFAULT '[]'::jsonb,
        home_best_players jsonb NOT NULL DEFAULT '[]'::jsonb,
        away_best_players jsonb NOT NULL DEFAULT '[]'::jsonb,
        home_goal_kickers jsonb NOT NULL DEFAULT '[]'::jsonb,
        away_goal_kickers jsonb NOT NULL DEFAULT '[]'::jsonb,
        notes text NULL,
        source_image_url text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `)
  })().catch(error => { ready = null; throw error })
  return ready
}

const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '')
function cleanStrings(values: unknown): string[] {
  return Array.isArray(values) ? values.map(value => String(value ?? '').trim()).filter(Boolean).slice(0, 30) : []
}
function cleanQuarters(values: unknown): Array<string | null> {
  const rows = Array.isArray(values) ? values.slice(0, 4) : []
  return Array.from({ length: 4 }, (_, index) => {
    const value = String(rows[index] ?? '').trim()
    return value || null
  })
}
function cleanKickers(values: unknown): MatchGoalKickerInput[] {
  if (!Array.isArray(values)) return []
  return values.flatMap(value => {
    const row = value as Record<string, unknown>
    const playerName = String(row?.playerName ?? '').trim()
    const goals = Number(row?.goals)
    if (!playerName || !Number.isFinite(goals) || goals < 0) return []
    return [{ playerName, goals: Math.floor(goals), playerId: row?.playerId ? String(row.playerId) : null }]
  }).slice(0, 40)
}

type Candidate = { id: string; playerId: string | null; playerName: string }
function linkPlayers<T extends MatchPlayerInput>(rows: T[], candidates: Candidate[]): T[] {
  return rows.map(row => {
    if (row.playerId) return row
    const key = normalise(row.playerName)
    const exact = candidates.find(candidate => normalise(candidate.playerName) === key)
    if (!exact) return row
    return { ...row, playerId: exact.id }
  })
}

export async function saveMatchDetail(resultId: string, input: MatchDetailInput) {
  await ensureMatchDetailTable()
  const result = await prisma.footballResult.findUnique({
    where: { id: resultId },
    select: { homeClubId: true, awayClubId: true, season: true, leagueId: true },
  })
  if (!result) throw new Error('Result not found')

  const clubIds = [result.homeClubId, result.awayClubId].filter((value): value is string => Boolean(value))
  const candidates = clubIds.length ? await prisma.footballGoalKicker.findMany({
    where: { leagueId: result.leagueId, season: result.season, clubId: { in: clubIds } },
    select: { id: true, playerId: true, playerName: true, clubId: true },
    take: 2000,
  }) : []
  const homeCandidates = candidates.filter(row => row.clubId === result.homeClubId)
  const awayCandidates = candidates.filter(row => row.clubId === result.awayClubId)

  const homeQuarterScores = cleanQuarters(input.homeQuarterScores)
  const awayQuarterScores = cleanQuarters(input.awayQuarterScores)
  const homeBestPlayers = cleanStrings(input.homeBestPlayers)
  const awayBestPlayers = cleanStrings(input.awayBestPlayers)
  const homeGoalKickers = linkPlayers(cleanKickers(input.homeGoalKickers), homeCandidates)
  const awayGoalKickers = linkPlayers(cleanKickers(input.awayGoalKickers), awayCandidates)
  const notes = String(input.notes ?? '').trim().slice(0, 5000) || null
  const sourceImageUrl = String(input.sourceImageUrl ?? '').trim().slice(0, 2000) || null
  await prisma.$executeRawUnsafe(`
    INSERT INTO football_match_details (
      result_id, home_quarter_scores, away_quarter_scores, home_best_players, away_best_players,
      home_goal_kickers, away_goal_kickers, notes, source_image_url, updated_at
    ) VALUES ($1,$2::jsonb,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,now())
    ON CONFLICT (result_id) DO UPDATE SET
      home_quarter_scores=EXCLUDED.home_quarter_scores,
      away_quarter_scores=EXCLUDED.away_quarter_scores,
      home_best_players=EXCLUDED.home_best_players,
      away_best_players=EXCLUDED.away_best_players,
      home_goal_kickers=EXCLUDED.home_goal_kickers,
      away_goal_kickers=EXCLUDED.away_goal_kickers,
      notes=EXCLUDED.notes,
      source_image_url=EXCLUDED.source_image_url,
      updated_at=now()
  `, resultId, JSON.stringify(homeQuarterScores), JSON.stringify(awayQuarterScores), JSON.stringify(homeBestPlayers), JSON.stringify(awayBestPlayers), JSON.stringify(homeGoalKickers), JSON.stringify(awayGoalKickers), notes, sourceImageUrl)
  return { homeQuarterScores, awayQuarterScores, homeBestPlayers, awayBestPlayers, homeGoalKickers, awayGoalKickers, notes, sourceImageUrl }
}

export async function loadMatchDetail(resultId: string) {
  await ensureMatchDetailTable()
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
    SELECT result_id AS "resultId", home_quarter_scores AS "homeQuarterScores", away_quarter_scores AS "awayQuarterScores",
      home_best_players AS "homeBestPlayers", away_best_players AS "awayBestPlayers",
      home_goal_kickers AS "homeGoalKickers", away_goal_kickers AS "awayGoalKickers",
      notes, source_image_url AS "sourceImageUrl", updated_at AS "detailUpdatedAt"
    FROM football_match_details WHERE result_id=$1 LIMIT 1
  `, resultId)
  return rows[0] ?? null
}
