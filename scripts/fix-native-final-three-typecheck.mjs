import fs from 'node:fs'

const replaceOnce=(text,from,to,label)=>{
  if(text.includes(to)) return text
  if(!text.includes(from)) throw new Error(`Could not find ${label}`)
  return text.replace(from,to)
}

// AppShell: make the Operations Scorekeeper route/state consistent with the patched Operations screen.
{
  const file='apps/ipad/src/screens/AppShell.tsx'
  let text=fs.readFileSync(file,'utf8')

  if(!text.includes("import { ScorekeeperScreen } from './ScorekeeperScreen'")){
    text=replaceOnce(text,
      "import { OperationsScreen } from './OperationsScreen'",
      "import { OperationsScreen } from './OperationsScreen'\nimport { ScorekeeperScreen } from './ScorekeeperScreen'",
      'Scorekeeper import')
  }

  text=replaceOnce(text,
    "const[timekeeperOpen,setTimekeeperOpen]=useState(false),[liveStatsOpen,setLiveStatsOpen]=useState(false)",
    "const[timekeeperOpen,setTimekeeperOpen]=useState(false),[liveStatsOpen,setLiveStatsOpen]=useState(false),[scorekeeperOpen,setScorekeeperOpen]=useState(false)",
    'Scorekeeper state')

  text=replaceOnce(text,
    "setTimekeeperOpen(false);setLiveStatsOpen(false);setStudioTool(null);setArea(next)",
    "setTimekeeperOpen(false);setLiveStatsOpen(false);setScorekeeperOpen(false);setStudioTool(null);setArea(next)",
    'Scorekeeper reset')

  if(!text.includes("area==='operations'&&scorekeeperOpen")){
    text=replaceOnce(text,
      "else if(area==='operations'&&liveStatsOpen)content=<LiveStatsScreen club={club} session={session} onBack={()=>setLiveStatsOpen(false)}/>\n else if(area==='operations')content=<OperationsScreen club={club} session={session} onOpenTimekeeper={()=>setTimekeeperOpen(true)} onOpenStats={()=>setLiveStatsOpen(true)}/>",
      "else if(area==='operations'&&liveStatsOpen)content=<LiveStatsScreen club={club} session={session} onBack={()=>setLiveStatsOpen(false)}/>\n else if(area==='operations'&&scorekeeperOpen)content=<ScorekeeperScreen club={club} session={session} onBack={()=>setScorekeeperOpen(false)}/>\n else if(area==='operations')content=<OperationsScreen club={club} session={session} onOpenTimekeeper={()=>setTimekeeperOpen(true)} onOpenStats={()=>setLiveStatsOpen(true)} onOpenScorekeeper={()=>setScorekeeperOpen(true)}/>",
      'Scorekeeper route')
  }

  text=replaceOnce(text,
    "const hideSidebar=matchDayOpen||whiteboardOpen||teamSelectionOpen||timekeeperOpen||liveStatsOpen",
    "const hideSidebar=matchDayOpen||whiteboardOpen||teamSelectionOpen||timekeeperOpen||liveStatsOpen||scorekeeperOpen",
    'Scorekeeper sidebar')

  fs.writeFileSync(file,text)
}

// Operations: accept/open Scorekeeper and normalise unsupported font weight if the prior patch only partially applied.
{
  const file='apps/ipad/src/screens/OperationsScreen.tsx'
  let text=fs.readFileSync(file,'utf8')

  if(!text.includes('onOpenScorekeeper:()=>void')){
    text=text.replace(
      "type Props={club:ClubAccount;session:AuthSession;onOpenTimekeeper:()=>void;onOpenStats:()=>void}",
      "type Props={club:ClubAccount;session:AuthSession;onOpenTimekeeper:()=>void;onOpenStats:()=>void;onOpenScorekeeper:()=>void}")
  }
  if(!text.includes('onOpenScorekeeper}:Props')){
    text=text.replace(
      "export function OperationsScreen({club,session,onOpenTimekeeper,onOpenStats}:Props){",
      "export function OperationsScreen({club,session,onOpenTimekeeper,onOpenStats,onOpenScorekeeper}:Props){")
  }
  text=text.replaceAll("fontWeight:'850'","fontWeight:'800'")
  fs.writeFileSync(file,text)
}

// Match Day: slot coordinates are valid at runtime but inferred as broad strings by TS.
// Guard missing keys and explicitly cast the coordinate style object to React Native style input.
{
  const file='apps/ipad/src/screens/MatchDayScreen.tsx'
  let text=fs.readFileSync(file,'utf8')

  text=text.replace(
    "{FIELD_CODES.map(code=>{const place=slots[code],slot=state.slots.find(item=>item.positionCode===code);return <View key={code} pointerEvents=\"box-none\" style={[styles.fieldSlot,{left:place.left,top:place.top,width:place.width},!portrait&&styles.fieldSlotLandscape]}",
    "{FIELD_CODES.map(code=>{const place=slots[code];if(!place)return null;const slot=state.slots.find(item=>item.positionCode===code);return <View key={code} pointerEvents=\"box-none\" style={[styles.fieldSlot,({left:place.left,top:place.top,width:place.width} as any),!portrait&&styles.fieldSlotLandscape]}")

  fs.writeFileSync(file,text)
}

// Team Selection: same coordinate typing issue as Match Day.
{
  const file='apps/ipad/src/screens/TeamSelectionScreen.tsx'
  let text=fs.readFileSync(file,'utf8')

  text=text.replace(
    "{FIELD_CODES.map(code=>{const slot=(isLandscape?LANDSCAPE_SLOTS:PORTRAIT_SLOTS)[code];const selectedRow=selected.find(value=>value.positionCode===code),player=selectedRow?playerById.get(selectedRow.clubPlayerId):undefined;return <View pointerEvents=\"box-none\" key={code} style={[isLandscape?styles.absoluteSlot:styles.portraitAbsoluteSlot,{left:slot.left,top:slot.top,width:slot.width}]}",
    "{FIELD_CODES.map(code=>{const slot=(isLandscape?LANDSCAPE_SLOTS:PORTRAIT_SLOTS)[code];if(!slot)return null;const selectedRow=selected.find(value=>value.positionCode===code),player=selectedRow?playerById.get(selectedRow.clubPlayerId):undefined;return <View pointerEvents=\"box-none\" key={code} style={[isLandscape?styles.absoluteSlot:styles.portraitAbsoluteSlot,({left:slot.left,top:slot.top,width:slot.width} as any)]}")

  fs.writeFileSync(file,text)
}

console.log('Final native typecheck repairs applied.')
