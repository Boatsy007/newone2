import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, ensureClubMembershipSchema, membershipForClub, roleCan, auditMembership } from '../../auth/club-auth.js'

const router=Router()
const editable=['ground','address','googleMapsUrl','websiteUrl','facebookUrl','instagramUrl','tiktokUrl','youtubeUrl','email','phone','trainingNights','homeCourt','clubColours','history','foundedYear','committee','president','secretary','coach','assistantCoach','membershipLink','volunteerLink'] as const
const imageTypes=new Set(['image/png','image/jpeg','image/jpg','image/webp'])
const maxBytes=8*1024*1024
function clean(v:unknown,max=2000){return typeof v==='string'?v.trim().slice(0,max):''}
function parseList(v:string|null|undefined){try{const p=v?JSON.parse(v):[];return Array.isArray(p)?p.filter(x=>typeof x==='string'):[]}catch{return[]}}
async function requireProfileRole(req:any,res:any,next:any){
 try{
  await ensureClubMembershipSchema()
  const m=await membershipForClub(req.clubUser.id,String(req.params.clubId))
  if(!m||m.status!=='ACTIVE'||!roleCan(m.role,'profile'))return res.status(403).json({error:'You do not have permission to manage this club profile'})
  res.locals.clubMembership=m
  next()
 }catch(error){
  res.status(500).json({error:'Unable to verify club profile access',detail:error instanceof Error?error.message:String(error)})
 }
}
router.use('/clubs/:clubId',authenticateClubUser,requireProfileRole)
router.get('/clubs/:clubId',async(req,res)=>{
 try{
  const club=await prisma.club.findFirst({where:{id:req.params.clubId,archivedAt:null},select:{id:true,name:true,shortName:true,logoUrl:true,primaryColour:true,secondaryColour:true,description:true,websiteUrl:true,facebookUrl:true,instagramUrl:true,contactEmail:true,state:{select:{code:true,name:true}},leagueSeasons:{where:{isActive:true},orderBy:{season:'desc'},take:1,select:{season:true,grade:true,leagueId:true,league:{select:{name:true}}}}}})
  if(!club)return res.status(404).json({error:'Club not found'})
  const profile=await prisma.clubProfile.upsert({where:{clubId:club.id},create:{clubId:club.id},update:{}})
  const season=club.leagueSeasons[0]??null
  const publicColours=[club.primaryColour,club.secondaryColour].filter(Boolean).join(' / ')
  const mergedProfile={
   ...profile,
   websiteUrl:profile.websiteUrl??club.websiteUrl??null,
   facebookUrl:profile.facebookUrl??club.facebookUrl??null,
   instagramUrl:profile.instagramUrl??club.instagramUrl??null,
   email:profile.email??club.contactEmail??null,
   history:profile.history??club.description??null,
   clubColours:profile.clubColours??publicColours||null,
   gallery:parseList(profile.gallery),
   uniformPhotos:parseList(profile.uniformPhotos),
  }
  res.json({data:{club:{...club,season:season?.season??null,grade:season?.grade??null,leagueId:season?.leagueId??null,leagueName:season?.league.name??null},profile:mergedProfile}})
 }catch(error){
  res.status(500).json({error:'Unable to load club profile',detail:error instanceof Error?error.message:String(error)})
 }
})
router.patch('/clubs/:clubId',async(req,res)=>{try{const body=(req.body??{}) as Record<string,unknown>;const updates:Record<string,unknown>={};for(const field of editable)if(field in body)updates[field]=body[field]===''?null:body[field];if(!Object.keys(updates).length)return res.status(400).json({error:'No editable profile fields supplied'});if(typeof updates.email==='string'&&!String(updates.email).includes('@'))return res.status(400).json({error:'Enter a valid contact email address'});const before=await prisma.clubProfile.upsert({where:{clubId:req.params.clubId},create:{clubId:req.params.clubId},update:{}});const profile=await prisma.clubProfile.update({where:{clubId:req.params.clubId},data:updates as never});const core:Record<string,unknown>={};if('history'in updates)core.description=updates.history;if('websiteUrl'in updates)core.websiteUrl=updates.websiteUrl;if('facebookUrl'in updates)core.facebookUrl=updates.facebookUrl;if('instagramUrl'in updates)core.instagramUrl=updates.instagramUrl;if('email'in updates)core.contactEmail=updates.email;if(Object.keys(core).length)await prisma.club.update({where:{id:req.params.clubId},data:core});const membership=res.locals.clubMembership;await auditMembership(membership.id,req.params.clubId,req.clubUser.id,'PROFILE_UPDATED',req.clubUser.id,{before:Object.fromEntries(editable.map(field=>[field,before[field]])),after:updates});res.json({data:{...profile,gallery:parseList(profile.gallery),uniformPhotos:parseList(profile.uniformPhotos)},message:'Club profile saved and public profile updated'})}catch(error){res.status(500).json({error:'Unable to save club profile',detail:error instanceof Error?error.message:String(error)})}})
router.post('/clubs/:clubId/photos',async(req,res)=>{try{const kind=String(req.body?.kind??'gallery')==='uniform'?'uniform':'gallery';const type=String(req.body?.contentType??'image/jpeg');if(!imageTypes.has(type))return res.status(400).json({error:'Use PNG, JPG or WEBP images'});const raw=String(req.body?.dataUrl??'');const base64=raw.includes(',')?raw.split(',').pop()!:raw;const buffer=Buffer.from(base64,'base64');if(!buffer.length||buffer.length>maxBytes)return res.status(400).json({error:'Image must be between 1 byte and 8 MB'});const url=process.env.SUPABASE_URL?.replace(/\/$/,'');const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY;const bucket=process.env.SUPABASE_NEWS_BUCKET||process.env.SUPABASE_LOGO_BUCKET||'playfooty-logos';if(!url||!key)return res.status(503).json({error:'Photo storage is not configured'});const ext=type.includes('png')?'png':type.includes('webp')?'webp':'jpg';const path=`club-photos/${req.params.clubId}/${kind}/${Date.now()}.${ext}`;const upload=await fetch(`${url}/storage/v1/object/${bucket}/${path}`,{method:'POST',headers:{authorization:`Bearer ${key}`,apikey:key,'content-type':type,'x-upsert':'true'},body:buffer});if(!upload.ok)return res.status(400).json({error:`Photo upload failed: HTTP ${upload.status}`});const publicUrl=`${url}/storage/v1/object/public/${bucket}/${path}`;const profile=await prisma.clubProfile.upsert({where:{clubId:req.params.clubId},create:{clubId:req.params.clubId},update:{}});const field=kind==='uniform'?'uniformPhotos':'gallery';const list=[...parseList(profile[field]),publicUrl].slice(-30);await prisma.clubProfile.update({where:{clubId:req.params.clubId},data:{[field]:JSON.stringify(list)}});const membership=res.locals.clubMembership;await auditMembership(membership.id,req.params.clubId,req.clubUser.id,'PROFILE_PHOTO_ADDED',req.clubUser.id,{kind,url:publicUrl});res.status(201).json({data:{url:publicUrl,kind,photos:list}})}catch(error){res.status(500).json({error:'Unable to upload club photo',detail:String(error)})}})
router.delete('/clubs/:clubId/photos',async(req,res)=>{try{const url=clean(req.body?.url,2000),kind=String(req.body?.kind??'gallery')==='uniform'?'uniform':'gallery';if(!url)return res.status(400).json({error:'Photo URL is required'});const profile=await prisma.clubProfile.upsert({where:{clubId:req.params.clubId},create:{clubId:req.params.clubId},update:{}});const field=kind==='uniform'?'uniformPhotos':'gallery';const list=parseList(profile[field]).filter(item=>item!==url);await prisma.clubProfile.update({where:{clubId:req.params.clubId},data:{[field]:JSON.stringify(list)}});const membership=res.locals.clubMembership;await auditMembership(membership.id,req.params.clubId,req.clubUser.id,'PROFILE_PHOTO_REMOVED',req.clubUser.id,{kind,url});res.json({data:{photos:list}})}catch(error){res.status(500).json({error:'Unable to remove club photo',detail:error instanceof Error?error.message:String(error)})}})
export {router as clubProfileManagementRouter}
