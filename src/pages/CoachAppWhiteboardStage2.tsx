import { useEffect, useMemo, useRef, useState } from 'react'
import CoachAppLoading from '../components/CoachAppLoading'
import { ArrowLeft, ChevronDown, ChevronUp, Circle, Copy, Eraser, Highlighter, Library, Minus, MousePointer2, Pause, Pencil, Play, Plus, Presentation, Redo2, Repeat2, Save, Share2, Cloud, History, Download, Users, BarChart3, Radio, Mic, Video, Film, BrainCircuit, GitCompare, Target, BookOpen, Sparkles, Square, Triangle, Trash2, Undo2, X } from 'lucide-react'

type DrawingTool='PEN'|'LINE'|'HIGHLIGHT'|'ARROW'|'CIRCLE'|'SQUARE'|'TRIANGLE'
type Tool='MOVE'|DrawingTool|'ERASER'
type Point={x:number;y:number}
type Stroke={id:string;tool:DrawingTool;points:Point[];width?:number;opacity?:number}
type Magnet={id:string;name:string;number:number|null;team:'US'|'THEM';x:number;y:number}
type PlayerOption={id:string;name:string;number:number|null;team:'US'|'THEM';position?:Point}
type BoardState={magnets:Magnet[];strokes:Stroke[]}
type Frame={id:string;name:string;state:BoardState}
type PlayState={frames:Frame[];activeFrameId:string;speed:number;loop:boolean}
type SavedPlay={id:string;name:string;fixtureLabel:string;savedAt:string;play:PlayState}
type SelectedPlayer={id?:string;clubPlayerId:string;playerName:string;jumperNumber:number|null;positionCode:string}
type TeamSheet={id:string;roundLabel?:string;matchDate?:string|null;status?:string;players?:SelectedPlayer[]}
type TeamSheetListPayload={data?:TeamSheet[]}
type SheetPayload={data?:{state?:{slots?:Array<{clubPlayerId:string;playerName:string;jumperNumber:number|null;positionCode:string}>;teamStats?:Record<string,number>;quarter?:number;homeGoals?:number;homeBehinds?:number;awayGoals?:number;awayBehinds?:number}}}
type TacticalAnalysis={headline:string;summary:string;strengths:string[];risks:string[];adjustments:string[];coachMessage:string}
type CloudPlay={id:string;title:string;category:string;visibility:string;notes:string|null;fixtureLabel:string|null;play:PlayState;shareToken?:string|null;updatedAt:string}
type Props={clubId:string;sheetId:string;token:string;fixtureLabel:string;returnToMatch:boolean;onExit:()=>void}
type DialogKind='CLEAR'|'RENAME_FRAME'|'DELETE_FRAME'|'SAVE_PLAY'|'GENERIC'|'SMART_SETUP'|'OUTCOME'
type UiDialog={kind:DialogKind;team?:'US'|'THEM'}|null
type ToastState={message:string;tone:'SUCCESS'|'ERROR'|'INFO'}|null

const FIELD_POSITIONS:Record<string,Point>={FF:{x:50,y:11},FP_LEFT:{x:26,y:16},FP_RIGHT:{x:74,y:16},CHF:{x:50,y:29},HFF_LEFT:{x:24,y:32},HFF_RIGHT:{x:76,y:32},C:{x:50,y:50},W_LEFT:{x:22,y:50},W_RIGHT:{x:78,y:50},CHB:{x:50,y:70},HBF_LEFT:{x:24,y:68},HBF_RIGHT:{x:76,y:68},FB:{x:50,y:89},BP_LEFT:{x:26,y:84},BP_RIGHT:{x:74,y:84},RUCK:{x:43,y:43},ROVER:{x:57,y:43},RR:{x:50,y:57},INT1:{x:12,y:94},INT2:{x:38,y:94},INT3:{x:62,y:94},INT4:{x:88,y:94}}
const emptyBoard:BoardState={magnets:[],strokes:[]}
const cloneBoard=(value:BoardState):BoardState=>structuredClone(value)
const clonePlay=(value:PlayState):PlayState=>structuredClone(value)
const shapePoints=(tool:DrawingTool,start:Point,end:Point):Point[]=>{
  if(tool==='LINE'||tool==='ARROW')return[start,end]
  if(tool==='CIRCLE'){
    const cx=(start.x+end.x)/2,cy=(start.y+end.y)/2,rx=Math.max(.5,Math.abs(end.x-start.x)/2),ry=Math.max(.5,Math.abs(end.y-start.y)/2)
    return Array.from({length:37},(_,index)=>{const angle=(Math.PI*2*index)/36;return{x:cx+Math.cos(angle)*rx,y:cy+Math.sin(angle)*ry}})
  }
  if(tool==='SQUARE'){
    const sx=end.x>=start.x?1:-1,sy=end.y>=start.y?1:-1
    const visualSize=Math.max(Math.abs(end.x-start.x)*1.6,Math.abs(end.y-start.y),2)
    const x2=start.x+sx*(visualSize/1.6),y2=start.y+sy*visualSize
    return[start,{x:x2,y:start.y},{x:x2,y:y2},{x:start.x,y:y2},start]
  }
  if(tool==='TRIANGLE'){
    const sx=end.x>=start.x?1:-1,sy=end.y>=start.y?1:-1
    const visualSize=Math.max(Math.abs(end.x-start.x)*1.6,Math.abs(end.y-start.y),2)
    const x2=start.x+sx*(visualSize/1.6),y2=start.y+sy*visualSize
    return[{x:(start.x+x2)/2,y:start.y},{x:x2,y:y2},{x:start.x,y:y2},{x:(start.x+x2)/2,y:start.y}]
  }
  return[start,end]
}
const newPlay=(state:BoardState):PlayState=>{const id=crypto.randomUUID();return{frames:[{id,name:'Start',state:cloneBoard(state)}],activeFrameId:id,speed:1200,loop:false}}

