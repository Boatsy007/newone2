from pathlib import Path

# Extend the existing training-attendance source of truth.
route = Path('backend/src/api/routes/club-training-attendance.ts')
text = route.read_text()
original = text

needle = """    await prisma.$executeRawUnsafe(`ALTER TABLE football_training_attendance ADD COLUMN IF NOT EXISTS early_reason text NULL`)
"""
addition = """    await prisma.$executeRawUnsafe(`ALTER TABLE football_training_attendance ADD COLUMN IF NOT EXISTS early_reason text NULL`)
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
"""
if needle not in text:
    raise SystemExit('attendance table extension point not found')
text = text.replace(needle, addition, 1)

old_get = """    const [players, sessions, attendance] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{id:string;playerName:string;jumperNumber:number|null;active:boolean}>>(`SELECT id::text AS id,player_name AS \"playerName\",jumper_number AS \"jumperNumber\",active FROM football_club_players WHERE club_id=$1 AND active=true ORDER BY player_name`, req.params.clubId),
      prisma.$queryRawUnsafe<Array<{id:string;title:string;sessionDate:string;startTime:string|null;notes:string|null;finishedAt:string|null;createdAt:string}>>(`SELECT id::text AS id,title,session_date::text AS \"sessionDate\",start_time AS \"startTime\",notes,finished_at AS \"finishedAt\",created_at AS \"createdAt\" FROM football_training_sessions WHERE club_id=$1 ORDER BY session_date DESC,created_at DESC LIMIT 80`, req.params.clubId),
      prisma.$queryRawUnsafe<Array<{sessionId:string;clubPlayerId:string;status:Status;note:string|null;leftEarly:boolean;missedPercentage:number|null;earlyReason:string|null}>>(`SELECT a.session_id::text AS \"sessionId\",a.club_player_id::text AS \"clubPlayerId\",a.status,a.note,a.left_early AS \"leftEarly\",a.missed_percentage AS \"missedPercentage\",a.early_reason AS \"earlyReason\" FROM football_training_attendance a JOIN football_training_sessions s ON s.id=a.session_id WHERE s.club_id=$1`, req.params.clubId),
    ])
    res.json({ data: { players, sessions, attendance }, statuses: STATUSES })
"""
new_get = """    const [players, sessions, attendance, drillFeedback] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{id:string;playerName:string;jumperNumber:number|null;active:boolean}>>(`SELECT id::text AS id,player_name AS \"playerName\",jumper_number AS \"jumperNumber\",active FROM football_club_players WHERE club_id=$1 AND active=true ORDER BY player_name`, req.params.clubId),
      prisma.$queryRawUnsafe<Array<{id:string;title:string;sessionDate:string;startTime:string|null;notes:string|null;finishedAt:string|null;overallRating:number|null;whatWorked:string|null;whatToImprove:string|null;injurySummary:string|null;reportCompletedAt:string|null;createdAt:string}>>(`SELECT id::text AS id,title,session_date::text AS \"sessionDate\",start_time AS \"startTime\",notes,finished_at AS \"finishedAt\",overall_rating AS \"overallRating\",what_worked AS \"whatWorked\",what_to_improve AS \"whatToImprove\",injury_summary AS \"injurySummary\",report_completed_at AS \"reportCompletedAt\",created_at AS \"createdAt\" FROM football_training_sessions WHERE club_id=$1 ORDER BY session_date DESC,created_at DESC LIMIT 80`, req.params.clubId),
      prisma.$queryRawUnsafe<Array<{sessionId:string;clubPlayerId:string;status:Status;note:string|null;leftEarly:boolean;missedPercentage:number|null;earlyReason:string|null;performance:string|null;injuryDetail:string|null}>>(`SELECT a.session_id::text AS \"sessionId\",a.club_player_id::text AS \"clubPlayerId\",a.status,a.note,a.left_early AS \"leftEarly\",a.missed_percentage AS \"missedPercentage\",a.early_reason AS \"earlyReason\",a.performance,a.injury_detail AS \"injuryDetail\" FROM football_training_attendance a JOIN football_training_sessions s ON s.id=a.session_id WHERE s.club_id=$1`, req.params.clubId),
      prisma.$queryRawUnsafe<Array<{sessionId:string;trainingPlanItemId:string|null;drillTitle:string;result:string;note:string|null;sortOrder:number}>>(`SELECT f.session_id::text AS \"sessionId\",f.training_plan_item_id AS \"trainingPlanItemId\",f.drill_title AS \"drillTitle\",f.result,f.note,f.sort_order AS \"sortOrder\" FROM football_training_drill_feedback f JOIN football_training_sessions s ON s.id=f.session_id WHERE s.club_id=$1 ORDER BY f.sort_order`, req.params.clubId),
    ])
    res.json({ data: { players, sessions, attendance, drillFeedback }, statuses: STATUSES })
"""
if old_get not in text:
    raise SystemExit('attendance GET block not found')
