import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, membershipForClub, requireActiveClubMembership, roleCan } from '../../auth/club-auth.js'

const router = Router()
const MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET || process.env.SUPABASE_LOGO_BUCKET || 'playfooty-logos'
const IMAGE_TYPES = new Set(['image/png','image/jpeg','image/jpg','image/webp'])
const EXT:Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/jpg':'jpg','image/webp':'webp'}
const MEDIA_TYPES = new Set(['PLAYER','MATCH','MILESTONE','TEAM_SELECTION','SPONSOR','CLUB','GENERATED','OTHER'])
const STATUSES = new Set(['DRAFT','READY','ARCHIVED'])
let ready:Promise<void>|null=null

function ensureTable(){
 if(!ready)ready=prisma.$executeRawUnsafe(`
  CREATE TABLE IF NOT EXISTS club_media_assets (
   id text PRIMARY KEY,
   club_id text NOT NULL,
   title text NOT NULL,
   description text,
   media_type text NOT NULL DEFAULT 'OTHER',
   status text NOT NULL DEFAULT 'READY',
   file_url text NOT NULL,
   storage_path text,
   content_type text,
   file_size integer,
   width integer,
   height integer,
   tags jsonb NOT NULL DEFAULT '[]'::jsonb,
   player_id text,
   sponsor_id text,
   source_entity_type text,
   source_entity_id text,
   created_by text,
   created_at timestamptz NOT NULL DEFAULT now(),
   updated_at timestamptz NOT NULL DEFAULT now(),
   archived_at timestamptz
  )
 `).then(async()=>{
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS club_media_assets_club_idx ON club_media_assets(club_id,created_at DESC)`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS club_media_assets_type_idx ON club_media_assets(club_id,media_type,status)`)
 }).catch(error=>{ready=null;throw error})
 return ready
}

async function requireMediaPermission(req:any,res:any,next:any){
 const membership=res.locals.clubMembership as Awaited<ReturnType<typeof membershipForClub>>
 if(!membership||!roleCan(membership.role,'media'))return res.status(403).json({error:'Your club role cannot manage media'})
 next()
}
const text=(value:unknown,max=180)=>String(value??'').trim().slice(0,max)
const tags=(value:unknown)=>Array.isArray(value)?value.map(item=>text(item,40)).filter(Boolean).slice(0,20):[]

router.use(authenticateClubUser)
router.use('/clubs/:clubId',requireActiveClubMembership,requireMediaPermission)

router.get('/clubs/:clubId',async(req,res)=>{
 try{
  await ensureTable()
  const type=text(req.query.type,40)
  const status=text(req.query.status,20)
  const query=text(req.query.q,100).toLowerCase()
  const rows=await prisma.$queryRawUnsafe<Array<Record<string,unknown>>>(`
   SELECT id,club_id AS "clubId",title,description,media_type AS "mediaType",status,file_url AS "fileUrl",
    content_type AS "contentType",file_size AS "fileSize",width,height,tags,player_id AS "playerId",sponsor_id AS "sponsorId",
    source_entity_type AS "sourceEntityType",source_entity_id AS "sourceEntityId",created_by AS "createdBy",
    created_at AS "createdAt",updated_at AS "updatedAt"
   FROM club_media_assets
   WHERE club_id=$1 AND archived_at IS NULL
    AND ($2='' OR media_type=$2)
    AND ($3='' OR status=$3)
    AND ($4='' OR lower(title) LIKE '%'||$4||'%' OR lower(coalesce(description,'')) LIKE '%'||$4||'%')
   ORDER BY created_at DESC LIMIT 300
  `,req.params.clubId,type,status,query)
  res.set('Cache-Control','no-store')
  res.json({data:rows})
 }catch(error){res.status(500).json({error:'Unable to load media library',detail:String(error)})}
})

