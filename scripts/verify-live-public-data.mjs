const baseUrl = String(process.argv[2] || process.env.PLAYFOOTY_BASE_URL || 'https://playfooty.com.au').replace(/\/$/, '')

const currentSeason = new Date().getFullYear()

const checks = [
  { name: 'homepage', path: '/', type: 'html', required: text => /playfooty/i.test(text) && !/internal server error|application error|function invocation failed/i.test(text) },
  { name: 'health', path: '/health', required: payload => payload?.status === 'ok' },
  { name: 'club and league directory', path: '/api/directory', required: payload => Number(payload?.meta?.totalClubs) > 0 && Number(payload?.meta?.totalLeagues) > 0 && Array.isArray(payload?.states) && payload.states.length > 0 },
  { name: 'rankings', path: '/api/rankings/top10', required: payload => nonEmptyDataArray(payload) && payload.data.every(item => item && typeof item === 'object') },
  { name: 'results', path: `/api/results/football?season=${currentSeason}&limit=20`, required: nonEmptyDataArray },
  { name: 'fixtures', path: `/api/fixtures/football?season=${currentSeason}&limit=20`, required: nonEmptyDataArray },
  { name: 'mvp', path: '/api/mvp?limit=5', required: nonEmptyDataArray },
  { name: 'goal kickers', path: '/api/goal-kickers?sort=goals&limit=5', required: nonEmptyDataArray },
  { name: 'goals per game', path: '/api/goal-kickers?sort=gpg&limit=5', required: nonEmptyDataArray },
  { name: 'weekly records', path: '/api/records?period=week&limit=20', required: hasRecordData },
  { name: 'season records', path: `/api/records?period=season&season=${currentSeason}&limit=20`, required: hasRecordData },
  { name: 'goal-kicker records', path: '/api/goal-kickers/records?limit=20', required: hasAnyNestedArray },
  { name: 'news', path: '/api/news', required: nonEmptyDataArray },
  { name: 'search', path: '/api/search?q=football', required: validSearch },
  { name: 'featured games', path: '/api/featured-games', required: validDataArray },
  { name: 'highlights', path: '/api/highlights', required: validDataArray },
]

function validDataArray(payload) {
  return payload && typeof payload === 'object' && Array.isArray(payload.data)
}

function nonEmptyDataArray(payload) {
  return validDataArray(payload) && payload.data.length > 0
}

function validSearch(payload) {
  const data = payload?.data
  const meta = payload?.meta
  if (!data || typeof data !== 'object' || !meta || typeof meta !== 'object') return false
  const groups = ['clubs', 'leagues', 'players', 'matches', 'news', 'highlights', 'records']
  if (!groups.every(group => Array.isArray(data[group]))) return false
  if (!Number.isFinite(Number(meta.total)) || Number(meta.total) <= 0) return false
  return Array.isArray(meta.partial) && meta.partial.length === 0
}

function hasAnyNestedArray(payload) {
  const data = payload?.data
  if (!data || typeof data !== 'object') return false
  return Object.values(data).some(value => Array.isArray(value) && value.length > 0)
}

function hasRecordData(payload) {
  const categories = payload?.data?.categories
  if (!categories || typeof categories !== 'object') return false
  return Object.values(categories).some(value => Array.isArray(value) && value.length > 0)
}

async function fetchResponse(path, type = 'json') {
  let lastError
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { accept: type === 'html' ? 'text/html' : 'application/json', 'user-agent': 'PlayFootyReleaseGate/2.0' },
        redirect: 'follow',
        signal: AbortSignal.timeout(25_000),
      })
      const text = await response.text()
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 180)}`)
      if (type === 'html') return text
      try { return JSON.parse(text) } catch { throw new Error(`non-JSON response: ${text.slice(0, 180)}`) }
    } catch (error) {
      lastError = error
      if (attempt < 4) await new Promise(resolve => setTimeout(resolve, attempt * 2000))
    }
  }
  throw lastError
}

const failures = []
console.log(`Verifying PlayFooty public foundation at ${baseUrl}`)
for (const check of checks) {
  try {
    const payload = await fetchResponse(check.path, check.type)
    if (!check.required(payload)) throw new Error('response did not satisfy the required public contract')
    console.log(`✓ ${check.name}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    failures.push(`${check.name}: ${message}`)
    console.error(`✗ ${check.name}: ${message}`)
  }
}

if (failures.length) {
  console.error('\nPlayFooty public foundation failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('\nAll required PlayFooty public pages and APIs returned usable data.')
