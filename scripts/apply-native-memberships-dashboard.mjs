import fs from 'node:fs'

const file='apps/ipad/src/screens/AppShell.tsx'
let text=fs.readFileSync(file,'utf8')

if(!text.includes("import { MembershipsScreen } from './MembershipsScreen'")){
  const marker="import { MatchDayScreen } from './MatchDayScreen'"
  if(!text.includes(marker)) throw new Error('Could not find MatchDayScreen import in AppShell.tsx')
  text=text.replace(marker,`${marker}\nimport { MembershipsScreen } from './MembershipsScreen'`)
}

if(!text.includes("area==='memberships')content=<MembershipsScreen")){
  const candidates=[
    "else if(area==='studio')content=<StudioScreen club={club} session={session} onOpen={setStudioTool}/>",
    "else if(area==='operations'&&timekeeperOpen)",
  ]
  if(text.includes(candidates[0])){
    text=text.replace(candidates[0],`${candidates[0]}\n else if(area==='memberships')content=<MembershipsScreen club={club} session={session}/>`)
  }else if(text.includes(candidates[1])){
    text=text.replace(candidates[1],`else if(area==='memberships')content=<MembershipsScreen club={club} session={session}/>\n ${candidates[1]}`)
  }else{
    throw new Error('Could not find a safe AppShell route insertion point')
  }
}

fs.writeFileSync(file,text)
console.log('Native Memberships dashboard wired into AppShell.')
