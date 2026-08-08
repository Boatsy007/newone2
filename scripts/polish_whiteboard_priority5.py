from pathlib import Path

p = Path('src/pages/CoachAppWhiteboardStage2.tsx')
s = p.read_text()

# Final polish state.
anchor = "  const[loading,setLoading]=useState(true)"
if "const[saveStatus,setSaveStatus]" not in s:
    s = s.replace(anchor, anchor + "\n  const[saveStatus,setSaveStatus]=useState<'SAVING'|'SAVED'|'OFFLINE'>('SAVED')\n  const[hasOpenedBoard,setHasOpenedBoard]=useState(false)")

anchor = "  const timerRef=useRef<number|undefined>(undefined)"
if "const saveTimerRef" not in s:
    s = s.replace(anchor, anchor + "\n  const saveTimerRef=useRef<number|undefined>(undefined)")

# Replace immediate autosave with visible debounced save state.
old = "  useEffect(()=>{if(!loading)localStorage.setItem(storageKey,JSON.stringify(play))},[play,loading,storageKey])"
new = """  useEffect(()=>{if(loading)return;setSaveStatus('SAVING');if(saveTimerRef.current)window.clearTimeout(saveTimerRef.current);saveTimerRef.current=window.setTimeout(()=>{try{localStorage.setItem(storageKey,JSON.stringify(play));setSaveStatus(navigator.onLine?'SAVED':'OFFLINE')}catch{setSaveStatus('OFFLINE')}},350);return()=>{if(saveTimerRef.current)window.clearTimeout(saveTimerRef.current)}},[play,loading,storageKey])"""
if old in s:
    s = s.replace(old, new, 1)

# Track first useful action/open.
old = "  function updateState(next:BoardState,remember=true){if(remember)snapshot();setPlay(current=>({...current,frames:current.frames.map(frame=>frame.id===current.activeFrameId?{...frame,state:next}:frame)}))}"
new = "  function updateState(next:BoardState,remember=true){setHasOpenedBoard(true);if(remember)snapshot();setPlay(current=>({...current,frames:current.frames.map(frame=>frame.id===current.activeFrameId?{...frame,state:next}:frame)}))}"
if old in s:
    s = s.replace(old, new, 1)

# Upgrade loading state.
old = "  if(loading)return <main className=\"cawb2-loading\">Loading selected team…</main>"
new = """  if(loading)return <main className=\"cawb2-loading\"><div className=\"wb-loader-mark\"><span/><span/><span/><span/></div><b>PLAYFOOTY WHITEBOARD</b><p>Loading your selected team and tactics…</p></main>"""
if old in s:
    s = s.replace(old, new, 1)

# Dynamic saved state and accessible top buttons.
old = "<small>Saved automatically</small>"
new = "<small className={`save-state ${saveStatus.toLowerCase()}`}><i/>{saveStatus==='SAVING'?'Saving…':saveStatus==='OFFLINE'?'Saved on this iPad':'Saved'}</small>"
s = s.replace(old, new, 1)
s = s.replace("<button className=\"back\" onClick={onExit}>", "<button className=\"back\" aria-label={returnToMatch?'Return to live match':'Back to Coach Tools'} onClick={onExit}>", 1)
s = s.replace("<button onClick={()=>setPresenting(true)}><Presentation/>Present</button>", "<button aria-label=\"Open presentation mode\" onClick={()=>setPresenting(true)}><Presentation/>Present</button>", 1)
s = s.replace("<button className=\"wb-more-button\"", "<button aria-label=\"Open more Whiteboard actions\" className=\"wb-more-button\"", 1)

