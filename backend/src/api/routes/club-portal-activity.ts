import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, membershipForClub, requireActiveClubMembership } from '../../auth/club-auth.js'

const router = Router()
let schemaReady: Promise<void> | null = null

async function ensureReadSchema() {
  if (!schemaReady) schemaReady = (async () => {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS club_portal_notification_reads (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      club_id TEXT NOT NULL,
      notification_id TEXT NOT NULL,
      read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, notification_id)
    )`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS club_portal_notification_reads_user_club_idx ON club_portal_notification_reads(user_id, club_id, read_at DESC)`)
  })().catch(error => { schemaReady = null; throw error })
  return schemaReady
}

router.use(authenticateClubUser)

router.get('/clubs/:clubId/activity', requireActiveClubMembership, async (req, res) => {
  try {
    await ensureReadSchema()
    const clubId = req.params.clubId
    const userId = req.clubUser!.id
    const membership = res.locals.clubMembership as Awaited<ReturnType<typeof membershipForClub>>
    if (!membership) return res.status(403).json({ error: 'Active club access is required' })

    const [notificationsResult, auditResult, newsResult, sponsorResult, teamResult] = await Promise.allSettled([
      prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
        SELECT n.id,n.type,n.category,n.severity,n.status,n.title,n.body,n."entityType",n."entityId",n.data,n."createdAt",
          CASE WHEN r.notification_id IS NULL THEN false ELSE true END AS "isRead"
        FROM notifications n
        LEFT JOIN club_portal_notification_reads r ON r.notification_id=n.id::text AND r.user_id=$2
        WHERE n."recipientScope"='CLUB' AND n."recipientId"=$1
        ORDER BY n."createdAt" DESC LIMIT 100
      `, clubId, userId),
      prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
        SELECT id,action,actor_id AS "actorId",detail,created_at AS "createdAt"
        FROM club_portal_membership_audit WHERE club_id=$1 ORDER BY created_at DESC LIMIT 60
      `, clubId),
      prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
        SELECT a.id,a.title,a.status,a."updatedAt" AS "createdAt",a.slug
        FROM generated_articles a JOIN article_links l ON l."articleId"=a.id
        WHERE l."entityType"='CLUB' AND l."entityId"=$1 AND a.status<>'ARCHIVED'
        ORDER BY a."updatedAt" DESC LIMIT 40
      `, clubId),
      prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
        SELECT e.id,e."toStatus" AS status,e.actor,e.note,e."createdAt",s.id AS "sponsorshipId",cs.name AS "sponsorName"
        FROM sponsorship_events e
        JOIN sponsorships s ON s.id=e."sponsorshipId"
        JOIN commercial_sponsors cs ON cs.id=s."sponsorId"
        WHERE s."clubId"=$1 AND s."deletedAt" IS NULL
        ORDER BY e."createdAt" DESC LIMIT 50
      `, clubId),
      prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
        SELECT id::text AS id,round_label AS "roundLabel",opponent_name AS "opponentName",status,updated_at AS "createdAt"
        FROM football_team_sheets WHERE club_id=$1 ORDER BY updated_at DESC LIMIT 40
      `, clubId),
    ])

    const notifications = notificationsResult.status === 'fulfilled' ? notificationsResult.value : []
    const activity = [
      ...(auditResult.status === 'fulfilled' ? auditResult.value.map(item => ({ ...item, source:'ACCESS', title:String(item.action ?? '').replaceAll('_',' ') })) : []),
      ...(newsResult.status === 'fulfilled' ? newsResult.value.map(item => ({ ...item, source:'NEWS', title:item.title, detail:`Article ${String(item.status ?? '').toLowerCase()}` })) : []),
      ...(sponsorResult.status === 'fulfilled' ? sponsorResult.value.map(item => ({ ...item, source:'SPONSOR', title:item.sponsorName, detail:`Sponsorship ${String(item.status ?? '').toLowerCase()}` })) : []),
      ...(teamResult.status === 'fulfilled' ? teamResult.value.map(item => ({ ...item, source:'TEAM', title:item.roundLabel, detail:`Team sheet ${String(item.status ?? '').toLowerCase()}` })) : []),
    ].sort((a,b) => new Date(String(b.createdAt ?? 0)).getTime() - new Date(String(a.createdAt ?? 0)).getTime()).slice(0,120)

    const unread = notifications.filter(item => !item.isRead).length
    res.json({ data:{ membership:{role:membership.role}, notifications, unread, activity, generatedAt:new Date().toISOString() } })
  } catch (error) { res.status(500).json({ error:'Unable to load club activity', detail:String(error) }) }
})

router.post('/clubs/:clubId/notifications/:notificationId/read', requireActiveClubMembership, async (req,res) => {
  try {
    await ensureReadSchema()
    const clubId=req.params.clubId,userId=req.clubUser!.id,notificationId=req.params.notificationId
    const rows=await prisma.$queryRawUnsafe<Array<{id:string}>>(`SELECT id::text AS id FROM notifications WHERE id::text=$1 AND "recipientScope"='CLUB' AND "recipientId"=$2 LIMIT 1`,notificationId,clubId)
    if(!rows[0])return res.status(404).json({error:'Notification not found for this club'})
    await prisma.$executeRawUnsafe(`INSERT INTO club_portal_notification_reads(id,user_id,club_id,notification_id) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,notification_id) DO UPDATE SET read_at=NOW()`,randomUUID(),userId,clubId,notificationId)
    res.json({data:{notificationId,isRead:true}})
  } catch(error){res.status(500).json({error:'Unable to mark notification read',detail:String(error)})}
})

router.post('/clubs/:clubId/notifications/read-all', requireActiveClubMembership, async (req,res) => {
  try {
    await ensureReadSchema()
    const clubId=req.params.clubId,userId=req.clubUser!.id
    await prisma.$executeRawUnsafe(`INSERT INTO club_portal_notification_reads(id,user_id,club_id,notification_id)
      SELECT gen_random_uuid()::text,$2,$1,n.id::text FROM notifications n
      WHERE n."recipientScope"='CLUB' AND n."recipientId"=$1
      ON CONFLICT(user_id,notification_id) DO UPDATE SET read_at=NOW()`,clubId,userId)
    res.json({data:{readAll:true}})
  } catch(error){res.status(500).json({error:'Unable to mark notifications read',detail:String(error)})}
})

export { router as clubPortalActivityRouter }
