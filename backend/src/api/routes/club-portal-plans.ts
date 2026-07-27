import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, membershipForClub, requireActiveClubMembership } from '../../auth/club-auth.js'
import { requireAdminKey } from '../middleware/auth.js'

export const CLUB_PLAN_CODES = ['FREE','STANDARD','PRO'] as const
export type ClubPlanCode = typeof CLUB_PLAN_CODES[number]

type PlanDefinition = {
  code: ClubPlanCode
  name: string
  description: string
  monthlyPrice: number | null
  limits: { users:number|null; newsPerMonth:number|null; photos:number|null; sponsors:number|null }
  features: { teamSelection:boolean; news:boolean; photos:boolean; sponsors:boolean; userManagement:boolean; activity:boolean; priorityReview:boolean; analytics:boolean }
}

export const CLUB_PLANS: Record<ClubPlanCode,PlanDefinition> = {
  FREE:{code:'FREE',name:'Free',description:'Core club profile and weekly team tools.',monthlyPrice:0,limits:{users:2,newsPerMonth:2,photos:10,sponsors:1},features:{teamSelection:true,news:true,photos:true,sponsors:true,userManagement:true,activity:true,priorityReview:false,analytics:false}},
  STANDARD:{code:'STANDARD',name:'Standard',description:'Complete day-to-day club publishing and commercial tools.',monthlyPrice:null,limits:{users:8,newsPerMonth:20,photos:100,sponsors:8},features:{teamSelection:true,news:true,photos:true,sponsors:true,userManagement:true,activity:true,priorityReview:false,analytics:true}},
  PRO:{code:'PRO',name:'Pro',description:'Unlimited club operations, priority review and advanced reporting.',monthlyPrice:null,limits:{users:null,newsPerMonth:null,photos:null,sponsors:null},features:{teamSelection:true,news:true,photos:true,sponsors:true,userManagement:true,activity:true,priorityReview:true,analytics:true}},
}

