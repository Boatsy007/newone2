import fs from 'node:fs'

const path = 'src/pages/ClubPortalWhiteboard.tsx'
let text = fs.readFileSync(path, 'utf8')
const original = text

text = text.replace(
  "const[trails,setTrails]=useState<Record<string,Point[]>>({});const[recordMode,setRecordMode]=useState<RecordMode>('together');const[selectedTrackId,setSelectedTrackId]=useState('');const[startDelay,setStartDelay]=useState(0)",
  "const[trails,setTrails]=useState<Record<string,Point[]>>({});const[recordMode,setRecordMode]=useState<RecordMode>('together');const[selectedTrackId,setSelectedTrackId]=useState('')"
)

text = text.replace(
  "const recordStart=useRef(0);const recordStarts=useRef<Record<string,Point>>({});const recordPaths=useRef<Record<string,Frame[]>>({});const recordingIds=useRef(new Set<string>());",
  "const recordStart=useRef(0);const buildTrackStarts=useRef<Record<string,number>>({});const recordStarts=useRef<Record<string,Point>>({});const recordPaths=useRef<Record<string,Frame[]>>({});const recordingIds=useRef(new Set<string>());"
)

text = text.replace(
  "const recordFrame=(id:string,p:Point)=>{if(!recording||!recordingIds.current.has(id))return;const t=Math.max(0,performance.now()-recordStart.current);const path=recordPaths.current[id]||(recordPaths.current[id]=[{t:0,...(recordStarts.current[id]||p)}]);const last=path[path.length-1];if(t-last.t>=24||Math.hypot(p.x-last.x,p.y-last.y)>.35){path.push({t,...p});setTrails(current=>({...current,[id]:[...(current[id]||[]),p].slice(-240)}))}}",
  "const recordFrame=(id:string,p:Point)=>{if(!recording||!recordingIds.current.has(id))return;const base=recordMode==='separate'?(buildTrackStarts.current[id]||performance.now()):recordStart.current;const t=Math.max(0,performance.now()-base);const path=recordPaths.current[id]||(recordPaths.current[id]=[{t:0,...(recordStarts.current[id]||p)}]);const last=path[path.length-1];if(t-last.t>=24||Math.hypot(p.x-last.x,p.y-last.y)>.35){path.push({t,...p});setTrails(current=>({...current,[id]:[...(current[id]||[]),p].slice(-240)}))}}"
)

text = text.replace(
  "const startDrag=(event:React.PointerEvent,id:string)=>{if(tool!=='select'||playing)return;if(recording&&recordMode==='separate'&&!recordingIds.current.has(id))return;if(id===BALL_ID&&dataRef.current.ballHolderId)return;event.stopPropagation();if(!recording)checkpoint();activeDrags.current.set(event.pointerId,id);event.currentTarget.setPointerCapture(event.pointerId)}",
  "const startDrag=(event:React.PointerEvent,id:string)=>{if(tool!=='select'||playing)return;if(id===BALL_ID&&dataRef.current.ballHolderId)return;event.stopPropagation();if(!recording)checkpoint();if(recording&&recordMode==='separate'&&!recordingIds.current.has(id)){const start=markerPoint(id);if(!start)return;recordingIds.current.add(id);recordStarts.current[id]=recordStarts.current[id]||start;recordPaths.current[id]=[{t:0,...start}];buildTrackStarts.current[id]=performance.now();if(id!==BALL_ID&&dataRef.current.ballHolderId===id&&dataRef.current.ball){const ballStart=markerPoint(BALL_ID)||holderBallPoint(start);recordingIds.current.add(BALL_ID);recordStarts.current[BALL_ID]=recordStarts.current[BALL_ID]||ballStart;recordPaths.current[BALL_ID]=[{t:0,...ballStart}];buildTrackStarts.current[BALL_ID]=buildTrackStarts.current[id]}}activeDrags.current.set(event.pointerId,id);event.currentTarget.setPointerCapture(event.pointerId)}"
)

const startPattern = / const startRecording=\(\)=>\{.*?\n const tickPlayback=/s
const replacement = ` const startRecording=()=>{stopPlayback();checkpoint();setTool('select');const existing=dataRef.current.recording;if(recordMode==='separate'){if(existing)resetToStarts(existing);recordStarts.current=existing?clone(existing.starts):currentStarts();recordPaths.current=existing?clone(existing.paths):{};recordingIds.current=new Set();buildTrackStarts.current={};setMessage('Build play is active — move each player, opponent or the ball once. Every moved marker will play from the same starting time.')}else{const starts=currentStarts();recordStarts.current=starts;recordPaths.current={};Object.entries(starts).forEach(([id,p])=>{recordPaths.current[id]=[{t:0,...p}]});recordingIds.current=new Set(Object.keys(starts));buildTrackStarts.current={};setMessage('Recording together — move any players, opposition markers and the ball.')}recordStart.current=performance.now();setTrails({});setRecording(true);setError('')}
 const stopRecording=()=>{if(!recording)return;if(recordMode==='separate'&&!recordingIds.current.size){setRecording(false);setTrails({});return setError('Move at least one player, opponent or the ball before finishing the build.')}const localDuration=Math.max(100,performance.now()-recordStart.current);recordingIds.current.forEach(id=>{const start=recordStarts.current[id];if(!start)return;const path=recordPaths.current[id]||[{t:0,...start}];const current=markerPoint(id);const trackTime=recordMode==='separate'?Math.max(100,performance.now()-(buildTrackStarts.current[id]||performance.now())):localDuration;if(current)path.push({t:trackTime,...current});recordPaths.current[id]=path});const previous=dataRef.current.recording;const delays=recordMode==='separate'?{...(previous?.delays||{})}:{};recordingIds.current.forEach(id=>{delays[id]=0});const starts=clone(recordStarts.current);const paths=clone(recordPaths.current);const duration=Math.max(100,...Object.entries(paths).map(([id,path])=>trackDuration(path,delays[id]||0)));const next={duration,starts,paths,delays};setData(current=>({...current,recording:next}));setRecording(false);setTrails({});setPlayTime(0);if(recordMode==='separate'){setTimeout(()=>resetToStarts(next),0);setMessage('Play built. Press Play all — every marker you moved will start together.')}else setMessage('Play recorded. Press Play to review it.')}
 const tickPlayback=`
if (startPattern.test(text)) text = text.replace(startPattern, replacement)

const choreoPattern = /<div className="choreo">.*?<\/div><div className="playbar">/s
const choreo = `<div className="choreo"><label>Recording mode<select value={recordMode} disabled={recording||playing} onChange={e=>setRecordMode(e.target.value as RecordMode)}><option value="together">Record live together</option><option value="separate">Build play</option></select></label><em>{recordMode==='together'?'Move multiple markers at the same time.':'Tap Build play, move each marker you want, then Finish build and Play all.'}</em></div><div className="playbar">`
if (choreoPattern.test(text)) text = text.replace(choreoPattern, choreo)

text = text.replace(
  "{recording?<><Square/>Stop</>:<><Radio/>Record</>}",
  "{recording?<><Square/>{recordMode==='separate'?'Finish build':'Stop'}</>:<><Radio/>{recordMode==='separate'?'Build play':'Record'}</>}"
)
text = text.replace(
  "{recording?(recordMode==='separate'?'Recording selected track':'Recording — move multiple markers')",
  "{recording?(recordMode==='separate'?'Building play — move every marker you want included':'Recording — move multiple markers')"
)

if (text === original) {
  console.log('Whiteboard Build play flow already applied')
} else {
  fs.writeFileSync(path, text)
  console.log('Applied simplified whiteboard Build play flow')
}
