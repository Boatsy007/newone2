import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, requireActiveClubMembership, roleCan } from '../../auth/club-auth.js'

export const whiteboardIntelligenceRouter=Router()
whiteboardIntelligenceRouter.use(authenticateClubUser)
whiteboardIntelligenceRouter.use('/clubs/:clubId',requireActiveClubMembership)

let ready:Promise<void>|null=null
function ensureTables(){
 if(!ready)ready=(async()=>{
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS football_whiteboard_usage(
   id uuid PRIMARY KEY,club_id text NOT NULL,play_id uuid NULL,fixture_label text NULL,frame_id text NULL,outcome text NOT NULL DEFAULT 'USED',notes text NULL,before_stats jsonb NULL,after_stats jsonb NULL,created_by text NULL,created_at timestamptz NOT NULL DEFAULT now())`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS football_whiteboard_usage_club_idx ON football_whiteboard_usage(club_id,created_at DESC)`)
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS football_whiteboard_game_models(
   id uuid PRIMARY KEY,club_id text NOT NULL,title text NOT NULL,phase text NOT NULL,description text NULL,play_data jsonb NOT NULL,created_by text NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now())`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS football_whiteboard_game_models_club_idx ON football_whiteboard_game_models(club_id,phase,title)`)
 })().catch(error=>{ready=null;throw error})
 return ready
}
function canManage(res:any){const m=res.locals.clubMembership as {role?:Parameters<typeof roleCan>[0]}|undefined;return Boolean(m?.role&&roleCan(m.role,'team_selection'))}
const clean=(v:unknown,n:number)=>String(v??'').trim().slice(0,n)
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v))
type Magnet={id:string;name:string;number:number|null;team:'US'|'THEM';x:number;y:number}
type Frame={id:string;name:string;state:{magnets:Magnet[];strokes:unknown[]}}
function metrics(frame:Frame){
 const ours=(frame?.state?.magnets||[]).filter(m=>m.team==='US')
 const width=ours.length?Math.max(...ours.map(m=>Number(m.x)||0))-Math.min(...ours.map(m=>Number(m.x)||0)):0
 const depth=ours.length?Math.max(...ours.map(m=>Number(m.y)||0))-Math.min(...ours.map(m=>Number(m.y)||0)):0
 const corridor=ours.filter(m=>m.x>=35&&m.x<=65).length
 const behindBall=ours.filter(m=>m.y>=62).length
 const forward=ours.filter(m=>m.y<=35).length
 let congestion=0
 for(let i=0;i<ours.length;i++)for(let j=i+1;j<ours.length;j++)if(Math.hypot(ours[i].x-ours[j].x,ours[i].y-ours[j].y)<8)congestion++
 const zones=[{name:'Left outlet',x:18,y:50},{name:'Right outlet',x:82,y:50},{name:'Defensive cover',x:50,y:78},{name:'Forward depth',x:50,y:18}]
 const uncovered=zones.filter(z=>!ours.some(m=>Math.hypot(m.x-z.x,m.y-z.y)<18)).map(z=>z.name)
 return{width:Math.round(width),depth:Math.round(depth),corridor,behindBall,forward,congestion,uncovered,score:clamp(Math.round(width*.35+depth*.25+Math.min(behindBall,6)*5-Math.min(congestion,8)*3),0,100)}
}
function suggestedFrame(frame:Frame,focus:string){
 const next:Frame=JSON.parse(JSON.stringify(frame))
 next.id=randomUUID();next.name=`AI ${focus||'balanced'} setup`
 const ours=next.state.magnets.filter(m=>m.team==='US')
 ours.forEach((m,index)=>{
  const lane=index%3
  if(focus==='DEFENCE'){m.y=clamp(m.y+7,8,92);m.x=clamp(m.x+(lane-1)*3,8,92)}
  else if(focus==='ATTACK'){m.y=clamp(m.y-7,8,92);m.x=clamp(m.x+(lane-1)*5,8,92)}
  else if(focus==='WIDTH'){m.x=lane===0?clamp(m.x-10,8,92):lane===2?clamp(m.x+10,8,92):m.x}
  else {m.x=clamp(m.x+(lane-1)*5,8,92);if(index%5===0)m.y=clamp(m.y+5,8,92)}
 })
 return next
}

