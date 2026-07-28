const baseUrl = String(process.argv[2] || process.env.PLAYFOOTY_BASE_URL || 'https://playfooty.com.au').replace(/\/$/, '')

const checks = [
  { name: 'health', path: '/health', required: payload => payload?.status === 'ok' },
  { name: 'rankings', path: '/api/rankings/top10', required: payload => Array.isArray(payload?.data) && payload.data.length > 0 },
  { name: 'mvp', path: '/api/mvp?limit=5', required: payload => Array.isArray(payload?.data) && payload.data.length > 0 },
  { name: 'goal kickers', path: '/api/goal-kickers?sort=goals&limit=5', required: payload => Array.isArray(payload?.data) && payload.data.length > 0 },
  { name: 'goals per game', path: '/api/goal-kickers?sort=gpg&limit=5', required: payload => Array.isArray(payload?.data) && payload.data.length > 0 },
  { name: 'weekly records', path: '/api/records?period=week&limit=20', required: hasRecordData },
  { name: 'season records', path: `/api/records?period=season&season=${new Date().getFullYear()}&limit=20`, required: hasRecordData },
  { name: 'goal-kicker records', path: '/api/goal-kickers/records?limit=20', required: hasAnyNestedArray },
  { name: 'news', path: '/api/news', required: payload => Array.isArray(payload?.data) && payload.data.length > 0 },
  { name: 'featured games', path: '/api/featured-games', required: validDataArray },
  { name: 'highlights', path: '/api/highlights', required: validDataArray },
]

function validDataArray(payload) {
  return payload && typeof payload === 'object' && Array.isArray(payload.data)
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

async function fetchJson(path) {
  let lastError
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { accept: 'application/json', 'user-agent': 'PlayFootyBaselineVerifier/1.0' },
        signal: AbortSignal.timeout(20_000),
      })
      const text = await response.text()
      let payload
      try { payload = JSON.parse(text) } catch { throw new Error(`non-JSON response: ${text.slice(0, 160)}`) }
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`)
      return payload
    } catch (error) {
      lastError = error
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 1500))
    }
  }
  throw lastError
}

const failures = []
console.log(`Verifying PlayFooty public data at ${baseUrl}`)
for (const check of checks) {
  try {
    const payload = await fetchJson(check.path)
    if (!check.required(payload)) throw new Error('response did not contain the required public data')
    console.log(`✓ ${check.name}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    failures.push(`${check.name}: ${message}`)
    console.error(`✗ ${check.name}: ${message}`)
  }
}

if (failures.length) {
  console.error('\nPublic data baseline failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('\nAll required PlayFooty public APIs returned valid data.')
