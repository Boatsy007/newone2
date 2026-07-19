import { prisma } from '../db/client.js'

export type GoalKickerSnapshot = {
  id: string
  playerId: string
  playerName: string
  clubId: string | null
  clubName: string
  leagueId: string
  leagueName: string
  season: string
  grade: string
  goals: number
  matches: number | null
  sourceUrl: string | null
  sourceType: string
  importedAt: Date
  createdAt: Date
  updatedAt: Date
}

export type GoalKickerAuditRow = {
  rowIndex: number
  decision: 'import' | 'skip'
  playerName: string
  clubName: string
  clubId: string | null
  goals: number
  matches: number | null
  confidence?: number | null
  warning?: string | null
  beforeRows?: GoalKickerSnapshot[]
  afterRow?: GoalKickerSnapshot | null
  outcome?: {
    savedGoals: number
    savedMatches: number | null
    weeklyGoals: number
    historyCreated: boolean
    feedEventsCreated: number
    duplicatesRemoved: number
    staleIncomingTotal: boolean
    unchanged: boolean
  }
  error?: string | null
  eventDedupeBase?: string | null
}

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-')

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try { return JSON.parse(value) as T } catch { return fallback }
}

export async function createGoalKickerImportBatch(input: {
  image: string
  fileName: string
  leagueId: string
  leagueName: string
  season: string
  grade: string
  reviewRows: unknown[]
  uncertainCount: number
}) {
  return prisma.ocrImport.create({
    data: {
      leagueId: input.leagueId,
      leagueName: input.leagueName,
      image: input.image,
      detectedLeague: input.leagueName,
      detectedGrade: input.grade,
      rowCount: input.reviewRows.length,
      uncertainCount: input.uncertainCount,
      rows: JSON.stringify(input.reviewRows),
      status: 'PREVIEWED',
      notes: JSON.stringify({ kind: 'GOAL_KICKER', fileName: input.fileName, season: input.season, grade: input.grade }),
      createdBy: 'admin',
    },
    select: { id: true, createdAt: true },
  })
}

export async function finaliseGoalKickerImportBatch(input: {
  batchId: string
  rows: GoalKickerAuditRow[]
  report: Record<string, unknown>
}) {
  await prisma.ocrImport.update({
    where: { id: input.batchId },
    data: {
      committedRows: JSON.stringify(input.rows),
      status: input.rows.some(row => row.error) ? 'COMMITTED' : 'COMMITTED',
      committedAt: new Date(),
      notes: JSON.stringify({ ...parseJson<Record<string, unknown>>((await prisma.ocrImport.findUnique({ where: { id: input.batchId }, select: { notes: true } }))?.notes, {}), report: input.report }),
    },
  })
}

export async function failGoalKickerImportBatch(batchId: string, error: string) {
  const existing = await prisma.ocrImport.findUnique({ where: { id: batchId }, select: { notes: true } })
  await prisma.ocrImport.update({
    where: { id: batchId },
    data: { status: 'DISCARDED', notes: JSON.stringify({ ...parseJson<Record<string, unknown>>(existing?.notes, {}), failedAt: new Date().toISOString(), error }) },
  })
}

export async function listGoalKickerImportBatches(limit = 50) {
  const rows = await prisma.ocrImport.findMany({
    where: { notes: { contains: '"kind":"GOAL_KICKER"' } },
    orderBy: { createdAt: 'desc' },
    take: Math.max(1, Math.min(limit, 100)),
    select: {
      id: true, leagueId: true, leagueName: true, detectedGrade: true, rowCount: true, uncertainCount: true,
      rows: true, committedRows: true, status: true, notes: true, createdAt: true, committedAt: true,
    },
  })
  return rows.map(row => {
    const notes = parseJson<Record<string, unknown>>(row.notes, {})
    const committed = parseJson<GoalKickerAuditRow[]>(row.committedRows, [])
    return {
      id: row.id,
      leagueId: row.leagueId,
      leagueName: row.leagueName,
      season: String(notes.season ?? ''),
      grade: String(notes.grade ?? row.detectedGrade ?? ''),
      fileName: String(notes.fileName ?? 'Goal-kicker screenshot'),
      status: row.status,
      rowCount: row.rowCount,
      uncertainCount: row.uncertainCount,
      imported: committed.filter(item => item.decision === 'import' && !item.error).length,
      skipped: committed.filter(item => item.decision === 'skip').length,
      warnings: committed.filter(item => item.warning || item.outcome?.staleIncomingTotal).length,
      duplicatesRemoved: committed.reduce((sum, item) => sum + (item.outcome?.duplicatesRemoved ?? 0), 0),
      createdAt: row.createdAt,
      committedAt: row.committedAt,
      undoneAt: typeof notes.undoneAt === 'string' ? notes.undoneAt : null,
      rows: committed,
    }
  })
}

