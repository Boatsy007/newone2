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
      finished_at timestamptz NULL, finished_by text NULL,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`)
    await prisma.$executeRawUnsafe(`ALTER TABLE football_training_sessions ADD COLUMN IF NOT EXISTS finished_at timestamptz NULL`)
    await prisma.$executeRawUnsafe(`ALTER TABLE football_training_sessions ADD COLUMN IF NOT EXISTS finished_by text NULL`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS football_training_sessions_club_date ON football_training_sessions(club_id,session_date DESC)`)
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS football_training_attendance (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES football_training_sessions(id) ON DELETE CASCADE,
      club_player_id uuid NOT NULL REFERENCES football_club_players(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'ATTENDED', note text NULL, updated_by text NULL,
      left_early boolean NOT NULL DEFAULT false, missed_percentage integer NULL, early_reason text NULL,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(session_id,club_player_id),
      CONSTRAINT football_training_attendance_status CHECK(status IN ('ATTENDED','LATE','MODIFIED','EXCUSED','ABSENT','INJURED')))`)
    await prisma.$executeRawUnsafe(`ALTER TABLE football_training_attendance ADD COLUMN IF NOT EXISTS left_early boolean NOT NULL DEFAULT false`)
    await prisma.$executeRawUnsafe(`ALTER TABLE football_training_attendance ADD COLUMN IF NOT EXISTS missed_percentage integer NULL`)
    await prisma.$executeRawUnsafe(`ALTER TABLE football_training_attendance ADD COLUMN IF NOT EXISTS early_reason text NULL`)
    await prisma.$executeRawUnsafe(`ALTER TABLE football_training_attendance ADD COLUMN IF NOT EXISTS performance text NULL`)
    await prisma.$executeRawUnsafe(`ALTER TABLE football_training_attendance ADD COLUMN IF NOT EXISTS injury_detail text NULL`)
    await prisma.$executeRawUnsafe(`ALTER TABLE football_training_sessions ADD COLUMN IF NOT EXISTS overall_rating integer NULL`)
    await prisma.$executeRawUnsafe(`ALTER TABLE football_training_sessions ADD COLUMN IF NOT EXISTS what_worked text NULL`)
    await prisma.$executeRawUnsafe(`ALTER TABLE football_training_sessions ADD COLUMN IF NOT EXISTS what_to_improve text NULL`)
    await prisma.$executeRawUnsafe(`ALTER TABLE football_training_sessions ADD COLUMN IF NOT EXISTS injury_summary text NULL`)
    await prisma.$executeRawUnsafe(`ALTER TABLE football_training_sessions ADD COLUMN IF NOT EXISTS report_completed_at timestamptz NULL`)
    await prisma.$executeRawUnsafe(`ALTER TABLE football_training_sessions ADD COLUMN IF NOT EXISTS report_completed_by text NULL`)
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS football_training_drill_feedback (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES football_training_sessions(id) ON DELETE CASCADE,
      training_plan_item_id text NULL, drill_title text NOT NULL, result text NOT NULL DEFAULT 'NOT_RATED', note text NULL,
      sort_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(session_id,drill_title), CONSTRAINT football_training_drill_feedback_result CHECK(result IN ('WORKED','MIXED','DIDNT_WORK','NOT_RATED')))`)
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
    const [players, sessions, attendance, drillFeedback] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{id:string;playerName:string;jumperNumber:number|null;active:boolean}>>(`SELECT id::text AS id,player_name AS "playerName",jumper_number AS "jumperNumber",active FROM football_club_players WHERE club_id=$1 AND active=true ORDER BY player_name`, req.params.clubId),
      prisma.$queryRawUnsafe<Array<{id:string;title:string;sessionDate:string;startTime:string|null;notes:string|null;finishedAt:string|null;overallRating:number|null;whatWorked:string|null;whatToImprove:string|null;injurySummary:string|null;reportCompletedAt:string|null;createdAt:string}>>(`SELECT id::text AS id,title,session_date::text AS "sessionDate",start_time AS "startTime",notes,finished_at AS "finishedAt",overall_rating AS "overallRating",what_worked AS "whatWorked",what_to_improve AS "whatToImprove",injury_summary AS "injurySummary",report_completed_at AS "reportCompletedAt",created_at AS "createdAt" FROM football_training_sessions WHERE club_id=$1 ORDER BY session_date DESC,created_at DESC LIMIT 80`, req.params.clubId),
      prisma.$queryRawUnsafe<Array<{sessionId:string;clubPlayerId:string;status:Status;note:string|null;leftEarly:boolean;missedPercentage:number|null;earlyReason:string|null;performance:string|null;injuryDetail:string|null}>>(`SELECT a.session_id::text AS "sessionId",a.club_player_id::text AS "clubPlayerId",a.status,a.note,a.left_early AS "leftEarly",a.missed_percentage AS "missedPercentage",a.early_reason AS "earlyReason",a.performance,a.injury_detail AS "injuryDetail" FROM football_training_attendance a JOIN football_training_sessions s ON s.id=a.session_id WHERE s.club_id=$1`, req.params.clubId),
      prisma.$queryRawUnsafe<Array<{sessionId:string;trainingPlanItemId:string|null;drillTitle:string;result:string;note:string|null;sortOrder:number}>>(`SELECT f.session_id::text AS "sessionId",f.training_plan_item_id AS "trainingPlanItemId",f.drill_title AS "drillTitle",f.result,f.note,f.sort_order AS "sortOrder" FROM football_training_drill_feedback f JOIN football_training_sessions s ON s.id=f.session_id WHERE s.club_id=$1 ORDER BY f.sort_order`, req.params.clubId),
    ])
    res.json({ data: { players, sessions, attendance, drillFeedback }, statuses: STATUSES })
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
    const createdBy = req.clubUser?.id ?? null
    const created = await prisma.$transaction(async tx => {
      const rows = await tx.$queryRawUnsafe<Array<{id:string;title:string;sessionDate:string;startTime:string|null;notes:string|null}>>(`INSERT INTO football_training_sessions(club_id,title,session_date,start_time,notes,created_by) VALUES($1,$2,$3::date,$4,$5,$6) RETURNING id::text AS id,title,session_date::text AS "sessionDate",start_time AS "startTime",notes`, req.params.clubId,title,date,startTime,notes,createdBy)
      const session = rows[0]
      await tx.$executeRawUnsafe(`INSERT INTO football_training_attendance(session_id,club_player_id,status,updated_by) SELECT $1::uuid,id,'ATTENDED',$3 FROM football_club_players WHERE club_id=$2 AND active=true ON CONFLICT(session_id,club_player_id) DO NOTHING`, session.id, req.params.clubId, createdBy)
      return session
    })
    res.status(201).json({ data: created, message: 'Training session created with all active players marked attended.' })
  } catch (error) { res.status(500).json({ error: 'Unable to create training session', detail: String(error) }) }
})

