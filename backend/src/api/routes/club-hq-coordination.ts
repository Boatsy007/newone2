import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, requireActiveClubMembership, type ClubMembership } from '../../auth/club-auth.js'

const router=Router()
let ready:Promise<void>|null=null
async function ensureTables(){
 if(!ready)ready=(async()=>{
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS club_hq_tasks (id TEXT PRIMARY KEY,club_id TEXT NOT NULL,title TEXT NOT NULL,detail TEXT,category TEXT NOT NULL DEFAULT 'GENERAL',priority TEXT NOT NULL DEFAULT 'MEDIUM',status TEXT NOT NULL DEFAULT 'OPEN',action_url TEXT,due_at TIMESTAMPTZ,created_by TEXT,assigned_to TEXT,assigned_name TEXT,checked_by TEXT,checked_at TIMESTAMPTZ,completed_by TEXT,completed_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
  for(const sql of [
   `ALTER TABLE club_hq_tasks ADD COLUMN IF NOT EXISTS assigned_to TEXT`,
   `ALTER TABLE club_hq_tasks ADD COLUMN IF NOT EXISTS assigned_name TEXT`,
   `ALTER TABLE club_hq_tasks ADD COLUMN IF NOT EXISTS checked_by TEXT`,
   `ALTER TABLE club_hq_tasks ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ`,
  ])await prisma.$executeRawUnsafe(sql)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS club_hq_tasks_club_idx ON club_hq_tasks (club_id,status,created_at DESC)`)
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS club_hq_notifications (id TEXT PRIMARY KEY,club_id TEXT NOT NULL,title TEXT NOT NULL,detail TEXT,kind TEXT NOT NULL DEFAULT 'INFO',action_url TEXT,read_at TIMESTAMPTZ,created_by TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS club_hq_notifications_club_idx ON club_hq_notifications (club_id,read_at,created_at DESC)`)
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS club_media_approvals (id TEXT PRIMARY KEY,club_id TEXT NOT NULL,media_id TEXT,title TEXT NOT NULL,media_type TEXT NOT NULL DEFAULT 'MEDIA',preview_url TEXT,description TEXT,status TEXT NOT NULL DEFAULT 'DRAFT',submitted_by TEXT,reviewed_by TEXT,review_note TEXT,submitted_at TIMESTAMPTZ,reviewed_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS club_media_approvals_club_idx ON club_media_approvals (club_id,status,created_at DESC)`)
 })().catch(error=>{ready=null;throw error})
 return ready
}
const clean=(value:unknown,max=240)=>String(value??'').trim().slice(0,max)
const userId=(req:any)=>String(req.clubUser?.id||'')||null
const membership=(res:any)=>res.locals.clubMembership as ClubMembership
function canAssignOthers(member:ClubMembership){return member.role==='OWNER'||member.role==='ADMIN'||/^(president|chair|chairperson)$/i.test(member.clubPosition?.trim()||'')}
async function activeMembers(clubId:string){return prisma.$queryRawUnsafe<Array<{userId:string;name:string;email:string;role:string;clubPosition:string|null}>>(`SELECT user_id AS "userId",COALESCE(NULLIF(applicant_name,''),NULLIF(club_position,''),email) AS name,email,role,club_position AS "clubPosition" FROM club_portal_memberships WHERE club_id=$1 AND status='ACTIVE' ORDER BY CASE role WHEN 'OWNER' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END,name`,clubId)}
router.use(authenticateClubUser)
router.use('/clubs/:clubId',requireActiveClubMembership)

router.get('/clubs/:clubId',async(req,res)=>{
 try{
  await ensureTables();const clubId=req.params.clubId;const member=membership(res)
  const [tasks,notifications,approvals,members]=await Promise.all([
   prisma.$queryRawUnsafe<any[]>(`SELECT id,title,detail,category,priority,status,action_url AS "actionUrl",due_at AS "dueAt",created_by AS "createdBy",assigned_to AS "assignedTo",assigned_name AS "assignedName",checked_by AS "checkedBy",checked_at AS "checkedAt",created_at AS "createdAt",completed_at AS "completedAt" FROM club_hq_tasks WHERE club_id=$1 ORDER BY CASE status WHEN 'CHECKED' THEN 0 WHEN 'OPEN' THEN 1 ELSE 2 END,CASE priority WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END,created_at DESC LIMIT 80`,clubId),
   prisma.$queryRawUnsafe<any[]>(`SELECT id,title,detail,kind,action_url AS "actionUrl",read_at AS "readAt",created_at AS "createdAt" FROM club_hq_notifications WHERE club_id=$1 ORDER BY created_at DESC LIMIT 40`,clubId),
   prisma.$queryRawUnsafe<any[]>(`SELECT id,media_id AS "mediaId",title,media_type AS "mediaType",preview_url AS "previewUrl",description,status,review_note AS "reviewNote",submitted_at AS "submittedAt",reviewed_at AS "reviewedAt",created_at AS "createdAt" FROM club_media_approvals WHERE club_id=$1 ORDER BY CASE status WHEN 'PENDING' THEN 0 ELSE 1 END,created_at DESC LIMIT 40`,clubId),
   activeMembers(clubId),
  ])
  res.json({data:{tasks,notifications,approvals,members,currentUserId:req.clubUser!.id,canAssignOthers:canAssignOthers(member),counts:{openTasks:tasks.filter(item=>item.status==='OPEN'||item.status==='CHECKED').length,unreadNotifications:notifications.filter(item=>!item.readAt).length,pendingApprovals:approvals.filter(item=>item.status==='PENDING').length}}})
 }catch(error){res.status(500).json({error:'Unable to load Club HQ coordination',detail:String(error)})}
})
router.post('/clubs/:clubId/tasks',async(req,res)=>{
 try{
  await ensureTables();const id=randomUUID();const title=clean(req.body?.title,120);if(!title)return res.status(400).json({error:'Task title is required'})
  const member=membership(res);const actor=req.clubUser!.id;let assignedTo=clean(req.body?.assignedTo,100)||actor
  if(!canAssignOthers(member)&&assignedTo!==actor)return res.status(403).json({error:'You can only assign tasks to yourself'})
  const members=await activeMembers(req.params.clubId);const assignee=members.find(item=>item.userId===assignedTo)
  if(!assignee)return res.status(400).json({error:'The selected user does not have active club access'})
  await prisma.$executeRawUnsafe(`INSERT INTO club_hq_tasks (id,club_id,title,detail,category,priority,action_url,due_at,created_by,assigned_to,assigned_name) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,id,req.params.clubId,title,clean(req.body?.detail)||null,clean(req.body?.category,40)||'GENERAL',clean(req.body?.priority,20)||'MEDIUM',clean(req.body?.actionUrl,300)||null,req.body?.dueAt?new Date(req.body.dueAt):null,actor,assignedTo,assignee.name)
  res.status(201).json({data:{id,assignedTo,assignedName:assignee.name}})
 }catch(error){res.status(500).json({error:'Unable to create task',detail:String(error)})}
})
router.patch('/clubs/:clubId/tasks/:taskId',async(req,res)=>{
 try{
  await ensureTables();const status=clean(req.body?.status,20);if(!['OPEN','CHECKED','COMPLETED'].includes(status))return res.status(400).json({error:'Invalid task status'})
  const rows=await prisma.$queryRawUnsafe<Array<{assignedTo:string|null;status:string}>>(`SELECT assigned_to AS "assignedTo",status FROM club_hq_tasks WHERE id=$1 AND club_id=$2 LIMIT 1`,req.params.taskId,req.params.clubId);const task=rows[0]
  if(!task)return res.status(404).json({error:'Task not found'})
  const actor=req.clubUser!.id;const member=membership(res);if(task.assignedTo&&task.assignedTo!==actor&&!canAssignOthers(member))return res.status(403).json({error:'Only the assignee or a club manager can update this task'})
  if(status==='COMPLETED'&&task.status!=='CHECKED')return res.status(400).json({error:'Tick the task before completing it'})
  await prisma.$executeRawUnsafe(`UPDATE club_hq_tasks SET status=$1,checked_by=CASE WHEN $1='CHECKED' THEN $2 WHEN $1='OPEN' THEN NULL ELSE checked_by END,checked_at=CASE WHEN $1='CHECKED' THEN NOW() WHEN $1='OPEN' THEN NULL ELSE checked_at END,completed_by=CASE WHEN $1='COMPLETED' THEN $2 ELSE NULL END,completed_at=CASE WHEN $1='COMPLETED' THEN NOW() ELSE NULL END,updated_at=NOW() WHERE id=$3 AND club_id=$4`,status,actor,req.params.taskId,req.params.clubId)
  res.json({data:{updated:true,status}})
 }catch(error){res.status(500).json({error:'Unable to update task',detail:String(error)})}
})
router.post('/clubs/:clubId/approvals',async(req,res)=>{try{await ensureTables();const id=randomUUID();const title=clean(req.body?.title,150);if(!title)return res.status(400).json({error:'Approval title is required'});await prisma.$executeRawUnsafe(`INSERT INTO club_media_approvals (id,club_id,media_id,title,media_type,preview_url,description,status,submitted_by,submitted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING',$8,NOW())`,id,req.params.clubId,clean(req.body?.mediaId,100)||null,title,clean(req.body?.mediaType,40)||'MEDIA',clean(req.body?.previewUrl,200000)||null,clean(req.body?.description,2000)||null,userId(req));res.status(201).json({data:{id}})}catch(error){res.status(500).json({error:'Unable to submit approval',detail:String(error)})}})
router.patch('/clubs/:clubId/approvals/:approvalId',async(req,res)=>{try{await ensureTables();const status=clean(req.body?.status,20);if(!['APPROVED','CHANGES_REQUESTED'].includes(status))return res.status(400).json({error:'Invalid approval status'});await prisma.$executeRawUnsafe(`UPDATE club_media_approvals SET status=$1,reviewed_by=$2,review_note=$3,reviewed_at=NOW(),updated_at=NOW() WHERE id=$4 AND club_id=$5`,status,userId(req),clean(req.body?.reviewNote,500)||null,req.params.approvalId,req.params.clubId);await prisma.$executeRawUnsafe(`INSERT INTO club_hq_notifications (id,club_id,title,detail,kind,created_by) VALUES ($1,$2,$3,$4,$5,$6)`,randomUUID(),req.params.clubId,status==='APPROVED'?'Media approved':'Changes requested',clean(req.body?.reviewNote,500)||null,status==='APPROVED'?'SUCCESS':'ACTION',userId(req));res.json({data:{updated:true}})}catch(error){res.status(500).json({error:'Unable to review media',detail:String(error)})}})
router.patch('/clubs/:clubId/notifications/:notificationId/read',async(req,res)=>{try{await ensureTables();await prisma.$executeRawUnsafe(`UPDATE club_hq_notifications SET read_at=NOW() WHERE id=$1 AND club_id=$2`,req.params.notificationId,req.params.clubId);res.json({data:{read:true}})}catch(error){res.status(500).json({error:'Unable to mark notification read',detail:String(error)})}})
export {router as clubHqCoordinationRouter}
