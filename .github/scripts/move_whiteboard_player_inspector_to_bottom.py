from pathlib import Path

path = Path('src/pages/CoachAppWhiteboardStage2.tsx')
text = path.read_text()

state_anchor = "  const state=activeFrame?.state||emptyBoard\n"
selected_line = "  const selectedMagnet=state.magnets.find(item=>item.id===selectedMagnetId)||null\n"
if selected_line not in text:
    if state_anchor not in text:
        raise SystemExit('state anchor missing')
    text = text.replace(state_anchor, state_anchor + selected_line, 1)

bar = '''    {selectedMagnet&&!presenting&&tool==='MOVE'&&<section className="player-selection-bar" aria-label="Selected player controls"><div className={`player-selection-avatar ${selectedMagnet.team==='US'?'us':'them'}`}><b>{selectedMagnet.number??'—'}</b></div><div className="player-selection-identity"><span>SELECTED PLAYER</span><strong>{selectedMagnet.name}</strong><small>{selectedMagnet.team==='US'?'Your team':'Opposition'}</small></div><label><span>Name</span><input value={selectedMagnet.name} onChange={event=>updateSelectedMagnet({name:event.target.value})}/></label><label className="number-field"><span>Number</span><input inputMode="numeric" value={selectedMagnet.number??''} onChange={event=>updateSelectedMagnet({number:event.target.value===''?null:Number(event.target.value)})}/></label><div className="player-selection-team"><button className={selectedMagnet.team==='US'?'active':''} onClick={()=>updateSelectedMagnet({team:'US'})}>Your team</button><button className={selectedMagnet.team==='THEM'?'active opposition':''} onClick={()=>updateSelectedMagnet({team:'THEM'})}>Opposition</button></div><button className="player-selection-action" onClick={duplicateSelectedMagnet}><Copy/><span>Duplicate</span></button><button className="player-selection-action danger" onClick={removeSelectedMagnet}><Trash2/><span>Remove</span></button><button className="player-selection-close" aria-label="Close selected player controls" onClick={()=>setSelectedMagnetId('')}><X/></button></section>}\n'''
insert_anchor = "    {playerDrawerOpen&&!presenting&&<section className=\"player-bottom-tray\">"
if 'className="player-selection-bar"' not in text:
    if insert_anchor not in text:
        raise SystemExit('player tray insertion anchor missing')
    text = text.replace(insert_anchor, bar + insert_anchor, 1)

css_anchor = "/* Stage 8 Priority 4 — premium drawing */"
css = r'''
/* App-style selected player bar */
.player-selection-bar{position:fixed!important;z-index:89!important;left:74px!important;right:0!important;bottom:0!important;height:88px!important;padding:9px 12px!important;background:rgba(5,22,31,.985)!important;border-top:1px solid #2d5668!important;box-shadow:0 -16px 45px rgba(0,0,0,.4)!important;display:grid!important;grid-template-columns:54px minmax(120px,1.1fr) minmax(150px,1fr) 82px auto 88px 82px 42px!important;align-items:center!important;gap:9px!important;animation:wb-player-tray-in .18s ease both!important}.player-selection-avatar{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;border:3px solid rgba(255,255,255,.85);background:#20b8ff;box-shadow:0 0 0 3px rgba(32,184,255,.18)}.player-selection-avatar.them{background:#f04452;box-shadow:0 0 0 3px rgba(240,68,82,.16)}.player-selection-avatar b{font-size:17px}.player-selection-identity{min-width:0;display:flex;flex-direction:column;line-height:1.12}.player-selection-identity span{color:#20b8ff;font-size:8px;font-weight:950;letter-spacing:.12em}.player-selection-identity strong{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.player-selection-identity small{color:#9fb3be;font-size:9px}.player-selection-bar label{display:grid;gap:3px;min-width:0}.player-selection-bar label>span{color:#91a9b5;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.06em}.player-selection-bar input{width:100%;height:40px;border:1px solid #31505f;border-radius:10px;background:#0c2633;color:#fff;padding:0 10px;font-size:13px;font-weight:800}.player-selection-bar .number-field input{text-align:center}.player-selection-team{display:grid;grid-template-columns:1fr 1fr;gap:5px}.player-selection-team button{height:40px;padding:0 9px;border:1px solid #31505f;border-radius:10px;background:#0c2633;color:#c7d5dc;font-size:9px;font-weight:900;white-space:nowrap}.player-selection-team button.active{background:#109ee8;border-color:#5ac8ff;color:#fff}.player-selection-team button.opposition.active{background:#b92f40;border-color:#f36b78}.player-selection-action{height:48px;padding:0 9px;border:1px solid #31505f;border-radius:11px;background:#0c2633;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:9px;font-weight:900}.player-selection-action svg{width:18px;height:18px}.player-selection-action.danger{background:#461922;border-color:#7b2c39;color:#ffdce1}.player-selection-close{width:42px;height:42px;padding:0!important;display:grid!important;place-items:center!important;border-radius:11px!important}.cawb2:has(.player-selection-bar) .legend{bottom:96px!important}.magnet-inspector{display:none!important}@media(max-width:1050px){.player-selection-bar{left:64px!important;grid-template-columns:48px minmax(100px,1fr) minmax(130px,1fr) 72px auto 72px 68px 38px!important;gap:6px!important;padding:7px 8px!important}.player-selection-action{font-size:8px}.player-selection-team button{font-size:8px;padding:0 6px}}@media(max-width:800px){.player-selection-bar{left:64px!important;height:104px!important;grid-template-columns:44px minmax(100px,1fr) 100px auto 64px 38px!important;grid-template-rows:44px 42px!important}.player-selection-avatar{width:42px;height:42px}.player-selection-bar label{grid-row:2}.player-selection-team{grid-column:4;grid-row:1/3}.player-selection-action{height:42px}.player-selection-action span{display:none}.player-selection-close{grid-column:6;grid-row:1}.cawb2:has(.player-selection-bar) .legend{bottom:112px!important}}

'''
if css.strip() not in text:
    if css_anchor not in text:
        raise SystemExit('CSS anchor missing')
    text = text.replace(css_anchor, css + css_anchor, 1)

path.write_text(text)
