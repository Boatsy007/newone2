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
  assertContainsAll(value, ['authenticateClubUser', 'requireActiveClubMembership', 'requireOwner'], 'club user routes')
  assert.match(value, /role\s*!==\s*['"]OWNER['"]|role===['"]OWNER['"]/)
  assert.match(value, /final Owner|at least one active Owner/i)
  assert.match(value, /cannot remove or suspend your own/i)
})

test('league user management remains owner-only and membership protected', async () => {
  const value = await source('../api/routes/league-portal-users.ts')
  assertContainsAll(value, ['authenticateLeagueUser', 'requireActiveLeagueMembership', 'requireOwner'], 'league user routes')
  assert.match(value, /role!=='OWNER'|role\s*!==\s*['"]OWNER['"]/)
  assert.match(value, /at least one active Owner/i)
  assert.match(value, /cannot remove or suspend your own/i)
})

test('club content routes enforce active membership and role permissions', async () => {
  const [news, sponsors, teamSheets] = await Promise.all([
    source('../api/routes/club-portal-news.ts'),
    source('../api/routes/club-portal-sponsors.ts'),
    source('../api/routes/club-portal-team-sheets.ts'),
  ])
  assertContainsAll(news, ['authenticateClubUser', 'requireActiveClubMembership', "roleCan(membership.role,'media')"], 'club news routes')
  assertContainsAll(sponsors, ['authenticateClubUser', 'requireActiveClubMembership', "roleCan(membership.role,'sponsors')"], 'club sponsor routes')
  assertContainsAll(teamSheets, ['authenticateClubUser', 'requireActiveClubMembership', "roleCan(membership.role, 'team_selection')"], 'club team-sheet routes')
})

test('league content routes enforce active membership and role permissions', async () => {
  const [news, sponsors, media, profile] = await Promise.all([
    source('../api/routes/league-portal-news.ts'),
    source('../api/routes/league-portal-sponsors.ts'),
    source('../api/routes/league-portal-media.ts'),
    source('../api/routes/league-portal.ts'),
  ])
  assertContainsAll(news, ['authenticateLeagueUser', 'requireActiveLeagueMembership', "roleCanManageLeagueAction(membership.role,'media')"], 'league news routes')
  assertContainsAll(sponsors, ['authenticateLeagueUser', 'requireActiveLeagueMembership', "roleCanManageLeagueAction(membership.role,'sponsors')"], 'league sponsor routes')
  assertContainsAll(media, ['authenticateLeagueUser', 'requireActiveLeagueMembership', 'roleCanManageLeagueAction'], 'league media routes')
  assertContainsAll(profile, ['authenticateLeagueUser', 'requireActiveLeagueMembership', "roleCanManageLeagueAction(membership.role, 'profile')"], 'league profile routes')
})

test('destructive portal actions keep explicit confirmation and draft or editable-state checks', async () => {
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
