import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, membershipForClub, requireActiveClubMembership, roleCan } from '../../auth/club-auth.js'
import { clubInsights } from '../../analytics/insights.js'
import { getClubSponsorships } from '../../commercial/sponsorships.service.js'

const router=Router()
router.use(authenticateClubUser)
type Severity='INFO'|'WARNING'|'URGENT'
type ActionItem={id:string;type:string;severity:Severity;title:string;detail:string;href:string|null;permission:string|null;createdAt:string|null}
const dayCount=(value:unknown)=>{if(!value)return null;const time=new Date(String(value)).getTime();return Number.isFinite(time)?Math.ceil((time-Date.now())/86400000):null}

router.get('/clubs/:clubId/insights',requireActiveClubMembership,async(req,res)=>{
 try{
  const clubId=String(req.params.clubId),membership=res.locals.clubMembership as Awaited<ReturnType<typeof membershipForClub>>
  if(!membership)return res.status(403).json({error:'Active club access is required'})
  const settled=await Promise.allSettled([
   prisma.club.findFirst({where:{id:clubId,archivedAt:null},select:{id:true,name:true,logoUrl:true,description:true,contactEmail:true}}),
   prisma.clubProfile.upsert({where:{clubId},create:{clubId},update:{},select:{ground:true,address:true,email:true,phone:true,history:true,updatedAt:true}}),
   clubInsights(clubId),
   prisma.notification.findMany({where:{recipientScope:'CLUB',recipientId:clubId},orderBy:{createdAt:'desc'},take:30,select:{id:true,type:true,category:true,severity:true,status:true,title:true,body:true,createdAt:true,readAt:true}}),
   prisma.$queryRawUnsafe(`SELECT s.id::text AS id,s.round_label AS "roundLabel",s.opponent_name AS "opponentName",s.status,s.updated_at AS "updatedAt",COUNT(p.id)::int AS "playerCount" FROM football_team_sheets s LEFT JOIN football_team_sheet_players p ON p.team_sheet_id=s.id WHERE s.club_id=$1 GROUP BY s.id ORDER BY s.updated_at DESC LIMIT 12`,clubId),
   prisma.articleLink.findMany({where:{entityType:'CLUB',entityId:clubId},select:{articleId:true}}),
   getClubSponsorships(clubId,false),
   prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM club_portal_memberships WHERE club_id=$1 AND status IN ('PENDING','INVITED')`,clubId),
  ])
  const value=(index:number,fallback:any)=>settled[index]?.status==='fulfilled'?(settled[index] as PromiseFulfilledResult<any>).value:fallback
  const club=value(0,null),profile=value(1,null),analytics=value(2,{clubId,clubName:null,profileViews:{all:0,last7:0,last30:0},uniqueVisitors:{all:0,last7:0},weeklyGrowthPct:0,monthlyGrowthPct:0,searches:0,sponsorClicks:0,newsReads:0})
  if(!club)return res.status(404).json({error:'Club not found'})
  const notifications:any[]=value(3,[]),sheets:any[]=value(4,[]),links:any[]=value(5,[]),sponsors:any[]=value(6,[]),pendingRows:any[]=value(7,[])
  const articleIds=[...new Set(links.map(row=>String(row.articleId)))]
  const articles:any[]=articleIds.length?await prisma.generatedArticle.findMany({where:{id:{in:articleIds},status:{not:'ARCHIVED'}},orderBy:{updatedAt:'desc'},select:{id:true,title:true,slug:true,status:true,updatedAt:true}}):[]
  const permissions={manageUsers:roleCan(membership.role,'manage_users'),teamSelection:roleCan(membership.role,'team_selection'),media:roleCan(membership.role,'media'),sponsors:roleCan(membership.role,'sponsors'),profile:roleCan(membership.role,'profile'),view:true}
  const actions:ActionItem[]=[]
  const missing=[!club.logoUrl?'club logo':null,!(club.description||profile?.history)?'club story':null,!profile?.ground?'home ground':null,!profile?.address?'address':null,!(club.contactEmail||profile?.email)?'contact email':null,!profile?.phone?'phone number':null].filter(Boolean) as string[]
  if(missing.length)actions.push({id:'profile-incomplete',type:'PROFILE',severity:missing.length>=4?'WARNING':'INFO',title:'Complete the club profile',detail:`Still missing: ${missing.join(', ')}`,href:permissions.profile?`/club-portal/${clubId}/profile`:null,permission:'profile',createdAt:profile?.updatedAt?new Date(profile.updatedAt).toISOString():null})
  const draft=sheets.find(row=>row.status!=='PUBLISHED')
  if(draft)actions.push({id:`sheet-${draft.id}`,type:'TEAM_SELECTION',severity:Number(draft.playerCount)>0?'INFO':'WARNING',title:`${draft.roundLabel} team is not published`,detail:`${Number(draft.playerCount)||0} players selected${draft.opponentName?` · v ${draft.opponentName}`:''}`,href:permissions.teamSelection?`/club-portal/${clubId}/team-selection`:null,permission:'teamSelection',createdAt:new Date(draft.updatedAt).toISOString()})
  for(const article of articles.filter(row=>row.status==='DRAFT'||row.status==='APPROVED').slice(0,5))actions.push({id:`article-${article.id}`,type:'NEWS',severity:article.status==='DRAFT'?'INFO':'WARNING',title:article.status==='DRAFT'?'Club story remains a draft':'Club story is awaiting PlayFooty approval',detail:article.title,href:permissions.media?`/club-portal/${clubId}/news`:null,permission:'media',createdAt:new Date(article.updatedAt).toISOString()})
  for(const deal of sponsors){const remaining=dayCount(deal.endDate),name=deal.sponsor?.name??'Club sponsor',updated=deal.updatedAt?new Date(deal.updatedAt).toISOString():null;if(deal.status==='PENDING'||deal.status==='VERIFICATION_REQUIRED')actions.push({id:`sponsor-${deal.id}`,type:'SPONSOR',severity:deal.status==='VERIFICATION_REQUIRED'?'WARNING':'INFO',title:deal.status==='VERIFICATION_REQUIRED'?'Sponsor needs verification':'Sponsor is awaiting approval',detail:name,href:permissions.sponsors?`/club-portal/${clubId}/sponsors`:null,permission:'sponsors',createdAt:updated});else if(remaining!==null&&remaining<=30&&remaining>=0)actions.push({id:`sponsor-expiry-${deal.id}`,type:'SPONSOR',severity:remaining<=7?'URGENT':'WARNING',title:'Sponsor agreement is expiring',detail:`${name} expires in ${remaining} days`,href:permissions.sponsors?`/club-portal/${clubId}/sponsors`:null,permission:'sponsors',createdAt:updated})}
  const pendingUsers=Number(pendingRows[0]?.count??0)
  if(pendingUsers)actions.push({id:'pending-users',type:'USERS',severity:'WARNING',title:`${pendingUsers} club access request${pendingUsers===1?'':'s'} waiting`,detail:'Review the applicant or invitation before granting access.',href:permissions.manageUsers?`/club-portal/${clubId}/users`:null,permission:'manageUsers',createdAt:null})
  const activity=[...articles.map(row=>({id:`article-${row.id}`,type:'NEWS',title:row.title,status:row.status,createdAt:new Date(row.updatedAt).toISOString(),href:row.status==='PUBLISHED'?`/news/${row.slug}`:`/club-portal/${clubId}/news`})),...sheets.map(row=>({id:`sheet-${row.id}`,type:'TEAM_SELECTION',title:row.roundLabel,status:row.status,createdAt:new Date(row.updatedAt).toISOString(),href:`/club-portal/${clubId}/team-selection`})),...sponsors.map(row=>({id:`sponsor-${row.id}`,type:'SPONSOR',title:row.sponsor?.name??'Sponsor',status:row.status,createdAt:new Date(row.updatedAt).toISOString(),href:`/club-portal/${clubId}/sponsors`}))].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,12)
  const order:Record<Severity,number>={URGENT:0,WARNING:1,INFO:2};actions.sort((a,b)=>order[a.severity]-order[b.severity])
  res.json({data:{club:{id:club.id,name:club.name,logoUrl:club.logoUrl},membership:{role:membership.role,permissions},analytics,actions,notifications,activity,summary:{openActions:actions.length,unreadNotifications:notifications.filter(row=>!['READ','SUPPRESSED'].includes(row.status)).length,pendingApprovals:actions.filter(row=>row.title.toLowerCase().includes('approval')).length,expiringSponsors:actions.filter(row=>row.id.startsWith('sponsor-expiry-')).length},generatedAt:new Date().toISOString()}})
 }catch(error){res.status(500).json({error:'Unable to load club insights',detail:String(error)})}
})

router.patch('/clubs/:clubId/notifications/:notificationId/read',requireActiveClubMembership,async(req,res)=>{const item=await prisma.notification.findFirst({where:{id:req.params.notificationId,recipientScope:'CLUB',recipientId:req.params.clubId}});if(!item)return res.status(404).json({error:'Notification not found for this club'});res.json({data:await prisma.notification.update({where:{id:item.id},data:{status:'READ',readAt:new Date()}})})})
export {router as clubPortalInsightsRouter}
