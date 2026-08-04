import { Router, type Request, type Response, type NextFunction } from 'express'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, requireActiveClubMembership, roleCan } from '../../auth/club-auth.js'

const router = Router()
let ready: Promise<void> | null = null

function ensureTable() {
  if (!ready) ready = prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS football_live_streams (
      club_id text PRIMARY KEY,
      provider text NOT NULL DEFAULT 'cloudflare',
      provider_input_id text NULL,
      publish_url text NULL,
      playback_url text NULL,
      status text NOT NULL DEFAULT 'OFFLINE',
      started_at timestamptz NULL,
      ended_at timestamptz NULL,
      last_heartbeat_at timestamptz NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `).then(() => undefined).catch(error => { ready = null; throw error })
  return ready
}

type StreamRow = {
  clubId: string
  provider: string
  providerInputId: string | null
  publishUrl: string | null
  playbackUrl: string | null
  status: string
  startedAt: string | null
  endedAt: string | null
  lastHeartbeatAt: string | null
  updatedAt: string
}

const select = `SELECT club_id AS "clubId",provider,provider_input_id AS "providerInputId",publish_url AS "publishUrl",playback_url AS "playbackUrl",status,started_at AS "startedAt",ended_at AS "endedAt",last_heartbeat_at AS "lastHeartbeatAt",updated_at AS "updatedAt" FROM football_live_streams`

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
    provider: row?.provider ?? 'cloudflare',
    startedAt: row?.startedAt ?? null,
    endedAt: row?.endedAt ?? null,
  }
}

function providerConfig() {
  const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID ?? '').trim()
  const token = String(process.env.CLOUDFLARE_STREAM_API_TOKEN ?? '').trim()
  return accountId && token ? { accountId, token } : null
}

async function createCloudflareInput(clubId: string) {
  const config = providerConfig()
  if (!config) throw new Error('PlayFooty Live provider is not configured')
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/stream/live_inputs`, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      meta: { name: `PlayFooty club ${clubId}`, clubId },
      recording: { mode: 'automatic', requireSignedURLs: false, allowedOrigins: ['playfooty.com.au', '*.playfooty.com.au'] },
      preferLowLatency: true,
    }),
  })
  const payload = await response.json() as any
  if (!response.ok || !payload?.success || !payload?.result?.uid) {
    throw new Error(payload?.errors?.[0]?.message || 'Unable to create the club live input')
  }
  const result = payload.result
  const publishUrl = String(result.webRTC?.url ?? '')
  const playbackUrl = String(result.webRTCPlayback?.url ?? '')
  if (!publishUrl || !playbackUrl) throw new Error('The live provider did not return browser streaming URLs')
  return { inputId: String(result.uid), publishUrl, playbackUrl }
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
    if (!row?.providerInputId || !row.publishUrl || !row.playbackUrl) {
      const input = await createCloudflareInput(req.params.clubId)
      await prisma.$executeRawUnsafe(`
        INSERT INTO football_live_streams(club_id,provider,provider_input_id,publish_url,playback_url,status,updated_at)
        VALUES($1,'cloudflare',$2,$3,$4,'OFFLINE',now())
        ON CONFLICT(club_id) DO UPDATE SET provider='cloudflare',provider_input_id=EXCLUDED.provider_input_id,publish_url=EXCLUDED.publish_url,playback_url=EXCLUDED.playback_url,updated_at=now()
      `, req.params.clubId, input.inputId, input.publishUrl, input.playbackUrl)
      row = await rowForClub(req.params.clubId)
    }
    await prisma.$executeRawUnsafe(`UPDATE football_live_streams SET status='LIVE',started_at=COALESCE(started_at,now()),ended_at=NULL,last_heartbeat_at=now(),updated_at=now() WHERE club_id=$1`, req.params.clubId)
    res.set('Cache-Control', 'no-store')
    res.json({ data: { publishUrl: row?.publishUrl, playbackUrl: row?.playbackUrl, streamStatus: 'LIVE' } })
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
    // Live score remains available even if provider status cannot be loaded.
  }
  next()
}

export { router as liveStreamRouter }
