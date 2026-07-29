/**
 * Fuzzy club matcher (pure)
 * ─────────────────────────────────────────────────────────────────────────────
 * Resolves an OCR'd ladder team name to an existing club, tolerating the ways
 * the same club is written across sources:
 *   "Churchill" · "Churchill Cougars" · "Churchill FNC"  → the same club.
 *
 * Strategy: drop generic netball/football suffix tokens, compare the remaining
 * core tokens (subset ⇒ strong match), and fall back to a normalised
 * edit-distance ratio. Returns the best candidate + a 0–1 score and a
 * confidence flag so the UI can highlight uncertain rows for the operator.
 */

const STOP = new Set([
  'fnc', 'fc', 'nc', 'fncl', 'fnl', 'afc', 'netball', 'football', 'club', 'clubs',
  'association', 'assoc', 'inc', 'and', 'district', 'districts', 'the',
  'senior', 'seniors', 'reserve', 'reserves', 'res', 'seconds', 'thirds',
  'women', 'womens', 'ladies', 'a', 'grade', 'nfc', 'fnetballc',
])

export function coreTokens(name: string): string[] {
  return (name || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(t => t && !STOP.has(t))
}

const norm = (name: string) => coreTokens(name).join('')

/** Levenshtein ratio (0–1). */
function ratio(a: string, b: string): number {
  if (!a && !b) return 1
  if (!a || !b) return 0
  const m = a.length, n = b.length
  const d: number[] = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    let prev = d[0]; d[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = d[j]
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return 1 - d[n] / Math.max(m, n)
}

/** Similarity 0–1 between two club names. */
export function similarity(a: string, b: string): number {
  const ta = new Set(coreTokens(a)), tb = new Set(coreTokens(b))
  if (ta.size === 0 || tb.size === 0) return ratio(norm(a), norm(b))
  // Subset either way → same club with an extra mascot/suffix word.
  const inter = [...ta].filter(t => tb.has(t)).length
  if (inter > 0 && (inter === ta.size || inter === tb.size)) return 0.95
  const jaccard = inter / new Set([...ta, ...tb]).size
  return Math.max(jaccard, ratio(norm(a), norm(b)))
}

export interface ClubCandidate { id: string; name: string }
export interface MatchResult {
  clubId:      string | null
  matchedName: string | null
  score:       number
  confident:   boolean   // score ≥ 0.85 → auto-accept; else flag for review
}

/** Best existing-club match for an OCR'd name. */
export function fuzzyMatchClub(rawName: string, candidates: ClubCandidate[], threshold = 0.85): MatchResult {
  let best: ClubCandidate | null = null
  let bestScore = 0
  for (const c of candidates) {
    const s = similarity(rawName, c.name)
    if (s > bestScore) { bestScore = s; best = c }
  }
  return {
    clubId:      bestScore >= 0.6 ? best?.id ?? null : null,
    matchedName: bestScore >= 0.6 ? best?.name ?? null : null,
    score:       Number(bestScore.toFixed(3)),
    confident:   bestScore >= threshold,
  }
}
