import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { prisma } from '../db/client.js'
import { requireAdminKey } from '../api/middleware/auth.js'
import { auditMembership, CLUB_ROLES, ensureClubMembershipSchema, issueClubInvitation, type ClubRole } from '../auth/club-auth.js'

const router=Router()
router.use(requireAdminKey)

router.get('/',async(req,res)=>{
  await ensureClubMembershipSchema()
  const status=String(req.query.status??'PENDING').toUpperCase()
  const where=status==='ALL'?'':`WHERE m.status=$1`
  const args=status==='ALL'?[]:[status]
  const rows=await prisma.$queryRawUnsafe<Array<Record<string,unknown>>>(`SELECT m.id,m.user_id AS "userId",m.email,m.club_id AS "clubId",c.name AS "clubName",c."logoUrl",m.role,m.status,m.applicant_name AS "applicantName",m.club_position AS "clubPosition",m.phone,m.reason,m.review_notes AS "reviewNotes",m.created_at AS "createdAt",m.updated_at AS "updatedAt" FROM club_portal_memberships m JOIN clubs c ON c.id=m.club_id ${where} ORDER BY m.created_at DESC LIMIT 300`,...args)
  res.json({data:rows})
})

router.patch('/:id',async(req,res)=>{
  await ensureClubMembershipSchema()
  const action=String(req.body?.action??'').toUpperCase()
  const role=String(req.body?.role??'VIEWER').toUpperCase() as ClubRole
  const notes=String(req.body?.notes??'').trim()
  if (!['APPROVE','REJECT','SUSPEND','REACTIVATE','REVOKE'].includes(action)) return res.status(400).json({error:'Invalid membership action'})
  if (!CLUB_ROLES.includes(role)) return res.status(400).json({error:'Invalid club role'})
  const rows=await prisma.$queryRawUnsafe<Array<{id:string;clubId:string;userId:string}>>(`SELECT id,club_id AS "clubId",user_id AS "userId" FROM club_portal_memberships WHERE id=$1 LIMIT 1`,req.params.id)
  const item=rows[0]; if(!item)return res.status(404).json({error:'Membership not found'})
  const status=action==='APPROVE'||action==='REACTIVATE'?'ACTIVE':action==='REJECT'||action==='REVOKE'?'REVOKED':'SUSPENDED'
  await prisma.$executeRawUnsafe(`UPDATE club_portal_memberships SET role=$1,status=$2,review_notes=$3,approved_by=CASE WHEN $2='ACTIVE' THEN 'admin' ELSE approved_by END,approved_at=CASE WHEN $2='ACTIVE' THEN NOW() ELSE approved_at END,revoked_at=CASE WHEN $2='REVOKED' THEN NOW() ELSE NULL END,updated_at=NOW() WHERE id=$4`,role,status,notes||null,item.id)
  await auditMembership(item.id,item.clubId,item.userId,action,'admin',{role,notes})
  res.json({data:{id:item.id,status,role},message:`Membership ${action.toLowerCase()}d`})
})

router.post('/invitations',async(req,res)=>{
  const clubId=String(req.body?.clubId??'').trim(),email=String(req.body?.email??'').trim().toLowerCase(),role=String(req.body?.role??'VIEWER').toUpperCase() as ClubRole
  if(!clubId||!email.includes('@'))return res.status(400).json({error:'Club and valid email are required'})
  if(!CLUB_ROLES.includes(role))return res.status(400).json({error:'Invalid club role'})
  const club=await prisma.club.findFirst({where:{id:clubId,archivedAt:null},select:{id:true,name:true}})
  if(!club)return res.status(404).json({error:'Club not found'})
  const token=await issueClubInvitation(clubId,email,role,'admin')
  await auditMembership(null,clubId,null,'INVITATION_CREATED','admin',{email,role})
  res.status(201).json({data:{club,role,email,invitePath:`/club-portal?invite=${token}`,expiresInDays:7}})
})

router.get('/audit/recent',async(_req,res)=>{
  await ensureClubMembershipSchema()
  const rows=await prisma.$queryRawUnsafe(`SELECT id,membership_id AS "membershipId",club_id AS "clubId",user_id AS "userId",action,actor_id AS "actorId",detail,created_at AS "createdAt" FROM club_portal_membership_audit ORDER BY created_at DESC LIMIT 200`)
  res.json({data:rows})
})

export {router as adminClubMembershipsRouter}
