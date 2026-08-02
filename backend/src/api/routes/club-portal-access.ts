import { Router } from 'express'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { prisma } from '../../db/client.js'
import { publicRateLimit } from '../middleware/rate-limit.js'
import { logChanges } from '../../services/change-log.service.js'
import { clubMembershipsRouter } from './club-memberships.js'
import { clubTeamSheetsRouter } from './club-team-sheets.js'
import { clubPlayerAvailabilityRouter } from './player-availability.js'
import { clubCoachWhiteboardRouter } from './club-coach-whiteboard.js'
import { clubTrainingAttendanceRouter } from './club-training-attendance.js'
import { clubOppositionPlansRouter } from './club-opposition-plans.js'
import { clubPlayerDevelopmentRouter } from './club-player-development.js'
import { clubPortalNewsRouter } from './club-portal-news.js'
import { clubProfileManagementRouter } from './club-profile-management.js'
import { clubPortalSponsorsRouter } from './club-portal-sponsors.js'
import { clubPortalUsersRouter } from './club-portal-users.js'
import { clubPortalActivityRouter } from './club-portal-activity.js'
import { clubPortalPlansRouter, adminClubPlansRouter } from './club-portal-plans.js'
import { clubOperationsRouter } from './club-operations.js'
import { clubMatchDayRouter } from './club-match-day.js'
import { clubMediaRouter } from './club-media.js'
import { clubMilestonesRouter } from './club-milestones.js'
import { clubMediaPublishingRouter } from './club-media-publishing.js'
import { clubAiGraphicsRouter } from './club-ai-graphics.js'
import { clubHqCoordinationRouter } from './club-hq-coordination.js'
import { adminClubMembershipsRouter } from '../../admin/club-memberships.js'

