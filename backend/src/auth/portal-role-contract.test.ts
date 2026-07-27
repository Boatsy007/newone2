import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CLUB_PORTAL_ACTIONS,
  CLUB_PORTAL_ROLES,
  LEAGUE_PORTAL_ACTIONS,
  LEAGUE_PORTAL_ROLES,
  clubPermissionSnapshot,
  clubRoleCan,
  leaguePermissionSnapshot,
  leagueRoleCan,
} from './portal-role-contract.js'

test('club portal roles expose only their intended actions', () => {
  assert.deepEqual(clubPermissionSnapshot('OWNER'), {
    manage_users: true, team_selection: true, media: true, sponsors: true, profile: true, view: true,
  })
  assert.deepEqual(clubPermissionSnapshot('ADMIN'), {
    manage_users: false, team_selection: true, media: true, sponsors: true, profile: true, view: true,
  })
  assert.deepEqual(clubPermissionSnapshot('TEAM_MANAGER'), {
    manage_users: false, team_selection: true, media: false, sponsors: false, profile: false, view: true,
  })
  assert.deepEqual(clubPermissionSnapshot('MEDIA_MANAGER'), {
    manage_users: false, team_selection: false, media: true, sponsors: false, profile: false, view: true,
  })
  assert.deepEqual(clubPermissionSnapshot('SPONSOR_MANAGER'), {
    manage_users: false, team_selection: false, media: false, sponsors: true, profile: false, view: true,
  })
  assert.deepEqual(clubPermissionSnapshot('VIEWER'), {
    manage_users: false, team_selection: false, media: false, sponsors: false, profile: false, view: true,
  })
})

test('league portal roles expose only their intended actions', () => {
  assert.deepEqual(leaguePermissionSnapshot('OWNER'), {
    manage_users: true, competition_data: true, media: true, sponsors: true, profile: true, view: true,
  })
  assert.deepEqual(leaguePermissionSnapshot('ADMIN'), {
    manage_users: false, competition_data: true, media: true, sponsors: true, profile: true, view: true,
  })
  assert.deepEqual(leaguePermissionSnapshot('DATA_MANAGER'), {
    manage_users: false, competition_data: true, media: false, sponsors: false, profile: false, view: true,
  })
  assert.deepEqual(leaguePermissionSnapshot('MEDIA_MANAGER'), {
    manage_users: false, competition_data: false, media: true, sponsors: false, profile: true, view: true,
  })
  assert.deepEqual(leaguePermissionSnapshot('SPONSOR_MANAGER'), {
    manage_users: false, competition_data: false, media: false, sponsors: true, profile: false, view: true,
  })
  assert.deepEqual(leaguePermissionSnapshot('VIEWER'), {
    manage_users: false, competition_data: false, media: false, sponsors: false, profile: false, view: true,
  })
})

test('all declared roles and actions are represented by the contract', () => {
  for (const role of CLUB_PORTAL_ROLES) for (const action of CLUB_PORTAL_ACTIONS) assert.equal(typeof clubRoleCan(role, action), 'boolean')
  for (const role of LEAGUE_PORTAL_ROLES) for (const action of LEAGUE_PORTAL_ACTIONS) assert.equal(typeof leagueRoleCan(role, action), 'boolean')
})

test('unknown role values fail closed at runtime', () => {
  assert.equal(clubRoleCan('UNKNOWN' as never, 'view'), false)
  assert.equal(leagueRoleCan('UNKNOWN' as never, 'view'), false)
})
