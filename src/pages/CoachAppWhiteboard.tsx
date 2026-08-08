import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Eraser, Highlighter, Library, MousePointer2, Pencil, Presentation, Redo2, Save, Trash2, Undo2, X } from 'lucide-react'

type Tool='MOVE'|'PEN'|'HIGHLIGHT'|'ARROW'|'ERASER'
type Point={x:number;y:number}
type Stroke={id:string;tool:'PEN'|'HIGHLIGHT'|'ARROW';points:Point[]}
type Magnet={id:string;name:string;number:number|null;team:'US'|'THEM';x:number;y:number}
type BoardState={magnets:Magnet[];strokes:Stroke[]}
type SavedBoard={id:string;name:string;fixtureLabel:string;savedAt:string;state:BoardState}
type SheetPayload={data?:{state?:{slots?:Array<{clubPlayerId:string;playerName:string;jumperNumber:number|null;positionCode:string}>}}}

type Props={clubId:string;sheetId:string;token:string;fixtureLabel:string;returnToMatch:boolean;onExit:()=>void}

const FIELD_POSITIONS:Record<string,Point>={
  FF:{x:50,y:11},FP_LEFT:{x:26,y:16},FP_RIGHT:{x:74,y:16},
  CHF:{x:50,y:29},HFF_LEFT:{x:24,y:32},HFF_RIGHT:{x:76,y:32},
  C:{x:50,y:50},W_LEFT:{x:22,y:50},W_RIGHT:{x:78,y:50},
  CHB:{x:50,y:70},HBF_LEFT:{x:24,y:68},HBF_RIGHT:{x:76,y:68},
  FB:{x:50,y:89},BP_LEFT:{x:26,y:84},BP_RIGHT:{x:74,y:84},
  RUCK:{x:43,y:43},ROVER:{x:57,y:43},RR:{x:50,y:57},
  INT1:{x:12,y:94},INT2:{x:38,y:94},INT3:{x:62,y:94},INT4:{x:88,y:94},
}
const emptyState:BoardState={magnets:[],strokes:[]}
const clone=(value:BoardState):BoardState=>structuredClone(value)

