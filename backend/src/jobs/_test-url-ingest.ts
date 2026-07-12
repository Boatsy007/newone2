/**
 * Validation for Admin V3 football URL parser (pure, offline — no network).
 * Usage: tsx src/jobs/_test-url-ingest.ts
 */
import { parseResults, parseFixtures, parseLadder, type FetchedPage } from '../football/url-ingest.js'

const page = (body: string, contentType = 'text/html'): FetchedPage => ({ url: 'x', ok: true, status: 200, contentType, body })
const capturedPage = (json: unknown): FetchedPage => page(`<html><body><script id="__PLAYFOOTY_CAPTURED_JSON__" type="application/json">${JSON.stringify([json])}</script></body></html>`)

async function main() {
  const checks: [string, boolean][] = []

  // 1) AFL score text
  const textHtml = '<div>Round 1</div><p>Geelong Amateur 12.8 (80) def Newtown &amp; Chilwell 9.10 (64)</p><p>South Barwon 15.12 (102) def Bell Post Hill 6.5 (41)</p>'
  const r1 = parseResults(page(textHtml))
  checks.push(['text: 2 results parsed', r1.rows.length === 2])
  checks.push(['text: goals/behinds/total', r1.rows[0].homeGoals === 12 && r1.rows[0].homeBehinds === 8 && r1.rows[0].homePoints === 80])
  checks.push(['text: away total 64', r1.rows[0].awayPoints === 64])
  checks.push(['text: names', r1.rows[0].homeName === 'Geelong Amateur' && r1.rows[0].awayName.includes('Newtown')])
  checks.push(['text: strategy html-text', r1.strategy === 'html-text'])

  // 2) __NEXT_DATA__ JSON results
  const nd = { props: { pageProps: { games: [{ homeTeam: { name: 'A FC' }, awayTeam: { name: 'B FC' }, homeScore: 90, awayScore: 60, round: 'Round 2' }] } } }
  const ndHtml = `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nd)}</script></body></html>`
  const r2 = parseResults(page(ndHtml))
  checks.push(['nextdata: 1 result', r2.rows.length === 1 && r2.rows[0].homeName === 'A FC' && r2.rows[0].homePoints === 90])
  checks.push(['nextdata: strategy', r2.strategy === '__NEXT_DATA__'])

  // 3) JSON fixtures
  const jf = JSON.stringify({ data: [{ home: { name: 'C FC' }, away: { name: 'D FC' }, date: '2026-04-05T14:00:00', venue: { name: 'C Oval' } }] })
  const f1 = parseFixtures(page(jf, 'application/json'))
  checks.push(['json fixtures: 1 row + venue', f1.rows.length === 1 && f1.rows[0].venue === 'C Oval'])

  // 4) JSON ladder
  const jl = JSON.stringify({ ladder: [{ team: { name: 'A FC' }, position: 1, played: 5, wins: 5, points: 20, pointsFor: 450, pointsAgainst: 210 }] })
  const l1 = parseLadder(page(jl, 'application/json'))
  checks.push(['json ladder: 1 row', l1.rows.length === 1 && l1.rows[0].points === 20 && l1.rows[0].position === 1])

  // 4a) PlayHQ captured GraphQL ladder: current ladder rows live under nested
  // GraphQL objects with team.name plus statistic rows; sport metadata like
  // { name: "afl" } must never be accepted as a ladder club.
  const teams = [
    'Wangaratta Rovers Seniors',
    'Wangaratta Seniors',
    'Myrtleford Seniors',
    'Wodonga Seniors',
    'Yarrawonga Seniors',
    'Lavington Seniors',
    'North Albury Seniors',
    'Albury Seniors',
    'Corowa Rutherglen Seniors',
    'Wodonga Raiders Seniors',
  ]
  const playHqLadder = {
    data: {
      tenant: { name: 'afl', points: 1 },
      grade: {
        ladder: {
          rows: teams.map((name, i) => ({
            position: i + 1,
            team: { name },
            statistics: [
              { name: 'P', value: 9 },
              { name: 'W', value: Math.max(0, 9 - i) },
              { name: 'L', value: i },
              { name: 'D', value: 0 },
              { name: 'Byes', value: 0 },
              { name: 'PF', value: 720 - i * 20 },
              { name: 'PA', value: 400 + i * 15 },
              { name: '%', value: 180 - i * 5 },
              { name: 'PTS', value: Math.max(0, 36 - i * 4) },
              { name: 'Adjusted', value: 0 },
            ],
          })),
        },
      },
    },
  }
  const l2 = parseLadder(capturedPage(playHqLadder))
  checks.push(['playhq ladder: 10 rows parsed', l2.rows.length === 10])
  checks.push(['playhq ladder: Wangaratta Rovers present', l2.rows.some(r => r.clubName === 'Wangaratta Rovers Seniors')])
  checks.push(['playhq ladder: Wodonga Raiders present', l2.rows.some(r => r.clubName === 'Wodonga Raiders Seniors')])
  checks.push(['playhq ladder: no afl row', !l2.rows.some(r => r.clubName.toLowerCase() === 'afl')])

  // 4b) PlayHQ captured GraphQL fixtures/results: nested home/away sides carry
  // team, score and round metadata.
  const playHqRound = {
    data: {
      round: {
        name: 'Round 9',
        matches: [
          {
            round: { name: 'Round 9' },
            scheduledAt: '2026-06-06T14:00:00+10:00',
            venue: { name: 'Wangaratta Showgrounds' },
            home: { team: { name: 'Wangaratta Rovers Seniors' }, score: { goals: 12, behinds: 8, total: 80 } },
            away: { team: { name: 'Wodonga Raiders Seniors' }, score: { goals: 9, behinds: 10, total: 64 } },
            status: 'FINAL',
          },
        ],
        upcoming: [
          {
            round: { name: 'Round 9' },
            scheduledAt: '2026-06-07T14:00:00+10:00',
            venue: { name: 'Lavington Sports Ground' },
            home: { team: { name: 'Lavington Seniors' } },
            away: { team: { name: 'Albury Seniors' } },
            status: 'SCHEDULED',
          },
        ],
      },
    },
  }
  const r3 = parseResults(capturedPage(playHqRound))
  const f2 = parseFixtures(capturedPage(playHqRound))
  checks.push(['playhq results: Round 9 teams parsed', r3.rows.length === 1 && r3.rows[0].homeName === 'Wangaratta Rovers Seniors' && r3.rows[0].awayName === 'Wodonga Raiders Seniors' && r3.rows[0].homePoints === 80])
  checks.push(['playhq fixtures: Round 9 teams parsed', f2.rows.length === 1 && f2.rows[0].homeName === 'Lavington Seniors' && f2.rows[0].awayName === 'Albury Seniors'])

  // 5) Empty page → graceful, no fabrication
  const e1 = parseResults(page('<html><body>Loading…</body></html>'))
  checks.push(['empty: 0 rows + warning', e1.rows.length === 0 && e1.warnings.length > 0 && e1.confidence === 0])

  // 6) Failed fetch → warning
  const e2 = parseResults({ url: 'x', ok: false, status: 403, contentType: '', body: '', error: 'HTTP 403' })
  checks.push(['fetch fail: 0 rows + error warning', e2.rows.length === 0 && e2.warnings[0] === 'HTTP 403'])

  let failed = 0
  console.log('── URL ingestion (Admin V3) validation ──')
  for (const [n, ok] of checks) { console.log(`  ${ok ? '✓' : '✗'} ${n}`); if (!ok) failed++ }
  if (failed) { console.error(`\n${failed} failed`); process.exit(1) }
  console.log('\nAll checks passed.')
}
main().catch(e => { console.error(e); process.exit(1) })