const router = Router()
const editableProfileFields = ['ground','address','googleMapsUrl','websiteUrl','facebookUrl','instagramUrl','tiktokUrl','youtubeUrl','email','phone','trainingNights','homeCourt','clubColours','history','foundedYear','committee','president','secretary','coach','assistantCoach','membershipLink','volunteerLink'] as const
let ready:Promise<void>|null=null
export function ensureClubPortalAccessTable(){if(!ready)ready=prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "club_portal_access" ("id" TEXT PRIMARY KEY,"club_id" TEXT NOT NULL,"user_id" TEXT,"email" TEXT NOT NULL,"token_hash" TEXT NOT NULL UNIQUE,"expires_at" TIMESTAMPTZ NOT NULL,"last_used_at" TIMESTAMPTZ,"revoked_at" TIMESTAMPTZ,"created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW())`).then(async()=>{await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "club_portal_access_club_idx" ON "club_portal_access" ("club_id","revoked_at")`)}).catch(error=>{ready=null;throw error});return ready}
const hashToken=(token:string)=>createHash('sha256').update(token).digest('hex')
export async function issueClubPortalAccess(clubId:string,email:string,userId?:string|null){await ensureClubPortalAccessTable();const token=randomBytes(32).toString('hex');await prisma.$executeRawUnsafe(`INSERT INTO club_portal_access (id,club_id,user_id,email,token_hash,expires_at) VALUES ($1,$2,$3,$4,$5,$6)`,randomUUID(),clubId,userId??null,email.trim().toLowerCase(),hashToken(token),new Date(Date.now()+30*86400000));return token}
async function resolveAccess(token:string){await ensureClubPortalAccessTable();const rows=await prisma.$queryRawUnsafe<Array<{id:string;clubId:string;userId:string|null;email:string;expiresAt:Date}>>(`SELECT id,club_id AS "clubId",user_id AS "userId",email,expires_at AS "expiresAt" FROM club_portal_access WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>NOW() LIMIT 1`,hashToken(token));return rows[0]??null}

router.use('/admin/plans',adminClubPlansRouter)
router.use('/admin',adminClubMembershipsRouter)
router.use(publicRateLimit)
router.get('/session',async(req,res)=>{const token=typeof req.query.token==='string'?req.query.token:'';if(!token)return res.status(400).json({error:'access token required'});const access=await resolveAccess(token);if(!access)return res.status(401).json({error:'This club access link is invalid or has expired'});const club=await prisma.club.findUnique({where:{id:access.clubId},select:{id:true,name:true,logoUrl:true,description:true,primaryColour:true,secondaryColour:true,websiteUrl:true,facebookUrl:true,instagramUrl:true}});if(!club)return res.status(404).json({error:'Club not found'});const profile=await prisma.clubProfile.upsert({where:{clubId:access.clubId},create:{clubId:access.clubId},update:{}});await prisma.$executeRawUnsafe(`UPDATE club_portal_access SET last_used_at=NOW() WHERE id=$1`,access.id);res.json({data:{club,profile,access:{email:access.email,expiresAt:access.expiresAt}}})})
router.patch('/profile',async(req,res)=>{const token=typeof req.body?.token==='string'?req.body.token:'';const access=token?await resolveAccess(token):null;if(!access)return res.status(401).json({error:'This club access link is invalid or has expired'});const body=(req.body?.profile??{}) as Record<string,unknown>;const updates:Record<string,unknown>={};for(const field of editableProfileFields)if(field in body)updates[field]=body[field]===''?null:body[field];if(!Object.keys(updates).length)return res.status(400).json({error:'No editable profile fields supplied'});const before=await prisma.clubProfile.upsert({where:{clubId:access.clubId},create:{clubId:access.clubId},update:{}});const profile=await prisma.clubProfile.update({where:{clubId:access.clubId},data:updates as never});const coreUpdates:Record<string,unknown>={};if('websiteUrl'in updates)coreUpdates.websiteUrl=updates.websiteUrl;if('facebookUrl'in updates)coreUpdates.facebookUrl=updates.facebookUrl;if('instagramUrl'in updates)coreUpdates.instagramUrl=updates.instagramUrl;if('history'in updates)coreUpdates.description=updates.history;if(Object.keys(coreUpdates).length)await prisma.club.update({where:{id:access.clubId},data:coreUpdates as never});await logChanges('Club',access.clubId,before,updates,{actorType:'USER',actorId:access.userId});res.json({data:profile,message:'Club profile saved'})})
router.post('/revoke',async(req,res)=>{const token=typeof req.body?.token==='string'?req.body.token:'';if(!token)return res.status(400).json({error:'access token required'});await ensureClubPortalAccessTable();await prisma.$executeRawUnsafe(`UPDATE club_portal_access SET revoked_at=NOW() WHERE token_hash=$1`,hashToken(token));res.json({data:{revoked:true}})})
router.use('/coordination',clubHqCoordinationRouter)
router.use('/ai-graphics',clubAiGraphicsRouter)
router.use('/media-publishing',clubMediaPublishingRouter)
router.use('/milestones',clubMilestonesRouter)
router.use('/media',clubMediaRouter)
router.use('/operations',clubOperationsRouter)
router.use('/match-day',clubMatchDayRouter)
router.use('/availability',clubPlayerAvailabilityRouter)
router.use('/team-sheets',clubTeamSheetsRouter)
router.use('/whiteboard',clubCoachWhiteboardRouter)
router.use('/training',clubTrainingAttendanceRouter)
router.use('/opposition',clubOppositionPlansRouter)
router.use('/player-development',clubPlayerDevelopmentRouter)
router.use('/profile-management',clubProfileManagementRouter)
router.use('/',clubPortalPlansRouter)
router.use('/',clubPortalActivityRouter)
router.use('/',clubPortalUsersRouter)
router.use('/',clubPortalSponsorsRouter)
router.use('/',clubPortalNewsRouter)
router.use('/',clubMembershipsRouter)
export {router as clubPortalAccessRouter}
