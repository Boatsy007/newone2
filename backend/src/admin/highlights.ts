import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { prisma } from '../db/client.js'
import { requireAdminKey } from '../api/middleware/auth.js'
import { ensureHighlightTables } from '../highlights/store.js'

const router = Router()
router.use(requireAdminKey)
router.use(async (_req, _res, next) => { try { await ensureHighlightTables(); next() } catch (error) { next(error) } })

const clean = (value: unknown, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED']
const CATEGORIES = ['goal', 'mark', 'play', 'performance']
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'])
const HIGHLIGHT_BUCKET = process.env.SUPABASE_HIGHLIGHT_BUCKET || 'playfooty-highlights'
const currentWeekKey = () => {
  const now = new Date(); const first = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)); const day = Math.floor((now.getTime() - first.getTime()) / 86400000)
  return `${now.getUTCFullYear()}-W${String(Math.ceil((day + first.getUTCDay() + 1) / 7)).padStart(2, '0')}`
}

type AdminHighlightRow = {
  id: string; category: string; playerId: string | null; playerName: string; clubId: string | null; clubName: string
  leagueId: string | null; leagueName: string | null; matchId: string | null; matchDate: Date | null; roundLabel: string | null
  videoUrl: string; thumbnailUrl: string | null; description: string | null; headline: string | null; articleBody: string | null; mediaSource: string
  submitterName: string; submitterEmail: string; status: string; weekKey: string; votingOpensAt: Date | null
  votingClosesAt: Date | null; publishedAt: Date | null; winner: boolean; featured: boolean; featuredOrder: number | null
  moderationNote: string | null; createdAt: Date; votes: bigint | number
}

const selectSql = `
  SELECT s.id, s.category, s.player_id AS "playerId", s.player_name AS "playerName", s.club_id AS "clubId", s.club_name AS "clubName",
    s.league_id AS "leagueId", s.league_name AS "leagueName", s.match_id AS "matchId", s.match_date AS "matchDate", s.round_label AS "roundLabel",
    s.video_url AS "videoUrl", s.thumbnail_url AS "thumbnailUrl", s.description, s.headline, s.article_body AS "articleBody", s.media_source AS "mediaSource",
    s.submitter_name AS "submitterName", s.submitter_email AS "submitterEmail", s.status,
    s.week_key AS "weekKey", s.voting_opens_at AS "votingOpensAt", s.voting_closes_at AS "votingClosesAt",
    s.published_at AS "publishedAt", s.winner, s.featured, s.featured_order AS "featuredOrder",
    s.moderation_note AS "moderationNote", s.created_at AS "createdAt", COUNT(v.id)::int AS votes
  FROM highlight_submissions s LEFT JOIN highlight_votes v ON v.submission_id = s.id
`

function storageConfig() {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return null
  return { supabaseUrl, serviceKey }
}

async function ensureHighlightBucket(supabaseUrl: string, serviceKey: string) {
  const headers = { authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'content-type': 'application/json' }
  const existing = await fetch(`${supabaseUrl}/storage/v1/bucket/${encodeURIComponent(HIGHLIGHT_BUCKET)}`, { headers })
  if (existing.ok) return
  if (existing.status !== 404) {
    const payload = await existing.json().catch(() => ({})) as { message?: string; error?: string }
    throw new Error(payload.message || payload.error || 'Could not check highlight video storage.')
  }
  const created = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: 'POST', headers,
    body: JSON.stringify({ id: HIGHLIGHT_BUCKET, name: HIGHLIGHT_BUCKET, public: true, allowed_mime_types: Array.from(VIDEO_TYPES) }),
  })
  if (!created.ok && created.status !== 409) {
    const payload = await created.json().catch(() => ({})) as { message?: string; error?: string }
    throw new Error(payload.message || payload.error || 'Could not create highlight video storage.')
  }
}

router.get('/', async (req, res) => {
  const status = clean(req.query.status, 20).toUpperCase()
  const where = status && STATUSES.includes(status) ? `WHERE s.status = $1` : ''
  const rows = status && STATUSES.includes(status)
    ? await prisma.$queryRawUnsafe<AdminHighlightRow[]>(`${selectSql} ${where} GROUP BY s.id ORDER BY s.featured DESC, s.featured_order ASC NULLS LAST, s.created_at DESC`, status)
    : await prisma.$queryRawUnsafe<AdminHighlightRow[]>(`${selectSql} GROUP BY s.id ORDER BY s.featured DESC, s.featured_order ASC NULLS LAST, s.created_at DESC`)
  res.json({ data: rows.map(row => ({ ...row, votes: Number(row.votes) })) })
})

