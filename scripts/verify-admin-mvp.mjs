import fs from 'node:fs'

const menu = fs.readFileSync('src/components/admin/AdminOperationsMenu.tsx', 'utf8')
const routes = fs.readFileSync('src/main.tsx', 'utf8')

const requiredMenuLabels = [
  'Club Access & Invites',
  'League Access & Invites',
  'Universal Import',
  'Ladder Images',
  'Results & Fixtures',
  'Goal Kickers',
  'MVP',
  'Profile Images',
  'Launch Readiness',
  'System Health',
  'Repair Queue',
  'League Coverage',
  'Highlights',
  'Featured Games',
  'Recalculate Rankings',
]

const requiredRoutes = [
  '/admin',
  '/admin/claims',
  '/admin/league-access',
  '/admin/universal-imports',
  '/admin/ladder-images',
  '/admin/match-images',
  '/admin/goal-kicker-images',
  '/admin/mvp-images',
  '/admin/profile-images',
  '/admin/launch-readiness',
  '/admin/health',
  '/admin/maintenance-queue',
  '/admin/league-coverage',
  '/admin/highlights',
  '/admin/featured-games',
]

const failures = []
for (const label of requiredMenuLabels) {
  if (!menu.includes(label)) failures.push(`Admin MVP menu is missing: ${label}`)
}
for (const route of requiredRoutes) {
  if (!routes.includes(`path="${route}"`)) failures.push(`Admin MVP route is missing: ${route}`)
}
if (!menu.includes("pathname !== '/admin'")) failures.push('Admin operations menu is not isolated to /admin')
if (!menu.includes("fetch('/admin/platform/recalculate'")) failures.push('Ranking recalculation action is missing')

if (failures.length) {
  console.error('Admin MVP contract failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Admin MVP contract passed: imports, management, access, health and repair tools are connected.')
