import fs from 'node:fs'

const main = fs.readFileSync('src/main.tsx', 'utf8')
const feed = fs.readFileSync('src/pages/SupporterFeed.tsx', 'utf8')
const supporter = fs.readFileSync('src/lib/supporter.ts', 'utf8')
const followButton = fs.readFileSync('src/components/supporter/FollowButton.tsx', 'utf8')
const followDock = fs.readFileSync('src/components/supporter/ProfileFollowDock.tsx', 'utf8')
const mount = fs.readFileSync('src/components/sharing/ProfileShareButton.tsx', 'utf8')

const failures = []

if (!main.includes('<Route path="/feed" element={<SupporterFeed/>}/>')) failures.push('supporter feed route is missing')
for (const entity of ['CLUB', 'LEAGUE', 'PLAYER']) {
  if (!supporter.includes(`'${entity}'`)) failures.push(`${entity} follow entity is missing`)
  if (!followDock.includes(`entityType: '${entity}'`)) failures.push(`${entity} profile follow route is missing`)
}
for (const filter of ['All updates', 'Clubs', 'Leagues', 'Players']) {
  if (!feed.includes(filter)) failures.push(`${filter} feed filter is missing`)
}
for (const endpoint of ['/api/follows?', "fetch('/api/follows'", '/api/follows/feed?']) {
  if (!supporter.includes(endpoint)) failures.push(`supporter API connection missing: ${endpoint}`)
}
if (!followButton.includes('setFollow(entityType, entityId')) failures.push('follow toggle is not connected')
if (!followDock.includes('<Link to="/feed">My feed</Link>')) failures.push('profile follow control does not link to the supporter feed')
if (!mount.includes('<ProfileFollowDock />')) failures.push('profile follow dock is not mounted')
if (!feed.includes('loadFeed()') || !feed.includes('listFollows()')) failures.push('feed does not load follows and updates together')
if (!feed.includes('playfooty:follows-changed')) failures.push('feed does not refresh when follows change')

if (failures.length) {
  console.error('Supporter MVP contract failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Supporter MVP contract passed: club, league and player follows are connected to the personalised feed.')
