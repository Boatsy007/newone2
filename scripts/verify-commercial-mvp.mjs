import fs from 'node:fs'

const files = {
  sponsorAdmin: fs.readFileSync('src/lib/sponsorAdmin.ts', 'utf8'),
  adminManager: fs.readFileSync('src/components/admin/AdminSponsorManager.tsx', 'utf8'),
  playerAdmin: fs.readFileSync('src/pages/AdminPlayerSponsors.tsx', 'utf8'),
  clubSponsors: fs.readFileSync('src/components/club/ClubSponsorsLive.tsx', 'utf8'),
  leagueSponsors: fs.readFileSync('src/components/sponsors/SponsorProfilePortal.tsx', 'utf8'),
  homeSponsors: fs.readFileSync('src/components/sponsors/HomeSponsorLabels.tsx', 'utf8'),
  routes: fs.readFileSync('src/main.tsx', 'utf8'),
}

const failures = []
const requireText = (source, text, message) => { if (!source.includes(text)) failures.push(message) }

requireText(files.sponsorAdmin, "'/api/commercial/sponsorships'", 'canonical sponsorship creation API is missing')
requireText(files.sponsorAdmin, "'/api/sponsors'", 'canonical sponsor management API is missing')
requireText(files.sponsorAdmin, "bannerPosition", 'sponsorship placement support is missing')
requireText(files.sponsorAdmin, "displayPriority", 'sponsorship priority support is missing')
requireText(files.sponsorAdmin, "startDate", 'sponsorship start-date support is missing')
requireText(files.sponsorAdmin, "endDate", 'sponsorship end-date support is missing')

requireText(files.adminManager, "scope: target.kind.toUpperCase()", 'club and league sponsorship assignment is missing')
requireText(files.adminManager, "target.kind === 'club'", 'club sponsorship management is missing')
requireText(files.adminManager, "leagueId: target.id", 'league sponsorship management is missing')
requireText(files.clubSponsors, 'SponsorShowcase', 'club sponsor public display is missing')
requireText(files.leagueSponsors, 'scope="league"', 'league sponsor public display is missing')

requireText(files.playerAdmin, "scope: 'PLAYER'", 'player sponsorship scope is missing')
requireText(files.playerAdmin, "package: 'PLAYER_PARTNER'", 'goal-kicker/player partner product is missing')
requireText(files.playerAdmin, '/api/players/${encodeURIComponent(playerId)}/sponsors', 'player sponsor retrieval is missing')
requireText(files.routes, '/admin/player-sponsors/:playerId', 'player sponsor admin route is missing')

requireText(files.homeSponsors, "pathname !== '/'", 'homepage sponsorship display is not limited to the homepage')
requireText(files.homeSponsors, "'.pf-goal-row'", 'goal-kicker sponsorship placement is missing')
requireText(files.homeSponsors, "'.pf-club-card:not(.loading)'", 'homepage club sponsorship placement is missing')
requireText(files.homeSponsors, "'/api/${kind === 'club' ? 'clubs' : 'players'}/${encodeURIComponent(id)}/sponsors'", 'homepage sponsor API connection is missing')
requireText(files.homeSponsors, 'ACTIVE_STATUSES', 'active sponsorship filtering is missing')

if (failures.length) {
  console.error('Commercial MVP contract failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Commercial MVP contract passed: club, league, homepage and goal-kicker sponsorship products remain connected.')
