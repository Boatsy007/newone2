import { createHash, createHmac } from 'node:crypto'
import { Router, type Request, type Response, type NextFunction } from 'express'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, requireActiveClubMembership, roleCan } from '../../auth/club-auth.js'

const router = Router()
let ready: Promise<void> | null = null

function ensureTable() {
  if (!ready) ready = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS football_live_streams (
        club_id text PRIMARY KEY,
        provider text NOT NULL DEFAULT 'aws-ivs',
        provider_input_id text NULL,
        publish_url text NULL,
        playback_url text NULL,
        stream_key text NULL,
        status text NOT NULL DEFAULT 'OFFLINE',
        started_at timestamptz NULL,
        ended_at timestamptz NULL,
        last_heartbeat_at timestamptz NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    await prisma.$executeRawUnsafe(`ALTER TABLE football_live_streams ADD COLUMN IF NOT EXISTS stream_key text NULL`)
  })().catch(error => { ready = null; throw error })
  return ready
}

type StreamRow = {
  clubId: string
  provider: string
  providerInputId: string | null
  publishUrl: string | null
  playbackUrl: string | null
  streamKey: string | null
  status: string
  startedAt: string | null
  endedAt: string | null
  lastHeartbeatAt: string | null
  updatedAt: string
}

const select = `SELECT club_id AS "clubId",provider,provider_input_id AS "providerInputId",publish_url AS "publishUrl",playback_url AS "playbackUrl",stream_key AS "streamKey",status,started_at AS "startedAt",ended_at AS "endedAt",last_heartbeat_at AS "lastHeartbeatAt",updated_at AS "updatedAt" FROM football_live_streams`

async function rowForClub(clubId: string) {
  await ensureTable()
  const rows = await prisma.$queryRawUnsafe<StreamRow[]>(`${select} WHERE club_id=$1 LIMIT 1`, clubId)
  return rows[0] ?? null
}

function isFresh(row: StreamRow | null) {
  if (!row || row.status !== 'LIVE' || !row.lastHeartbeatAt) return false
  return Date.now() - new Date(row.lastHeartbeatAt).getTime() < 20_000
}

function publicState(row: StreamRow | null) {
  const live = isFresh(row)
  return {
    streamStatus: live ? 'LIVE' : row?.status === 'ENDED' ? 'ENDED' : 'OFFLINE',
    isStreaming: live,
    playbackUrl: live ? row?.playbackUrl ?? null : null,
    provider: row?.provider ?? 'aws-ivs',
    startedAt: row?.startedAt ?? null,
    endedAt: row?.endedAt ?? null,
  }
}

const IVS_REGIONS = new Set([
  'us-east-1',
  'us-west-2',
  'ap-south-1',
  'ap-northeast-1',
  'ap-northeast-2',
  'eu-central-1',
  'eu-west-1',
])

function awsConfig() {
  const accessKeyId = String(process.env.AWS_ACCESS_KEY_ID ?? '').trim()
  const secretAccessKey = String(process.env.AWS_SECRET_ACCESS_KEY ?? '').trim()
  const sessionToken = String(process.env.AWS_SESSION_TOKEN ?? '').trim()
  const requestedRegion = String(process.env.AWS_IVS_REGION ?? process.env.AWS_REGION ?? '').trim()
  const region = IVS_REGIONS.has(requestedRegion) ? requestedRegion : 'ap-northeast-1'
  return accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey, sessionToken, region } : null
}

const hex = (value: string) => createHash('sha256').update(value).digest('hex')
const hmac = (key: Buffer | string, value: string) => createHmac('sha256', key).update(value).digest()

async function ivsRequest<T>(operation: string, body: Record<string, unknown>): Promise<T> {
  const config = awsConfig()
  if (!config) throw new Error('Amazon IVS is not configured')
  const service = 'ivs'
  const host = `ivs.${config.region}.amazonaws.com`
  const path = `/${operation}`
  const payload = JSON.stringify(body)
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    host,
    'x-amz-date': amzDate,
  }
  if (config.sessionToken) headers['x-amz-security-token'] = config.sessionToken
  const signedHeaderNames = Object.keys(headers).sort()
  const canonicalHeaders = signedHeaderNames.map(name => `${name}:${headers[name].trim()}\n`).join('')
  const signedHeaders = signedHeaderNames.join(';')
  const canonicalRequest = ['POST', path, '', canonicalHeaders, signedHeaders, hex(payload)].join('\n')
  const scope = `${dateStamp}/${config.region}/${service}/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, hex(canonicalRequest)].join('\n')
  const dateKey = hmac(`AWS4${config.secretAccessKey}`, dateStamp)
  const regionKey = hmac(dateKey, config.region)
  const serviceKey = hmac(regionKey, service)
  const signingKey = hmac(serviceKey, 'aws4_request')
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex')
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  const response = await fetch(`https://${host}${path}`, { method: 'POST', headers, body: payload })
  const result = await response.json().catch(() => ({})) as any
  if (!response.ok) throw new Error(result?.message || result?.Message || `Amazon IVS ${operation} failed`)
  return result as T
}

type CreateChannelResult = {
  channel?: { arn?: string; ingestEndpoint?: string; playbackUrl?: string }
  streamKey?: { value?: string }
}

