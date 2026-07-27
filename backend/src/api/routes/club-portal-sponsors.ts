import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, auditMembership, membershipForClub, requireActiveClubMembership, roleCan } from '../../auth/club-auth.js'
import { createSponsor, updateSponsor } from '../../commercial/sponsors.service.js'
import { createSponsorship, softDeleteSponsorship } from '../../commercial/sponsorships.service.js'

const router = Router()
const EDITABLE_STATUSES = ['PENDING','REJECTED','VERIFICATION_REQUIRED']
const LOGO_BUCKET = process.env.SUPABASE_LOGO_BUCKET || 'playfooty-logos'
const IMAGE_TYPES = new Set(['image/png','image/jpeg','image/jpg','image/webp','image/svg+xml'])
const EXT:Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/jpg':'jpg','image/webp':'webp','image/svg+xml':'svg'}

function optionalUrl(value:unknown,label:string){const raw=String(value??'').trim();if(!raw)return null;try{const url=new URL(raw);if(!['http:','https:'].includes(url.protocol))throw new Error();return url.toString()}catch{throw new Error(`${label} must be a valid http or https URL`)}}
function optionalEmail(value:unknown){const raw=String(value??'').trim();if(!raw)return null;if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw))throw new Error('Sponsor email must be valid');return raw}
function dates(body:Record<string,unknown>){const start=body.startDate?new Date(String(body.startDate)):null,end=body.endDate?new Date(String(body.endDate)):null;if(start&&Number.isNaN(start.getTime()))throw new Error('Start date is invalid');if(end&&Number.isNaN(end.getTime()))throw new Error('End date is invalid');if(start&&end&&end<start)throw new Error('Expiry date cannot be before the start date');return{start,end}}

async function requireSponsorPermission(req:any,res:any,next:any){
  const membership=res.locals.clubMembership as Awaited<ReturnType<typeof membershipForClub>>
  if(!membership||!roleCan(membership.role,'sponsors'))return res.status(403).json({error:'Your club role cannot manage sponsors'})
  next()
}
async function ownedDeal(clubId:string,id:string){return prisma.sponsorship.findFirst({where:{id,clubId,deletedAt:null},include:{sponsor:true}})}

router.use(authenticateClubUser)
router.use('/clubs/:clubId',requireActiveClubMembership,requireSponsorPermission)

router.get('/clubs/:clubId/sponsors',async(req,res)=>{try{const rows=await prisma.sponsorship.findMany({where:{clubId:req.params.clubId,deletedAt:null},include:{sponsor:true},orderBy:[{displayPriority:'desc'},{createdAt:'desc'}]});res.json({data:rows})}catch(error){res.status(500).json({error:'Unable to load club sponsors',detail:String(error)})}})

router.post('/clubs/:clubId/sponsors',async(req,res)=>{try{
  const club=await prisma.club.findFirst({where:{id:req.params.clubId,archivedAt:null},select:{id:true,name:true,state:{select:{code:true}}}});if(!club)return res.status(404).json({error:'Club not found'})
  const body=(req.body??{}) as Record<string,unknown>,name=String(body.name??'').trim();if(!name)return res.status(400).json({error:'Sponsor name is required'})
  const {start,end}=dates(body),websiteUrl=optionalUrl(body.websiteUrl,'Sponsor website'),ctaUrl=optionalUrl(body.ctaUrl,'Sponsor button URL')||websiteUrl,email=optionalEmail(body.email),actor=`club:${req.clubUser!.id}`
  const created=await createSponsor({name,businessName:String(body.businessName??name),websiteUrl,email,phone:body.phone||null,description:body.description||null,industry:body.industry||null,state:club.state.code,tier:body.tier||'CLUB',status:'PENDING'},actor);if(!created.ok)return res.status(400).json({error:created.error})
  const deal=await createSponsorship({sponsorId:created.sponsor.id,scope:'CLUB',clubId:club.id,package:body.package||'CLUB_PARTNER',tier:body.tier||'CLUB',startDate:start,endDate:end,displayPriority:Math.max(0,Math.min(999,Number(body.displayPriority??0)||0)),bannerPosition:body.bannerPosition||'CLUB_PROFILE',ctaLabel:body.ctaLabel||'Visit sponsor',ctaUrl,notes:body.notes||null,currency:'AUD'},actor);if(!deal.ok)return res.status(400).json({error:deal.error})
  await auditMembership((res.locals.clubMembership as any)?.id??null,club.id,req.clubUser!.id,'SPONSOR_CREATED',req.clubUser!.id,{sponsorshipId:deal.sponsorship.id,sponsorId:created.sponsor.id,name,tier:body.tier||'CLUB',placement:body.bannerPosition||'CLUB_PROFILE'})
  res.status(201).json({data:{...deal.sponsorship,sponsor:created.sponsor},message:'Sponsor saved for PlayFooty approval'})
}catch(error){res.status(400).json({error:error instanceof Error?error.message:'Unable to create sponsor'})}})