# Core tool accessibility labels and titles.
replacements = {
    "<button className={tool==='MOVE'?'active':''} onClick={()=>setTool('MOVE')}>": "<button title=\"Select and move\" aria-label=\"Select and move players or drawings\" aria-pressed={tool==='MOVE'} className={tool==='MOVE'?'active':''} onClick={()=>setTool('MOVE')}>",
    "<button className={tool==='PEN'?'active':''} onClick={()=>setTool('PEN')}>": "<button title=\"Pen\" aria-label=\"Draw with pen\" aria-pressed={tool==='PEN'} className={tool==='PEN'?'active':''} onClick={()=>setTool('PEN')}>",
    "<button className={tool==='HIGHLIGHT'?'active':''} onClick={()=>setTool('HIGHLIGHT')}>": "<button title=\"Zone highlighter\" aria-label=\"Draw a highlighted zone\" aria-pressed={tool==='HIGHLIGHT'} className={tool==='HIGHLIGHT'?'active':''} onClick={()=>setTool('HIGHLIGHT')}>",
    "<button className={tool==='ARROW'?'active':''} onClick={()=>setTool('ARROW')}>": "<button title=\"Arrow\" aria-label=\"Draw a movement arrow\" aria-pressed={tool==='ARROW'} className={tool==='ARROW'?'active':''} onClick={()=>setTool('ARROW')}>",
    "<button className={tool==='ERASER'?'active':''} onClick={()=>setTool('ERASER')}>": "<button title=\"Eraser\" aria-label=\"Erase a drawing\" aria-pressed={tool==='ERASER'} className={tool==='ERASER'?'active':''} onClick={()=>setTool('ERASER')}>",
    "<button disabled={!undo.length} onClick={undoAction}>": "<button title=\"Undo\" aria-label=\"Undo last Whiteboard change\" disabled={!undo.length} onClick={undoAction}>",
    "<button disabled={!redo.length} onClick={redoAction}>": "<button title=\"Redo\" aria-label=\"Redo Whiteboard change\" disabled={!redo.length} onClick={redoAction}>",
    "<button onClick={clearBoard}><Trash2/>": "<button title=\"Clear current frame\" aria-label=\"Clear players and drawings from current frame\" onClick={clearBoard}><Trash2/>",
}
for old_value, new_value in replacements.items():
    s = s.replace(old_value, new_value, 1)

# Empty-board guidance; it stays subtle and disappears as soon as content exists.
needle = "</svg>{!presenting&&<div className=\"legend\">"
if needle in s and "wb-empty-board" not in s:
    empty = "</svg>{!presenting&&state.magnets.length===0&&state.strokes.length===0&&<div className=\"wb-empty-board\"><div><Users/><b>Build your tactic</b><p>Add individual players, use a quick setup, or start drawing on the oval.</p><button onClick={()=>{setPlayerDrawerOpen(true);setHasOpenedBoard(true)}}>Add players</button></div></div>}{!presenting&&<div className=\"legend\">"
    s = s.replace(needle, empty, 1)

# Replace frame timeline cards with mini visual thumbnails.
old = "{play.frames.map((frame,index)=><button key={frame.id} className={frame.id===play.activeFrameId?'active':''} onClick={()=>{setPlaying(false);setPlay(current=>({...current,activeFrameId:frame.id}))}}><b>{index+1}</b><span>{frame.name}</span></button>)}"
new = """{play.frames.map((frame,index)=><button key={frame.id} aria-label={`Open frame ${index+1}: ${frame.name}`} className={`frame-card ${frame.id===play.activeFrameId?'active':''}`} onClick={()=>{setPlaying(false);setHasOpenedBoard(true);setPlay(current=>({...current,activeFrameId:frame.id}))}}><span className=\"frame-thumb\"><svg viewBox=\"0 0 100 100\" aria-hidden=\"true\"><ellipse cx=\"50\" cy=\"50\" rx=\"43\" ry=\"47\"/><path d=\"M50 3v94M7 50h86\"/>{frame.state.strokes.slice(0,8).map(stroke=>stroke.tool==='ARROW'?<line key={stroke.id} x1={stroke.points[0]?.x} y1={stroke.points[0]?.y} x2={stroke.points.at(-1)?.x} y2={stroke.points.at(-1)?.y}/>:<polyline key={stroke.id} points={stroke.points.map(point=>`${point.x},${point.y}`).join(' ')}/>)}{frame.state.magnets.slice(0,22).map(magnet=><circle key={magnet.id} className={magnet.team==='US'?'us':'them'} cx={magnet.x} cy={magnet.y} r=\"3.5\"/>)}</svg><i>{index+1}</i></span><span className=\"frame-name\">{frame.name}</span></button>)}"""
if old in s:
    s = s.replace(old, new, 1)

