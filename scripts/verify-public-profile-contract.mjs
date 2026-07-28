import { readFile } from 'node:fs/promises'

const files = {
  club: await readFile(new URL('../src/pages/TeamProfile.tsx', import.meta.url), 'utf8'),
  league: await readFile(new URL('../src/pages/LeagueProfile.tsx', import.meta.url), 'utf8'),
  player: await readFile(new URL('../src/pages/PlayerProfile.tsx', import.meta.url), 'utf8'),
  playerCompleteness: await readFile(new URL('../src/components/players/PlayerProfileCompleteness.tsx', import.meta.url), 'utf8'),
}

const checks = [
  ['club canonical profile route', files.club.includes('fetchClub(clubId)')],
  ['club live results and fixtures hub', files.club.includes('<ClubLiveHub club={data} />')],
  ['club ladder', files.club.includes('<ClubLadder club={data} />')],
  ['club goal kickers', files.club.includes('<PublicGoalKickersPanel')],
  ['club news', files.club.includes('<ClubNews club={data} />')],
  ['club sponsors', files.club.includes('<ClubSponsorsLive club={data} />')],
  ['club information', files.club.includes('<ClubInformationPanel club={data} />')],
  ['league canonical profile route', files.league.includes('fetchLeague(leagueId)')],
  ['league live data', files.league.includes('<LeagueLiveData league={data} />')],
  ['league ladder', files.league.includes('<LeagueLadder league={data}')],
  ['league club rankings', files.league.includes('<ClubRankingCards league={data}')],
  ['league MVP', files.league.includes('<LeagueMvpPanel')],
  ['league news', files.league.includes('<LeagueNews leagueName={data.name} />')],
  ['player canonical goal profile', files.player.includes('/api/goal-kickers/player/${encoded}')],
  ['player saved details', files.player.includes('/api/players/${encoded}/details')],
  ['player current statistics', files.player.includes('Player statistics')],
  ['player goal history', files.player.includes('Goal history')],
  ['player imported seasons', files.player.includes('Imported seasons')],
  ['player records', files.player.includes('Individual honours')],
  ['player identity image fallback', files.playerCompleteness.includes('pf-player-identity-media')],
  ['player linked news', files.playerCompleteness.includes('/api/news?playerId=')],
]

const failed = checks.filter(([, passed]) => !passed)
for (const [name, passed] of checks) console.log(`${passed ? '✓' : '✗'} ${name}`)
if (failed.length) {
  console.error(`\nPublic profile contract failed: ${failed.map(([name]) => name).join(', ')}`)
  process.exit(1)
}
console.log('\nClub, League and Player MVP profile contracts are complete.')
