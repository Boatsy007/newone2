from pathlib import Path

path = Path('src/pages/CoachAppWhiteboardStage2.tsx')
text = path.read_text()

text = text.replace(
"type PlayerOption={id:string;name:string;number:number|null;team:'US'|'THEM';position?:Point}",
"type PlayerOption={id:string;name:string;number:number|null;team:'US'|'THEM';position?:Point;positionCode?:string}"
)

state_anchor = "  const[playerTab,setPlayerTab]=useState<'US'|'THEM'|'GENERIC'>('US')\n"
if "const[playerArea,setPlayerArea]" not in text:
    if state_anchor not in text:
        raise SystemExit('playerTab state anchor missing')
    text = text.replace(state_anchor, state_anchor + "  const[playerArea,setPlayerArea]=useState<'ALL'|'FWD'|'MID'|'DEF'>('ALL')\n", 1)

text = text.replace(
"          position:FIELD_POSITIONS[player.positionCode]||{x:15+(index%6)*14,y:18+Math.floor(index/6)*15},\n",
"          position:FIELD_POSITIONS[player.positionCode]||{x:15+(index%6)*14,y:18+Math.floor(index/6)*15},\n          positionCode:player.positionCode,\n",
1
)
text = text.replace(
"            position:FIELD_POSITIONS[player.positionCode]||{x:85-(index%6)*14,y:18+Math.floor(index/6)*15},\n",
"            position:FIELD_POSITIONS[player.positionCode]||{x:85-(index%6)*14,y:18+Math.floor(index/6)*15},\n            positionCode:player.positionCode,\n",
1
)

render_anchor = "  const strokes=[...state.strokes,...(drawing?[drawing]:[])]\n"
filter_code = """  const areaPositionCodes:Record<'FWD'|'MID'|'DEF',Set<string>>={
    FWD:new Set(['FF','FP_LEFT','FP_RIGHT','CHF','HFF_LEFT','HFF_RIGHT']),
    MID:new Set(['RUCK','RR','ROVER','C','W_LEFT','W_RIGHT']),
    DEF:new Set(['FB','BP_LEFT','BP_RIGHT','CHB','HBF_LEFT','HBF_RIGHT']),
  }
  const trayPlayers=(playerTab==='US'?ourPlayers:oppositionPlayers).filter(option=>playerArea==='ALL'||Boolean(option.positionCode&&areaPositionCodes[playerArea].has(option.positionCode)))
"""
if "const trayPlayers=" not in text:
    if render_anchor not in text:
        raise SystemExit('render anchor missing')
    text = text.replace(render_anchor, filter_code + render_anchor, 1)

old_tray = "{playerDrawerOpen&&!presenting&&<section className=\"player-bottom-tray\"><header><div><span>ADD PLAYERS</span><b>{playerTab==='US'?'Our team':'Opposition'}</b></div><div className=\"player-tray-tabs\"><button className={playerTab==='US'?'active':''} onClick={()=>setPlayerTab('US')}>Our team</button><button className={playerTab==='THEM'?'active':''} onClick={()=>setPlayerTab('THEM')}>Opposition</button></div><div className=\"player-tray-actions\"><button onClick={()=>trayAddAll(playerTab==='US'?'US':'THEM')}>Add all</button><button onClick={()=>trayRemoveAll(playerTab==='US'?'US':'THEM')}>Remove all</button><button aria-label=\"Close player strip\" onClick={()=>setPlayerDrawerOpen(false)}><X/></button></div></header><div className=\"player-tray-list\">{(playerTab==='US'?ourPlayers:oppositionPlayers).map(option=><button key={option.id} className={optionOnField(option.id)?'on-field':''} onClick={()=>trayTogglePlayer(option)}><b>{option.number??'—'}</b><span>{option.name}</span><small>{optionOnField(option.id)?'On field':'Tap to add'}</small></button>)}</div></section>}"
new_tray = "{playerDrawerOpen&&!presenting&&<section className=\"player-bottom-tray\"><header><div><span>ADD PLAYERS</span><b>{playerTab==='US'?'Our team':'Opposition'}</b></div><div className=\"player-tray-tabs\"><button className={playerTab==='US'?'active':''} onClick={()=>setPlayerTab('US')}>Our team</button><button className={playerTab==='THEM'?'active':''} onClick={()=>setPlayerTab('THEM')}>Opposition</button></div><div className=\"player-area-filters\" aria-label=\"Filter players by field area\">{(['FWD','DEF','MID','ALL'] as const).map(area=><button key={area} className={playerArea===area?'active':''} onClick={()=>setPlayerArea(area)}>{area}</button>)}</div><div className=\"player-tray-actions\"><button onClick={()=>trayAddAll(playerTab==='US'?'US':'THEM')}>Add all</button><button onClick={()=>trayRemoveAll(playerTab==='US'?'US':'THEM')}>Remove all</button><button aria-label=\"Close player strip\" onClick={()=>setPlayerDrawerOpen(false)}><X/></button></div></header><div className=\"player-tray-list\">{trayPlayers.map(option=><button key={option.id} className={optionOnField(option.id)?'on-field':''} onClick={()=>trayTogglePlayer(option)}><b>{option.number??'—'}</b><span>{option.name}</span><small>{optionOnField(option.id)?'On field':'Tap to add'}</small></button>)}</div></section>}"
if old_tray in text:
    text = text.replace(old_tray, new_tray, 1)
elif 'className="player-area-filters"' not in text:
    raise SystemExit('bottom player tray anchor missing')

css_anchor = "/* App-style selected player bar */"
css = """
/* Whiteboard player area quick filters */
.player-area-filters{display:flex;align-items:center;gap:5px;min-width:max-content}.player-area-filters button{height:34px;min-width:46px;padding:0 10px;border:1px solid #31505f;border-radius:9px;background:#0c2633;color:#b9cbd4;font-size:9px;font-weight:950;letter-spacing:.04em}.player-area-filters button.active{background:#109ee8;border-color:#65d0ff;color:#fff;box-shadow:0 0 0 2px rgba(32,184,255,.16)}@media(max-width:900px) and (orientation:landscape){.player-area-filters{gap:4px}.player-area-filters button{min-width:42px;height:32px;padding:0 7px;font-size:8px}}

"""
if css.strip() not in text:
    if css_anchor not in text:
        raise SystemExit('CSS anchor missing')
    text = text.replace(css_anchor, css + css_anchor, 1)

path.write_text(text)
