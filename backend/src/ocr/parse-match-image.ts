/** Results and fixtures image OCR via Claude vision. Preview-only parser. */
const API = 'https://api.anthropic.com/v1/messages'

export type MatchImageKind = 'fixtures' | 'results'
export interface OcrMatchRow {
  round?: number
  grade?: string | null
  matchDate?: string | null
  matchTime?: string | null
  venue?: string | null
  homeTeam: string
  awayTeam: string
  homeGoals?: number
  homeBehinds?: number
  homeScore?: number
  awayGoals?: number
  awayBehinds?: number
  awayScore?: number
  homeQuarterScores?: Array<string | null>
  awayQuarterScores?: Array<string | null>
  homeBestPlayers?: string[]
  awayBestPlayers?: string[]
  homeGoalKickers?: Array<{ playerName: string; goals: number }>
  awayGoalKickers?: Array<{ playerName: string; goals: number }>
  detailNotes?: string | null
  status?: string | null
}
export interface OcrMatchResult {
  kind: MatchImageKind
  league: string | null
  grade: string | null
  season: string | null
  round: number | null
  rows: OcrMatchRow[]
  notes: string | null
}

function imageSource(image: string): { media_type: string; data: string } {
  const m = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/)
  return m ? { media_type: m[1], data: m[2] } : { media_type: 'image/png', data: image.replace(/^base64,/, '') }
}

export async function parseMatchImage(image: string, requestedKind: MatchImageKind): Promise<OcrMatchResult> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured')
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8'
  const src = imageSource(image)
  const prompt = `Read this Australian football ${requestedKind === 'results' ? 'RESULTS' : 'FIXTURES'} screenshot exactly as shown. Return ONLY minified JSON:
{"kind":"${requestedKind}","league":string|null,"grade":string|null,"season":string|null,"round":number|null,"rows":[{"round":number,"grade":string|null,"matchDate":"YYYY-MM-DD"|null,"matchTime":string|null,"venue":string|null,"homeTeam":string,"awayTeam":string,"homeGoals":number,"homeBehinds":number,"homeScore":number,"awayGoals":number,"awayBehinds":number,"awayScore":number,"homeQuarterScores":[string|null,string|null,string|null,string|null],"awayQuarterScores":[string|null,string|null,string|null,string|null],"homeBestPlayers":[string],"awayBestPlayers":[string],"homeGoalKickers":[{"playerName":string,"goals":number}],"awayGoalKickers":[{"playerName":string,"goals":number}],"detailNotes":string|null,"status":string|null}],"notes":string|null}
Rules: Include only visible values and omit unreadable numeric keys. Never guess. For Australian football, preserve goals, behinds and printed total separately. Quarter score strings must preserve the displayed goals.behinds format such as "5.7". Best-player names must stay in the same team column shown. Goal kickers must only be included if visibly listed in the screenshot. For fixtures, omit scores and all result detail unless visibly shown. Use the displayed home/first team as homeTeam and away/second team as awayTeam. If it is not a ${requestedKind} image, return rows:[] and explain in notes.`
  const res = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: 4000, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: src.media_type, data: src.data } }, { type: 'text', text: prompt }] }] }), signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const body = await res.json() as { content?: { type: string; text?: string }[] }
  const text = (body.content ?? []).filter(c => c.type === 'text').map(c => c.text ?? '').join('').trim()
  const json = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  let parsed: OcrMatchResult
  try { parsed = JSON.parse(json) } catch { throw new Error(`Vision returned non-JSON: ${text.slice(0, 200)}`) }
  const rows = (parsed.rows ?? []).filter(r => r && typeof r.homeTeam === 'string' && r.homeTeam.trim() && typeof r.awayTeam === 'string' && r.awayTeam.trim()).map(r => ({ ...r, homeTeam: r.homeTeam.trim(), awayTeam: r.awayTeam.trim(), round: r.round ?? parsed.round ?? undefined, grade: r.grade ?? parsed.grade ?? null }))
  return { kind: requestedKind, league: parsed.league ?? null, grade: parsed.grade ?? null, season: parsed.season ?? null, round: parsed.round ?? null, rows, notes: parsed.notes ?? null }
}