router.put('/clubs/:clubId/sessions/:sessionId/attendance', async (req, res) => {
  try {
    await ensureTables()
    const sessions = await prisma.$queryRawUnsafe<Array<{id:string;finishedAt:string|null}>>(`SELECT id::text AS id,finished_at AS "finishedAt" FROM football_training_sessions WHERE id::text=$1 AND club_id=$2 LIMIT 1`, req.params.sessionId, req.params.clubId)
    if (!sessions[0]) return res.status(404).json({ error: 'Training session not found for this club' })
    if (sessions[0].finishedAt) return res.status(409).json({ error: 'This training session has already been finished' })
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : []
    const clean = entries.map((entry:any) => {
      const leftEarly = Boolean(entry?.leftEarly)
      const percentage = Number(entry?.missedPercentage)
      return {
        clubPlayerId:String(entry?.clubPlayerId ?? ''),
        status:String(entry?.status ?? '').toUpperCase() as Status,
        note:String(entry?.note ?? '').trim().slice(0,500) || null,
        leftEarly,
        missedPercentage:leftEarly && [10,25,50,75].includes(percentage) ? percentage : null,
        earlyReason:leftEarly ? (String(entry?.earlyReason ?? '').trim().slice(0,500) || null) : null,
      }
    }).filter((entry:any) => entry.clubPlayerId && STATUSES.includes(entry.status))
    if (!clean.length) return res.status(400).json({ error: 'No valid attendance entries supplied' })
    const playerIds = [...new Set(clean.map((entry:any) => entry.clubPlayerId))]
    const valid = await prisma.$queryRawUnsafe<Array<{id:string}>>(`SELECT id::text AS id FROM football_club_players WHERE club_id=$1 AND id=ANY($2::uuid[])`, req.params.clubId, playerIds)
    const validIds = new Set(valid.map(row => row.id))
    const safe = clean.filter((entry:any) => validIds.has(entry.clubPlayerId))
    await prisma.$transaction(async tx => {
      for (const entry of safe) await tx.$executeRawUnsafe(`INSERT INTO football_training_attendance(session_id,club_player_id,status,note,left_early,missed_percentage,early_reason,updated_by) VALUES($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8) ON CONFLICT(session_id,club_player_id) DO UPDATE SET status=EXCLUDED.status,note=EXCLUDED.note,left_early=EXCLUDED.left_early,missed_percentage=EXCLUDED.missed_percentage,early_reason=EXCLUDED.early_reason,updated_by=EXCLUDED.updated_by,updated_at=now()`, req.params.sessionId,entry.clubPlayerId,entry.status,entry.note,entry.leftEarly,entry.missedPercentage,entry.earlyReason,req.clubUser?.id ?? null)
    })
    res.json({ message: `Saved ${safe.length} attendance update${safe.length===1?'':'s'}`, count: safe.length })
  } catch (error) { res.status(500).json({ error: 'Unable to save training attendance', detail: String(error) }) }
})