# Make add-frame action clearer and accessible.
s = s.replace("<button className=\"add\" onClick={addFrame}><Plus/>Add frame</button>", "<button className=\"add\" aria-label=\"Add a new tactical frame\" onClick={addFrame}><Plus/>Add frame</button>", 1)

# ARIA and keyboard safety for modal wrappers.
s = s.replace("{resultPanel&&<div className=\"cawb2-modal\"><section className=\"wb-result-panel\">", "{resultPanel&&<div className=\"cawb2-modal\" role=\"presentation\"><section className=\"wb-result-panel\" role=\"dialog\" aria-modal=\"true\" aria-label={resultPanel.title}>", 1)
s = s.replace("{uiDialog&&<div className=\"cawb2-modal\"><section className=\"wb-native-dialog\">", "{uiDialog&&<div className=\"cawb2-modal\" role=\"presentation\"><section className=\"wb-native-dialog\" role=\"dialog\" aria-modal=\"true\" aria-label=\"Whiteboard action\">", 1)

# Final visual/responsive/accessibility CSS.
idx = s.rfind('`')
css = r'''
/* Stage 8 Priority 5 — final product polish */
:where(.cawb2 button,.cawb2 input,.cawb2 textarea,.cawb2 select):focus-visible{outline:3px solid rgba(32,184,255,.72)!important;outline-offset:2px!important}
.cawb2 button{transition:transform .14s ease,background-color .16s ease,border-color .16s ease,opacity .16s ease,box-shadow .16s ease}.cawb2 button:active:not(:disabled){transform:scale(.97)}
.wb-topbar,.tools,.timeline,.player-drawer,.magnet-inspector,.stroke-inspector,.wb-more-popover,.wb-native-dialog,.wb-result-panel{animation:wb-fade-in .18s ease both}.player-drawer{animation-name:wb-slide-right}.magnet-inspector,.stroke-inspector,.wb-more-popover{animation-name:wb-slide-left}
@keyframes wb-fade-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}@keyframes wb-slide-right{from{opacity:0;transform:translateX(-18px)}to{opacity:1;transform:none}}@keyframes wb-slide-left{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}
.save-state{display:flex!important;align-items:center;justify-content:center;gap:5px}.save-state i{width:6px;height:6px;border-radius:50%;background:#62d991;box-shadow:0 0 0 3px rgba(98,217,145,.12)}.save-state.saving{color:#f6c945!important}.save-state.saving i{background:#f6c945;animation:wb-pulse 1s infinite}.save-state.offline{color:#9fb3be!important}.save-state.offline i{background:#8296a0}@keyframes wb-pulse{50%{opacity:.35}}
.wb-empty-board{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;z-index:6}.wb-empty-board>div{pointer-events:auto;max-width:310px;text-align:center;padding:22px 24px;border:1px solid rgba(102,184,218,.32);border-radius:20px;background:rgba(4,18,27,.82);backdrop-filter:blur(12px);box-shadow:0 20px 55px rgba(0,0,0,.28)}.wb-empty-board svg{width:30px!important;height:30px!important;color:#20b8ff;margin-bottom:8px}.wb-empty-board b{display:block;font-size:18px}.wb-empty-board p{margin:7px 0 14px;color:#a8bbc5;font-size:13px;line-height:1.45}.wb-empty-board button{min-height:46px;background:#109ee8!important;border:1px solid #55c8ff!important;color:#fff!important;border-radius:12px;padding:0 18px;font-weight:900}
.timeline .frames{align-items:stretch!important}.timeline .frame-card{width:102px!important;min-width:102px!important;height:72px!important;padding:5px!important;display:grid!important;grid-template-rows:48px 14px!important;gap:2px!important;border-radius:12px!important;overflow:hidden!important}.frame-thumb{position:relative;display:block;width:100%;height:48px;border-radius:8px;overflow:hidden;background:#041018}.frame-thumb svg{width:100%;height:100%;display:block}.frame-thumb ellipse{fill:#087d3c;stroke:#41dea0;stroke-width:1.2}.frame-thumb path{fill:none;stroke:rgba(255,255,255,.35);stroke-width:.75}.frame-thumb polyline,.frame-thumb line{fill:none;stroke:#fff;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.frame-thumb circle.us{fill:#20b8ff}.frame-thumb circle.them{fill:#f04452}.frame-thumb i{position:absolute;left:4px;top:4px;width:18px;height:18px;border-radius:6px;background:rgba(2,10,15,.85);display:grid;place-items:center;font-size:9px;font-style:normal;font-weight:900;color:#fff}.frame-name{font-size:10px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;padding:0 2px}.frame-card.active{border-color:#20b8ff!important;box-shadow:0 0 0 2px rgba(32,184,255,.2)!important}.frame-card.active .frame-thumb{box-shadow:inset 0 0 0 2px #20b8ff}
.cawb2-loading{min-height:100dvh;background:#041018;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px}.cawb2-loading b{margin-top:18px;color:#20b8ff;font-size:12px;letter-spacing:.16em}.cawb2-loading p{color:#9fb3be;margin:8px 0 0}.wb-loader-mark{display:flex;align-items:flex-end;gap:5px;height:44px}.wb-loader-mark span{width:6px;border-radius:5px;background:#20b8ff;animation:wb-bars .9s ease-in-out infinite}.wb-loader-mark span:nth-child(1){height:20px}.wb-loader-mark span:nth-child(2){height:38px;animation-delay:.1s}.wb-loader-mark span:nth-child(3){height:38px;animation-delay:.2s}.wb-loader-mark span:nth-child(4){height:20px;animation-delay:.3s}@keyframes wb-bars{50%{transform:scaleY(.55);opacity:.55}}
.cawb2-modal{animation:wb-modal-backdrop .15s ease both}.cawb2-modal>section{animation:wb-modal-card .2s cubic-bezier(.2,.8,.2,1) both}@keyframes wb-modal-backdrop{from{background:rgba(0,0,0,0)}to{background:rgba(0,0,0,.64)}}@keyframes wb-modal-card{from{opacity:0;transform:translateY(18px) scale(.98)}to{opacity:1;transform:none}}
.tools button,.timeline button,.wb-primary-actions button{min-width:44px;min-height:44px}.tools button:disabled,.timeline button:disabled{opacity:.32!important;cursor:not-allowed!important}
@media(max-width:900px) and (orientation:portrait){.cawb2{grid-template-rows:58px minmax(0,1fr)!important}.wb-topbar{height:58px!important;min-height:58px!important;padding:6px 8px!important}.wb-title span{display:none}.wb-title b{font-size:12px}.cawb2 .workspace,.cawb2 .cawb2-workspace{grid-template-columns:1fr!important;grid-template-rows:minmax(0,1fr) 82px 58px!important}.cawb2 .tools,.cawb2 aside.tools{position:fixed!important;left:0!important;right:0!important;bottom:0!important;top:auto!important;width:100%!important;min-width:0!important;height:58px!important;min-height:58px!important;grid-column:auto!important;grid-row:auto!important;flex-direction:row!important;justify-content:center!important;overflow-x:auto!important;border-right:0!important;border-top:1px solid #173844!important;padding:5px 8px!important;z-index:45!important}.cawb2 .tools hr{width:1px;height:38px;margin:4px 2px}.cawb2 .tools button{width:46px!important;min-width:46px!important;height:46px!important;min-height:46px!important}.cawb2 .board,.cawb2 .cawb2-board,.board-wrap{grid-column:1!important;grid-row:1!important;padding:4px!important}.cawb2 .timeline,.cawb2 .cawb2-timeline{grid-column:1!important;grid-row:2!important;height:82px!important;min-height:82px!important;padding:5px 8px!important;margin-bottom:58px!important}.timeline .frame-card{width:88px!important;min-width:88px!important;height:66px!important;grid-template-rows:43px 13px!important}.frame-thumb{height:43px}.frame-actions{display:none!important}.play-controls label,.play-controls .active{display:none!important}.drawing-controls{left:8px!important;right:8px!important;top:64px!important}.player-drawer{left:0!important;top:58px!important;width:100vw!important;bottom:58px!important}.wb-empty-board>div{max-width:270px;padding:17px}.legend{bottom:88px!important}}
@media(prefers-reduced-motion:reduce){.cawb2 *,.cawb2 *::before,.cawb2 *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}
'''
if idx < 0:
    raise SystemExit('style template end not found')
if 'Stage 8 Priority 5' not in s:
    s = s[:idx] + css + s[idx:]

p.write_text(s)
