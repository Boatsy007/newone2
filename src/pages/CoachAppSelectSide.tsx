import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronRight, GripVertical, LogOut, Save, Users } from 'lucide-react'

const FIELD_ROWS = [
  ['FP_LEFT','FF','FP_RIGHT'],
  ['HFF_LEFT','CHF','HFF_RIGHT'],
  ['RUCK','RUCK_ROVER','ROVER'],
  ['WING_LEFT','CENTRE','WING_RIGHT'],
  ['HBF_LEFT','CHB','HBF_RIGHT'],
  ['BP_LEFT','FB','BP_RIGHT'],
]
const BENCH = ['INTERCHANGE_1','INTERCHANGE_2','INTERCHANGE_3','INTERCHANGE_4']
const EMERGENCIES = ['EMERGENCY_1','EMERGENCY_2','EMERGENCY_3']
const ALL_POSITIONS = [...FIELD_ROWS.flat(),...BENCH,...EMERGENCIES]
const LABELS: Record<string,string> = {
  BP_LEFT:'RBP',FB:'FB',BP_RIGHT:'LBP',HBF_LEFT:'RHB',CHB:'CHB',HBF_RIGHT:'LHB',WING_LEFT:'RW',CENTRE:'C',WING_RIGHT:'LW',
  RUCK:'R',RUCK_ROVER:'RR',ROVER:'ROV',HFF_LEFT:'RHF',CHF:'CHF',HFF_RIGHT:'LHF',FP_LEFT:'RFP',FF:'FF',FP_RIGHT:'LFP',
  INTERCHANGE_1:'INT',INTERCHANGE_2:'INT',INTERCHANGE_3:'INT',INTERCHANGE_4:'INT',
  EMERGENCY_1:'EMG',EMERGENCY_2:'EMG',EMERGENCY_3:'EMG',
}

type Player = { id:string; playerName:string; jumperNumber:number|null; active:boolean }
type Selected = { clubPlayerId:string; positionCode:string }
type Sheet = { id:string; players:Array<Player & { clubPlayerId:string; positionCode:string }> }
type DragState = { playerId:string; pointerId:number } | null

type Props = {
  clubId:string
  sheetId:string
  token:string
  onContinue:()=>void
  onExit:()=>void
}

