import fs from 'node:fs'
import path from 'node:path'

const file=path.resolve('apps/ipad/src/screens/AppShell.tsx')
let source=fs.readFileSync(file,'utf8')

if(!source.includes("import { WebsiteScreen } from './WebsiteScreen'")){
 const anchor="import { WhiteboardScreen } from './WhiteboardScreen'"
 if(!source.includes(anchor))throw new Error('Could not locate AppShell import anchor')
 source=source.replace(anchor,`${anchor}\nimport { WebsiteScreen } from './WebsiteScreen'`)
}

if(!source.includes("else if(area==='website')content=<WebsiteScreen")){
 const anchor="else if(area==='memberships')content=<MembershipsScreen club={club} session={session}/>"
 if(!source.includes(anchor))throw new Error('Could not locate Memberships route anchor in AppShell')
 source=source.replace(anchor,`${anchor}\n else if(area==='website')content=<WebsiteScreen club={club} session={session}/>`)
}

fs.writeFileSync(file,source,'utf8')
console.log('WebsiteScreen wired into current local AppShell without replacing other app work.')
