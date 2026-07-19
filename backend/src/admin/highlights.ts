import { Router } from 'express'
import { prisma } from '../db/client.js'
import { requireAdminKey } from '../api/middleware/auth.js'
import { ensureHighlightTables } from '../highlights/store.js'

const router = Router()
router.use(requireAdminKey)
router.use(async (_req, _res, next) => { try { await ensureHighlightTables(); next() } catch (error) { next(error) } })

const clean = (value: unknown, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED']

type AdminHighlightRow = {
  id: string; category: string; playerId: string | null; playerName: string; clubId: string | null; clubName: string
  leagueId: string | null; leagueName: string | null; matchId: string | null; matchDate: Date | null; roundLabel: string | null
  videoUrl: string; thumbnailUrl: string | null; description: string | null; submitterName: string
  submitterEmail: string; status: string; weekKey: string; votingOpensAt: Date | null
  votingClosesAt: Date | null; publishedAt: Date | null; winner: boolean; moderationNote: string | null
  createdAt: Date; votes: bigint | number
}

const selectSql = `
  SELECT s.id, s.category, s.player_id AS "playerId", s.player_name AS "playerName", s.club_id AS "clubId", s.club_name AS "clubName",
    s.league_id AS "leagueId", s.league_name AS "leagueName", s.match_id AS "matchId", s.match_date AS "matchDate", s.round_label AS "roundLabel",
    s.video_url AS "videoUrl", s.thumbnail_url AS "thumbnailUrl", s.description,
    s.submitter_name AS "submitterName", s.submitter_email AS "submitterEmail", s.status,
    s.week_key AS "weekKey", s.voting_opens_at AS "votingOpensAt", s.voting_closes_at AS "votingClosesAt",
    s.published_at AS "publishedAt", s.winner, s.moderation_note AS "moderationNote", s.created_at AS "createdAt",
    COUNT(v.id)::int AS votes
  FROM highlight_submissions s LEFT JOIN highlight_votes v ON v.submission_id = s.id
`

router.get('/', async (req, res) => {
  const status = clean(req.query.status, 20).toUpperCase()
  const where = status && STATUSES.includes(status) ? `WHERE s.status = $1` : ''
  const rows = status && STATUSES.includes(status)
    ? await prisma.$queryRawUnsafe<AdminHighlightRow[]>(`${selectSql} ${where} GROUP BY s.id ORDER BY s.created_at DESC`, status)
    : await prisma.$queryRawUnsafe<AdminHighlightRow[]>(`${selectSql} GROUP BY s.id ORDER BY s.created_at DESC`)
  res.json({ data: rows.map(row => ({ ...row, votes: Number(row.votes) })) })
})

router.patch('/:id', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>
  const status = clean(body.status, 20).toUpperCase()
  if (status && !STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' })
  const opens = body.votingOpensAt ? new Date(String(body.votingOpensAt)) : null
  const closes = body.votingClosesAt ? new Date(String(body.votingClosesAt)) : null
  if ((opens && Number.isNaN(opens.getTime())) || (closes && Number.isNaN(closes.getTime()))) return res.status(400).json({ error: 'Invalid voting date' })
  if (opens && closes && closes <= opens) return res.status(400).json({ error: 'Voting close must be after voting open' })

  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; clubId: string | null; leagueId: string | null; playerId: string | null; matchId: string | null; votingOpensAt: Date | null; votingClosesAt: Date | null }>>(`
    SELECT id, club_id AS "clubId", league_id AS "leagueId", player_id AS "playerId", match_id AS "matchId",
      voting_opens_at AS "votingOpensAt", voting_closes_at AS "votingClosesAt"
    FROM highlight_submissions WHERE id = $1 LIMIT 1
  `, req.params.id)
  const current = rows[0]
  if (!current) return res.status(404).json({ error: 'Submission not found' })

  if (status === 'APPROVED') {
    const nextOpen = 'votingOpensAt' in body ? opens : current.votingOpensAt
    const nextClose = 'votingClosesAt' in body ? closes : current.votingClosesAt
    if (!nextOpen || !nextClose) return res.status(400).json({ error: 'Set both voting open and close times before approval' })
    if (nextClose <= nextOpen) return res.status(400).json({ error: 'Voting close must be after voting open' })
    if (!current.clubId || !current.leagueId) return res.status(400).json({ error: 'Link the canonical club and league before approval' })
  }

  await prisma.$executeRawUnsafe(`
    UPDATE highlight_submissions SET
      status = COALESCE($2, status),
      moderation_note = CASE WHEN $3::text IS NULL THEN moderation_note ELSE $3 END,
      week_key = COALESCE($4, week_key),
      player_id = CASE WHEN $5::boolean THEN $6 ELSE player_id END,
      club_id = CASE WHEN $7::boolean THEN $8 ELSE club_id END,
      league_id = CASE WHEN $9::boolean THEN $10 ELSE league_id END,
      match_id = CASE WHEN $11::boolean THEN $12 ELSE match_id END,
      voting_opens_at = CASE WHEN $13::boolean THEN $14 ELSE voting_opens_at END,
      voting_closes_at = CASE WHEN $15::boolean THEN $16 ELSE voting_closes_at END,
      published_at = CASE WHEN COALESCE($2, status) = 'APPROVED' AND published_at IS NULL THEN NOW() ELSE published_at END,
      winner = CASE WHEN COALESCE($2, status) <> 'APPROVED' THEN FALSE ELSE winner END,
      updated_at = NOW()
    WHERE id = $1
  `, req.params.id, status || null, 'moderationNote' in body ? clean(body.moderationNote, 1000) || null : null,
    clean(body.weekKey, 20) || null,
    'playerId' in body, clean(body.playerId, 100) || null,
    'clubId' in body, clean(body.clubId, 100) || null,
    'leagueId' in body, clean(body.leagueId, 100) || null,
    'matchId' in body, clean(body.matchId, 120) || null,
    'votingOpensAt' in body, opens, 'votingClosesAt' in body, closes)

  const updated = await prisma.$queryRawUnsafe<AdminHighlightRow[]>(`${selectSql} WHERE s.id = $1 GROUP BY s.id`, req.params.id)
  res.json({ data: { ...updated[0], votes: Number(updated[0]?.votes ?? 0) } })
})

