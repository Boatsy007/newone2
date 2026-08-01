import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, requireActiveClubMembership, roleCan } from '../../auth/club-auth.js'

const router = Router()
router.use(authenticateClubUser)
router.use('/clubs/:clubId', requireActiveClubMembership)

let ready: Promise<void> | null = null
function ensureWhiteboardTable() {
  if (!ready) ready = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS football_coach_whiteboards (
        id uuid PRIMARY KEY,
        club_id text NOT NULL,
        title text NOT NULL,
        opponent_name text NULL,
        round_label text NULL,
        board_data jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_by text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS football_coach_whiteboards_club_idx ON football_coach_whiteboards(club_id,updated_at DESC)`)
  })().catch(error => { ready = null; throw error })
  return ready
}

function canManage(res: any) {
  const membership = res.locals.clubMembership as { role?: Parameters<typeof roleCan>[0] } | undefined
  return Boolean(membership?.role && roleCan(membership.role, 'team_selection'))
}

const clean = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max)
function cleanBoard(value: unknown) {
  const board = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const markers = Array.isArray(board.markers) ? board.markers.slice(0, 80).map(value => {
    const row = value as Record<string, unknown>
    const side = row.side === 'opposition' ? 'opposition' : 'home'
    return {
      id: clean(row.id, 80) || randomUUID(),
      playerId: clean(row.playerId, 100) || null,
      label: clean(row.label, 40) || 'Player',
      number: clean(row.number, 8) || null,
      side,
      x: Math.max(0, Math.min(100, Number(row.x) || 50)),
      y: Math.max(0, Math.min(100, Number(row.y) || 50)),
    }
  }) : []
  const drawings = Array.isArray(board.drawings) ? board.drawings.slice(0, 250).map(value => {
    const row = value as Record<string, unknown>
    const points = Array.isArray(row.points) ? row.points.slice(0, 300).map(point => {
      const p = point as Record<string, unknown>
      return { x: Math.max(0, Math.min(100, Number(p.x) || 0)), y: Math.max(0, Math.min(100, Number(p.y) || 0)) }
    }) : []
    return {
      id: clean(row.id, 80) || randomUUID(),
      type: row.type === 'arrow' ? 'arrow' : row.type === 'zone' ? 'zone' : 'line',
      side: row.side === 'opposition' ? 'opposition' : 'home',
      points,
      label: clean(row.label, 100) || null,
    }
  }).filter(row => row.points.length > 0) : []
  const playRecording = board.playRecording && typeof board.playRecording === 'object' ? board.playRecording : undefined
  return { version: 1, markers, drawings, ...(playRecording ? { playRecording } : {}) }
}

router.get('/clubs/:clubId/whiteboards/options', async (req, res) => {
  try {
    await ensureWhiteboardTable()
    if (!canManage(res)) return res.status(403).json({ error: 'Your club role cannot manage the coach whiteboard' })
    const players = await prisma.$queryRawUnsafe<Array<{id:string;playerName:string;jumperNumber:number|null}>>(`
      SELECT id::text AS id,player_name AS "playerName",jumper_number AS "jumperNumber"
      FROM football_club_players WHERE club_id=$1 AND active=true ORDER BY player_name
    `, req.params.clubId)
    const boards = await prisma.$queryRawUnsafe<Array<{id:string;title:string;opponentName:string|null;roundLabel:string|null;updatedAt:string}>>(`
      SELECT id::text AS id,title,opponent_name AS "opponentName",round_label AS "roundLabel",updated_at AS "updatedAt"
      FROM football_coach_whiteboards WHERE club_id=$1 ORDER BY updated_at DESC LIMIT 100
    `, req.params.clubId)
    res.json({ data: { players, boards } })
  } catch (error) { res.status(500).json({ error: 'Unable to load coach whiteboard', detail: String(error) }) }
})

router.get('/clubs/:clubId/whiteboards/:boardId/recording', async (req, res) => {
  try {
    await ensureWhiteboardTable()
    if (!canManage(res)) return res.status(403).json({ error: 'Your club role cannot manage the coach whiteboard' })
    const rows = await prisma.$queryRawUnsafe<Array<{recording:unknown;updatedAt:string}>>(`
      SELECT board_data->'playRecording' AS recording,updated_at AS "updatedAt"
      FROM football_coach_whiteboards WHERE id::text=$1 AND club_id=$2 LIMIT 1
    `, req.params.boardId, req.params.clubId)
    if (!rows[0]) return res.status(404).json({ error: 'Whiteboard not found' })
    res.json({ data: { recording: rows[0].recording ?? null, updatedAt: rows[0].updatedAt } })
  } catch (error) { res.status(500).json({ error: 'Unable to load whiteboard recording', detail: String(error) }) }
})

router.put('/clubs/:clubId/whiteboards/:boardId/recording', async (req, res) => {
  try {
    await ensureWhiteboardTable()
    if (!canManage(res)) return res.status(403).json({ error: 'Your club role cannot manage the coach whiteboard' })
    const recording = req.body?.recording
    if (!recording || typeof recording !== 'object' || Array.isArray(recording)) return res.status(400).json({ error: 'A valid recording is required' })
    const value = recording as Record<string,unknown>
    const cleanRecording = {
      version: 1,
      duration: Math.max(0, Math.min(3600000, Number(value.duration) || 0)),
      tracks: value.tracks && typeof value.tracks === 'object' && !Array.isArray(value.tracks) ? value.tracks : {},
      ball: value.ball && typeof value.ball === 'object' ? value.ball : null,
      savedAt: new Date().toISOString(),
    }
    const changed = await prisma.$executeRawUnsafe(`
      UPDATE football_coach_whiteboards
      SET board_data=jsonb_set(COALESCE(board_data,'{}'::jsonb),'{playRecording}',$3::jsonb,true),updated_at=now()
      WHERE id::text=$1 AND club_id=$2
    `, req.params.boardId, req.params.clubId, JSON.stringify(cleanRecording))
    if (!changed) return res.status(404).json({ error: 'Whiteboard not found' })
    res.json({ data: { recording: cleanRecording }, message: 'Whiteboard recording saved' })
  } catch (error) { res.status(500).json({ error: 'Unable to save whiteboard recording', detail: String(error) }) }
})

router.get('/clubs/:clubId/whiteboards/:boardId', async (req, res) => {
  try {
    await ensureWhiteboardTable()
    if (!canManage(res)) return res.status(403).json({ error: 'Your club role cannot manage the coach whiteboard' })
    const rows = await prisma.$queryRawUnsafe<Array<{id:string;title:string;opponentName:string|null;roundLabel:string|null;boardData:unknown;updatedAt:string}>>(`
      SELECT id::text AS id,title,opponent_name AS "opponentName",round_label AS "roundLabel",board_data AS "boardData",updated_at AS "updatedAt"
      FROM football_coach_whiteboards WHERE id::text=$1 AND club_id=$2 LIMIT 1
    `, req.params.boardId, req.params.clubId)
    if (!rows[0]) return res.status(404).json({ error: 'Whiteboard not found' })
    res.json({ data: rows[0] })
  } catch (error) { res.status(500).json({ error: 'Unable to load whiteboard', detail: String(error) }) }
})

router.post('/clubs/:clubId/whiteboards', async (req, res) => {
  try {
    await ensureWhiteboardTable()
    if (!canManage(res)) return res.status(403).json({ error: 'Your club role cannot manage the coach whiteboard' })
    const title = clean(req.body?.title, 120)
    if (!title) return res.status(400).json({ error: 'Enter a board title' })
    const id = randomUUID()
    const boardData = cleanBoard(req.body?.boardData)
    await prisma.$executeRawUnsafe(`
      INSERT INTO football_coach_whiteboards(id,club_id,title,opponent_name,round_label,board_data,created_by)
      VALUES($1::uuid,$2,$3,$4,$5,$6::jsonb,$7)
    `, id, req.params.clubId, title, clean(req.body?.opponentName,120)||null, clean(req.body?.roundLabel,80)||null, JSON.stringify(boardData), res.locals.clubMembership?.userId ?? null)
    res.status(201).json({ data: { id, title, boardData }, message: 'Whiteboard saved' })
  } catch (error) { res.status(500).json({ error: 'Unable to save whiteboard', detail: String(error) }) }
})

router.put('/clubs/:clubId/whiteboards/:boardId', async (req, res) => {
  try {
    await ensureWhiteboardTable()
    if (!canManage(res)) return res.status(403).json({ error: 'Your club role cannot manage the coach whiteboard' })
    const title = clean(req.body?.title, 120)
    if (!title) return res.status(400).json({ error: 'Enter a board title' })
    const boardData = cleanBoard(req.body?.boardData)
    const changed = await prisma.$executeRawUnsafe(`
      UPDATE football_coach_whiteboards SET title=$3,opponent_name=$4,round_label=$5,board_data=$6::jsonb,updated_at=now()
      WHERE id::text=$1 AND club_id=$2
    `, req.params.boardId, req.params.clubId, title, clean(req.body?.opponentName,120)||null, clean(req.body?.roundLabel,80)||null, JSON.stringify(boardData))
    if (!changed) return res.status(404).json({ error: 'Whiteboard not found' })
    res.json({ data: { id:req.params.boardId,title,boardData }, message: 'Whiteboard updated' })
  } catch (error) { res.status(500).json({ error: 'Unable to update whiteboard', detail: String(error) }) }
})

router.delete('/clubs/:clubId/whiteboards/:boardId', async (req, res) => {
  try {
    await ensureWhiteboardTable()
    if (!canManage(res)) return res.status(403).json({ error: 'Your club role cannot manage the coach whiteboard' })
    await prisma.$executeRawUnsafe(`DELETE FROM football_coach_whiteboards WHERE id::text=$1 AND club_id=$2`, req.params.boardId, req.params.clubId)
    res.json({ data: { deleted: true } })
  } catch (error) { res.status(500).json({ error: 'Unable to delete whiteboard', detail: String(error) }) }
})

export { router as clubCoachWhiteboardRouter }