router.post('/upload-url', async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>
    const contentType = clean(body.contentType, 100).toLowerCase()
    if (!VIDEO_TYPES.has(contentType)) return res.status(400).json({ error: 'Use an MP4, MOV, M4V or WEBM video.' })
    const fileName = clean(body.fileName, 180).replace(/[^a-z0-9._-]+/gi, '-') || 'highlight.mp4'
    const config = storageConfig()
    if (!config) return res.status(503).json({ error: 'Highlight video storage is not configured.' })
    await ensureHighlightBucket(config.supabaseUrl, config.serviceKey)
    const path = `videos/${new Date().getUTCFullYear()}/${randomUUID()}-${fileName}`
    const response = await fetch(`${config.supabaseUrl}/storage/v1/object/upload/sign/${HIGHLIGHT_BUCKET}/${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.serviceKey}`, apikey: config.serviceKey, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    const payload = await response.json().catch(() => ({})) as { url?: string; token?: string; message?: string; error?: string }
    if (!response.ok || (!payload.url && !payload.token)) return res.status(502).json({ error: payload.message || payload.error || 'Could not prepare video upload.' })
    const uploadUrl = payload.url
      ? (payload.url.startsWith('http') ? payload.url : `${config.supabaseUrl}/storage/v1${payload.url}`)
      : `${config.supabaseUrl}/storage/v1/object/upload/sign/${HIGHLIGHT_BUCKET}/${path}?token=${encodeURIComponent(payload.token!)}`
    res.json({ data: { uploadUrl, publicUrl: `${config.supabaseUrl}/storage/v1/object/public/${HIGHLIGHT_BUCKET}/${path}`, path } })
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'Could not prepare video upload.' })
  }
})

router.post('/', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>
  const category = clean(body.category, 30).toLowerCase()
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'Choose a valid highlight category.' })
  const playerName = clean(body.playerName, 120)
  const clubName = clean(body.clubName, 160)
  const leagueId = clean(body.leagueId, 100)
  const clubId = clean(body.clubId, 100)
  const videoUrl = clean(body.videoUrl, 1200)
  if (!playerName || !clubName || !leagueId || !clubId || !videoUrl) return res.status(400).json({ error: 'Player, league, club and video are required.' })
  if (!/^https?:\/\//i.test(videoUrl)) return res.status(400).json({ error: 'Video URL must start with http:// or https://' })
  const id = randomUUID()
  const status = clean(body.status, 20).toUpperCase() === 'APPROVED' ? 'APPROVED' : 'PENDING'
  const featured = body.featured === true && status === 'APPROVED'
  const featuredOrder = featured ? Math.max(1, Math.min(3, Number(body.featuredOrder) || 1)) : null
  await prisma.$transaction(async tx => {
    if (featuredOrder) await tx.$executeRawUnsafe(`UPDATE highlight_submissions SET featured = FALSE, featured_order = NULL, updated_at = NOW() WHERE featured_order = $1`, featuredOrder)
    await tx.$executeRawUnsafe(`
      INSERT INTO highlight_submissions (
        id, category, player_id, player_name, club_id, club_name, league_id, league_name, match_id, match_date, round_label,
        video_url, thumbnail_url, description, headline, article_body, media_source, submitter_name, submitter_email,
        status, week_key, featured, featured_order, published_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'PlayFooty Admin','admin@playfooty.com.au',$18,$19,$20,$21,CASE WHEN $18='APPROVED' THEN NOW() ELSE NULL END)
    `, id, category, clean(body.playerId, 100) || null, playerName, clubId, clubName,
      leagueId, clean(body.leagueName, 180) || null, clean(body.matchId, 120) || null,
      body.matchDate ? new Date(String(body.matchDate)) : null, clean(body.roundLabel, 80) || null, videoUrl,
      clean(body.thumbnailUrl, 1200) || null, clean(body.description, 1200) || null, clean(body.headline, 220) || null,
      clean(body.articleBody, 30000) || null, clean(body.mediaSource, 20).toUpperCase() === 'UPLOAD' ? 'UPLOAD' : 'URL',
      status, clean(body.weekKey, 20) || currentWeekKey(), featured, featuredOrder)
  })
  const rows = await prisma.$queryRawUnsafe<AdminHighlightRow[]>(`${selectSql} WHERE s.id = $1 GROUP BY s.id`, id)
  res.status(201).json({ data: { ...rows[0], votes: 0 } })
})

