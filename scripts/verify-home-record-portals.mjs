import { readFile } from 'node:fs/promises'

const [main, records, players] = await Promise.all([
  readFile(new URL('../src/main.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/home/HomeRecordsPortal.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/home/HomePlayerRecordsPortal.tsx', import.meta.url), 'utf8'),
])

const checks = [
  [main.includes('<HomeRecordsPortal/>'), 'HomeRecordsPortal must remain mounted'],
  [main.includes('<HomePlayerRecordsPortal/>'), 'HomePlayerRecordsPortal must remain mounted'],
  [records.includes('Promise.allSettled'), 'football records must use failure-isolated loading'],
  [records.includes('This Week in Footy'), 'weekly homepage records heading is missing'],
  [records.includes('Yearly records'), 'yearly homepage records heading is missing'],
  [records.includes("fetchFootballRecords({ period: 'week'"), 'weekly records API request is missing'],
  [records.includes("fetchFootballRecords({ period: 'season'"), 'yearly records API request is missing'],
  [players.includes('/api/goal-kickers/records'), 'goal-kicker records request is missing'],
  [records.includes('.pf-data-grid>.pf-list-card:first-child{display:none!important}'), 'legacy goal-leader fallback is no longer suppressed when records render'],
]

const failures = checks.filter(([passed]) => !passed).map(([, message]) => message)
if (failures.length) {
  console.error(`Homepage records verification failed:\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

console.log('Homepage record portals verified')
