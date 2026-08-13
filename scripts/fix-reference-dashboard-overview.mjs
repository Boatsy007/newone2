import fs from 'node:fs'
import path from 'node:path'

const file=path.join(process.cwd(),'apps/ipad/src/screens/OverviewScreen.tsx')
if(!fs.existsSync(file))throw new Error('Run from playfooty-ipad repo root')
let s=fs.readFileSync(file,'utf8')
const broken="flowLabels:{flexDirection:'row',justifyContent:'space-between'},flowLabels:{},smallMeta:"
const fixed="flowLabels:{flexDirection:'row',justifyContent:'space-between',paddingHorizontal:2},smallMeta:"
if(s.includes(broken))s=s.replace(broken,fixed)
fs.writeFileSync(file,s)
console.log('Overview dashboard repair applied.')