export default function CoachAppSelectSide({ clubId, sheetId, token, onContinue, onExit }:Props) {
  const [players,setPlayers] = useState<Player[]>([])
  const [selected,setSelected] = useState<Selected[]>([])
  const [loading,setLoading] = useState(true)
  const [saving,setSaving] = useState(false)
  const [saved,setSaved] = useState(false)
  const [error,setError] = useState('')
  const [activePlayer,setActivePlayer] = useState('')
  const [activePosition,setActivePosition] = useState('')
  const [dragging,setDragging] = useState<DragState>(null)
  const dragGhost = useRef<HTMLDivElement|null>(null)
  const headers = useMemo<Record<string,string>>(() => ({ authorization:`Bearer ${token}` }), [token])
  const jsonHeaders = useMemo<Record<string,string>>(() => ({ ...headers, 'content-type':'application/json' }), [headers])
  const selectionByPosition = useMemo(() => new Map(selected.map(item=>[item.positionCode,item.clubPlayerId])),[selected])
  const positionByPlayer = useMemo(() => new Map(selected.map(item=>[item.clubPlayerId,item.positionCode])),[selected])

  useEffect(() => {
    let live = true
    setLoading(true)
    Promise.all([
      fetch(`/api/club-portal/team-sheets/clubs/${encodeURIComponent(clubId)}/players`,{headers}).then(async r=>{const p=await r.json();if(!r.ok)throw new Error(p.error||'Unable to load players');return p}),
      fetch(`/api/club-portal/team-sheets/clubs/${encodeURIComponent(clubId)}/sheets`,{headers}).then(async r=>{const p=await r.json();if(!r.ok)throw new Error(p.error||'Unable to load team sheet');return p}),
    ]).then(([playerPayload,sheetPayload])=>{
      if(!live)return
      setPlayers((Array.isArray(playerPayload.data)?playerPayload.data:[]).filter((p:Player)=>p.active))
      const sheet=(Array.isArray(sheetPayload.data)?sheetPayload.data:[]).find((item:Sheet)=>item.id===sheetId) as Sheet|undefined
      setSelected(sheet?.players.map(player=>({clubPlayerId:player.clubPlayerId,positionCode:player.positionCode})).filter(item=>ALL_POSITIONS.includes(item.positionCode))??[])
    }).catch(reason=>{if(live)setError(reason instanceof Error?reason.message:'Unable to load team selection')}).finally(()=>{if(live)setLoading(false)})
    return()=>{live=false}
  },[clubId,sheetId,headers])

  useEffect(()=>()=>dragGhost.current?.remove(),[])

  function player(id:string){return players.find(item=>item.id===id)}

  function movePlayer(playerId:string,targetPosition:string){
    if(!playerId||!targetPosition)return
    setSaved(false)
    setSelected(current=>{
      const source=current.find(item=>item.clubPlayerId===playerId)
      const target=current.find(item=>item.positionCode===targetPosition)
      const next=current.filter(item=>item.clubPlayerId!==playerId&&item.positionCode!==targetPosition)
      if(target&&source&&target.clubPlayerId!==playerId)next.push({clubPlayerId:target.clubPlayerId,positionCode:source.positionCode})
      next.push({clubPlayerId:playerId,positionCode:targetPosition})
      return next
    })
    setActivePlayer('');setActivePosition('')
  }

  function clickPlayer(playerId:string){
    const currentPosition=positionByPlayer.get(playerId)||''
    if(activePosition){movePlayer(playerId,activePosition);return}
    if(activePlayer===playerId){setActivePlayer('');return}
    setActivePlayer(playerId)
    setActivePosition(currentPosition)
  }

  function clickPosition(positionCode:string){
    const playerId=selectionByPosition.get(positionCode)||''
    if(activePlayer){movePlayer(activePlayer,positionCode);return}
    if(!playerId){setActivePosition(positionCode);return}
    if(activePosition&&activePosition!==positionCode){
      const selectedPlayer=selectionByPosition.get(activePosition)
      if(selectedPlayer)movePlayer(selectedPlayer,positionCode)
      return
    }
    setActivePlayer(playerId)
    setActivePosition(positionCode)
  }

  function removeFromSide(playerId:string){
    setSaved(false)
    setSelected(current=>current.filter(item=>item.clubPlayerId!==playerId))
    setActivePlayer('');setActivePosition('')
  }

  function startPointerDrag(event:React.PointerEvent,playerId:string){
    if(event.pointerType==='mouse'&&event.button!==0)return
    const source=event.currentTarget as HTMLElement
    source.setPointerCapture?.(event.pointerId)
    setDragging({playerId,pointerId:event.pointerId})
    const ghost=document.createElement('div')
    ghost.className='cas-drag-ghost'
    const item=player(playerId)
    ghost.textContent=`${item?.jumperNumber??''} ${item?.playerName??''}`.trim()
    document.body.appendChild(ghost)
    dragGhost.current=ghost
    moveGhost(event.clientX,event.clientY)
  }

  function moveGhost(x:number,y:number){
    if(dragGhost.current)dragGhost.current.style.transform=`translate3d(${x+10}px,${y+10}px,0)`
  }

  function pointerMove(event:React.PointerEvent){
    if(!dragging||dragging.pointerId!==event.pointerId)return
    event.preventDefault()
    moveGhost(event.clientX,event.clientY)
    document.querySelectorAll('.cas-drop-hover').forEach(node=>node.classList.remove('cas-drop-hover'))
    const target=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-position]')
    target?.classList.add('cas-drop-hover')
  }

  function endPointerDrag(event:React.PointerEvent){
    if(!dragging||dragging.pointerId!==event.pointerId)return
    const target=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-position]')
    document.querySelectorAll('.cas-drop-hover').forEach(node=>node.classList.remove('cas-drop-hover'))
    if(target?.dataset.position)movePlayer(dragging.playerId,target.dataset.position)
    dragGhost.current?.remove();dragGhost.current=null;setDragging(null)
  }

  function dragStart(event:React.DragEvent,playerId:string){event.dataTransfer.setData('text/plain',playerId);event.dataTransfer.effectAllowed='move';setDragging({playerId,pointerId:-1})}
  function drop(event:React.DragEvent,positionCode:string){event.preventDefault();const id=event.dataTransfer.getData('text/plain')||dragging?.playerId||'';movePlayer(id,positionCode);setDragging(null)}

  async function save(continueAfter:boolean,exitAfter=false){
    setSaving(true);setError('');setSaved(false)
    try{
      const response=await fetch(`/api/club-portal/team-sheets/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(sheetId)}/positions`,{
        method:'PUT',headers:jsonHeaders,body:JSON.stringify({positions:selected}),
      })
      const payload=await response.json().catch(()=>({}))
      if(!response.ok)throw new Error(payload.error||'Unable to save selection')
      setSaved(true)
      if(continueAfter)onContinue()
      else if(exitAfter)onExit()
    }catch(reason){setError(reason instanceof Error?reason.message:'Unable to save selection')}
    finally{setSaving(false)}
  }

  if(loading)return <section className="cas-state">Loading your squad…</section>

  return <section className="cas-root" onPointerMove={pointerMove} onPointerUp={endPointerDrag} onPointerCancel={endPointerDrag}>
    <div className="cas-topline"><div><Users size={18}/><b>{selected.length} selected</b><span>{players.length} available</span></div><div className="cas-help">Drag a player into position, or tap two cards to swap.</div>{saved&&<span className="cas-saved"><Check size={15}/> Saved</span>}</div>
    {error&&<div className="cas-error">{error}</div>}
    <div className="cas-layout">
      <aside className="cas-squad">
        <header><div><span>Available squad</span><h2>Players</h2></div><small>{players.length}</small></header>
        <div className="cas-player-list">{players.map(item=>{
          const position=positionByPlayer.get(item.id)
          return <button key={item.id} type="button" draggable onDragStart={event=>dragStart(event,item.id)} onPointerDown={event=>startPointerDrag(event,item.id)} onClick={()=>clickPlayer(item.id)} className={`cas-player-bank ${activePlayer===item.id?'active':''} ${position?'selected':''}`}>
            <GripVertical/><b>{item.jumperNumber??'—'}</b><span>{item.playerName}<small>{position?LABELS[position]:'Not selected'}</small></span>{position&&<i onClick={event=>{event.stopPropagation();removeFromSide(item.id)}} aria-label={`Remove ${item.playerName}`}>×</i>}
          </button>
        })}</div>
      </aside>

      <div className="cas-board">
        <div className="cas-field-wrap">
          <div className="cas-field-markings" aria-hidden="true"><div className="cas-centre-square"/><div className="cas-centre-circle"/><div className="cas-arc top"/><div className="cas-arc bottom"/><div className="cas-goals top"/><div className="cas-goals bottom"/></div>
          <div className="cas-field">
            {FIELD_ROWS.map((row,index)=><div className={`cas-row row-${index}`} key={index}>{row.map(code=><PositionCard key={code} code={code} player={player(selectionByPosition.get(code)||'')} active={activePosition===code||activePlayer===selectionByPosition.get(code)} onClick={()=>clickPosition(code)} onDrop={event=>drop(event,code)}/>)}</div>)}
          </div>
        </div>
        <section className="cas-bench"><h2>Interchange</h2><div>{BENCH.map(code=><PositionCard key={code} code={code} player={player(selectionByPosition.get(code)||'')} active={activePosition===code||activePlayer===selectionByPosition.get(code)} onClick={()=>clickPosition(code)} onDrop={event=>drop(event,code)}/>)}</div></section>
        <section className="cas-emergencies"><h2>Emergencies</h2><div>{EMERGENCIES.map(code=><PositionCard key={code} code={code} player={player(selectionByPosition.get(code)||'')} active={activePosition===code||activePlayer===selectionByPosition.get(code)} onClick={()=>clickPosition(code)} onDrop={event=>drop(event,code)}/>)}</div></section>
      </div>
    </div>
    <nav className="cas-actions">
      <button className="quiet" onClick={()=>void save(false,true)} disabled={saving}><LogOut size={17}/> Save and Exit</button>
      <button onClick={()=>void save(false)} disabled={saving}><Save size={17}/>{saving?'Saving…':'Save Selection'}</button>
      <button className="primary" onClick={()=>void save(true)} disabled={saving}>Save and Continue <ChevronRight size={18}/></button>
    </nav>
    <style>{styles}</style>
  </section>
}

