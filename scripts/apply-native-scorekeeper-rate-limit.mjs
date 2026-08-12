import fs from 'node:fs'

const mustReplace=(text,from,to,label)=>{
  if(text.includes(to)) return text
  if(!text.includes(from)) throw new Error(`Could not find ${label} anchor`)
  return text.replace(from,to)
}

// Slow the remote readers enough to stay below the API limiter.
for (const [file,from,to] of [
  ['apps/ipad/src/screens/TimekeeperScreen.tsx','setInterval(()=>void refresh(),650)','setInterval(()=>void refresh(),6000)'],
  ['apps/ipad/src/screens/LiveStatsScreen.tsx','setInterval(()=>void refresh(),900)','setInterval(()=>void refresh(),6000)'],
]) {
  let text=fs.readFileSync(file,'utf8')
  if(text.includes(from)) text=text.replace(from,to)
  fs.writeFileSync(file,text)
}

// Wire Scorekeeper into Operations without replacing the existing Operations implementation.
{
  const file='apps/ipad/src/screens/OperationsScreen.tsx'
  let text=fs.readFileSync(file,'utf8')
  text=mustReplace(text,
    "import { Bell, CheckCircle2, ChevronRight, ClipboardCheck, Clock3, ListTodo, Plus, RefreshCw, Target } from 'lucide-react-native'",
    "import { Bell, CheckCircle2, ChevronRight, ClipboardCheck, Clock3, ListTodo, Plus, RefreshCw, Target, Trophy } from 'lucide-react-native'",
    'Operations icon import')
  text=mustReplace(text,
    "type Props={club:ClubAccount;session:AuthSession;onOpenTimekeeper:()=>void;onOpenStats:()=>void}",
    "type Props={club:ClubAccount;session:AuthSession;onOpenTimekeeper:()=>void;onOpenStats:()=>void;onOpenScorekeeper:()=>void}",
    'Operations props')
  text=mustReplace(text,
    "export function OperationsScreen({club,session,onOpenTimekeeper,onOpenStats}:Props){",
    "export function OperationsScreen({club,session,onOpenTimekeeper,onOpenStats,onOpenScorekeeper}:Props){",
    'Operations signature')

  if(!text.includes('onPress={onOpenScorekeeper}')){
    const statsIndex=text.indexOf('onPress={onOpenStats}')
    if(statsIndex<0) throw new Error('Could not find Live Stats card')
    const close=text.indexOf('</Pressable>',statsIndex)
    if(close<0) throw new Error('Could not find Live Stats card end')
    const insertAt=close+'</Pressable>'.length
    const card='<Pressable disabled={!currentSheet} onPress={onOpenScorekeeper} style={[styles.operatorCard,!currentSheet&&styles.disabled]}><View style={[styles.operatorIcon,{backgroundColor:\'#FFF4E8\'}]}><Trophy size={24} color={palette.orange}/></View><View style={styles.operatorCopy}><Text style={styles.operatorLabel}>SCOREKEEPER</Text><Text style={styles.operatorTitle}>Score & Goalkickers</Text><Text style={styles.operatorHint}>Record team scores, goals and behinds without changing the side.</Text></View><ChevronRight size={20} color={palette.muted}/></Pressable>'
    text=text.slice(0,insertAt)+card+text.slice(insertAt)
  }
  fs.writeFileSync(file,text)
}

// Wire Scorekeeper into the native shell.
{
  const file='apps/ipad/src/screens/AppShell.tsx'
  let text=fs.readFileSync(file,'utf8')
  text=mustReplace(text,
    "import { OperationsScreen } from './OperationsScreen'",
    "import { OperationsScreen } from './OperationsScreen'\nimport { ScorekeeperScreen } from './ScorekeeperScreen'",
    'Scorekeeper import')
  text=mustReplace(text,
    "const[timekeeperOpen,setTimekeeperOpen]=useState(false),[liveStatsOpen,setLiveStatsOpen]=useState(false)",
    "const[timekeeperOpen,setTimekeeperOpen]=useState(false),[liveStatsOpen,setLiveStatsOpen]=useState(false),[scorekeeperOpen,setScorekeeperOpen]=useState(false)",
    'Scorekeeper state')
  text=mustReplace(text,
    "setTimekeeperOpen(false);setLiveStatsOpen(false);setStudioTool(null);setArea(next)",
    "setTimekeeperOpen(false);setLiveStatsOpen(false);setScorekeeperOpen(false);setStudioTool(null);setArea(next)",
    'Scorekeeper reset')
  text=mustReplace(text,
    "else if(area==='operations'&&liveStatsOpen)content=<LiveStatsScreen club={club} session={session} onBack={()=>setLiveStatsOpen(false)}/>\n else if(area==='operations')content=<OperationsScreen club={club} session={session} onOpenTimekeeper={()=>setTimekeeperOpen(true)} onOpenStats={()=>setLiveStatsOpen(true)}/>",
    "else if(area==='operations'&&liveStatsOpen)content=<LiveStatsScreen club={club} session={session} onBack={()=>setLiveStatsOpen(false)}/>\n else if(area==='operations'&&scorekeeperOpen)content=<ScorekeeperScreen club={club} session={session} onBack={()=>setScorekeeperOpen(false)}/>\n else if(area==='operations')content=<OperationsScreen club={club} session={session} onOpenTimekeeper={()=>setTimekeeperOpen(true)} onOpenStats={()=>setLiveStatsOpen(true)} onOpenScorekeeper={()=>setScorekeeperOpen(true)}/>",
    'Scorekeeper route')
  text=mustReplace(text,
    "const hideSidebar=matchDayOpen||whiteboardOpen||teamSelectionOpen||timekeeperOpen||liveStatsOpen",
    "const hideSidebar=matchDayOpen||whiteboardOpen||teamSelectionOpen||timekeeperOpen||liveStatsOpen||scorekeeperOpen",
    'Scorekeeper sidebar')
  fs.writeFileSync(file,text)
}

// Coach Match Day: poll at a safe rate and merge remote scores/goalkickers as well as clock/KPIs.
{
  const file='apps/ipad/src/screens/MatchDayScreen.tsx'
  let text=fs.readFileSync(file,'utf8')
  if(text.includes('setInterval(()=>void refresh(),650)')) text=text.replace('setInterval(()=>void refresh(),650)','setInterval(()=>void refresh(),3000)')

  const oldTail="kpiTargets:{...DEFAULT_TARGETS,...merged.kpiTargets,...(remote.kpiTargets??{})}}"
  const newTail="kpiTargets:{...DEFAULT_TARGETS,...merged.kpiTargets,...(remote.kpiTargets??{})},homeGoals:Number(remote.homeGoals??merged.homeGoals)||0,homeBehinds:Number(remote.homeBehinds??merged.homeBehinds)||0,awayGoals:Number(remote.awayGoals??merged.awayGoals)||0,awayBehinds:Number(remote.awayBehinds??merged.awayBehinds)||0,slots:merged.slots.map(slot=>{const remoteSlot=Array.isArray(remote.slots)?(remote.slots as any[]).find(item=>item.clubPlayerId===slot.clubPlayerId):null;return remoteSlot?{...slot,goals:Number(remoteSlot.goals??slot.goals)||0,behinds:Number(remoteSlot.behinds??slot.behinds)||0}:slot})}"
  if(!text.includes(newTail)){
    if(!text.includes(oldTail)) throw new Error('Could not find Match Day remote merge anchor')
    text=text.replace(oldTail,newTail)
  }
  fs.writeFileSync(file,text)
}

console.log('Native Operations patch applied: safe polling + Scorekeeper + coach score sync.')