let ready:Promise<void>|null=null
export function ensureClubPlanSchema(){
  if(!ready)ready=(async()=>{
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS club_portal_plans (
      club_id TEXT PRIMARY KEY, plan_code TEXT NOT NULL DEFAULT 'STANDARD', status TEXT NOT NULL DEFAULT 'ACTIVE',
      starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), ends_at TIMESTAMPTZ, assigned_by TEXT,
      notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT club_portal_plans_code_check CHECK (plan_code IN ('FREE','STANDARD','PRO')),
      CONSTRAINT club_portal_plans_status_check CHECK (status IN ('ACTIVE','TRIAL','PAST_DUE','SUSPENDED','CANCELLED'))
    )`)
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS club_portal_upgrade_requests (
      id TEXT PRIMARY KEY, club_id TEXT NOT NULL, requested_plan TEXT NOT NULL, requested_by TEXT NOT NULL,
      requester_email TEXT, message TEXT, status TEXT NOT NULL DEFAULT 'PENDING', reviewed_by TEXT,
      review_notes TEXT, reviewed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT club_portal_upgrade_plan_check CHECK (requested_plan IN ('STANDARD','PRO')),
      CONSTRAINT club_portal_upgrade_status_check CHECK (status IN ('PENDING','CONTACTED','APPROVED','REJECTED','CANCELLED'))
    )`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS club_portal_upgrade_requests_club_idx ON club_portal_upgrade_requests (club_id,status,created_at DESC)`)
  })().catch(error=>{ready=null;throw error})
  return ready
}

type PlanRow={clubId:string;planCode:ClubPlanCode;status:string;startsAt:Date;endsAt:Date|null;assignedBy:string|null;notes:string|null}
export async function getClubPlan(clubId:string){
  await ensureClubPlanSchema()
  const rows=await prisma.$queryRawUnsafe<PlanRow[]>(`SELECT club_id AS "clubId",plan_code AS "planCode",status,starts_at AS "startsAt",ends_at AS "endsAt",assigned_by AS "assignedBy",notes FROM club_portal_plans WHERE club_id=$1 LIMIT 1`,clubId)
  const row=rows[0]??null
  const code:ClubPlanCode=row?.planCode&&CLUB_PLAN_CODES.includes(row.planCode)?row.planCode:'STANDARD'
  return {assignment:row,definition:CLUB_PLANS[code],effectiveCode:code,grandfathered:!row}
}

async function usage(clubId:string){
  const monthStart=new Date();monthStart.setUTCDate(1);monthStart.setUTCHours(0,0,0,0)
  const [users,links,sponsors,profile]=await Promise.all([
    prisma.$queryRawUnsafe<Array<{count:number}>>(`SELECT COUNT(*)::int AS count FROM club_portal_memberships WHERE club_id=$1 AND status IN ('ACTIVE','PENDING','INVITED')`,clubId),
    prisma.articleLink.findMany({where:{entityType:'CLUB',entityId:clubId,createdAt:{gte:monthStart}},select:{articleId:true}}),
    prisma.sponsorship.count({where:{clubId,deletedAt:null,status:{not:'CANCELLED'}}}),
    prisma.clubProfile.findUnique({where:{clubId},select:{gallery:true,uniformPhotos:true}}),
  ])
  const arrayLength=(value:string|null|undefined)=>{try{const parsed=JSON.parse(value||'[]');return Array.isArray(parsed)?parsed.length:0}catch{return 0}}
  return {users:users[0]?.count??0,newsThisMonth:new Set(links.map(x=>x.articleId)).size,photos:arrayLength(profile?.gallery)+arrayLength(profile?.uniformPhotos),sponsors}
}

const portalRouter=Router()
portalRouter.use(authenticateClubUser)
portalRouter.get('/clubs/:clubId/plan',requireActiveClubMembership,async(req,res)=>{
  const [plan,currentUsage,requests]=await Promise.all([
    getClubPlan(req.params.clubId),usage(req.params.clubId),
    prisma.$queryRawUnsafe<Array<Record<string,unknown>>>(`SELECT id,requested_plan AS "requestedPlan",message,status,review_notes AS "reviewNotes",created_at AS "createdAt",updated_at AS "updatedAt" FROM club_portal_upgrade_requests WHERE club_id=$1 ORDER BY created_at DESC LIMIT 10`,req.params.clubId),
  ])
  res.json({data:{...plan,usage:currentUsage,plans:Object.values(CLUB_PLANS),requests}})
})
portalRouter.post('/clubs/:clubId/upgrade-requests',requireActiveClubMembership,async(req,res)=>{
  const membership=res.locals.clubMembership as Awaited<ReturnType<typeof membershipForClub>>
  if(!membership||!['OWNER','ADMIN'].includes(membership.role))return res.status(403).json({error:'Only a club Owner or Admin can request a plan change'})
  const requestedPlan=String(req.body?.requestedPlan??'').toUpperCase() as ClubPlanCode
  if(!['STANDARD','PRO'].includes(requestedPlan))return res.status(400).json({error:'Choose Standard or Pro'})
  await ensureClubPlanSchema()
  const existing=await prisma.$queryRawUnsafe<Array<{id:string}>>(`SELECT id FROM club_portal_upgrade_requests WHERE club_id=$1 AND requested_plan=$2 AND status IN ('PENDING','CONTACTED') LIMIT 1`,req.params.clubId,requestedPlan)
  if(existing[0])return res.status(409).json({error:`A ${requestedPlan.toLowerCase()} request is already being reviewed`})
  const id=randomUUID()
  await prisma.$executeRawUnsafe(`INSERT INTO club_portal_upgrade_requests (id,club_id,requested_plan,requested_by,requester_email,message) VALUES ($1,$2,$3,$4,$5,$6)`,id,req.params.clubId,requestedPlan,req.clubUser!.id,req.clubUser!.email,String(req.body?.message??'').trim().slice(0,1500)||null)
  res.status(201).json({data:{id,requestedPlan,status:'PENDING'},message:'Upgrade request sent to PlayFooty'})
})

const adminRouter=Router()
adminRouter.use(requireAdminKey)
adminRouter.get('/',async(req,res)=>{
  await ensureClubPlanSchema()
  const rows=await prisma.$queryRawUnsafe<Array<Record<string,unknown>>>(`SELECT c.id AS "clubId",c.name AS "clubName",c."logoUrl",COALESCE(p.plan_code,'STANDARD') AS "planCode",COALESCE(p.status,'ACTIVE') AS status,p.starts_at AS "startsAt",p.ends_at AS "endsAt",p.notes,(SELECT COUNT(*)::int FROM club_portal_upgrade_requests r WHERE r.club_id=c.id AND r.status IN ('PENDING','CONTACTED')) AS "openRequests" FROM clubs c LEFT JOIN club_portal_plans p ON p.club_id=c.id WHERE c."archivedAt" IS NULL ORDER BY c.name LIMIT 2000`)
  const requests=await prisma.$queryRawUnsafe<Array<Record<string,unknown>>>(`SELECT r.id,r.club_id AS "clubId",c.name AS "clubName",r.requested_plan AS "requestedPlan",r.requester_email AS "requesterEmail",r.message,r.status,r.review_notes AS "reviewNotes",r.created_at AS "createdAt" FROM club_portal_upgrade_requests r JOIN clubs c ON c.id=r.club_id ORDER BY CASE r.status WHEN 'PENDING' THEN 0 WHEN 'CONTACTED' THEN 1 ELSE 2 END,r.created_at DESC LIMIT 300`)
  res.json({data:{clubs:rows,requests,plans:Object.values(CLUB_PLANS)}})
})
adminRouter.put('/clubs/:clubId',async(req,res)=>{
  await ensureClubPlanSchema()
  const planCode=String(req.body?.planCode??'').toUpperCase() as ClubPlanCode
  const status=String(req.body?.status??'ACTIVE').toUpperCase()
  if(!CLUB_PLAN_CODES.includes(planCode))return res.status(400).json({error:'Invalid club plan'})
  if(!['ACTIVE','TRIAL','PAST_DUE','SUSPENDED','CANCELLED'].includes(status))return res.status(400).json({error:'Invalid plan status'})
  const club=await prisma.club.findFirst({where:{id:req.params.clubId,archivedAt:null},select:{id:true,name:true}})
  if(!club)return res.status(404).json({error:'Club not found'})
  await prisma.$executeRawUnsafe(`INSERT INTO club_portal_plans (club_id,plan_code,status,starts_at,ends_at,assigned_by,notes) VALUES ($1,$2,$3,COALESCE($4::timestamptz,NOW()),$5::timestamptz,'admin',$6) ON CONFLICT (club_id) DO UPDATE SET plan_code=EXCLUDED.plan_code,status=EXCLUDED.status,starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at,assigned_by='admin',notes=EXCLUDED.notes,updated_at=NOW()`,club.id,planCode,status,req.body?.startsAt||null,req.body?.endsAt||null,String(req.body?.notes??'').trim().slice(0,1500)||null)
  res.json({data:{clubId:club.id,clubName:club.name,planCode,status},message:`${club.name} moved to ${CLUB_PLANS[planCode].name}`})
})
adminRouter.patch('/requests/:requestId',async(req,res)=>{
  await ensureClubPlanSchema()
  const status=String(req.body?.status??'').toUpperCase()
  if(!['CONTACTED','APPROVED','REJECTED','CANCELLED'].includes(status))return res.status(400).json({error:'Invalid request status'})
  const rows=await prisma.$queryRawUnsafe<Array<{id:string;clubId:string;requestedPlan:ClubPlanCode}>>(`SELECT id,club_id AS "clubId",requested_plan AS "requestedPlan" FROM club_portal_upgrade_requests WHERE id=$1 LIMIT 1`,req.params.requestId)
  const request=rows[0];if(!request)return res.status(404).json({error:'Upgrade request not found'})
  await prisma.$transaction(async tx=>{
    await tx.$executeRawUnsafe(`UPDATE club_portal_upgrade_requests SET status=$1,reviewed_by='admin',review_notes=$2,reviewed_at=NOW(),updated_at=NOW() WHERE id=$3`,status,String(req.body?.notes??'').trim().slice(0,1500)||null,request.id)
    if(status==='APPROVED')await tx.$executeRawUnsafe(`INSERT INTO club_portal_plans (club_id,plan_code,status,assigned_by) VALUES ($1,$2,'ACTIVE','admin') ON CONFLICT (club_id) DO UPDATE SET plan_code=EXCLUDED.plan_code,status='ACTIVE',assigned_by='admin',updated_at=NOW()`,request.clubId,request.requestedPlan)
  })
  res.json({data:{id:request.id,status},message:status==='APPROVED'?'Upgrade approved and plan activated':'Upgrade request updated'})
})

export { portalRouter as clubPortalPlansRouter, adminRouter as adminClubPlansRouter }
