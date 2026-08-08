from pathlib import Path

main=Path('src/main.tsx')
text=main.read_text()
if "CoachAppTacticAssignment" not in text:
    text=text.replace("import CoachAppJoin from './pages/CoachAppJoin.tsx'", "import CoachAppJoin from './pages/CoachAppJoin.tsx'\nimport CoachAppTacticAssignment from './pages/CoachAppTacticAssignment.tsx'")
    text=text.replace('<Route path="/coach-app/join" element={<CoachAppJoin/>}/>', '<Route path="/coach-app/join" element={<CoachAppJoin/>}/>\n    <Route path="/coach-app/tactic/:token" element={<CoachAppTacticAssignment/>}/>')
main.write_text(text)

p=Path('src/pages/CoachAppWhiteboardStage2.tsx')
s=p.read_text()
s=s.replace('Share2, Cloud, History, Download, Sparkles', 'Share2, Cloud, History, Download, Users, BarChart3, Radio, Sparkles')
anchor="  function exportPlay(){const blob=new Blob([JSON.stringify({title:activeFrame.name,fixtureLabel,play},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`playfooty-${activeFrame.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')||'tactic'}.json`;a.click();URL.revokeObjectURL(a.href)}"
addition=r'''
  async function assignTeam(){
    if(!selectedCloudId){alert('Save or load this tactic from Club Cloud first.');return}
    const title=prompt('Assignment title',activeFrame.name||'Team tactic')?.trim();if(!title)return
    const audience=(prompt('Audience: TEAM, LINE_GROUP or SELECTED','TEAM')||'TEAM').toUpperCase()
    const instructions=prompt('Player instructions (optional)','')||''
    const quizQuestion=prompt('Quick check question (optional)','')||''
    const quizAnswer=quizQuestion?(prompt('Correct answer','')||''):''
    try{const r=await fetch(`/api/whiteboard-learning/clubs/${encodeURIComponent(clubId)}/plays/${selectedCloudId}/assign`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({title,audience,instructions,quizQuestion,quizAnswer})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to assign tactic');const url=`${window.location.origin}${j.data.url}`;await navigator.clipboard.writeText(url);alert('Player learning link copied. Send it to the team.')}catch(e){alert(e instanceof Error?e.message:'Unable to assign tactic')}
  }
  async function showProgress(){
    if(!selectedCloudId){alert('Load a Club Cloud tactic first.');return}
    try{const r=await fetch(`/api/whiteboard-learning/clubs/${encodeURIComponent(clubId)}/plays/${selectedCloudId}/assignments`,{headers:{authorization:`Bearer ${token}`},cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to load progress');const rows=Array.isArray(j.data)?j.data:[];if(!rows.length){alert('No player assignments yet.');return}alert(rows.map((x:any)=>`${x.title}: ${x.responses} responses · ${x.understood} understood · ${x.needsClarification} need clarification`).join('\n'))}catch(e){alert(e instanceof Error?e.message:'Unable to load progress')}
  }
  async function liveMeeting(){
    if(!selectedCloudId){alert('Load a Club Cloud tactic first.');return}
    try{const r=await fetch(`/api/whiteboard-learning/clubs/${encodeURIComponent(clubId)}/plays/${selectedCloudId}/assignments`,{headers:{authorization:`Bearer ${token}`},cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to load meetings');const assignment=j.data?.[0];if(!assignment){alert('Assign this tactic to players first.');return}const active=!assignment.meetingActive;const u=await fetch(`/api/whiteboard-learning/clubs/${encodeURIComponent(clubId)}/assignments/${assignment.id}/meeting`,{method:'PUT',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({active,frameId:activeFrame.id})});const out=await u.json();if(!u.ok)throw new Error(out.error||'Unable to update meeting');alert(active?'Live meeting started. Players will follow the coach frame.':'Live meeting ended.')}catch(e){alert(e instanceof Error?e.message:'Unable to control meeting')}
  }'''
if 'async function assignTeam()' not in s:
    s=s.replace(anchor,anchor+addition)
old='<button onClick={()=>void loadCloud()}><Cloud/>Club Cloud</button><button onClick={exportPlay}><Download/>Export</button>'
new='<button onClick={()=>void loadCloud()}><Cloud/>Club Cloud</button><button onClick={()=>void assignTeam()}><Users/>Assign</button><button onClick={()=>void showProgress()}><BarChart3/>Progress</button><button onClick={()=>void liveMeeting()}><Radio/>Meeting</button><button onClick={exportPlay}><Download/>Export</button>'
s=s.replace(old,new)
p.write_text(s)
print('Whiteboard Stage 5 UI added')
