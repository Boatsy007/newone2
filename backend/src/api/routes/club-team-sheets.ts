import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, requireActiveClubMembership, roleCan } from '../../auth/club-auth.js'
import { upsertCanonicalGoalKicker } from '../../services/canonical-goal-kicker-upsert.js'
import { ensureAvailabilityTables } from './player-availability.js'

const POSITIONS = ['BP_LEFT','FB','BP_RIGHT','HBF_LEFT','CHB','HBF_RIGHT','WING_LEFT','CENTRE','WING_RIGHT','HFF_LEFT','CHF','HFF_RIGHT','FP_LEFT','FF','FP_RIGHT','RUCK','RUCK_ROVER','ROVER','INTERCHANGE_1','INTERCHANGE_2','INTERCHANGE_3','INTERCHANGE_4','EMERGENCY_1','EMERGENCY_2','EMERGENCY_3'] as const
const router = Router()

let tablesReady: Promise<void> | null = null
function ensureTables() {
  if (!tablesReady) tablesReady = (async () => {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS football_club_players (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), club_id text NOT NULL, player_id text NULL,
      player_name text NOT NULL, jumper_number integer NULL, preferred_position text NULL,
      active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS football_club_players_identity ON football_club_players (club_id, lower(player_name))`)
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS football_team_sheets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), club_id text NOT NULL, league_id text NULL,
      season text NOT NULL, grade text NOT NULL DEFAULT 'Senior Football', round_label text NOT NULL,
      opponent_name text NULL, match_date date NULL, status text NOT NULL DEFAULT 'DRAFT',
      published_at timestamptz NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`)
    await prisma.$executeRawUnsafe(`ALTER TABLE football_team_sheets ADD COLUMN IF NOT EXISTS fixture_id text NULL`)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS football_team_sheets_identity ON football_team_sheets (club_id, season, grade, round_label)`)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS football_team_sheets_fixture_identity ON football_team_sheets (club_id, fixture_id) WHERE fixture_id IS NOT NULL`)
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS football_team_sheet_players (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), team_sheet_id uuid NOT NULL REFERENCES football_team_sheets(id) ON DELETE CASCADE,
      club_player_id uuid NOT NULL REFERENCES football_club_players(id) ON DELETE CASCADE, position_code text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(team_sheet_id, club_player_id), UNIQUE(team_sheet_id, position_code))`)
  })().catch(error => { tablesReady = null; throw error })
  return tablesReady
}

function normaliseRound(value: unknown) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (!/^round\b/i.test(raw)) return raw
  const suffix = raw.replace(/^(?:round\s+)+/i, '').trim()
  return suffix ? `Round ${suffix}` : 'Round'
}

type Membership = { role: Parameters<typeof roleCan>[0] }
type ClubPlayer = { id:string; playerId:string|null; playerName:string; jumperNumber:number|null; preferredPosition:string|null; active:boolean }
type Sheet = { id:string; clubId:string; clubName:string|null; leagueId:string|null; leagueName:string|null; fixtureId:string|null; season:string; grade:string; roundLabel:string; opponentName:string|null; matchDate:string|null; status:string; publishedAt:string|null }
type Fixture = { id:string; leagueId:string; season:string; grade:string; round:string|null; homeClubId:string|null; awayClubId:string|null; homeName:string; awayName:string; matchDate:Date|null }

function allowTeamSelection(req: any, res: any, next: any) {
  const membership = res.locals.clubMembership as Membership | undefined
  if (!membership || !roleCan(membership.role, 'team_selection')) return res.status(403).json({ error: 'Your club role cannot manage team selection' })
  next()
}

async function fixtureForClub(fixtureId: string, clubId: string) {
  const rows = await prisma.$queryRawUnsafe<Fixture[]>(`SELECT id::text AS id,league_id AS "leagueId",season,grade,round,home_club_id AS "homeClubId",away_club_id AS "awayClubId",home_name AS "homeName",away_name AS "awayName",match_date AS "matchDate" FROM football_fixtures WHERE id::text=$1 AND (home_club_id=$2 OR away_club_id=$2) LIMIT 1`, fixtureId, clubId)
  return rows[0] ?? null
}

async function loadSheet(sheetId: string): Promise<(Sheet & { players:Array<ClubPlayer & {clubPlayerId:string;positionCode:string}> }) | null> {
  const rows = await prisma.$queryRawUnsafe<Sheet[]>(`SELECT s.id::text AS id,s.club_id AS "clubId",c.name AS "clubName",s.league_id AS "leagueId",l.name AS "leagueName",s.fixture_id AS "fixtureId",s.season,s.grade,s.round_label AS "roundLabel",s.opponent_name AS "opponentName",s.match_date AS "matchDate",s.status,s.published_at AS "publishedAt" FROM football_team_sheets s LEFT JOIN clubs c ON c.id::text=s.club_id LEFT JOIN leagues l ON l.id::text=s.league_id WHERE s.id::text=$1`, sheetId)
  const sheet = rows[0]
  if (!sheet) return null
  const players = await prisma.$queryRawUnsafe<Array<ClubPlayer & {clubPlayerId:string;positionCode:string}>>(`SELECT cp.id::text AS "clubPlayerId",cp.id::text AS id,cp.player_id AS "playerId",cp.player_name AS "playerName",cp.jumper_number AS "jumperNumber",cp.preferred_position AS "preferredPosition",cp.active,tsp.position_code AS "positionCode" FROM football_team_sheet_players tsp JOIN football_club_players cp ON cp.id=tsp.club_player_id WHERE tsp.team_sheet_id::text=$1 ORDER BY tsp.position_code`, sheetId)
  return { ...sheet, roundLabel: normaliseRound(sheet.roundLabel), players }
}

async function sheetForClub(sheetId: string, clubId: string) {
  const sheet = await loadSheet(sheetId)
  return sheet?.clubId === clubId ? sheet : null
}

async function ensurePlayerProfile(player: ClubPlayer, sheet: Sheet) {
  if (player.playerId) return player.playerId
  if (!sheet.clubName || !sheet.leagueId || !sheet.leagueName) return null
  const result = await upsertCanonicalGoalKicker({ playerName:player.playerName,clubId:sheet.clubId,clubName:sheet.clubName,leagueId:sheet.leagueId,leagueName:sheet.leagueName,season:sheet.season,grade:sheet.grade,goals:0,matches:null,sourceUrl:null,sourceType:'MANUAL_ENTRY' })
  await prisma.$executeRawUnsafe(`UPDATE football_club_players SET player_id=$2,updated_at=now() WHERE id::text=$1`, player.id, result.playerRowId)
  return result.playerRowId
}

router.use(authenticateClubUser)
router.use('/clubs/:clubId', requireActiveClubMembership, allowTeamSelection)

router.get('/clubs/:clubId/players', async (req,res) => {
  try {
    await ensureTables(); await ensureAvailabilityTables()
    const sheetId=String(req.query.sheetId??'').trim()
    if(sheetId){const sheet=await sheetForClub(sheetId,req.params.clubId);if(!sheet)return res.status(404).json({error:'Team sheet not found for this club'})}
    const rows=await prisma.$queryRawUnsafe(`SELECT cp.id::text AS id,cp.player_id AS "playerId",cp.player_name AS "playerName",cp.jumper_number AS "jumperNumber",cp.preferred_position AS "preferredPosition",cp.active,a.status AS "availabilityStatus",a.reason AS "availabilityReason" FROM football_club_players cp LEFT JOIN football_player_availability a ON a.club_player_id=cp.id AND a.team_sheet_id::text=$2 WHERE cp.club_id=$1 ORDER BY cp.active DESC,cp.player_name`,req.params.clubId,sheetId)
    res.json({data:rows,positions:POSITIONS})
  }
  catch(error){res.status(500).json({error:'failed to load club players',detail:String(error)})}
})

router.post('/clubs/:clubId/players', async (req,res) => {
  try {
    await ensureTables(); const playerName=String(req.body?.playerName??'').trim(); if(!playerName)return res.status(400).json({error:'playerName is required'})
    const jumper=req.body?.jumperNumber===''||req.body?.jumperNumber==null?null:Number(req.body.jumperNumber)
    const rows=await prisma.$queryRawUnsafe<ClubPlayer[]>(`INSERT INTO football_club_players (club_id,player_id,player_name,jumper_number,preferred_position) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (club_id,lower(player_name)) DO UPDATE SET jumper_number=EXCLUDED.jumper_number,preferred_position=EXCLUDED.preferred_position,active=true,updated_at=now() RETURNING id::text AS id,player_id AS "playerId",player_name AS "playerName",jumper_number AS "jumperNumber",preferred_position AS "preferredPosition",active`,req.params.clubId,req.body?.playerId?String(req.body.playerId):null,playerName,Number.isFinite(jumper)?jumper:null,req.body?.preferredPosition?String(req.body.preferredPosition):null)
    res.status(201).json({data:rows[0]})
  } catch(error){res.status(500).json({error:'failed to save club player',detail:String(error)})}
})

router.get('/clubs/:clubId/sheets/:sheetId/opposition', async (req,res) => {
  try {
    await ensureTables()
    const current = await sheetForClub(req.params.sheetId, req.params.clubId)
    if (!current) return res.status(404).json({ error:'Team sheet not found for this club' })
    if (!current.fixtureId) return res.json({ data:null })

    const fixtureRows = await prisma.$queryRawUnsafe<Array<{
      homeClubId:string|null;awayClubId:string|null;homeName:string;awayName:string;
      leagueId:string;season:string;grade:string;round:string|null;matchDate:string|null
    }>>(`
      SELECT home_club_id AS "homeClubId",away_club_id AS "awayClubId",
        home_name AS "homeName",away_name AS "awayName",league_id AS "leagueId",
        season,grade,round,match_date AS "matchDate"
      FROM football_fixtures WHERE id::text=$1 LIMIT 1
    `, current.fixtureId)
    const fixture = fixtureRows[0]
    if (!fixture) return res.json({ data:null })

    const currentIsHome = fixture.homeClubId === req.params.clubId || fixture.homeClubId === current.clubId
    const opponentCanonicalId = currentIsHome ? fixture.awayClubId : fixture.homeClubId
    const opponentName = currentIsHome ? fixture.awayName : fixture.homeName
    if (!opponentCanonicalId) return res.json({ data:null })

    // Strongest relationship: the other selected side already linked to this exact fixture.
    const linkedRows = await prisma.$queryRawUnsafe<Array<{id:string}>>(`
      SELECT s.id::text AS id
      FROM football_team_sheets s
      JOIN football_team_sheet_players tsp ON tsp.team_sheet_id=s.id
      WHERE s.fixture_id=$1 AND s.id::text<>$2
        AND s.status IN ('DRAFT','PUBLISHED')
      GROUP BY s.id
      HAVING COUNT(tsp.id)>0
      ORDER BY CASE WHEN s.status='PUBLISHED' THEN 0 ELSE 1 END,s.updated_at DESC
      LIMIT 1
    `, current.fixtureId, current.id)
    if (linkedRows[0]) {
      const opposition = await loadSheet(linkedRows[0].id)
      return res.json({ data:opposition ? { ...opposition, clubId:undefined } : null })
    }

    // Resolve the opponent's authorised team record the same way the app does, but do not
    // require identical grade label text. League + season + exact team identity own this link;
    // grade is only a preference because legacy/admin labels can differ from fixture labels.
    const authorisedRows = await prisma.$queryRawUnsafe<Array<{clubId:string;grade:string}>>(`
      SELECT c.id::text AS "clubId",COALESCE(cls.grade,'') AS grade
      FROM club_league_seasons cls
      JOIN clubs c ON c.id=cls.club_id
      WHERE cls.league_id::text=$1
        AND cls.season=$2
        AND cls.is_active=true
        AND regexp_replace(lower(coalesce(c.name,'')),'[^a-z0-9]','','g')=
            regexp_replace(lower(coalesce($3,'')),'[^a-z0-9]','','g')
      ORDER BY
        CASE WHEN c.id::text=$4 THEN 0 ELSE 1 END,
        CASE WHEN regexp_replace(lower(coalesce(cls.grade,'')),'[^a-z0-9]','','g')=
                  regexp_replace(lower(coalesce($5,'')),'[^a-z0-9]','','g') THEN 0 ELSE 1 END
      LIMIT 1
    `, fixture.leagueId, fixture.season, opponentName, opponentCanonicalId, fixture.grade)

    const opponentClubId = authorisedRows[0]?.clubId ?? opponentCanonicalId

    // Load the existing selected side owned by that exact opponent team record.
    const sheetRows = await prisma.$queryRawUnsafe<Array<{id:string}>>(`
      SELECT s.id::text AS id
      FROM football_team_sheets s
      JOIN football_team_sheet_players tsp ON tsp.team_sheet_id=s.id
      WHERE s.club_id=$1 AND s.season=$2
        AND (s.league_id=$3 OR s.league_id IS NULL)
        AND s.status IN ('DRAFT','PUBLISHED')
      GROUP BY s.id
      HAVING COUNT(tsp.id)>0
      ORDER BY
        CASE WHEN s.fixture_id=$4 THEN 0 ELSE 1 END,
        CASE WHEN regexp_replace(lower(coalesce(s.grade,'')),'[^a-z0-9]','','g')=
                  regexp_replace(lower(coalesce($5,'')),'[^a-z0-9]','','g') THEN 0 ELSE 1 END,
        CASE WHEN regexp_replace(lower(coalesce(s.round_label,'')),'[^a-z0-9]','','g')=
                  regexp_replace(lower(coalesce($6,'')),'[^a-z0-9]','','g') THEN 0 ELSE 1 END,
        CASE WHEN s.match_date IS NOT NULL AND $7::date IS NOT NULL AND s.match_date=$7::date THEN 0 ELSE 1 END,
        s.updated_at DESC
      LIMIT 1
    `, opponentClubId, fixture.season, fixture.leagueId, current.fixtureId, fixture.grade, fixture.round, fixture.matchDate)

    if (!sheetRows[0]) return res.json({ data:null })
    const opposition = await loadSheet(sheetRows[0].id)
    res.json({ data:opposition ? { ...opposition, clubId:undefined } : null })
  } catch(error) {
    res.status(500).json({ error:'failed to load opposition selected team',detail:String(error) })
  }
})

router.get('/clubs/:clubId/sheets', async (req,res) => {
  try { await ensureTables(); const rows=await prisma.$queryRawUnsafe<Array<{id:string}>>(`SELECT id::text AS id FROM football_team_sheets WHERE club_id=$1 ORDER BY match_date DESC NULLS LAST,created_at DESC`,req.params.clubId); const data=await Promise.all(rows.map(row=>loadSheet(row.id))); res.json({data:data.filter(Boolean),positions:POSITIONS}) }
  catch(error){res.status(500).json({error:'failed to load team sheets',detail:String(error)})}
})

router.post('/clubs/:clubId/sheets', async (req,res) => {
  try {
    await ensureTables()
    const requestedFixtureId=req.body?.fixtureId?String(req.body.fixtureId).trim():''
    const fixture=requestedFixtureId?await fixtureForClub(requestedFixtureId,req.params.clubId):null
    if(requestedFixtureId&&!fixture)return res.status(400).json({error:'Fixture not found for this club'})
    const season=String(fixture?.season??req.body?.season??new Date().getFullYear())
    const grade=String(fixture?.grade??req.body?.grade??'Senior Football').trim()
    const roundLabel=normaliseRound(fixture?.round??req.body?.roundLabel)
    if(!roundLabel)return res.status(400).json({error:'roundLabel is required'})
    const isHome=fixture?.homeClubId===req.params.clubId
    const opponentName=fixture?(isHome?fixture.awayName:fixture.homeName):(req.body?.opponentName?String(req.body.opponentName):null)
    const matchDate=fixture?.matchDate?fixture.matchDate.toISOString().slice(0,10):(req.body?.matchDate?String(req.body.matchDate).slice(0,10):null)
    const leagueId=fixture?.leagueId??(req.body?.leagueId?String(req.body.leagueId):null)
    const rows=requestedFixtureId
      ? await prisma.$queryRawUnsafe<Array<{id:string}>>(`INSERT INTO football_team_sheets (club_id,league_id,fixture_id,season,grade,round_label,opponent_name,match_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date) ON CONFLICT (club_id,fixture_id) WHERE fixture_id IS NOT NULL DO UPDATE SET league_id=EXCLUDED.league_id,season=EXCLUDED.season,grade=EXCLUDED.grade,round_label=EXCLUDED.round_label,opponent_name=EXCLUDED.opponent_name,match_date=EXCLUDED.match_date,updated_at=now() RETURNING id::text AS id`,req.params.clubId,leagueId,requestedFixtureId,season,grade,roundLabel,opponentName,matchDate)
      : await prisma.$queryRawUnsafe<Array<{id:string}>>(`INSERT INTO football_team_sheets (club_id,league_id,season,grade,round_label,opponent_name,match_date) VALUES ($1,$2,$3,$4,$5,$6,$7::date) ON CONFLICT (club_id,season,grade,round_label) DO UPDATE SET league_id=EXCLUDED.league_id,opponent_name=EXCLUDED.opponent_name,match_date=EXCLUDED.match_date,updated_at=now() RETURNING id::text AS id`,req.params.clubId,leagueId,season,grade,roundLabel,opponentName,matchDate)
    res.status(201).json({data:await loadSheet(rows[0].id)})
  } catch(error){res.status(500).json({error:'failed to create team sheet',detail:String(error)})}
})

router.put('/clubs/:clubId/sheets/:sheetId/positions', async (req,res) => {
  try {
    await ensureTables(); await ensureAvailabilityTables(); const sheet=await sheetForClub(req.params.sheetId,req.params.clubId); if(!sheet)return res.status(404).json({error:'Team sheet not found for this club'})
    const incoming=Array.isArray(req.body?.positions)?req.body.positions:[]
    const clean=incoming.map((row:any)=>({positionCode:String(row.positionCode??''),clubPlayerId:String(row.clubPlayerId??'')})).filter((row:any)=>POSITIONS.includes(row.positionCode as any)&&row.clubPlayerId)
    if(new Set(clean.map((r:any)=>r.positionCode)).size!==clean.length||new Set(clean.map((r:any)=>r.clubPlayerId)).size!==clean.length)return res.status(400).json({error:'Each player and position can only be used once'})
    if(clean.length){const unavailable=await prisma.$queryRawUnsafe<Array<{playerName:string;reason:string|null}>>(`SELECT cp.player_name AS "playerName",a.reason FROM football_player_availability a JOIN football_club_players cp ON cp.id=a.club_player_id WHERE a.team_sheet_id=$1::uuid AND a.club_player_id=ANY($2::uuid[]) AND a.status='UNAVAILABLE'`,req.params.sheetId,clean.map((r:any)=>r.clubPlayerId));if(unavailable.length)return res.status(409).json({error:`Unavailable player${unavailable.length===1?'':'s'} cannot be selected: ${unavailable.map(p=>`${p.playerName}${p.reason?` (${p.reason.toLowerCase()})`:''}`).join(', ')}. Use Player availability to record a coach override first.`})}
    const players=clean.length?await prisma.$queryRawUnsafe<ClubPlayer[]>(`SELECT id::text AS id,player_id AS "playerId",player_name AS "playerName",jumper_number AS "jumperNumber",preferred_position AS "preferredPosition",active FROM football_club_players WHERE club_id=$1 AND id=ANY($2::uuid[])`,req.params.clubId,clean.map((r:any)=>r.clubPlayerId)):[]
    for(const player of players)await ensurePlayerProfile(player,sheet)
    await prisma.$transaction(async tx=>{await tx.$executeRawUnsafe(`DELETE FROM football_team_sheet_players WHERE team_sheet_id::text=$1`,req.params.sheetId);for(const row of clean)await tx.$executeRawUnsafe(`INSERT INTO football_team_sheet_players (team_sheet_id,club_player_id,position_code) VALUES ($1::uuid,$2::uuid,$3)`,req.params.sheetId,row.clubPlayerId,row.positionCode)})
    res.json({data:await loadSheet(req.params.sheetId),profilesLinked:players.length})
  } catch(error){res.status(500).json({error:'failed to save positions',detail:String(error)})}
})

router.put('/clubs/:clubId/sheets/:sheetId', async (req,res) => {
  try {
    await ensureTables(); const sheet=await sheetForClub(req.params.sheetId,req.params.clubId); if(!sheet)return res.status(404).json({error:'Team sheet not found for this club'})
    const requestedFixtureId=req.body?.fixtureId?String(req.body.fixtureId).trim():''
    if(requestedFixtureId&&requestedFixtureId!==sheet.fixtureId){const fixture=await fixtureForClub(requestedFixtureId,req.params.clubId);if(!fixture)return res.status(400).json({error:'Fixture not found for this club'})}
    const status=String(req.body?.status??'DRAFT').toUpperCase()==='PUBLISHED'?'PUBLISHED':'DRAFT'
    if(status==='PUBLISHED'){const counts=await prisma.$queryRawUnsafe<Array<{count:number}>>(`SELECT COUNT(*)::int AS count FROM football_team_sheet_players WHERE team_sheet_id=$1::uuid`,req.params.sheetId);if(!counts[0]?.count)return res.status(400).json({error:'Save at least one player position before publishing the team'})}
    await prisma.$executeRawUnsafe(`UPDATE football_team_sheets SET status=$2,published_at=CASE WHEN $2='PUBLISHED' THEN now() ELSE NULL END,opponent_name=COALESCE($3,opponent_name),match_date=COALESCE($4::date,match_date),fixture_id=COALESCE($5,fixture_id),updated_at=now() WHERE id::text=$1`,req.params.sheetId,status,req.body?.opponentName??null,req.body?.matchDate?String(req.body.matchDate).slice(0,10):null,requestedFixtureId||null)
    res.json({data:await loadSheet(req.params.sheetId)})
  } catch(error){res.status(500).json({error:'failed to update team sheet',detail:String(error)})}
})

router.delete('/clubs/:clubId/sheets/:sheetId', async (req,res) => {
  try {
    await ensureTables()
    const sheet=await sheetForClub(req.params.sheetId,req.params.clubId)
    if(!sheet)return res.status(404).json({error:'Team sheet not found for this club'})
    await prisma.$executeRawUnsafe(`DELETE FROM football_team_sheets WHERE id::text=$1 AND club_id=$2`,req.params.sheetId,req.params.clubId)
    res.json({data:{id:req.params.sheetId,deleted:true}})
  } catch(error){res.status(500).json({error:'failed to delete team sheet',detail:String(error)})}
})

export { router as clubTeamSheetsRouter }