function PositionCard({code,player,active,onClick,onDrop}:{code:string;player:Player|undefined;active:boolean;onClick:()=>void;onDrop:(event:React.DragEvent)=>void}){
  return <button type="button" data-position={code} onClick={onClick} onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect='move'}} onDrop={onDrop} className={`cas-position-card ${active?'active':''} ${player?'filled':'empty'}`}>
    <span>{LABELS[code]}</span>{player?<><b>{player.playerName}</b><i>{player.jumperNumber??'—'}</i></>:<b>Drop player</b>}
  </button>
}

const styles=`
.cas-root{padding:14px max(14px,env(safe-area-inset-right)) 104px max(14px,env(safe-area-inset-left));font-family:Barlow,Inter,Arial,sans-serif;background:#07121b;color:#fff;min-height:calc(100vh - 74px);box-sizing:border-box;touch-action:pan-y}.cas-state{min-height:60vh;display:grid;place-items:center;font-weight:900}.cas-topline{max-width:1380px;margin:0 auto 10px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:16px}.cas-topline>div:first-child{display:flex;align-items:center;gap:9px}.cas-topline span{color:#8fa5b4;font-size:12px}.cas-help{text-align:center;color:#91a4b1;font-size:11px;font-weight:800}.cas-saved{display:flex;align-items:center;gap:5px!important;color:#22c77a!important;font-weight:900}.cas-error{max-width:1380px;margin:0 auto 10px;padding:10px;border-radius:10px;background:#4c1717;color:#ffd1d1;font-weight:850}.cas-layout{max-width:1380px;margin:auto;display:grid;grid-template-columns:250px minmax(0,1fr);gap:13px;align-items:start}.cas-squad,.cas-field-wrap,.cas-bench,.cas-emergencies{border:1px solid #253b49;border-radius:15px;background:#0d1b26;box-shadow:0 9px 25px rgba(0,0,0,.24)}.cas-squad{position:sticky;top:86px;height:calc(100vh - 190px);min-height:500px;display:grid;grid-template-rows:auto 1fr;overflow:hidden}.cas-squad header{display:flex;align-items:end;justify-content:space-between;padding:13px;border-bottom:1px solid #263c49}.cas-squad header span{color:#39b8ff;font-size:8px;font-weight:950;text-transform:uppercase;letter-spacing:.12em}.cas-squad h2,.cas-bench h2,.cas-emergencies h2{margin:2px 0 0;font-family:'Bebas Neue',Impact,sans-serif;font-size:25px;line-height:1;text-transform:uppercase}.cas-squad header small{width:28px;height:28px;display:grid;place-items:center;border-radius:50%;background:#203542;color:#fff;font-weight:950}.cas-player-list{overflow:auto;padding:7px;display:grid;align-content:start;gap:5px;-webkit-overflow-scrolling:touch}.cas-player-bank{width:100%;min-height:45px;display:grid;grid-template-columns:16px 30px minmax(0,1fr) 20px;align-items:center;gap:5px;padding:5px;border:1px solid #2a404d;border-radius:9px;background:#142630;color:#fff;text-align:left;touch-action:none;-webkit-user-select:none;user-select:none}.cas-player-bank>svg{width:14px;color:#66808f}.cas-player-bank>b{width:28px;height:28px;display:grid;place-items:center;border-radius:7px;background:#061018;color:#fff;font-size:11px}.cas-player-bank span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:900}.cas-player-bank small{display:block;margin-top:2px;color:#78909e;font-size:8px;text-transform:uppercase}.cas-player-bank.selected{border-color:#157f57}.cas-player-bank.active{border-color:#39b8ff;box-shadow:0 0 0 2px rgba(57,184,255,.25);transform:translateY(2px)}.cas-player-bank i{width:20px;height:20px;display:grid;place-items:center;border-radius:50%;background:#253d4a;color:#a8bbc6;font-size:14px;font-style:normal}.cas-board{min-width:0;display:grid;gap:8px}.cas-field-wrap{position:relative;width:min(850px,100%);height:min(650px,calc(100vh - 255px));min-height:540px;margin:auto;overflow:visible;padding:18px 36px;box-sizing:border-box;background:#091720}.cas-field-markings{position:absolute;inset:12px 6%;overflow:hidden;border:3px solid #2cf18f;border-radius:50% / 46%;background:repeating-linear-gradient(90deg,#067b39 0 10%,#078b40 10% 20%);box-shadow:inset 0 0 30px rgba(0,0,0,.18),0 0 20px rgba(44,241,143,.14)}.cas-centre-square{position:absolute;width:25%;height:22%;left:37.5%;top:39%;border:2px solid rgba(255,255,255,.55)}.cas-centre-circle{position:absolute;width:8%;aspect-ratio:1;left:46%;top:46%;border:2px solid rgba(255,255,255,.55);border-radius:50%}.cas-arc{position:absolute;left:25%;width:50%;height:26%;border:2px solid rgba(255,255,255,.55);border-radius:50%}.cas-arc.top{top:-9%}.cas-arc.bottom{bottom:-9%}.cas-goals{position:absolute;left:44%;width:12%;height:7%;border:2px solid rgba(255,255,255,.55)}.cas-goals.top{top:-1%;border-top:0}.cas-goals.bottom{bottom:-1%;border-bottom:0}.cas-field{position:relative;z-index:2;height:100%;display:grid;grid-template-rows:repeat(6,1fr);align-items:center}.cas-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;align-items:center}.cas-row.row-0 .cas-position-card:nth-child(2){transform:translateY(-14px)}.cas-row.row-5 .cas-position-card:nth-child(2){transform:translateY(14px)}.cas-position-card{position:relative;min-width:0;height:62px;padding:6px 8px;border:2px solid rgba(255,255,255,.8);border-radius:8px;background:#f7f6f1;color:#111820;text-align:left;box-shadow:0 4px 0 rgba(0,0,0,.24);transition:transform .08s ease,box-shadow .08s ease,border-color .08s ease}.cas-position-card:active,.cas-position-card.active{transform:translateY(3px)!important;box-shadow:0 1px 0 rgba(0,0,0,.25);border-color:#39b8ff}.cas-position-card.cas-drop-hover{border-color:#22c77a!important;box-shadow:0 0 0 4px rgba(34,199,122,.28)}.cas-position-card>span{position:absolute;top:0;left:0;padding:2px 5px;border-radius:5px 0 5px 0;background:#111820;color:#fff;font-size:8px;font-weight:950}.cas-position-card>b{display:block;margin-top:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}.cas-position-card>i{position:absolute;right:6px;top:5px;font-family:'Bebas Neue',Impact,sans-serif;font-size:20px;font-style:normal;font-weight:900}.cas-position-card.empty{border-style:dashed;background:rgba(255,255,255,.12);color:#b8c7d0}.cas-position-card.empty>b{font-size:9px;text-transform:uppercase}.cas-bench,.cas-emergencies{padding:9px 11px}.cas-bench h2,.cas-emergencies h2{color:#39b8ff;font-size:21px}.cas-bench>div{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:6px}.cas-emergencies>div{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:6px}.cas-bench .cas-position-card,.cas-emergencies .cas-position-card{height:54px}.cas-actions{position:fixed;z-index:1250;right:0;bottom:0;left:0;display:flex;justify-content:flex-end;gap:10px;padding:10px max(14px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left));border-top:1px solid #233743;background:rgba(7,18,27,.97);backdrop-filter:blur(14px)}.cas-actions button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:45px;border:1px solid #304753;border-radius:10px;background:#162b37;padding:9px 14px;color:#fff;font-weight:950;text-transform:uppercase}.cas-actions button.primary{background:#22c77a;color:#07121b;border-color:#22c77a}.cas-actions button.quiet{margin-right:auto}.cas-actions button:disabled{opacity:.55}.cas-drag-ghost{position:fixed;z-index:2147483000;left:0;top:0;pointer-events:none;padding:9px 12px;border:2px solid #39b8ff;border-radius:9px;background:#f7f6f1;color:#111820;font:900 11px Barlow,Inter,sans-serif;box-shadow:0 12px 30px rgba(0,0,0,.35)}
@media(max-width:900px){.cas-layout{grid-template-columns:210px minmax(0,1fr)}.cas-field-wrap{height:min(610px,calc(100vh - 255px));padding-left:22px;padding-right:22px}.cas-position-card{height:57px;padding-left:6px;padding-right:6px}.cas-position-card>b{font-size:9px}}@media(orientation:portrait) and (max-width:800px){.cas-layout{grid-template-columns:180px minmax(0,1fr);gap:7px}.cas-squad{top:120px;height:calc(100vh - 235px)}.cas-field-wrap{min-height:600px;padding:14px 17px}.cas-field-markings{inset:8px 2%}.cas-row{gap:4px}.cas-position-card{height:58px;padding:5px}.cas-bench>div{grid-template-columns:repeat(2,1fr)}.cas-help{display:none}}@media(max-width:620px){.cas-root{padding-left:7px;padding-right:7px}.cas-layout{grid-template-columns:150px minmax(0,1fr)}.cas-player-bank{grid-template-columns:12px 24px minmax(0,1fr);min-height:42px}.cas-player-bank>b{width:23px;height:25px}.cas-player-bank i{display:none}.cas-field-wrap{padding:10px 8px;min-height:570px}.cas-position-card{height:54px}.cas-position-card>i{font-size:16px}.cas-actions{display:grid;grid-template-columns:1fr 1fr}.cas-actions button.quiet{margin:0}.cas-actions button.primary{grid-column:1/-1}.cas-root{padding-bottom:158px}}@media(orientation:landscape) and (max-height:760px){.cas-root{padding-top:8px}.cas-topline{margin-bottom:6px}.cas-squad{top:72px;height:calc(100vh - 145px);min-height:390px}.cas-field-wrap{height:calc(100vh - 205px);min-height:410px;max-height:540px;padding:12px 32px}.cas-position-card{height:47px}.cas-row.row-0 .cas-position-card:nth-child(2){transform:translateY(-9px)}.cas-row.row-5 .cas-position-card:nth-child(2){transform:translateY(9px)}.cas-bench .cas-position-card,.cas-emergencies .cas-position-card{height:47px}.cas-bench h2,.cas-emergencies h2{font-size:18px}.cas-actions{padding-top:6px;padding-bottom:max(6px,env(safe-area-inset-bottom))}}
`
