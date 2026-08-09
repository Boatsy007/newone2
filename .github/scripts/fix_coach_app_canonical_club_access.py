from pathlib import Path

# 1. Allow an active membership on a duplicate club record to authorise the exact
# canonical club record only when the names and active league-season-grade match.
auth_path = Path('backend/src/auth/club-auth.ts')
auth = auth_path.read_text()

old_membership = """export async function membershipForClub(userId: string, clubId: string) {
  await ensureClubMembershipSchema()
  const rows = await prisma.$queryRawUnsafe<ClubMembership[]>(`SELECT ${membershipSelect} FROM club_portal_memberships WHERE user_id=$1 AND club_id=$2 LIMIT 1`, userId, clubId)
  return rows[0] ?? null
}"""
new_membership = """function normaliseClubName(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export async function membershipForClub(userId: string, clubId: string) {
  await ensureClubMembershipSchema()
  const rows = await prisma.$queryRawUnsafe<ClubMembership[]>(`SELECT ${membershipSelect} FROM club_portal_memberships WHERE user_id=$1 AND club_id=$2 LIMIT 1`, userId, clubId)
  if (rows[0]) return rows[0]

  const requested = await prisma.club.findUnique({
    where: { id: clubId },
    select: {
      id: true,
      name: true,
      leagueSeasons: {
        where: { isActive: true },
        select: { leagueId: true, season: true, grade: true },
      },
    },
  })
  if (!requested) return null

  const memberships = await prisma.$queryRawUnsafe<ClubMembership[]>(`SELECT ${membershipSelect} FROM club_portal_memberships WHERE user_id=$1 AND status='ACTIVE'`, userId)
  for (const membership of memberships) {
    const source = await prisma.club.findUnique({
      where: { id: membership.clubId },
      select: {
        id: true,
        name: true,
        leagueSeasons: {
          where: { isActive: true },
          select: { leagueId: true, season: true, grade: true },
        },
      },
    })
    if (!source || normaliseClubName(source.name) !== normaliseClubName(requested.name)) continue
    const sameTeam = source.leagueSeasons.some(sourceTeam => requested.leagueSeasons.some(requestedTeam =>
      sourceTeam.leagueId === requestedTeam.leagueId && sourceTeam.season === requestedTeam.season && sourceTeam.grade === requestedTeam.grade
    ))
    if (sameTeam) return { ...membership, clubId }
  }
  return null
}"""
if old_membership not in auth:
    raise SystemExit('membershipForClub anchor not found')
auth = auth.replace(old_membership, new_membership, 1)
auth_path.write_text(auth)

# 2. Resolve the Coach App's authorised duplicate record to the fixture-linked
# canonical record before loading fixtures and team sheets.
coach_path = Path('backend/src/api/routes/coach-app.ts')
coach = coach_path.read_text()

anchor = """function dateKey(value: unknown) {
  if (!value) return ''
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0,10)
}
"""
addition = anchor + """
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
"""
if anchor not in coach:
    raise SystemExit('dateKey anchor not found')
coach = coach.replace(anchor, addition, 1)

old_block = """    const club = await prisma.club.findUnique({ where:{ id:membership.clubId }, select:{ id:true,name:true,logoUrl:true,primaryColour:true,secondaryColour:true } })
    if (!club) return res.status(404).json({ error: 'Authorised club not found' })
    const team = await prisma.clubLeagueSeason.findFirst({
      where:{ clubId:club.id,isActive:true,league:{ sport:'FOOTBALL',archivedAt:null,isActive:true } },
      orderBy:{ season:'desc' },
      select:{ leagueId:true,season:true,grade:true,league:{ select:{ name:true } } },
    })
"""
new_block = """    const authorisedClub = await prisma.club.findUnique({ where:{ id:membership.clubId }, select:{ id:true,name:true,logoUrl:true,primaryColour:true,secondaryColour:true } })
    if (!authorisedClub) return res.status(404).json({ error: 'Authorised club not found' })
    const team = await prisma.clubLeagueSeason.findFirst({
      where:{ clubId:authorisedClub.id,isActive:true,league:{ sport:'FOOTBALL',archivedAt:null,isActive:true } },
      orderBy:{ season:'desc' },
      select:{ leagueId:true,season:true,grade:true,league:{ select:{ name:true } } },
    })
    const club = await resolveCanonicalClub(authorisedClub, team)
"""
if old_block not in coach:
    raise SystemExit('coach club block anchor not found')
coach = coach.replace(old_block, new_block, 1)
coach_path.write_text(coach)
