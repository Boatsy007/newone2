from pathlib import Path
import re

path = Path('src/pages/CoachAppWhiteboardStage2.tsx')
s = path.read_text()

# State: the play/frame builder is hidden until explicitly opened from More.
anchor = "  const[playerDrawerOpen,setPlayerDrawerOpen]=useState(false)"
if "const[playBuilderOpen,setPlayBuilderOpen]" not in s:
    s = s.replace(anchor, anchor + "\n  const[playBuilderOpen,setPlayBuilderOpen]=useState(false)", 1)

# Use a true horizontal AFL field coordinate system.
s = s.replace("const[viewport,setViewport]=useState({x:0,y:0,w:100,h:100})", "const[viewport,setViewport]=useState({x:0,y:0,w:160,h:100})", 1)
s = s.replace("function resetZoom(){setViewport({x:0,y:0,w:100,h:100})}", "function resetZoom(){setViewport({x:0,y:0,w:160,h:100})}", 1)

# Accurate SVG pointer conversion. This fixes the pen/arrow being offset from the finger,
# including when the SVG is scaled or zoomed on iPad.
point_pattern = re.compile(r"  const point=\(event:React\.PointerEvent<SVGSVGElement>\):Point=>\{.*?\}\n  function startBoard", re.S)
point_replacement = """  const pointFromClient=(clientX:number,clientY:number):Point=>{const svg=svgRef.current;if(!svg)return{x:0,y:0};const matrix=svg.getScreenCTM();if(!matrix)return{x:0,y:0};const svgPoint=svg.createSVGPoint();svgPoint.x=clientX;svgPoint.y=clientY;const local=svgPoint.matrixTransform(matrix.inverse());return{x:Math.max(0,Math.min(100,local.x/1.6)),y:Math.max(0,Math.min(100,local.y))}}\n  const point=(event:React.PointerEvent<SVGSVGElement>):Point=>pointFromClient(event.clientX,event.clientY)\n  function startBoard"""
if point_pattern.search(s):
    s = point_pattern.sub(point_replacement, s, count=1)
else:
    raise SystemExit('Could not find pointer mapping block')

# Magnet dragging uses the same accurate coordinate conversion.
move_magnet_pattern = re.compile(r"  function moveMagnet\(event:React\.PointerEvent<SVGGElement>,id:string\)\{.*?\}\n  function endMagnet", re.S)
move_magnet_replacement = """  function moveMagnet(event:React.PointerEvent<SVGGElement>,id:string){if(dragging!==id||tool!=='MOVE')return;const p=pointFromClient(event.clientX,event.clientY);setPlay(current=>({...current,frames:current.frames.map(frame=>frame.id===current.activeFrameId?{...frame,state:{...frame.state,magnets:frame.state.magnets.map(m=>m.id===id?{...m,x:Math.max(3,Math.min(97,p.x)),y:Math.max(4,Math.min(96,p.y))}:m)}}:frame)}))}\n  function endMagnet"""
if move_magnet_pattern.search(s):
    s = move_magnet_pattern.sub(move_magnet_replacement, s, count=1)
else:
    raise SystemExit('Could not find magnet move block')

# Zoom keeps the horizontal 160:100 ratio.
zoom_pattern = re.compile(r"  function zoomBoard\(direction:1\|-1\)\{.*?\}\n  function resetZoom", re.S)
zoom_replacement = """  function zoomBoard(direction:1|-1){setViewport(current=>{const factor=direction===1?.82:1.22;const w=Math.max(64,Math.min(160,current.w*factor));const h=w/1.6;const cx=current.x+current.w/2;const cy=current.y+current.h/2;return{x:Math.max(0,Math.min(160-w,cx-w/2)),y:Math.max(0,Math.min(100-h,cy-h/2)),w,h}})}\n  function resetZoom"""
if zoom_pattern.search(s):
    s = zoom_pattern.sub(zoom_replacement, s, count=1)

# Helpers for the new bottom player strip.
helper_anchor = "  function optionOnField(id:string){return state.magnets.some(item=>item.id===id)}"
if "function trayTogglePlayer" not in s:
    helpers = """
  function trayTogglePlayer(option:PlayerOption){const existing=state.magnets.find(item=>item.id===option.id);if(existing){updateState({...state,magnets:state.magnets.filter(item=>item.id!==option.id)});return}const sideCount=state.magnets.filter(item=>item.team===option.team).length;const stagedX=option.team==='US'?8:92;const stagedY=12+(sideCount%8)*10;updateState({...state,magnets:[...state.magnets,{id:option.id,name:option.name,number:option.number,team:option.team,x:option.position?.x??stagedX,y:option.position?.y??stagedY}]})}
  function trayAddAll(team:'US'|'THEM'){const options=team==='US'?ourPlayers:oppositionPlayers;const retained=state.magnets.filter(item=>item.team!==team);const additions=options.map((option,index)=>({id:option.id,name:option.name,number:option.number,team:option.team,x:option.position?.x??(team==='US'?10+(index%6)*13:90-(index%6)*13),y:option.position?.y??(14+Math.floor(index/6)*17)}));updateState({...state,magnets:[...retained,...additions]})}
  function trayRemoveAll(team:'US'|'THEM'){updateState({...state,magnets:state.magnets.filter(item=>item.team!==team)})}
"""
    s = s.replace(helper_anchor, helper_anchor + helpers, 1)

