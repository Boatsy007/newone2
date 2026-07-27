import { Router } from 'express'
import { prisma } from '../db/client.js'
import { requireAdminKey } from '../api/middleware/auth.js'
import { auditMembership, CLUB_ROLES, ensureClubMembershipSchema, issueClubInvitation, type ClubRole } from '../auth/club-auth.js'
import { auditLeagueMembership, ensureLeagueMembershipSchema, issueLeagueInvitation, LEAGUE_ROLES, type LeagueRole } from '../auth/league-auth.js'

const router = Router()
router.use(requireAdminKey)

type Scope = 'CLUB' | 'LEAGUE'
type InviteInput = { scope?: string; organisationId?: string; email?: string; role?: string }

function scope(value: unknown): Scope | null {
  const next = String(value ?? '').toUpperCase()
  return next === 'CLUB' || next === 'LEAGUE' ? next : null
}
function email(value: unknown) {
  const next = String(value ?? '').trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next) ? next : null
}
async function ensureSchemas() {
  await Promise.all([ensureClubMembershipSchema(), ensureLeagueMembershipSchema()])
}

router.get('/summary', async (_req, res) => {
  try {
    await ensureSchemas()
    const [clubs, leagues, clubCounts, leagueCounts, inviteCounts, recentAudit] = await Promise.all([
      prisma.club.findMany({
        where: { sport: 'FOOTBALL', isActive: true, archivedAt: null, approvalStatus: 'APPROVED' },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, logoUrl: true, description: true, websiteUrl: true, state: { select: { code: true } }, leagueSeasons: { where: { isActive: true, sport: 'FOOTBALL' }, orderBy: { season: 'desc' }, take: 1, select: { league: { select: { name: true } } } } },
      }),
      prisma.league.findMany({
        where: { sport: 'FOOTBALL', isActive: true, enabled: true, hidden: false, archivedAt: null },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, logoUrl: true, description: true, websiteUrl: true, state: { select: { code: true } } },
      }),
      prisma.$queryRawUnsafe<Array<{ organisationId:string; active:number; pending:number; suspended:number }>>(`SELECT club_id AS "organisationId",COUNT(*) FILTER(WHERE status='ACTIVE')::int AS active,COUNT(*) FILTER(WHERE status='PENDING')::int AS pending,COUNT(*) FILTER(WHERE status='SUSPENDED')::int AS suspended FROM club_portal_memberships GROUP BY club_id`),
      prisma.$queryRawUnsafe<Array<{ organisationId:string; active:number; pending:number; suspended:number }>>(`SELECT league_id AS "organisationId",COUNT(*) FILTER(WHERE status='ACTIVE')::int AS active,COUNT(*) FILTER(WHERE status='PENDING')::int AS pending,COUNT(*) FILTER(WHERE status='SUSPENDED')::int AS suspended FROM league_portal_memberships GROUP BY league_id`),
      prisma.$queryRawUnsafe<Array<{ scope:Scope; organisationId:string; pending:number }>>(`SELECT 'CLUB'::text AS scope,club_id AS "organisationId",COUNT(*)::int AS pending FROM club_portal_invitations WHERE accepted_at IS NULL AND revoked_at IS NULL AND expires_at>NOW() GROUP BY club_id UNION ALL SELECT 'LEAGUE'::text AS scope,league_id AS "organisationId",COUNT(*)::int AS pending FROM league_portal_invitations WHERE accepted_at IS NULL AND revoked_at IS NULL AND expires_at>NOW() GROUP BY league_id`),
      prisma.$queryRawUnsafe<Array<{ id:string; scope:Scope; organisationId:string; action:string; actorId:string; detail:unknown; createdAt:Date }>>(`SELECT id,'CLUB'::text AS scope,club_id AS "organisationId",action,actor_id AS "actorId",detail,created_at AS "createdAt" FROM club_portal_membership_audit UNION ALL SELECT id,'LEAGUE'::text AS scope,league_id AS "organisationId",action,actor_id AS "actorId",detail,created_at AS "createdAt" FROM league_portal_membership_audit ORDER BY "createdAt" DESC LIMIT 100`),
    ])
    const clubMap = new Map(clubCounts.map(row => [row.organisationId, row]))
    const leagueMap = new Map(leagueCounts.map(row => [row.organisationId, row]))
    const pendingMap = new Map(inviteCounts.map(row => [`${row.scope}:${row.organisationId}`, row.pending]))
    const organisations = [
      ...clubs.map(item => {
        const counts = clubMap.get(item.id)
        const readiness = [item.logoUrl, item.description, item.websiteUrl].filter(Boolean).length
        return { scope:'CLUB' as const,id:item.id,name:item.name,state:item.state.code,context:item.leagueSeasons[0]?.league.name ?? 'Independent club',logoUrl:item.logoUrl,readiness:Math.round(readiness/3*100),activeUsers:counts?.active ?? 0,pendingClaims:counts?.pending ?? 0,suspendedUsers:counts?.suspended ?? 0,pendingInvites:pendingMap.get(`CLUB:${item.id}`) ?? 0,rolloutStatus:(counts?.active ?? 0)>0?'ACTIVE':(pendingMap.get(`CLUB:${item.id}`) ?? 0)>0?'INVITED':'NOT_STARTED' },
      }),
      ...leagues.map(item => {
        const counts = leagueMap.get(item.id)
        const readiness = [item.logoUrl, item.description, item.websiteUrl].filter(Boolean).length
        return { scope:'LEAGUE' as const,id:item.id,name:item.name,state:item.state.code,context:'League',logoUrl:item.logoUrl,readiness:Math.round(readiness/3*100),activeUsers:counts?.active ?? 0,pendingClaims:counts?.pending ?? 0,suspendedUsers:counts?.suspended ?? 0,pendingInvites:pendingMap.get(`LEAGUE:${item.id}`) ?? 0,rolloutStatus:(counts?.active ?? 0)>0?'ACTIVE':(pendingMap.get(`LEAGUE:${item.id}`) ?? 0)>0?'INVITED':'NOT_STARTED' },
      }),
    ]
    const totals = {
      organisations: organisations.length,
      active: organisations.filter(item => item.rolloutStatus === 'ACTIVE').length,
      invited: organisations.filter(item => item.rolloutStatus === 'INVITED').length,
      notStarted: organisations.filter(item => item.rolloutStatus === 'NOT_STARTED').length,
      pendingClaims: organisations.reduce((sum,item)=>sum+item.pendingClaims,0),
      pendingInvites: organisations.reduce((sum,item)=>sum+item.pendingInvites,0),
    }
    res.json({ data: { totals, organisations, recentAudit } })
  } catch (error) {
    res.status(500).json({ error: 'Unable to load portal rollout', detail: String(error) })
  }
})

