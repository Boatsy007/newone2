import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, membershipForClub, requireActiveClubMembership, roleCan } from '../../auth/club-auth.js'
import { clubInsights } from '../../analytics/insights.js'

const router = Router()
router.use(authenticateClubUser)

type ActionItem = { id:string; type:string; severity:'INFO'|'WARNING'|'URGENT'; title:string; detail:string; href:string|null; permission:string|null; createdAt:string|null }

function daysUntil(value: Date | string | null | undefined) {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? Math.ceil((time - Date.now()) / 86400000) : null
}

router.get('/clubs/:clubId/insights', requireActiveClubMembership, async (req, res) => {
  try {
    const clubId = String(req.params.clubId)
    const membership = res.locals.clubMembership as Awaited<ReturnType<typeof membershipForClub>>
    if (!membership) return res.status(403).json({ error: 'Active club access is required' })

    const [club, profile, analyticsResult, notificationsResult, sheetsResult, articleLinksResult, sponsorsResult, pendingUsersResult] = await Promise.allSettled([
      prisma.club.findFirst({ where:{ id:clubId, archivedAt:null }, select:{ id:true,name:true,logoUrl:true,description:true,contactEmail:true,websiteUrl:true,facebookUrl:true,instagramUrl:true } }),
      prisma.clubProfile.upsert({ where:{clubId}, create:{clubId}, update:{}, select:{ ground:true,address:true,email:true,phone:true,history:true,trainingNights:true,clubColours:true,foundedYear:true,updatedAt:true } }),
      clubInsights(clubId),
      prisma.notification.findMany({ where:{ recipientScope:'CLUB',recipientId:clubId }, orderBy:{createdAt:'desc'}, take:30, select:{ id:true,type:true,category:true,severity:true,status:true,title:true,body:true,entityType:true,entityId:true,createdAt:true,readAt:true,data:true } }),
      prisma.$queryRawUnsafe<Array<{id:string;roundLabel:string;opponentName:string|null;matchDate:string|null;status:string;updatedAt:Date;playerCount:number}>>(`SELECT s.id::text AS id,s.round_label AS "roundLabel",s.opponent_name AS "opponentName",s.match_date::text AS "matchDate",s.status,s.updated_at AS "updatedAt",COUNT(p.id)::int AS "playerCount" FROM football_team_sheets s LEFT JOIN football_team_sheet_players p ON p.team_sheet_id=s.id WHERE s.club_id=$1 GROUP BY s.id ORDER BY s.updated_at DESC LIMIT 12`,clubId),
      prisma.articleLink.findMany({ where:{entityType:'CLUB',entityId:clubId}, select:{articleId:true} }),
      prisma.sponsorship.findMany({ where:{clubId,deletedAt:null}, orderBy:{updatedAt:'desc'}, take:30, include:{sponsor:{select:{name:true,logoUrl:true}}} }),
      prisma.$queryRawUnsafe<Array<{count:number}>>(`SELECT COUNT(*)::int AS count FROM club_portal_memberships WHERE club_id=$1 AND status IN ('PENDING','INVITED')`,clubId),
    ])

    const clubData = club.status === 'fulfilled' ? club.value : null
    if (!clubData) return res.status(404).json({ error:'Club not found' })
    const profileData = profile.status === 'fulfilled' ? profile.value : null
    const analytics = analyticsResult.status === 'fulfilled' ? analyticsResult.value : { clubId,clubName:clubData.name,profileViews:{all:0,last7:0,last30:0},uniqueVisitors:{all:0,last7:0},weeklyGrowthPct:0,monthlyGrowthPct:0,searches:0,sponsorClicks:0,newsReads:0 }
    const notifications = notificationsResult.status === 'fulfilled' ? notificationsResult.value : []
    const sheets = sheetsResult.status === 'fulfilled' ? sheetsResult.value : []
    const articleIds = articleLinksResult.status === 'fulfilled' ? [...new Set(articleLinksResult.value.map(row=>row.articleId))] : []
    const articles = articleIds.length ? await prisma.generatedArticle.findMany({ where:{id:{in:articleIds},status:{not:'ARCHIVED'}}, orderBy:{updatedAt:'desc'}, select:{id:true,title:true,slug:true,status:true,updatedAt:true,publishedAt:true} }) : []
    const sponsors = sponsorsResult.status === 'fulfilled' ? sponsorsResult.value : []
    const pendingUsers = pendingUsersResult.status === 'fulfilled' ? pendingUsersResult.value[0]?.count ?? 0 : 0

    const permissions = {
      manageUsers:roleCan(membership.role,'manage_users'), teamSelection:roleCan(membership.role,'team_selection'), media:roleCan(membership.role,'media'),
      sponsors:roleCan(membership.role,'sponsors'), profile:roleCan(membership.role,'profile'), view:true,
    }
    const actions: ActionItem[] = []
    const missing = [!clubData.logoUrl?'club logo':null,!(clubData.description||profileData?.history)?'club story':null,!profileData?.ground?'home ground':null,!profileData?.address?'address':null,!(clubData.contactEmail||profileData?.email)?'contact email':null,!profileData?.phone?'phone number':null].filter(Boolean) as string[]
    if (missing.length) actions.push({id:'profile-incomplete',type:'PROFILE',severity:missing.length>=4?'WARNING':'INFO',title:'Complete the club profile',detail:`Still missing: ${missing.join(', ')}`,href:permissions.profile?`/club-portal/${clubId}/profile`:null,permission:'profile',createdAt:profileData?.updatedAt?.toISOString()??null})

    const latestDraft = sheets.find(sheet=>sheet.status!=='PUBLISHED')
    if (latestDraft) actions.push({id:`sheet-${latestDraft.id}`,type:'TEAM_SELECTION',severity:latestDraft.playerCount?'INFO':'WARNING',title:`${latestDraft.roundLabel} team is not published`,detail:`${latestDraft.playerCount} player${latestDraft.playerCount===1?'':'s'} selected${latestDraft.opponentName?` · v ${latestDraft.opponentName}`:''}`,href:permissions.teamSelection?`/club-portal/${clubId}/team-selection`:null,permission:'teamSelection',createdAt:new Date(latestDraft.updatedAt).toISOString()})

    for (const article of articles.filter(item=>item.status==='DRAFT'||item.status==='APPROVED').slice(0,5)) actions.push({id:`article-${article.id}`,type:'NEWS',severity:article.status==='DRAFT'?'INFO':'WARNING',title:article.status==='DRAFT'?'Club story remains a draft':'Club story is awaiting PlayFooty approval',detail:article.title,href:permissions.media?`/club-portal/${clubId}/news`:null,permission:'media',createdAt:article.updatedAt.toISOString()})

    for (const deal of sponsors) {
      const remaining=daysUntil(deal.endDate)
      if (deal.status==='PENDING'||deal.status==='VERIFICATION_REQUIRED') actions.push({id:`sponsor-${deal.id}`,type:'SPONSOR',severity:deal.status==='VERIFICATION_REQUIRED'?'WARNING':'INFO',title:deal.status==='VERIFICATION_REQUIRED'?'Sponsor needs verification':'Sponsor is awaiting approval',detail:deal.sponsor?.name??'Club sponsor',href:permissions.sponsors?`/club-portal/${clubId}/sponsors`:null,permission:'sponsors',createdAt:deal.updatedAt.toISOString()})
      else if (remaining!==null&&remaining<=30&&remaining>=0) actions.push({id:`sponsor-expiry-${deal.id}`,type:'SPONSOR',severity:remaining<=7?'URGENT':'WARNING',title:'Sponsor agreement is expiring',detail:`${deal.sponsor?.name??'Sponsor'} expires in ${remaining} day${remaining===1?'':'s'}`,href:permissions.sponsors?`/club-portal/${clubId}/sponsors`:null,permission:'sponsors',createdAt:deal.updatedAt.toISOString()})
    }
    if (pendingUsers>0) actions.push({id:'pending-users',type:'USERS',severity:'WARNING',title:`${pendingUsers} club access request${pendingUsers===1?'':'s'} waiting`,detail:'Review the applicant or invitation before granting access.',href:permissions.manageUsers?`/club-portal/${clubId}/users`:null,permission:'manageUsers',createdAt:null})

    const recentActivity = [
      ...articles.map(item=>({id:`article-${item.id}`,type:'NEWS',title:item.title,status:item.status,createdAt:item.updatedAt.toISOString(),href:item.status==='PUBLISHED'?`/news/${item.slug}`:`/club-portal/${clubId}/news`})),
      ...sheets.map(item=>({id:`sheet-${item.id}`,type:'TEAM_SELECTION',title:item.roundLabel,status:item.status,createdAt:new Date(item.updatedAt).toISOString(),href:`/club-portal/${clubId}/team-selection`})),
      ...sponsors.map(item=>({id:`sponsor-${item.id}`,type:'SPONSOR',title:item.sponsor?.name??'Sponsor',status:item.status,createdAt:item.updatedAt.toISOString(),href:`/club-portal/${clubId}/sponsors`})),
    ].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,12)

    res.json({data:{club:{id:clubData.id,name:clubData.name,logoUrl:clubData.logoUrl},membership:{role:membership.role,permissions},analytics,actions:actions.sort((a,b)=>({URGENT:0,WARNING:1,INFO:2}[a.severity]-({URGENT:0,WARNING:1,INFO:2}[b.severity])),notifications,activity:recentActivity,summary:{openActions:actions.length,unreadNotifications:notifications.filter(item=>!['READ','SUPPRESSED'].includes(item.status)).length,pendingApprovals:actions.filter(item=>item.title.toLowerCase().includes('approval')).length,expiringSponsors:actions.filter(item=>item.id.startsWith('sponsor-expiry-')).length},generatedAt:new Date().toISOString()}})
  } catch (error) { res.status(500).json({error:'Unable to load club insights',detail:String(error)}) }
})

router.patch('/clubs/:clubId/notifications/:notificationId/read', requireActiveClubMembership, async (req,res)=>{
  const notification=await prisma.notification.findFirst({where:{id:req.params.notificationId,recipientScope:'CLUB',recipientId:req.params.clubId}})
  if(!notification)return res.status(404).json({error:'Notification not found for this club'})
  const updated=await prisma.notification.update({where:{id:notification.id},data:{status:'READ',readAt:new Date()}})
  res.json({data:updated})
})

export {router as clubPortalInsightsRouter}
