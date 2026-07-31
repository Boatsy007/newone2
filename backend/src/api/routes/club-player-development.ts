import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, requireActiveClubMembership, roleCan } from '../../auth/club-auth.js'

const router = Router()
type Membership={role:Parameters<typeof roleCan>[0]}
let ready:Promise<void>|null=null

function ensureTables(){
 if(!ready)ready=(async()=>{
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS football_player_development_profiles (
   id uuid PRIMARY KEY DEFAULT gen_random_uuid(), club_id text NOT NULL, club_player_id uuid NOT NULL REFERENCES football_club_players(id) ON DELETE CASCADE,
   secondary_positions text NULL, strengths text NULL, development_areas text NULL, fitness_notes text NULL,
   injury_considerations text NULL, role_expectations text NULL, current_focus text NULL, updated_by text NULL,
   created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(club_id,club_player_id))`)
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS football_player_development_goals (
   id uuid PRIMARY KEY DEFAULT gen_random_uuid(), club_id text NOT NULL, club_player_id uuid NOT NULL REFERENCES football_club_players(id) ON DELETE CASCADE,
   title text NOT NULL, target text NULL, coach_notes text NULL, review_date date NULL, status text NOT NULL DEFAULT 'ACTIVE',
   created_by text NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
   CONSTRAINT football_player_development_goal_status CHECK(status IN ('ACTIVE','ACHIEVED','PAUSED')))`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS football_player_development_goals_player ON football_player_development_goals(club_id,club_player_id,created_at DESC)`)
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS football_player_development_updates (
   id uuid PRIMARY KEY DEFAULT gen_random_uuid(), club_id text NOT NULL, club_player_id uuid NOT NULL REFERENCES football_club_players(id) ON DELETE CASCADE,
   goal_id uuid NULL REFERENCES football_player_development_goals(id) ON DELETE SET NULL, note text NOT NULL, rating integer NULL,
   created_by text NULL, created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT football_player_development_rating CHECK(rating IS NULL OR rating BETWEEN 1 AND 5))`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS football_player_development_updates_player ON football_player_development_updates(club_id,club_player_id,created_at DESC)`)
 })().catch(error=>{ready=null;throw error});return ready
}
function allowCoach(_req:any,res:any,next:any){const membership=res.locals.clubMembership as Membership|undefined;if(!membership||!roleCan(membership.role,'team_selection'))return res.status(403).json({error:'Your club role cannot manage player development'});next()}
function text(value:unknown,max=3000){return String(value??'').trim().slice(0,max)||null}
async function validPlayer(clubId:string,playerId:string){const rows=await prisma.$queryRawUnsafe<Array<{id:string}>>(`SELECT id::text AS id FROM football_club_players WHERE club_id=$1 AND id::text=$2 LIMIT 1`,clubId,playerId);return Boolean(rows[0])}

router.use(authenticateClubUser)
router.use('/clubs/:clubId',requireActiveClubMembership,allowCoach)

router.get('/clubs/:clubId',async(req,res)=>{try{await ensureTables();const[players,profiles,goals,updates]=await Promise.all([
 prisma.$queryRawUnsafe(`SELECT id::text AS id,player_name AS "playerName",jumper_number AS "jumperNumber",preferred_position AS "preferredPosition",active FROM football_club_players WHERE club_id=$1 AND active=true ORDER BY player_name`,req.params.clubId),
 prisma.$queryRawUnsafe(`SELECT club_player_id::text AS "clubPlayerId",secondary_positions AS "secondaryPositions",strengths,development_areas AS "developmentAreas",fitness_notes AS "fitnessNotes",injury_considerations AS "injuryConsiderations",role_expectations AS "roleExpectations",current_focus AS "currentFocus",updated_at AS "updatedAt" FROM football_player_development_profiles WHERE club_id=$1`,req.params.clubId),
 prisma.$queryRawUnsafe(`SELECT id::text AS id,club_player_id::text AS "clubPlayerId",title,target,coach_notes AS "coachNotes",review_date::text AS "reviewDate",status,created_at AS "createdAt",updated_at AS "updatedAt" FROM football_player_development_goals WHERE club_id=$1 ORDER BY created_at DESC`,req.params.clubId),
 prisma.$queryRawUnsafe(`SELECT id::text AS id,club_player_id::text AS "clubPlayerId",goal_id::text AS "goalId",note,rating,created_at AS "createdAt" FROM football_player_development_updates WHERE club_id=$1 ORDER BY created_at DESC LIMIT 500`,req.params.clubId)
 ]);res.json({data:{players,profiles,goals,updates}})}catch(error){res.status(500).json({error:'Unable to load player development profiles',detail:String(error)})}})

router.put('/clubs/:clubId/players/:playerId/profile',async(req,res)=>{try{await ensureTables();if(!await validPlayer(req.params.clubId,req.params.playerId))return res.status(404).json({error:'Player not found for this club'});const b=req.body??{};await prisma.$executeRawUnsafe(`INSERT INTO football_player_development_profiles(club_id,club_player_id,secondary_positions,strengths,development_areas,fitness_notes,injury_considerations,role_expectations,current_focus,updated_by) VALUES($1,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(club_id,club_player_id) DO UPDATE SET secondary_positions=EXCLUDED.secondary_positions,strengths=EXCLUDED.strengths,development_areas=EXCLUDED.development_areas,fitness_notes=EXCLUDED.fitness_notes,injury_considerations=EXCLUDED.injury_considerations,role_expectations=EXCLUDED.role_expectations,current_focus=EXCLUDED.current_focus,updated_by=EXCLUDED.updated_by,updated_at=now()`,req.params.clubId,req.params.playerId,text(b.secondaryPositions,1000),text(b.strengths),text(b.developmentAreas),text(b.fitnessNotes),text(b.injuryConsiderations),text(b.roleExpectations),text(b.currentFocus),req.clubUser?.id??null);res.json({message:'Player development profile saved'})}catch(error){res.status(500).json({error:'Unable to save player development profile',detail:String(error)})}})

router.post('/clubs/:clubId/players/:playerId/goals',async(req,res)=>{try{await ensureTables();if(!await validPlayer(req.params.clubId,req.params.playerId))return res.status(404).json({error:'Player not found for this club'});const title=text(req.body?.title,160);if(!title)return res.status(400).json({error:'Goal title is required'});const rows=await prisma.$queryRawUnsafe(`INSERT INTO football_player_development_goals(club_id,club_player_id,title,target,coach_notes,review_date,created_by) VALUES($1,$2::uuid,$3,$4,$5,$6::date,$7) RETURNING id::text AS id`,req.params.clubId,req.params.playerId,title,text(req.body?.target,1200),text(req.body?.coachNotes,2000),req.body?.reviewDate?String(req.body.reviewDate).slice(0,10):null,req.clubUser?.id??null);res.status(201).json({data:(rows as any[])[0],message:'Development goal created'})}catch(error){res.status(500).json({error:'Unable to create development goal',detail:String(error)})}})

router.put('/clubs/:clubId/goals/:goalId',async(req,res)=>{try{await ensureTables();const status=String(req.body?.status??'ACTIVE').toUpperCase();if(!['ACTIVE','ACHIEVED','PAUSED'].includes(status))return res.status(400).json({error:'Invalid goal status'});const count=await prisma.$executeRawUnsafe(`UPDATE football_player_development_goals SET status=$3,updated_at=now() WHERE id::text=$1 AND club_id=$2`,req.params.goalId,req.params.clubId,status);if(!count)return res.status(404).json({error:'Development goal not found'});res.json({message:'Goal status updated'})}catch(error){res.status(500).json({error:'Unable to update development goal',detail:String(error)})}})

router.post('/clubs/:clubId/players/:playerId/updates',async(req,res)=>{try{await ensureTables();if(!await validPlayer(req.params.clubId,req.params.playerId))return res.status(404).json({error:'Player not found for this club'});const note=text(req.body?.note,3000);if(!note)return res.status(400).json({error:'Progress note is required'});const rating=req.body?.rating==null||req.body.rating===''?null:Number(req.body.rating);if(rating!==null&&(!Number.isInteger(rating)||rating<1||rating>5))return res.status(400).json({error:'Rating must be from 1 to 5'});await prisma.$executeRawUnsafe(`INSERT INTO football_player_development_updates(club_id,club_player_id,goal_id,note,rating,created_by) VALUES($1,$2::uuid,$3::uuid,$4,$5,$6)`,req.params.clubId,req.params.playerId,req.body?.goalId?String(req.body.goalId):null,note,rating,req.clubUser?.id??null);res.status(201).json({message:'Progress update added'})}catch(error){res.status(500).json({error:'Unable to add progress update',detail:String(error)})}})

export {router as clubPlayerDevelopmentRouter}
