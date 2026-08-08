from pathlib import Path

path=Path('src/pages/CoachAppWhiteboardStage2.tsx')
text=path.read_text()

text=text.replace("import { ArrowLeft, ChevronDown, ChevronUp, Copy, Eraser, Highlighter, Library, MousePointer2, Pause, Pencil, Play, Plus, Presentation, Redo2, Repeat2, Save, Trash2, Undo2, X } from 'lucide-react'", "import { ArrowLeft, ChevronDown, ChevronUp, Copy, Eraser, Highlighter, Library, MousePointer2, Pause, Pencil, Play, Plus, Presentation, Redo2, Repeat2, Save, Sparkles, Trash2, Undo2, X } from 'lucide-react'")
text=text.replace("type SheetPayload={data?:{state?:{slots?:Array<{clubPlayerId:string;playerName:string;jumperNumber:number|null;positionCode:string}>}}}", "type SheetPayload={data?:{state?:{slots?:Array<{clubPlayerId:string;playerName:string;jumperNumber:number|null;positionCode:string}>;teamStats?:Record<string,number>;quarter?:number;homeGoals?:number;homeBehinds?:number;awayGoals?:number;awayBehinds?:number}}}\ntype TacticalAnalysis={headline:string;summary:string;strengths:string[];risks:string[];adjustments:string[];coachMessage:string}")
text=text.replace("  const[playing,setPlaying]=useState(false)\n  const svgRef", "  const[playing,setPlaying]=useState(false)\n  const[analysisOpen,setAnalysisOpen]=useState(false)\n  const[analysisLoading,setAnalysisLoading]=useState(false)\n  const[analysisError,setAnalysisError]=useState('')\n  const[analysis,setAnalysis]=useState<TacticalAnalysis|null>(null)\n  const[analysisScope,setAnalysisScope]=useState<'frame'|'play'>('frame')\n  const svgRef")
anchor="  function togglePlay(){if(play.frames.length<2)return;if(activeIndex===play.frames.length-1)setPlay(current=>({...current,activeFrameId:current.frames[0].id}));setPlaying(value=>!value)}\n  const strokes="
insert="""  function togglePlay(){if(play.frames.length<2)return;if(activeIndex===play.frames.length-1)setPlay(current=>({...current,activeFrameId:current.frames[0].id}));setPlaying(value=>!value)}
  async function analyseTactic(scope:'frame'|'play'){
    setAnalysisScope(scope);setAnalysisOpen(true);setAnalysisLoading(true);setAnalysisError('');setAnalysis(null)
    try{
      let match:unknown=null
      try{const response=await fetch(`/api/club-portal/match-day/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(sheetId)}`,{headers:{authorization:`Bearer ${token}`},cache:'no-store'});if(response.ok){const payload=await response.json() as SheetPayload;match=payload.data?.state||null}}catch{}
      const frames=scope==='frame'?[activeFrame]:play.frames
      const response=await fetch('/api/whiteboard-analysis',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({fixtureLabel,scope,activeFrameId:activeFrame.id,frames,match})})
      const payload=await response.json().catch(()=>({}))
      if(!response.ok)throw new Error(payload.error||'Unable to analyse tactic')
      setAnalysis(payload.analysis as TacticalAnalysis)
    }catch(value){setAnalysisError(value instanceof Error?value.message:'Unable to analyse tactic')}
    finally{setAnalysisLoading(false)}
  }
  function applyAdjustment(){if(!analysis?.adjustments?.[0])return;snapshot();const id=crypto.randomUUID();const frame:Frame={id,name:'AI adjustment',state:cloneBoard(state)};setPlay(current=>({...current,frames:[...current.frames,frame],activeFrameId:id}));setAnalysisOpen(false)}
  const strokes="""