function sameSnapshot(current: GoalKickerSnapshot, expected: GoalKickerSnapshot) {
  return current.id === expected.id && current.playerId === expected.playerId && current.goals === expected.goals &&
    current.matches === expected.matches && current.clubId === expected.clubId && current.leagueId === expected.leagueId &&
    current.season === expected.season && current.grade === expected.grade && current.updatedAt.getTime() === new Date(expected.updatedAt).getTime()
}

export async function undoGoalKickerImportBatch(batchId: string, confirmation: string) {
  const batch = await prisma.ocrImport.findUnique({
    where: { id: batchId },
    select: { id: true, status: true, notes: true, committedRows: true },
  })
  if (!batch) throw new Error('Goal-kicker import batch not found.')
  const notes = parseJson<Record<string, unknown>>(batch.notes, {})
  const fileName = String(notes.fileName ?? 'Goal-kicker screenshot')
  if (confirmation !== `UNDO ${fileName}`) throw new Error(`Type UNDO ${fileName} to confirm.`)
  if (batch.status !== 'COMMITTED') throw new Error('This import has already been undone or cannot be undone.')

  const rows = parseJson<GoalKickerAuditRow[]>(batch.committedRows, []).filter(row => row.decision === 'import' && !row.error && row.afterRow)
  if (!rows.length) throw new Error('This import has no committed player changes to undo.')

  const conflicts: string[] = []
  for (const row of rows) {
    const current = await prisma.footballGoalKicker.findUnique({
      where: { id: row.afterRow!.id },
      select: {
        id: true, playerId: true, playerName: true, clubId: true, clubName: true, leagueId: true, leagueName: true,
        season: true, grade: true, goals: true, matches: true, sourceUrl: true, sourceType: true,
        importedAt: true, createdAt: true, updatedAt: true,
      },
    }) as GoalKickerSnapshot | null
    if (!current || !sameSnapshot(current, row.afterRow!)) conflicts.push(row.playerName)
  }
  if (conflicts.length) throw new Error(`Undo blocked because newer changes exist for: ${conflicts.join(', ')}.`)

  const result = await prisma.$transaction(async tx => {
    let restoredRows = 0
    let deletedRows = 0
    let notificationsRemoved = 0

    for (const row of rows) {
      const removed = row.eventDedupeBase
        ? await tx.notification.deleteMany({ where: { dedupeKey: { startsWith: row.eventDedupeBase } } })
        : { count: 0 }
      notificationsRemoved += removed.count

      await tx.footballGoalKicker.delete({ where: { id: row.afterRow!.id } })
      deletedRows++
      const beforeRows = row.beforeRows ?? []
      if (beforeRows.length) {
        await tx.footballGoalKicker.createMany({
          data: beforeRows.map(before => ({
            id: before.id,
            playerId: before.playerId,
            playerName: before.playerName,
            clubId: before.clubId,
            clubName: before.clubName,
            leagueId: before.leagueId,
            leagueName: before.leagueName,
            season: before.season,
            grade: before.grade,
            goals: before.goals,
            matches: before.matches,
            sourceUrl: before.sourceUrl,
            sourceType: before.sourceType,
            importedAt: new Date(before.importedAt),
            createdAt: new Date(before.createdAt),
            updatedAt: new Date(before.updatedAt),
          })),
        })
        restoredRows += beforeRows.length
      }
    }

    await tx.ocrImport.update({
      where: { id: batch.id },
      data: { status: 'DISCARDED', notes: JSON.stringify({ ...notes, undoneAt: new Date().toISOString(), undoResult: { restoredRows, deletedRows, notificationsRemoved } }) },
    })

    return { restoredRows, deletedRows, notificationsRemoved }
  })

  return { ...result, fileName }
}

export function goalKickerEventDedupeBase(input: { leagueId: string; season: string; grade: string; playerId: string; goals: number }) {
  return `goal-kicker:${input.leagueId}:${input.season}:${norm(input.grade)}:${input.playerId}:${input.goals}`
}
