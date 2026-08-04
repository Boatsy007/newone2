import { createHash, createHmac, randomUUID } from 'node:crypto'
import { Router, type Response } from 'express'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, requireActiveClubMembership, roleCan } from '../../auth/club-auth.js'

const router = Router()
let ready: Promise<void> | null = null

function ensureTable() {
  if (!ready) ready = prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS football_live_realtime_stages (
      club_id text PRIMARY KEY,
      stage_arn text NOT NULL,
      status text NOT NULL DEFAULT 'OFFLINE',
      started_at timestamptz NULL,
      ended_at timestamptz NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `).then(() => undefined).catch(error => { ready = null; throw error })
  return ready
}

type StageRow = { clubId:string;stageArn:string;status:string;startedAt:string|null;endedAt:string|null }
const selectStage = `SELECT club_id AS "clubId",stage_arn AS "stageArn",status,started_at AS "startedAt",ended_at AS "endedAt" FROM football_live_realtime_stages`

const IVS_REGIONS = new Set(['us-east-1','us-west-2','ap-south-1','ap-northeast-1','ap-northeast-2','eu-central-1','eu-west-1'])
function awsConfig() {
  const accessKeyId = String(process.env.AWS_ACCESS_KEY_ID ?? '').trim()
  const secretAccessKey = String(process.env.AWS_SECRET_ACCESS_KEY ?? '').trim()
  const sessionToken = String(process.env.AWS_SESSION_TOKEN ?? '').trim()
  const requestedRegion = String(process.env.AWS_IVS_REALTIME_REGION ?? process.env.AWS_IVS_REGION ?? process.env.AWS_REGION ?? '').trim()
  const region = IVS_REGIONS.has(requestedRegion) ? requestedRegion : 'ap-northeast-1'
  return accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey, sessionToken, region } : null
}
const hex = (value:string) => createHash('sha256').update(value).digest('hex')
const hmac = (key:Buffer|string,value:string) => createHmac('sha256',key).update(value).digest()
async function realtimeRequest<T>(operation:string, body:Record<string,unknown>):Promise<T> {
  const config = awsConfig()
  if (!config) throw new Error('Amazon IVS Real-Time is not configured')
  const service='ivs', host=`ivsrealtime.${config.region}.amazonaws.com`, path=`/${operation}`, payload=JSON.stringify(body)
  const now=new Date(), amzDate=now.toISOString().replace(/[:-]|\.\d{3}/g,''), dateStamp=amzDate.slice(0,8)
  const headers:Record<string,string>={'content-type':'application/json',host,'x-amz-date':amzDate}
  if(config.sessionToken)headers['x-amz-security-token']=config.sessionToken
  const names=Object.keys(headers).sort(), canonicalHeaders=names.map(name=>`${name}:${headers[name].trim()}\n`).join(''), signedHeaders=names.join(';')
  const canonicalRequest=['POST',path,'',canonicalHeaders,signedHeaders,hex(payload)].join('\n')
  const scope=`${dateStamp}/${config.region}/${service}/aws4_request`, stringToSign=['AWS4-HMAC-SHA256',amzDate,scope,hex(canonicalRequest)].join('\n')
  const signingKey=hmac(hmac(hmac(hmac(`AWS4${config.secretAccessKey}`,dateStamp),config.region),service),'aws4_request')
  headers.authorization=`AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${createHmac('sha256',signingKey).update(stringToSign).digest('hex')}`
  const response=await fetch(`https://${host}${path}`,{method:'POST',headers,body:payload})
  const result=await response.json().catch(()=>({})) as any
  if(!response.ok)throw new Error(result?.message||result?.Message||`Amazon IVS Real-Time ${operation} failed`)
  return result as T
}

async function stageForClub(clubId:string) {
  await ensureTable()
  const rows=await prisma.$queryRawUnsafe<StageRow[]>(`${selectStage} WHERE club_id=$1 LIMIT 1`,clubId)
  return rows[0]??null
}
async function ensureStage(clubId:string) {
  let row=await stageForClub(clubId)
  if(row?.stageArn)return row
  const name=`playfooty-${clubId}`.replace(/[^a-zA-Z0-9-_]/g,'-').slice(0,128)
  const result=await realtimeRequest<any>('CreateStage',{name,tags:{clubId,platform:'PlayFooty'}})
  const stageArn=String(result.stage?.arn??'')
  if(!stageArn)throw new Error('Amazon IVS Real-Time did not return a stage ARN')
  await prisma.$executeRawUnsafe(`INSERT INTO football_live_realtime_stages(club_id,stage_arn,status,updated_at) VALUES($1,$2,'OFFLINE',now()) ON CONFLICT(club_id) DO UPDATE SET stage_arn=EXCLUDED.stage_arn,updated_at=now()`,clubId,stageArn)
  row=await stageForClub(clubId)
  if(!row)throw new Error('Unable to save real-time stage')
  return row
}
async function participantToken(stageArn:string,userId:string,capabilities:Array<'PUBLISH'|'SUBSCRIBE'>,attributes:Record<string,string>) {
  const result=await realtimeRequest<any>('CreateParticipantToken',{stageArn,userId:userId.slice(0,128),duration:720,capabilities,attributes})
  const token=String(result.participantToken?.token??'')
  if(!token)throw new Error('Amazon IVS Real-Time did not return a participant token')
  return token
}
function canManage(res:Response){const membership=res.locals.clubMembership as {role:Parameters<typeof roleCan>[0]}|undefined;return Boolean(membership&&roleCan(membership.role,'team_selection'))}

router.get('/clubs/:clubId/viewer-token',async(req,res)=>{
  try{
    const stage=await stageForClub(req.params.clubId)
    if(!stage||stage.status!=='LIVE')return res.status(404).json({error:'No real-time broadcast is live'})
    const token=await participantToken(stage.stageArn,`viewer-${randomUUID()}`,['SUBSCRIBE'],{role:'viewer',clubId:req.params.clubId})
    res.set('Cache-Control','no-store');res.json({data:{token,stageArn:stage.stageArn,mode:'realtime'}})
  }catch(error){res.status(500).json({error:error instanceof Error?error.message:'Unable to join real-time broadcast'})}
})

router.post('/clubs/:clubId/publisher-token',authenticateClubUser,requireActiveClubMembership,async(req,res)=>{
  try{
    if(!canManage(res))return res.status(403).json({error:'Your club role cannot start a real-time broadcast'})
    const stage=await ensureStage(req.params.clubId)
    const cameraId=String(req.body?.cameraId||'main').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,64)||'main'
    const label=String(req.body?.label||'Main Camera').slice(0,60)
    const userId=`camera-${cameraId}-${String(req.clubUser?.id||randomUUID()).slice(0,60)}`
    const token=await participantToken(stage.stageArn,userId,['PUBLISH'],{role:'camera',cameraId,label,clubId:req.params.clubId})
    await prisma.$executeRawUnsafe(`UPDATE football_live_realtime_stages SET status='LIVE',started_at=COALESCE(started_at,now()),ended_at=NULL,updated_at=now() WHERE club_id=$1`,req.params.clubId)
    res.set('Cache-Control','no-store');res.json({data:{token,stageArn:stage.stageArn,cameraId,label,mode:'realtime'}})
  }catch(error){const message=error instanceof Error?error.message:'Unable to start real-time broadcast';res.status(message.includes('not configured')?503:500).json({error:message})}
})

router.post('/clubs/:clubId/stop',authenticateClubUser,requireActiveClubMembership,async(req,res)=>{
  try{
    if(!canManage(res))return res.status(403).json({error:'Your club role cannot end a real-time broadcast'})
    await ensureTable();await prisma.$executeRawUnsafe(`UPDATE football_live_realtime_stages SET status='ENDED',ended_at=now(),updated_at=now() WHERE club_id=$1`,req.params.clubId)
    res.json({message:'Real-time broadcast ended'})
  }catch(error){res.status(500).json({error:'Unable to end real-time broadcast',detail:String(error)})}
})

router.get('/clubs/:clubId/status',async(req,res)=>{
  try{const stage=await stageForClub(req.params.clubId);res.set('Cache-Control','no-store');res.json({data:{mode:'realtime',isStreaming:stage?.status==='LIVE',streamStatus:stage?.status??'OFFLINE',startedAt:stage?.startedAt??null,endedAt:stage?.endedAt??null}})}
  catch(error){res.status(500).json({error:'Unable to load real-time status',detail:String(error)})}
})

export {router as liveRealtimeRouter}
