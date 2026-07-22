const API = 'https://api.anthropic.com/v1/messages'

export interface OcrMvpRow {
  playerName: string
  clubName: string
  bp: number
  gamesPlayed?: number
}

export interface OcrMvpResult {
  league: string | null
  grade: string | null
  season: string | null
  rows: OcrMvpRow[]
  notes: string | null
}

const PROMPT = `You are reading an Australian football player statistics leaderboard from an image.
The table includes PLAYER, TEAM, GP, G and BP columns. BP means best-player votes/points.
Return ONLY valid minified JSON shaped exactly:
{"league":string|null,"grade":string|null,"season":string|null,"rows":[{"playerName":string,"clubName":string,"bp":number,"gamesPlayed":number}],"notes":string|null}
Rules:
- Extract every visible player row exactly as printed.
- bp must come only from the BP column.
- gamesPlayed must come only from GP when visible; otherwise omit it.
- Do not use the G column as BP.
- league, grade and season come from headings or labels when visible; do not guess.
- If this is not a player statistics table with BP, return {"league":null,"grade":null,"season":null,"rows":[],"notes":"not an MVP/BP leaderboard"}.`

function imageSource(image: string): { media_type: string; data: string } {
  const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/)
  return match ? { media_type: match[1], data: match[2] } : { media_type: 'image/png', data: image.replace(/^base64,/, '') }
}

export async function parseMvpImage(image: string): Promise<OcrMvpResult> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured')
  const source = imageSource(image)
  const response = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8',
      max_tokens: 3000,
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
  let parsed: OcrMvpResult
  try { parsed = JSON.parse(json) } catch { throw new Error(`Vision returned non-JSON: ${text.slice(0, 200)}`) }
  const rows = (parsed.rows ?? [])
    .filter(row => row && typeof row.playerName === 'string' && typeof row.clubName === 'string' && Number.isFinite(Number(row.bp)))
    .map(row => ({
      playerName: row.playerName.trim(),
      clubName: row.clubName.trim(),
      bp: Math.max(0, Math.trunc(Number(row.bp))),
      ...(row.gamesPlayed == null || !Number.isFinite(Number(row.gamesPlayed)) ? {} : { gamesPlayed: Math.max(0, Math.trunc(Number(row.gamesPlayed))) }),
    }))
    .filter(row => row.playerName && row.clubName)
  return {
    league: parsed.league ?? null,
    grade: parsed.grade ?? null,
    season: parsed.season == null ? null : String(parsed.season),
    rows,
    notes: parsed.notes ?? null,
  }
}
