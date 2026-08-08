from pathlib import Path

p=Path('src/pages/CoachAppWhiteboardStage2.tsx')
s=p.read_text()
s=s.replace("Users, BarChart3, Radio, Sparkles", "Users, BarChart3, Radio, Mic, Video, Film, Sparkles")
s=s.replace("  const[cloudNotes,setCloudNotes]=useState('')", "  const[cloudNotes,setCloudNotes]=useState('')\n  const[meetingActive,setMeetingActive]=useState(false)\n  const[meetingRevision,setMeetingRevision]=useState(0)\n  const[recordingVoice,setRecordingVoice]=useState(false)\n  const[mediaRecorder,setMediaRecorder]=useState<MediaRecorder|null>(null)")
anchor="  const svgRef=useRef<SVGSVGElement|null>(null)"
s=s.replace(anchor,anchor+"\n  const voiceChunks=useRef<Blob[]>([])")
old="""  async function liveMeeting(){
    if(!selectedCloudId){alert('Load a Club Cloud tactic first.');return}
    try{const r=await fetch(`/api/whiteboard-learning/clubs/${encodeURIComponent(clubId)}/plays/${selectedCloudId}/assignments`,{headers:{authorization:`Bearer ${token}`},cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to load meetings');const assignment=j.data?.[0];if(!assignment){alert('Assign this tactic to players first.');return}const active=!assignment.meetingActive;const u=await fetch(`/api/whiteboard-learning/clubs/${encodeURIComponent(clubId)}/assignments/${assignment.id}/meeting`,{method:'PUT',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({active,frameId:activeFrame.id})});const out=await u.json();if(!u.ok)throw new Error(out.error||'Unable to update meeting');alert(active?'Live meeting started. Players will follow the coach frame.':'Live meeting ended.')}catch(e){alert(e instanceof Error?e.message:'Unable to control meeting')}
  }
"""
new="""  async function liveMeeting(){
    if(!selectedCloudId){alert('Load a Club Cloud tactic first.');return}
    const active=!meetingActive
    try{const r=await fetch(`/api/whiteboard-live/clubs/${encodeURIComponent(clubId)}/plays/${selectedCloudId}/live`,{method:'PUT',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({active,activeFrameId:activeFrame.id,presenterName:'Coach'})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to control meeting');setMeetingActive(active);setMeetingRevision(j.data?.revision||0)}catch(e){alert(e instanceof Error?e.message:'Unable to control meeting')}
  }
  async function publishFrame(frameId:string){if(!selectedCloudId||!meetingActive)return;try{const r=await fetch(`/api/whiteboard-live/clubs/${encodeURIComponent(clubId)}/plays/${selectedCloudId}/live`,{method:'PUT',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({active:true,activeFrameId:frameId,presenterName:'Coach'})});const j=await r.json();if(r.ok)setMeetingRevision(j.data?.revision||meetingRevision)}catch{}}
  async function toggleVoice(){
    if(recordingVoice){mediaRecorder?.stop();setRecordingVoice(false);return}
    if(!selectedCloudId){alert('Load a Club Cloud tactic first.');return}
    try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});const recorder=new MediaRecorder(stream);voiceChunks.current=[];recorder.ondataavailable=e=>{if(e.data.size)voiceChunks.current.push(e.data)};recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());const blob=new Blob(voiceChunks.current,{type:recorder.mimeType||'audio/webm'});const reader=new FileReader();reader.onload=async()=>{const r=await fetch(`/api/whiteboard-live/clubs/${encodeURIComponent(clubId)}/plays/${selectedCloudId}/media`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({mediaType:'AUDIO',frameId:activeFrame.id,title:`Voice note - ${activeFrame.name}`,dataUrl:reader.result})});if(!r.ok)alert('Voice note could not be saved')};reader.readAsDataURL(blob)};recorder.start();setMediaRecorder(recorder);setRecordingVoice(true)}catch{alert('Microphone access is required to record a voice-over.')}
  }
  async function attachClip(){if(!selectedCloudId){alert('Load a Club Cloud tactic first.');return}const url=prompt('Paste the match clip URL')?.trim();if(!url)return;const title=prompt('Clip title',`Clip - ${activeFrame.name}`)||'Match clip';const r=await fetch(`/api/whiteboard-live/clubs/${encodeURIComponent(clubId)}/plays/${selectedCloudId}/media`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({mediaType:'CLIP',frameId:activeFrame.id,title,url,telestration:{strokes:state.strokes}})});if(r.ok)alert('Clip attached to this frame');else alert('Clip could not be attached')}
  async function exportVideo(){
    const svg=svgRef.current;if(!svg)return;const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const ctx=canvas.getContext('2d');if(!ctx)return;const stream=canvas.captureStream(30);const recorder=new MediaRecorder(stream,{mimeType:MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm'});const chunks:Blob[]=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onstop=()=>{const blob=new Blob(chunks,{type:'video/webm'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`playfooty-${activeFrame.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')||'tactic'}.webm`;a.click();URL.revokeObjectURL(a.href)};recorder.start();for(const frame of play.frames){const xml=new XMLSerializer().serializeToString(svg);const img=new Image();await new Promise<void>(resolve=>{img.onload=()=>{ctx.fillStyle='#06131c';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,280,0,720,720);ctx.fillStyle='#fff';ctx.font='bold 30px sans-serif';ctx.fillText(frame.name,30,55);resolve()};img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(xml)});await new Promise(r=>setTimeout(r,Math.max(500,play.speed||1200)))}recorder.stop()
  }
"""
if old not in s: raise SystemExit('meeting block not found')
s=s.replace(old,new)
# publish current frame whenever active frame changes during meeting
marker="  const strokes=[...state.strokes,...(drawing?[drawing]:[])]"
s=s.replace(marker,"  useEffect(()=>{if(meetingActive)void publishFrame(activeFrame.id)},[activeFrame.id,meetingActive])\n  useEffect(()=>{if(!selectedCloudId)return;const poll=window.setInterval(async()=>{try{const r=await fetch(`/api/whiteboard-live/clubs/${encodeURIComponent(clubId)}/plays/${selectedCloudId}/live`,{headers:{authorization:`Bearer ${token}`},cache:'no-store'});const j=await r.json();if(r.ok){setMeetingActive(Boolean(j.data?.active));if(j.data?.revision>meetingRevision){setMeetingRevision(j.data.revision);const f=play.frames.find(x=>x.id===j.data.activeFrameId);if(f)setPlay(c=>({...c,activeFrameId:f.id}))}}}catch{}},1200);return()=>window.clearInterval(poll)},[selectedCloudId,meetingRevision,play.frames])\n"+marker)
oldnav="<button onClick={()=>void liveMeeting()}><Radio/>Meeting</button><button onClick={exportPlay}><Download/>Export</button>"
newnav="<button className={meetingActive?'analyse':''} onClick={()=>void liveMeeting()}><Radio/>{meetingActive?'End meeting':'Meeting'}</button><button className={recordingVoice?'analyse':''} onClick={()=>void toggleVoice()}><Mic/>{recordingVoice?'Stop voice':'Voice'}</button><button onClick={()=>void attachClip()}><Film/>Attach clip</button><button onClick={()=>void exportVideo()}><Video/>Video</button><button onClick={exportPlay}><Download/>Export</button>"
if oldnav not in s: raise SystemExit('nav block not found')
s=s.replace(oldnav,newnav)
p.write_text(s)