export default function CoachAppWhiteboardStage2({clubId,sheetId,token,fixtureLabel,returnToMatch,onExit}:Props){
  const[tool,setTool]=useState<Tool>('MOVE')
  const[playerDrawerOpen,setPlayerDrawerOpen]=useState(false)
  const[drawTrayOpen,setDrawTrayOpen]=useState(false)
  const[playBuilderOpen,setPlayBuilderOpen]=useState(false)
  const[playerSearch,setPlayerSearch]=useState('')
  const[playerSelection,setPlayerSelection]=useState<string[]>([])
  const[selectedMagnetId,setSelectedMagnetId]=useState('')
  const[moreOpen,setMoreOpen]=useState(false)
  const[uiDialog,setUiDialog]=useState<UiDialog>(null)
  const[dialogValue,setDialogValue]=useState('')
  const[dialogSecondary,setDialogSecondary]=useState('')
  const[toast,setToast]=useState<ToastState>(null)
  const[resultPanel,setResultPanel]=useState<{title:string;body:string}|null>(null)
  const[playerTab,setPlayerTab]=useState<'US'|'THEM'|'GENERIC'>('US')
  const[ourPlayers,setOurPlayers]=useState<PlayerOption[]>([])
  const[oppositionPlayers,setOppositionPlayers]=useState<PlayerOption[]>(()=>Array.from({length:22},(_,index)=>({id:`opp-${index+1}`,name:`Opponent ${index+1}`,number:index+1,team:'THEM' as const})))
  const[play,setPlay]=useState<PlayState>(()=>newPlay(emptyBoard))
  const[undo,setUndo]=useState<PlayState[]>([])
  const[redo,setRedo]=useState<PlayState[]>([])
  const[presenting,setPresenting]=useState(false)
  const[libraryOpen,setLibraryOpen]=useState(false)
  const[saved,setSaved]=useState<SavedPlay[]>([])
  const[loading,setLoading]=useState(true)
  const[saveStatus,setSaveStatus]=useState<'SAVING'|'SAVED'|'OFFLINE'>('SAVED')
  const[hasOpenedBoard,setHasOpenedBoard]=useState(false)
  const[drawing,setDrawing]=useState<Stroke|null>(null)
  const[brushWidth,setBrushWidth]=useState(1)
  const[brushOpacity,setBrushOpacity]=useState(85)
  const[selectedStrokeId,setSelectedStrokeId]=useState('')
  const[viewport,setViewport]=useState({x:0,y:0,w:160,h:100})
  const[dragging,setDragging]=useState<string>('')
  const[playing,setPlaying]=useState(false)
  const[analysisOpen,setAnalysisOpen]=useState(false)
  const[analysisLoading,setAnalysisLoading]=useState(false)
  const[analysisError,setAnalysisError]=useState('')
  const[analysis,setAnalysis]=useState<TacticalAnalysis|null>(null)
  const[analysisScope,setAnalysisScope]=useState<'frame'|'play'>('frame')
  const[cloudOpen,setCloudOpen]=useState(false)
  const[cloudPlays,setCloudPlays]=useState<CloudPlay[]>([])
  const[cloudBusy,setCloudBusy]=useState(false)
  const[cloudError,setCloudError]=useState('')
  const[selectedCloudId,setSelectedCloudId]=useState('')
  const[cloudCategory,setCloudCategory]=useState('General')
  const[cloudNotes,setCloudNotes]=useState('')
  const[meetingActive,setMeetingActive]=useState(false)
  const[meetingRevision,setMeetingRevision]=useState(0)
  const[recordingVoice,setRecordingVoice]=useState(false)
  const[mediaRecorder,setMediaRecorder]=useState<MediaRecorder|null>(null)
  const svgRef=useRef<SVGSVGElement|null>(null)
  const voiceChunks=useRef<Blob[]>([])
  const timerRef=useRef<number|undefined>(undefined)
  const saveTimerRef=useRef<number|undefined>(undefined)
  const activePointers=useRef(new Map<number,{x:number;y:number}>())
  const pinchRef=useRef<{distance:number;viewport:{x:number;y:number;w:number;h:number}}|null>(null)
  const storageKey=useMemo(()=>`playfooty.whiteboard.v2.${clubId}.${sheetId}`,[clubId,sheetId])
  const legacyKey=useMemo(()=>`playfooty.whiteboard.${clubId}.${sheetId}`,[clubId,sheetId])
  const libraryKey=useMemo(()=>`playfooty.whiteboard.library.v2.${clubId}`,[clubId])
  const activeIndex=Math.max(0,play.frames.findIndex(frame=>frame.id===play.activeFrameId))
  const activeFrame=play.frames[activeIndex]||play.frames[0]
  const state=activeFrame?.state||emptyBoard

  useEffect(()=>{
    let live=true
    try{setSaved(JSON.parse(localStorage.getItem(libraryKey)||'[]') as SavedPlay[])}catch{setSaved([])}
    let restored=false
    const stored=localStorage.getItem(storageKey)
    if(stored){try{setPlay(JSON.parse(stored) as PlayState);restored=true}catch{}}
    if(!restored){const legacy=localStorage.getItem(legacyKey);if(legacy){try{setPlay(newPlay(JSON.parse(legacy) as BoardState));restored=true}catch{}}}
    if(!restored)setPlay(newPlay(emptyBoard))

    const headers={authorization:`Bearer ${token}`}
    const loadPlayers=async()=>{
      try{
        const [sheetsResponse,stateResponse]=await Promise.all([
          fetch(`/api/club-portal/team-sheets/clubs/${encodeURIComponent(clubId)}/sheets`,{headers,cache:'no-store'}),
          fetch(`/api/club-portal/match-day/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(sheetId)}`,{headers,cache:'no-store'}),
        ])
        const sheetsPayload=await sheetsResponse.json().catch(()=>({})) as TeamSheetListPayload
        const statePayload=await stateResponse.json().catch(()=>({})) as SheetPayload
        const sheets=Array.isArray(sheetsPayload.data)?sheetsPayload.data:[]
        const current=sheets.find(sheet=>sheet.id===sheetId)
        let players=(current?.players||[]).filter(player=>player.clubPlayerId&&player.playerName)

        if(!players.length){
          const currentTime=current?.matchDate?new Date(current.matchDate).getTime():Number.POSITIVE_INFINITY
          const candidates=sheets
            .filter(sheet=>sheet.id!==sheetId&&(sheet.players?.length||0)>0)
            .map(sheet=>({sheet,time:sheet.matchDate?new Date(sheet.matchDate).getTime():0}))
            .filter(item=>Number.isFinite(item.time)&&item.time<currentTime)
            .sort((a,b)=>b.time-a.time)
          const fallback=candidates[0]?.sheet||sheets
            .filter(sheet=>sheet.id!==sheetId&&(sheet.players?.length||0)>0)
            .sort((a,b)=>(b.matchDate?new Date(b.matchDate).getTime():0)-(a.matchDate?new Date(a.matchDate).getTime():0))[0]
          players=(fallback?.players||[]).filter(player=>player.clubPlayerId&&player.playerName)
        }

        if(!players.length){
          const slots=statePayload.data?.state?.slots||[]
          players=slots.map(slot=>({clubPlayerId:slot.clubPlayerId,playerName:slot.playerName,jumperNumber:slot.jumperNumber,positionCode:slot.positionCode}))
        }

        if(live)setOurPlayers(players.map((player,index)=>({
          id:player.clubPlayerId,
          name:player.playerName,
          number:player.jumperNumber,
          team:'US' as const,
          position:FIELD_POSITIONS[player.positionCode]||{x:15+(index%6)*14,y:18+Math.floor(index/6)*15},
        })))
        try{
          const oppositionResponse=await fetch(`/api/club-portal/team-sheets/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(sheetId)}/opposition`,{headers,cache:'no-store'})
          const oppositionPayload=await oppositionResponse.json().catch(()=>({}))
          const opposition=Array.isArray(oppositionPayload.data?.players)?oppositionPayload.data.players:[]
          if(live&&opposition.length)setOppositionPlayers(opposition.map((player:any,index:number)=>({
            id:`opposition-${player.clubPlayerId||player.id}`,
            name:player.playerName,
            number:player.jumperNumber,
            team:'THEM' as const,
            position:FIELD_POSITIONS[player.positionCode]||{x:85-(index%6)*14,y:18+Math.floor(index/6)*15},
          })))
        }catch{}
      }catch{if(live)setOurPlayers([])}finally{if(live)setLoading(false)}
    }
    void loadPlayers()
    return()=>{live=false}
  },[clubId,sheetId,token,storageKey,legacyKey,libraryKey])

  useEffect(()=>{if(loading)return;setSaveStatus('SAVING');if(saveTimerRef.current)window.clearTimeout(saveTimerRef.current);saveTimerRef.current=window.setTimeout(()=>{try{localStorage.setItem(storageKey,JSON.stringify(play));setSaveStatus(navigator.onLine?'SAVED':'OFFLINE')}catch{setSaveStatus('OFFLINE')}},350);return()=>{if(saveTimerRef.current)window.clearTimeout(saveTimerRef.current)}},[play,loading,storageKey])
  useEffect(()=>()=>{if(timerRef.current)window.clearTimeout(timerRef.current)},[])
  useEffect(()=>{if(!toast)return;const id=window.setTimeout(()=>setToast(null),2600);return()=>window.clearTimeout(id)},[toast])
  useEffect(()=>{if(!playing)return;if(play.frames.length<2){setPlaying(false);return}timerRef.current=window.setTimeout(()=>{setPlay(current=>{const index=current.frames.findIndex(frame=>frame.id===current.activeFrameId);const next=index+1;if(next<current.frames.length)return{...current,activeFrameId:current.frames[next].id};if(current.loop)return{...current,activeFrameId:current.frames[0].id};setPlaying(false);return current})},play.speed);return()=>{if(timerRef.current)window.clearTimeout(timerRef.current)}},[playing,play.activeFrameId,play.frames.length,play.speed,play.loop])

  function notify(message:string,tone:'SUCCESS'|'ERROR'|'INFO'='INFO'){setToast({message,tone})}
  function openDialog(kind:DialogKind,value='',secondary='',team?:'US'|'THEM'){setDialogValue(value);setDialogSecondary(secondary);setUiDialog({kind,team})}
  function closeDialog(){setUiDialog(null);setDialogValue('');setDialogSecondary('')}
  async function submitDialog(){
    if(!uiDialog)return
    const value=dialogValue.trim()
    if(uiDialog.kind==='CLEAR'){updateState({magnets:[],strokes:[]});notify('Frame cleared','SUCCESS');closeDialog();return}
    if(uiDialog.kind==='RENAME_FRAME'){if(!value)return; snapshot();setPlay(current=>({...current,frames:current.frames.map(frame=>frame.id===current.activeFrameId?{...frame,name:value}:frame)}));notify('Frame renamed','SUCCESS');closeDialog();return}
    if(uiDialog.kind==='DELETE_FRAME'){if(play.frames.length===1)return; snapshot();setPlay(current=>{const index=current.frames.findIndex(frame=>frame.id===current.activeFrameId);const frames=current.frames.filter(frame=>frame.id!==current.activeFrameId);return{...current,frames,activeFrameId:frames[Math.max(0,index-1)].id}});notify('Frame deleted','SUCCESS');closeDialog();return}
    if(uiDialog.kind==='SAVE_PLAY'){if(!value)return;const item:SavedPlay={id:crypto.randomUUID(),name:value,fixtureLabel,savedAt:new Date().toISOString(),play:clonePlay(play)};const next=[item,...saved];setSaved(next);localStorage.setItem(libraryKey,JSON.stringify(next));setLibraryOpen(true);notify('Tactic saved locally','SUCCESS');closeDialog();return}
    if(uiDialog.kind==='GENERIC'){if(!value||!uiDialog.team)return;const parsed=dialogSecondary.trim()?Number(dialogSecondary):null;togglePlayer({id:`generic-${uiDialog.team.toLowerCase()}-${crypto.randomUUID()}`,name:value,number:typeof parsed==='number'&&Number.isFinite(parsed)?parsed:null,team:uiDialog.team});notify('Player added to this frame','SUCCESS');closeDialog();return}
    if(uiDialog.kind==='SMART_SETUP'){
      const focus=(value||'BALANCED').toUpperCase();closeDialog()
      try{const r=await fetch(`/api/whiteboard-intelligence/clubs/${encodeURIComponent(clubId)}/generate`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({frame:activeFrame,focus,fixtureLabel})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to generate setup');snapshot();const frame=j.data.frame as Frame;setPlay(current=>({...current,frames:[...current.frames,frame],activeFrameId:frame.id}));setResultPanel({title:'Smart setup created',body:`Structure score ${j.data.before.score} → ${j.data.after.score}. ${j.data.reason}`});notify('AI adjustment added as a new frame','SUCCESS')}catch(e){notify(e instanceof Error?e.message:'Unable to generate setup','ERROR')}return
    }
    if(uiDialog.kind==='OUTCOME'){
      const outcome=(value||'NEUTRAL').toUpperCase();const notes=dialogSecondary.trim();closeDialog();let stats:unknown={}
      try{const mr=await fetch(`/api/club-portal/match-day/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(sheetId)}`,{headers:{authorization:`Bearer ${token}`},cache:'no-store'});if(mr.ok){const mj=await mr.json() as SheetPayload;stats=mj.data?.state?.teamStats||{}}}catch{}
      try{const r=await fetch(`/api/whiteboard-intelligence/clubs/${encodeURIComponent(clubId)}/usage`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({playId:selectedCloudId,fixtureLabel,frameId:activeFrame.id,outcome,notes,afterStats:stats})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to record outcome');notify('Tactic outcome saved for review','SUCCESS')}catch(e){notify(e instanceof Error?e.message:'Unable to record outcome','ERROR')}return
    }
  }
  function snapshot(){setUndo(current=>[...current.slice(-39),clonePlay(play)]);setRedo([])}
  function updateState(next:BoardState,remember=true){setHasOpenedBoard(true);if(remember)snapshot();setPlay(current=>({...current,frames:current.frames.map(frame=>frame.id===current.activeFrameId?{...frame,state:next}:frame)}))}
  function undoAction(){setUndo(current=>{if(!current.length)return current;const previous=current[current.length-1];setRedo(items=>[clonePlay(play),...items].slice(0,40));setPlay(previous);return current.slice(0,-1)})}
  function redoAction(){setRedo(current=>{if(!current.length)return current;const next=current[0];setUndo(items=>[...items.slice(-39),clonePlay(play)]);setPlay(next);return current.slice(1)})}
  const pointFromClient=(clientX:number,clientY:number):Point=>{const svg=svgRef.current;if(!svg)return{x:0,y:0};const matrix=svg.getScreenCTM();if(!matrix)return{x:0,y:0};const svgPoint=svg.createSVGPoint();svgPoint.x=clientX;svgPoint.y=clientY;const local=svgPoint.matrixTransform(matrix.inverse());return{x:Math.max(0,Math.min(100,local.x/1.6)),y:Math.max(0,Math.min(100,local.y))}}
  const point=(event:React.PointerEvent<SVGSVGElement>):Point=>pointFromClient(event.clientX,event.clientY)
  function startBoard(event:React.PointerEvent<SVGSVGElement>){
    activePointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY})
    if(activePointers.current.size>=2){const pts=[...activePointers.current.values()];pinchRef.current={distance:Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y),viewport};setDrawing(null);event.currentTarget.setPointerCapture?.(event.pointerId);return}
    if(tool==='MOVE'||playing){setSelectedStrokeId('');return}
    const p=point(event)
    if(tool==='ERASER'){const hit=[...state.strokes].reverse().find(stroke=>stroke.points.some(candidate=>Math.hypot(candidate.x-p.x,candidate.y-p.y)<Math.max(2,(stroke.width||1)*1.5)));if(hit)updateState({...state,strokes:state.strokes.filter(item=>item.id!==hit.id)});return}
    const width=tool==='HIGHLIGHT'?Math.max(3,brushWidth*3):brushWidth
    setDrawing({id:crypto.randomUUID(),tool,points:[p],width,opacity:brushOpacity/100});event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  function moveBoard(event:React.PointerEvent<SVGSVGElement>){
    if(activePointers.current.has(event.pointerId))activePointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY})
    if(activePointers.current.size>=2&&pinchRef.current){const pts=[...activePointers.current.values()];const distance=Math.max(20,Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y));const ratio=pinchRef.current.distance/distance;const nextW=Math.max(35,Math.min(100,pinchRef.current.viewport.w*ratio));const nextH=Math.max(35,Math.min(100,pinchRef.current.viewport.h*ratio));const cx=pinchRef.current.viewport.x+pinchRef.current.viewport.w/2;const cy=pinchRef.current.viewport.y+pinchRef.current.viewport.h/2;setViewport({x:Math.max(0,Math.min(100-nextW,cx-nextW/2)),y:Math.max(0,Math.min(100-nextH,cy-nextH/2)),w:nextW,h:nextH});return}
    if(!drawing)return
    const p=point(event)
    setDrawing(current=>{if(!current)return current;if(['LINE','ARROW','CIRCLE','SQUARE','TRIANGLE'].includes(current.tool))return{...current,points:shapePoints(current.tool,current.points[0],p)};const last=current.points[current.points.length-1];if(last&&Math.hypot(last.x-p.x,last.y-p.y)<.3)return current;return{...current,points:[...current.points,p]}})
  }
  function endBoard(event?:React.PointerEvent<SVGSVGElement>){if(event)activePointers.current.delete(event.pointerId);if(activePointers.current.size<2)pinchRef.current=null;if(!drawing)return;updateState({...state,strokes:[...state.strokes,drawing]});setSelectedStrokeId(drawing.id);setDrawing(null)}
  function selectStroke(event:React.PointerEvent<SVGElement>,id:string){if(tool!=='MOVE')return;event.stopPropagation();setSelectedMagnetId('');setSelectedStrokeId(id)}
  function updateSelectedStroke(changes:Partial<Pick<Stroke,'width'|'opacity'>>){if(!selectedStrokeId)return;updateState({...state,strokes:state.strokes.map(item=>item.id===selectedStrokeId?{...item,...changes}:item)})}
  function moveSelectedStroke(dx:number,dy:number){if(!selectedStrokeId)return;updateState({...state,strokes:state.strokes.map(item=>item.id===selectedStrokeId?{...item,points:item.points.map(p=>({x:Math.max(0,Math.min(100,p.x+dx)),y:Math.max(0,Math.min(100,p.y+dy))}))}:item)})}
  function deleteSelectedStroke(){if(!selectedStrokeId)return;updateState({...state,strokes:state.strokes.filter(item=>item.id!==selectedStrokeId)});setSelectedStrokeId('')}
  function zoomBoard(direction:1|-1){setViewport(current=>{const factor=direction===1?.82:1.22;const w=Math.max(64,Math.min(160,current.w*factor));const h=w/1.6;const cx=current.x+current.w/2;const cy=current.y+current.h/2;return{x:Math.max(0,Math.min(160-w,cx-w/2)),y:Math.max(0,Math.min(100-h,cy-h/2)),w,h}})}
  function resetZoom(){setViewport({x:0,y:0,w:160,h:100})}
  function startMagnet(event:React.PointerEvent<SVGGElement>,id:string){if(tool!=='MOVE'||playing)return;event.stopPropagation();setSelectedStrokeId('');selectMagnet(id);snapshot();setDragging(id);event.currentTarget.setPointerCapture?.(event.pointerId)}
  function moveMagnet(event:React.PointerEvent<SVGGElement>,id:string){if(dragging!==id||tool!=='MOVE')return;const p=pointFromClient(event.clientX,event.clientY);setPlay(current=>({...current,frames:current.frames.map(frame=>frame.id===current.activeFrameId?{...frame,state:{...frame.state,magnets:frame.state.magnets.map(m=>m.id===id?{...m,x:Math.max(3,Math.min(97,p.x)),y:Math.max(4,Math.min(96,p.y))}:m)}}:frame)}))}
  function endMagnet(){setDragging('')}
  function clearBoard(){openDialog('CLEAR')}
  function optionOnField(id:string){return state.magnets.some(item=>item.id===id)}
  function trayTogglePlayer(option:PlayerOption){const existing=state.magnets.find(item=>item.id===option.id);if(existing){updateState({...state,magnets:state.magnets.filter(item=>item.id!==option.id)});return}const sideCount=state.magnets.filter(item=>item.team===option.team).length;const stagedX=option.team==='US'?8:92;const stagedY=12+(sideCount%8)*10;updateState({...state,magnets:[...state.magnets,{id:option.id,name:option.name,number:option.number,team:option.team,x:option.position?.x??stagedX,y:option.position?.y??stagedY}]})}
  function trayAddAll(team:'US'|'THEM'){const options=team==='US'?ourPlayers:oppositionPlayers;const retained=state.magnets.filter(item=>item.team!==team);const additions=options.map((option,index)=>({id:option.id,name:option.name,number:option.number,team:option.team,x:option.position?.x??(team==='US'?10+(index%6)*13:90-(index%6)*13),y:option.position?.y??(14+Math.floor(index/6)*17)}));updateState({...state,magnets:[...retained,...additions]})}
  function trayRemoveAll(team:'US'|'THEM'){updateState({...state,magnets:state.magnets.filter(item=>item.team!==team)})}

  function filteredPlayerOptions(){const source=playerTab==='US'?ourPlayers:oppositionPlayers;const q=playerSearch.trim().toLowerCase();return q?source.filter(option=>`${option.name} ${option.number??''}`.toLowerCase().includes(q)):source}
  function togglePlayerSelection(id:string){setPlayerSelection(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id])}
  function addSelectedPlayers(){const source=[...ourPlayers,...oppositionPlayers];const selected=source.filter(option=>playerSelection.includes(option.id));if(!selected.length)return;let next=[...state.magnets];selected.forEach((option,index)=>{if(next.some(item=>item.id===option.id))return;next.push({id:option.id,name:option.name,number:option.number,team:option.team,x:option.team==='US'?7:93,y:22+((next.length+index)%6)*10})});updateState({...state,magnets:next});setPlayerSelection([])}
  function quickSetup(usCount:number,themCount:number){const ours=ourPlayers.slice(0,usCount);const them=oppositionPlayers.slice(0,themCount);const magnets:Magnet[]=[];ours.forEach((option,index)=>magnets.push({id:option.id,name:option.name,number:option.number,team:'US',x:38,y:44+index*10}));them.forEach((option,index)=>magnets.push({id:option.id,name:option.name,number:option.number,team:'THEM',x:62,y:44+index*10}));updateState({...state,magnets})}
  function selectMagnet(id:string){setSelectedMagnetId(id)}
  function updateSelectedMagnet(changes:Partial<Pick<Magnet,'name'|'number'|'team'>>){if(!selectedMagnetId)return;updateState({...state,magnets:state.magnets.map(item=>item.id===selectedMagnetId?{...item,...changes}:item)})}
  function duplicateSelectedMagnet(){const magnet=state.magnets.find(item=>item.id===selectedMagnetId);if(!magnet)return;const copy={...magnet,id:`copy-${crypto.randomUUID()}`,x:Math.min(96,magnet.x+5),y:Math.min(96,magnet.y+5)};updateState({...state,magnets:[...state.magnets,copy]});setSelectedMagnetId(copy.id)}
  function removeSelectedMagnet(){if(!selectedMagnetId)return;updateState({...state,magnets:state.magnets.filter(item=>item.id!==selectedMagnetId)});setSelectedMagnetId('')}
  function togglePlayer(option:PlayerOption){
    if(optionOnField(option.id)){updateState({...state,magnets:state.magnets.filter(item=>item.id!==option.id)});return}
    const count=state.magnets.length
    const fallback={x:20+(count%5)*15,y:22+Math.floor(count/5)*14}
    const position=option.position||fallback
    updateState({...state,magnets:[...state.magnets,{id:option.id,name:option.name,number:option.number,team:option.team,x:position.x,y:position.y}]})
  }
  function addEntireTeam(team:'US'|'THEM'){
    const source=team==='US'?ourPlayers:oppositionPlayers
    const retained=state.magnets.filter(item=>item.team!==team)
    const additions=source.map((option,index)=>{const fallback=team==='US'?{x:14+(index%6)*14,y:12+Math.floor(index/6)*14}:{x:14+(index%6)*14,y:18+Math.floor(index/6)*14};const position=option.position||fallback;return{id:option.id,name:option.name,number:option.number,team:option.team,x:position.x,y:position.y}})
    updateState({...state,magnets:[...retained,...additions]})
  }
  function removeTeam(team:'US'|'THEM'){updateState({...state,magnets:state.magnets.filter(item=>item.team!==team)})}
  function addGeneric(team:'US'|'THEM'){openDialog('GENERIC',team==='US'?'Player':'Opponent','',team)}
  function addFrame(){snapshot();const id=crypto.randomUUID();const frame:Frame={id,name:`Frame ${play.frames.length+1}`,state:cloneBoard(state)};setPlay(current=>({...current,frames:[...current.frames,frame],activeFrameId:id}))}
  function duplicateFrame(){snapshot();const id=crypto.randomUUID();const frame:Frame={id,name:`${activeFrame.name} copy`,state:cloneBoard(state)};setPlay(current=>{const index=current.frames.findIndex(item=>item.id===current.activeFrameId);const frames=[...current.frames];frames.splice(index+1,0,frame);return{...current,frames,activeFrameId:id}})}
  function renameFrame(){openDialog('RENAME_FRAME',activeFrame.name)}
  function deleteFrame(){if(play.frames.length===1){notify('A play must keep at least one frame','INFO');return}openDialog('DELETE_FRAME')}
  function moveFrame(direction:-1|1){const index=activeIndex;const target=index+direction;if(target<0||target>=play.frames.length)return;snapshot();setPlay(current=>{const frames=[...current.frames];[frames[index],frames[target]]=[frames[target],frames[index]];return{...current,frames}})}
  function savePlay(){openDialog('SAVE_PLAY',`Animated play ${saved.length+1}`)}
  function loadPlay(item:SavedPlay){snapshot();setPlay(clonePlay(item.play));setLibraryOpen(false);setPlaying(false)}
  function deletePlay(id:string){const next=saved.filter(item=>item.id!==id);setSaved(next);localStorage.setItem(libraryKey,JSON.stringify(next))}
  function togglePlay(){if(play.frames.length<2)return;if(activeIndex===play.frames.length-1)setPlay(current=>({...current,activeFrameId:current.frames[0].id}));setPlaying(value=>!value)}
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
  async function loadCloud(){setCloudBusy(true);setCloudError('');try{const r=await fetch(`/api/whiteboard-platform/clubs/${encodeURIComponent(clubId)}/plays`,{headers:{authorization:`Bearer ${token}`},cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to load cloud tactics');setCloudPlays(j.data||[]);setCloudOpen(true)}catch(e){setCloudError(e instanceof Error?e.message:'Unable to load cloud tactics');setCloudOpen(true)}finally{setCloudBusy(false)}}
  async function saveCloud(){const title=prompt('Cloud tactic title',activeFrame.name||'Club tactic')?.trim();if(!title)return;setCloudBusy(true);setCloudError('');try{const method=selectedCloudId?'PUT':'POST';const url=selectedCloudId?`/api/whiteboard-platform/clubs/${encodeURIComponent(clubId)}/plays/${selectedCloudId}`:`/api/whiteboard-platform/clubs/${encodeURIComponent(clubId)}/plays`;const r=await fetch(url,{method,headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({title,category:cloudCategory,visibility:'CLUB',notes:cloudNotes,fixtureLabel,play,versionNote:'Saved from Coach App'})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to save cloud tactic');setSelectedCloudId(j.data?.id||selectedCloudId);await loadCloud()}catch(e){setCloudError(e instanceof Error?e.message:'Unable to save cloud tactic')}finally{setCloudBusy(false)}}
  function loadCloudPlay(item:CloudPlay){snapshot();setPlay(clonePlay(item.play));setSelectedCloudId(item.id);setCloudCategory(item.category||'General');setCloudNotes(item.notes||'');setCloudOpen(false)}
  async function shareCloud(item:CloudPlay){setCloudBusy(true);try{const r=await fetch(`/api/whiteboard-platform/clubs/${encodeURIComponent(clubId)}/plays/${item.id}/share`,{method:'POST',headers:{authorization:`Bearer ${token}`}});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to share tactic');const url=`${window.location.origin}${j.data.url}`;await navigator.clipboard.writeText(url);alert('Secure view-only link copied')}catch(e){setCloudError(e instanceof Error?e.message:'Unable to share tactic')}finally{setCloudBusy(false)}}
  function exportPlay(){const blob=new Blob([JSON.stringify({title:activeFrame.name,fixtureLabel,play},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`playfooty-${activeFrame.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')||'tactic'}.json`;a.click();URL.revokeObjectURL(a.href)}
  async function assignTeam(){
    if(!selectedCloudId){alert('Save or load this tactic from Club Cloud first.');return}
    const title=prompt('Assignment title',activeFrame.name||'Team tactic')?.trim();if(!title)return
    const audience=(prompt('Audience: TEAM, LINE_GROUP or SELECTED','TEAM')||'TEAM').toUpperCase()
    const instructions=prompt('Player instructions (optional)','')||''
    const quizQuestion=prompt('Quick check question (optional)','')||''
    const quizAnswer=quizQuestion?(prompt('Correct answer','')||''):''
    try{const r=await fetch(`/api/whiteboard-learning/clubs/${encodeURIComponent(clubId)}/plays/${selectedCloudId}/assign`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({title,audience,instructions,quizQuestion,quizAnswer})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to assign tactic');const url=`${window.location.origin}${j.data.url}`;await navigator.clipboard.writeText(url);alert('Player learning link copied. Send it to the team.')}catch(e){alert(e instanceof Error?e.message:'Unable to assign tactic')}
  }
  async function showProgress(){
    if(!selectedCloudId){alert('Load a Club Cloud tactic first.');return}
    try{const r=await fetch(`/api/whiteboard-learning/clubs/${encodeURIComponent(clubId)}/plays/${selectedCloudId}/assignments`,{headers:{authorization:`Bearer ${token}`},cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to load progress');const rows=Array.isArray(j.data)?j.data:[];if(!rows.length){alert('No player assignments yet.');return}alert(rows.map((x:any)=>`${x.title}: ${x.responses} responses · ${x.understood} understood · ${x.needsClarification} need clarification`).join('\n'))}catch(e){alert(e instanceof Error?e.message:'Unable to load progress')}
  }
  async function liveMeeting(){
    if(!selectedCloudId){alert('Load a Club Cloud tactic first.');return}
    const active=!meetingActive
    try{const r=await fetch(`/api/whiteboard-live/clubs/${encodeURIComponent(clubId)}/plays/${selectedCloudId}/live`,{method:'PUT',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({active,activeFrameId:activeFrame.id,presenterName:'Coach'})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to control meeting');setMeetingActive(active);setMeetingRevision(j.data?.revision||0)}catch(e){alert(e instanceof Error?e.message:'Unable to control meeting')}
  }
  async function publishFrame(frameId:string){if(!selectedCloudId||!meetingActive)return;try{const r=await fetch(`/api/whiteboard-live/clubs/${encodeURIComponent(clubId)}/plays/${selectedCloudId}/live`,{method:'PUT',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({active:true,activeFrameId:frameId,presenterName:'Coach'})});const j=await r.json();if(r.ok)setMeetingRevision(j.data?.revision||meetingRevision)}catch{}}
  async function toggleVoice(){
    if(recordingVoice){mediaRecorder?.stop();setRecordingVoice(false);return}
    if(!selectedCloudId){alert('Load a Club Cloud tactic first.');return}
    try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});const recorder=new MediaRecorder(stream);voiceChunks.current=[];recorder.ondataavailable=e=>{if(e.data.size)voiceChunks.current.push(e.data)};recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());const blob=new Blob(voiceChunks.current,{type:recorder.mimeType||'audio/webm'});const reader=new FileReader();reader.onload=async()=>{const r=await fetch(`/api/whiteboard-live/clubs/${encodeURIComponent(clubId)}/plays/${selectedCloudId}/media`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({mediaType:'AUDIO',frameId:activeFrame.id,title:`Voice note - ${activeFrame.name}`,dataUrl:reader.result})});if(!r.ok)alert('Voice note could not be saved')};reader.readAsDataURL(blob)};recorder.start();setMediaRecorder(recorder);setRecordingVoice(true)}catch{alert('Microphone access is required to record a voice-over.')}
  }
  async function attachClip(){if(!selectedCloudId){alert('Load a Club Cloud tactic first.');return}const url=prompt('Paste the match clip URL')?.trim();if(!url)return;const title=prompt('Clip title',`Clip - ${activeFrame.name}`)||'Match clip';const r=await fetch(`/api/whiteboard-live/clubs/${encodeURIComponent(clubId)}/plays/${selectedCloudId}/media`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({mediaType:'CLIP',frameId:activeFrame.id,title,url,telestration:{strokes:state.strokes}})});if(r.ok)alert('Clip attached to this frame');else alert('Clip could not be attached')}
  async function exportVideo(){
    const svg=svgRef.current;if(!svg)return;const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const ctx=canvas.getContext('2d');if(!ctx)return;const stream=canvas.captureStream(30);const recorder=new MediaRecorder(stream,{mimeType:MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm'});const chunks:Blob[]=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onstop=()=>{const blob=new Blob(chunks,{type:'video/webm'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`playfooty-${activeFrame.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')||'tactic'}.webm`;a.click();URL.revokeObjectURL(a.href)};recorder.start();for(const frame of play.frames){const xml=new XMLSerializer().serializeToString(svg);const img=new Image();await new Promise<void>(resolve=>{img.onload=()=>{ctx.fillStyle='#06131c';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,280,0,720,720);ctx.fillStyle='#fff';ctx.font='bold 30px sans-serif';ctx.fillText(frame.name,30,55);resolve()};img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(xml)});await new Promise(r=>setTimeout(r,Math.max(500,play.speed||1200)))}recorder.stop()
  }
  useEffect(()=>{if(meetingActive)void publishFrame(activeFrame.id)},[activeFrame.id,meetingActive])
  useEffect(()=>{if(!selectedCloudId)return;const poll=window.setInterval(async()=>{try{const r=await fetch(`/api/whiteboard-live/clubs/${encodeURIComponent(clubId)}/plays/${selectedCloudId}/live`,{headers:{authorization:`Bearer ${token}`},cache:'no-store'});const j=await r.json();if(r.ok){setMeetingActive(Boolean(j.data?.active));if(j.data?.revision>meetingRevision){setMeetingRevision(j.data.revision);const f=play.frames.find(x=>x.id===j.data.activeFrameId);if(f)setPlay(c=>({...c,activeFrameId:f.id}))}}}catch{}},1200);return()=>window.clearInterval(poll)},[selectedCloudId,meetingRevision,play.frames])
  async function smartSetup(){openDialog('SMART_SETUP','BALANCED')}
  async function compareFrames(){
    if(play.frames.length<2){alert('Add at least two frames before comparing.');return}
    const other=play.frames[activeIndex===0?1:activeIndex-1]
    try{const r=await fetch(`/api/whiteboard-intelligence/clubs/${encodeURIComponent(clubId)}/compare`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({a:other,b:activeFrame})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to compare frames');setResultPanel({title:'Frame comparison',body:`${other.name}: ${j.data.a.score}/100\n${activeFrame.name}: ${j.data.b.score}/100\n\n${j.data.summary}\n\nCurrent frame uncovered: ${(j.data.b.uncovered||[]).join(', ')||'None'}\nCongestion pairs: ${j.data.b.congestion}`})}catch(e){alert(e instanceof Error?e.message:'Unable to compare frames')}
  }
  async function recordOutcome(){openDialog('OUTCOME','WORKED','')}
  async function tacticalReview(){
    try{const r=await fetch(`/api/whiteboard-intelligence/clubs/${encodeURIComponent(clubId)}/review`,{headers:{authorization:`Bearer ${token}`},cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to load tactical review');const x=j.data.summary;const recent=(j.data.entries||[]).slice(0,5).map((row:any)=>`${row.outcome} · ${row.fixtureLabel||'Match'}${row.notes?` · ${row.notes}`:''}`).join('\n');setResultPanel({title:'Tactical review',body:`Used: ${x.total}\nWorked: ${x.improved}\nNeutral: ${x.neutral}\nFailed: ${x.declined}\n\n${recent||'No tactics have been rated yet.'}`})}catch(e){alert(e instanceof Error?e.message:'Unable to load tactical review')}
  }
  async function gameModel(){
    const action=(prompt('Game Model: SAVE or LOAD','SAVE')||'SAVE').toUpperCase()
    if(action==='LOAD'){
      try{const r=await fetch(`/api/whiteboard-intelligence/clubs/${encodeURIComponent(clubId)}/game-models`,{headers:{authorization:`Bearer ${token}`},cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to load game models');const rows=Array.isArray(j.data)?j.data:[];if(!rows.length){alert('No game-model templates saved yet.');return}const choice=Number(prompt(rows.map((x:any,i:number)=>`${i+1}. ${x.phase} · ${x.title}`).join('\n'),'1'))-1;const item=rows[choice];if(!item)return;snapshot();setPlay(clonePlay(item.play));alert(`${item.title} loaded.`)}catch(e){alert(e instanceof Error?e.message:'Unable to load game model')};return
    }
    const title=prompt('Game-model title',activeFrame.name)?.trim();if(!title)return
    const phase=(prompt('Phase: CONTEST, ATTACK, DEFENCE, TRANSITION, KICK-IN or STOPPAGE','ATTACK')||'GENERAL').toUpperCase()
    const description=prompt('Game-model principle','')||''
    try{const r=await fetch(`/api/whiteboard-intelligence/clubs/${encodeURIComponent(clubId)}/game-models`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({title,phase,description,play})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to save game model');alert('Club game-model template saved.')}catch(e){alert(e instanceof Error?e.message:'Unable to save game model')}
  }
  const strokes=[...state.strokes,...(drawing?[drawing]:[])]
  if(loading)return <CoachAppLoading message="Loading your selected team and tactics…"/>
  return <main className={`cawb2 ${presenting?'presenting':''} ${playBuilderOpen?'play-builder-open':''}`}><style>{styles}</style>
    {!presenting&&<header className="wb-topbar"><button className="back" aria-label={returnToMatch?'Return to live match':'Back to Coach Tools'} onClick={onExit}><ArrowLeft/> {returnToMatch?'Return to Match':'Back'}</button><div className="wb-title"><span>PLAYFOOTY WHITEBOARD</span><b>{fixtureLabel}</b><small className={`save-state ${saveStatus.toLowerCase()}`}><i/>{saveStatus==='SAVING'?'Saving…':saveStatus==='OFFLINE'?'Saved on this iPad':'Saved'}</small></div><div className="wb-primary-actions"><button aria-label="Open presentation mode" onClick={()=>setPresenting(true)}><Presentation/>Present</button><button aria-label="Open more Whiteboard actions" className="wb-more-button" onClick={()=>setMoreOpen(v=>!v)} aria-expanded={moreOpen}><span>•••</span>More</button></div></header>}
    {!presenting&&<aside className="tools"><button title="Select and move" aria-label="Select and move players or drawings" aria-pressed={tool==='MOVE'} className={tool==='MOVE'?'active':''} onClick={()=>{setTool('MOVE');setDrawTrayOpen(false)}}><MousePointer2/><span>Move</span></button><button title="Add players" aria-label="Open player strip" aria-pressed={playerDrawerOpen} className={playerDrawerOpen?'active':''} onClick={()=>{setPlayerDrawerOpen(value=>!value);setDrawTrayOpen(false)}}><Users/><span>Players</span></button><button title="Drawing tools" aria-label="Open drawing tools" aria-pressed={drawTrayOpen} className={drawTrayOpen?'active':''} onClick={()=>{setDrawTrayOpen(value=>!value);setPlayerDrawerOpen(false);if(tool==='MOVE')setTool('PEN')}}><Pencil/><span>Draw</span></button><hr/><button title="Undo" aria-label="Undo last Whiteboard change" disabled={!undo.length} onClick={undoAction}><Undo2/><span>Undo</span></button><button title="Redo" aria-label="Redo Whiteboard change" disabled={!redo.length} onClick={redoAction}><Redo2/><span>Redo</span></button><button title="Clear current frame" aria-label="Clear players and drawings from current frame" onClick={clearBoard}><Trash2/><span>Clear</span></button></aside>}
    {!presenting&&drawTrayOpen&&<section className="draw-bottom-tray"><div className="draw-tool-list"><button className={tool==='PEN'?'active':''} onClick={()=>setTool('PEN')}><Pencil/><span>Pen</span></button><button className={tool==='LINE'?'active':''} onClick={()=>setTool('LINE')}><Minus/><span>Line</span></button><button className={tool==='ARROW'?'active':''} onClick={()=>setTool('ARROW')}><ArrowLeft className="arrow-tool"/><span>Arrow</span></button><button className={tool==='HIGHLIGHT'?'active':''} onClick={()=>setTool('HIGHLIGHT')}><Highlighter/><span>Highlight</span></button><button className={tool==='CIRCLE'?'active':''} onClick={()=>setTool('CIRCLE')}><Circle/><span>Circle</span></button><button className={tool==='SQUARE'?'active':''} onClick={()=>setTool('SQUARE')}><Square/><span>Square</span></button><button className={tool==='TRIANGLE'?'active':''} onClick={()=>setTool('TRIANGLE')}><Triangle/><span>Triangle</span></button><button className={tool==='ERASER'?'active danger':''} onClick={()=>setTool('ERASER')}><Eraser/><span>Eraser</span></button></div><div className="draw-settings"><div className="zoom-controls"><button onClick={()=>zoomBoard(1)}>+</button><button onClick={()=>zoomBoard(-1)}>−</button><button onClick={resetZoom}>Fit</button></div>{tool!=='ERASER'&&<><label>Thickness<input type="range" min="0.5" max="4" step="0.25" value={brushWidth} onChange={e=>setBrushWidth(Number(e.target.value))}/><b>{brushWidth.toFixed(1)}</b></label><label>Opacity<input type="range" min="20" max="100" step="5" value={brushOpacity} onChange={e=>setBrushOpacity(Number(e.target.value))}/><b>{brushOpacity}%</b></label></>}</div><button className="draw-close" aria-label="Close drawing tools" onClick={()=>{setDrawTrayOpen(false);setTool('MOVE')}}><X/></button></section>}
    {playerDrawerOpen&&!presenting&&<section className="player-bottom-tray"><header><div><span>ADD PLAYERS</span><b>{playerTab==='US'?'Our team':'Opposition'}</b></div><div className="player-tray-tabs"><button className={playerTab==='US'?'active':''} onClick={()=>setPlayerTab('US')}>Our team</button><button className={playerTab==='THEM'?'active':''} onClick={()=>setPlayerTab('THEM')}>Opposition</button></div><div className="player-tray-actions"><button onClick={()=>trayAddAll(playerTab==='US'?'US':'THEM')}>Add all</button><button onClick={()=>trayRemoveAll(playerTab==='US'?'US':'THEM')}>Remove all</button><button aria-label="Close player strip" onClick={()=>setPlayerDrawerOpen(false)}><X/></button></div></header><div className="player-tray-list">{(playerTab==='US'?ourPlayers:oppositionPlayers).map(option=><button key={option.id} className={optionOnField(option.id)?'on-field':''} onClick={()=>trayTogglePlayer(option)}><b>{option.number??'—'}</b><span>{option.name}</span><small>{optionOnField(option.id)?'On field':'Tap to add'}</small></button>)}</div></section>}
    <section className="board-wrap"><svg ref={svgRef} viewBox={`${viewport.x} ${viewport.y} ${viewport.w} ${viewport.h}`} onPointerDown={startBoard} onPointerMove={moveBoard} onPointerUp={endBoard} onPointerCancel={endBoard}><defs><marker id="arrow2" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill="#fff"/></marker></defs><rect width="160" height="100" rx="2" fill="#06131c"/><ellipse cx="80" cy="50" rx="74" ry="45" fill="#078b40" stroke="#39f49b" strokeWidth=".7"/><path d="M80 5v90" stroke="rgba(255,255,255,.42)" strokeWidth=".35"/><rect x="66" y="38" width="28" height="24" fill="none" stroke="rgba(255,255,255,.58)" strokeWidth=".4"/><circle cx="80" cy="50" r="5" fill="none" stroke="rgba(255,255,255,.65)" strokeWidth=".4"/><circle cx="80" cy="50" r=".8" fill="rgba(255,255,255,.75)"/><path d="M31.5 16 Q58 50 31.5 84M128.5 16 Q102 50 128.5 84" fill="none" stroke="rgba(255,255,255,.58)" strokeWidth=".45"/><path d="M8.7 38H14M6.3 46H17.3M6.3 54H17.3M8.7 62H14M151.3 38H146M153.7 46H142.7M153.7 54H142.7M151.3 62H146" stroke="#fff" strokeWidth=".55" strokeLinecap="round"/><path d="M8.7 38C6.9 43 6.3 47 6.3 50C6.3 53 6.9 57 8.7 62M151.3 38C153.1 43 153.7 47 153.7 50C153.7 53 153.1 57 151.3 62" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth=".35"/>{strokes.map(stroke=>{const selected=selectedStrokeId===stroke.id;const width=stroke.width??(stroke.tool==='HIGHLIGHT'?4:.8);const opacity=stroke.opacity??(stroke.tool==='HIGHLIGHT'?0.55:1);return <g key={stroke.id} onPointerDown={event=>selectStroke(event,stroke.id)} className={selected?'selected-stroke':''}>{selected&&(stroke.tool==='ARROW'?<line x1={(stroke.points[0]?.x??0)*1.6} y1={stroke.points[0]?.y} x2={(stroke.points.at(-1)?.x??0)*1.6} y2={stroke.points.at(-1)?.y} stroke="#20b8ff" strokeWidth={width+1.4} strokeLinecap="round" opacity=".8"/>:<polyline points={stroke.points.map(p=>`${p.x*1.6},${p.y}`).join(' ')} fill="none" stroke="#20b8ff" strokeWidth={width+1.4} strokeLinecap="round" strokeLinejoin="round" opacity=".8"/>)}{stroke.tool==='ARROW'?<line x1={(stroke.points[0]?.x??0)*1.6} y1={stroke.points[0]?.y} x2={(stroke.points.at(-1)?.x??0)*1.6} y2={stroke.points.at(-1)?.y} stroke="#fff" strokeWidth={width} opacity={opacity} markerEnd="url(#arrow2)" strokeLinecap="round"/>:<polyline points={stroke.points.map(p=>`${p.x*1.6},${p.y}`).join(' ')} fill="none" stroke={stroke.tool==='HIGHLIGHT'?'#ffd60a':'#fff'} strokeWidth={width} opacity={opacity} strokeLinecap="round" strokeLinejoin="round"/>}</g>})}{state.magnets.map(m=><g key={m.id} transform={`translate(${m.x*1.6} ${m.y})`} onPointerDown={event=>startMagnet(event,m.id)} onPointerMove={event=>moveMagnet(event,m.id)} onPointerUp={endMagnet} onPointerCancel={endMagnet} className={`magnet ${m.team.toLowerCase()}`}><circle r="3.2" fill={m.team==='US'?'#20b8ff':'#f04452'} stroke="#fff" strokeWidth=".45"/><text y=".7" textAnchor="middle" fill="#fff" fontSize="2.25" fontWeight="900">{m.number??(m.team==='US'?'PF':'O')}</text><rect x="-5" y="3.6" width="10" height="2.8" rx="1.1" fill="rgba(4,12,18,.9)"/><text y="5.55" textAnchor="middle" fill="#fff" fontSize="1.45" fontWeight="800">{m.name.slice(0,12)}</text></g>)}</svg>{!presenting&&state.magnets.length===0&&state.strokes.length===0&&<div className="wb-empty-board"><div><Users/><b>Build your tactic</b><p>Add individual players, use a quick setup, or start drawing on the oval.</p><button onClick={()=>{setPlayerDrawerOpen(true);setHasOpenedBoard(true)}}>Add players</button></div></div>}{!presenting&&<div className="legend"><span><i className="us"/>Your team</span><span><i className="them"/>Opposition</span><small>Frame {activeIndex+1} of {play.frames.length} · {activeFrame.name}</small></div>}{presenting&&<><button className="exit-present" onClick={()=>{setPresenting(false);setPlaying(false)}}><X/>Exit presentation</button><button className="present-play" onClick={togglePlay}>{playing?<Pause/>:<Play/>}{playing?'Pause':'Play sequence'}</button></>}</section>
    {!presenting&&playBuilderOpen&&<footer className="timeline"><div className="play-controls"><button onClick={togglePlay} disabled={play.frames.length<2}>{playing?<Pause/>:<Play/>}</button><label>Speed<select value={play.speed} onChange={event=>setPlay(current=>({...current,speed:Number(event.target.value)}))}><option value={700}>Fast</option><option value={1200}>Normal</option><option value={2000}>Slow</option></select></label><button className={play.loop?'active':''} onClick={()=>setPlay(current=>({...current,loop:!current.loop}))}><Repeat2/>Loop</button></div><div className="frames">{play.frames.map((frame,index)=><button key={frame.id} aria-label={`Open frame ${index+1}: ${frame.name}`} className={`frame-card ${frame.id===play.activeFrameId?'active':''}`} onClick={()=>{setPlaying(false);setHasOpenedBoard(true);setPlay(current=>({...current,activeFrameId:frame.id}))}}><span className="frame-thumb"><svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="50" rx="43" ry="47"/><path d="M50 3v94M7 50h86"/>{frame.state.strokes.slice(0,8).map(stroke=>stroke.tool==='ARROW'?<line key={stroke.id} x1={(stroke.points[0]?.x??0)*1.6} y1={stroke.points[0]?.y} x2={(stroke.points.at(-1)?.x??0)*1.6} y2={stroke.points.at(-1)?.y}/>:<polyline key={stroke.id} points={stroke.points.map(point=>`${point.x},${point.y}`).join(' ')}/>)}{frame.state.magnets.slice(0,22).map(magnet=><circle key={magnet.id} className={magnet.team==='US'?'us':'them'} cx={magnet.x} cy={magnet.y} r="3.5"/>)}</svg><i>{index+1}</i></span><span className="frame-name">{frame.name}</span></button>)}<button className="add" aria-label="Add a new tactical frame" onClick={addFrame}><Plus/>Add frame</button></div><div className="frame-actions"><button onClick={duplicateFrame}><Copy/>Duplicate</button><button onClick={renameFrame}><Pencil/>Rename</button><button disabled={activeIndex===0} onClick={()=>moveFrame(-1)}><ChevronUp/>Earlier</button><button disabled={activeIndex===play.frames.length-1} onClick={()=>moveFrame(1)}><ChevronDown/>Later</button><button disabled={play.frames.length===1} onClick={deleteFrame}><Trash2/>Delete</button></div></footer>}
    {cloudOpen&&<div className="library-modal"><section><header><div><span>CLUB TACTICS CLOUD</span><h2>Shared coaching library</h2></div><button onClick={()=>setCloudOpen(false)}><X/></button></header><div className="cloud-form"><input value={cloudCategory} onChange={e=>setCloudCategory(e.target.value)} placeholder="Category"/><textarea value={cloudNotes} onChange={e=>setCloudNotes(e.target.value)} placeholder="Coaching notes"/><button className="save" disabled={cloudBusy} onClick={()=>void saveCloud()}><Cloud/>{selectedCloudId?'Save new version':'Save to club cloud'}</button></div>{cloudError&&<p>{cloudError}</p>}{cloudBusy?<p>Syncing…</p>:cloudPlays.length?<div>{cloudPlays.map(item=><article key={item.id}><button onClick={()=>loadCloudPlay(item)}><b>{item.title}</b><span>{item.category} · {item.visibility}</span><small>{new Date(item.updatedAt).toLocaleString()}</small></button><button title="Share view-only link" onClick={()=>void shareCloud(item)}><Share2/></button></article>)}</div>:<p>No cloud tactics yet. Save this play to make it available to the coaching group.</p>}</section></div>}
    {toast&&<div className={`wb-toast ${toast.tone.toLowerCase()}`} role="status">{toast.message}</div>}
    {resultPanel&&<div className="cawb2-modal" role="presentation"><section className="wb-result-panel" role="dialog" aria-modal="true" aria-label={resultPanel.title}><header><div><span>PLAYFOOTY WHITEBOARD</span><h2>{resultPanel.title}</h2></div><button onClick={()=>setResultPanel(null)}><X/></button></header><pre>{resultPanel.body}</pre><div className="wb-dialog-actions"><button className="primary" onClick={()=>setResultPanel(null)}>Done</button></div></section></div>}
    {uiDialog&&<div className="cawb2-modal" role="presentation"><section className="wb-native-dialog" role="dialog" aria-modal="true" aria-label="Whiteboard action"><header><div><span>PLAYFOOTY WHITEBOARD</span><h2>{uiDialog.kind==='CLEAR'?'Clear this frame?':uiDialog.kind==='RENAME_FRAME'?'Rename frame':uiDialog.kind==='DELETE_FRAME'?'Delete frame?':uiDialog.kind==='SAVE_PLAY'?'Save tactic':uiDialog.kind==='GENERIC'?'Add player':uiDialog.kind==='SMART_SETUP'?'Smart Setup':'Record outcome'}</h2><p>{uiDialog.kind==='CLEAR'?'Players and drawings will be removed from this frame only.':uiDialog.kind==='DELETE_FRAME'?`${activeFrame.name} will be removed from this play.`:uiDialog.kind==='SMART_SETUP'?'Choose the structure you want the AI to prioritise.':uiDialog.kind==='OUTCOME'?'Record what happened when this tactic was used.':'Complete the details below.'}</p></div><button onClick={closeDialog}><X/></button></header>{!['CLEAR','DELETE_FRAME'].includes(uiDialog.kind)&&<div className="wb-dialog-fields">{uiDialog.kind==='SMART_SETUP'?<div className="wb-choice-grid">{['BALANCED','ATTACK','DEFENCE','WIDTH'].map(option=><button key={option} className={dialogValue===option?'active':''} onClick={()=>setDialogValue(option)}>{option}</button>)}</div>:uiDialog.kind==='OUTCOME'?<><div className="wb-choice-grid">{['WORKED','NEUTRAL','FAILED'].map(option=><button key={option} className={dialogValue===option?'active':''} onClick={()=>setDialogValue(option)}>{option}</button>)}</div><label>Coaching notes<textarea value={dialogSecondary} onChange={event=>setDialogSecondary(event.target.value)} placeholder="What happened when the tactic was used?"/></label></>:<><label>{uiDialog.kind==='GENERIC'?'Name':uiDialog.kind==='RENAME_FRAME'?'Frame name':'Tactic name'}<input autoFocus value={dialogValue} onChange={event=>setDialogValue(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')void submitDialog()}}/></label>{uiDialog.kind==='GENERIC'&&<label>Number <span>(optional)</span><input inputMode="numeric" value={dialogSecondary} onChange={event=>setDialogSecondary(event.target.value)} placeholder="e.g. 23"/></label>}</>}</div>}<div className="wb-dialog-actions"><button onClick={closeDialog}>Cancel</button><button className={uiDialog.kind==='DELETE_FRAME'||uiDialog.kind==='CLEAR'?'danger':'primary'} onClick={()=>void submitDialog()}>{uiDialog.kind==='CLEAR'?'Clear frame':uiDialog.kind==='DELETE_FRAME'?'Delete frame':uiDialog.kind==='SMART_SETUP'?'Create setup':uiDialog.kind==='OUTCOME'?'Save outcome':'Save'}</button></div></section></div>}
    {moreOpen&&!presenting&&<div className="wb-more-popover"><button className="play-builder-toggle" onClick={()=>{setPlayBuilderOpen(value=>!value);setMoreOpen(false)}}><Film/><span><b>{playBuilderOpen?'Hide Play Builder':'Open Play Builder'}</b><small>Frames, animation and video tools</small></span></button><div className="wb-more-head"><div><span>WHITEBOARD TOOLS</span><b>More actions</b></div><button onClick={()=>setMoreOpen(false)}><X/></button></div><section><h3>Coach</h3><div><button onClick={()=>{setMoreOpen(false);void analyseTactic('frame')}}><Sparkles/>Analyse</button><button onClick={()=>{setMoreOpen(false);void smartSetup()}}><BrainCircuit/>Smart Setup</button><button onClick={()=>{setMoreOpen(false);void compareFrames()}}><GitCompare/>Compare</button><button onClick={()=>{setMoreOpen(false);void gameModel()}}><BookOpen/>Game Model</button></div></section><section><h3>Share</h3><div><button onClick={()=>{setMoreOpen(false);void loadCloud()}}><Cloud/>Club Cloud</button><button onClick={()=>{setMoreOpen(false);void assignTeam()}}><Users/>Assign</button><button onClick={()=>{setMoreOpen(false);void showProgress()}}><BarChart3/>Progress</button><button onClick={()=>{setMoreOpen(false);void liveMeeting()}}><Radio/>{meetingActive?'End meeting':'Live meeting'}</button><button onClick={()=>{setMoreOpen(false);void toggleVoice()}}><Mic/>{recordingVoice?'Stop voice':'Voice-over'}</button><button onClick={()=>{setMoreOpen(false);void attachClip()}}><Film/>Attach clip</button><button onClick={()=>{setMoreOpen(false);void exportVideo()}}><Video/>Video</button><button onClick={()=>{setMoreOpen(false);exportPlay()}}><Download/>Export</button></div></section><section><h3>Review & library</h3><div><button onClick={()=>{setMoreOpen(false);void recordOutcome()}}><Target/>Outcome</button><button onClick={()=>{setMoreOpen(false);void tacticalReview()}}><BarChart3/>Review</button><button onClick={()=>{setMoreOpen(false);setLibraryOpen(true)}}><Library/>Local library</button><button onClick={()=>{setMoreOpen(false);savePlay()}}><Save/>Save play</button></div></section></div>}
    {playerDrawerOpen&&<><button className="player-drawer-backdrop" aria-label="Close player library" onClick={()=>setPlayerDrawerOpen(false)}/><aside className="player-drawer"><header><div><span>PLAYER LIBRARY</span><h2>Build this frame</h2><p>{state.magnets.filter(m=>m.team==='US').length} ours · {state.magnets.filter(m=>m.team==='THEM').length} opposition on field</p></div><button onClick={()=>setPlayerDrawerOpen(false)}><X/></button></header><div className="player-tabs"><button className={playerTab==='US'?'active':''} onClick={()=>{setPlayerTab('US');setPlayerSelection([])}}>Our Team</button><button className={playerTab==='THEM'?'active':''} onClick={()=>{setPlayerTab('THEM');setPlayerSelection([])}}>Opposition</button><button className={playerTab==='GENERIC'?'active':''} onClick={()=>{setPlayerTab('GENERIC');setPlayerSelection([])}}>Generic</button></div>{playerTab!=='GENERIC'?<><input className="player-search" value={playerSearch} onChange={e=>setPlayerSearch(e.target.value)} placeholder="Search player or number"/><div className="quick-setups"><button onClick={()=>quickSetup(1,1)}>1 v 1</button><button onClick={()=>quickSetup(2,1)}>2 v 1</button><button onClick={()=>quickSetup(2,2)}>2 v 2</button><button onClick={()=>quickSetup(3,2)}>3 v 2</button></div><div className="player-actions"><button onClick={()=>addEntireTeam(playerTab)}>Add Entire Team</button><button onClick={()=>removeTeam(playerTab)}>Remove This Team</button></div><div className="player-grid">{filteredPlayerOptions().map(option=>{const onField=optionOnField(option.id);const selected=playerSelection.includes(option.id);return <button key={option.id} className={`${onField?'selected':''} ${selected?'queued':''}`} onClick={()=>togglePlayerSelection(option.id)}><b>{option.number??'–'}</b><span>{option.name}</span><small>{onField?'On field':selected?'Selected':'Tap to select'}</small></button>})}</div><footer><button className="secondary" onClick={()=>setPlayerSelection([])}>Clear selection</button><button className="primary" disabled={!playerSelection.length} onClick={addSelectedPlayers}>Add selected ({playerSelection.length})</button></footer></>:<div className="generic-actions"><button onClick={()=>openDialog('GENERIC','Player','', 'US')}>+ Generic Our Player</button><button onClick={()=>openDialog('GENERIC','Opponent','', 'THEM')}>+ Generic Opponent</button><p>Generic magnets only exist on this tactical frame.</p></div>}</aside></>}
    {selectedStrokeId&&!presenting&&state.strokes.some(item=>item.id===selectedStrokeId)&&<aside className="stroke-inspector">{(()=>{const stroke=state.strokes.find(item=>item.id===selectedStrokeId)!;return <><header><div><span>SELECTED DRAWING</span><b>{stroke.tool==='HIGHLIGHT'?'Zone':stroke.tool==='ARROW'?'Arrow':'Pen stroke'}</b></div><button onClick={()=>setSelectedStrokeId('')}><X/></button></header><label>Thickness<input type="range" min="0.5" max="12" step="0.25" value={stroke.width??1} onChange={e=>updateSelectedStroke({width:Number(e.target.value)})}/></label><label>Opacity<input type="range" min=".2" max="1" step=".05" value={stroke.opacity??1} onChange={e=>updateSelectedStroke({opacity:Number(e.target.value)})}/></label><div className="stroke-nudge"><button onClick={()=>moveSelectedStroke(0,-1)}>↑</button><button onClick={()=>moveSelectedStroke(-1,0)}>←</button><button onClick={()=>moveSelectedStroke(1,0)}>→</button><button onClick={()=>moveSelectedStroke(0,1)}>↓</button></div><button className="danger" onClick={deleteSelectedStroke}>Delete drawing</button></>})()}</aside>}
    {selectedMagnetId&&!presenting&&state.magnets.some(item=>item.id===selectedMagnetId)&&<aside className="magnet-inspector">{(()=>{const magnet=state.magnets.find(item=>item.id===selectedMagnetId)!;return <><header><div><span>SELECTED PLAYER</span><b>{magnet.name}</b></div><button onClick={()=>setSelectedMagnetId('')}><X/></button></header><label>Name<input value={magnet.name} onChange={e=>updateSelectedMagnet({name:e.target.value})}/></label><label>Number<input inputMode="numeric" value={magnet.number??''} onChange={e=>updateSelectedMagnet({number:e.target.value===''?null:Number(e.target.value)})}/></label><div className="inspector-team"><button className={magnet.team==='US'?'active':''} onClick={()=>updateSelectedMagnet({team:'US'})}>Our team</button><button className={magnet.team==='THEM'?'active':''} onClick={()=>updateSelectedMagnet({team:'THEM'})}>Opposition</button></div><button onClick={duplicateSelectedMagnet}>Duplicate</button><button className="danger" onClick={removeSelectedMagnet}>Remove from frame</button></>})()}</aside>}
    {analysisOpen&&<div className="analysis-modal"><section><header><div><span>AI TACTICAL ASSISTANT</span><h2>{analysisLoading?'Reading the board…':analysis?.headline||'Tactical analysis'}</h2></div><button onClick={()=>setAnalysisOpen(false)}><X/></button></header>{analysisLoading?<div className="analysis-loading"><Sparkles/><b>Analysing spacing, structure and match context…</b></div>:analysisError?<div className="analysis-loading"><b>{analysisError}</b><button onClick={()=>void analyseTactic(analysisScope)}>Try again</button></div>:analysis?<><p className="analysis-summary">{analysis.summary}</p><div className="analysis-grid"><article><h3>What works</h3>{analysis.strengths.map((item,index)=><p key={index}>{item}</p>)}</article><article><h3>Risks</h3>{analysis.risks.map((item,index)=><p key={index}>{item}</p>)}</article><article><h3>Adjustments</h3>{analysis.adjustments.map((item,index)=><p key={index}>{index+1}. {item}</p>)}</article></div><blockquote>“{analysis.coachMessage}”</blockquote><footer><button onClick={()=>void analyseTactic(analysisScope==='frame'?'play':'frame')}>Analyse {analysisScope==='frame'?'full play':'current frame'}</button><button className="apply" onClick={applyAdjustment}>Create adjustment frame</button></footer></>:null}</section></div>}
    {libraryOpen&&<div className="library-modal"><section><header><div><span>TACTICS LIBRARY</span><h2>Animated plays</h2></div><button onClick={()=>setLibraryOpen(false)}><X/></button></header>{saved.length?<div>{saved.map(item=><article key={item.id}><button onClick={()=>loadPlay(item)}><b>{item.name}</b><span>{item.play.frames.length} frames · {item.fixtureLabel}</span><small>{new Date(item.savedAt).toLocaleString()}</small></button><button className="delete" onClick={()=>deletePlay(item.id)}><Trash2/></button></article>)}</div>:<p>No animated plays saved yet. Build multiple frames and tap Save play.</p>}</section></div>}
  </main>
}

const styles=`
.cawb2{position:fixed;z-index:2000;inset:0;display:grid;grid-template-columns:74px 1fr;grid-template-rows:68px minmax(0,1fr) 112px;background:#061019;color:#fff;font-family:Barlow,Inter,Arial,sans-serif;touch-action:none}.cawb2 *{box-sizing:border-box}.cawb2>header{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 14px;border-bottom:1px solid #223845;background:#091923}.cawb2>header button,.cawb2>header nav button{display:flex;align-items:center;gap:6px;min-height:42px;border:1px solid #304a5a;border-radius:9px;background:#102633;padding:0 12px;color:#fff;font-weight:900}.cawb2>header .back{background:#10212d}.cawb2>header>div{display:grid;text-align:center}.cawb2>header>div span{color:#20b8ff;font-size:10px;font-weight:1000;letter-spacing:.12em}.cawb2>header>div b{font-size:14px}.cawb2>header nav{display:flex;gap:7px}.cawb2>header nav .analyse{border-color:#20b8ff;background:#0d4e70;color:#fff}.analysis-modal{position:fixed;z-index:3200;inset:0;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.82);backdrop-filter:blur(9px)}.analysis-modal>section{width:min(820px,96vw);max-height:90vh;overflow:auto;padding:18px;border:1px solid #315469;border-radius:18px;background:#091923;box-shadow:0 30px 100px #000}.analysis-modal header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.analysis-modal header span{color:#20b8ff;font-size:10px;font-weight:1000;letter-spacing:.12em}.analysis-modal h2{margin:4px 0 0;font-size:30px}.analysis-modal header>button{display:grid;place-items:center;width:42px;height:42px;border:1px solid #345264;border-radius:10px;background:#102633;color:#fff}.analysis-loading{display:grid;place-items:center;gap:12px;min-height:260px;text-align:center;color:#b8c8d2}.analysis-loading svg{width:44px;height:44px;color:#20b8ff;animation:aiPulse 1.2s infinite}.analysis-summary{padding:12px;border-left:4px solid #20b8ff;border-radius:8px;background:#102633;line-height:1.45}.analysis-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}.analysis-grid article{padding:12px;border:1px solid #294553;border-radius:12px;background:#0d202c}.analysis-grid h3{margin:0 0 8px;color:#20b8ff;font-size:13px;text-transform:uppercase}.analysis-grid p{margin:7px 0;font-size:12px;line-height:1.35}.analysis-modal blockquote{margin:12px 0;padding:14px;border-radius:12px;background:#062f46;color:#fff;font-size:16px;font-weight:900}.analysis-modal footer{display:flex;justify-content:flex-end;gap:8px}.analysis-modal footer button,.analysis-loading button{min-height:42px;border:1px solid #345264;border-radius:9px;background:#102633;padding:0 13px;color:#fff;font-weight:900}.analysis-modal footer .apply{border-color:#20b8ff;background:#20b8ff;color:#04121b}@keyframes aiPulse{50%{transform:scale(1.15);opacity:.6}}@media(max-width:800px){.analysis-grid{grid-template-columns:1fr}.analysis-modal footer{flex-direction:column}}.cawb2>header nav .save{border-color:#20b8ff;background:#20b8ff;color:#04121b}.tools{grid-row:2/4;display:flex;flex-direction:column;gap:6px;padding:8px;border-right:1px solid #223845;background:#091923}.tools button{display:grid;place-items:center;gap:2px;min-height:48px;border:1px solid transparent;border-radius:9px;background:#10212d;color:#9fb2bf}.tools button.active{border-color:#20b8ff;background:#12364a;color:#fff}.tools button:disabled{opacity:.28}.tools svg{width:18px}.tools span{font-size:9px;font-weight:900}.tools hr{width:100%;border:0;border-top:1px solid #243b49}.arrow-tool{transform:rotate(135deg)}.board-wrap{position:relative;display:grid;min-width:0;min-height:0;padding:8px 14px 5px}.board-wrap svg{width:100%;height:100%;min-height:0;border:1px solid #263e4d;border-radius:14px;background:#06131c;box-shadow:0 16px 42px rgba(0,0,0,.35)}.magnet{cursor:grab}.magnet:active{cursor:grabbing}.legend{position:absolute;left:26px;bottom:13px;display:flex;align-items:center;gap:14px;padding:6px 9px;border-radius:8px;background:rgba(4,14,21,.82);font-size:9px;font-weight:800}.legend span{display:flex;align-items:center;gap:5px}.legend i{width:9px;height:9px;border-radius:50%}.legend .us{background:#20b8ff}.legend .them{background:#f04452}.legend small{color:#a4bac7}.timeline{grid-column:2;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:stretch;padding:8px 12px 10px;border-top:1px solid #223845;background:#091923}.play-controls,.frame-actions{display:flex;align-items:center;gap:6px}.play-controls button,.frame-actions button,.frames button{display:flex;align-items:center;justify-content:center;gap:4px;border:1px solid #304b5c;border-radius:8px;background:#102633;color:#fff;font-size:9px;font-weight:900}.play-controls>button:first-child{width:44px;background:#20b8ff;color:#04121b}.play-controls button.active{border-color:#20b8ff;color:#20b8ff}.play-controls label{display:grid;gap:3px;color:#8fa5b3;font-size:8px;font-weight:900;text-transform:uppercase}.play-controls select{height:31px;border:1px solid #304b5c;border-radius:7px;background:#102633;color:#fff;font-weight:800}.frames{display:flex;gap:6px;overflow-x:auto;padding:1px}.frames button{min-width:96px;padding:7px 10px;justify-content:flex-start}.frames button b{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#203a49}.frames button span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.frames button.active{border-color:#20b8ff;background:#12364a}.frames .add{border-style:dashed;color:#20b8ff}.frame-actions{flex-wrap:wrap;justify-content:flex-end}.frame-actions button{padding:0 8px;min-height:34px}.frame-actions button:disabled{opacity:.28}.frame-actions svg{width:14px}.presenting{grid-template-columns:1fr;grid-template-rows:1fr;background:#000}.presenting .board-wrap{padding:0}.presenting .board-wrap svg{border:0;border-radius:0}.exit-present,.present-play{position:fixed;z-index:20;top:16px;display:flex;align-items:center;gap:6px;min-height:44px;border:1px solid rgba(255,255,255,.35);border-radius:10px;background:rgba(3,12,18,.85);padding:0 13px;color:#fff;font-weight:900}.exit-present{right:16px}.present-play{left:16px;background:#20b8ff;color:#04121b}.library-modal{position:fixed;z-index:2200;inset:0;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.78);backdrop-filter:blur(8px)}.library-modal>section{width:min(720px,100%);max-height:84vh;overflow:auto;padding:18px;border:1px solid #315064;border-radius:18px;background:#0b1b26}.library-modal header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.library-modal header span{color:#20b8ff;font-size:10px;font-weight:950}.library-modal h2{margin:2px 0 0;font-size:30px}.library-modal header>button{width:42px;height:42px;border:1px solid #385367;border-radius:10px;background:#122b3a;color:#fff}.library-modal article{display:grid;grid-template-columns:1fr auto;gap:8px;margin:7px 0}.library-modal article>button:first-child{display:grid;gap:3px;text-align:left;border:1px solid #294555;border-radius:10px;background:#102633;padding:11px;color:#fff}.library-modal article span,.library-modal article small{color:#9eb1bd}.library-modal .delete{width:44px;border:1px solid #5d2931;border-radius:10px;background:#36151b;color:#ff7a88}.cawb2-loading{position:fixed;inset:0;display:grid;place-items:center;background:#061019;color:#fff;font-weight:900}
@media(max-width:900px) and (orientation:landscape){.cawb2{grid-template-columns:64px 1fr;grid-template-rows:58px minmax(0,1fr) 100px}.cawb2>header{padding:6px 9px}.cawb2>header button{min-height:38px;padding:0 8px;font-size:10px}.tools{padding:5px}.tools button{min-height:42px}.timeline{padding:6px;gap:6px}.frame-actions button{font-size:0;width:34px;padding:0}.frame-actions svg{width:16px}.frames button{min-width:82px}}
@media(orientation:portrait){.cawb2:after{content:'Rotate your device to landscape to use the PlayFooty Whiteboard';position:fixed;z-index:5000;inset:0;display:grid;place-items:center;padding:30px;background:#061019;color:#fff;text-align:center;font-size:24px;font-weight:950}}
.players-panel{width:min(760px,94vw);max-height:88vh;overflow:auto;background:#081923;border:1px solid #244554;border-radius:22px;padding:18px}.players-panel header{display:flex!important;justify-content:space-between;align-items:flex-start}.players-panel header h2{margin:4px 0}.players-panel header p{margin:0;color:#9fb5c2}.player-tabs,.player-actions,.generic-actions{display:flex;gap:8px;margin:14px 0;flex-wrap:wrap}.player-tabs button.active,.player-grid button.selected{background:#109ee8;border-color:#20b8ff}.player-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:9px}.player-grid button{min-height:74px;justify-content:flex-start;text-align:left}.player-grid button b{display:grid;place-items:center;min-width:28px;height:28px;border-radius:50%;background:#153748}.player-grid button span{flex:1}.player-grid button small{display:block;color:#9fb5c2;font-size:10px}.generic-actions{flex-direction:column}.generic-actions p{color:#9fb5c2;margin:4px 0}.players-panel button{border:1px solid #31505f;background:#0c2230;color:#fff;border-radius:11px;padding:10px 12px;font-weight:800;display:flex;align-items:center;gap:8px}
/* Stage 8 Priority 1 - simplified professional workspace */
.cawb2{height:100dvh;min-height:100dvh;overflow:hidden;padding:0!important;background:#041018!important;display:grid!important;grid-template-rows:64px minmax(0,1fr)!important}
.wb-topbar{height:64px!important;min-height:64px!important;padding:8px 14px!important;background:rgba(5,20,29,.97)!important;border-bottom:1px solid #173844!important;display:grid!important;grid-template-columns:auto minmax(0,1fr) auto!important;align-items:center!important;gap:14px!important;z-index:40!important}
.wb-topbar .back,.wb-topbar button{min-height:44px!important;border-radius:12px!important}.wb-title{min-width:0;display:flex;flex-direction:column;align-items:center;line-height:1.15}.wb-title span{color:#20b8ff;font-size:10px;font-weight:900;letter-spacing:.13em}.wb-title b{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}.wb-title small{color:#74b98f;font-size:10px;margin-top:2px}.wb-primary-actions{display:flex;gap:8px}.wb-primary-actions button{background:#0c2633!important;border:1px solid #31505f!important;color:#fff!important;padding:9px 13px!important;display:flex!important;align-items:center!important;gap:7px!important}.wb-primary-actions button:first-child{background:#109ee8!important;border-color:#20b8ff!important}.wb-more-button span{font-size:18px;line-height:0;letter-spacing:1px}
.cawb2>section:not(.cawb2-modal):not(.cawb2-library):not(.cawb2-analysis){min-height:0!important}.cawb2 .workspace,.cawb2 .cawb2-workspace{height:100%!important;min-height:0!important;display:grid!important;grid-template-columns:68px minmax(0,1fr)!important;grid-template-rows:minmax(0,1fr) 92px!important;gap:0!important;padding:0!important}.cawb2 .tools,.cawb2 aside{grid-column:1!important;grid-row:1/3!important;width:68px!important;min-width:68px!important;background:#071923!important;border-right:1px solid #173844!important;padding:10px 8px!important;display:flex!important;flex-direction:column!important;gap:8px!important;overflow-y:auto!important;z-index:15!important}.cawb2 .tools button,.cawb2 aside button{width:52px!important;min-width:52px!important;height:52px!important;min-height:52px!important;padding:0!important;justify-content:center!important;border-radius:14px!important}.cawb2 .tools button span,.cawb2 aside button span{display:none!important}.cawb2 .tools button.active,.cawb2 aside button.active{background:#109ee8!important;border-color:#5ac8ff!important;box-shadow:0 0 0 2px rgba(32,184,255,.18)!important}.cawb2 .board,.cawb2 .cawb2-board{grid-column:2!important;grid-row:1!important;min-height:0!important;height:100%!important;margin:0!important;padding:8px!important;border:0!important;border-radius:0!important;background:#02090e!important;display:grid!important;place-items:center!important}.cawb2 .board svg,.cawb2 .cawb2-board svg{width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:contain!important;touch-action:none!important}.cawb2 .timeline,.cawb2 .cawb2-timeline{grid-column:2!important;grid-row:2!important;height:92px!important;min-height:92px!important;margin:0!important;padding:8px 12px!important;background:#071923!important;border-top:1px solid #173844!important;display:flex!important;align-items:center!important;gap:8px!important;overflow-x:auto!important;z-index:12!important}.cawb2 .timeline button,.cawb2 .cawb2-timeline button{min-height:52px!important;border-radius:12px!important;flex:0 0 auto!important}
.wb-more-popover{position:fixed;right:14px;top:70px;width:min(520px,calc(100vw - 28px));max-height:calc(100dvh - 84px);overflow:auto;z-index:100;background:#071923;border:1px solid #31505f;border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.48);padding:14px}.wb-more-head{display:flex;justify-content:space-between;align-items:center;padding:2px 2px 12px;border-bottom:1px solid #173844}.wb-more-head div{display:flex;flex-direction:column}.wb-more-head span{color:#20b8ff;font-size:10px;font-weight:900;letter-spacing:.12em}.wb-more-head b{font-size:18px}.wb-more-head button{width:42px;height:42px;padding:0;justify-content:center}.wb-more-popover section{padding:13px 2px 4px}.wb-more-popover h3{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#8ca9b7;margin:0 0 8px}.wb-more-popover section>div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.wb-more-popover section button{min-height:46px;justify-content:flex-start;background:#0c2633;border:1px solid #294955;border-radius:12px;color:#fff;padding:10px 12px;font-weight:800;display:flex;align-items:center;gap:8px}
@media(max-width:760px){.wb-title small{display:none}.wb-primary-actions button{padding:9px 10px!important}.wb-primary-actions button svg{margin:0}.wb-primary-actions button{font-size:0}.wb-primary-actions button span{font-size:16px}.cawb2 .workspace,.cawb2 .cawb2-workspace{grid-template-columns:58px minmax(0,1fr)!important}.cawb2 .tools,.cawb2 aside{width:58px!important;min-width:58px!important;padding:8px 5px!important}.cawb2 .tools button,.cawb2 aside button{width:46px!important;min-width:46px!important;height:46px!important;min-height:46px!important}.wb-more-popover section>div{grid-template-columns:1fr}}

/* Stage 8 Priority 2 — native dialogs and notifications */
.wb-native-dialog,.wb-result-panel{width:min(560px,92vw);max-height:88dvh;overflow:auto;background:#071923;border:1px solid #31505f;border-radius:22px;padding:18px;box-shadow:0 24px 80px rgba(0,0,0,.55)}
.wb-native-dialog header,.wb-result-panel header{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:16px!important;border:0!important;padding:0 0 14px!important;background:transparent!important}.wb-native-dialog header div,.wb-result-panel header div{display:block!important}.wb-native-dialog header span,.wb-result-panel header span{color:#20b8ff;font-size:10px;font-weight:900;letter-spacing:.12em}.wb-native-dialog h2,.wb-result-panel h2{margin:4px 0 5px;font-size:22px}.wb-native-dialog p{margin:0;color:#9fb5c2;line-height:1.45}.wb-native-dialog header>button,.wb-result-panel header>button{width:44px;height:44px;padding:0;justify-content:center;flex:0 0 auto}
.wb-dialog-fields{display:grid;gap:14px;padding:8px 0}.wb-dialog-fields label{display:grid;gap:7px;font-size:12px;font-weight:900;color:#d9e8ef}.wb-dialog-fields label span{font-weight:500;color:#8ca9b7}.wb-dialog-fields input,.wb-dialog-fields textarea{width:100%;box-sizing:border-box;border:1px solid #31505f;background:#0b2532;color:#fff;border-radius:12px;padding:12px 13px;font:inherit;outline:none}.wb-dialog-fields input:focus,.wb-dialog-fields textarea:focus{border-color:#20b8ff;box-shadow:0 0 0 3px rgba(32,184,255,.14)}.wb-dialog-fields textarea{min-height:110px;resize:vertical}
.wb-choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.wb-choice-grid button{min-height:50px;border:1px solid #31505f;background:#0b2532;color:#fff;border-radius:12px;font-weight:900}.wb-choice-grid button.active{background:#109ee8;border-color:#53c8ff;box-shadow:0 0 0 3px rgba(32,184,255,.14)}
.wb-dialog-actions{display:flex;justify-content:flex-end;gap:9px;padding-top:15px;border-top:1px solid #173844}.wb-dialog-actions button{min-height:46px;border-radius:12px;padding:10px 16px;font-weight:900;border:1px solid #31505f;background:#0b2532;color:#fff}.wb-dialog-actions .primary{background:#109ee8;border-color:#20b8ff}.wb-dialog-actions .danger{background:#b32634;border-color:#e0535f}
.wb-result-panel pre{white-space:pre-wrap;font:600 14px/1.55 inherit;color:#d9e8ef;background:#0a202b;border:1px solid #244554;border-radius:14px;padding:14px;margin:0 0 15px}
.wb-toast{position:fixed;left:50%;bottom:112px;transform:translateX(-50%);z-index:250;max-width:min(520px,88vw);padding:12px 16px;border-radius:13px;background:#0b2532;border:1px solid #31505f;color:#fff;font-weight:850;box-shadow:0 14px 45px rgba(0,0,0,.45);animation:wbToastIn .18s ease-out}.wb-toast.success{border-color:#36b875;background:#0b3026}.wb-toast.error{border-color:#e0535f;background:#36151a}.wb-toast.info{border-color:#20b8ff}@keyframes wbToastIn{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}
@media(max-width:640px){.wb-choice-grid{grid-template-columns:1fr}.wb-dialog-actions button{flex:1}.wb-toast{bottom:104px}}

/* Stage 8 Priority 3 — player handling */
.player-drawer-backdrop{position:fixed;inset:64px 0 0 0;background:rgba(0,0,0,.28);border:0;z-index:70}
.player-drawer{position:fixed!important;left:68px!important;top:64px!important;bottom:0!important;width:min(390px,calc(100vw - 68px))!important;z-index:80!important;background:#071923!important;border-right:1px solid #31505f!important;box-shadow:20px 0 50px rgba(0,0,0,.42)!important;padding:16px!important;display:flex!important;flex-direction:column!important;overflow:hidden!important}
.player-drawer header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.player-drawer header span{color:#20b8ff;font-size:10px;font-weight:900;letter-spacing:.12em}.player-drawer h2{margin:3px 0;font-size:22px}.player-drawer p{margin:0;color:#8fa9b6;font-size:12px}.player-drawer header button{width:42px;height:42px;padding:0;justify-content:center}
.player-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:14px 0 10px}.player-tabs button{min-height:42px}.player-tabs button.active{background:#109ee8!important;border-color:#50c7ff!important}
.player-search{width:100%;min-height:46px;border-radius:12px;border:1px solid #31505f;background:#0c2633;color:#fff;padding:0 13px;font-size:15px;outline:none}.player-search:focus{border-color:#20b8ff;box-shadow:0 0 0 3px rgba(32,184,255,.15)}
.quick-setups{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:10px 0}.quick-setups button{min-height:40px;padding:6px!important;justify-content:center!important}
.player-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}.player-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;overflow-y:auto;padding-right:3px;flex:1}.player-grid button{min-height:72px;display:grid!important;grid-template-columns:34px 1fr;grid-template-rows:auto auto;text-align:left;align-items:center}.player-grid button b{grid-row:1/3;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#153748}.player-grid button span{font-size:12px}.player-grid button small{font-size:10px;color:#8fa9b6}.player-grid button.selected{border-color:#20b8ff}.player-grid button.queued{background:#12384a!important;box-shadow:inset 0 0 0 2px #f6c945}.player-drawer footer{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding-top:12px}.player-drawer footer button{min-height:46px}.player-drawer footer .primary{background:#109ee8!important;border-color:#20b8ff!important}.player-drawer footer button:disabled{opacity:.4}.generic-actions{display:flex;flex-direction:column;gap:10px}
.magnet-inspector{position:fixed!important;right:14px!important;top:78px!important;width:280px!important;z-index:65!important;background:#071923!important;border:1px solid #31505f!important;border-radius:18px!important;padding:14px!important;box-shadow:0 22px 60px rgba(0,0,0,.45)!important;display:flex!important;flex-direction:column!important;gap:10px!important}.magnet-inspector header{display:flex;justify-content:space-between;align-items:center}.magnet-inspector header span{display:block;color:#20b8ff;font-size:9px;font-weight:900;letter-spacing:.11em}.magnet-inspector header b{font-size:16px}.magnet-inspector header button{width:38px;height:38px;padding:0;justify-content:center}.magnet-inspector label{display:flex;flex-direction:column;gap:5px;color:#9fb3be;font-size:11px;font-weight:800}.magnet-inspector input{min-height:42px;border-radius:10px;border:1px solid #31505f;background:#0c2633;color:#fff;padding:0 10px}.inspector-team{display:grid;grid-template-columns:1fr 1fr;gap:7px}.inspector-team button.active{background:#109ee8!important;border-color:#20b8ff!important}.magnet-inspector .danger{background:#451b23!important;border-color:#7c2d38!important;color:#ffdce1!important}.selected-magnet circle:first-of-type{stroke:#f6c945!important;stroke-width:1.8!important;filter:drop-shadow(0 0 3px rgba(246,201,69,.8))}
@media(max-width:760px){.player-drawer{left:58px!important;width:calc(100vw - 58px)!important}.player-grid{grid-template-columns:1fr}.magnet-inspector{right:8px!important;top:auto!important;bottom:100px!important;width:min(300px,calc(100vw - 74px))!important}.quick-setups{grid-template-columns:repeat(2,1fr)}}

/* Stage 8 Priority 4 — premium drawing */
.board-wrap svg{touch-action:none!important;user-select:none!important;-webkit-user-select:none!important}
.drawing-controls{position:fixed;left:80px;top:76px;z-index:35;display:flex;align-items:center;gap:10px;background:rgba(7,25,35,.94);border:1px solid #31505f;border-radius:14px;padding:8px 10px;box-shadow:0 12px 30px rgba(0,0,0,.28)}
.drawing-controls label{display:grid;grid-template-columns:auto 100px 42px;align-items:center;gap:8px;color:#a8bbc5;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.05em}.drawing-controls input{accent-color:#20b8ff}.drawing-controls b{color:#fff;font-size:11px;text-align:right}.zoom-controls{display:flex;gap:5px}.zoom-controls button{min-width:38px;height:38px;padding:0;justify-content:center;background:#0c2633;border:1px solid #31505f;border-radius:10px;color:#fff;font-weight:900}.zoom-controls button:last-child{padding:0 10px}
.stroke-inspector{position:fixed!important;right:14px!important;top:78px!important;width:280px!important;z-index:66!important;background:#071923!important;border:1px solid #31505f!important;border-radius:18px!important;padding:14px!important;box-shadow:0 22px 60px rgba(0,0,0,.45)!important;display:flex!important;flex-direction:column!important;gap:11px!important}.stroke-inspector header{display:flex;justify-content:space-between;align-items:center}.stroke-inspector header span{display:block;color:#20b8ff;font-size:9px;font-weight:900;letter-spacing:.11em}.stroke-inspector header b{font-size:16px}.stroke-inspector header button{width:38px;height:38px;padding:0;justify-content:center}.stroke-inspector label{display:flex;flex-direction:column;gap:6px;color:#9fb3be;font-size:11px;font-weight:800}.stroke-inspector input{accent-color:#20b8ff}.stroke-nudge{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.stroke-nudge button{height:40px;justify-content:center}.stroke-inspector .danger{background:#451b23!important;border-color:#7c2d38!important;color:#ffdce1!important}
.selected-stroke{cursor:move}.selected-stroke>*{pointer-events:stroke}
@media(max-width:760px){.drawing-controls{left:66px;right:8px;top:70px;overflow-x:auto}.drawing-controls label{grid-template-columns:auto 70px 36px}.stroke-inspector{right:8px!important;top:auto!important;bottom:100px!important;width:min(300px,calc(100vw - 74px))!important}}

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

/* Whiteboard direct-layout visibility repair */
.cawb2:not(.presenting){
  display:grid!important;
  grid-template-columns:68px minmax(0,1fr)!important;
  grid-template-rows:64px minmax(0,1fr) 92px!important;
  height:100dvh!important;
  min-height:100dvh!important;
  overflow:hidden!important;
}
.cawb2:not(.presenting)>.wb-topbar{
  grid-column:1 / -1!important;
  grid-row:1!important;
}
.cawb2:not(.presenting)>.tools{
  position:relative!important;
  inset:auto!important;
  grid-column:1!important;
  grid-row:2 / 4!important;
  width:68px!important;
  min-width:68px!important;
  height:auto!important;
  min-height:0!important;
  overflow-y:auto!important;
}
.cawb2:not(.presenting)>.board-wrap{
  grid-column:2!important;
  grid-row:2!important;
  width:100%!important;
  height:100%!important;
  min-width:0!important;
  min-height:0!important;
  padding:8px!important;
  overflow:hidden!important;
}
.cawb2:not(.presenting)>.board-wrap>svg{
  display:block!important;
  width:100%!important;
  height:100%!important;
  min-width:0!important;
  min-height:0!important;
  visibility:visible!important;
  opacity:1!important;
}
.cawb2:not(.presenting)>.timeline{
  grid-column:2!important;
  grid-row:3!important;
  width:100%!important;
  height:92px!important;
  min-height:92px!important;
  margin:0!important;
  overflow:hidden!important;
}
.cawb2.presenting>.board-wrap{
  width:100%!important;
  height:100%!important;
  min-width:0!important;
  min-height:0!important;
}
@media(max-width:900px) and (orientation:landscape){
  .cawb2:not(.presenting){
    grid-template-columns:64px minmax(0,1fr)!important;
    grid-template-rows:58px minmax(0,1fr) 100px!important;
  }
  .cawb2:not(.presenting)>.tools{width:64px!important;min-width:64px!important}
  .cawb2:not(.presenting)>.timeline{height:100px!important;min-height:100px!important}
}


/* Grouped Whiteboard drawing tools */
.draw-bottom-tray{position:fixed!important;z-index:88!important;left:74px!important;right:0!important;bottom:0!important;min-height:112px!important;padding:10px 12px!important;background:rgba(5,22,31,.98)!important;border-top:1px solid #2d5668!important;box-shadow:0 -18px 50px rgba(0,0,0,.42)!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto 42px!important;align-items:center!important;gap:14px!important;animation:wb-player-tray-in .18s ease both!important}.draw-tool-list{display:flex!important;align-items:center!important;gap:7px!important;overflow-x:auto!important;padding-bottom:2px!important}.draw-tool-list button{min-width:68px!important;height:68px!important;padding:7px 8px!important;border:1px solid #31505f!important;border-radius:12px!important;background:#0c2633!important;color:#d7e5ec!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:5px!important;font-size:9px!important;font-weight:900!important}.draw-tool-list button svg{width:22px!important;height:22px!important}.draw-tool-list button.active{background:#109ee8!important;border-color:#65d0ff!important;color:#fff!important;box-shadow:0 0 0 2px rgba(32,184,255,.2)!important}.draw-tool-list button.danger.active{background:#7a2632!important;border-color:#e45c6b!important}.draw-settings{display:grid!important;grid-template-columns:auto minmax(150px,220px) minmax(150px,220px)!important;align-items:center!important;gap:10px!important}.draw-settings label{display:grid!important;grid-template-columns:auto minmax(70px,1fr) 34px!important;align-items:center!important;gap:7px!important;color:#a8bbc5!important;font-size:9px!important;font-weight:900!important;text-transform:uppercase!important}.draw-settings input{accent-color:#20b8ff!important}.draw-settings b{color:#fff!important;text-align:right!important}.draw-close{width:42px!important;height:42px!important;padding:0!important;justify-content:center!important;border-radius:11px!important}.cawb2:has(.draw-bottom-tray) .legend{bottom:120px!important}@media(max-width:980px){.draw-bottom-tray{left:64px!important;grid-template-columns:minmax(0,1fr) 42px!important}.draw-settings{grid-column:1/-1!important;grid-template-columns:auto 1fr 1fr!important}.draw-close{grid-column:2!important;grid-row:1!important}.draw-tool-list{grid-column:1!important;grid-row:1!important}}@media(max-width:700px){.draw-bottom-tray{left:0!important;bottom:58px!important;min-height:170px!important;padding:8px!important}.draw-tool-list button{min-width:62px!important;height:62px!important}.draw-settings{grid-template-columns:auto 1fr!important}.draw-settings label:last-child{grid-column:2!important}.cawb2:has(.draw-bottom-tray) .legend{bottom:238px!important}}


/* Compact iPad drawing tray */
@media (min-width:701px){
  .draw-bottom-tray{
    min-height:88px!important;
    height:88px!important;
    padding:7px 9px!important;
    grid-template-columns:minmax(0,1fr) 270px 36px!important;
    gap:8px!important;
  }
  .draw-tool-list{
    gap:5px!important;
    overflow:visible!important;
    min-width:0!important;
    justify-content:space-between!important;
  }
  .draw-tool-list button{
    min-width:0!important;
    width:clamp(48px,6.2vw,62px)!important;
    height:58px!important;
    padding:4px!important;
    border-radius:10px!important;
    gap:2px!important;
    flex:0 1 62px!important;
  }
  .draw-tool-list button svg{width:18px!important;height:18px!important}
  .draw-tool-list button span{font-size:8px!important;line-height:1!important}
  .draw-settings{
    grid-template-columns:94px 1fr!important;
    grid-template-rows:34px 34px!important;
    gap:4px 7px!important;
    min-width:0!important;
  }
  .draw-settings .zoom-controls{
    grid-row:1/3!important;
    display:grid!important;
    grid-template-columns:repeat(3,29px)!important;
    gap:3px!important;
  }
  .draw-settings .zoom-controls button{
    min-width:29px!important;
    width:29px!important;
    height:31px!important;
    min-height:31px!important;
    padding:0!important;
    border-radius:8px!important;
    font-size:11px!important;
  }
  .draw-settings label{
    grid-template-columns:48px minmax(54px,1fr) 25px!important;
    gap:4px!important;
    font-size:7px!important;
    white-space:nowrap!important;
  }
  .draw-settings label input{width:100%!important;min-width:0!important}
  .draw-settings label b{font-size:8px!important}
  .draw-close{
    width:36px!important;
    height:36px!important;
    min-width:36px!important;
    min-height:36px!important;
  }
  .cawb2:has(.draw-bottom-tray) .legend{bottom:94px!important}
}
@media (min-width:701px) and (max-width:980px){
  .draw-bottom-tray{
    left:64px!important;
    grid-template-columns:minmax(0,1fr) 240px 34px!important;
  }
  .draw-settings{
    grid-column:auto!important;
    grid-row:auto!important;
    grid-template-columns:88px 1fr!important;
  }
  .draw-close{grid-column:auto!important;grid-row:auto!important}
  .draw-tool-list{grid-column:auto!important;grid-row:auto!important}
  .draw-tool-list button{width:clamp(43px,5.9vw,56px)!important;flex-basis:56px!important}
}

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
`