if anchor not in text: raise SystemExit('togglePlay anchor missing')
text=text.replace(anchor,insert,1)
old="<nav><button onClick={()=>setLibraryOpen(true)}><Library/>Library</button><button className=\"save\" onClick={savePlay}><Save/>Save play</button><button onClick={()=>setPresenting(true)}><Presentation/>Present</button></nav>"
new="<nav><button className=\"analyse\" onClick={()=>void analyseTactic('frame')}><Sparkles/>Analyse</button><button onClick={()=>setLibraryOpen(true)}><Library/>Library</button><button className=\"save\" onClick={savePlay}><Save/>Save play</button><button onClick={()=>setPresenting(true)}><Presentation/>Present</button></nav>"
if old not in text: raise SystemExit('header nav anchor missing')
text=text.replace(old,new,1)
modal_anchor="    {libraryOpen&&<div className=\"library-modal\">"
modal="""    {analysisOpen&&<div className="analysis-modal"><section><header><div><span>AI TACTICAL ASSISTANT</span><h2>{analysisLoading?'Reading the board…':analysis?.headline||'Tactical analysis'}</h2></div><button onClick={()=>setAnalysisOpen(false)}><X/></button></header>{analysisLoading?<div className="analysis-loading"><Sparkles/><b>Analysing spacing, structure and match context…</b></div>:analysisError?<div className="analysis-loading"><b>{analysisError}</b><button onClick={()=>void analyseTactic(analysisScope)}>Try again</button></div>:analysis?<><p className="analysis-summary">{analysis.summary}</p><div className="analysis-grid"><article><h3>What works</h3>{analysis.strengths.map((item,index)=><p key={index}>{item}</p>)}</article><article><h3>Risks</h3>{analysis.risks.map((item,index)=><p key={index}>{item}</p>)}</article><article><h3>Adjustments</h3>{analysis.adjustments.map((item,index)=><p key={index}>{index+1}. {item}</p>)}</article></div><blockquote>“{analysis.coachMessage}”</blockquote><footer><button onClick={()=>void analyseTactic(analysisScope==='frame'?'play':'frame')}>Analyse {analysisScope==='frame'?'full play':'current frame'}</button><button className="apply" onClick={applyAdjustment}>Create adjustment frame</button></footer></>:null}</section></div>}
"""
if modal_anchor not in text: raise SystemExit('library modal anchor missing')
text=text.replace(modal_anchor,modal+modal_anchor,1)
style_anchor=".cawb2>header nav .save"
idx=text.find(style_anchor)
if idx<0: raise SystemExit('style anchor missing')
extra=".cawb2>header nav .analyse{border-color:#20b8ff;background:#0d4e70;color:#fff}.analysis-modal{position:fixed;z-index:3200;inset:0;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.82);backdrop-filter:blur(9px)}.analysis-modal>section{width:min(820px,96vw);max-height:90vh;overflow:auto;padding:18px;border:1px solid #315469;border-radius:18px;background:#091923;box-shadow:0 30px 100px #000}.analysis-modal header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.analysis-modal header span{color:#20b8ff;font-size:10px;font-weight:1000;letter-spacing:.12em}.analysis-modal h2{margin:4px 0 0;font-size:30px}.analysis-modal header>button{display:grid;place-items:center;width:42px;height:42px;border:1px solid #345264;border-radius:10px;background:#102633;color:#fff}.analysis-loading{display:grid;place-items:center;gap:12px;min-height:260px;text-align:center;color:#b8c8d2}.analysis-loading svg{width:44px;height:44px;color:#20b8ff;animation:aiPulse 1.2s infinite}.analysis-summary{padding:12px;border-left:4px solid #20b8ff;border-radius:8px;background:#102633;line-height:1.45}.analysis-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}.analysis-grid article{padding:12px;border:1px solid #294553;border-radius:12px;background:#0d202c}.analysis-grid h3{margin:0 0 8px;color:#20b8ff;font-size:13px;text-transform:uppercase}.analysis-grid p{margin:7px 0;font-size:12px;line-height:1.35}.analysis-modal blockquote{margin:12px 0;padding:14px;border-radius:12px;background:#062f46;color:#fff;font-size:16px;font-weight:900}.analysis-modal footer{display:flex;justify-content:flex-end;gap:8px}.analysis-modal footer button,.analysis-loading button{min-height:42px;border:1px solid #345264;border-radius:9px;background:#102633;padding:0 13px;color:#fff;font-weight:900}.analysis-modal footer .apply{border-color:#20b8ff;background:#20b8ff;color:#04121b}@keyframes aiPulse{50%{transform:scale(1.15);opacity:.6}}@media(max-width:800px){.analysis-grid{grid-template-columns:1fr}.analysis-modal footer{flex-direction:column}}"
text=text[:idx]+extra+text[idx:]
path.write_text(text)
print('Whiteboard Stage 3 UI added')
