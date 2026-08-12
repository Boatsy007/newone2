import fs from 'node:fs'

function update(path, fn) {
  const before = fs.readFileSync(path, 'utf8')
  const after = fn(before)
  if (after === before) console.log(`No change needed: ${path}`)
  else {
    fs.writeFileSync(path, after)
    console.log(`Fixed: ${path}`)
  }
}

update('apps/ipad/src/screens/AppShell.tsx', text => {
  if (!text.includes("import { ScorekeeperScreen } from './ScorekeeperScreen'")) {
    text = text.replace(
      "import { OperationsScreen } from './OperationsScreen'",
      "import { OperationsScreen } from './OperationsScreen'\nimport { ScorekeeperScreen } from './ScorekeeperScreen'"
    )
  }
  if (!text.includes('[scorekeeperOpen,setScorekeeperOpen]')) {
    text = text.replace(
      '[liveStatsOpen,setLiveStatsOpen]=useState(false)',
      '[liveStatsOpen,setLiveStatsOpen]=useState(false),[scorekeeperOpen,setScorekeeperOpen]=useState(false)'
    )
  }
  if (!text.includes('setScorekeeperOpen(false);setStudioTool')) {
    text = text.replace(
      'setLiveStatsOpen(false);setStudioTool(null);setArea(next)',
      'setLiveStatsOpen(false);setScorekeeperOpen(false);setStudioTool(null);setArea(next)'
    )
  }
  if (!text.includes("area==='operations'&&scorekeeperOpen")) {
    text = text.replace(
      "else if(area==='operations'&&liveStatsOpen)content=<LiveStatsScreen club={club} session={session} onBack={()=>setLiveStatsOpen(false)}/>",
      "else if(area==='operations'&&liveStatsOpen)content=<LiveStatsScreen club={club} session={session} onBack={()=>setLiveStatsOpen(false)}/>\n else if(area==='operations'&&scorekeeperOpen)content=<ScorekeeperScreen club={club} session={session} onBack={()=>setScorekeeperOpen(false)}/>"
    )
  }
  text = text.replace(
    /<OperationsScreen club=\{club\} session=\{session\} onOpenTimekeeper=\{\(\)=>setTimekeeperOpen\(true\)\} onOpenStats=\{\(\)=>setLiveStatsOpen\(true\)\}(?: onOpenScorekeeper=\{\(\)=>setScorekeeperOpen\(true\)\})?\/>/g,
    '<OperationsScreen club={club} session={session} onOpenTimekeeper={()=>setTimekeeperOpen(true)} onOpenStats={()=>setLiveStatsOpen(true)} onOpenScorekeeper={()=>setScorekeeperOpen(true)}/>'
  )
  text = text.replace(
    'const hideSidebar=matchDayOpen||whiteboardOpen||teamSelectionOpen||timekeeperOpen||liveStatsOpen',
    'const hideSidebar=matchDayOpen||whiteboardOpen||teamSelectionOpen||timekeeperOpen||liveStatsOpen||scorekeeperOpen'
  )
  return text
})

update('apps/ipad/src/screens/MatchDayScreen.tsx', text => {
  text = text.replaceAll(
    '{left:place.left,top:place.top,width:place.width}',
    '({left:place.left,top:place.top,width:place.width} as any)'
  )
  return text
})

update('apps/ipad/src/screens/TeamSelectionScreen.tsx', text => {
  text = text.replaceAll(
    '{left:slot.left,top:slot.top,width:slot.width}',
    '({left:slot.left,top:slot.top,width:slot.width} as any)'
  )
  return text
})

console.log('Exact three TypeScript fixes applied.')