router.get('/invitations', async (req, res) => {
  try {
    await ensureSchemas()
    const requested = scope(req.query.scope)
    const clubRows = !requested || requested === 'CLUB' ? await prisma.$queryRawUnsafe(`SELECT i.id,'CLUB'::text AS scope,i.club_id AS "organisationId",c.name AS "organisationName",i.email,i.role,i.expires_at AS "expiresAt",i.accepted_at AS "acceptedAt",i.revoked_at AS "revokedAt",i.created_at AS "createdAt" FROM club_portal_invitations i JOIN clubs c ON c.id=i.club_id ORDER BY i.created_at DESC LIMIT 200`) : []
    const leagueRows = !requested || requested === 'LEAGUE' ? await prisma.$queryRawUnsafe(`SELECT i.id,'LEAGUE'::text AS scope,i.league_id AS "organisationId",l.name AS "organisationName",i.email,i.role,i.expires_at AS "expiresAt",i.accepted_at AS "acceptedAt",i.revoked_at AS "revokedAt",i.created_at AS "createdAt" FROM league_portal_invitations i JOIN leagues l ON l.id=i.league_id ORDER BY i.created_at DESC LIMIT 200`) : []
    res.json({ data: [...(clubRows as any[]), ...(leagueRows as any[])].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)).slice(0,250) })
  } catch (error) { res.status(500).json({ error:'Unable to load rollout invitations', detail:String(error) }) }
})

