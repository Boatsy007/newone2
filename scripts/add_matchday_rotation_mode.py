from pathlib import Path

path = Path('src/pages/CoachAppMatchDay.tsx')
text = path.read_text()

replacements = []

def replace_once(old: str, new: str, label: str):
    global text
    if old not in text:
        raise SystemExit(f'Missing anchor: {label}')
    text = text.replace(old, new, 1)

replace_once(
"const DOUBLE_TAP_MS=330\n",
"const DOUBLE_TAP_MS=330\nconst ROTATION_HOLD_MS=650\n",
"rotation hold constant",
)

replace_once(
"  const[selected,setSelected]=useState('')\n",
"  const[selected,setSelected]=useState('')\n  const[rotation,setRotation]=useState<string[]>([])\n",
"rotation state",
)

old_choose = """  function choosePlayer(id:string){if(!selected){setSelected(id);return}if(selected===id){setSelected('');return}update(current=>{const tracked=accrueTracking(current);const first=tracked.slots.find(slot=>slot.clubPlayerId===selected);const second=tracked.slots.find(slot=>slot.clubPlayerId===id);if(!first||!second||first.injured||second.injured)return tracked;const firstData=playerPayload(first);const secondData=playerPayload(second);const swappedAt=Date.now();const slots=tracked.slots.map(slot=>{if(slot.clubPlayerId===first.clubPlayerId){const destinationOnGround=isOnGround(slot.positionCode);const incomingRemainedOnBench=!second.onGround&&!destinationOnGround;return {...slot,...secondData,onGround:destinationOnGround,benchEnteredAt:destinationOnGround?null:(incomingRemainedOnBench?secondData.benchEnteredAt:swappedAt)}}if(slot.clubPlayerId===second.clubPlayerId){const destinationOnGround=isOnGround(slot.positionCode);const incomingRemainedOnBench=!first.onGround&&!destinationOnGround;return {...slot,...firstData,onGround:destinationOnGround,benchEnteredAt:destinationOnGround?null:(incomingRemainedOnBench?firstData.benchEnteredAt:swappedAt)}}return slot});const event:MatchEvent={id:crypto.randomUUID(),quarter:tracked.quarter,seconds:now(tracked),kind:'SWAP',label:`${first.playerName} swapped with ${second.playerName}`};return {...tracked,slots,events:[event,...tracked.events]}});setSelected('')}\n"""
new_choose = """  function startRotation(code:string){setSelected('');setRotation([code]);if(navigator.vibrate)navigator.vibrate(30)}
  function choosePlayer(id:string,code:string){
    if(rotation.length){
      const closed=rotation.length>=4&&rotation[rotation.length-1]===rotation[0]
      if(closed||code===rotation[rotation.length-1])return
      if(code===rotation[0]){if(rotation.length>=3)setRotation(current=>[...current,code]);return}
      if(rotation.includes(code))return
      setRotation(current=>[...current,code])
      return
    }
    if(!selected){setSelected(id);return}
    if(selected===id){setSelected('');return}
    update(current=>{const tracked=accrueTracking(current);const first=tracked.slots.find(slot=>slot.clubPlayerId===selected);const second=tracked.slots.find(slot=>slot.clubPlayerId===id);if(!first||!second||first.injured||second.injured)return tracked;const firstData=playerPayload(first);const secondData=playerPayload(second);const swappedAt=Date.now();const slots=tracked.slots.map(slot=>{if(slot.clubPlayerId===first.clubPlayerId){const destinationOnGround=isOnGround(slot.positionCode);const incomingRemainedOnBench=!second.onGround&&!destinationOnGround;return {...slot,...secondData,onGround:destinationOnGround,benchEnteredAt:destinationOnGround?null:(incomingRemainedOnBench?secondData.benchEnteredAt:swappedAt)}}if(slot.clubPlayerId===second.clubPlayerId){const destinationOnGround=isOnGround(slot.positionCode);const incomingRemainedOnBench=!first.onGround&&!destinationOnGround;return {...slot,...firstData,onGround:destinationOnGround,benchEnteredAt:destinationOnGround?null:(incomingRemainedOnBench?firstData.benchEnteredAt:swappedAt)}}return slot});const event:MatchEvent={id:crypto.randomUUID(),quarter:tracked.quarter,seconds:now(tracked),kind:'SWAP',label:`${first.playerName} swapped with ${second.playerName}`};return {...tracked,slots,events:[event,...tracked.events]}});setSelected('')
  }
  function undoRotationStep(){setRotation(current=>current.slice(0,-1))}
  function cancelRotation(){setRotation([])}
  function confirmRotation(){
    if(rotation.length<4||rotation[rotation.length-1]!==rotation[0])return
    const path=rotation.slice(0,-1)
    update(current=>{
      const tracked=accrueTracking(current)
      const byPosition=new Map(tracked.slots.map(slot=>[slot.positionCode,slot]))
      if(path.some(code=>!byPosition.has(code)))return tracked
      const sourceForDestination=new Map<string,Slot>()
      path.forEach((sourceCode,index)=>sourceForDestination.set(path[(index+1)%path.length],byPosition.get(sourceCode)!))
      const movedAt=Date.now()
      const slots=tracked.slots.map(destination=>{
        const source=sourceForDestination.get(destination.positionCode)
        if(!source)return destination
        const destinationOnGround=isOnGround(destination.positionCode)
        const incomingRemainedOnBench=!source.onGround&&!destinationOnGround
        return {...destination,...playerPayload(source),onGround:destinationOnGround,benchEnteredAt:destinationOnGround?null:(incomingRemainedOnBench?source.benchEnteredAt:movedAt)}
      })
      const names=path.map(code=>byPosition.get(code)?.playerName).filter(Boolean).join(' → ')
      const event:MatchEvent={id:crypto.randomUUID(),quarter:tracked.quarter,seconds:now(tracked),kind:'SWAP',label:`${path.length}-player rotation: ${names}`}
      return {...tracked,slots,events:[event,...tracked.events]}
    })
    setRotation([])
  }
"""
replace_once(old_choose, new_choose, "choosePlayer function")