router.put('/clubs/:clubId/sessions/:sessionId/report', async (req, res) => {
  try {
    await ensureTables()
    const sessions = await prisma.$queryRawUnsafe<Array<{id:string}>>(`SELECT id::text AS id FROM football_training_sessions WHERE id::text=$1 AND club_id=$2 LIMIT 1`, req.params.sessionId, req.params.clubId)
    if (!sessions[0]) return res.status(404).json({ error: 'Training session not found for this club' })
    const ratings = ['STANDOUT','SOLID','NEEDS_WORK','NOT_RATED']
    const drillResults = ['WORKED','MIXED','DIDNT_WORK','NOT_RATED']
    const entries = (Array.isArray(req.body?.entries) ? req.body.entries : []).map((entry:any) => ({
      clubPlayerId: String(entry?.clubPlayerId ?? ''),
      status: String(entry?.status ?? '').toUpperCase() as Status,
      performance: ratings.includes(String(entry?.performance ?? '')) ? String(entry.performance) : 'NOT_RATED',
      note: String(entry?.note ?? '').trim().slice(0,500) || null,
      injuryDetail: String(entry?.injuryDetail ?? '').trim().slice(0,800) || null,
      leftEarly: Boolean(entry?.leftEarly),
      missedPercentage: [10,25,50,75].includes(Number(entry?.missedPercentage)) ? Number(entry.missedPercentage) : null,
      earlyReason: String(entry?.earlyReason ?? '').trim().slice(0,500) || null,
    })).filter((entry:any) => entry.clubPlayerId && STATUSES.includes(entry.status))
    const drills = (Array.isArray(req.body?.drills) ? req.body.drills : []).map((drill:any, index:number) => ({
      trainingPlanItemId: String(drill?.trainingPlanItemId ?? '').trim() || null,
      drillTitle: String(drill?.drillTitle ?? '').trim().slice(0,160),
      result: drillResults.includes(String(drill?.result ?? '')) ? String(drill.result) : 'NOT_RATED',
      note: String(drill?.note ?? '').trim().slice(0,800) || null,
      sortOrder: Number.isFinite(Number(drill?.sortOrder)) ? Number(drill.sortOrder) : index,
    })).filter((drill:any) => drill.drillTitle)
    const playerIds = [...new Set(entries.map((entry:any) => entry.clubPlayerId))]
    const valid = playerIds.length ? await prisma.$queryRawUnsafe<Array<{id:string}>>(`SELECT id::text AS id FROM football_club_players WHERE club_id=$1 AND id=ANY($2::uuid[])`, req.params.clubId, playerIds) : []
    const validIds = new Set(valid.map(row => row.id))
    const safeEntries = entries.filter((entry:any) => validIds.has(entry.clubPlayerId))
    const overallRating = Math.min(5, Math.max(1, Number(req.body?.overallRating) || 3))
    const whatWorked = String(req.body?.whatWorked ?? '').trim().slice(0,2500) || null
    const whatToImprove = String(req.body?.whatToImprove ?? '').trim().slice(0,2500) || null
    const injurySummary = String(req.body?.injurySummary ?? '').trim().slice(0,2500) || null
    const complete = Boolean(req.body?.complete)
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(`UPDATE football_training_sessions SET overall_rating=$3,what_worked=$4,what_to_improve=$5,injury_summary=$6,report_completed_at=CASE WHEN $7 THEN COALESCE(report_completed_at,now()) ELSE report_completed_at END,report_completed_by=CASE WHEN $7 THEN COALESCE(report_completed_by,$8) ELSE report_completed_by END,updated_at=now() WHERE id::text=$1 AND club_id=$2`, req.params.sessionId,req.params.clubId,overallRating,whatWorked,whatToImprove,injurySummary,complete,req.clubUser?.id ?? null)
      for (const entry of safeEntries) await tx.$executeRawUnsafe(`INSERT INTO football_training_attendance(session_id,club_player_id,status,note,left_early,missed_percentage,early_reason,performance,injury_detail,updated_by) VALUES($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(session_id,club_player_id) DO UPDATE SET status=EXCLUDED.status,note=EXCLUDED.note,left_early=EXCLUDED.left_early,missed_percentage=EXCLUDED.missed_percentage,early_reason=EXCLUDED.early_reason,performance=EXCLUDED.performance,injury_detail=EXCLUDED.injury_detail,updated_by=EXCLUDED.updated_by,updated_at=now()`, req.params.sessionId,entry.clubPlayerId,entry.status,entry.note,entry.leftEarly,entry.missedPercentage,entry.earlyReason,entry.performance,entry.injuryDetail,req.clubUser?.id ?? null)
      await tx.$executeRawUnsafe(`DELETE FROM football_training_drill_feedback WHERE session_id=$1::uuid`, req.params.sessionId)
      for (const drill of drills) await tx.$executeRawUnsafe(`INSERT INTO football_training_drill_feedback(session_id,training_plan_item_id,drill_title,result,note,sort_order) VALUES($1::uuid,$2,$3,$4,$5,$6)`, req.params.sessionId,drill.trainingPlanItemId,drill.drillTitle,drill.result,drill.note,drill.sortOrder)
    })
    res.json({ message: complete ? 'Training report completed.' : 'Training report saved.', data: { players: safeEntries.length, drills: drills.length } })
  } catch (error) { res.status(500).json({ error: 'Unable to save training report', detail: String(error) }) }
})

