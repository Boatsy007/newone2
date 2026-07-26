import { Router } from 'express'
import { createHash, randomUUID } from 'node:crypto'
import { prisma } from '../../db/client.js'
import { ensureHighlightTables } from '../../highlights/store.js'

const router = Router()
router.use(async (_req, _res, next) => { try { await ensureHighlightTables(); next() } catch (error) { next(error) } })
const CATEGORIES = ['goal', 'mark', 'play', 'performance'] as const
const isCategory = (value: unknown): value is typeof CATEGORIES[number] => typeof value === 'string' && CATEGORIES.includes(value as typeof CATEGORIES[number])
const clean = (value: unknown, max = 240) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const currentWeekKey = () => {
  const now = new Date(); const first = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)); const day = Math.floor((now.getTime() - first.getTime()) / 86400000)
  return `${now.getUTCFullYear()}-W${String(Math.ceil((day + first.getUTCDay() + 1) / 7)).padStart(2, '0')}`
}

type PublicHighlightRow = {
  id: string; category: string; playerId: string | null; playerName: string; clubId: string | null; clubName: string
  leagueId: string | null; leagueName: string | null; matchId: string | null; matchDate: Date | null; roundLabel: string | null
  videoUrl: string; thumbnailUrl: string | null; description: string | null; headline: string | null; articleBody: string | null; mediaSource: string; weekKey: string
  votingOpensAt: Date | null; votingClosesAt: Date | null; winner: boolean; featured: boolean; featuredOrder: number | null
  publishedAt: Date | null; votes: bigint | number
}

const selectSql = `
  SELECT s.id, s.category, s.player_id AS "playerId", s.player_name AS "playerName", s.club_id AS "clubId", s.club_name AS "clubName",
    s.league_id AS "leagueId", s.league_name AS "leagueName", s.match_id AS "matchId", s.match_date AS "matchDate", s.round_label AS "roundLabel",
    s.video_url AS "videoUrl", s.thumbnail_url AS "thumbnailUrl", s.description, s.headline, s.article_body AS "articleBody", s.media_source AS "mediaSource", s.week_key AS "weekKey",
    s.voting_opens_at AS "votingOpensAt", s.voting_closes_at AS "votingClosesAt", s.winner,
    s.featured, s.featured_order AS "featuredOrder", s.published_at AS "publishedAt", COUNT(v.id)::int AS votes
  FROM highlight_submissions s LEFT JOIN highlight_votes v ON v.submission_id = s.id
`

function serialize(row: PublicHighlightRow) {
  const now = Date.now(); const opens = row.votingOpensAt?.getTime() ?? null; const closes = row.votingClosesAt?.getTime() ?? null
  return {
    ...row,
    votes: Number(row.votes),
    title: row.headline || `${row.playerName} · ${row.category} of the week`,
    votingOpen: opens != null && closes != null && now >= opens && now < closes,
    votingState: opens == null || closes == null ? 'UNSCHEDULED' : now < opens ? 'UPCOMING' : now >= closes ? 'CLOSED' : 'OPEN',
    detailUrl: `/highlights/${row.id}`,
    playerUrl: row.playerId ? `/player/${row.playerId}` : null,
    clubUrl: row.clubId ? `/team/${row.clubId}` : null,
    leagueUrl: row.leagueId ? `/league/${row.leagueId}` : null,
    matchUrl: row.matchId ? `/match/result/${row.matchId}?source=football` : null,
    shareCardType: row.winner ? 'HIGHLIGHT_WINNER' : 'HIGHLIGHT_NOMINEE',
  }
}

router.get('/featured', async (_req, res) => {
  try {
    const rows = await prisma.$queryRawUnsafe<PublicHighlightRow[]>(`${selectSql} WHERE s.status = 'APPROVED' AND s.featured = TRUE GROUP BY s.id ORDER BY s.featured_order ASC NULLS LAST, s.published_at DESC, s.created_at DESC LIMIT 3`)
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120')
    res.json({ data: rows.map(serialize) })
  } catch { res.json({ data: [] }) }
})

router.get('/', async (req, res) => {
  const week = clean(req.query.week, 20) || currentWeekKey()
  const category = clean(req.query.category, 20)
  const clubId = clean(req.query.clubId, 100)
  const leagueId = clean(req.query.leagueId, 100)
  const playerId = clean(req.query.playerId, 100)
  const values: unknown[] = [week]
  const filters = [`s.status = 'APPROVED'`, `s.week_key = $1`]
  if (isCategory(category)) { values.push(category); filters.push(`s.category = $${values.length}`) }
  if (clubId) { values.push(clubId); filters.push(`s.club_id = $${values.length}`) }
  if (leagueId) { values.push(leagueId); filters.push(`s.league_id = $${values.length}`) }
  if (playerId) { values.push(playerId); filters.push(`s.player_id = $${values.length}`) }
  const rows = await prisma.$queryRawUnsafe<PublicHighlightRow[]>(`${selectSql} WHERE ${filters.join(' AND ')} GROUP BY s.id ORDER BY s.category ASC, votes DESC, s.created_at ASC`, ...values)
  res.json({ data: rows.map(serialize), meta: { weekKey: week, categories: CATEGORIES } })
})