router.patch('/clubs/:clubId/sponsors/:id',async(req,res)=>{try{
  const deal=await ownedDeal(req.params.clubId,req.params.id);if(!deal)return res.status(404).json({error:'Sponsorship not found'});if(!EDITABLE_STATUSES.includes(deal.status))return res.status(409).json({error:'Approved or active sponsorships must be changed by PlayFooty Admin'})
  const body=(req.body??{}) as Record<string,unknown>,{start,end}=dates(body),actor=`club:${req.clubUser!.id}`,sponsorFields:Record<string,unknown>={}
  for(const key of ['name','businessName','phone','description','industry','facebookUrl','instagramUrl','brandPrimary','brandSecondary'])if(key in body)sponsorFields[key]=body[key]||null
  if('websiteUrl'in body)sponsorFields.websiteUrl=optionalUrl(body.websiteUrl,'Sponsor website');if('email'in body)sponsorFields.email=optionalEmail(body.email)
  if(Object.keys(sponsorFields).length){const updated=await updateSponsor(deal.sponsorId,sponsorFields,actor);if(!updated.ok)return res.status(400).json({error:updated.error})}
  const updates:Record<string,unknown>={};for(const key of ['package','tier','bannerPosition','ctaLabel','notes'])if(key in body)updates[key]=body[key]||null
  if('ctaUrl'in body)updates.ctaUrl=optionalUrl(body.ctaUrl,'Sponsor button URL');if('startDate'in body)updates.startDate=start;if('endDate'in body)updates.endDate=end;if('displayPriority'in body)updates.displayPriority=Math.max(0,Math.min(999,Number(body.displayPriority??0)||0))
  const saved=Object.keys(updates).length?await prisma.sponsorship.update({where:{id:deal.id},data:updates}):deal,sponsor=await prisma.commercialSponsor.findUnique({where:{id:deal.sponsorId}})
  await auditMembership((res.locals.clubMembership as any)?.id??null,req.params.clubId,req.clubUser!.id,'SPONSOR_UPDATED',req.clubUser!.id,{sponsorshipId:deal.id,sponsorId:deal.sponsorId,fields:[...Object.keys(sponsorFields),...Object.keys(updates)]})
  res.json({data:{...saved,sponsor},message:'Sponsor changes saved'})
}catch(error){res.status(400).json({error:error instanceof Error?error.message:'Unable to update sponsor'})}})

router.post('/clubs/:clubId/sponsors/:id/logo',async(req,res)=>{try{
  const deal=await ownedDeal(req.params.clubId,req.params.id);if(!deal)return res.status(404).json({error:'Sponsorship not found'});if(!EDITABLE_STATUSES.includes(deal.status))return res.status(409).json({error:'Approved or active sponsor logos must be changed by PlayFooty Admin'})
  const body=(req.body??{}) as Record<string,unknown>,contentType=String(body.contentType??'image/png');if(!IMAGE_TYPES.has(contentType))return res.status(400).json({error:'Use PNG, JPG, WEBP or SVG'})
  const raw=String(body.dataUrl??body.base64??''),base64=raw.includes(',')?raw.split(',').pop()!:raw,buffer=Buffer.from(base64,'base64');if(!buffer.length||buffer.length>5*1024*1024)return res.status(400).json({error:'Sponsor logo must be between 1 byte and 5 MB'})
  const url=(process.env.SUPABASE_URL??'').replace(/\/$/,'');const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||'';if(!url||!key)return res.status(503).json({error:'Sponsor image storage is not configured'})
  const path=`sponsor-logos/${deal.sponsorId}/${Date.now()}.${EXT[contentType]??'png'}`,upload=await fetch(`${url}/storage/v1/object/${LOGO_BUCKET}/${path}`,{method:'POST',headers:{authorization:`Bearer ${key}`,apikey:key,'content-type':contentType,'x-upsert':'true'},body:buffer});if(!upload.ok)return res.status(400).json({error:`Logo upload failed: HTTP ${upload.status}`})
  const logoUrl=`${url}/storage/v1/object/public/${LOGO_BUCKET}/${path}`,sponsor=await prisma.commercialSponsor.update({where:{id:deal.sponsorId},data:{logoUrl,squareLogoUrl:logoUrl}})
  await auditMembership((res.locals.clubMembership as any)?.id??null,req.params.clubId,req.clubUser!.id,'SPONSOR_LOGO_UPDATED',req.clubUser!.id,{sponsorshipId:deal.id,sponsorId:deal.sponsorId})
  res.json({data:sponsor,message:'Sponsor logo uploaded'})
}catch(error){res.status(500).json({error:'Unable to upload sponsor logo',detail:String(error)})}})

router.delete('/clubs/:clubId/sponsors/:id',async(req,res)=>{try{const deal=await ownedDeal(req.params.clubId,req.params.id);if(!deal)return res.status(404).json({error:'Sponsorship not found'});if(!EDITABLE_STATUSES.includes(deal.status))return res.status(409).json({error:'Approved or active sponsorships must be archived by PlayFooty Admin'});const result=await softDeleteSponsorship(deal.id,`club:${req.clubUser!.id}`);if(result.ok)await auditMembership((res.locals.clubMembership as any)?.id??null,req.params.clubId,req.clubUser!.id,'SPONSOR_REMOVED',req.clubUser!.id,{sponsorshipId:deal.id,sponsorId:deal.sponsorId,name:deal.sponsor.name});res.status(result.ok?200:404).json(result.ok?{data:{archived:true}}:{error:result.error})}catch(error){res.status(500).json({error:'Unable to archive sponsor',detail:String(error)})}})

export {router as clubPortalSponsorsRouter}
