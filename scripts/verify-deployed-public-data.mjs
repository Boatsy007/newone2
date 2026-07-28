#!/usr/bin/env node

const baseUrl = String(process.env.BASE_URL || process.argv[2] || '').replace(/\/$/, '')
if (!/^https?:\/\//i.test(baseUrl)) {
  console.error('BASE_URL must be an absolute http(s) URL')
  process.exit(2)
}

const timeoutMs = Number(process.env.API_CHECK_TIMEOUT_MS || 20000)
const retries = Number(process.env.API_CHECK_RETRIES || 3)

const contracts = [
  { name: 'Health', path: '/health', validate: body => body?.status === 'ok' },
  { name: 'National rankings', path: '/api/rankings/top10', validate: body => nonEmptyArray(body?.data) },
  { name: 'MVP leaders', path: '/api/mvp?limit=5', validate: body => nonEmptyArray(body?.data) },
  { name: 'Goal leaders', path: '/api/goal-kickers?sort=goals&limit=5', validate: body => nonEmptyArray(body?.data) },
  { name: 'Goals per game', path: '/api/goal-kickers?sort=gpg&limit=5', validate: body => nonEmptyArray(body?.data) },
  { name: 'Weekly records', path: '/api/records?period=week&limit=5', validate: body => hasUsefulData(body?.data) },
  { name: 'Season records', path: `/api/records?period=season&season=${new Date().getFullYear()}&limit=5`, validate: body => hasUsefulData(body?.data) },
  { name: 'Player records', path: '/api/goal-kickers/records?limit=20', validate: body => hasUsefulData(body?.data) },
  { name: 'Published news', path: '/api/news', validate: body => nonEmptyArray(body?.data) },
  { name: 'Featured games', path: '/api/featured-games', validate: body => validOptionalCollection(body?.data) },
  { name: 'Highlights', path: '/api/highlights', validate: body => validOptionalCollection(body?.data) },
]

function nonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0
}

function hasUsefulData(value) {
  if (Array.isArray(value)) return value.length > 0
  if (!value || typeof value !== 'object') return false
  return Object.values(value).some(item => {
    if (Array.isArray(item)) return item.length > 0
    if (item && typeof item === 'object') return hasUsefulData(item)
    return item !== null && item !== undefined && item !== ''
  })
}

function validOptionalCollection(value) {
  return Array.isArray(value) || (value && typeof value === 'object')
}

async function requestJson(path) {
  let lastError
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { accept: 'application/json', 'user-agent': 'PlayFooty-Release-Contract/1.0' },
        signal: controller.signal,
      })
      const text = await response.text()
      let body
      try { body = JSON.parse(text) } catch { throw new Error(`non-JSON response: ${text.slice(0, 180)}`) }
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${JSON.stringify(body).slice(0, 300)}`)
      return body
    } catch (error) {
      lastError = error
      if (attempt < retries) await new Promise(resolve => setTimeout(resolve, attempt * 1500))
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError
}

const failures = []
for (const contract of contracts) {
  try {
    const body = await requestJson(contract.path)
    if (!contract.validate(body)) throw new Error(`response did not contain the required website data: ${JSON.stringify(body).slice(0, 400)}`)
    console.log(`PASS  ${contract.name.padEnd(20)} ${contract.path}`)
  } catch (error) {
    failures.push({ ...contract, error: error instanceof Error ? error.message : String(error) })
    console.error(`FAIL  ${contract.name.padEnd(20)} ${contract.path}`)
    console.error(`      ${failures.at(-1).error}`)
  }
}

if (failures.length) {
  console.error(`\nPublic data contract failed for ${failures.length} endpoint(s). Deployment must not be promoted.`)
  process.exit(1)
}

console.log(`\nAll ${contracts.length} public data contracts passed for ${baseUrl}.`)
