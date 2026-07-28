import app from '../src/server.js'

type Check = {
  name: string
  path: string
  validate: (payload: unknown) => boolean
}

function dataArray(payload: unknown): unknown[] {
  if (!payload || typeof payload !== 'object') return []
  const data = (payload as { data?: unknown }).data
  return Array.isArray(data) ? data : []
}

function hasArrayPayload(payload: unknown): boolean {
  return Boolean(payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data))
}

function hasRecordData(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false
  const data = (payload as { data?: unknown }).data
  if (!data || typeof data !== 'object') return false
  const categories = (data as { categories?: unknown }).categories
  if (!categories || typeof categories !== 'object') return false
  return Object.values(categories as Record<string, unknown>).some(value => Array.isArray(value) && value.length > 0)
}

function hasGoalRecordData(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false
  const data = (payload as { data?: unknown }).data
  if (!data || typeof data !== 'object') return false
  const values = Object.values(data as Record<string, unknown>)
  return values.some(value => Array.isArray(value) && value.length > 0)
}

const season = new Date().getFullYear()
const checks: Check[] = [
  { name: 'health', path: '/health', validate: payload => Boolean(payload && typeof payload === 'object' && (payload as { status?: unknown }).status === 'ok') },
  { name: 'rankings', path: '/api/rankings/top10', validate: payload => dataArray(payload).length > 0 },
  { name: 'mvp', path: '/api/mvp?limit=5', validate: payload => dataArray(payload).length > 0 },
  { name: 'goal kickers', path: '/api/goal-kickers?sort=goals&limit=5', validate: payload => dataArray(payload).length > 0 },
  { name: 'goals per game', path: '/api/goal-kickers?sort=gpg&limit=5', validate: payload => dataArray(payload).length > 0 },
  { name: 'weekly records', path: '/api/records?period=week&limit=20', validate: hasRecordData },
  { name: 'season records', path: `/api/records?period=season&season=${season}&limit=20`, validate: hasRecordData },
  { name: 'goal-kicker records', path: '/api/goal-kickers/records?limit=20', validate: hasGoalRecordData },
  { name: 'news', path: '/api/news', validate: payload => dataArray(payload).length > 0 },
  { name: 'featured games', path: '/api/featured-games', validate: hasArrayPayload },
  { name: 'highlights', path: '/api/highlights', validate: hasArrayPayload },
]

const server = app.listen(0, '127.0.0.1')
await new Promise<void>((resolve, reject) => {
  server.once('listening', resolve)
  server.once('error', reject)
})

const address = server.address()
if (!address || typeof address === 'string') throw new Error('Unable to start API verification server')
const baseUrl = `http://127.0.0.1:${address.port}`
const failures: string[] = []

try {
  for (const check of checks) {
    try {
      const response = await fetch(`${baseUrl}${check.path}`, { signal: AbortSignal.timeout(30_000) })
      const text = await response.text()
      let payload: unknown
      try { payload = JSON.parse(text) } catch { payload = null }
      if (!response.ok) {
        failures.push(`${check.name}: HTTP ${response.status} ${text.slice(0, 180)}`)
        continue
      }
      if (!check.validate(payload)) {
        failures.push(`${check.name}: response did not contain required public data`)
        continue
      }
      console.log(`✓ ${check.name}`)
    } catch (error) {
      failures.push(`${check.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
} finally {
  await new Promise<void>(resolve => server.close(() => resolve()))
}

if (failures.length) {
  console.error('\nPublic API data gate failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('\nAll homepage and public API data checks passed.')
process.exit(0)
