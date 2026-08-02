import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, membershipForClub, requireActiveClubMembership, roleCan } from '../../auth/club-auth.js'

const router = Router()
const GAME_THRESHOLDS = [1, 50, 100, 150, 200, 250, 300]
const GOAL_THRESHOLDS = [50, 100, 250, 500]
let ready: Promise<void> | null = null

function ensureTable() {
  if (!ready) ready = prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS club_milestones (
      id text PRIMARY KEY,
      club_id text NOT NULL,
      club_player_id text,
      player_id text,
      player_name text NOT NULL,
      milestone_type text NOT NULL,
      milestone_value integer,
      title text NOT NULL,
      status text NOT NULL DEFAULT 'CONFIRMED',
      source text NOT NULL DEFAULT 'MANUAL',
      source_entity_id text,
      occurred_on date,
      photo_asset_id text,
      generated_asset_id text,
      notes text,
      created_by text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      archived_at timestamptz
    )
  `).then(async () => {
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS club_milestones_club_idx ON club_milestones(club_id, created_at DESC)`)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS club_milestones_unique_confirmed ON club_milestones(club_id, coalesce(club_player_id,''), milestone_type, coalesce(milestone_value,0)) WHERE archived_at IS NULL`)
  }).catch(error => { ready = null; throw error })
  return ready
}

async function requireMediaPermission(req: any, res: any, next: any) {
  const membership = res.locals.clubMembership as Awaited<ReturnType<typeof membershipForClub>>
  if (!membership || !roleCan(membership.role, 'media')) return res.status(403).json({ error: 'Your club role cannot manage milestone media' })
  next()
}

const text = (value: unknown, max = 180) => String(value ?? '').trim().slice(0, max)
const number = (value: unknown) => { const n = Number(value); return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null }

router.use(authenticateClubUser)
router.use('/clubs/:clubId', requireActiveClubMembership, requireMediaPermission)

router.get('/clubs/:clubId', async (req, res) => {
  try {
    await ensureTable()
    const clubId = req.params.clubId
    const players = await prisma.$queryRawUnsafe<Array<{ clubPlayerId:string; playerId:string|null; playerName:string; jumperNumber:number|null }>>(`
      SELECT id::text AS "clubPlayerId", player_id AS "playerId", player_name AS "playerName", jumper_number AS "jumperNumber"
      FROM football_club_players WHERE club_id=$1 AND active=true ORDER BY player_name
    `, clubId).catch(() => [])

    const latestPublished = await prisma.$queryRawUnsafe<Array<{ id:string }>>(`
      SELECT id::text AS id FROM football_team_sheets
      WHERE club_id=$1 AND status='PUBLISHED'
      ORDER BY match_date DESC NULLS LAST, published_at DESC NULLS LAST LIMIT 1
    `, clubId).catch(() => [])
    const selected = new Set<string>()
    if (latestPublished[0]) {
      const rows = await prisma.$queryRawUnsafe<Array<{ clubPlayerId:string }>>(`SELECT club_player_id::text AS "clubPlayerId" FROM football_team_sheet_players WHERE team_sheet_id=$1::uuid`, latestPublished[0].id).catch(() => [])
      rows.forEach(row => selected.add(row.clubPlayerId))
    }

    const records = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
      SELECT id,club_id AS "clubId",club_player_id AS "clubPlayerId",player_id AS "playerId",player_name AS "playerName",
       milestone_type AS "milestoneType",milestone_value AS "milestoneValue",title,status,source,source_entity_id AS "sourceEntityId",
       occurred_on AS "occurredOn",photo_asset_id AS "photoAssetId",generated_asset_id AS "generatedAssetId",notes,
       created_at AS "createdAt",updated_at AS "updatedAt"
      FROM club_milestones WHERE club_id=$1 AND archived_at IS NULL ORDER BY created_at DESC
    `, clubId)
    const existing = new Set(records.map(row => `${row.clubPlayerId ?? ''}:${row.milestoneType}:${row.milestoneValue ?? 0}`))

    const suggestions: Array<Record<string, unknown>> = []
    for (const player of players) {
      const gameRows = await prisma.$queryRawUnsafe<Array<{ count:number }>>(`
        SELECT COUNT(*)::int AS count FROM club_match_day_state
        WHERE club_id=$1 AND state->>'finishedAt' IS NOT NULL
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(state->'slots','[]'::jsonb)) slot WHERE slot->>'clubPlayerId'=$2)
      `, clubId, player.clubPlayerId).catch(() => [{ count: 0 }])
      const games = gameRows[0]?.count ?? 0
      for (const threshold of GAME_THRESHOLDS) {
        const upcoming = selected.has(player.clubPlayerId) && games + 1 === threshold
        const achieved = games === threshold
        if ((upcoming || achieved) && !existing.has(`${player.clubPlayerId}:GAMES:${threshold}`)) suggestions.push({
          id: `games:${player.clubPlayerId}:${threshold}`, clubPlayerId: player.clubPlayerId, playerId: player.playerId,
          playerName: player.playerName, jumperNumber: player.jumperNumber, milestoneType: threshold === 1 ? 'DEBUT' : 'GAMES',
          milestoneValue: threshold, currentValue: games, timing: upcoming ? 'UPCOMING' : 'ACHIEVED',
          title: threshold === 1 ? `${player.playerName} debut` : `${player.playerName} — ${threshold} games`, sourceEntityId: latestPublished[0]?.id ?? null,
        })
      }

      if (player.playerId) {
        const goalRows = await prisma.$queryRawUnsafe<Array<{ goals:number }>>(`SELECT COALESCE(MAX(goals),0)::int AS goals FROM football_goal_kickers WHERE player_id::text=$1 AND (club_id=$2 OR club_id IS NULL)`, player.playerId, clubId).catch(() => [{ goals: 0 }])
        const goals = goalRows[0]?.goals ?? 0
        for (const threshold of GOAL_THRESHOLDS) {
          if (goals >= threshold && !existing.has(`${player.clubPlayerId}:GOALS:${threshold}`)) suggestions.push({
            id: `goals:${player.clubPlayerId}:${threshold}`, clubPlayerId: player.clubPlayerId, playerId: player.playerId,
            playerName: player.playerName, jumperNumber: player.jumperNumber, milestoneType: 'GOALS', milestoneValue: threshold,
            currentValue: goals, timing: 'ACHIEVED', title: `${player.playerName} — ${threshold} goals`, sourceEntityId: player.playerId,
          })
        }
      }
    }

    res.set('Cache-Control', 'no-store')
    res.json({ data: { players, suggestions, records, latestPublishedSheetId: latestPublished[0]?.id ?? null } })
  } catch (error) {
    res.status(500).json({ error: 'Unable to load club milestones', detail: error instanceof Error ? error.message : String(error) })
  }
})

