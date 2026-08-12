import fs from 'node:fs'

const read = path => fs.readFileSync(path, 'utf8')
const write = (path, text) => fs.writeFileSync(path, text)

// 1) AppShell: fully wire Scorekeeper when OperationsScreen expects onOpenScorekeeper.
{
  const path = 'apps/ipad/src/screens/AppShell.tsx'
  let text = read(path)

  if (!text.includes("import { ScorekeeperScreen } from './ScorekeeperScreen'")) {
    text = text.replace(
      "import { OperationsScreen } from './OperationsScreen'",
      "import { OperationsScreen } from './OperationsScreen'\nimport { ScorekeeperScreen } from './ScorekeeperScreen'"
    )
  }

  if (!text.includes('[scorekeeperOpen,setScorekeeperOpen]')) {
    text = text.replace(
      "const[timekeeperOpen,setTimekeeperOpen]=useState(false),[liveStatsOpen,setLiveStatsOpen]=useState(false)",
      "const[timekeeperOpen,setTimekeeperOpen]=useState(false),[liveStatsOpen,setLiveStatsOpen]=useState(false),[scorekeeperOpen,setScorekeeperOpen]=useState(false)"
    )
  }

  if (!text.includes('setScorekeeperOpen(false);setStudioTool(null);setArea(next)')) {
    text = text.replace(
      'setTimekeeperOpen(false);setLiveStatsOpen(false);setStudioTool(null);setArea(next)',
      'setTimekeeperOpen(false);setLiveStatsOpen(false);setScorekeeperOpen(false);setStudioTool(null);setArea(next)'
    )
  }

  if (!text.includes("area==='operations'&&scorekeeperOpen")) {
    text = text.replace(
      "else if(area==='operations'&&liveStatsOpen)content=<LiveStatsScreen club={club} session={session} onBack={()=>setLiveStatsOpen(false)}/>\n else if(area==='operations')content=<OperationsScreen club={club} session={session} onOpenTimekeeper={()=>setTimekeeperOpen(true)} onOpenStats={()=>setLiveStatsOpen(true)}/>",
      "else if(area==='operations'&&liveStatsOpen)content=<LiveStatsScreen club={club} session={session} onBack={()=>setLiveStatsOpen(false)}/>\n else if(area==='operations'&&scorekeeperOpen)content=<ScorekeeperScreen club={club} session={session} onBack={()=>setScorekeeperOpen(false)}/>\n else if(area==='operations')content=<OperationsScreen club={club} session={session} onOpenTimekeeper={()=>setTimekeeperOpen(true)} onOpenStats={()=>setLiveStatsOpen(true)} onOpenScorekeeper={()=>setScorekeeperOpen(true)}/>"
    )
  } else {
    text = text.replace(
      "<OperationsScreen club={club} session={session} onOpenTimekeeper={()=>setTimekeeperOpen(true)} onOpenStats={()=>setLiveStatsOpen(true)}/>",
      "<OperationsScreen club={club} session={session} onOpenTimekeeper={()=>setTimekeeperOpen(true)} onOpenStats={()=>setLiveStatsOpen(true)} onOpenScorekeeper={()=>setScorekeeperOpen(true)}/>"
    )
  }

  text = text.replace(
    'const hideSidebar=matchDayOpen||whiteboardOpen||teamSelectionOpen||timekeeperOpen||liveStatsOpen',
    'const hideSidebar=matchDayOpen||whiteboardOpen||teamSelectionOpen||timekeeperOpen||liveStatsOpen||scorekeeperOpen'
  )

  write(path, text)
}

// 2) Match Day: TypeScript needs an explicit guard for indexed slot coordinates.
{
  const path = 'apps/ipad/src/screens/MatchDayScreen.tsx'
  let text = read(path)
  text = text.replace(
    "const place=slots[code],slot=state.slots.find(item=>item.positionCode===code);return <View",
    "const place=slots[code],slot=state.slots.find(item=>item.positionCode===code);if(!place)return null;return <View"
  )
  write(path, text)
}

// 3) Operations: React Native fontWeight accepts numeric weights such as 800/900, not 850.
{
  const path = 'apps/ipad/src/screens/OperationsScreen.tsx'
  let text = read(path)
  text = text.replaceAll("fontWeight:'850'", "fontWeight:'800'")
  write(path, text)
}

// 4) Team Selection: explicitly guard indexed slot and remove invalid web-only maxWidth value.
{
  const path = 'apps/ipad/src/screens/TeamSelectionScreen.tsx'
  let text = read(path)

  text = text.replace(
    "const slot=(isLandscape?LANDSCAPE_SLOTS:PORTRAIT_SLOTS)[code];const selectedRow=selected.find(value=>value.positionCode===code),player=selectedRow?playerById.get(selectedRow.clubPlayerId):undefined;return <View",
    "const slot=(isLandscape?LANDSCAPE_SLOTS:PORTRAIT_SLOTS)[code];const selectedRow=selected.find(value=>value.positionCode===code),player=selectedRow?playerById.get(selectedRow.clubPlayerId):undefined;if(!slot)return null;return <View"
  )

  // If a previous repair inserted a fallback View, simplify it to a null guard so style inference stays valid.
  text = text.replace(
    /if\(!slot\)return <View[^;]*?;return <View/g,
    'if(!slot)return null;return <View'
  )

  text = text.replace("maxWidth:'none',", '')
  write(path, text)
}

console.log('Applied one-pass fixes for AppShell, MatchDay, Operations and TeamSelection typecheck errors.')
