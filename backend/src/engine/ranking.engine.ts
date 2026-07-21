/**
 * CNCA Power Rankings Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Converts normalised club statistics into a single Power Rating (0–100)
 * and produces an ordered ranking list.
 *
 * Key design principles:
 * • Every weight is configurable — stored in DB, not hardcoded here
 * • Each component is scored 0–100 before weighting → easy to inspect
 * • The engine is pure: same inputs always produce the same outputs
 * • Historical scoring data is preserved per-run for full auditability
 */

import type {
  ClubRankingInput,
  ClubRankingOutput,
  RankingWeights,
  MatchResult,
} from '../types/index.js'
import { DEFAULT_WEIGHTS } from '../types/index.js'
import { logger } from '../utils/logger.js'
import { getISOWeekLabel, getCurrentSeason } from '../utils/week-label.js'

// ─────────────────────────────────────────────────────────────────────────────
// Component scoring functions (each returns 0–100)
// ─────────────────────────────────────────────────────────────────────────────

/** Win percentage, with a minimum games floor to prevent 1-game wonders. */
function scoreWinPercentage(wins: number, played: number): number {
  if (played < 3) return wins / Math.max(played, 1) * 100 * (played / 3)
  return (wins / played) * 100
}

/**
 * Goals For — normalised against the max in the current field.
 * We score relative to the cohort so small-league clubs with 300 goals
 * aren't penalised against big-league clubs with 900.
 */
function scoreGoalsFor(goalsFor: number, maxGoalsFor: number): number {
  if (maxGoalsFor === 0) return 50
  return Math.min((goalsFor / maxGoalsFor) * 100, 100)
}

/**
 * Goals Against — lower is better.
 * Normalised to the minimum conceded in the field.
 */
function scoreGoalsAgainst(goalsAgainst: number, minGoalsAgainst: number, maxGoalsAgainst: number): number {
  if (maxGoalsAgainst === minGoalsAgainst) return 50
  const inverted = maxGoalsAgainst - goalsAgainst
  const range    = maxGoalsAgainst - minGoalsAgainst
  return Math.min((inverted / range) * 100, 100)
}

/** Win/loss percentage as reported by the league. */
function scorePercentage(percentage: number): number {
  // Percentage > 100 = scored more than conceded across all games
  // Cap at 200% for scoring purposes; 100% → 50 points
  return Math.min((percentage / 200) * 100, 100)
}

/** League strength is already normalised 0–100 by admin. */
function scoreLeagueStrength(strengthScore: number): number {
  return Math.min(Math.max(strengthScore, 0), 100)
}

/**
 * Recent form — weighted so most recent game counts most.
 * Form array: [..., oldest, ..., newest]
 */
function scoreRecentForm(form: MatchResult[]): number {
  if (form.length === 0) return 50

  const weights = form.map((_, i) => i + 1)   // [1, 2, 3, 4, 5] — newest gets highest weight
  const totalWeight = weights.reduce((a, b) => a + b, 0)

  let score = 0
  form.forEach((result, i) => {
    const value = result === 'W' ? 1 : result === 'D' ? 0.5 : 0
    score += value * weights[i]
  })

  return (score / totalWeight) * 100
}

/**
 * Finals success — premierships and deep finals runs.
 * finalsWins: grand final wins this season; finalsLosses: eliminated games
 */
function scoreFinalsSuccess(finalsWins: number, finalsLosses: number): number {
  // Max achievable in a season: win 3 finals (QF, SF, GF) = 100
  const totalFinals = finalsWins + finalsLosses
  if (totalFinals === 0) return 0
  const baseScore = (finalsWins / Math.max(totalFinals, 1)) * 80
  const participationBonus = Math.min(totalFinals * 10, 20)
  return Math.min(baseScore + participationBonus, 100)
}

/**
 * Strength of opposition — average power rating of defeated opponents.
 * Rewards clubs who beat strong sides.
 */
function scoreStrengthOfOpposition(oppositionRatings: number[]): number {
  if (oppositionRatings.length === 0) return 50
  const avg = oppositionRatings.reduce((a, b) => a + b, 0) / oppositionRatings.length
  return Math.min(avg, 100)
}

/**
 * Consistency — low variance across game-by-game margins.
 * A club that wins every game by 15 is more consistent than one that wins
 * 90% but alternates between +40 and +2.
 */
function scoreConsistency(wins: number, played: number, goalsFor: number, goalsAgainst: number): number {
  if (played === 0) return 50
  const winRate = wins / played
  const margin  = (goalsFor - goalsAgainst) / played

  // Reward: high win rate AND positive margin
  const winScore    = winRate * 60
  const marginScore = Math.min(Math.max((margin + 30) / 60 * 40, 0), 40)
  return winScore + marginScore
}

