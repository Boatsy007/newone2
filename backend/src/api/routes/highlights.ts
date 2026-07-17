import { Router } from 'express'
import { createHash, randomUUID } from 'node:crypto'
import { prisma } from '../../db/client.js'

const router = Router()
const CATEGORIES = ['goal', 'mark', 'play', 'performance'] as const
const isCategory = (value: unknown): value is typeof CATEGORIES[number] => typeof value === 'string' && CATEGORIES.includes(value as typeof CATEGORIES[number])
const clean = (value: unknown, max = 240) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const currentWeekKey = () => {
  const now = new Date()
  const first = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
  const day = Math.floor((now.getTime() - first.getTime()) / 86400000)
  return `${now.getUTCFullYear()}-W${String(Math.ceil((day + first.getUTCDay() + 1) / 7)).padStart(2, '0')}`
}

type PublicHighlightRow = {
  id: string; category: string; playerName: string; clubId: string | null; clubName: string
  leagueId: string | null; leagueName: string | null; matchDate: Date | null; roundLabel: string | null
  videoUrl: string; thumbnailUrl: string | null; description: string | null; weekKey: string
  votingOpensAt: Date | null; votingClosesAt: Date | null; winner: boolean; votes: bigint | number
}

function serialize(row: PublicHighlightRow) {
  const now = Date.now()
  const opens = row.votingOpensAt?.getTime() ?? null
  const closes = row.votingClosesAt?.getTime() ?? null
  return {
    ...row,
    votes: Number(row.votes),
    votingOpen: opens != null && closes != null && now >= opens && now < closes,
  }
}

router.get('/', async (req, res) => {
  const week = clean(req.query.week, 20) || currentWeekKey()
  const rows = await prisma.$queryRawUnsafe<PublicHighlightRow[]>(`
    SELECT s.id, s.category, s.player_name AS "playerName", s.club_id AS "clubId", s.club_name AS "clubName",
      s.league_id AS "leagueId", s.league_name AS "leagueName", s.match_date AS "matchDate", s.round_label AS "roundLabel",
      s.video_url AS "videoUrl", s.thumbnail_url AS "thumbnailUrl", s.description, s.week_key AS "weekKey",
      s.voting_opens_at AS "votingOpensAt", s.voting_closes_at AS "votingClosesAt", s.winner,
      COUNT(v.id)::int AS votes
    FROM highlight_submissions s
    LEFT JOIN highlight_votes v ON v.submission_id = s.id
    WHERE s.status = 'APPROVED' AND s.week_key = $1
    GROUP BY s.id
    ORDER BY s.category ASC, votes DESC, s.created_at ASC
  `, week)
  res.json({ data: rows.map(serialize), meta: { weekKey: week, categories: CATEGORIES } })
})

router.get('/archive', async (_req, res) => {
  const rows = await prisma.$queryRawUnsafe<PublicHighlightRow[]>(`
    SELECT s.id, s.category, s.player_name AS "playerName", s.club_id AS "clubId", s.club_name AS "clubName",
      s.league_id AS "leagueId", s.league_name AS "leagueName", s.match_date AS "matchDate", s.round_label AS "roundLabel",
      s.video_url AS "videoUrl", s.thumbnail_url AS "thumbnailUrl", s.description, s.week_key AS "weekKey",
      s.voting_opens_at AS "votingOpensAt", s.voting_closes_at AS "votingClosesAt", s.winner,
      COUNT(v.id)::int AS votes
    FROM highlight_submissions s
    LEFT JOIN highlight_votes v ON v.submission_id = s.id
    WHERE s.status = 'APPROVED' AND s.winner = TRUE
    GROUP BY s.id
    ORDER BY s.week_key DESC, s.category ASC
    LIMIT 100
  `)
  res.json({ data: rows.map(serialize) })
})

router.post('/submissions', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>
  if (!isCategory(body.category)) return res.status(400).json({ error: 'Invalid category' })
  const playerName = clean(body.playerName, 120)
  const clubName = clean(body.clubName, 160)
  const videoUrl = clean(body.videoUrl, 1000)
  const submitterName = clean(body.submitterName, 120)
  const submitterEmail = clean(body.submitterEmail, 200).toLowerCase()
  if (!playerName || !clubName || !videoUrl || !submitterName || !submitterEmail) return res.status(400).json({ error: 'Player, club, video, submitter name and email are required' })
  if (!/^https?:\/\//i.test(videoUrl)) return res.status(400).json({ error: 'Video URL must start with http:// or https://' })
  if (!/^\S+@\S+\.\S+$/.test(submitterEmail)) return res.status(400).json({ error: 'Enter a valid email address' })
  const id = randomUUID()
  const weekKey = clean(body.weekKey, 20) || currentWeekKey()
  await prisma.$executeRawUnsafe(`
    INSERT INTO highlight_submissions (
      id, category, player_name, club_id, club_name, league_id, league_name, match_date, round_label,
      video_url, thumbnail_url, description, submitter_name, submitter_email, status, week_key
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'PENDING',$15)
  `, id, body.category, playerName, clean(body.clubId, 80) || null, clubName, clean(body.leagueId, 80) || null,
    clean(body.leagueName, 180) || null, body.matchDate ? new Date(String(body.matchDate)) : null,
    clean(body.roundLabel, 80) || null, videoUrl, clean(body.thumbnailUrl, 1000) || null,
    clean(body.description, 1000) || null, submitterName, submitterEmail, weekKey)
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
