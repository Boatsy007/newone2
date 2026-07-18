/**
 * Admin OCR image-import API.
 * Preview-first: nothing is written until the operator approves the review.
 */

import { Router } from 'express'
import { prisma } from '../db/client.js'
import { requireAdminKey } from '../api/middleware/auth.js'
import { rankAndStore } from '../jobs/playhq-scrape.js'
import { parseLadderImage } from '../ocr/parse-ladder-image.js'
import { fuzzyMatchClub, similarity } from '../ocr/fuzzy-match.js'
import { validateClubIdentity } from '../validation/club-identity.js'
import { getISOWeekLabel } from '../utils/week-label.js'
import { logger } from '../utils/logger.js'

const router = Router()
router.use(requireAdminKey)

const DEFAULT_SEASON = '2026'
const DEFAULT_GRADE = 'A Grade'
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

async function audit(action: string, entityId: string | null, after: unknown) {
  try {
    const user = await prisma.adminUser.upsert({
      where: { email: 'admin@cnca.local' },
      update: {},
      create: { email: 'admin@cnca.local', name: 'Admin', role: 'SUPERADMIN' },
    })
    await prisma.auditLog.create({
      data: { userId: user.id, action, entityType: 'League', entityId, after: after ? JSON.stringify(after) : null },
    })
  } catch (error) {
    logger.warn('OCR audit failed', { detail: String(error) })
  }
}

router.post('/parse', async (req, res) => {
  try {
    const { image, leagueId } = req.body as { image?: string; leagueId?: string }
    if (!image) return res.status(400).json({ error: 'image (base64 or data URL) required' })

    const ocr = await parseLadderImage(image)
    if (ocr.rows.length === 0) {
      const record = await prisma.ocrImport.create({
        data: {
          image,
          detectedLeague: ocr.league,
          detectedGrade: ocr.grade,
          rowCount: 0,
          notes: ocr.notes ?? 'no ladder rows detected',
        },
      }).catch(() => null)
      return res.json({
        data: {
          importId: record?.id ?? null,
          detectedLeague: ocr.league,
          detectedGrade: ocr.grade,
          matchedLeagueId: null,
          rows: [],
          uncertain: 0,
          confidence: null,
          notes: ocr.notes ?? 'no ladder rows detected',
        },
      })
    }

    const leagues = await prisma.league.findMany({
      where: { isActive: true },
      include: { association: { select: { name: true } } },
    })
    let matchedLeagueId = leagueId ?? null
    if (!matchedLeagueId && ocr.league) {
      let best: { id: string; score: number } | null = null
      for (const league of leagues) {
        const score = similarity(ocr.league, league.association?.name ?? league.name)
        if (!best || score > best.score) best = { id: league.id, score }
      }
      if (best && best.score >= 0.6) matchedLeagueId = best.id
    }

    const candidates = matchedLeagueId
      ? await prisma.club.findMany({
          where: { leagueSeasons: { some: { leagueId: matchedLeagueId } } },
          select: { id: true, name: true },
        })
      : await prisma.club.findMany({ select: { id: true, name: true }, take: 2000 })

    const rows = ocr.rows.map(row => ({ ...row, match: fuzzyMatchClub(row.team, candidates) }))
    const uncertain = rows.filter(row => !row.match.confident).length
    const confidence = rows.length
      ? rows.reduce((sum, row) => sum + (row.match.score ?? 0), 0) / rows.length
      : null

    const record = await prisma.ocrImport.create({
      data: {
        image,
        leagueId: matchedLeagueId,
        detectedLeague: ocr.league,
        detectedGrade: ocr.grade,
        rowCount: rows.length,
        uncertainCount: uncertain,
        confidence,
        rows: JSON.stringify(rows),
        notes: ocr.notes,
      },
    }).catch(error => {
      logger.warn('OCR history save failed', { detail: String(error) })
      return null
    })

    res.json({
      data: {
        importId: record?.id ?? null,
        detectedLeague: ocr.league,
        detectedGrade: ocr.grade,
        matchedLeagueId,
        rows,
        uncertain,
        confidence,
        notes: ocr.notes,
      },
    })
  } catch (error) {
    logger.warn('OCR parse failed', { detail: String(error) })
    res.status(500).json({ error: error instanceof Error ? error.message : 'OCR failed' })
  }
})

type CommitEntry = {
  team: string
  clubId?: string | null
  position?: number
  played?: number
  wins?: number
  losses?: number
  draws?: number
  goalsFor?: number
  goalsAgainst?: number
  percentage?: number
  points?: number
}

type NewLeagueInput = {
  name: string
  stateCode: string
  season?: string
  grade?: string
}