# Add Players to the permanent left tool rail.
move_button = "<button title=\"Select and move\" aria-label=\"Select and move players or drawings\" aria-pressed={tool==='MOVE'} className={tool==='MOVE'?'active':''} onClick={()=>setTool('MOVE')}><MousePointer2/><span>Move</span></button>"
players_button = move_button + "<button title=\"Add players\" aria-label=\"Open player strip\" aria-pressed={playerDrawerOpen} className={playerDrawerOpen?'active':''} onClick={()=>setPlayerDrawerOpen(value=>!value)}><Users/><span>Players</span></button>"
if move_button in s and "aria-label=\"Open player strip\"" not in s:
    s = s.replace(move_button, players_button, 1)

# Bottom player strip. It uses the actual selected team and a switchable opposition list.
board_marker = "    <section className=\"board-wrap\">"
if "className=\"player-bottom-tray\"" not in s:
    tray = """    {playerDrawerOpen&&!presenting&&<section className=\"player-bottom-tray\"><header><div><span>ADD PLAYERS</span><b>{playerTab==='US'?'Our team':'Opposition'}</b></div><div className=\"player-tray-tabs\"><button className={playerTab==='US'?'active':''} onClick={()=>setPlayerTab('US')}>Our team</button><button className={playerTab==='THEM'?'active':''} onClick={()=>setPlayerTab('THEM')}>Opposition</button></div><div className=\"player-tray-actions\"><button onClick={()=>trayAddAll(playerTab==='US'?'US':'THEM')}>Add all</button><button onClick={()=>trayRemoveAll(playerTab==='US'?'US':'THEM')}>Remove all</button><button aria-label=\"Close player strip\" onClick={()=>setPlayerDrawerOpen(false)}><X/></button></div></header><div className=\"player-tray-list\">{(playerTab==='US'?ourPlayers:oppositionPlayers).map(option=><button key={option.id} className={optionOnField(option.id)?'on-field':''} onClick={()=>trayTogglePlayer(option)}><b>{option.number??'—'}</b><span>{option.name}</span><small>{optionOnField(option.id)?'On field':'Tap to add'}</small></button>)}</div></section>}\n"""
    s = s.replace(board_marker, tray + board_marker, 1)

# Hide the animated play builder by default; it is opened from More.
s = s.replace("return <main className={`cawb2 ${presenting?'presenting':''}`}", "return <main className={`cawb2 ${presenting?'presenting':''} ${playBuilderOpen?'play-builder-open':''}`}", 1)
s = s.replace("    {!presenting&&<footer className=\"timeline\">", "    {!presenting&&playBuilderOpen&&<footer className=\"timeline\">", 1)

# Add a clear Play Builder switch inside the More panel.
more_pattern = re.compile(r"(\{moreOpen&&<(?:aside|div) className=\"wb-more-popover\"[^>]*>)")
if "play-builder-toggle" not in s:
    s, count = more_pattern.subn(r"\1<button className=\"play-builder-toggle\" onClick={()=>{setPlayBuilderOpen(value=>!value);setMoreOpen(false)}}><Film/><span><b>{playBuilderOpen?'Hide Play Builder':'Open Play Builder'}</b><small>Frames, animation and video tools</small></span></button>", s, count=1)
    if count == 0:
        raise SystemExit('Could not find More popover')

# Horizontal field geometry and rendering coordinates.
s = s.replace('<rect width="100" height="100" rx="2" fill="#06131c"/>', '<rect width="160" height="100" rx="2" fill="#06131c"/>', 1)
s = s.replace('<ellipse cx="50" cy="50" rx="43" ry="47" fill="#078b40" stroke="#39f49b" strokeWidth=".7"/>', '<ellipse cx="80" cy="50" rx="74" ry="45" fill="#078b40" stroke="#39f49b" strokeWidth=".7"/>', 1)
s = s.replace('<path d="M50 3v94M7 50h86"', '<path d="M80 5v90M6 50h148"', 1)
s = s.replace('<rect x="38" y="41" width="24" height="18"', '<rect x="61" y="38" width="38" height="24"', 1)
s = s.replace('<circle cx="50" cy="50" r="4"', '<circle cx="80" cy="50" r="5"', 1)
s = s.replace('<path d="M27 17 Q50 35 73 17M27 83 Q50 65 73 83"', '<path d="M42 12 Q80 34 118 12M42 88 Q80 66 118 88"', 1)
s = s.replace('<path d="M44 4v5M48 3v7M52 3v7M56 4v5M44 96v-5M48 97v-7M52 97v-7M56 96v-5"', '<path d="M70 5v7M76 4v9M84 4v9M90 5v7M70 95v-7M76 96v-9M84 96v-9M90 95v-7"', 1)

