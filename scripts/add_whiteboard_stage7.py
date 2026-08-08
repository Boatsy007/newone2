from pathlib import Path

p=Path('src/pages/CoachAppWhiteboardStage2.tsx')
s=p.read_text()

old="import { ArrowLeft, ChevronDown, ChevronUp, Copy, Eraser, Highlighter, Library, MousePointer2, Pause, Pencil, Play, Plus, Presentation, Redo2, Repeat2, Save, Share2, Cloud, History, Download, Users, BarChart3, Radio, Mic, Video, Film, Sparkles, Trash2, Undo2, X } from 'lucide-react'"
new="import { ArrowLeft, ChevronDown, ChevronUp, Copy, Eraser, Highlighter, Library, MousePointer2, Pause, Pencil, Play, Plus, Presentation, Redo2, Repeat2, Save, Share2, Cloud, History, Download, Users, BarChart3, Radio, Mic, Video, Film, BrainCircuit, GitCompare, Target, BookOpen, Sparkles, Trash2, Undo2, X } from 'lucide-react'"
assert old in s, 'icon import not found'
s=s.replace(old,new,1)

anchor="  const strokes=[...state.strokes,...(drawing?[drawing]:[])]"
assert anchor in s, 'function insertion anchor not found'
functions=r'''  async function smartSetup(){
    const focus=(prompt('Setup focus: BALANCED, ATTACK, DEFENCE or WIDTH','BALANCED')||'BALANCED').toUpperCase()
    try{const r=await fetch(`/api/whiteboard-intelligence/clubs/${encodeURIComponent(clubId)}/generate`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({frame:activeFrame,focus,fixtureLabel})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to generate setup');snapshot();const frame=j.data.frame as Frame;setPlay(current=>({...current,frames:[...current.frames,frame],activeFrameId:frame.id}));alert(`Smart setup added. Structure score ${j.data.before.score} → ${j.data.after.score}. ${j.data.reason}`)}catch(e){alert(e instanceof Error?e.message:'Unable to generate setup')}
  }
  async function compareFrames(){
    if(play.frames.length<2){alert('Add at least two frames before comparing.');return}
    const other=play.frames[activeIndex===0?1:activeIndex-1]
    try{const r=await fetch(`/api/whiteboard-intelligence/clubs/${encodeURIComponent(clubId)}/compare`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({a:other,b:activeFrame})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to compare frames');alert(`${other.name}: ${j.data.a.score}/100\n${activeFrame.name}: ${j.data.b.score}/100\n\n${j.data.summary}\n\nCurrent frame uncovered: ${(j.data.b.uncovered||[]).join(', ')||'None'}\nCongestion pairs: ${j.data.b.congestion}`)}catch(e){alert(e instanceof Error?e.message:'Unable to compare frames')}
  }
  async function recordOutcome(){
    const outcome=(prompt('Outcome: WORKED, NEUTRAL or FAILED','WORKED')||'NEUTRAL').toUpperCase()
    const notes=prompt('What happened when this tactic was used?','')||''
    let stats:unknown={}
    try{const mr=await fetch(`/api/club-portal/match-day/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(sheetId)}`,{headers:{authorization:`Bearer ${token}`},cache:'no-store'});if(mr.ok){const mj=await mr.json() as SheetPayload;stats=mj.data?.state?.teamStats||{}}}catch{}
    try{const r=await fetch(`/api/whiteboard-intelligence/clubs/${encodeURIComponent(clubId)}/usage`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({playId:selectedCloudId,fixtureLabel,frameId:activeFrame.id,outcome,notes,afterStats:stats})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to record outcome');alert('Tactic outcome saved for post-match review.')}catch(e){alert(e instanceof Error?e.message:'Unable to record outcome')}
  }
  async function tacticalReview(){
    try{const r=await fetch(`/api/whiteboard-intelligence/clubs/${encodeURIComponent(clubId)}/review`,{headers:{authorization:`Bearer ${token}`},cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to load tactical review');const x=j.data.summary;const recent=(j.data.entries||[]).slice(0,5).map((row:any)=>`${row.outcome} · ${row.fixtureLabel||'Match'}${row.notes?` · ${row.notes}`:''}`).join('\n');alert(`TACTICAL REVIEW\n\nUsed: ${x.total}\nWorked: ${x.improved}\nNeutral: ${x.neutral}\nFailed: ${x.declined}\n\n${recent||'No tactics have been rated yet.'}`)}catch(e){alert(e instanceof Error?e.message:'Unable to load tactical review')}
  }
  async function gameModel(){
    const action=(prompt('Game Model: SAVE or LOAD','SAVE')||'SAVE').toUpperCase()
    if(action==='LOAD'){
      try{const r=await fetch(`/api/whiteboard-intelligence/clubs/${encodeURIComponent(clubId)}/game-models`,{headers:{authorization:`Bearer ${token}`},cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to load game models');const rows=Array.isArray(j.data)?j.data:[];if(!rows.length){alert('No game-model templates saved yet.');return}const choice=Number(prompt(rows.map((x:any,i:number)=>`${i+1}. ${x.phase} · ${x.title}`).join('\n'),'1'))-1;const item=rows[choice];if(!item)return;snapshot();setPlay(clonePlay(item.play));alert(`${item.title} loaded.`)}catch(e){alert(e instanceof Error?e.message:'Unable to load game model')};return
    }
    const title=prompt('Game-model title',activeFrame.name)?.trim();if(!title)return
    const phase=(prompt('Phase: CONTEST, ATTACK, DEFENCE, TRANSITION, KICK-IN or STOPPAGE','ATTACK')||'GENERAL').toUpperCase()
    const description=prompt('Game-model principle','')||''
    try{const r=await fetch(`/api/whiteboard-intelligence/clubs/${encodeURIComponent(clubId)}/game-models`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({title,phase,description,play})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to save game model');alert('Club game-model template saved.')}catch(e){alert(e instanceof Error?e.message:'Unable to save game model')}
  }
'''
s=s.replace(anchor,functions+anchor,1)

analyse='<button className="analyse" onClick={()=>void analyseTactic(\'frame\')}><Sparkles/>Analyse</button>'
assert analyse in s, 'analyse header button not found'
advanced=analyse+'<button onClick={()=>void smartSetup()}><BrainCircuit/>Smart Setup</button><button onClick={()=>void compareFrames()}><GitCompare/>Compare</button><button onClick={()=>void recordOutcome()}><Target/>Outcome</button><button onClick={()=>void tacticalReview()}><BarChart3/>Review</button><button onClick={()=>void gameModel()}><BookOpen/>Game Model</button>'
s=s.replace(analyse,advanced,1)

p.write_text(s)