export default function CoachAppWhiteboard({clubId,sheetId,token,fixtureLabel,returnToMatch,onExit}:Props){
  const[tool,setTool]=useState<Tool>('MOVE')
  const[state,setState]=useState<BoardState>(emptyState)
  const[undo,setUndo]=useState<BoardState[]>([])
  const[redo,setRedo]=useState<BoardState[]>([])
  const[presenting,setPresenting]=useState(false)
  const[libraryOpen,setLibraryOpen]=useState(false)
  const[saved,setSaved]=useState<SavedBoard[]>([])
  const[loading,setLoading]=useState(true)
  const[drawing,setDrawing]=useState<Stroke|null>(null)
  const[dragging,setDragging]=useState<string>('')
  const svgRef=useRef<SVGSVGElement|null>(null)
  const storageKey=useMemo(()=>`playfooty.whiteboard.${clubId}.${sheetId}`,[clubId,sheetId])
  const libraryKey=useMemo(()=>`playfooty.whiteboard.library.${clubId}`,[clubId])

  useEffect(()=>{
    try{setSaved(JSON.parse(localStorage.getItem(libraryKey)||'[]') as SavedBoard[])}catch{setSaved([])}
    const stored=localStorage.getItem(storageKey)
    if(stored){try{setState(JSON.parse(stored) as BoardState);setLoading(false);return}catch{}}
    fetch(`/api/club-portal/match-day/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(sheetId)}`,{headers:{authorization:`Bearer ${token}`}})
      .then(async response=>{const payload=await response.json() as SheetPayload;if(!response.ok)throw new Error('Unable to load selected team');const slots=payload.data?.state?.slots||[];const ours:Magnet[]=slots.map((slot,index)=>{const p=FIELD_POSITIONS[slot.positionCode]||{x:15+(index%6)*14,y:18+Math.floor(index/6)*15};return{id:slot.clubPlayerId,name:slot.playerName,number:slot.jumperNumber,team:'US',x:p.x,y:p.y}});const them:Magnet[]=Array.from({length:18},(_,index)=>({id:`opp-${index+1}`,name:`OPP ${index+1}`,number:index+1,team:'THEM' as const,x:14+(index%6)*14,y:12+Math.floor(index/6)*14}));setState({magnets:[...ours,...them],strokes:[]})})
      .catch(()=>setState(emptyState)).finally(()=>setLoading(false))
  },[clubId,sheetId,token,storageKey,libraryKey])

  useEffect(()=>{if(!loading)localStorage.setItem(storageKey,JSON.stringify(state))},[state,loading,storageKey])
  const point=(event:React.PointerEvent<SVGSVGElement>):Point=>{const svg=svgRef.current;if(!svg)return{x:0,y:0};const rect=svg.getBoundingClientRect();return{x:Math.max(0,Math.min(100,(event.clientX-rect.left)/rect.width*100)),y:Math.max(0,Math.min(100,(event.clientY-rect.top)/rect.height*100))}}
  function commit(next:BoardState){setUndo(current=>[...current.slice(-39),clone(state)]);setRedo([]);setState(next)}
  function undoAction(){setUndo(current=>{if(!current.length)return current;const previous=current[current.length-1];setRedo(items=>[clone(state),...items].slice(0,40));setState(previous);return current.slice(0,-1)})}
  function redoAction(){setRedo(current=>{if(!current.length)return current;const next=current[0];setUndo(items=>[...items.slice(-39),clone(state)]);setState(next);return current.slice(1)})}
  function startBoard(event:React.PointerEvent<SVGSVGElement>){if(tool==='MOVE')return;const p=point(event);if(tool==='ERASER'){const hit=state.strokes.find(stroke=>stroke.points.some(candidate=>Math.hypot(candidate.x-p.x,candidate.y-p.y)<3));if(hit)commit({...state,strokes:state.strokes.filter(item=>item.id!==hit.id)});return}const stroke:Stroke={id:crypto.randomUUID(),tool,points:[p]};setDrawing(stroke);event.currentTarget.setPointerCapture?.(event.pointerId)}
  function moveBoard(event:React.PointerEvent<SVGSVGElement>){if(!drawing)return;setDrawing(current=>current?{...current,points:[...current.points,point(event)]}:current)}
  function endBoard(){if(!drawing)return;commit({...state,strokes:[...state.strokes,drawing]});setDrawing(null)}
  function startMagnet(event:React.PointerEvent<SVGGElement>,id:string){if(tool!=='MOVE')return;event.stopPropagation();setDragging(id);event.currentTarget.setPointerCapture?.(event.pointerId)}
  function moveMagnet(event:React.PointerEvent<SVGGElement>,id:string){if(dragging!==id||tool!=='MOVE')return;const svg=svgRef.current;if(!svg)return;const rect=svg.getBoundingClientRect();const p={x:Math.max(4,Math.min(96,(event.clientX-rect.left)/rect.width*100)),y:Math.max(4,Math.min(96,(event.clientY-rect.top)/rect.height*100))};setState(current=>({...current,magnets:current.magnets.map(m=>m.id===id?{...m,...p}:m)}))}
  function endMagnet(){if(!dragging)return;setUndo(current=>[...current.slice(-39),clone(state)]);setRedo([]);setDragging('')}
  function clearBoard(){if(!confirm('Clear all drawings and reset the magnets?'))return;const magnets=state.magnets.map((m,index)=>{if(m.team==='THEM')return{...m,x:14+(index%6)*14,y:12+Math.floor((index%18)/6)*14};return m});commit({magnets,strokes:[]})}
  function saveBoard(){const name=prompt('Name this tactic',`Match tactic ${saved.length+1}`)?.trim();if(!name)return;const board:SavedBoard={id:crypto.randomUUID(),name,fixtureLabel,savedAt:new Date().toISOString(),state:clone(state)};const next=[board,...saved];setSaved(next);localStorage.setItem(libraryKey,JSON.stringify(next));setLibraryOpen(true)}
  function loadBoard(board:SavedBoard){commit(clone(board.state));setLibraryOpen(false)}
  function deleteBoard(id:string){const next=saved.filter(item=>item.id!==id);setSaved(next);localStorage.setItem(libraryKey,JSON.stringify(next))}
  const strokes=[...state.strokes,...(drawing?[drawing]:[])]
  if(loading)return <main className="cawb-loading">Loading selected team…</main>
  return <main className={`cawb ${presenting?'presenting':''}`}><style>{styles}</style>
    {!presenting&&<header><button className="back" onClick={onExit}><ArrowLeft/> {returnToMatch?'Return to Match':'Back'}</button><div><span>PLAYFOOTY WHITEBOARD</span><b>{fixtureLabel}</b></div><nav><button onClick={()=>setLibraryOpen(true)}><Library/>Library</button><button className="save" onClick={saveBoard}><Save/>Save tactic</button><button onClick={()=>setPresenting(true)}><Presentation/>Present</button></nav></header>}
    {!presenting&&<aside className="tools">
      <button className={tool==='MOVE'?'active':''} onClick={()=>setTool('MOVE')}><MousePointer2/><span>Move</span></button>
      <button className={tool==='PEN'?'active':''} onClick={()=>setTool('PEN')}><Pencil/><span>Pen</span></button>
      <button className={tool==='HIGHLIGHT'?'active':''} onClick={()=>setTool('HIGHLIGHT')}><Highlighter/><span>Zone</span></button>
      <button className={tool==='ARROW'?'active':''} onClick={()=>setTool('ARROW')}><ArrowLeft className="arrow-tool"/><span>Arrow</span></button>
      <button className={tool==='ERASER'?'active':''} onClick={()=>setTool('ERASER')}><Eraser/><span>Eraser</span></button>
      <hr/><button disabled={!undo.length} onClick={undoAction}><Undo2/><span>Undo</span></button><button disabled={!redo.length} onClick={redoAction}><Redo2/><span>Redo</span></button><button onClick={clearBoard}><Trash2/><span>Clear</span></button>
    </aside>}
    <section className="board-wrap">
      <svg ref={svgRef} viewBox="0 0 100 100" onPointerDown={startBoard} onPointerMove={moveBoard} onPointerUp={endBoard} onPointerCancel={endBoard}>
        <defs><marker id="arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill="#fff"/></marker></defs>
        <rect width="100" height="100" rx="2" fill="#06131c"/>
        <ellipse cx="50" cy="50" rx="43" ry="47" fill="#078b40" stroke="#39f49b" strokeWidth=".7"/>
        <path d="M50 3v94M7 50h86" stroke="rgba(255,255,255,.38)" strokeWidth=".35"/>
        <rect x="38" y="41" width="24" height="18" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth=".4"/><circle cx="50" cy="50" r="4" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth=".4"/>
        <path d="M27 17 Q50 35 73 17M27 83 Q50 65 73 83" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth=".4"/>
        <path d="M44 4v5M48 3v7M52 3v7M56 4v5M44 96v-5M48 97v-7M52 97v-7M56 96v-5" stroke="#fff" strokeWidth=".45"/>
        {strokes.map(stroke=>stroke.tool==='ARROW'?<line key={stroke.id} x1={stroke.points[0]?.x} y1={stroke.points[0]?.y} x2={stroke.points.at(-1)?.x} y2={stroke.points.at(-1)?.y} stroke="#fff" strokeWidth=".9" markerEnd="url(#arrow)" strokeLinecap="round"/>:<polyline key={stroke.id} points={stroke.points.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke={stroke.tool==='HIGHLIGHT'?'rgba(255,214,10,.55)':'#fff'} strokeWidth={stroke.tool==='HIGHLIGHT'?4:0.8} strokeLinecap="round" strokeLinejoin="round"/>)}
        {state.magnets.map(m=><g key={m.id} transform={`translate(${m.x} ${m.y})`} onPointerDown={event=>startMagnet(event,m.id)} onPointerMove={event=>moveMagnet(event,m.id)} onPointerUp={endMagnet} onPointerCancel={endMagnet} className={`magnet ${m.team.toLowerCase()}`}>
          <circle r="3.2" fill={m.team==='US'?'#20b8ff':'#f04452'} stroke="#fff" strokeWidth=".45"/><text y=".7" textAnchor="middle" fill="#fff" fontSize="2.25" fontWeight="900">{m.number??(m.team==='US'?'PF':'O')}</text><rect x="-5" y="3.6" width="10" height="2.8" rx="1.1" fill="rgba(4,12,18,.9)"/><text y="5.55" textAnchor="middle" fill="#fff" fontSize="1.45" fontWeight="800">{m.name.slice(0,12)}</text>
        </g>)}
      </svg>
      {!presenting&&<div className="legend"><span><i className="us"/>Your team</span><span><i className="them"/>Opposition</span><small>Use Apple Pencil or touch. Select Move to reposition players.</small></div>}
      {presenting&&<button className="exit-present" onClick={()=>setPresenting(false)}><X/>Exit presentation</button>}
    </section>
    {libraryOpen&&<div className="library-modal"><section><header><div><span>TACTICS LIBRARY</span><h2>Saved boards</h2></div><button onClick={()=>setLibraryOpen(false)}><X/></button></header>{saved.length?<div>{saved.map(board=><article key={board.id}><button onClick={()=>loadBoard(board)}><b>{board.name}</b><span>{board.fixtureLabel}</span><small>{new Date(board.savedAt).toLocaleString()}</small></button><button className="delete" onClick={()=>deleteBoard(board.id)}><Trash2/></button></article>)}</div>:<p>No saved tactics yet. Build a board and tap Save tactic.</p>}</section></div>}
  </main>
}

const styles=`
.cawb{position:fixed;z-index:2000;inset:0;display:grid;grid-template-columns:74px 1fr;grid-template-rows:68px 1fr;background:#061019;color:#fff;font-family:Barlow,Inter,Arial,sans-serif;touch-action:none}.cawb *{box-sizing:border-box}.cawb>header{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 14px;border-bottom:1px solid #223845;background:#091923}.cawb>header button,.cawb>header nav button{display:flex;align-items:center;gap:6px;min-height:42px;border:1px solid #304a5a;border-radius:9px;background:#102633;padding:0 12px;color:#fff;font-weight:900}.cawb>header button svg{width:17px}.cawb>header .back{background:#10212d}.cawb>header>div{display:grid;text-align:center}.cawb>header>div span{color:#20b8ff;font-size:10px;font-weight:1000;letter-spacing:.12em}.cawb>header>div b{font-size:14px}.cawb>header nav{display:flex;gap:7px}.cawb>header nav .save{border-color:#20b8ff;background:#20b8ff;color:#04121b}.tools{display:flex;flex-direction:column;gap:6px;padding:8px;border-right:1px solid #223845;background:#091923}.tools button{display:grid;place-items:center;gap:2px;min-height:53px;border:1px solid transparent;border-radius:9px;background:#10212d;color:#9fb2bf}.tools button.active{border-color:#20b8ff;background:#12354a;color:#fff}.tools button:disabled{opacity:.25}.tools svg{width:20px}.tools span{font-size:8px;font-weight:900;text-transform:uppercase}.tools hr{width:100%;border:0;border-top:1px solid #263c49}.arrow-tool{transform:rotate(135deg)}.board-wrap{position:relative;display:grid;place-items:center;min-width:0;min-height:0;padding:8px 12px 30px}.board-wrap svg{width:100%;height:100%;max-width:1400px;max-height:calc(100vh - 102px);border:1px solid #274353;border-radius:14px;box-shadow:0 18px 60px #000;user-select:none;-webkit-user-select:none}.magnet{cursor:grab}.magnet:active{cursor:grabbing}.legend{position:absolute;right:18px;bottom:8px;left:18px;display:flex;align-items:center;justify-content:center;gap:16px;font-size:9px;font-weight:800}.legend span{display:flex;align-items:center;gap:5px}.legend i{width:9px;height:9px;border-radius:50%}.legend .us{background:#20b8ff}.legend .them{background:#f04452}.legend small{color:#8198a6}.presenting{display:block;background:#000}.presenting .board-wrap{width:100vw;height:100vh;padding:0}.presenting .board-wrap svg{max-width:none;max-height:none;border:0;border-radius:0}.exit-present{position:fixed;z-index:10;right:18px;top:18px;display:flex;align-items:center;gap:6px;border:1px solid #fff3;border-radius:10px;background:#07121ddd;padding:10px 14px;color:#fff;font-weight:900}.library-modal{position:fixed;z-index:2200;inset:0;display:grid;place-items:center;padding:20px;background:#000c;backdrop-filter:blur(8px)}.library-modal>section{width:min(720px,100%);max-height:86vh;overflow:auto;padding:16px;border:1px solid #315061;border-radius:18px;background:#0b1b26}.library-modal header{display:flex;justify-content:space-between;align-items:center}.library-modal header span{color:#20b8ff;font-size:10px;font-weight:950}.library-modal h2{margin:2px 0 12px;font-size:28px}.library-modal header button,.library-modal .delete{display:grid;place-items:center;width:40px;height:40px;border:1px solid #385367;border-radius:9px;background:#122b3a;color:#fff}.library-modal article{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:8px}.library-modal article>button:first-child{display:grid;gap:3px;width:100%;border:1px solid #294351;border-radius:10px;background:#10232f;padding:12px;color:#fff;text-align:left}.library-modal article span,.library-modal article small{color:#90a6b4}.library-modal p{color:#90a6b4}.cawb-loading{min-height:100vh;display:grid;place-items:center;background:#061019;color:#fff;font-weight:900}
@media(max-width:850px){.cawb{grid-template-columns:58px 1fr;grid-template-rows:58px 1fr}.cawb>header{padding:6px}.cawb>header nav button span{display:none}.cawb>header nav button{padding:0 9px}.cawb>header>div b{font-size:10px}.tools{padding:5px}.tools button{min-height:45px}.tools span{font-size:7px}.legend small{display:none}}
@media(orientation:portrait){.cawb:before{content:'Rotate your device to landscape for Whiteboard';position:fixed;z-index:9999;inset:0;display:grid;place-items:center;padding:30px;background:#061019;color:#fff;font-size:20px;font-weight:950;text-align:center}}
`
