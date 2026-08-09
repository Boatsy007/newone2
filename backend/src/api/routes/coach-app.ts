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
    WHERE s.club_id=$1 AND s.season=$2 AND s.fixture_id IS NULL
    GROUP BY s.id
    ORDER BY (s.league_id=$3) DESC,(s.grade=$4) DESC,s.updated_at DESC
    LIMIT 1
  `, clubId, fixture.season, fixture.leagueId, fixture.grade)
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
    const club = await prisma.club.findUnique({ where:{ id:membership.clubId }, select:{ id:true,name:true,logoUrl:true,primaryColour:true,secondaryColour:true } })
    if (!club) return res.status(404).json({ error: 'Authorised club not found' })
    const team = await prisma.clubLeagueSeason.findFirst({
      where:{ clubId:club.id,isActive:true,league:{ sport:'FOOTBALL',archivedAt:null,isActive:true } },
      orderBy:{ season:'desc' },
      select:{ leagueId:true,season:true,grade:true,league:{ select:{ name:true } } },
    })

    const overrideId = typeof req.query.fixtureId === 'string' ? req.query.fixtureId.trim() : ''
    if (overrideId && membership.role !== 'OWNER' && membership.role !== 'ADMIN') return res.status(403).json({ error: 'Only a club administrator can override the active fixture' })
    const fixture = overrideId
      ? await loadFixture(overrideId, club.id)
      : await loadActiveFixture(club.id, team?.season ?? null, team?.grade ?? null)
    if (overrideId && !fixture) return res.status(404).json({ error: 'The selected fixture does not belong to this club' })

    const sheet = await loadSheetForFixture(club.id, fixture)
    if (sheet && fixture && !sheet.fixtureId) {
      await prisma.$executeRawUnsafe(`UPDATE football_team_sheets SET fixture_id=$2,updated_at=NOW() WHERE id::text=$1 AND club_id=$3 AND fixture_id IS NULL`, sheet.id, fixture.id, club.id)
      sheet.fixtureId = fixture.id
    }
    const matchDayRows = sheet ? await prisma.$queryRawUnsafe<Array<{version:number;updatedAt:Date}>>(`SELECT version,updated_at AS "updatedAt" FROM club_match_day_state WHERE club_id=$1 AND sheet_id=$2 LIMIT 1`, club.id, sheet.id) : []
    const matchDay = matchDayRows[0] ?? null

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
      matchDay:matchDay ? { started:true,version:matchDay.version,updatedAt:matchDay.updatedAt } : { started:false },
      nextStep:matchDay?'MATCH_DAY':'SELECT_SIDE',
    } })
  } catch (error) {
    res.status(500).json({ error:'Unable to resolve coach app context',detail:error instanceof Error?error.message:String(error) })
  }
})

export { router as coachAppRouter }
