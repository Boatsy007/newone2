from pathlib import Path

backend=Path('backend/src/api/routes/coach-app.ts')
s=backend.read_text()
old='''    const matchDayRows = sheet ? await prisma.$queryRawUnsafe<Array<{version:number;updatedAt:Date}>>(`SELECT version,updated_at AS "updatedAt" FROM club_match_day_state WHERE club_id=$1 AND sheet_id=$2 LIMIT 1`, club.id, sheet.id) : []
    const matchDay = matchDayRows[0] ?? null

    res.set('Cache-Control','no-store, no-cache, must-revalidate')'''
new='''    const matchDayRows = sheet ? await prisma.$queryRawUnsafe<Array<{version:number;updatedAt:Date}>>(`SELECT version,updated_at AS "updatedAt" FROM club_match_day_state WHERE club_id=$1 AND sheet_id=$2 LIMIT 1`, club.id, sheet.id) : []
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

    res.set('Cache-Control','no-store, no-cache, must-revalidate')'''
if old not in s: raise SystemExit('backend insertion point not found')
s=s.replace(old,new,1)
old2='''      teamSheet:sheet,
      matchDay:matchDay ? { started:true,version:matchDay.version,updatedAt:matchDay.updatedAt } : { started:false },'''
new2='''      teamSheet:sheet,
      teamSheetDiagnostics:!sheet?teamSheetDiagnostics:undefined,
      matchDay:matchDay ? { started:true,version:matchDay.version,updatedAt:matchDay.updatedAt } : { started:false },'''
if old2 not in s: raise SystemExit('backend response point not found')
s=s.replace(old2,new2,1)
backend.write_text(s)

front=Path('src/pages/CoachApp.tsx')
f=front.read_text()
old3="""  teamSheet: { id: string; playerCount: number } | null
  matchDay: { started: boolean }"""
new3="""  teamSheet: { id: string; playerCount: number } | null
  teamSheetDiagnostics?: Array<{ id:string; fixtureId:string|null; leagueId:string|null; season:string; grade:string; roundLabel:string|null; opponentName:string|null; matchDate:string|null; status:string; playerCount:number; updatedAt:string }>
  matchDay: { started: boolean }"""
if old3 not in f: raise SystemExit('frontend type point not found')
f=f.replace(old3,new3,1)
old4="""screen!=='DASHBOARD'&&screen!=='CLUB_DASHBOARD'?<section className=\"coach-loading\"><strong>No active team sheet is available.</strong><button onClick={()=>setScreen('DASHBOARD')}>Back to dashboard</button></section>:null}"""
new4="""screen!=='DASHBOARD'&&screen!=='CLUB_DASHBOARD'?<section className=\"coach-loading coach-sheet-debug\"><strong>No active team sheet is available.</strong><small>Club: {context.club.id}</small><small>Active fixture: {context.fixture?.id||'none'} · {context.fixture?.season||'no season'} · {context.fixture?.grade||'no grade'}</small>{context.teamSheetDiagnostics?.length?<div>{context.teamSheetDiagnostics.map(item=><code key={item.id}>{item.id} | fixture {item.fixtureId||'none'} | {item.season} | {item.grade} | {item.roundLabel||'no round'} | {item.opponentName||'no opponent'} | {item.playerCount} players</code>)}</div>:<small>No team-sheet records exist for this exact club ID.</small>}<button onClick={()=>setScreen('DASHBOARD')}>Back to dashboard</button></section>:null}"""
if old4 not in f: raise SystemExit('frontend display point not found')
f=f.replace(old4,new4,1)
old5=""".coach-loading{align-content:center;gap:14px;text-align:center}.coach-loading svg"""
new5=""".coach-loading{align-content:center;gap:14px;text-align:center}.coach-sheet-debug{padding:24px}.coach-sheet-debug>small{display:block;max-width:900px;word-break:break-all;color:#a9bac6}.coach-sheet-debug>div{display:grid;gap:7px;width:min(1000px,96vw);max-height:42vh;overflow:auto;text-align:left}.coach-sheet-debug code{display:block;padding:10px;border:1px solid #29404f;border-radius:8px;background:#0d1b26;color:#dce8ef;white-space:normal;word-break:break-all}.coach-loading svg"""
if old5 not in f: raise SystemExit('frontend style point not found')
f=f.replace(old5,new5,1)
front.write_text(f)
