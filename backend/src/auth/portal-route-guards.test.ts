import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function source(relativePath: string) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8')
}

function assertContainsAll(value: string, fragments: string[], label: string) {
  for (const fragment of fragments) assert.ok(value.includes(fragment), `${label} must include ${fragment}`)
}

test('club user management remains owner-only and membership protected', async () => {
  const value = await source('../api/routes/club-portal-users.ts')
  assertContainsAll(value, ['authenticateClubUser', 'requireActiveClubMembership', 'requireOwner', "roleCan(membership.role, 'manage_users')"], 'club user routes')
  assert.match(value, /at least one active Owner/i)
  assert.match(value, /cannot remove or suspend your own/i)
})

test('league user management remains owner-only and membership protected', async () => {
  const value = await source('../api/routes/league-portal-users.ts')
  assertContainsAll(value, ['authenticateLeagueUser', 'requireActiveLeagueMembership', 'requireOwner'], 'league user routes')
  assert.match(value, /role\s*!==\s*['"]OWNER['"]|role!=='OWNER'/)
  assert.match(value, /at least one active Owner/i)
  assert.match(value, /cannot remove or suspend your own/i)
})

test('club content routes enforce active membership and role permissions', async () => {
  const [news, sponsors, teamSheets] = await Promise.all([
    source('../api/routes/club-portal-news.ts'),
    source('../api/routes/club-portal-sponsors.ts'),
    source('../api/routes/club-portal-team-sheets.ts'),
  ])
  assertContainsAll(news, ['authenticateClubUser', 'requireActiveClubMembership', 'roleCan'], 'club news routes')
  assert.match(news, /roleCan\([^)]*['"]media['"]\)/)
  assertContainsAll(sponsors, ['authenticateClubUser', 'requireActiveClubMembership', 'roleCan'], 'club sponsor routes')
  assert.match(sponsors, /roleCan\([^)]*['"]sponsors['"]\)/)
  assertContainsAll(teamSheets, ['authenticateClubUser', 'requireActiveClubMembership', 'roleCan'], 'club team-sheet routes')
  assert.match(teamSheets, /roleCan\([^)]*['"]team_selection['"]\)/)
})

test('league content routes enforce active membership and role permissions', async () => {
  const [news, sponsors, media, profile] = await Promise.all([
    source('../api/routes/league-portal-news.ts'),
    source('../api/routes/league-portal-sponsors.ts'),
    source('../api/routes/league-portal-media.ts'),
    source('../api/routes/league-portal.ts'),
  ])
  for (const [label, value] of [['league news routes', news], ['league sponsor routes', sponsors], ['league media routes', media]] as const) {
    assertContainsAll(value, ['authenticateLeagueUser', 'requireActiveLeagueMembership', 'roleCanManageLeagueAction'], label)
  }
  assert.match(news, /roleCanManageLeagueAction\([^)]*['"]media['"]\)/)
  assert.match(sponsors, /roleCanManageLeagueAction\([^)]*['"]sponsors['"]\)/)
  assertContainsAll(profile, ['authenticateLeagueUser', 'requireActiveLeagueMembership', 'roleCanManageLeagueAction'], 'league profile routes')
  assert.match(profile, /roleCanManageLeagueAction\([^)]*['"]profile['"]\)/)
})

test('destructive portal actions retain editable-state protections', async () => {
  const [clubNews, leagueNews, clubSponsors, leagueSponsors, teamSheets] = await Promise.all([
    source('../api/routes/club-portal-news.ts'),
    source('../api/routes/league-portal-news.ts'),
    source('../api/routes/club-portal-sponsors.ts'),
    source('../api/routes/league-portal-sponsors.ts'),
    source('../api/routes/club-portal-team-sheets.ts'),
  ])
  assert.match(clubNews, /DRAFT|editable/i)
  assert.match(leagueNews, /DRAFT|editable/i)
  assert.match(clubSponsors, /EDITABLE_STATUSES/)
  assert.match(leagueSponsors, /EDITABLE/)
  assert.match(teamSheets, /Only draft team sheets can be deleted/i)
})