router.patch('/:id', async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>
    const currentRows = await prisma.$queryRawUnsafe<Array<{ id: string; status: string }>>(`SELECT id, status FROM highlight_submissions WHERE id = $1 LIMIT 1`, req.params.id)
    const current = currentRows[0]
    if (!current) return res.status(404).json({ error: 'Submission not found' })

    const status = 'status' in body ? clean(body.status, 20).toUpperCase() : ''
    if (status && !STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' })

    const featured = typeof body.featured === 'boolean' ? body.featured : undefined
    const featuredOrder = body.featuredOrder == null || body.featuredOrder === '' ? null : Number(body.featuredOrder)
    if ('featuredOrder' in body && featuredOrder != null && (!Number.isInteger(featuredOrder) || featuredOrder < 1 || featuredOrder > 3)) return res.status(400).json({ error: 'Featured order must be 1, 2 or 3' })
    if (featured === true && (status || current.status) !== 'APPROVED') return res.status(400).json({ error: 'Only approved highlights can be featured' })

    const opens = 'votingOpensAt' in body && body.votingOpensAt ? new Date(String(body.votingOpensAt)) : null
    const closes = 'votingClosesAt' in body && body.votingClosesAt ? new Date(String(body.votingClosesAt)) : null
    if ((opens && Number.isNaN(opens.getTime())) || (closes && Number.isNaN(closes.getTime()))) return res.status(400).json({ error: 'Invalid voting date' })
    if (opens && closes && closes <= opens) return res.status(400).json({ error: 'Voting close must be after voting open' })

    const assignments: string[] = []
    const values: unknown[] = [req.params.id]
    const add = (column: string, value: unknown) => {
      values.push(value)
      assignments.push(`${column} = $${values.length}`)
    }

    if (status) add('status', status)
    if ('moderationNote' in body) add('moderation_note', clean(body.moderationNote, 1000) || null)
    if ('weekKey' in body) add('week_key', clean(body.weekKey, 20) || currentWeekKey())
    if ('playerId' in body) add('player_id', clean(body.playerId, 100) || null)
    if ('clubId' in body) add('club_id', clean(body.clubId, 100) || null)
    if ('leagueId' in body) add('league_id', clean(body.leagueId, 100) || null)
    if ('matchId' in body) add('match_id', clean(body.matchId, 120) || null)
    if ('votingOpensAt' in body) add('voting_opens_at', opens)
    if ('votingClosesAt' in body) add('voting_closes_at', closes)
    if ('videoUrl' in body) {
      const nextVideo = clean(body.videoUrl, 1200)
      if (!nextVideo || !/^https?:\/\//i.test(nextVideo)) return res.status(400).json({ error: 'Video URL must start with http:// or https://' })
      add('video_url', nextVideo)
    }
    if ('thumbnailUrl' in body) add('thumbnail_url', clean(body.thumbnailUrl, 1200) || null)
    if ('description' in body) add('description', clean(body.description, 1200) || null)
    if ('headline' in body) add('headline', clean(body.headline, 220) || null)
    if ('articleBody' in body) add('article_body', clean(body.articleBody, 30000) || null)
    if ('mediaSource' in body) add('media_source', clean(body.mediaSource, 20).toUpperCase() === 'UPLOAD' ? 'UPLOAD' : 'URL')
    if ('playerName' in body) add('player_name', clean(body.playerName, 120))
    if ('clubName' in body) add('club_name', clean(body.clubName, 160))
    if ('leagueName' in body) add('league_name', clean(body.leagueName, 180) || null)
    if (featured !== undefined) {
      add('featured', featured)
      add('featured_order', featured ? featuredOrder : null)
    }

    await prisma.$transaction(async tx => {
      if (featured === true && featuredOrder != null) {
        await tx.$executeRawUnsafe(`UPDATE highlight_submissions SET featured = FALSE, featured_order = NULL, updated_at = NOW() WHERE featured_order = $1 AND id <> $2`, featuredOrder, req.params.id)
      }
      if (assignments.length) {
        assignments.push('updated_at = NOW()')
        if (status === 'APPROVED') assignments.push('published_at = COALESCE(published_at, NOW())')
        if (status && status !== 'APPROVED') assignments.push('winner = FALSE')
        await tx.$executeRawUnsafe(`UPDATE highlight_submissions SET ${assignments.join(', ')} WHERE id = $1`, ...values)
      }
    })

    const updated = await prisma.$queryRawUnsafe<AdminHighlightRow[]>(`${selectSql} WHERE s.id = $1 GROUP BY s.id`, req.params.id)
    res.json({ data: { ...updated[0], votes: Number(updated[0]?.votes ?? 0) } })
  } catch (error) {
    console.error('Highlight update failed', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Could not save highlight changes.' })
  }
})

router.post('/:id/winner', async (req, res) => {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; weekKey: string; category: string; playerId: string | null; playerName: string; clubId: string | null; clubName: string; leagueId: string | null; leagueName: string | null; matchId: string | null; votingClosesAt: Date | null; votes: bigint | number }>>(`
    SELECT s.id, s.week_key AS "weekKey", s.category, s.player_id AS "playerId", s.player_name AS "playerName", s.club_id AS "clubId", s.club_name AS "clubName", s.league_id AS "leagueId", s.league_name AS "leagueName", s.match_id AS "matchId", s.voting_closes_at AS "votingClosesAt", COUNT(v.id)::int AS votes
    FROM highlight_submissions s LEFT JOIN highlight_votes v ON v.submission_id = s.id WHERE s.id = $1 AND s.status = 'APPROVED' GROUP BY s.id LIMIT 1
  `, req.params.id)
  const target = rows[0]
  if (!target) return res.status(404).json({ error: 'Approved nominee not found' })
  if (!target.votingClosesAt || Date.now() < target.votingClosesAt.getTime()) return res.status(409).json({ error: 'Voting must be closed before selecting a winner' })
  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe(`UPDATE highlight_submissions SET winner = FALSE, updated_at = NOW() WHERE week_key = $1 AND category = $2`, target.weekKey, target.category)
    await tx.$executeRawUnsafe(`UPDATE highlight_submissions SET winner = TRUE, updated_at = NOW() WHERE id = $1`, target.id)
    const title = `${target.playerName} wins ${target.category} of the week`
    const body = `${target.clubName}${target.leagueName ? ` · ${target.leagueName}` : ''} · ${Number(target.votes)} vote${Number(target.votes) === 1 ? '' : 's'}`
    const entities = [target.clubId ? { entityType: 'CLUB', entityId: target.clubId } : null, target.leagueId ? { entityType: 'LEAGUE', entityId: target.leagueId } : null, target.playerId ? { entityType: 'PLAYER', entityId: target.playerId } : null].filter((value): value is { entityType: string; entityId: string } => !!value)
    for (const entity of entities) await tx.notification.upsert({
      where: { dedupeKey: `highlight-winner:${target.id}:${entity.entityType}:${entity.entityId}` },
      create: { recipientScope: 'PLATFORM', type: 'HIGHLIGHT_WINNER', category: 'FEED', severity: 'SUCCESS', status: 'DELIVERED', title, body, entityType: entity.entityType, entityId: entity.entityId, data: JSON.stringify({ href: `/highlights/${target.id}`, highlightId: target.id, category: target.category, weekKey: target.weekKey, shareCardType: 'HIGHLIGHT_WINNER', matchId: target.matchId }), dedupeKey: `highlight-winner:${target.id}:${entity.entityType}:${entity.entityId}` },
      update: { title, body, status: 'DELIVERED' },
    })
  })
  res.json({ data: { id: target.id, winner: true } })
})

router.delete('/:id', async (req, res) => {
  await prisma.$executeRawUnsafe(`DELETE FROM highlight_submissions WHERE id = $1 AND status <> 'APPROVED'`, req.params.id)
  res.json({ data: { id: req.params.id, deleted: true } })
})

export { router as adminHighlightsRouter }
