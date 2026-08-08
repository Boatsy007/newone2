import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, requireActiveClubMembership, roleCan } from '../../auth/club-auth.js'

export const whiteboardPlatformRouter=Router()
let ready:Promise<void>|null=null
function ensureTables(){
 if(!ready)ready=(async()=>{
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS football_whiteboard_plays(
   id uuid PRIMARY KEY,club_id text NOT NULL,title text NOT NULL,category text NOT NULL DEFAULT 'General',visibility text NOT NULL DEFAULT 'PRIVATE',notes text NULL,fixture_label text NULL,play_data jsonb NOT NULL,share_token text NULL UNIQUE,created_by text NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now())`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS football_whiteboard_plays_club_idx ON football_whiteboard_plays(club_id,updated_at DESC)`)
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS football_whiteboard_versions(
   id uuid PRIMARY KEY,play_id uuid NOT NULL,play_data jsonb NOT NULL,notes text NULL,created_by text NULL,created_at timestamptz NOT NULL DEFAULT now())`)
 })().catch(error=>{ready=null;throw error})
 return ready
}
const clean=(v:unknown,n:number)=>String(v??'').trim().slice(0,n)
function canManage(res:any){const membership=res.locals.clubMembership as {role?:Parameters<typeof roleCan>[0]}|undefined;return Boolean(membership?.role&&roleCan(membership.role,'team_selection'))}

whiteboardPlatformRouter.get('/share/:token',async(req,res)=>{
 try{await ensureTables();const rows=await prisma.$queryRawUnsafe<any[]>(`SELECT id::text,title,category,notes,fixture_label AS "fixtureLabel",play_data AS play,updated_at AS "updatedAt" FROM football_whiteboard_plays WHERE share_token=$1 AND visibility='SHARED' LIMIT 1`,req.params.token);if(!rows[0])return res.status(404).json({error:'Shared tactic not found'});return res.json({data:rows[0]})}catch(error){return res.status(500).json({error:'Unable to load shared tactic',detail:String(error)})}
})
whiteboardPlatformRouter.use(authenticateClubUser)
whiteboardPlatformRouter.use('/clubs/:clubId',requireActiveClubMembership)

whiteboardPlatformRouter.get('/clubs/:clubId/plays',async(req,res)=>{
 try{await ensureTables();if(!canManage(res))return res.status(403).json({error:'Your role cannot access club tactics'});const rows=await prisma.$queryRawUnsafe<any[]>(`SELECT id::text,title,category,visibility,notes,fixture_label AS "fixtureLabel",play_data AS play,share_token AS "shareToken",updated_at AS "updatedAt" FROM football_whiteboard_plays WHERE club_id=$1 ORDER BY updated_at DESC LIMIT 200`,req.params.clubId);return res.json({data:rows})}catch(error){return res.status(500).json({error:'Unable to load club tactics',detail:String(error)})}
})
whiteboardPlatformRouter.post('/clubs/:clubId/plays',async(req,res)=>{
 try{await ensureTables();if(!canManage(res))return res.status(403).json({error:'Your role cannot save club tactics'});const title=clean(req.body?.title,120);if(!title)return res.status(400).json({error:'Enter a tactic title'});const id=randomUUID();const play=req.body?.play&&typeof req.body.play==='object'?req.body.play:{};await prisma.$executeRawUnsafe(`INSERT INTO football_whiteboard_plays(id,club_id,title,category,visibility,notes,fixture_label,play_data,created_by) VALUES($1::uuid,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,id,req.params.clubId,title,clean(req.body?.category,60)||'General',req.body?.visibility==='CLUB'?'CLUB':'PRIVATE',clean(req.body?.notes,2000)||null,clean(req.body?.fixtureLabel,180)||null,JSON.stringify(play),res.locals.clubMembership?.userId??null);await prisma.$executeRawUnsafe(`INSERT INTO football_whiteboard_versions(id,play_id,play_data,notes,created_by) VALUES($1::uuid,$2::uuid,$3::jsonb,$4,$5)`,randomUUID(),id,JSON.stringify(play),'Initial version',res.locals.clubMembership?.userId??null);return res.status(201).json({data:{id,title}})}catch(error){return res.status(500).json({error:'Unable to save club tactic',detail:String(error)})}
})
whiteboardPlatformRouter.put('/clubs/:clubId/plays/:id',async(req,res)=>{
 try{await ensureTables();if(!canManage(res))return res.status(403).json({error:'Your role cannot update club tactics'});const play=req.body?.play&&typeof req.body.play==='object'?req.body.play:{};const changed=await prisma.$executeRawUnsafe(`UPDATE football_whiteboard_plays SET title=$3,category=$4,visibility=$5,notes=$6,fixture_label=$7,play_data=$8::jsonb,updated_at=now() WHERE id::text=$1 AND club_id=$2`,req.params.id,req.params.clubId,clean(req.body?.title,120)||'Untitled tactic',clean(req.body?.category,60)||'General',req.body?.visibility==='CLUB'?'CLUB':'PRIVATE',clean(req.body?.notes,2000)||null,clean(req.body?.fixtureLabel,180)||null,JSON.stringify(play));if(!changed)return res.status(404).json({error:'Tactic not found'});await prisma.$executeRawUnsafe(`INSERT INTO football_whiteboard_versions(id,play_id,play_data,notes,created_by) VALUES($1::uuid,$2::uuid,$3::jsonb,$4,$5)`,randomUUID(),req.params.id,JSON.stringify(play),clean(req.body?.versionNote,240)||'Updated tactic',res.locals.clubMembership?.userId??null);return res.json({data:{id:req.params.id}})}catch(error){return res.status(500).json({error:'Unable to update tactic',detail:String(error)})}
})
whiteboardPlatformRouter.post('/clubs/:clubId/plays/:id/share',async(req,res)=>{
 try{await ensureTables();if(!canManage(res))return res.status(403).json({error:'Your role cannot share tactics'});const token=randomUUID().replaceAll('-','');const changed=await prisma.$executeRawUnsafe(`UPDATE football_whiteboard_plays SET visibility='SHARED',share_token=$3,updated_at=now() WHERE id::text=$1 AND club_id=$2`,req.params.id,req.params.clubId,token);if(!changed)return res.status(404).json({error:'Tactic not found'});return res.json({data:{token,url:`/coach-app/whiteboard-share?token=${token}`}})}catch(error){return res.status(500).json({error:'Unable to share tactic',detail:String(error)})}
})
whiteboardPlatformRouter.get('/clubs/:clubId/plays/:id/versions',async(req,res)=>{
 try{await ensureTables();if(!canManage(res))return res.status(403).json({error:'Your role cannot view tactic history'});const rows=await prisma.$queryRawUnsafe<any[]>(`SELECT v.id::text,v.notes,v.created_at AS "createdAt",v.play_data AS play FROM football_whiteboard_versions v JOIN football_whiteboard_plays p ON p.id=v.play_id WHERE p.id::text=$1 AND p.club_id=$2 ORDER BY v.created_at DESC LIMIT 50`,req.params.id,req.params.clubId);return res.json({data:rows})}catch(error){return res.status(500).json({error:'Unable to load tactic history',detail:String(error)})}
})
