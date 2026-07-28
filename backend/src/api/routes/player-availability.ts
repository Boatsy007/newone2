import { createHash, randomBytes } from 'node:crypto'
import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, requireActiveClubMembership, roleCan } from '../../auth/club-auth.js'

const STATUSES = ['AVAILABLE', 'UNAVAILABLE', 'UNSURE'] as const
const REASONS = ['INJURY', 'ILLNESS', 'HOLIDAY', 'WORK', 'FAMILY', 'SUSPENSION', 'OTHER'] as const

type AvailabilityStatus = typeof STATUSES[number]
type AvailabilityReason = typeof REASONS[number]

type Membership = { role: Parameters<typeof roleCan>[0] }

let ready: Promise<void> | null = null
function ensureAvailabilityTables() {
  if (!ready) ready = (async () => {
    await prisma.$executeRawUnsafe(`ALTER TABLE football_team_sheets ADD COLUMN IF NOT EXISTS availability_deadline timestamptz NULL`)
    await prisma.$executeRawUnsafe(`ALTER TABLE football_team_sheets ADD COLUMN IF NOT EXISTS availability_locked boolean NOT NULL DEFAULT false`)
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS football_player_availability_access (
      club_player_id uuid PRIMARY KEY REFERENCES football_club_players(id) ON DELETE CASCADE,
      token_hash text NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`)
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS football_player_availability (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      team_sheet_id uuid NOT NULL REFERENCES football_team_sheets(id) ON DELETE CASCADE,
      club_player_id uuid NOT NULL REFERENCES football_club_players(id) ON DELETE CASCADE,
      status text NOT NULL,
      reason text NULL,
      note text NULL,
      updated_by text NOT NULL DEFAULT 'PLAYER',
      override_reason text NULL,
      responded_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(team_sheet_id, club_player_id)
    )`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS football_player_availability_sheet_idx ON football_player_availability(team_sheet_id,status)`)
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS football_player_availability_audit (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      team_sheet_id uuid NOT NULL,
      club_player_id uuid NOT NULL,
      actor text NOT NULL,
      previous_status text NULL,
      new_status text NOT NULL,
      reason text NULL,
      note text NULL,
      override_reason text NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`)
  })().catch(error => { ready = null; throw error })
  return ready
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
const clean = (value: unknown, max = 500) => String(value ?? '').trim().slice(0, max)

function allowTeamSelection(_req: any, res: any, next: any) {
  const membership = res.locals.clubMembership as Membership | undefined
  if (!membership || !roleCan(membership.role, 'team_selection')) return res.status(403).json({ error: 'Your club role cannot manage player availability' })
  next()
}

async function sheetForClub(sheetId: string, clubId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{id:string;clubId:string;roundLabel:string;opponentName:string|null;matchDate:string|null;availabilityDeadline:string|null;availabilityLocked:boolean}>>(`
    SELECT id::text AS id,club_id AS "clubId",round_label AS "roundLabel",opponent_name AS "opponentName",match_date AS "matchDate",
      availability_deadline AS "availabilityDeadline",availability_locked AS "availabilityLocked"
    FROM football_team_sheets WHERE id::text=$1 AND club_id=$2 LIMIT 1
  `, sheetId, clubId)
  return rows[0] ?? null
}

async function writeAvailability(args: { sheetId:string; clubPlayerId:string; status:AvailabilityStatus; reason:AvailabilityReason|null; note:string|null; actor:string; overrideReason:string|null }) {
  const before = await prisma.$queryRawUnsafe<Array<{status:string|null}>>(`SELECT status FROM football_player_availability WHERE team_sheet_id=$1::uuid AND club_player_id=$2::uuid LIMIT 1`, args.sheetId, args.clubPlayerId)
  await prisma.$executeRawUnsafe(`
    INSERT INTO football_player_availability(team_sheet_id,club_player_id,status,reason,note,updated_by,override_reason,responded_at,updated_at)
    VALUES($1::uuid,$2::uuid,$3,$4,$5,$6,$7,now(),now())
    ON CONFLICT(team_sheet_id,club_player_id) DO UPDATE SET status=EXCLUDED.status,reason=EXCLUDED.reason,note=EXCLUDED.note,updated_by=EXCLUDED.updated_by,override_reason=EXCLUDED.override_reason,responded_at=now(),updated_at=now()
  `, args.sheetId, args.clubPlayerId, args.status, args.reason, args.note, args.actor, args.overrideReason)
  await prisma.$executeRawUnsafe(`INSERT INTO football_player_availability_audit(team_sheet_id,club_player_id,actor,previous_status,new_status,reason,note,override_reason) VALUES($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8)`, args.sheetId, args.clubPlayerId, args.actor, before[0]?.status ?? null, args.status, args.reason, args.note, args.overrideReason)
}

const coachRouter = Router()
coachRouter.use(authenticateClubUser)
coachRouter.use('/clubs/:clubId', requireActiveClubMembership, allowTeamSelection)

coachRouter.get('/clubs/:clubId/overview', async (req, res) => {
  try {
    await ensureAvailabilityTables()
    const requested = clean(req.query.sheetId, 80)
    const sheets = await prisma.$queryRawUnsafe<Array<{id:string;roundLabel:string;opponentName:string|null;matchDate:string|null;status:string;availabilityDeadline:string|null;availabilityLocked:boolean}>>(`
      SELECT id::text AS id,round_label AS "roundLabel",opponent_name AS "opponentName",match_date AS "matchDate",status,
        availability_deadline AS "availabilityDeadline",availability_locked AS "availabilityLocked"
      FROM football_team_sheets WHERE club_id=$1 ORDER BY match_date DESC NULLS LAST,created_at DESC LIMIT 30
    `, req.params.clubId)
    const sheetId = requested && sheets.some(sheet => sheet.id === requested) ? requested : sheets[0]?.id
    const players = await prisma.$queryRawUnsafe<Array<{id:string;playerName:string;jumperNumber:number|null;active:boolean;status:string|null;reason:string|null;note:string|null;respondedAt:string|null;updatedBy:string|null;hasInvite:boolean}>>(`
      SELECT cp.id::text AS id,cp.player_name AS "playerName",cp.jumper_number AS "jumperNumber",cp.active,
        a.status,a.reason,a.note,a.responded_at AS "respondedAt",a.updated_by AS "updatedBy",
        EXISTS(SELECT 1 FROM football_player_availability_access x WHERE x.club_player_id=cp.id) AS "hasInvite"
      FROM football_club_players cp
      LEFT JOIN football_player_availability a ON a.club_player_id=cp.id AND a.team_sheet_id=$2::uuid
      WHERE cp.club_id=$1 AND cp.active=true ORDER BY cp.player_name
    `, req.params.clubId, sheetId ?? null)
    res.json({ data: { sheets, selectedSheetId: sheetId ?? null, players }, reasons: REASONS, statuses: STATUSES })
  } catch (error) { res.status(500).json({ error: 'Unable to load player availability', detail: String(error) }) }
})

coachRouter.post('/clubs/:clubId/players/:clubPlayerId/invite', async (req, res) => {
  try {
    await ensureAvailabilityTables()
    const player = await prisma.$queryRawUnsafe<Array<{id:string;playerName:string}>>(`SELECT id::text AS id,player_name AS "playerName" FROM football_club_players WHERE id::text=$1 AND club_id=$2 LIMIT 1`, req.params.clubPlayerId, req.params.clubId)
    if (!player[0]) return res.status(404).json({ error: 'Player not found for this club' })
    const token = randomBytes(32).toString('hex')
    await prisma.$executeRawUnsafe(`INSERT INTO football_player_availability_access(club_player_id,token_hash,updated_at) VALUES($1::uuid,$2,now()) ON CONFLICT(club_player_id) DO UPDATE SET token_hash=EXCLUDED.token_hash,updated_at=now()`, req.params.clubPlayerId, hashToken(token))
    res.status(201).json({ data: { playerName: player[0].playerName, invitePath: `/player-availability/${token}` } })
  } catch (error) { res.status(500).json({ error: 'Unable to create player availability link', detail: String(error) }) }
})

coachRouter.put('/clubs/:clubId/sheets/:sheetId/settings', async (req, res) => {
  try {
    await ensureAvailabilityTables()
    const sheet = await sheetForClub(req.params.sheetId, req.params.clubId)
    if (!sheet) return res.status(404).json({ error: 'Team sheet not found for this club' })
    const deadline = req.body?.deadline ? new Date(String(req.body.deadline)) : null
    if (deadline && Number.isNaN(deadline.getTime())) return res.status(400).json({ error: 'Enter a valid availability deadline' })
    const locked = Boolean(req.body?.locked)
    await prisma.$executeRawUnsafe(`UPDATE football_team_sheets SET availability_deadline=$2::timestamptz,availability_locked=$3,updated_at=now() WHERE id::text=$1`, req.params.sheetId, deadline?.toISOString() ?? null, locked)
    res.json({ data: { deadline: deadline?.toISOString() ?? null, locked } })
  } catch (error) { res.status(500).json({ error: 'Unable to update availability settings', detail: String(error) }) }
})

coachRouter.put('/clubs/:clubId/sheets/:sheetId/players/:clubPlayerId/override', async (req, res) => {
  try {
    await ensureAvailabilityTables()
    const sheet = await sheetForClub(req.params.sheetId, req.params.clubId)
    if (!sheet) return res.status(404).json({ error: 'Team sheet not found for this club' })
    const player = await prisma.$queryRawUnsafe<Array<{id:string}>>(`SELECT id::text AS id FROM football_club_players WHERE id::text=$1 AND club_id=$2 LIMIT 1`, req.params.clubPlayerId, req.params.clubId)
    if (!player[0]) return res.status(404).json({ error: 'Player not found for this club' })
    const status = clean(req.body?.status, 20).toUpperCase() as AvailabilityStatus
    const reasonText = clean(req.body?.reason, 40).toUpperCase()
    const reason = reasonText ? reasonText as AvailabilityReason : null
    const overrideReason = clean(req.body?.overrideReason, 300)
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid availability status' })
    if (status === 'UNAVAILABLE' && (!reason || !REASONS.includes(reason))) return res.status(400).json({ error: 'Choose why the player is unavailable' })
    if (!overrideReason) return res.status(400).json({ error: 'Enter an override reason' })
    await writeAvailability({ sheetId:req.params.sheetId, clubPlayerId:req.params.clubPlayerId, status, reason:status==='UNAVAILABLE'?reason:null, note:clean(req.body?.note,500)||null, actor:'COACH', overrideReason })
    res.json({ message: 'Player availability overridden' })
  } catch (error) { res.status(500).json({ error: 'Unable to override player availability', detail: String(error) }) }
})

const playerRouter = Router()
playerRouter.get('/:token', async (req, res) => {
  try {
    await ensureAvailabilityTables()
    const access = await prisma.$queryRawUnsafe<Array<{clubPlayerId:string;playerName:string;clubId:string;clubName:string}>>(`
      SELECT cp.id::text AS "clubPlayerId",cp.player_name AS "playerName",cp.club_id AS "clubId",c.name AS "clubName"
      FROM football_player_availability_access a JOIN football_club_players cp ON cp.id=a.club_player_id JOIN clubs c ON c.id::text=cp.club_id
      WHERE a.token_hash=$1 LIMIT 1
    `, hashToken(req.params.token))
    if (!access[0]) return res.status(404).json({ error: 'This player availability link is invalid' })
    const sheets = await prisma.$queryRawUnsafe<Array<{id:string;roundLabel:string;opponentName:string|null;matchDate:string|null;availabilityDeadline:string|null;availabilityLocked:boolean;status:string|null;reason:string|null;note:string|null}>>(`
      SELECT s.id::text AS id,s.round_label AS "roundLabel",s.opponent_name AS "opponentName",s.match_date AS "matchDate",
        s.availability_deadline AS "availabilityDeadline",s.availability_locked AS "availabilityLocked",a.status,a.reason,a.note
      FROM football_team_sheets s LEFT JOIN football_player_availability a ON a.team_sheet_id=s.id AND a.club_player_id=$2::uuid
      WHERE s.club_id=$1 AND (s.match_date IS NULL OR s.match_date >= CURRENT_DATE - INTERVAL '1 day')
      ORDER BY s.match_date ASC NULLS LAST,s.created_at DESC LIMIT 12
    `, access[0].clubId, access[0].clubPlayerId)
    res.set('Cache-Control', 'no-store')
    res.json({ data: { player: access[0], sheets }, reasons: REASONS, statuses: STATUSES })
  } catch (error) { res.status(500).json({ error: 'Unable to load player availability', detail: String(error) }) }
})

playerRouter.put('/:token/sheets/:sheetId', async (req, res) => {
  try {
    await ensureAvailabilityTables()
    const access = await prisma.$queryRawUnsafe<Array<{clubPlayerId:string;clubId:string}>>(`SELECT cp.id::text AS "clubPlayerId",cp.club_id AS "clubId" FROM football_player_availability_access a JOIN football_club_players cp ON cp.id=a.club_player_id WHERE a.token_hash=$1 LIMIT 1`, hashToken(req.params.token))
    if (!access[0]) return res.status(404).json({ error: 'This player availability link is invalid' })
    const sheet = await sheetForClub(req.params.sheetId, access[0].clubId)
    if (!sheet) return res.status(404).json({ error: 'Round not found' })
    const deadlinePassed = Boolean(sheet.availabilityDeadline && new Date(sheet.availabilityDeadline).getTime() <= Date.now())
    if (sheet.availabilityLocked || deadlinePassed) return res.status(423).json({ error: 'Availability is locked for this round. Contact your coach to make a change.' })
    const status = clean(req.body?.status, 20).toUpperCase() as AvailabilityStatus
    const reasonText = clean(req.body?.reason, 40).toUpperCase()
    const reason = reasonText ? reasonText as AvailabilityReason : null
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Choose Available, Unavailable or Not sure' })
    if (status === 'UNAVAILABLE' && (!reason || !REASONS.includes(reason))) return res.status(400).json({ error: 'Choose why you are unavailable' })
    await writeAvailability({ sheetId:req.params.sheetId, clubPlayerId:access[0].clubPlayerId, status, reason:status==='UNAVAILABLE'?reason:null, note:clean(req.body?.note,500)||null, actor:'PLAYER', overrideReason:null })
    res.json({ message: 'Availability saved', data: { status, reason:status==='UNAVAILABLE'?reason:null } })
  } catch (error) { res.status(500).json({ error: 'Unable to save player availability', detail: String(error) }) }
})

export { coachRouter as clubPlayerAvailabilityRouter, playerRouter as playerAvailabilityRouter, ensureAvailabilityTables }
