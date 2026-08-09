import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, membershipsForUser } from '../../auth/club-auth.js'
import { allowedClubAreas, defaultPermissionPage, effectiveClubPermissions } from '../../auth/club-permissions.js'
import { publicRateLimit } from '../middleware/rate-limit.js'

const router = Router()

type Fixture = {
  id:string; leagueId:string; season:string; grade:string; round:string|null
  homeClubId:string|null; awayClubId:string|null; homeName:string; awayName:string
  matchDate:Date|null; venue:string|null
}

type Sheet = {
  id:string; clubId:string; fixtureId:string|null; season:string; grade:string
  roundLabel:string; opponentName:string|null; matchDate:string|null; status:string
  playerCount:number
}

let ready: Promise<void> | null = null
async function ensureCoachAppColumns() {
  if (!ready) ready = (async () => {
    await prisma.$executeRawUnsafe(`ALTER TABLE football_team_sheets ADD COLUMN IF NOT EXISTS fixture_id text NULL`)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS football_team_sheets_fixture_identity ON football_team_sheets (club_id, fixture_id) WHERE fixture_id IS NOT NULL`)
  })().catch(error => { ready = null; throw error })
  return ready
}

function normalise(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/^round\s+/,'').replace(/[^a-z0-9]+/g,' ')
}

function dateKey(value: unknown) {
  if (!value) return ''
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0,10)
}

async function resolveCanonicalClub(club: { id:string; name:string; logoUrl:string|null; primaryColour:string|null; secondaryColour:string|null }, team: { leagueId:string; season:string; grade:string } | null) {
  if (!team) return club
  const directFixture = await prisma.footballFixture.findFirst({
    where: { leagueId:team.leagueId, season:team.season, grade:team.grade, OR:[{homeClubId:club.id},{awayClubId:club.id}] },
    select: { id:true },
  })
  if (directFixture) return club

  const fixtures = await prisma.footballFixture.findMany({
    where: { leagueId:team.leagueId, season:team.season, grade:team.grade },
    select: { homeClubId:true, awayClubId:true, homeName:true, awayName:true },
    orderBy: [{ matchDate:'desc' }, { round:'desc' }],
    take: 80,
  })
  const expected = normalise(club.name)
  const fixture = fixtures.find(item => normalise(item.homeName) === expected || normalise(item.awayName) === expected)
  const canonicalId = fixture ? (normalise(fixture.homeName) === expected ? fixture.homeClubId : fixture.awayClubId) : null
  if (!canonicalId || canonicalId === club.id) return club
  const canonical = await prisma.club.findUnique({ where:{ id:canonicalId }, select:{ id:true,name:true,logoUrl:true,primaryColour:true,secondaryColour:true } })
  return canonical ?? club
}

async function reconcileExistingAliasSheet(club: { id:string; name:string }, team: { leagueId:string; season:string; grade:string } | null) {
  if (!team) return false
  const candidates = await prisma.club.findMany({
    where: {
      id: { not: club.id },
      name: { equals: club.name, mode: 'insensitive' },
      leagueSeasons: { some: { leagueId:team.leagueId, season:team.season, grade:team.grade, isActive:true } },
    },
    select: { id:true },
  })
  if (!candidates.length) return false
  const sourceIds = candidates.map(item => item.id)
  const sourceSheets = await prisma.$queryRawUnsafe<Array<{clubId:string}>>(`
    SELECT club_id AS "clubId" FROM football_team_sheets
    WHERE club_id = ANY($1::text[]) AND season=$2 AND (league_id=$3 OR league_id IS NULL)
    ORDER BY updated_at DESC LIMIT 1
  `, sourceIds, team.season, team.leagueId)
  const sourceClubId = sourceSheets[0]?.clubId
  if (!sourceClubId) return false

  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe(`
      INSERT INTO football_club_players (club_id,player_id,player_name,jumper_number,preferred_position,active,created_at,updated_at)
      SELECT $1,player_id,player_name,jumper_number,preferred_position,active,created_at,NOW()
      FROM football_club_players WHERE club_id=$2
      ON CONFLICT (club_id,lower(player_name)) DO UPDATE SET
        player_id=COALESCE(EXCLUDED.player_id,football_club_players.player_id),
        jumper_number=COALESCE(EXCLUDED.jumper_number,football_club_players.jumper_number),
        preferred_position=COALESCE(EXCLUDED.preferred_position,football_club_players.preferred_position),
        active=EXCLUDED.active,updated_at=NOW()
    `, club.id, sourceClubId)
    await tx.$executeRawUnsafe(`
      INSERT INTO football_team_sheets (club_id,league_id,season,grade,round_label,opponent_name,match_date,status,published_at,fixture_id,created_at,updated_at)
      SELECT $1,league_id,season,grade,round_label,opponent_name,match_date,status,published_at,fixture_id,created_at,NOW()
      FROM football_team_sheets
      WHERE club_id=$2 AND season=$3 AND (league_id=$4 OR league_id IS NULL)
      ON CONFLICT (club_id,season,grade,round_label) DO UPDATE SET
        league_id=COALESCE(EXCLUDED.league_id,football_team_sheets.league_id),
        opponent_name=COALESCE(EXCLUDED.opponent_name,football_team_sheets.opponent_name),
        match_date=COALESCE(EXCLUDED.match_date,football_team_sheets.match_date),
        status=EXCLUDED.status,published_at=EXCLUDED.published_at,updated_at=NOW()
    `, club.id, sourceClubId, team.season, team.leagueId)
    await tx.$executeRawUnsafe(`
      INSERT INTO football_team_sheet_players (team_sheet_id,club_player_id,position_code)
      SELECT target_sheet.id,target_player.id,source_position.position_code
      FROM football_team_sheets source_sheet
      JOIN football_team_sheets target_sheet ON target_sheet.club_id=$1 AND target_sheet.season=source_sheet.season AND target_sheet.grade=source_sheet.grade AND target_sheet.round_label=source_sheet.round_label
      JOIN football_team_sheet_players source_position ON source_position.team_sheet_id=source_sheet.id
      JOIN football_club_players source_player ON source_player.id=source_position.club_player_id
      JOIN football_club_players target_player ON target_player.club_id=$1 AND lower(target_player.player_name)=lower(source_player.player_name)
      WHERE source_sheet.club_id=$2 AND source_sheet.season=$3 AND (source_sheet.league_id=$4 OR source_sheet.league_id IS NULL)
      ON CONFLICT DO NOTHING
    `, club.id, sourceClubId, team.season, team.leagueId)
  })
  return true
}

async function loadFixture(fixtureId: string, clubId: string): Promise<Fixture | null> {
  return prisma.footballFixture.findFirst({
    where:{ id:fixtureId,OR:[{ homeClubId:clubId },{ awayClubId:clubId }] },
    select:{ id:true,leagueId:true,season:true,grade:true,round:true,homeClubId:true,awayClubId:true,homeName:true,awayName:true,matchDate:true,venue:true },
  })
}

async function loadActiveFixture(clubId: string, season: string | null, grade: string | null): Promise<Fixture | null> {
  const fixtures = await prisma.footballFixture.findMany({
    where:{
      OR:[{ homeClubId:clubId },{ awayClubId:clubId }],
      ...(season ? { season } : {}),
      ...(grade ? { grade } : {}),
      // Keep today's match active through match day, then roll automatically to the next dated fixture.
      AND:[{ OR:[{ matchDate:{ gte:new Date(Date.now()-18*60*60*1000) } },{ matchDate:null }] }],
    },
    select:{ id:true,leagueId:true,season:true,grade:true,round:true,homeClubId:true,awayClubId:true,homeName:true,awayName:true,matchDate:true,venue:true },
    orderBy:[{ matchDate:'asc' },{ round:'asc' }],
    take:25,
  })
  return fixtures.sort((a,b)=>(a.matchDate?.getTime()??Number.MAX_SAFE_INTEGER)-(b.matchDate?.getTime()??Number.MAX_SAFE_INTEGER))[0] ?? null
}

async function loadSheetForFixture(clubId: string, fixture: Fixture | null) {
  if (!fixture) return null
  const linked = await prisma.$queryRawUnsafe<Sheet[]>(`
    SELECT s.id::text AS id,s.club_id AS "clubId",s.fixture_id AS "fixtureId",s.season,s.grade,
      s.round_label AS "roundLabel",s.opponent_name AS "opponentName",s.match_date AS "matchDate",s.status,
      COUNT(tsp.id)::int AS "playerCount"
    FROM football_team_sheets s
    LEFT JOIN football_team_sheet_players tsp ON tsp.team_sheet_id=s.id
    WHERE s.club_id=$1 AND s.fixture_id=$2
    GROUP BY s.id
    LIMIT 1
  `, clubId, fixture.id)
  if (linked[0]) return linked[0]

  const isHome = fixture.homeClubId === clubId
  const opponent = isHome ? fixture.awayName : fixture.homeName
  const candidates = await prisma.$queryRawUnsafe<Sheet[]>(`
    SELECT s.id::text AS id,s.club_id AS "clubId",s.fixture_id AS "fixtureId",s.season,s.grade,
      s.round_label AS "roundLabel",s.opponent_name AS "opponentName",s.match_date AS "matchDate",s.status,
      COUNT(tsp.id)::int AS "playerCount"
    FROM football_team_sheets s
    LEFT JOIN football_team_sheet_players tsp ON tsp.team_sheet_id=s.id
    WHERE s.club_id=$1 AND s.season=$2 AND s.grade=$3
    GROUP BY s.id
    ORDER BY s.updated_at DESC
  `, clubId, fixture.season, fixture.grade)
  const matched = candidates.find(sheet => {
    const sameRound = normalise(sheet.roundLabel) === normalise(fixture.round)
    const sameOpponent = normalise(sheet.opponentName) === normalise(opponent)
    const sameDate = dateKey(sheet.matchDate) === dateKey(fixture.matchDate)
    return (sameRound && sameOpponent) || (sameDate && sameOpponent) || (sameRound && sameDate)
  })
  if (matched) return matched

  // Admin-created sheets may pre-date fixture linking or use a different grade label.
  // Fall back only to the most recently edited unlinked sheet for this same club, league and season.
  const fallback = await prisma.$queryRawUnsafe<Sheet[]>(`
    SELECT s.id::text AS id,s.club_id AS "clubId",s.fixture_id AS "fixtureId",s.season,s.grade,
      s.round_label AS "roundLabel",s.opponent_name AS "opponentName",s.match_date AS "matchDate",s.status,
      COUNT(tsp.id)::int AS "playerCount"
    FROM football_team_sheets s
    LEFT JOIN football_team_sheet_players tsp ON tsp.team_sheet_id=s.id
    WHERE s.club_id=$1 AND s.season=$2
    GROUP BY s.id
    ORDER BY (s.fixture_id=$5) DESC,(s.league_id=$3) DESC,(s.grade=$4) DESC,s.updated_at DESC
    LIMIT 1
  `, clubId, fixture.season, fixture.leagueId, fixture.grade, fixture.id)
  return fallback[0] ?? null
}

router.use(publicRateLimit)
router.use(authenticateClubUser)

router.get('/context', async (req, res) => {
  try {
    await ensureCoachAppColumns()
    const memberships = (await membershipsForUser(req.clubUser!.id)).filter(item => item.status === 'ACTIVE' && effectiveClubPermissions(item).length > 0)
    if (!memberships.length) return res.status(403).json({ error: 'This account does not have active app permissions' })

    const requestedClubId = typeof req.query.clubId === 'string' ? req.query.clubId.trim() : ''
    let membership = requestedClubId ? memberships.find(item => item.clubId === requestedClubId) : memberships[0]
    if (requestedClubId && !membership) return res.status(403).json({ error: 'You are not authorised to manage this club' })

    if (!requestedClubId && memberships.length > 1) {
      const clubIds = memberships.map(item => item.clubId)
      const clubs = await prisma.club.findMany({
        where:{ id:{ in:clubIds } },
        select:{ id:true,name:true,logoUrl:true },
        orderBy:{ name:'asc' },
      })
      return res.status(409).json({
        error:'Choose the club you want to open',
        code:'CLUB_SELECTION_REQUIRED',
        data:{ clubs:clubs.map(club => ({ ...club, role:memberships.find(item => item.clubId === club.id)?.role ?? 'TEAM_MANAGER' })) },
      })
    }

    membership = membership ?? memberships[0]
    const authorisedClub = await prisma.club.findUnique({ where:{ id:membership.clubId }, select:{ id:true,name:true,logoUrl:true,primaryColour:true,secondaryColour:true } })
    if (!authorisedClub) return res.status(404).json({ error: 'Authorised club not found' })
    const team = await prisma.clubLeagueSeason.findFirst({
      where:{ clubId:authorisedClub.id,isActive:true,league:{ sport:'FOOTBALL',archivedAt:null,isActive:true } },
      orderBy:{ season:'desc' },
      select:{ leagueId:true,season:true,grade:true,league:{ select:{ name:true } } },
    })
    const club = await resolveCanonicalClub(authorisedClub, team)

    const overrideId = typeof req.query.fixtureId === 'string' ? req.query.fixtureId.trim() : ''
    if (overrideId && membership.role !== 'OWNER' && membership.role !== 'ADMIN') return res.status(403).json({ error: 'Only a club administrator can override the active fixture' })
    const fixture = overrideId
      ? await loadFixture(overrideId, club.id)
      : await loadActiveFixture(club.id, team?.season ?? null, team?.grade ?? null)
    if (overrideId && !fixture) return res.status(404).json({ error: 'The selected fixture does not belong to this club' })

    let sheet = await loadSheetForFixture(club.id, fixture)
    if (!sheet && await reconcileExistingAliasSheet(club, team)) sheet = await loadSheetForFixture(club.id, fixture)
    if (sheet && fixture && !sheet.fixtureId) {
      await prisma.$executeRawUnsafe(`UPDATE football_team_sheets SET fixture_id=$2,updated_at=NOW() WHERE id::text=$1 AND club_id=$3 AND fixture_id IS NULL`, sheet.id, fixture.id, club.id)
      sheet.fixtureId = fixture.id
    }
    const matchDayRows = sheet ? await prisma.$queryRawUnsafe<Array<{version:number;updatedAt:Date}>>(`SELECT version,updated_at AS "updatedAt" FROM club_match_day_state WHERE club_id=$1 AND sheet_id=$2 LIMIT 1`, club.id, sheet.id) : []
    const matchDay = matchDayRows[0] ?? null
    const teamSheetDiagnostics = !sheet ? await prisma.$queryRawUnsafe<Array<{
      id:string;fixtureId:string|null;leagueId:string|null;season:string;grade:string;roundLabel:string|null;
      opponentName:string|null;matchDate:string|null;status:string;playerCount:number;updatedAt:string
    }>>(`
      SELECT s.id::text AS id,s.fixture_id AS "fixtureId",s.league_id AS "leagueId",s.season,s.grade,
        s.round_label AS "roundLabel",s.opponent_name AS "opponentName",s.match_date AS "matchDate",s.status,
        COUNT(tsp.id)::int AS "playerCount",s.updated_at AS "updatedAt"
      FROM football_team_sheets s
      LEFT JOIN football_team_sheet_players tsp ON tsp.team_sheet_id=s.id
      WHERE s.club_id=$1
      GROUP BY s.id
      ORDER BY s.updated_at DESC
      LIMIT 10
    `, club.id) : []

    res.set('Cache-Control','no-store, no-cache, must-revalidate')
    res.json({ data:{
      club,
      team: team ? { leagueId:team.leagueId,leagueName:team.league.name,season:team.season,grade:team.grade } : null,
      membership:{ role:membership.role,canSelectTeam:effectiveClubPermissions(membership).includes('coaching.select-team'),canOverrideFixture:membership.role==='OWNER'||membership.role==='ADMIN' },
      access:{permissions:effectiveClubPermissions(membership),allowedAreas:allowedClubAreas(effectiveClubPermissions(membership)),defaultPage:defaultPermissionPage(effectiveClubPermissions(membership))},
      fixture: fixture ? {
        id:fixture.id,leagueId:fixture.leagueId,season:fixture.season,grade:fixture.grade,round:fixture.round,
        homeClubId:fixture.homeClubId,awayClubId:fixture.awayClubId,homeName:fixture.homeName,awayName:fixture.awayName,
        matchDate:fixture.matchDate,venue:fixture.venue,
      } : null,
      teamSheet:sheet,
      teamSheetDiagnostics:!sheet?teamSheetDiagnostics:undefined,
      matchDay:matchDay ? { started:true,version:matchDay.version,updatedAt:matchDay.updatedAt } : { started:false },
      nextStep:matchDay?'MATCH_DAY':'SELECT_SIDE',
    } })
  } catch (error) {
    res.status(500).json({ error:'Unable to resolve coach app context',detail:error instanceof Error?error.message:String(error) })
  }
})

export { router as coachAppRouter }