replace_once(
"      <div className=\"camd-ground-head\"><p>Forward line to backline. Tap two players to interchange. Double tap or hold an interchange player to mark injured.</p>{selected&&<b>Choose replacement</b>}</div>\n",
"      <div className=\"camd-ground-head\"><p>{rotation.length?'Rotation Mode: tap each destination, then tap the starting position to close the rotation.':'Forward line to backline. Tap two players to swap. Hold any player for a multi-player rotation. Double tap an interchange player to mark injured.'}</p>{rotation.length?<b>Rotation {Math.min(rotation.length,rotation[rotation.length-1]===rotation[0]?rotation.length-1:rotation.length)}</b>:selected&&<b>Choose replacement</b>}</div>\n",
"ground instructions",
)

old_bench = "{BENCH.map(code=><PlayerTile key={code} code={code} slot={state.slots.find(item=>item.positionCode===code)} selected={selected} totalTrackedSeconds={state.totalTrackedSeconds} onChoose={choosePlayer} onScore={addScore} onToggleInjury={toggleInjury}/>)}"
new_bench = "{BENCH.map(code=><PlayerTile key={code} code={code} slot={state.slots.find(item=>item.positionCode===code)} selected={selected} rotationIndex={rotation.indexOf(code)} rotationActive={rotation.length>0} totalTrackedSeconds={state.totalTrackedSeconds} onChoose={choosePlayer} onStartRotation={startRotation} onScore={addScore} onToggleInjury={toggleInjury}/>)}"
replace_once(old_bench, new_bench, "bench tiles")

