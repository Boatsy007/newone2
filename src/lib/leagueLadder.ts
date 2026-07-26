import type { LeagueDetail } from './rankings'

export type CanonicalLadderRow = LeagueDetail['ladder'][number]

export function normaliseClubName(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(seniors?|senior men|a grade|football club|fc)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function ladderRowKey(row: CanonicalLadderRow) {
  return row.clubId || normaliseClubName(row.clubName)
}

function rowScore(row: CanonicalLadderRow) {
  return (Number(row.played) || 0) * 100000
    + (Number(row.points) || 0) * 1000
    + (Number(row.percentage) || 0)
    - (Number(row.position) || 999)
}

export function normaliseLeagueLadder(rows: CanonicalLadderRow[] | null | undefined) {
  const byClub = new Map<string, CanonicalLadderRow>()

  for (const row of Array.isArray(rows) ? rows : []) {
    const key = ladderRowKey(row)
    if (!key) continue
    const current = byClub.get(key)
    if (!current || rowScore(row) > rowScore(current)) byClub.set(key, row)
  }

  const cleaned = [...byClub.values()]
  cleaned.sort((a, b) => {
    const aPosition = Number(a.position)
    const bPosition = Number(b.position)
    if (Number.isFinite(aPosition) && aPosition > 0 && Number.isFinite(bPosition) && bPosition > 0 && aPosition !== bPosition) return aPosition - bPosition
    if ((b.points ?? 0) !== (a.points ?? 0)) return (b.points ?? 0) - (a.points ?? 0)
    if ((b.percentage ?? 0) !== (a.percentage ?? 0)) return (b.percentage ?? 0) - (a.percentage ?? 0)
    return a.clubName.localeCompare(b.clubName)
  })

  return cleaned.map((row, index) => ({ ...row, position: index + 1 }))
}
