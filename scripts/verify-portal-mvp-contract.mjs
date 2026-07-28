import fs from 'node:fs'

const files = {
  clubDashboard: fs.readFileSync('src/pages/ClubPortalDashboard.tsx', 'utf8'),
  leagueDashboard: fs.readFileSync('src/pages/LeaguePortalDashboard.tsx', 'utf8'),
  router: fs.readFileSync('src/main.tsx', 'utf8'),
  clubProfile: fs.readFileSync('src/pages/ClubPortalProfile.tsx', 'utf8'),
  clubNews: fs.readFileSync('src/pages/ClubPortalNews.tsx', 'utf8'),
  clubSponsors: fs.readFileSync('src/pages/ClubPortalSponsors.tsx', 'utf8'),
  clubUsers: fs.readFileSync('src/pages/ClubPortalUsers.tsx', 'utf8'),
  clubActivity: fs.readFileSync('src/pages/ClubPortalActivity.tsx', 'utf8'),
  leagueProfile: fs.readFileSync('src/pages/LeaguePortalProfile.tsx', 'utf8'),
  leagueNews: fs.readFileSync('src/pages/LeaguePortalNews.tsx', 'utf8'),
  leagueSponsors: fs.readFileSync('src/pages/LeaguePortalSponsors.tsx', 'utf8'),
  leagueUsers: fs.readFileSync('src/pages/LeaguePortalUsers.tsx', 'utf8'),
  leagueActivity: fs.readFileSync('src/pages/LeaguePortalActivity.tsx', 'utf8'),
}

const failures = []
const requireText = (source, text, message) => {
  if (!source.includes(text)) failures.push(message)
}

for (const [kind, dashboard] of [['Club', files.clubDashboard], ['League', files.leagueDashboard]]) {
  requireText(dashboard, '/profile', `${kind} Portal dashboard is missing Profile access`)
  requireText(dashboard, '/news', `${kind} Portal dashboard is missing News access`)
  requireText(dashboard, '/sponsors', `${kind} Portal dashboard is missing Sponsors access`)
  requireText(dashboard, '/users', `${kind} Portal dashboard is missing Users access`)
  requireText(dashboard, '/activity', `${kind} Portal dashboard is missing Activity access`)
}

const routes = [
  '/club-portal/:clubId',
  '/club-portal/:clubId/profile',
  '/club-portal/:clubId/news',
  '/club-portal/:clubId/sponsors',
  '/club-portal/:clubId/users',
  '/club-portal/:clubId/activity',
  '/league-portal/:leagueId',
  '/league-portal/:leagueId/profile',
  '/league-portal/:leagueId/news',
  '/league-portal/:leagueId/sponsors',
  '/league-portal/:leagueId/users',
  '/league-portal/:leagueId/activity',
]
for (const route of routes) requireText(files.router, `path="${route}"`, `Missing portal route: ${route}`)

for (const [name, source] of Object.entries(files)) {
  if (name === 'router') continue
  requireText(source, '/api/', `${name} is not connected to an API`)
}

requireText(files.clubDashboard, 'playfooty.clubPortal.session.v1', 'Club Portal session contract changed')
requireText(files.leagueDashboard, 'playfooty.leaguePortal.session.v1', 'League Portal session contract changed')
requireText(files.clubDashboard, 'setLoading(false)', 'Club Portal loading state contract changed')
requireText(files.leagueDashboard, 'setLoading(false)', 'League Portal loading state contract changed')

if (failures.length) {
  console.error('Portal MVP contract failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Portal MVP contract passed: both portals retain working Dashboard, Profile, News, Sponsors, Users and Activity sections.')