# Main board stroke and magnet x coordinates use the wider field.
s = s.replace('x1={stroke.points[0]?.x}', 'x1={(stroke.points[0]?.x??0)*1.6}')
s = s.replace('x2={stroke.points.at(-1)?.x}', 'x2={(stroke.points.at(-1)?.x??0)*1.6}')
s = s.replace("points={stroke.points.map(p=>`${p.x},${p.y}`).join(' ')}", "points={stroke.points.map(p=>`${p.x*1.6},${p.y}`).join(' ')}")
s = s.replace("transform={`translate(${m.x} ${m.y})`}", "transform={`translate(${m.x*1.6} ${m.y})`}", 1)

# The existing drawer is superseded by the bottom strip.
css = r'''
/* Whiteboard horizontal AFL workspace */
.cawb2{grid-template-columns:74px minmax(0,1fr)!important;grid-template-rows:64px minmax(0,1fr)!important}
.cawb2.play-builder-open{grid-template-rows:64px minmax(0,1fr) 112px!important}
.cawb2>.tools{grid-column:1!important;grid-row:2!important;height:auto!important;min-height:0!important}
.cawb2.play-builder-open>.tools{grid-row:2/4!important}
.cawb2>.board-wrap{grid-column:2!important;grid-row:2!important;min-width:0!important;min-height:0!important;width:100%!important;height:100%!important;padding:8px 12px!important;display:block!important}
.cawb2>.board-wrap>svg{display:block!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;aspect-ratio:16/10!important}
.cawb2>.timeline{grid-column:2!important;grid-row:3!important}
.play-builder-toggle{width:100%!important;min-height:62px!important;margin:0 0 12px!important;padding:10px 12px!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:12px!important;border:1px solid #249fd5!important;background:#0c3144!important;border-radius:14px!important;color:#fff!important}.play-builder-toggle>svg{width:24px!important}.play-builder-toggle>span{display:grid!important;text-align:left!important}.play-builder-toggle b{font-size:13px!important}.play-builder-toggle small{color:#9fc5d8!important;font-size:10px!important}
.player-drawer{display:none!important}
.player-bottom-tray{position:fixed!important;z-index:90!important;left:74px!important;right:0!important;bottom:0!important;height:188px!important;padding:10px 12px 12px!important;background:rgba(5,22,31,.98)!important;border-top:1px solid #2d5668!important;box-shadow:0 -18px 50px rgba(0,0,0,.42)!important;display:grid!important;grid-template-rows:auto minmax(0,1fr)!important;gap:9px!important;animation:wb-player-tray-in .18s ease both!important}.player-bottom-tray header{display:grid!important;grid-template-columns:auto 1fr auto!important;align-items:center!important;gap:12px!important}.player-bottom-tray header span{display:block;color:#20b8ff;font-size:9px;font-weight:950;letter-spacing:.12em}.player-bottom-tray header b{font-size:15px}.player-tray-tabs{display:flex!important;justify-content:center!important;gap:7px!important}.player-tray-tabs button,.player-tray-actions button{min-height:40px!important;border:1px solid #31505f!important;border-radius:10px!important;background:#0c2633!important;color:#fff!important;padding:0 12px!important;font-weight:900!important}.player-tray-tabs button.active{background:#109ee8!important;border-color:#55c8ff!important}.player-tray-actions{display:flex!important;gap:7px!important}.player-tray-actions button:first-child{background:#109ee8!important;border-color:#55c8ff!important}.player-tray-actions button:last-child{width:40px!important;padding:0!important;justify-content:center!important}.player-tray-list{display:flex!important;gap:8px!important;overflow-x:auto!important;overflow-y:hidden!important;padding:1px 1px 5px!important;-webkit-overflow-scrolling:touch!important}.player-tray-list>button{flex:0 0 142px!important;height:104px!important;padding:9px!important;display:grid!important;grid-template-columns:34px 1fr!important;grid-template-rows:1fr auto!important;align-items:center!important;gap:3px 8px!important;border:1px solid #31505f!important;border-radius:13px!important;background:#0b2230!important;color:#fff!important;text-align:left!important}.player-tray-list>button>b{grid-row:1/3;display:grid!important;place-items:center!important;width:34px!important;height:34px!important;border-radius:10px!important;background:#06131c!important;font-size:14px!important}.player-tray-list>button>span{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:12px!important;font-weight:900!important}.player-tray-list>button>small{color:#8fa9b7!important;font-size:9px!important}.player-tray-list>button.on-field{border-color:#20b8ff!important;background:#0d3d55!important;box-shadow:inset 0 0 0 1px rgba(32,184,255,.3)!important}.player-tray-list>button.on-field small{color:#63dca1!important}@keyframes wb-player-tray-in{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@media(max-width:900px) and (orientation:landscape){.cawb2{grid-template-columns:64px minmax(0,1fr)!important}.player-bottom-tray{left:64px!important;height:170px!important}.player-tray-list>button{flex-basis:128px!important;height:88px!important}.cawb2>.board-wrap{padding:5px 8px!important}}
'''
idx = s.rfind('`')
if idx < 0:
    raise SystemExit('Could not locate styles end')
if 'Whiteboard horizontal AFL workspace' not in s:
    s = s[:idx] + css + s[idx:]

path.write_text(s)
