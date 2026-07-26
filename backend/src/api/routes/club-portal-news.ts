import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, membershipForClub, requireActiveClubMembership, roleCan } from '../../auth/club-auth.js'

const router = Router()
const NEWS_BUCKET = process.env.SUPABASE_NEWS_BUCKET || process.env.SUPABASE_LOGO_BUCKET || 'playfooty-logos'
const IMAGE_TYPES = new Set(['image/png','image/jpeg','image/jpg','image/webp'])
const IMAGE_EXT: Record<string,string> = {'image/png':'png','image/jpeg':'jpg','image/jpg':'jpg','image/webp':'webp'}

const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0,max) : ''
const slugify = (value:string) => value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,140)
const paragraphs = (value:string) => JSON.stringify(value.split(/\n{2,}/).map(text=>text.trim()).filter(Boolean).map(text=>({type:'p',text})))
const bodyText = (value:string) => { try { const rows=JSON.parse(value); return Array.isArray(rows)?rows.map(row=>String(row?.text??'')).filter(Boolean).join('\n\n'):'' } catch { return '' } }

async function requireMedia(req:any,res:any,next:any){
  const membership=res.locals.clubMembership as Awaited<ReturnType<typeof membershipForClub>>
  if(!membership || !roleCan(membership.role,'media')) return res.status(403).json({error:'Your club role cannot manage news and media'})
  next()
}

async function ownedArticle(clubId:string,articleId:string){
  const link=await prisma.articleLink.findFirst({where:{articleId,entityType:'CLUB',entityId:clubId},select:{id:true}})
  if(!link)return null
  return prisma.generatedArticle.findUnique({where:{id:articleId}})
}

router.use(authenticateClubUser)
router.get('/clubs/:clubId/news',requireActiveClubMembership,requireMedia,async(req,res)=>{
  const links=await prisma.articleLink.findMany({where:{entityType:'CLUB',entityId:req.params.clubId},orderBy:{createdAt:'desc'},select:{articleId:true}})
  const ids=[...new Set(links.map(item=>item.articleId))]
  const rows=ids.length?await prisma.generatedArticle.findMany({where:{id:{in:ids},status:{not:'ARCHIVED'}},orderBy:{updatedAt:'desc'}}):[]
  res.json({data:rows.map(row=>({id:row.id,slug:row.slug,title:row.title,subtitle:row.subtitle,summary:row.summary,body:bodyText(row.body),heroSeed:row.heroSeed,status:row.status,author:row.author,createdAt:row.createdAt,updatedAt:row.updatedAt,publishedAt:row.publishedAt}))})
})

router.post('/clubs/:clubId/news',requireActiveClubMembership,requireMedia,async(req,res)=>{
  const club=await prisma.club.findUnique({where:{id:req.params.clubId},select:{id:true,name:true}})
  if(!club)return res.status(404).json({error:'Club not found'})
  const title=clean(req.body?.title,220),summary=clean(req.body?.summary,1000),articleBody=clean(req.body?.body,20000)
  if(!title||!summary||!articleBody)return res.status(400).json({error:'Headline, summary and article body are required'})
  const base=slugify(title)||'club-news';let slug=base;let suffix=2
  while(await prisma.generatedArticle.findUnique({where:{slug},select:{id:true}}))slug=`${base}-${suffix++}`
  const article=await prisma.$transaction(async tx=>{
    const created=await tx.generatedArticle.create({data:{slug,kind:'CLUB_UPDATE',category:'club-news',title,subtitle:clean(req.body?.subtitle,300)||null,summary,body:paragraphs(articleBody),heroSeed:slug,tags:JSON.stringify({club:club.name,clubId:club.id,source:'CLUB_PORTAL'}),status:'DRAFT',author:clean(req.body?.author,120)||club.name,sourceData:JSON.stringify({source:'CLUB_PORTAL',clubId:club.id,userId:req.clubUser!.id,createdAt:new Date().toISOString()}),confidence:1,reasoning:'Submitted by an approved club representative.',seoTitle:title,seoDescription:summary.slice(0,500)}})
    await tx.articleLink.create({data:{articleId:created.id,entityType:'CLUB',entityId:club.id,label:club.name}})
    return created
  })
  res.status(201).json({data:{...article,body:articleBody}})
})

router.patch('/clubs/:clubId/news/:articleId',requireActiveClubMembership,requireMedia,async(req,res)=>{
  const article=await ownedArticle(req.params.clubId,req.params.articleId)
  if(!article)return res.status(404).json({error:'Club article not found'})
  if(article.status==='PUBLISHED')return res.status(409).json({error:'Published articles must be changed by PlayFooty Admin'})
  const requested=String(req.body?.status??article.status).toUpperCase()
  if(!['DRAFT','APPROVED'].includes(requested))return res.status(400).json({error:'Club articles can only be draft or awaiting approval'})
  const title=clean(req.body?.title,220),summary=clean(req.body?.summary,1000),articleBody=clean(req.body?.body,20000)
  if(!title||!summary||!articleBody)return res.status(400).json({error:'Headline, summary and article body are required'})
  const updated=await prisma.generatedArticle.update({where:{id:article.id},data:{title,subtitle:clean(req.body?.subtitle,300)||null,summary,body:paragraphs(articleBody),author:clean(req.body?.author,120)||article.author,status:requested,seoTitle:title,seoDescription:summary.slice(0,500),publishedAt:null}})
  res.json({data:{...updated,body:articleBody},message:requested==='APPROVED'?'Article submitted for PlayFooty approval':'Draft saved'})
})

router.post('/clubs/:clubId/news/:articleId/image',requireActiveClubMembership,requireMedia,async(req,res)=>{
  const article=await ownedArticle(req.params.clubId,req.params.articleId)
  if(!article)return res.status(404).json({error:'Club article not found'})
  if(article.status==='PUBLISHED')return res.status(409).json({error:'Published article images must be changed by PlayFooty Admin'})
  const contentType=clean(req.body?.contentType,80)||'image/jpeg'
  if(!IMAGE_TYPES.has(contentType))return res.status(400).json({error:'Use a PNG, JPG or WEBP image'})
  const raw=clean(req.body?.dataUrl,12000000)
  if(!raw)return res.status(400).json({error:'Image data is required'})
  const buffer=Buffer.from(raw.includes(',')?raw.split(',').pop()!:raw,'base64')
  if(!buffer.length||buffer.length>8*1024*1024)return res.status(400).json({error:'Image must be 8 MB or smaller'})
  const url=(process.env.SUPABASE_URL??'').replace(/\/$/,'');const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||''
  if(!url||!key)return res.status(503).json({error:'News image storage is not configured'})
  const path=`news-images/${article.id}/${Date.now()}-club.${IMAGE_EXT[contentType]??'jpg'}`
  const upload=await fetch(`${url}/storage/v1/object/${NEWS_BUCKET}/${path}`,{method:'POST',headers:{authorization:`Bearer ${key}`,apikey:key,'content-type':contentType,'x-upsert':'true'},body:buffer})
  if(!upload.ok)return res.status(400).json({error:`Image upload failed: ${await upload.text().catch(()=>`HTTP ${upload.status}`)}`})
  const publicUrl=`${url}/storage/v1/object/public/${NEWS_BUCKET}/${path}`
  const updated=await prisma.generatedArticle.update({where:{id:article.id},data:{heroSeed:publicUrl}})
  res.json({data:{id:updated.id,heroSeed:updated.heroSeed}})
})

export { router as clubPortalNewsRouter }