router.get('/archive', async (_req, res) => {
  const rows = await prisma.$queryRawUnsafe<PublicHighlightRow[]>(`${selectSql} WHERE s.status = 'APPROVED' AND s.winner = TRUE GROUP BY s.id ORDER BY s.week_key DESC, s.category ASC LIMIT 200`)
  res.json({ data: rows.map(serialize) })
})

router.get('/:id', async (req, res) => {
  const rows = await prisma.$queryRawUnsafe<PublicHighlightRow[]>(`${selectSql} WHERE s.id = $1 AND s.status = 'APPROVED' GROUP BY s.id LIMIT 1`, req.params.id)
  if (!rows[0]) return res.status(404).json({ error: 'Highlight not found' })
  res.json({ data: serialize(rows[0]) })
})

router.post('/submissions', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>
  if (!isCategory(body.category)) return res.status(400).json({ error: 'Invalid category' })
  const playerName = clean(body.playerName, 120); const clubName = clean(body.clubName, 160); const videoUrl = clean(body.videoUrl, 1000)
  const submitterName = clean(body.submitterName, 120); const submitterEmail = clean(body.submitterEmail, 200).toLowerCase()
  if (!playerName || !clubName || !videoUrl || !submitterName || !submitterEmail) return res.status(400).json({ error: 'Player, club, video, submitter name and email are required' })
  if (!/^https?:\/\//i.test(videoUrl)) return res.status(400).json({ error: 'Video URL must start with http:// or https://' })
  if (!/^\S+@\S+\.\S+$/.test(submitterEmail)) return res.status(400).json({ error: 'Enter a valid email address' })
  const weekKey = clean(body.weekKey, 20) || currentWeekKey()
  const normalizedVideo = videoUrl.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase()
  const dedupeKey = createHash('sha256').update(`${weekKey}|${body.category}|${normalizedVideo}`).digest('hex')
  const duplicate = await prisma.$queryRawUnsafe<Array<{ id: string; status: string }>>(`SELECT id, status FROM highlight_submissions WHERE dedupe_key = $1 LIMIT 1`, dedupeKey)
  if (duplicate[0]) return res.status(409).json({ error: 'This video has already been submitted for this category and week', data: duplicate[0] })
  const id = randomUUID()
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO highlight_submissions (
        id, category, player_id, player_name, club_id, club_name, league_id, league_name, match_id, match_date, round_label,
        video_url, thumbnail_url, description, headline, article_body, media_source, submitter_name, submitter_email, status, week_key, dedupe_key
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'URL',$17,$18,'PENDING',$19,$20)
    `, id, body.category, clean(body.playerId, 100) || null, playerName, clean(body.clubId, 100) || null, clubName,
      clean(body.leagueId, 100) || null, clean(body.leagueName, 180) || null, clean(body.matchId, 120) || null,
      body.matchDate ? new Date(String(body.matchDate)) : null, clean(body.roundLabel, 80) || null, videoUrl,
      clean(body.thumbnailUrl, 1000) || null, clean(body.description, 1000) || null, clean(body.headline, 220) || null,
      clean(body.articleBody, 30000) || null, submitterName, submitterEmail, weekKey, dedupeKey)
  } catch (error) {
    if (String(error).includes('highlight_submissions_dedupe_idx') || String(error).includes('Unique constraint')) return res.status(409).json({ error: 'This highlight has already been submitted' })
    throw error
  }
  res.status(201).json({ data: { id, status: 'PENDING', weekKey }, message: 'Highlight submitted for moderation' })
})

router.post('/:id/vote', async (req, res) => {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; category: string; weekKey: string; votingOpensAt: Date | null; votingClosesAt: Date | null }>>(`
    SELECT id, category, week_key AS "weekKey", voting_opens_at AS "votingOpensAt", voting_closes_at AS "votingClosesAt"
    FROM highlight_submissions WHERE id = $1 AND status = 'APPROVED' LIMIT 1
  `, req.params.id)
  const submission = rows[0]
  if (!submission) return res.status(404).json({ error: 'Nominee not found' })
  const now = Date.now()
  if (!submission.votingOpensAt || !submission.votingClosesAt || now < submission.votingOpensAt.getTime() || now >= submission.votingClosesAt.getTime()) return res.status(409).json({ error: 'Voting is not open for this nominee' })
  const email = clean((req.body as Record<string, unknown> | undefined)?.email, 200).toLowerCase()
  const rawIdentity = email || `${req.ip}|${req.get('user-agent') ?? ''}`
  const voterKey = createHash('sha256').update(`${submission.weekKey}|${submission.category}|${rawIdentity}`).digest('hex')
  try {
    await prisma.$executeRawUnsafe(`INSERT INTO highlight_votes (id, submission_id, category, week_key, voter_key) VALUES ($1,$2,$3,$4,$5)`, randomUUID(), submission.id, submission.category, submission.weekKey, voterKey)
  } catch (error) {
    if (String(error).includes('highlight_votes_one_per_category_week') || String(error).includes('Unique constraint')) return res.status(409).json({ error: 'You have already voted in this category this week' })
    throw error
  }
  const count = await prisma.$queryRawUnsafe<Array<{ votes: bigint | number }>>(`SELECT COUNT(*)::int AS votes FROM highlight_votes WHERE submission_id = $1`, submission.id)
  res.status(201).json({ data: { submissionId: submission.id, votes: Number(count[0]?.votes ?? 0) } })
})

export { router as highlightsRouter }