old_field = "{row.map(code=><PlayerTile key={code} code={code} slot={state.slots.find(item=>item.positionCode===code)} selected={selected} totalTrackedSeconds={state.totalTrackedSeconds} onChoose={choosePlayer} onScore={addScore} onToggleInjury={toggleInjury}/>)}"
new_field = "{row.map(code=><PlayerTile key={code} code={code} slot={state.slots.find(item=>item.positionCode===code)} selected={selected} rotationIndex={rotation.indexOf(code)} rotationActive={rotation.length>0} totalTrackedSeconds={state.totalTrackedSeconds} onChoose={choosePlayer} onStartRotation={startRotation} onScore={addScore} onToggleInjury={toggleInjury}/>)}"
replace_once(old_field, new_field, "field tiles")

replace_once(
"    <footer><button onClick={onBack}>Return to Select Side</button></footer>\n",
"    {rotation.length?<footer className=\"camd-rotation-bar\"><div><b>Rotation Mode</b><span>{rotation.slice(0,-1).concat(rotation[rotation.length-1]===rotation[0]?[]:[rotation[rotation.length-1]]).map((code,index)=>`${index+1}. ${LABELS[code]||code}`).join(' → ')}</span></div><button onClick={cancelRotation}>Cancel</button><button onClick={undoRotationStep} disabled={rotation.length<=1}>Undo step</button><button className=\"confirm\" onClick={confirmRotation} disabled={rotation.length<4||rotation[rotation.length-1]!==rotation[0]}>Confirm rotation</button></footer>:<footer><button onClick={onBack}>Return to Select Side</button></footer>}\n",
"rotation footer",
)

start = text.index("function PlayerTile(")
end = text.index("\n}\n\nconst styles=`", start) + 2
old_tile = text[start:end]
new_tile = """function PlayerTile({code,slot,selected,rotationIndex,rotationActive,totalTrackedSeconds,onChoose,onStartRotation,onScore,onToggleInjury}:{code:string;slot:Slot|undefined;selected:string;rotationIndex:number;rotationActive:boolean;totalTrackedSeconds:number;onChoose:(id:string,code:string)=>void;onStartRotation:(code:string)=>void;onScore:(side:'HOME'|'AWAY',points:1|6,scorerId?:string)=>void;onToggleInjury:(id:string)=>void}){
  const lastTap=useRef(0)
  const holdTimer=useRef<number|undefined>(undefined)
  const holdTriggered=useRef(false)
  const isInterchange=INTERCHANGE_POSITIONS.has(code)
  const benchSeconds=slot?.benchEnteredAt?Math.floor((Date.now()-slot.benchEnteredAt)/1000):0
  const benchStatus=!slot||!isInterchange?'':slot.benchEnteredAt===null?'green':benchSeconds>=GREEN_AFTER_SECONDS?'green':benchSeconds>=ORANGE_AFTER_SECONDS?'orange':'red'
  const percentage=slot?(totalTrackedSeconds>0?Math.max(0,Math.min(100,Math.round((slot.onGroundSeconds/totalTrackedSeconds)*100))):(slot.onGround?100:0)):0
  function startHold(event:React.PointerEvent<HTMLButtonElement>){if(!slot||slot.injured||rotationActive)return;holdTriggered.current=false;event.currentTarget.setPointerCapture?.(event.pointerId);holdTimer.current=window.setTimeout(()=>{holdTriggered.current=true;lastTap.current=0;onStartRotation(code)},ROTATION_HOLD_MS)}
  function cancelHold(){if(holdTimer.current)window.clearTimeout(holdTimer.current);holdTimer.current=undefined}
  function handleClick(){if(!slot||holdTriggered.current){holdTriggered.current=false;return}if(!rotationActive&&isInterchange){const current=Date.now();if(current-lastTap.current<=DOUBLE_TAP_MS){lastTap.current=0;onToggleInjury(slot.clubPlayerId);return}lastTap.current=current}if(slot.injured)return;onChoose(slot.clubPlayerId,code)}
  return <button className={`camd-player ${slot&&selected===slot.clubPlayerId?'selected':''} ${rotationIndex>=0?'rotation-selected':''} ${benchStatus?`bench-${benchStatus}`:''} ${slot?.injured?'injured':''}`} disabled={!slot} onPointerDown={startHold} onPointerUp={cancelHold} onPointerCancel={cancelHold} onPointerLeave={cancelHold} onContextMenu={event=>event.preventDefault()} onClick={handleClick}>{rotationIndex>=0&&<i className="rotation-number">{rotationIndex+1}</i>}<small>{LABELS[code]||code}</small>{slot?<><strong>{slot.jumperNumber||'—'}</strong><span>{slot.playerName}</span>{isInterchange&&slot.benchEnteredAt!==null&&<i className="bench-timer">{formatBenchTime(benchSeconds)}</i>}{slot.injured&&<i className="injury-label">INJURED</i>}<div className="player-data"><em className="tog">{percentage}%</em><em className="pm">{slot.plusMinus>0?'+':''}{slot.plusMinus}</em></div><div className={`player-score ${isInterchange?'disabled':''}`}><button type="button" disabled={isInterchange||rotationActive} aria-disabled={isInterchange||rotationActive} onClick={event=>{event.stopPropagation();if(!isInterchange&&!rotationActive)onScore('HOME',6,slot.clubPlayerId)}}>G <b>{slot.goals}</b></button><button type="button" disabled={isInterchange||rotationActive} aria-disabled={isInterchange||rotationActive} onClick={event=>{event.stopPropagation();if(!isInterchange&&!rotationActive)onScore('HOME',1,slot.clubPlayerId)}}>B <b>{slot.behinds}</b></button></div></>:<span>Empty</span>}</button>
}"""
text = text[:start] + new_tile + text[end:]