async function createInvitation(input: InviteInput) {
  const targetScope = scope(input.scope)
  const organisationId = String(input.organisationId ?? '').trim()
  const recipient = email(input.email)
  const role = String(input.role ?? 'OWNER').toUpperCase()
  if (!targetScope || !organisationId || !recipient) throw new Error('Scope, organisation and a valid email are required')
  if (targetScope === 'CLUB') {
    if (!CLUB_ROLES.includes(role as ClubRole)) throw new Error('Invalid club role')
    const organisation = await prisma.club.findFirst({ where:{ id:organisationId, sport:'FOOTBALL', isActive:true, archivedAt:null }, select:{ id:true,name:true } })
    if (!organisation) throw new Error('Club not found or inactive')
    const active = await prisma.$queryRawUnsafe<Array<{count:number}>>(`SELECT COUNT(*)::int AS count FROM club_portal_memberships WHERE club_id=$1 AND lower(email)=lower($2) AND status='ACTIVE'`,organisationId,recipient)
    if ((active[0]?.count ?? 0)>0) throw new Error(`${recipient} already has active access`)
    await prisma.$executeRawUnsafe(`UPDATE club_portal_invitations SET revoked_at=NOW() WHERE club_id=$1 AND lower(email)=lower($2) AND accepted_at IS NULL AND revoked_at IS NULL`,organisationId,recipient)
    const token = await issueClubInvitation(organisationId,recipient,role as ClubRole,'admin')
    await auditMembership(null,organisationId,null,'ROLLOUT_INVITATION_CREATED','admin',{email:recipient,role})
    return { scope:targetScope,organisationId,organisationName:organisation.name,email:recipient,role,invitePath:`/club-portal?invite=${token}`,expiresInDays:7 }
  }
  if (!LEAGUE_ROLES.includes(role as LeagueRole)) throw new Error('Invalid league role')
  const organisation = await prisma.league.findFirst({ where:{ id:organisationId, sport:'FOOTBALL', isActive:true, archivedAt:null }, select:{ id:true,name:true } })
  if (!organisation) throw new Error('League not found or inactive')
  const active = await prisma.$queryRawUnsafe<Array<{count:number}>>(`SELECT COUNT(*)::int AS count FROM league_portal_memberships WHERE league_id=$1 AND lower(email)=lower($2) AND status='ACTIVE'`,organisationId,recipient)
  if ((active[0]?.count ?? 0)>0) throw new Error(`${recipient} already has active access`)
  await prisma.$executeRawUnsafe(`UPDATE league_portal_invitations SET revoked_at=NOW() WHERE league_id=$1 AND lower(email)=lower($2) AND accepted_at IS NULL AND revoked_at IS NULL`,organisationId,recipient)
  const token = await issueLeagueInvitation(organisationId,recipient,role as LeagueRole,'admin')
  await auditLeagueMembership(null,organisationId,null,'ROLLOUT_INVITATION_CREATED','admin',{email:recipient,role})
  return { scope:targetScope,organisationId,organisationName:organisation.name,email:recipient,role,invitePath:`/league-portal?invite=${token}`,expiresInDays:7 }
}

router.post('/invitations/bulk', async (req, res) => {
  try {
    await ensureSchemas()
    const entries = Array.isArray(req.body?.entries) ? req.body.entries.slice(0,100) as InviteInput[] : []
    if (!entries.length) return res.status(400).json({ error:'entries[] is required' })
    const results: Array<{ ok:boolean; input:InviteInput; data?:unknown; error?:string }> = []
    for (const input of entries) {
      try { results.push({ ok:true,input,data:await createInvitation(input) }) }
      catch (error) { results.push({ ok:false,input,error:error instanceof Error?error.message:'Invitation failed' }) }
    }
    res.status(results.some(item=>!item.ok)?207:201).json({ data:{ created:results.filter(item=>item.ok).length,failed:results.filter(item=>!item.ok).length,results } })
  } catch (error) { res.status(500).json({ error:'Bulk invitation run failed',detail:String(error) }) }
})

