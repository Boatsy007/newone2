from pathlib import Path

backend = Path('backend/src/api/routes/team-sheets.ts')
text = backend.read_text()
anchor = "const adminRouter = Router()\n"
route = """const adminRouter = Router()\nadminRouter.get('/clubs', async (_req, res) => {\n  try {\n    const clubs = await prisma.club.findMany({\n      where: {\n        sport: 'FOOTBALL',\n        archivedAt: null,\n        isActive: true,\n        leagueSeasons: { some: { isActive: true, league: { sport: 'FOOTBALL', archivedAt: null, isActive: true } } },\n      },\n      select: {\n        id: true,\n        name: true,\n        leagueSeasons: {\n          where: { isActive: true, league: { sport: 'FOOTBALL', archivedAt: null, isActive: true } },\n          orderBy: [{ season: 'desc' }, { updatedAt: 'desc' }],\n          take: 1,\n          select: { leagueId: true, grade: true, league: { select: { name: true } } },\n        },\n      },\n      orderBy: { name: 'asc' },\n    })\n    res.set('Cache-Control', 'no-store, no-cache, must-revalidate')\n    res.json({ data: clubs.map(club => ({\n      clubId: club.id,\n      clubName: club.name,\n      leagueId: club.leagueSeasons[0]?.leagueId ?? null,\n      leagueName: club.leagueSeasons[0]?.league.name ?? '—',\n      grade: club.leagueSeasons[0]?.grade ?? null,\n    })) })\n  } catch (error) {\n    res.status(500).json({ error: 'failed to load team sheet clubs', detail: String(error) })\n  }\n})\n"""
if "adminRouter.get('/clubs'" not in text:
    if anchor not in text:
        raise SystemExit('adminRouter anchor not found')
    text = text.replace(anchor, route, 1)
    backend.write_text(text)

frontend = Path('src/pages/AdminTeamSheets.tsx')
text = frontend.read_text()
old = "useEffect(()=>{fetch('/api/clubs').then(r=>r.json()).then((p:{data?:Club[]})=>setClubs(Array.isArray(p.data)?p.data:[])).catch(()=>setClubs([]))},[])"
new = "useEffect(()=>{fetch('/admin/team-sheets/clubs',{headers:authHeaders()}).then(r=>r.json()).then((p:{data?:Club[]})=>setClubs(Array.isArray(p.data)?p.data:[])).catch(()=>setClubs([]))},[])"
if old in text:
    text = text.replace(old, new, 1)
elif "/admin/team-sheets/clubs" not in text:
    raise SystemExit('AdminTeamSheets club-loading expression not found')
frontend.write_text(text)
