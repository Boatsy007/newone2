import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, requireActiveClubMembership, roleCan } from '../../auth/club-auth.js'

const router = Router()
const STATUSES = ['ATTENDED','LATE','MODIFIED','EXCUSED','ABSENT','INJURED'] as const
type Status = typeof STATUSES[number]
type Membership = { role: Parameters<typeof roleCan>[0] }
let ready: Promise<void> | null = null

function ensureTables() {
  if (!ready) ready = (async () => {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS football_training_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), club_id text NOT NULL, title text NOT NULL DEFAULT 'Training',
      session_date date NOT NULL, start_time text NULL, notes text NULL, created_by text NULL,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS football_training_sessions_club_date ON football_training_sessions(club_id,session_date DESC)`)
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS football_training_attendance (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES football_training_sessions(id) ON DELETE CASCADE,
      club_player_id uuid NOT NULL REFERENCES football_club_players(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'ATTENDED', note text NULL, updated_by text NULL,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(session_id,club_player_id),
      CONSTRAINT football_training_attendance_status CHECK(status IN ('ATTENDED','LATE','MODIFIED','EXCUSED','ABSENT','INJURED')))`)
  })().catch(error => { ready = null; throw error })
  return ready
}

function allowCoach(_req: any, res: any, next: any) {
  const membership = res.locals.clubMembership as Membership | undefined
  if (!membership || !roleCan(membership.role, 'team_selection')) return res.status(403).json({ error: 'Your club role cannot manage training attendance' })
  next()
}

router.use(authenticateClubUser)
router.use('/clubs/:clubId', requireActiveClubMembership, allowCoach)

router.get('/clubs/:clubId', async (req, res) => {
  try {
    await ensureTables()
    const [players, sessions, attendance] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{id:string;playerName:string;jumperNumber:number|null;active:boolean}>>(`SELECT id::text AS id,player_name AS "playerName",jumper_number AS "jumperNumber",active FROM football_club_players WHERE club_id=$1 AND active=true ORDER BY player_name`, req.params.clubId),
      prisma.$queryRawUnsafe<Array<{id:string;title:string;sessionDate:string;startTime:string|null;notes:string|null;createdAt:string}>>(`SELECT id::text AS id,title,session_date AS "sessionDate",start_time AS "startTime",notes,created_at AS "createdAt" FROM football_training_sessions WHERE club_id=$1 ORDER BY session_date DESC,created_at DESC LIMIT 80`, req.params.clubId),
      prisma.$queryRawUnsafe<Array<{sessionId:string;clubPlayerId:string;status:Status;note:string|null}>>(`SELECT a.session_id::text AS "sessionId",a.club_player_id::text AS "clubPlayerId",a.status,a.note FROM football_training_attendance a JOIN football_training_sessions s ON s.id=a.session_id WHERE s.club_id=$1`, req.params.clubId),
    ])
    res.json({ data: { players, sessions, attendance }, statuses: STATUSES })
  } catch (error) { res.status(500).json({ error: 'Unable to load training attendance', detail: String(error) }) }
})

router.post('/clubs/:clubId/sessions', async (req, res) => {
  try {
    await ensureTables()
    const date = String(req.body?.sessionDate ?? '').slice(0,10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'A valid training date is required' })
    const title = String(req.body?.title ?? 'Training').trim().slice(0,100) || 'Training'
    const startTime = String(req.body?.startTime ?? '').trim().slice(0,20) || null
    const notes = String(req.body?.notes ?? '').trim().slice(0,1000) || null
    const rows = await prisma.$queryRawUnsafe<Array<{id:string;title:string;sessionDate:string;startTime:string|null;notes:string|null}>>(`INSERT INTO football_training_sessions(club_id,title,session_date,start_time,notes,created_by) VALUES($1,$2,$3::date,$4,$5,$6) RETURNING id::text AS id,title,session_date AS "sessionDate",start_time AS "startTime",notes`, req.params.clubId,title,date,startTime,notes,req.clubUser?.id ?? null)
    res.status(201).json({ data: rows[0] })
  } catch (error) { res.status(500).json({ error: 'Unable to create training session', detail: String(error) }) }
})

router.put('/clubs/:clubId/sessions/:sessionId/attendance', async (req, res) => {
  try {
    await ensureTables()
    const sessions = await prisma.$queryRawUnsafe<Array<{id:string}>>(`SELECT id::text AS id FROM football_training_sessions WHERE id::text=$1 AND club_id=$2 LIMIT 1`, req.params.sessionId, req.params.clubId)
    if (!sessions[0]) return res.status(404).json({ error: 'Training session not found for this club' })
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : []
    const clean = entries.map((entry:any) => ({ clubPlayerId:String(entry?.clubPlayerId ?? ''), status:String(entry?.status ?? '').toUpperCase() as Status, note:String(entry?.note ?? '').trim().slice(0,500) || null })).filter((entry:any) => entry.clubPlayerId && STATUSES.includes(entry.status))
    if (!clean.length) return res.status(400).json({ error: 'No valid attendance entries supplied' })
    const playerIds = [...new Set(clean.map((entry:any) => entry.clubPlayerId))]
    const valid = await prisma.$queryRawUnsafe<Array<{id:string}>>(`SELECT id::text AS id FROM football_club_players WHERE club_id=$1 AND id=ANY($2::uuid[])`, req.params.clubId, playerIds)
    const validIds = new Set(valid.map(row => row.id))
    const safe = clean.filter((entry:any) => validIds.has(entry.clubPlayerId))
    await prisma.$transaction(async tx => {
      for (const entry of safe) await tx.$executeRawUnsafe(`INSERT INTO football_training_attendance(session_id,club_player_id,status,note,updated_by) VALUES($1::uuid,$2::uuid,$3,$4,$5) ON CONFLICT(session_id,club_player_id) DO UPDATE SET status=EXCLUDED.status,note=EXCLUDED.note,updated_by=EXCLUDED.updated_by,updated_at=now()`, req.params.sessionId,entry.clubPlayerId,entry.status,entry.note,req.clubUser?.id ?? null)
    })
    res.json({ message: `Saved attendance for ${safe.length} player${safe.length===1?'':'s'}`, count: safe.length })
  } catch (error) { res.status(500).json({ error: 'Unable to save training attendance', detail: String(error) }) }
})

router.delete('/clubs/:clubId/sessions/:sessionId', async (req, res) => {
  try {
    await ensureTables()
    const count = await prisma.$executeRawUnsafe(`DELETE FROM football_training_sessions WHERE id::text=$1 AND club_id=$2`, req.params.sessionId, req.params.clubId)
    if (!count) return res.status(404).json({ error: 'Training session not found' })
    res.json({ message: 'Training session deleted' })
  } catch (error) { res.status(500).json({ error: 'Unable to delete training session', detail: String(error) }) }
})

export { router as clubTrainingAttendanceRouter }