async function createIvsChannel(clubId: string) {
  const safeName = `playfooty-${clubId}`.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 128)
  const result = await ivsRequest<CreateChannelResult>('CreateChannel', {
    name: safeName,
    latencyMode: 'LOW',
    type: 'BASIC',
    authorized: false,
    insecureIngest: false,
    tags: { clubId, platform: 'PlayFooty' },
  })
  const channelArn = String(result.channel?.arn ?? '')
  const ingestEndpoint = String(result.channel?.ingestEndpoint ?? '')
  const playbackUrl = String(result.channel?.playbackUrl ?? '')
  const streamKey = String(result.streamKey?.value ?? '')
  if (!channelArn || !ingestEndpoint || !playbackUrl || !streamKey) throw new Error('Amazon IVS did not return a complete channel configuration')
  return { channelArn, ingestEndpoint, playbackUrl, streamKey }
}

function canManage(res: Response) {
  const membership = res.locals.clubMembership as { role: Parameters<typeof roleCan>[0] } | undefined
  return Boolean(membership && roleCan(membership.role, 'team_selection'))
}

router.get('/clubs/:clubId', async (req, res) => {
  try {
    const row = await rowForClub(req.params.clubId)
    res.set('Cache-Control', 'no-store')
    res.json({ data: publicState(row) })
  } catch (error) {
    res.status(500).json({ error: 'Unable to load live stream status', detail: String(error) })
  }
})

router.post('/clubs/:clubId/start', authenticateClubUser, requireActiveClubMembership, async (req, res) => {
  try {
    if (!canManage(res)) return res.status(403).json({ error: 'Your club role cannot start a broadcast' })
    let row = await rowForClub(req.params.clubId)
    const needsIvsChannel = row?.provider !== 'aws-ivs' || !row.providerInputId || !row.publishUrl || !row.playbackUrl || !row.streamKey
    if (needsIvsChannel) {
      const channel = await createIvsChannel(req.params.clubId)
      await prisma.$executeRawUnsafe(`
        INSERT INTO football_live_streams(club_id,provider,provider_input_id,publish_url,playback_url,stream_key,status,updated_at)
        VALUES($1,'aws-ivs',$2,$3,$4,$5,'OFFLINE',now())
        ON CONFLICT(club_id) DO UPDATE SET provider='aws-ivs',provider_input_id=EXCLUDED.provider_input_id,publish_url=EXCLUDED.publish_url,playback_url=EXCLUDED.playback_url,stream_key=EXCLUDED.stream_key,status='OFFLINE',updated_at=now()
      `, req.params.clubId, channel.channelArn, channel.ingestEndpoint, channel.playbackUrl, channel.streamKey)
      row = await rowForClub(req.params.clubId)
    }
    await prisma.$executeRawUnsafe(`UPDATE football_live_streams SET status='LIVE',started_at=now(),ended_at=NULL,last_heartbeat_at=now(),updated_at=now() WHERE club_id=$1`, req.params.clubId)
    res.set('Cache-Control', 'no-store')
    res.json({ data: { provider: 'aws-ivs', ingestEndpoint: row?.publishUrl, streamKey: row?.streamKey, playbackUrl: row?.playbackUrl, streamStatus: 'LIVE' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start broadcast'
    res.status(message.includes('not configured') ? 503 : 500).json({ error: message })
  }
})

router.post('/clubs/:clubId/heartbeat', authenticateClubUser, requireActiveClubMembership, async (req, res) => {
  try {
    if (!canManage(res)) return res.status(403).json({ error: 'Your club role cannot manage a broadcast' })
    await ensureTable()
    await prisma.$executeRawUnsafe(`UPDATE football_live_streams SET status='LIVE',last_heartbeat_at=now(),updated_at=now() WHERE club_id=$1`, req.params.clubId)
    res.json({ message: 'Broadcast heartbeat received' })
  } catch (error) {
    res.status(500).json({ error: 'Unable to update broadcast heartbeat', detail: String(error) })
  }
})

router.post('/clubs/:clubId/stop', authenticateClubUser, requireActiveClubMembership, async (req, res) => {
  try {
    if (!canManage(res)) return res.status(403).json({ error: 'Your club role cannot end a broadcast' })
    await ensureTable()
    await prisma.$executeRawUnsafe(`UPDATE football_live_streams SET status='ENDED',ended_at=now(),last_heartbeat_at=NULL,updated_at=now() WHERE club_id=$1`, req.params.clubId)
    res.json({ message: 'Broadcast ended' })
  } catch (error) {
    res.status(500).json({ error: 'Unable to end broadcast', detail: String(error) })
  }
})

export async function augmentLiveMatchStream(req: Request, res: Response, next: NextFunction) {
  try {
    const state = publicState(await rowForClub(req.params.clubId))
    const original = res.json.bind(res)
    res.json = ((body: any) => {
      if (body && typeof body === 'object') {
        if (body.data && typeof body.data === 'object') body.data = { ...body.data, ...state }
        else body = { ...body, ...state }
      }
      return original(body)
    }) as typeof res.json
  } catch {
    // Live scores remain available even if streaming status cannot be loaded.
  }
  next()
}

export { router as liveStreamRouter }