p=Path('src/pages/CoachAppTacticAssignment.tsx')
s=p.read_text()
# Add polling live state and visible banner
needle=" useEffect(()=>{if(data?.meetingActive&&data.meetingFrame){const index=data.play.frames.findIndex(f=>f.id===data.meetingFrame);if(index>=0)setFrameIndex(index)}},[data?.meetingActive,data?.meetingFrame,data?.play.frames])"
replacement=needle+"\n useEffect(()=>{const poll=window.setInterval(async()=>{try{const r=await fetch(`/api/whiteboard-live/public/assignment/${encodeURIComponent(token)}/live`,{cache:'no-store'});const j=await r.json();if(r.ok&&j.data?.active&&j.data.activeFrameId){setData(current=>current?{...current,meetingActive:true,meetingFrame:j.data.activeFrameId}:current)}}catch{}},1000);return()=>window.clearInterval(poll)},[token])"
if needle not in s: raise SystemExit('assignment meeting effect not found')
s=s.replace(needle,replacement)
s=s.replace("<section className=\"pfta-board\">", "{data.meetingActive&&<div className=\"pfta-live\">LIVE TEAM MEETING · Following coach</div>}<section className=\"pfta-board\">")
s=s.replace(".pfta-board{", ".pfta-live{max-width:760px;margin:12px auto 0;background:#e11d48;color:#fff;border-radius:12px;padding:10px;text-align:center;font-weight:900;letter-spacing:.08em}.pfta-board{")
p.write_text(s)
print('Whiteboard Stage 6 UI added')