text = text.replace(old_get, new_get, 1)

insert_before = """router.post('/clubs/:clubId/sessions/:sessionId/finish', async (req, res) => {
"""
report_route = """router.put('/clubs/:clubId/sessions/:sessionId/report', async (req, res) => {
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

"""
if insert_before not in text:
    raise SystemExit('report route insertion point not found')
text = text.replace(insert_before, report_route + insert_before, 1)
if text == original:
    raise SystemExit('no training attendance changes made')
route.write_text(text)

# Mount existing training routes in the production server if not already mounted.
server = Path('backend/src/server.ts')
s = server.read_text()
if "clubTrainingAttendanceRouter" not in s:
    import_anchor = "import { portalRouter } from './api/routes/portal.js'"
    s = s.replace(import_anchor, import_anchor + "\nimport { clubTrainingAttendanceRouter } from './api/routes/club-training-attendance.js'\nimport { clubTrainingPlansRouter } from './api/routes/club-training-plans.js'")
    mount_anchor = "app.use('/api/club-portal/player-availability', clubPlayerAvailabilityRouter)"
    s = s.replace(mount_anchor, mount_anchor + "\napp.use('/api/club-portal/training-attendance', clubTrainingAttendanceRouter)\napp.use('/api/club-portal/training-plans', clubTrainingPlansRouter)")
    server.write_text(s)

# Connect the app report screen without replacing any existing page.
app = Path('src/pages/CoachApp.tsx')
a = app.read_text()
a_original = a
if "CoachAppTrainingReport" not in a:
    a = a.replace("import CoachAppTrainingPlan from './CoachAppTrainingPlan'", "import CoachAppTrainingPlan from './CoachAppTrainingPlan'\nimport CoachAppTrainingReport from './CoachAppTrainingReport'")
    a = a.replace("type Screen = 'DASHBOARD' | 'TRAINING_PLAN' | 'AVAILABILITY' | 'SELECT_SIDE' | 'MATCH_DAY'", "type Screen = 'DASHBOARD' | 'TRAINING_PLAN' | 'TRAINING_REPORT' | 'AVAILABILITY' | 'SELECT_SIDE' | 'MATCH_DAY'")
    a = a.replace("    if(key==='training-plan'){setTrainingSession(sessionNumber===2?2:1);setScreen('TRAINING_PLAN');return}", "    if(key==='training-plan'){setTrainingSession(sessionNumber===2?2:1);setScreen('TRAINING_PLAN');return}\n    if(key==='training-summary'){setTrainingSession(sessionNumber===2?2:1);setScreen('TRAINING_REPORT');return}")
    a = a.replace("const pageLabel=screen==='DASHBOARD'?'Dashboard':screen==='TRAINING_PLAN'?`Training Plan ${trainingSession}`:screen==='AVAILABILITY'?'Player Availability':screen==='SELECT_SIDE'?'Select Side':'Match Day'", "const pageLabel=screen==='DASHBOARD'?'Dashboard':screen==='TRAINING_PLAN'?`Training Plan ${trainingSession}`:screen==='TRAINING_REPORT'?`Training Report ${trainingSession}`:screen==='AVAILABILITY'?'Player Availability':screen==='SELECT_SIDE'?'Select Side':'Match Day'")
    a = a.replace("onContinue={()=>navigate(`/club-portal/${encodeURIComponent(context.club.id)}/coaching?source=coach-app&section=training-summary&session=${trainingSession}`)}/>", "onContinue={()=>setScreen('TRAINING_REPORT')}/>")
    renderer = """    {screen==='TRAINING_PLAN'?<CoachAppTrainingPlan clubId={context.club.id} token={session.access_token} sessionNumber={trainingSession} fixtureDate={context.fixture?.matchDate} onExit={()=>setScreen('DASHBOARD')} onContinue={()=>setScreen('TRAINING_REPORT')}/>:
      screen==='AVAILABILITY'"""
    replacement = """    {screen==='TRAINING_PLAN'?<CoachAppTrainingPlan clubId={context.club.id} token={session.access_token} sessionNumber={trainingSession} fixtureDate={context.fixture?.matchDate} onExit={()=>setScreen('DASHBOARD')} onContinue={()=>setScreen('TRAINING_REPORT')}/>:
      screen==='TRAINING_REPORT'?<CoachAppTrainingReport clubId={context.club.id} token={session.access_token} sessionNumber={trainingSession} fixtureDate={context.fixture?.matchDate} onExit={()=>setScreen('DASHBOARD')} onContinue={()=>setScreen(trainingSession===1?'AVAILABILITY':'SELECT_SIDE')}/>:
      screen==='AVAILABILITY'"""
    if renderer not in a:
        raise SystemExit('Coach App training report renderer point not found')
    a = a.replace(renderer, replacement, 1)
if a == a_original:
    raise SystemExit('no Coach App changes made')
app.write_text(a)
