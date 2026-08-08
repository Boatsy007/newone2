from pathlib import Path

path = Path('src/pages/CoachAppMatchDay.tsx')
text = path.read_text()
old = """  useEffect(()=>{if(!state||!sheet)return;setSync('saving');const timer=window.setTimeout(()=>{fetch(`/api/club-portal/match-day/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(sheetId)}`,{method:'PUT',headers:jsonHeaders,body:JSON.stringify({state})}).then(async response=>{const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||'Unable to save Match Day');setSync('saved')}).catch(()=>setSync('error'))},350);return()=>window.clearTimeout(timer)},[state,sheet,clubId,sheetId,jsonHeaders])
"""
new = """  useEffect(()=>{if(!state||!sheet)return;setSync('saving');let cancelled=false;const timer=window.setTimeout(async()=>{try{const endpoint=`/api/club-portal/match-day/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(sheetId)}`;const latestResponse=await fetch(endpoint,{headers,cache:'no-store'});const latestPayload=await latestResponse.json().catch(()=>({}));const latestStats=latestResponse.ok?(latestPayload.data?.state?.teamStats as Partial<TeamStats>|undefined):undefined;const stateToSave={...state,teamStats:{...EMPTY_STATS,...(latestStats||{}),...(state.teamStats||{})}};const response=await fetch(endpoint,{method:'PUT',headers:jsonHeaders,body:JSON.stringify({state:stateToSave})});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||'Unable to save Match Day');if(!cancelled)setSync('saved')}catch{if(!cancelled)setSync('error')}},350);return()=>{cancelled=true;window.clearTimeout(timer)}},[state,sheet,clubId,sheetId,headers,jsonHeaders])
"""
if old not in text:
    raise SystemExit('Target Match Day save effect not found')
path.write_text(text.replace(old, new))