whiteboardIntelligenceRouter.post('/clubs/:clubId/generate',async(req,res)=>{
 try{await ensureTables();if(!canManage(res))return res.status(403).json({error:'Your role cannot generate tactical setups'});const frame=req.body?.frame as Frame;if(!frame?.state?.magnets)return res.status(400).json({error:'A valid whiteboard frame is required'});const focus=clean(req.body?.focus,20).toUpperCase()||'BALANCED';const generated=suggestedFrame(frame,focus);return res.json({data:{frame:generated,before:metrics(frame),after:metrics(generated),reason:`Created a ${focus.toLowerCase()} structure with improved spacing while keeping every player attached to their existing identity.`}})}catch(error){return res.status(500).json({error:'Unable to generate tactical setup',detail:String(error)})}
})
whiteboardIntelligenceRouter.post('/clubs/:clubId/compare',async(req,res)=>{
 try{await ensureTables();if(!canManage(res))return res.status(403).json({error:'Your role cannot compare tactics'});const a=req.body?.a as Frame,b=req.body?.b as Frame;if(!a||!b)return res.status(400).json({error:'Two frames are required'});const ma=metrics(a),mb=metrics(b);const winner=ma.score===mb.score?'EVEN':ma.score>mb.score?'A':'B';return res.json({data:{a:ma,b:mb,winner,summary:winner==='EVEN'?'Both structures rate evenly; choose based on match context.':`Frame ${winner} has the stronger overall spacing and coverage score.`}})}catch(error){return res.status(500).json({error:'Unable to compare tactics',detail:String(error)})}
})
whiteboardIntelligenceRouter.post('/clubs/:clubId/usage',async(req,res)=>{
 try{await ensureTables();if(!canManage(res))return res.status(403).json({error:'Your role cannot record tactic outcomes'});const id=randomUUID();await prisma.$executeRawUnsafe(`INSERT INTO football_whiteboard_usage(id,club_id,play_id,fixture_label,frame_id,outcome,notes,before_stats,after_stats,created_by) VALUES($1::uuid,$2,NULLIF($3,'')::uuid,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10)`,id,req.params.clubId,clean(req.body?.playId,80),clean(req.body?.fixtureLabel,180)||null,clean(req.body?.frameId,100)||null,clean(req.body?.outcome,30)||'USED',clean(req.body?.notes,1000)||null,JSON.stringify(req.body?.beforeStats||{}),JSON.stringify(req.body?.afterStats||{}),res.locals.clubMembership?.userId??null);return res.status(201).json({data:{id}})}catch(error){return res.status(500).json({error:'Unable to record tactic outcome',detail:String(error)})}
})
whiteboardIntelligenceRouter.get('/clubs/:clubId/review',async(req,res)=>{
 try{await ensureTables();if(!canManage(res))return res.status(403).json({error:'Your role cannot view tactical review'});const rows=await prisma.$queryRawUnsafe<any[]>(`SELECT id::text,fixture_label AS "fixtureLabel",frame_id AS "frameId",outcome,notes,before_stats AS "beforeStats",after_stats AS "afterStats",created_at AS "createdAt" FROM football_whiteboard_usage WHERE club_id=$1 ORDER BY created_at DESC LIMIT 100`,req.params.clubId);const improved=rows.filter(r=>r.outcome==='WORKED'||r.outcome==='IMPROVED').length;const declined=rows.filter(r=>r.outcome==='FAILED'||r.outcome==='DECLINED').length;return res.json({data:{entries:rows,summary:{total:rows.length,improved,declined,neutral:rows.length-improved-declined}}})}catch(error){return res.status(500).json({error:'Unable to load tactical review',detail:String(error)})}
})
whiteboardIntelligenceRouter.get('/clubs/:clubId/game-models',async(req,res)=>{
 try{await ensureTables();if(!canManage(res))return res.status(403).json({error:'Your role cannot access game models'});const rows=await prisma.$queryRawUnsafe<any[]>(`SELECT id::text,title,phase,description,play_data AS play,"updated_at" AS "updatedAt" FROM football_whiteboard_game_models WHERE club_id=$1 ORDER BY phase,title`,req.params.clubId);return res.json({data:rows})}catch(error){return res.status(500).json({error:'Unable to load game models',detail:String(error)})}
})
whiteboardIntelligenceRouter.post('/clubs/:clubId/game-models',async(req,res)=>{
 try{await ensureTables();if(!canManage(res))return res.status(403).json({error:'Your role cannot save game models'});const title=clean(req.body?.title,120);if(!title)return res.status(400).json({error:'Enter a game-model title'});const id=randomUUID();await prisma.$executeRawUnsafe(`INSERT INTO football_whiteboard_game_models(id,club_id,title,phase,description,play_data,created_by) VALUES($1::uuid,$2,$3,$4,$5,$6::jsonb,$7)`,id,req.params.clubId,title,clean(req.body?.phase,50)||'GENERAL',clean(req.body?.description,1000)||null,JSON.stringify(req.body?.play||{}),res.locals.clubMembership?.userId??null);return res.status(201).json({data:{id,title}})}catch(error){return res.status(500).json({error:'Unable to save game model',detail:String(error)})}
})
