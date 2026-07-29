/** Individual Australian football match-detail screenshot parsers. Preview only. */
const API = 'https://api.anthropic.com/v1/messages'

export type MatchDetailKicker = { playerName: string; goals: number }
export type ParsedMatchDetail = {
  homeTeam: string | null; awayTeam: string | null; league: string | null; grade: string | null; season: string | null; round: string | null
  matchDate: string | null; matchTime: string | null; venue: string | null
  homeGoals: number | null; homeBehinds: number | null; homeScore: number | null
  awayGoals: number | null; awayBehinds: number | null; awayScore: number | null
  homeQuarterScores: Array<string | null>; awayQuarterScores: Array<string | null>
  homeBestPlayers: string[]; awayBestPlayers: string[]; homeGoalKickers: MatchDetailKicker[]; awayGoalKickers: MatchDetailKicker[]
  notes: string | null; confidence: number | null
}
export type ParsedTeamGoalKickers = { teamName: string | null; goalKickers: MatchDetailKicker[]; confidence: number | null; notes: string | null }

function imageSource(image: string): { media_type: string; data: string } {
  const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/)
  return match ? { media_type: match[1], data: match[2] } : { media_type: 'image/png', data: image.replace(/^base64,/, '') }
}
const cleanNames = (value: unknown) => Array.isArray(value) ? value.map(item => String(item ?? '').trim()).filter(Boolean) : []
const cleanScores = (value: unknown) => { const scores = Array.isArray(value) ? value.slice(0, 4) : []; while (scores.length < 4) scores.push(null); return scores.map(item => item == null || String(item).trim() === '' ? null : String(item).trim()) }
const cleanKickers = (value: unknown): MatchDetailKicker[] => Array.isArray(value) ? value.flatMap(item => { if (!item || typeof item !== 'object') return []; const row = item as { playerName?: unknown; goals?: unknown }; const playerName = String(row.playerName ?? '').trim(); const goals = Number(row.goals); return playerName && Number.isFinite(goals) && goals > 0 ? [{ playerName, goals: Math.floor(goals) }] : [] }) : []
const cleanNumber = (value: unknown) => { if (value == null || value === '') return null; const number = Number(value); return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : null }

async function visionJson(image: string, prompt: string, maxTokens: number): Promise<Record<string, unknown>> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured')
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8'
  const src = imageSource(image)
  const response = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: src.media_type, data: src.data } }, { type: 'text', text: prompt }] }] }), signal: AbortSignal.timeout(60_000) })
  if (!response.ok) throw new Error(`Anthropic API ${response.status}: ${(await response.text()).slice(0, 300)}`)
  const body = await response.json() as { content?: Array<{ type: string; text?: string }> }
  const text = (body.content ?? []).filter(item => item.type === 'text').map(item => item.text ?? '').join('').trim()
  const json = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try { return JSON.parse(json) as Record<string, unknown> } catch { throw new Error(`Vision returned non-JSON: ${text.slice(0, 200)}`) }
}

export async function parseMatchDetailImage(image: string): Promise<ParsedMatchDetail> {
  const parsed = await visionJson(image, `Read this single Australian football match-detail screenshot exactly as displayed. Return ONLY minified JSON with this exact structure:
{"homeTeam":string|null,"awayTeam":string|null,"league":string|null,"grade":string|null,"season":string|null,"round":string|null,"matchDate":"YYYY-MM-DD"|null,"matchTime":string|null,"venue":string|null,"homeGoals":number|null,"homeBehinds":number|null,"homeScore":number|null,"awayGoals":number|null,"awayBehinds":number|null,"awayScore":number|null,"homeQuarterScores":[string|null,string|null,string|null,string|null],"awayQuarterScores":[string|null,string|null,string|null,string|null],"homeBestPlayers":[string],"awayBestPlayers":[string],"homeGoalKickers":[{"playerName":string,"goals":number}],"awayGoalKickers":[{"playerName":string,"goals":number}],"notes":string|null,"confidence":number|null}
Rules:
- This is one match, not a round list.
- Read final goals, behinds and total points separately for both teams.
- Quarter scores must be cumulative scores as printed, such as "5.7", not calculated totals.
- Preserve the displayed home/first team and away/second team order.
- Extract best players from the visible Best Players sections.
- Goal kickers may be empty because separate player-statistics screenshots can be uploaded later.
- Extract only visible information. Never invent names, goals, scores, dates or venue details.
- Use null or an empty array for anything not visible.
- confidence must be between 0 and 1 and reflect the overall extraction quality.`, 4000)
  const confidenceValue = Number(parsed.confidence)
  return {
    homeTeam: parsed.homeTeam == null ? null : String(parsed.homeTeam).trim() || null,
    awayTeam: parsed.awayTeam == null ? null : String(parsed.awayTeam).trim() || null,
    league: parsed.league == null ? null : String(parsed.league).trim() || null,
    grade: parsed.grade == null ? null : String(parsed.grade).trim() || null,
    season: parsed.season == null ? null : String(parsed.season).trim() || null,
    round: parsed.round == null ? null : String(parsed.round).trim() || null,
    matchDate: parsed.matchDate == null ? null : String(parsed.matchDate).trim() || null,
    matchTime: parsed.matchTime == null ? null : String(parsed.matchTime).trim() || null,
    venue: parsed.venue == null ? null : String(parsed.venue).trim() || null,
    homeGoals: cleanNumber(parsed.homeGoals), homeBehinds: cleanNumber(parsed.homeBehinds), homeScore: cleanNumber(parsed.homeScore),
    awayGoals: cleanNumber(parsed.awayGoals), awayBehinds: cleanNumber(parsed.awayBehinds), awayScore: cleanNumber(parsed.awayScore),
    homeQuarterScores: cleanScores(parsed.homeQuarterScores), awayQuarterScores: cleanScores(parsed.awayQuarterScores),
    homeBestPlayers: cleanNames(parsed.homeBestPlayers), awayBestPlayers: cleanNames(parsed.awayBestPlayers),
    homeGoalKickers: cleanKickers(parsed.homeGoalKickers), awayGoalKickers: cleanKickers(parsed.awayGoalKickers),
    notes: parsed.notes == null ? null : String(parsed.notes).trim() || null,
    confidence: Number.isFinite(confidenceValue) ? Math.max(0, Math.min(1, confidenceValue)) : null,
  }
}

export async function parseTeamGoalKickerImage(image: string): Promise<ParsedTeamGoalKickers> {
  const parsed = await visionJson(image, `Read this Australian football Player Statistics screenshot for ONE team. Return ONLY minified JSON:
{"teamName":string|null,"goalKickers":[{"playerName":string,"goals":number}],"confidence":number|null,"notes":string|null}
Rules:
- The table may contain columns such as player number, player name, FF and G.
- G means goals. Extract the player name and the number in the G column only.
- Include only players with G greater than 0.
- Do not treat FF, player number, ranking or any other column as goals.
- Preserve player names exactly as displayed.
- Extract only visible rows. Never invent missing players or values.
- teamName can be null if the team name is not visible.
- confidence must be between 0 and 1.`, 2200)
  const confidenceValue = Number(parsed.confidence)
  return { teamName: parsed.teamName == null ? null : String(parsed.teamName).trim() || null, goalKickers: cleanKickers(parsed.goalKickers), confidence: Number.isFinite(confidenceValue) ? Math.max(0, Math.min(1, confidenceValue)) : null, notes: parsed.notes == null ? null : String(parsed.notes).trim() || null }
}