router.post('/clubs/:clubId/upload',async(req,res)=>{
 try{
  await ensureTable()
  const contentType=text(req.body?.contentType,80)||'image/jpeg'
  if(!IMAGE_TYPES.has(contentType))return res.status(400).json({error:'Use PNG, JPG or WEBP images'})
  const raw=String(req.body?.dataUrl??req.body?.base64??''),base64=raw.includes(',')?raw.split(',').pop()!:raw,buffer=Buffer.from(base64,'base64')
  if(!buffer.length||buffer.length>10*1024*1024)return res.status(400).json({error:'Media image must be between 1 byte and 10 MB'})
  const url=(process.env.SUPABASE_URL??'').replace(/\/$/,'');const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||''
  if(!url||!key)return res.status(503).json({error:'Media storage is not configured'})
  const id=randomUUID(),ext=EXT[contentType]??'jpg',path=`club-media/${req.params.clubId}/${id}.${ext}`
  const upload=await fetch(`${url}/storage/v1/object/${MEDIA_BUCKET}/${path}`,{method:'POST',headers:{authorization:`Bearer ${key}`,apikey:key,'content-type':contentType,'x-upsert':'false'},body:buffer})
  if(!upload.ok)return res.status(400).json({error:`Media upload failed: HTTP ${upload.status}`})
  const fileUrl=`${url}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`
  const mediaType=MEDIA_TYPES.has(String(req.body?.mediaType))?String(req.body.mediaType):'OTHER'
  const status=STATUSES.has(String(req.body?.status))?String(req.body.status):'READY'
  const title=text(req.body?.title)||'Untitled media'
  await prisma.$executeRawUnsafe(`
   INSERT INTO club_media_assets(id,club_id,title,description,media_type,status,file_url,storage_path,content_type,file_size,width,height,tags,player_id,sponsor_id,source_entity_type,source_entity_id,created_by)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,$17,$18)
  `,id,req.params.clubId,title,text(req.body?.description,1000)||null,mediaType,status,fileUrl,path,contentType,buffer.length,
   Number(req.body?.width)||null,Number(req.body?.height)||null,JSON.stringify(tags(req.body?.tags)),text(req.body?.playerId,80)||null,text(req.body?.sponsorId,80)||null,
   text(req.body?.sourceEntityType,60)||null,text(req.body?.sourceEntityId,100)||null,req.clubUser!.id)
  res.status(201).json({data:{id,clubId:req.params.clubId,title,description:text(req.body?.description,1000)||null,mediaType,status,fileUrl,contentType,fileSize:buffer.length,tags:tags(req.body?.tags),createdAt:new Date().toISOString()},message:'Media uploaded'})
 }catch(error){res.status(500).json({error:'Unable to upload media',detail:String(error)})}
})

router.patch('/clubs/:clubId/:id',async(req,res)=>{
 try{
  await ensureTable()
  const rows=await prisma.$queryRawUnsafe<Array<{id:string}>>(`SELECT id FROM club_media_assets WHERE id=$1 AND club_id=$2 AND archived_at IS NULL LIMIT 1`,req.params.id,req.params.clubId)
  if(!rows[0])return res.status(404).json({error:'Media asset not found'})
  const mediaType=MEDIA_TYPES.has(String(req.body?.mediaType))?String(req.body.mediaType):'OTHER'
  const status=STATUSES.has(String(req.body?.status))?String(req.body.status):'READY'
  await prisma.$executeRawUnsafe(`UPDATE club_media_assets SET title=$3,description=$4,media_type=$5,status=$6,tags=$7::jsonb,player_id=$8,sponsor_id=$9,updated_at=now() WHERE id=$1 AND club_id=$2`,
   req.params.id,req.params.clubId,text(req.body?.title)||'Untitled media',text(req.body?.description,1000)||null,mediaType,status,JSON.stringify(tags(req.body?.tags)),text(req.body?.playerId,80)||null,text(req.body?.sponsorId,80)||null)
  res.json({data:{id:req.params.id},message:'Media details saved'})
 }catch(error){res.status(500).json({error:'Unable to update media',detail:String(error)})}
})

router.delete('/clubs/:clubId/:id',async(req,res)=>{
 try{
  await ensureTable()
  const changed=await prisma.$executeRawUnsafe(`UPDATE club_media_assets SET status='ARCHIVED',archived_at=now(),updated_at=now() WHERE id=$1 AND club_id=$2 AND archived_at IS NULL`,req.params.id,req.params.clubId)
  if(!changed)return res.status(404).json({error:'Media asset not found'})
  res.json({data:{archived:true},message:'Media archived'})
 }catch(error){res.status(500).json({error:'Unable to archive media',detail:String(error)})}
})

export {router as clubMediaRouter}