router.post('/:id/winner', async (req, res) => {
  const rows = await prisma.$queryRawUnsafe<Array<{
    id: string; weekKey: string; category: string; playerId: string | null; playerName: string; clubId: string | null; clubName: string;
    leagueId: string | null; leagueName: string | null; matchId: string | null; votingClosesAt: Date | null; votes: bigint | number
  }>>(`
    SELECT s.id, s.week_key AS "weekKey", s.category, s.player_id AS "playerId", s.player_name AS "playerName",
      s.club_id AS "clubId", s.club_name AS "clubName", s.league_id AS "leagueId", s.league_name AS "leagueName",
      s.match_id AS "matchId", s.voting_closes_at AS "votingClosesAt", COUNT(v.id)::int AS votes
    FROM highlight_submissions s LEFT JOIN highlight_votes v ON v.submission_id = s.id
    WHERE s.id = $1 AND s.status = 'APPROVED' GROUP BY s.id LIMIT 1
  `, req.params.id)
  const target = rows[0]
  if (!target) return res.status(404).json({ error: 'Approved nominee not found' })
  if (!target.votingClosesAt || Date.now() < target.votingClosesAt.getTime()) return res.status(409).json({ error: 'Voting must be closed before selecting a winner' })

  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe(`UPDATE highlight_submissions SET winner = FALSE, updated_at = NOW() WHERE week_key = $1 AND category = $2`, target.weekKey, target.category)
    await tx.$executeRawUnsafe(`UPDATE highlight_submissions SET winner = TRUE, updated_at = NOW() WHERE id = $1`, target.id)
    const title = `${target.playerName} wins ${target.category} of the week`
    const body = `${target.clubName}${target.leagueName ? ` · ${target.leagueName}` : ''} · ${Number(target.votes)} vote${Number(target.votes) === 1 ? '' : 's'}`
    const entities = [
      target.clubId ? { entityType: 'CLUB', entityId: target.clubId } : null,
      target.leagueId ? { entityType: 'LEAGUE', entityId: target.leagueId } : null,
      target.playerId ? { entityType: 'PLAYER', entityId: target.playerId } : null,
    ].filter((value): value is { entityType: string; entityId: string } => !!value)
    for (const entity of entities) {
      await tx.notification.upsert({
        where: { dedupeKey: `highlight-winner:${target.id}:${entity.entityType}:${entity.entityId}` },
        create: {
          recipientScope: 'PLATFORM', type: 'HIGHLIGHT_WINNER', category: 'FEED', severity: 'SUCCESS', status: 'DELIVERED',
          title, body, entityType: entity.entityType, entityId: entity.entityId,
          data: JSON.stringify({ href: `/highlights/${target.id}`, highlightId: target.id, category: target.category, weekKey: target.weekKey, shareCardType: 'HIGHLIGHT_WINNER', matchId: target.matchId }),
          dedupeKey: `highlight-winner:${target.id}:${entity.entityType}:${entity.entityId}`,
        },
        update: { title, body, status: 'DELIVERED', data: JSON.stringify({ href: `/highlights/${target.id}`, highlightId: target.id, category: target.category, weekKey: target.weekKey, shareCardType: 'HIGHLIGHT_WINNER', matchId: target.matchId }) },
      })
    }
  })
  res.json({ data: { id: target.id, winner: true } })
})

router.delete('/:id', async (req, res) => {
  await prisma.$executeRawUnsafe(`DELETE FROM highlight_submissions WHERE id = $1 AND status <> 'APPROVED'`, req.params.id)
  res.json({ data: { id: req.params.id, deleted: true } })
})

export { router as adminHighlightsRouter }