replace_once(
".camd-player.selected{outline:4px solid #35b9ff;outline-offset:1px;animation:card-bounce .24s ease}",
".camd-player.selected{outline:4px solid #35b9ff;outline-offset:1px;animation:card-bounce .24s ease}.camd-player.rotation-selected{border-color:#ffd84a;background:#fff3a6;outline:4px solid #ffd84a;outline-offset:1px;box-shadow:0 0 0 2px rgba(255,216,74,.32),0 4px 0 #a98500,0 0 18px rgba(255,216,74,.5)}.rotation-number{position:absolute;z-index:8;top:20px;left:5px;display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#ffd84a;color:#171300;font-size:11px;font-style:normal;font-weight:1000;box-shadow:0 2px 5px rgba(0,0,0,.35)}",
"rotation card styles",
)

replace_once(
".camd footer button{min-height:38px;border:1px solid #314553;border-radius:8px;background:#10232f;padding:0 14px;color:#fff;font-weight:950;text-transform:uppercase}",
".camd footer button{min-height:38px;border:1px solid #314553;border-radius:8px;background:#10232f;padding:0 14px;color:#fff;font-weight:950;text-transform:uppercase}.camd-rotation-bar{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;align-items:center;gap:8px}.camd-rotation-bar>div{min-width:0}.camd-rotation-bar b,.camd-rotation-bar span{display:block}.camd-rotation-bar b{color:#ffd84a;font-size:11px;text-transform:uppercase}.camd-rotation-bar span{overflow:hidden;color:#fff;font-size:10px;font-weight:800;text-overflow:ellipsis;white-space:nowrap}.camd-rotation-bar button.confirm{border-color:#ffd84a;background:#ffd84a;color:#171300}.camd-rotation-bar button:disabled{opacity:.38}",
"rotation footer styles",
)

replace_once(
"@media(max-width:900px) and (orientation:portrait){.camd{padding:7px 7px 66px}",
"@media(max-width:900px) and (orientation:portrait){.camd-rotation-bar{grid-template-columns:1fr 1fr 1fr}.camd-rotation-bar>div{grid-column:1/-1}.camd-rotation-bar button{padding:0 7px;font-size:9px}.camd{padding:7px 7px 112px}",
"portrait rotation bar",
)

path.write_text(text)
print('Match Day rotation mode added')