router.post('/clubs/:clubId/sessions/:sessionId/finish', async (req, res) => {
  try {
    await ensureTables()
    const rows = await prisma.$queryRawUnsafe<Array<{id:string}>>(`UPDATE football_training_sessions SET finished_at=COALESCE(finished_at,now()),finished_by=COALESCE(finished_by,$3),updated_at=now() WHERE id::text=$1 AND club_id=$2 RETURNING id::text AS id`, req.params.sessionId, req.params.clubId, req.clubUser?.id ?? null)
    if (!rows[0]) return res.status(404).json({ error: 'Training session not found' })
    const summary = await prisma.$queryRawUnsafe<Array<{status:Status;count:number}>>(`SELECT status,COUNT(*)::int AS count FROM football_training_attendance WHERE session_id=$1::uuid GROUP BY status`, req.params.sessionId)
    const leftEarly = await prisma.$queryRawUnsafe<Array<{count:number}>>(`SELECT COUNT(*)::int AS count FROM football_training_attendance WHERE session_id=$1::uuid AND left_early=true`, req.params.sessionId)
    res.json({ message: 'Training finished and attendance summary saved.', data: { summary, leftEarly: leftEarly[0]?.count ?? 0 } })
  } catch (error) { res.status(500).json({ error: 'Unable to finish training session', detail: String(error) }) }
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
