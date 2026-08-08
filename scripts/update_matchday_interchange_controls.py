from pathlib import Path

path = Path('src/pages/CoachAppMatchDay.tsx')
text = path.read_text()

text = text.replace("const INJURY_HOLD_MS=750\n", "", 1)

old = '''function PlayerTile({code,slot,selected,totalTrackedSeconds,onChoose,onScore,onToggleInjury}:{code:string;slot:Slot|undefined;selected:string;totalTrackedSeconds:number;onChoose:(id:string)=>void;onScore:(side:'HOME'|'AWAY',points:1|6,scorerId?:string)=>void;onToggleInjury:(id:string)=>void}){
  const holdTimer=useRef<number|undefined>(undefined)
  const holdTriggered=useRef(false)
  const lastTap=useRef(0)
  const benchSeconds=slot?.benchEnteredAt?Math.floor((Date.now()-slot.benchEnteredAt)/1000):0
  const benchStatus=!slot||!INTERCHANGE_POSITIONS.has(code)?'':slot.benchEnteredAt===null?'green':benchSeconds>=GREEN_AFTER_SECONDS?'green':benchSeconds>=ORANGE_AFTER_SECONDS?'orange':'red'
  const percentage=slot?(totalTrackedSeconds>0?Math.max(0,Math.min(100,Math.round((slot.onGroundSeconds/totalTrackedSeconds)*100))):(slot.onGround?100:0)):0
  function startHold(event:React.PointerEvent<HTMLButtonElement>){if(!slot||!INTERCHANGE_POSITIONS.has(code))return;holdTriggered.current=false;event.currentTarget.setPointerCapture?.(event.pointerId);holdTimer.current=window.setTimeout(()=>{holdTriggered.current=true;lastTap.current=0;onToggleInjury(slot.clubPlayerId)},INJURY_HOLD_MS)}
  function cancelHold(){if(holdTimer.current)window.clearTimeout(holdTimer.current);holdTimer.current=undefined}
  function handleClick(){if(!slot||holdTriggered.current){holdTriggered.current=false;return}if(INTERCHANGE_POSITIONS.has(code)){const current=Date.now();if(current-lastTap.current<=DOUBLE_TAP_MS){lastTap.current=0;onToggleInjury(slot.clubPlayerId);return}lastTap.current=current}if(slot.injured)return;onChoose(slot.clubPlayerId)}
  return <button className={`camd-player ${slot&&selected===slot.clubPlayerId?'selected':''} ${benchStatus?`bench-${benchStatus}`:''} ${slot?.injured?'injured':''}`} disabled={!slot} onPointerDown={startHold} onPointerUp={cancelHold} onPointerCancel={cancelHold} onPointerLeave={cancelHold} onContextMenu={event=>event.preventDefault()} onClick={handleClick}><small>{LABELS[code]||code}</small>{slot?<><strong>{slot.jumperNumber||'—'}</strong><span>{slot.playerName}</span>{INTERCHANGE_POSITIONS.has(code)&&slot.benchEnteredAt!==null&&<i className="bench-timer">{formatBenchTime(benchSeconds)}</i>}{slot.injured&&<i className="injury-label">INJURED</i>}<div className="player-data"><em className="tog">{percentage}%</em><em className="pm">{slot.plusMinus>0?'+':''}{slot.plusMinus}</em></div><div className="player-score"><button type="button" onClick={event=>{event.stopPropagation();onScore('HOME',6,slot.clubPlayerId)}}>G <b>{slot.goals}</b></button><button type="button" onClick={event=>{event.stopPropagation();onScore('HOME',1,slot.clubPlayerId)}}>B <b>{slot.behinds}</b></button></div></>:<span>Empty</span>}</button>
}'''

new = '''function PlayerTile({code,slot,selected,totalTrackedSeconds,onChoose,onScore,onToggleInjury}:{code:string;slot:Slot|undefined;selected:string;totalTrackedSeconds:number;onChoose:(id:string)=>void;onScore:(side:'HOME'|'AWAY',points:1|6,scorerId?:string)=>void;onToggleInjury:(id:string)=>void}){
  const lastTap=useRef(0)
  const isInterchange=INTERCHANGE_POSITIONS.has(code)
  const benchSeconds=slot?.benchEnteredAt?Math.floor((Date.now()-slot.benchEnteredAt)/1000):0
  const benchStatus=!slot||!isInterchange?'':slot.benchEnteredAt===null?'green':benchSeconds>=GREEN_AFTER_SECONDS?'green':benchSeconds>=ORANGE_AFTER_SECONDS?'orange':'red'
  const percentage=slot?(totalTrackedSeconds>0?Math.max(0,Math.min(100,Math.round((slot.onGroundSeconds/totalTrackedSeconds)*100))):(slot.onGround?100:0)):0
  function handleClick(){if(!slot)return;if(isInterchange){const current=Date.now();if(current-lastTap.current<=DOUBLE_TAP_MS){lastTap.current=0;onToggleInjury(slot.clubPlayerId);return}lastTap.current=current}if(slot.injured)return;onChoose(slot.clubPlayerId)}
  return <button className={`camd-player ${slot&&selected===slot.clubPlayerId?'selected':''} ${benchStatus?`bench-${benchStatus}`:''} ${slot?.injured?'injured':''}`} disabled={!slot} onContextMenu={event=>event.preventDefault()} onClick={handleClick}><small>{LABELS[code]||code}</small>{slot?<><strong>{slot.jumperNumber||'—'}</strong><span>{slot.playerName}</span>{isInterchange&&slot.benchEnteredAt!==null&&<i className="bench-timer">{formatBenchTime(benchSeconds)}</i>}{slot.injured&&<i className="injury-label">INJURED</i>}<div className="player-data"><em className="tog">{percentage}%</em><em className="pm">{slot.plusMinus>0?'+':''}{slot.plusMinus}</em></div><div className={`player-score ${isInterchange?'disabled':''}`}><button type="button" disabled={isInterchange} aria-disabled={isInterchange} onClick={event=>{event.stopPropagation();if(!isInterchange)onScore('HOME',6,slot.clubPlayerId)}}>G <b>{slot.goals}</b></button><button type="button" disabled={isInterchange} aria-disabled={isInterchange} onClick={event=>{event.stopPropagation();if(!isInterchange)onScore('HOME',1,slot.clubPlayerId)}}>B <b>{slot.behinds}</b></button></div></>:<span>Empty</span>}</button>
}'''

if old not in text:
    raise SystemExit('PlayerTile implementation marker not found')

text = text.replace(old, new, 1)
path.write_text(text)
print('Match Day interchange controls updated')
