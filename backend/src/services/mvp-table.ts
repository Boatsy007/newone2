import { prisma } from '../db/client.js'

export type MvpRow = {
  id: string
  playerId: string | null
  playerName: string
  clubId: string | null
  clubName: string
  clubLogoUrl: string | null
  leagueId: string
  leagueName: string
  state: string | null
  season: string
  grade: string
  bp: number
  gamesPlayed: number | null
  leagueStars: number
  strengthFactor: number
  mvpPoints: number
  importedAt: Date
}

export function leagueStars(value: number | null | undefined) {
  return Math.min(5, Math.max(1, Math.round(Number(value) || 3)))
}

export function strengthFactor(stars: number) {
  return Math.min(1, Math.max(0.6, 0.5 + (stars * 0.1)))
}

export function calculateMvpPoints(bp: number, stars: number) {
  return Math.ceil(Math.max(0, Math.trunc(bp)) * 3 * strengthFactor(stars))
}

export async function ensureMvpTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS football_mvp_entries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      player_id text NULL,
      player_name text NOT NULL,
      club_id text NULL,
      club_name text NOT NULL,
      league_id text NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
      league_name text NOT NULL,
      season text NOT NULL,
      grade text NOT NULL DEFAULT 'Senior Football',
      bp integer NOT NULL DEFAULT 0,
      games_played integer NULL,
      league_stars integer NOT NULL DEFAULT 3,
      strength_factor double precision NOT NULL DEFAULT 0.8,
      mvp_points integer NOT NULL DEFAULT 0,
      source_type text NOT NULL DEFAULT 'OCR_UPLOAD',
      imported_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS football_mvp_entries_identity ON football_mvp_entries (league_id, season, grade, lower(player_name), COALESCE(club_id, lower(club_name)))`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS football_mvp_entries_leaderboard ON football_mvp_entries (season, mvp_points DESC, bp DESC)`)
}

export async function refreshMvpScores(season?: string) {
  await ensureMvpTable()
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; bp: number; leagueRating: number }>>(`
    SELECT m.id, m.bp, l."finalStrengthRating" AS "leagueRating"
    FROM football_mvp_entries m
    JOIN leagues l ON l.id = m.league_id
    ${season ? `WHERE m.season = $1` : ''}
  `, ...(season ? [season] : []))
  for (const row of rows) {
    const stars = leagueStars(row.leagueRating)
    const factor = strengthFactor(stars)
    const points = calculateMvpPoints(row.bp, stars)
    await prisma.$executeRawUnsafe(`UPDATE football_mvp_entries SET league_stars=$2, strength_factor=$3, mvp_points=$4, updated_at=now() WHERE id=$1`, row.id, stars, factor, points)
  }
  return rows.length
}

export async function listMvpEntries(options: { season?: string; limit?: number; leagueId?: string; clubId?: string } = {}) {
  await ensureMvpTable()
  await refreshMvpScores(options.season)
  const season = options.season ?? new Date().getFullYear().toString()
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 1000)
  const params: unknown[] = [season]
  let filters = ''
  if (options.leagueId) { params.push(options.leagueId); filters += ` AND m.league_id = $${params.length}` }
  if (options.clubId) { params.push(options.clubId); filters += ` AND m.club_id = $${params.length}` }
  params.push(limit)
  const rows = await prisma.$queryRawUnsafe<MvpRow[]>(`
    SELECT
      m.id,
      m.player_id AS "playerId",
      m.player_name AS "playerName",
      m.club_id AS "clubId",
      m.club_name AS "clubName",
      c."logoUrl" AS "clubLogoUrl",
      m.league_id AS "leagueId",
      m.league_name AS "leagueName",
      s.code AS state,
      m.season,
      m.grade,
      m.bp,
      m.games_played AS "gamesPlayed",
      m.league_stars AS "leagueStars",
      m.strength_factor AS "strengthFactor",
      m.mvp_points AS "mvpPoints",
      m.imported_at AS "importedAt"
    FROM football_mvp_entries m
    LEFT JOIN clubs c ON c.id = m.club_id
    LEFT JOIN states s ON s.id = c."stateId"
    WHERE m.season = $1${filters}
    ORDER BY m.mvp_points DESC, m.bp DESC, m.games_played ASC NULLS LAST, m.player_name ASC
    LIMIT $${params.length}
  `, ...params)
  return rows.map((row, index) => ({ ...row, rank: index + 1 }))
}