router.post('/invitations/:scope/:invitationId/resend', async (req,res) => {
  try {
    await ensureSchemas(); const targetScope=scope(req.params.scope); if(!targetScope)return res.status(400).json({error:'Invalid scope'})
    if(targetScope==='CLUB'){
      const rows=await prisma.$queryRawUnsafe<Array<{id:string;organisationId:string;email:string;role:ClubRole;acceptedAt:Date|null}>>(`SELECT id,club_id AS "organisationId",email,role,accepted_at AS "acceptedAt" FROM club_portal_invitations WHERE id=$1 LIMIT 1`,req.params.invitationId)
      const invite=rows[0];if(!invite)return res.status(404).json({error:'Invitation not found'});if(invite.acceptedAt)return res.status(409).json({error:'Invitation already accepted'})
      await prisma.$executeRawUnsafe(`UPDATE club_portal_invitations SET revoked_at=NOW() WHERE club_id=$1 AND lower(email)=lower($2) AND accepted_at IS NULL AND revoked_at IS NULL`,invite.organisationId,invite.email)
      const token=await issueClubInvitation(invite.organisationId,invite.email,invite.role,'admin');await auditMembership(null,invite.organisationId,null,'ROLLOUT_INVITATION_RESENT','admin',{email:invite.email,role:invite.role,previousInvitationId:invite.id})
      return res.json({data:{invitePath:`/club-portal?invite=${token}`,email:invite.email,role:invite.role,expiresInDays:7}})
    }
    const rows=await prisma.$queryRawUnsafe<Array<{id:string;organisationId:string;email:string;role:LeagueRole;acceptedAt:Date|null}>>(`SELECT id,league_id AS "organisationId",email,role,accepted_at AS "acceptedAt" FROM league_portal_invitations WHERE id=$1 LIMIT 1`,req.params.invitationId)
    const invite=rows[0];if(!invite)return res.status(404).json({error:'Invitation not found'});if(invite.acceptedAt)return res.status(409).json({error:'Invitation already accepted'})
    await prisma.$executeRawUnsafe(`UPDATE league_portal_invitations SET revoked_at=NOW() WHERE league_id=$1 AND lower(email)=lower($2) AND accepted_at IS NULL AND revoked_at IS NULL`,invite.organisationId,invite.email)
    const token=await issueLeagueInvitation(invite.organisationId,invite.email,invite.role,'admin');await auditLeagueMembership(null,invite.organisationId,null,'ROLLOUT_INVITATION_RESENT','admin',{email:invite.email,role:invite.role,previousInvitationId:invite.id})
    res.json({data:{invitePath:`/league-portal?invite=${token}`,email:invite.email,role:invite.role,expiresInDays:7}})
  }catch(error){res.status(500).json({error:'Unable to resend rollout invitation',detail:String(error)})}
})

router.post('/invitations/:scope/:invitationId/revoke', async (req,res) => {
  try {
    await ensureSchemas();const targetScope=scope(req.params.scope);if(!targetScope)return res.status(400).json({error:'Invalid scope'})
    if(targetScope==='CLUB'){
      const rows=await prisma.$queryRawUnsafe<Array<{organisationId:string}>>(`UPDATE club_portal_invitations SET revoked_at=NOW() WHERE id=$1 AND accepted_at IS NULL AND revoked_at IS NULL RETURNING club_id AS "organisationId"`,req.params.invitationId)
      if(!rows[0])return res.status(404).json({error:'Active invitation not found'});await auditMembership(null,rows[0].organisationId,null,'ROLLOUT_INVITATION_REVOKED','admin',{invitationId:req.params.invitationId})
    }else{
      const rows=await prisma.$queryRawUnsafe<Array<{organisationId:string}>>(`UPDATE league_portal_invitations SET revoked_at=NOW() WHERE id=$1 AND accepted_at IS NULL AND revoked_at IS NULL RETURNING league_id AS "organisationId"`,req.params.invitationId)
      if(!rows[0])return res.status(404).json({error:'Active invitation not found'});await auditLeagueMembership(null,rows[0].organisationId,null,'ROLLOUT_INVITATION_REVOKED','admin',{invitationId:req.params.invitationId})
    }
    res.json({data:{revoked:true}})
  }catch(error){res.status(500).json({error:'Unable to revoke rollout invitation',detail:String(error)})}
})

export { router as adminPortalRolloutRouter }
