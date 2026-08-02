import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, membershipForClub, requireActiveClubMembership, roleCan } from '../../auth/club-auth.js'

const router=Router()
let ready:Promise<void>|null=null
function ensureTable(){
 if(!ready)ready=prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS club_media_publications (
  id text PRIMARY KEY, club_id text NOT NULL, media_asset_id text NOT NULL, article_id text NOT NULL,
  sponsor_id text, social_caption text, status text NOT NULL DEFAULT 'DRAFT', created_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(club_id,media_asset_id,article_id)
 )`).then(async()=>{
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS club_media_publications_club_idx ON club_media_publications(club_id,created_at DESC)`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS club_media_publications_sponsor_idx ON club_media_publications(club_id,sponsor_id,status)`)
 }).catch(error=>{ready=null;throw error})
 return ready
}
async function requireMedia(req:any,res:any,next:any){const membership=res.locals.clubMembership as Awaited<ReturnType<typeof membershipForClub>>;if(!membership||!roleCan(membership.role,'media'))return res.status(403).json({error:'Your club role cannot publish media'});next()}
const clean=(value:unknown,max:number)=>String(value??'').trim().slice(0,max)
const slugify=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,140)
const paragraphs=(value:string)=>JSON.stringify(value.split(/\n{2,}/).map(text=>text.trim()).filter(Boolean).map(text=>({type:'p',text})))

router.use(authenticateClubUser)
router.use('/clubs/:clubId',requireActiveClubMembership,requireMedia)

router.get('/clubs/:clubId/assets/:assetId',async(req,res)=>{
 try{
  await ensureTable()
  const rows=await prisma.$queryRawUnsafe<Array<any>>(`SELECT id,title,description,media_type AS "mediaType",file_url AS "fileUrl",sponsor_id AS "sponsorId",source_entity_type AS "sourceEntityType",source_entity_id AS "sourceEntityId" FROM club_media_assets WHERE id=$1 AND club_id=$2 AND archived_at IS NULL LIMIT 1`,req.params.assetId,req.params.clubId)
  const asset=rows[0];if(!asset)return res.status(404).json({error:'Media asset not found'})
  const club=await prisma.club.findUnique({where:{id:req.params.clubId},select:{id:true,name:true}});if(!club)return res.status(404).json({error:'Club not found'})
  const title=asset.title
  const summary=asset.description||`${club.name} has shared a new ${String(asset.mediaType).toLowerCase().replaceAll('_',' ')} update.`
  const body=`${summary}\n\nFollow ${club.name} on PlayFooty for the latest club news and match updates.`
  const caption=asset.mediaType==='TEAM_SELECTION'?`${title} locked in 🔒\n\nFollow ${club.name} on PlayFooty for team news and match updates.`:asset.mediaType==='MILESTONE'?`Congratulations on a special ${title}.\n\nA proud moment for the player, family and ${club.name}.`:`${title}\n\nFollow ${club.name} on PlayFooty for the latest updates.`
  res.json({data:{asset,club,suggestion:{title,summary,body,caption}}})
 }catch(error){res.status(500).json({error:'Unable to prepare media publication',detail:String(error)})}
})

router.post('/clubs/:clubId/assets/:assetId',async(req,res)=>{
 try{
  await ensureTable()
  const rows=await prisma.$queryRawUnsafe<Array<any>>(`SELECT id,title,description,media_type AS "mediaType",file_url AS "fileUrl",sponsor_id AS "sponsorId",source_entity_type AS "sourceEntityType",source_entity_id AS "sourceEntityId" FROM club_media_assets WHERE id=$1 AND club_id=$2 AND archived_at IS NULL LIMIT 1`,req.params.assetId,req.params.clubId)
  const asset=rows[0];if(!asset)return res.status(404).json({error:'Media asset not found'})
  const club=await prisma.club.findUnique({where:{id:req.params.clubId},select:{id:true,name:true}});if(!club)return res.status(404).json({error:'Club not found'})
  const title=clean(req.body?.title,220),summary=clean(req.body?.summary,1000),body=clean(req.body?.body,20000),caption=clean(req.body?.caption,4000)
  if(!title||!summary||!body)return res.status(400).json({error:'Headline, summary and article body are required'})
  const requested=String(req.body?.status??'DRAFT').toUpperCase()==='APPROVED'?'APPROVED':'DRAFT'
  const base=slugify(title)||'club-media';let slug=base;let suffix=2
  while(await prisma.generatedArticle.findUnique({where:{slug},select:{id:true}}))slug=`${base}-${suffix++}`
  const article=await prisma.$transaction(async tx=>{
   const created=await tx.generatedArticle.create({data:{slug,kind:'CLUB_UPDATE',category:'club-news',title,subtitle:null,summary,body:paragraphs(body),heroSeed:asset.fileUrl,tags:JSON.stringify({club:club.name,clubId:club.id,source:'CLUB_MEDIA',mediaAssetId:asset.id,sponsorId:asset.sponsorId||null}),status:requested,author:club.name,sourceData:JSON.stringify({source:'CLUB_MEDIA',clubId:club.id,mediaAssetId:asset.id,sponsorId:asset.sponsorId||null,sourceEntityType:asset.sourceEntityType||null,sourceEntityId:asset.sourceEntityId||null,userId:req.clubUser!.id,createdAt:new Date().toISOString()}),confidence:1,reasoning:'Created by an approved club representative from a PlayFooty media asset.',seoTitle:title,seoDescription:summary.slice(0,500)}})
   await tx.articleLink.create({data:{articleId:created.id,entityType:'CLUB',entityId:club.id,label:club.name}})
   return created
  })
  await prisma.$executeRawUnsafe(`INSERT INTO club_media_publications(id,club_id,media_asset_id,article_id,sponsor_id,social_caption,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,randomUUID(),club.id,asset.id,article.id,asset.sponsorId||null,caption||null,requested,req.clubUser!.id)
  res.status(201).json({data:{articleId:article.id,slug:article.slug,status:article.status,caption,heroImage:asset.fileUrl},message:requested==='APPROVED'?'Article submitted to the PlayFooty news approval queue':'News draft saved'})
 }catch(error){res.status(500).json({error:'Unable to create news article from media',detail:String(error)})}
})

router.get('/clubs/:clubId/sponsor-report',async(req,res)=>{
 try{
  await ensureTable()
  const rows=await prisma.$queryRawUnsafe<Array<any>>(`SELECT p.sponsor_id AS "sponsorId",COALESCE(s.name,'Sponsor') AS "sponsorName",COUNT(*)::int AS appearances,COUNT(*) FILTER (WHERE p.status='APPROVED')::int AS submitted,MAX(p.created_at) AS "lastAppearance" FROM club_media_publications p LEFT JOIN commercial_sponsors s ON s.id::text=p.sponsor_id WHERE p.club_id=$1 AND p.sponsor_id IS NOT NULL GROUP BY p.sponsor_id,s.name ORDER BY appearances DESC`,req.params.clubId).catch(()=>[])
  res.json({data:rows})
 }catch(error){res.status(500).json({error:'Unable to load sponsor media report',detail:String(error)})}
})

export {router as clubMediaPublishingRouter}