router.post('/clubs/:clubId', async (req, res) => {
  try {
    await ensureTable()
    const clubPlayerId = text(req.body?.clubPlayerId, 80) || null
    const playerName = text(req.body?.playerName)
    const milestoneType = text(req.body?.milestoneType, 40).toUpperCase() || 'CUSTOM'
    const milestoneValue = number(req.body?.milestoneValue)
    const title = text(req.body?.title) || `${playerName} milestone`
    if (!playerName) return res.status(400).json({ error: 'Player name is required' })
    let playerId: string | null = text(req.body?.playerId, 80) || null
    if (clubPlayerId) {
      const owned = await prisma.$queryRawUnsafe<Array<{ playerId:string|null; playerName:string }>>(`SELECT player_id AS "playerId",player_name AS "playerName" FROM football_club_players WHERE id::text=$1 AND club_id=$2 LIMIT 1`, clubPlayerId, req.params.clubId)
      if (!owned[0]) return res.status(404).json({ error: 'Club player not found' })
      playerId = playerId || owned[0].playerId
    }
    const id = randomUUID()
    await prisma.$executeRawUnsafe(`
      INSERT INTO club_milestones(id,club_id,club_player_id,player_id,player_name,milestone_type,milestone_value,title,status,source,source_entity_id,occurred_on,photo_asset_id,notes,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'CONFIRMED',$9,$10,$11::date,$12,$13,$14)
      ON CONFLICT DO NOTHING
    `, id, req.params.clubId, clubPlayerId, playerId, playerName, milestoneType, milestoneValue, title,
      text(req.body?.source, 30) || 'MANUAL', text(req.body?.sourceEntityId, 100) || null,
      text(req.body?.occurredOn, 10) || null, text(req.body?.photoAssetId, 100) || null, text(req.body?.notes, 1000) || null, req.clubUser!.id)
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT id,club_id AS "clubId",club_player_id AS "clubPlayerId",player_id AS "playerId",player_name AS "playerName",milestone_type AS "milestoneType",milestone_value AS "milestoneValue",title,status,source,photo_asset_id AS "photoAssetId",generated_asset_id AS "generatedAssetId",created_at AS "createdAt" FROM club_milestones WHERE club_id=$1 AND club_player_id IS NOT DISTINCT FROM $2 AND milestone_type=$3 AND milestone_value IS NOT DISTINCT FROM $4 AND archived_at IS NULL ORDER BY created_at DESC LIMIT 1`, req.params.clubId, clubPlayerId, milestoneType, milestoneValue)
    res.status(201).json({ data: rows[0] ?? { id }, message: 'Milestone confirmed' })
  } catch (error) {
    res.status(500).json({ error: 'Unable to save milestone', detail: error instanceof Error ? error.message : String(error) })
  }
})

router.patch('/clubs/:clubId/:id', async (req, res) => {
  try {
    await ensureTable()
    const changed = await prisma.$executeRawUnsafe(`UPDATE club_milestones SET photo_asset_id=COALESCE($3,photo_asset_id),generated_asset_id=COALESCE($4,generated_asset_id),status=COALESCE($5,status),notes=COALESCE($6,notes),updated_at=now() WHERE id=$1 AND club_id=$2 AND archived_at IS NULL`, req.params.id, req.params.clubId, text(req.body?.photoAssetId,100)||null, text(req.body?.generatedAssetId,100)||null, text(req.body?.status,30)||null, text(req.body?.notes,1000)||null)
    if (!changed) return res.status(404).json({ error: 'Milestone not found' })
    res.json({ data: { id: req.params.id }, message: 'Milestone updated' })
  } catch (error) {
    res.status(500).json({ error: 'Unable to update milestone', detail: error instanceof Error ? error.message : String(error) })
  }
})

export { router as clubMilestonesRouter }