router.post('/commit', async (req, res) => {
  try {
    const { leagueId, newLeague, season, grade, entries, importId } = req.body as {
      leagueId?: string
      newLeague?: NewLeagueInput
      season?: string
      grade?: string
      importId?: string
      entries?: CommitEntry[]
    }

    if (!leagueId && !newLeague) return res.status(400).json({ error: 'leagueId or newLeague required' })
    if (leagueId && newLeague) return res.status(400).json({ error: 'choose either an existing league or create a new league' })
    if (!Array.isArray(entries) || entries.length === 0) return res.status(400).json({ error: 'entries required' })
    if (entries.some(entry => !entry.team?.trim())) return res.status(400).json({ error: 'every entry requires a team name' })
    if (newLeague && (!newLeague.name?.trim() || !newLeague.stateCode?.trim())) {
      return res.status(400).json({ error: 'new league name and stateCode required' })
    }

    const result = await prisma.$transaction(async transaction => {
      let league = leagueId
        ? await transaction.league.findUnique({ where: { id: leagueId } })
        : null
      let createdLeague = false

      const resolvedSeason = String(season || newLeague?.season || league?.currentSeason || DEFAULT_SEASON).trim()
      const resolvedGrade = String(grade || newLeague?.grade || league?.gradeOverride || DEFAULT_GRADE).trim()

      if (!league && newLeague) {
        const state = await transaction.state.findUnique({ where: { code: newLeague.stateCode.trim().toUpperCase() } })
        if (!state) throw new Error(`Unknown state ${newLeague.stateCode}`)

        const existing = await transaction.league.findFirst({
          where: {
            stateId: state.id,
            name: { equals: newLeague.name.trim(), mode: 'insensitive' },
            archivedAt: null,
          },
        })

        if (existing) {
          league = existing
        } else {
          league = await transaction.league.create({
            data: {
              name: newLeague.name.trim(),
              shortName: newLeague.name.trim(),
              stateId: state.id,
              isActive: true,
              enabled: true,
              currentSeason: resolvedSeason,
              gradeOverride: resolvedGrade,
              sport: 'FOOTBALL',
              primarySource: 'MANUAL_IMAGE',
              primaryDataSource: 'OCR_UPLOAD',
              importType: 'IMAGE',
              status: 'ACTIVE',
              syncStatus: 'SUCCESS',
              dataConfidence: 0.8,
              manualOverride: true,
              manualEntryEnabled: true,
              scrapeEnabled: false,
              apiEnabled: false,
              lastManualUpdateAt: new Date(),
              lastSyncAt: new Date(),
              lastSuccessfulSyncAt: new Date(),
              approvalStatus: 'APPROVED',
            },
          })
          createdLeague = true
        }
      }

      if (!league) throw new Error('league not found')

      const clubIds: string[] = []
      let createdClubs = 0
      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index]
        let clubId = entry.clubId ?? null

        if (clubId) {
          const existingClub = await transaction.club.findUnique({ where: { id: clubId }, select: { id: true } })
          if (!existingClub) throw new Error(`Selected club no longer exists for ${entry.team}`)
        } else {
          const verdict = validateClubIdentity(entry.team)
          const name = verdict.canonical ?? entry.team.trim()
          const slug = `${slugify(name)}-${league.id.slice(0, 8)}`
          const existingClub = await transaction.club.findFirst({
            where: {
              stateId: league.stateId,
              name: { equals: name, mode: 'insensitive' },
              archivedAt: null,
            },
            select: { id: true },
          })
          const club = existingClub ?? await transaction.club.create({
            data: {
              name,
              slug,
              shortName: entry.team.trim(),
              stateId: league.stateId,
              region: league.name,
              townName: verdict.isAnonymous ? null : name,
              isActive: true,
              source: 'MANUAL_IMAGE',
              approvalStatus: verdict.verdict === 'VALID' ? 'APPROVED' : 'PENDING',
              sport: 'FOOTBALL',
            },
            select: { id: true },
          })
          clubId = club.id
          if (!existingClub) createdClubs += 1

          if (verdict.verdict !== 'VALID') {
            await transaction.reviewItem.create({
              data: {
                entityType: 'Club',
                entityId: clubId,
                kind: verdict.isAnonymous ? 'ANONYMOUS_CLUB' : 'UNCERTAIN_CLUB',
                reason: `${verdict.reason} — "${entry.team}" from image import into ${league.name}`,
                confidence: verdict.confidence,
                payload: JSON.stringify({ raw: entry.team, leagueId: league.id }),
              },
            })
          }
        }

        const goalsFor = entry.goalsFor ?? 0
        const goalsAgainst = entry.goalsAgainst ?? 0
        const percentage = entry.percentage ?? (goalsAgainst > 0 ? (goalsFor / goalsAgainst) * 100 : 100)

        await transaction.clubLeagueSeason.upsert({
          where: {
            clubId_leagueId_season_grade: {
              clubId,
              leagueId: league.id,
              season: resolvedSeason,
              grade: resolvedGrade,
            },
          },
          create: {
            clubId,
            leagueId: league.id,
            season: resolvedSeason,
            grade: resolvedGrade,
            isActive: true,
            position: entry.position ?? index + 1,
            played: entry.played ?? 0,
            wins: entry.wins ?? 0,
            losses: entry.losses ?? 0,
            draws: entry.draws ?? 0,
            goalsFor,
            goalsAgainst,
            percentage,
            points: entry.points ?? 0,
          },
          update: {
            isActive: true,
            position: entry.position ?? index + 1,
            played: entry.played ?? 0,
            wins: entry.wins ?? 0,
            losses: entry.losses ?? 0,
            draws: entry.draws ?? 0,
            goalsFor,
            goalsAgainst,
            percentage,
            points: entry.points ?? 0,
          },
        })
        clubIds.push(clubId)
      }

      await transaction.clubLeagueSeason.updateMany({
        where: {
          leagueId: league.id,
          season: resolvedSeason,
          grade: resolvedGrade,
          clubId: { notIn: clubIds },
        },
        data: { isActive: false },
      })

      await transaction.league.update({
        where: { id: league.id },
        data: {
          primarySource: 'MANUAL_IMAGE',
          primaryDataSource: 'OCR_UPLOAD',
          importType: 'IMAGE',
          manualOverride: true,
          manualEntryEnabled: true,
          currentSeason: resolvedSeason,
          gradeOverride: resolvedGrade,
          lastManualUpdateAt: new Date(),
          lastSyncAt: new Date(),
          lastSuccessfulSyncAt: new Date(),
          syncStatus: 'SUCCESS',
          status: 'ACTIVE',
          isActive: true,
          enabled: true,
        },
      })

      const source = await transaction.leagueSource.findFirst({
        where: { leagueId: league.id, season: resolvedSeason, sourceType: 'MANUAL_IMAGE' },
      })
      if (source) {
        await transaction.leagueSource.update({
          where: { id: source.id },
          data: { isActive: true, lastStatus: 'SUCCESS', lastScrapedAt: new Date(), notes: `Imported ${resolvedGrade} ladder image` },
        })
      } else {
        await transaction.leagueSource.create({
          data: {
            leagueId: league.id,
            sourceType: 'MANUAL_IMAGE',
            season: resolvedSeason,
            isActive: true,
            notes: `Imported ${resolvedGrade} ladder image`,
            lastStatus: 'SUCCESS',
            lastScrapedAt: new Date(),
          },
        })
      }

      if (importId) {
        await transaction.ocrImport.update({
          where: { id: importId },
          data: {
            status: 'COMMITTED',
            leagueId: league.id,
            leagueName: league.name,
            committedRows: JSON.stringify(entries),
            committedAt: new Date(),
          },
        })
      }

      return {
        leagueId: league.id,
        leagueName: league.name,
        teams: clubIds.length,
        createdLeague,
        createdClubs,
        season: resolvedSeason,
        grade: resolvedGrade,
      }
    })

    await audit('IMAGE_IMPORT', result.leagueId, {
      teams: result.teams,
      createdLeague: result.createdLeague,
      createdClubs: result.createdClubs,
      season: result.season,
      grade: result.grade,
      importId: importId ?? null,
    })

    const locked = (await prisma.setting.findUnique({ where: { key: 'rankingsLocked' } }).catch(() => null))?.value === 'true'
    const rankingNote = locked
      ? 'rankings locked — not re-ranked'
      : `re-ranked ${(await rankAndStore(getISOWeekLabel())).clubsRanked} clubs`

    res.json({
      data: {
        leagueId: result.leagueId,
        league: result.leagueName,
        teams: result.teams,
        createdLeague: result.createdLeague,
        createdClubs: result.createdClubs,
        season: result.season,
        grade: result.grade,
      },
      note: `${result.createdLeague ? 'league created; ' : ''}${result.createdClubs} new club${result.createdClubs === 1 ? '' : 's'}; ${rankingNote}`,
    })
  } catch (error) {
    logger.warn('OCR commit failed', { detail: String(error) })
    res.status(500).json({ error: error instanceof Error ? error.message : 'commit failed' })
  }
})

router.get('/history', async (req, res) => {
  const take = Math.min(Number(req.query.limit) || 50, 200)
  const imports = await prisma.ocrImport.findMany({
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      leagueId: true,
      leagueName: true,
      detectedLeague: true,
      detectedGrade: true,
      rowCount: true,
      uncertainCount: true,
      confidence: true,
      status: true,
      notes: true,
      createdBy: true,
      createdAt: true,
      committedAt: true,
    },
  })
  res.json({ data: imports })
})

router.get('/history/:id', async (req, res) => {
  const record = await prisma.ocrImport.findUnique({ where: { id: req.params.id } })
  if (!record) return res.status(404).json({ error: 'not found' })
  res.json({ data: record })
})

router.post('/history/:id/discard', async (req, res) => {
  const record = await prisma.ocrImport.findUnique({ where: { id: req.params.id } })
  if (!record) return res.status(404).json({ error: 'not found' })
  if (record.status === 'COMMITTED') return res.status(400).json({ error: 'already committed — cannot discard' })
  const updated = await prisma.ocrImport.update({ where: { id: record.id }, data: { status: 'DISCARDED' } })
  res.json({ data: { id: updated.id, status: updated.status } })
})

export { router as adminOcrRouter }
