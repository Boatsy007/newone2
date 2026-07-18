const API = 'https://api.anthropic.com/v1/messages'

export interface OcrGoalKickerRow {
  playerName: string
  clubName: string
  goals: number
  matches?: number
}
export interface OcrGoalKickerResult {
  league: string | null
  grade: string | null
  season: string | null
  rows: OcrGoalKickerRow[]
  notes: string | null
}

const PROMPT = `You are reading an Australian football GOAL KICKERS leaderboard from an image.
Return ONLY valid minified JSON shaped exactly:
{"league":string|null,"grade":string|null,"season":string|null,"rows":[{"playerName":string,"clubName":string,"goals":number,"matches":number}],"notes":string|null}
Rules:
- Extract every visible player row exactly as printed.
- goals is the season goal total shown for that player.
- Include matches only when clearly visible; otherwise omit it.
- league, grade and season come from headings or labels when visible; do not guess.
- Do not confuse rank, jumper number, games or points with goals.
- If the image is not a goal-kicker leaderboard, return {"league":null,"grade":null,"season":null,"rows":[],"notes":"not a goal-kicker leaderboard"}.`

function imageSource(image: string): { media_type: string; data: string } {
  const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/)
  return match ? { media_type: match[1], data: match[2] } : { media_type: 'image/png', data: image.replace(/^base64,/, '') }
}

export async function parseGoalKickerImage(image: string): Promise<OcrGoalKickerResult> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured')
  const source = imageSource(image)
  const response = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8', max_tokens: 2500,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: source.media_type, data: source.data } },
        { type: 'text', text: PROMPT },
      ] }],
    }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!response.ok) throw new Error(`Anthropic API ${response.status}: ${(await response.text()).slice(0, 300)}`)
  const body = await response.json() as { content?: { type: string; text?: string }[] }
  const text = (body.content ?? []).filter(part => part.type === 'text').map(part => part.text ?? '').join('').trim()
  const json = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  let parsed: OcrGoalKickerResult
  try { parsed = JSON.parse(json) } catch { throw new Error(`Vision returned non-JSON: ${text.slice(0, 200)}`) }
  const rows = (parsed.rows ?? []).filter(row => row && typeof row.playerName === 'string' && typeof row.clubName === 'string' && Number.isFinite(Number(row.goals))).map(row => ({
    playerName: row.playerName.trim(), clubName: row.clubName.trim(), goals: Math.max(0, Math.trunc(Number(row.goals))),
    ...(row.matches == null || !Number.isFinite(Number(row.matches)) ? {} : { matches: Math.max(0, Math.trunc(Number(row.matches))) }),
  })).filter(row => row.playerName && row.clubName)
  return { league: parsed.league ?? null, grade: parsed.grade ?? null, season: parsed.season == null ? null : String(parsed.season), rows, notes: parsed.notes ?? null }
}
