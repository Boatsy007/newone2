from pathlib import Path

coach = Path('src/pages/CoachApp.tsx')
text = coach.read_text()
old = "screen==='MATCH_DAY'&&context.teamSheet?<CoachAppMatchDay clubId={context.club.id} sheetId={context.teamSheet.id} token={session.access_token} onBack={()=>setScreen('SELECT_SIDE')}"
new = "screen==='STATS'&&context.fixture?<CoachAppStats clubId={context.club.id} sheetId={context.teamSheet?.id} fixtureId={context.fixture.id} token={session.access_token} onExit={()=>setScreen('DASHBOARD')}/>:screen==='MATCH_DAY'&&context.teamSheet?<CoachAppMatchDay clubId={context.club.id} sheetId={context.teamSheet.id} token={session.access_token} onBack={()=>setScreen('SELECT_SIDE')}"
if old not in text:
    raise SystemExit('CoachApp Match Day render anchor not found')
coach.write_text(text.replace(old, new, 1))

stats = Path('src/pages/CoachAppStats.tsx')
text = stats.read_text()
text = text.replace("type Props={clubId:string;sheetId:string;token:string;onExit:()=>void}", "type Props={clubId:string;sheetId?:string|null;fixtureId:string;token:string;onExit:()=>void}")
text = text.replace("export default function CoachAppStats({clubId,sheetId,token,onExit}:Props){\n  const[state,setState]", "export default function CoachAppStats({clubId,sheetId,fixtureId,token,onExit}:Props){\n  const[resolvedSheetId,setResolvedSheetId]=useState(sheetId||'')\n  const[state,setState]")
text = text.replace("  const endpoint=`/api/club-portal/match-day/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(sheetId)}`", "  const endpoint=resolvedSheetId?`/api/club-portal/match-day/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(resolvedSheetId)}`:''")
old_load = "  async function load(silent=false){\n    if(!silent)setLoading(true)\n    try{\n      const response=await fetch(endpoint,{headers,cache:'no-store'})"
new_load = "  async function resolveSheet(){\n    if(resolvedSheetId)return resolvedSheetId\n    const createResponse=await fetch(`/api/club-portal/team-sheets/clubs/${encodeURIComponent(clubId)}/sheets`,{method:'POST',headers:jsonHeaders,body:JSON.stringify({fixtureId})})\n    const createPayload=await createResponse.json().catch(()=>({}))\n    if(!createResponse.ok&&createResponse.status!==409)throw new Error(createPayload.error||'Unable to connect to the live team sheet')\n    const contextResponse=await fetch(`/api/club-portal/coach-app/context?clubId=${encodeURIComponent(clubId)}`,{headers,cache:'no-store'})\n    const contextPayload=await contextResponse.json().catch(()=>({}))\n    const id=contextPayload.data?.teamSheet?.id as string|undefined\n    if(!contextResponse.ok||!id)throw new Error(contextPayload.error||'The live team sheet could not be found')\n    setResolvedSheetId(id)\n    return id\n  }\n\n  async function load(silent=false){\n    if(!silent)setLoading(true)\n    try{\n      const activeSheetId=await resolveSheet()\n      const activeEndpoint=`/api/club-portal/match-day/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(activeSheetId)}`\n      const response=await fetch(activeEndpoint,{headers,cache:'no-store'})"
if old_load not in text:
    raise SystemExit('Stats load anchor not found')
text = text.replace(old_load, new_load, 1)
text = text.replace("  useEffect(()=>{void load();const timer=window.setInterval(()=>void load(true),2500);return()=>window.clearInterval(timer)},[clubId,sheetId,token])", "  useEffect(()=>{setResolvedSheetId(sheetId||'');void load();const timer=window.setInterval(()=>void load(true),2500);return()=>window.clearInterval(timer)},[clubId,sheetId,fixtureId,token])")
old_change = "      const latestResponse=await fetch(endpoint,{headers,cache:'no-store'})"
new_change = "      const activeSheetId=await resolveSheet()\n      const activeEndpoint=`/api/club-portal/match-day/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(activeSheetId)}`\n      const latestResponse=await fetch(activeEndpoint,{headers,cache:'no-store'})"
text = text.replace(old_change, new_change, 1)
text = text.replace("      const response=await fetch(endpoint,{method:'PUT',headers:jsonHeaders,body:JSON.stringify({state:nextState})})", "      const response=await fetch(activeEndpoint,{method:'PUT',headers:jsonHeaders,body:JSON.stringify({state:nextState})})", 1)
stats.write_text(text)