function competitionKey(club: ClubRankingInput): string {
  const league = (club.leagueName || club.leagueId)
    .toLowerCase()
    .replace(/\bfootball\s+netball\s+league\b/g, 'fnl')
    .replace(/\bfootball\s+league\b/g, 'fl')
    .replace(/[^a-z0-9]+/g, '')
  return `${league}|${club.state}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Main ranking engine
// ─────────────────────────────────────────────────────────────────────────────

export class RankingEngine {
  private weights: RankingWeights

  constructor(weights: Partial<RankingWeights> = {}) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights }
    this.validateWeights()
  }

  private validateWeights(): void {
    const sum = Object.values(this.weights).reduce((a, b) => a + b, 0)
    if (Math.abs(sum - 1.0) > 0.001) {
      logger.warn('RankingEngine: weights do not sum to 1.0', { sum, weights: this.weights })
    }
  }

  /**
   * Rank a full cohort of clubs.
   * All normalisation is relative to this cohort — never call for a single club.
   */
  rankCohort(
    clubs: ClubRankingInput[],
    previousRankings: Map<string, number> = new Map(),
    weekLabel: string = getISOWeekLabel(),
    season: string = getCurrentSeason(),
  ): ClubRankingOutput[] {
    if (clubs.length === 0) {
      logger.warn('RankingEngine.rankCohort called with empty club list')
      return []
    }

    logger.info('RankingEngine: starting cohort ranking', { count: clubs.length, weekLabel })

    // Pre-compute cohort-wide stats for relative normalisation
    const maxGoalsFor     = Math.max(...clubs.map(c => c.goalsFor))
    const minGoalsAgainst = Math.min(...clubs.map(c => c.goalsAgainst))
    const maxGoalsAgainst = Math.max(...clubs.map(c => c.goalsAgainst))

    // First pass: score each club independently
    const scored = clubs.map(club => {
      const components = {
        winPercentage:        scoreWinPercentage(club.wins, club.played),
        goalsFor:             scoreGoalsFor(club.goalsFor, maxGoalsFor),
        goalsAgainst:         scoreGoalsAgainst(club.goalsAgainst, minGoalsAgainst, maxGoalsAgainst),
        percentage:           scorePercentage(club.percentage),
        leagueStrength:       scoreLeagueStrength(club.leagueStrengthScore),
        recentForm:           scoreRecentForm(club.recentForm),
        finalsSuccess:        scoreFinalsSuccess(club.finalsWins, club.finalsLosses),
        strengthOfOpposition: scoreStrengthOfOpposition(club.oppositionRatings),
        consistency:          scoreConsistency(club.wins, club.played, club.goalsFor, club.goalsAgainst),
      }

      const powerRating = parseFloat((
        components.winPercentage        * this.weights.winPercentage +
        components.goalsFor             * this.weights.goalsFor +
        components.goalsAgainst         * this.weights.goalsAgainst +
        components.percentage           * this.weights.percentage +
        components.leagueStrength       * this.weights.leagueStrength +
        components.recentForm           * this.weights.recentForm +
        components.finalsSuccess        * this.weights.finalsSuccess +
        components.strengthOfOpposition * this.weights.strengthOfOpposition +
        components.consistency          * this.weights.consistency
      ).toFixed(2))

      return { club, components, powerRating }
    })

    // Ranking rule:
    //  • Within the SAME competition, record comes first — an undefeated team
    //    ranks above a team with a loss (fewer losses wins; then more wins).
    //  • Competition identity uses normalised league name + state rather than
    //    only league UUID, so rebuilt/duplicate league records cannot split one
    //    real competition into separate hidden ranking groups.
    //  • Teams with an identical record, and teams in different leagues, fall
    //    back to the formula power rating.
    // To keep displayed ratings monotonic with the order, we reassign each
    // competition's set of rating values in record order — the formula still
    // sets the magnitudes (and cross-league placement), the record sets the order.
    const byLeague = new Map<string, typeof scored>()
    for (const s of scored) {
      const key = competitionKey(s.club)
      const arr = byLeague.get(key) ?? []
      arr.push(s)
      byLeague.set(key, arr)
    }
    for (const group of byLeague.values()) {
      const ratingsDesc = group.map(s => s.powerRating).sort((a, b) => b - a)
      group.sort((a, b) => {
        if (a.club.losses !== b.club.losses) return a.club.losses - b.club.losses
        if (a.club.wins   !== b.club.wins)   return b.club.wins   - a.club.wins
        return b.powerRating - a.powerRating
      })
      group.forEach((s, i) => { s.powerRating = ratingsDesc[i] })
    }

    // Global order by the (record-aligned) rating — a valid total order that
    // reproduces within-league record order and interleaves leagues by formula.
    scored.sort((a, b) => b.powerRating - a.powerRating)

    const calculatedAt = new Date().toISOString()

    // Second pass: assign rank, calculate movement
    const outputs: ClubRankingOutput[] = scored.map(({ club, components, powerRating }, idx) => {
      const rank         = idx + 1
      const previousRank = previousRankings.get(club.clubId) ?? null
      const movement     = previousRank !== null ? previousRank - rank : 0

      return {
        clubId:       club.clubId,
        clubName:     club.clubName,
        leagueId:     club.leagueId,
        leagueName:   club.leagueName,
        state:        club.state,
        powerRating,
        componentScores: components,
        rank,
        previousRank,
        rankMovement: movement,
        recentForm:   club.recentForm,
        calculatedAt,
        weekLabel,
        season,
      } as ClubRankingOutput & { season: string }
    })

    logger.info('RankingEngine: cohort ranked', {
      count: outputs.length,
      top3: outputs.slice(0, 3).map(o => `${o.rank}. ${o.clubName} (${o.powerRating})`),
    })

    return outputs
  }

  /** Expose current weights for auditing / API exposure */
  getWeights(): RankingWeights {
    return { ...this.weights }
  }
}

// Singleton for use across the application
export const rankingEngine = new RankingEngine()
