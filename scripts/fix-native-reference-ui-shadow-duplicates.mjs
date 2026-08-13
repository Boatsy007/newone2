import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd()
const files=[
  path.join(root,'apps/ipad/src/screens/CoachingScreen.tsx'),
  path.join(root,'apps/ipad/src/screens/StudioScreen.tsx'),
]

const duplicate="shadowColor:'#101828',shadowOpacity:.025,shadowRadius:6,shadowOffset:{width:0,height:2},shadowColor:'#0F172A',shadowOpacity:.025,shadowRadius:8,shadowOffset:{width:0,height:3}"
const single="shadowColor:'#101828',shadowOpacity:.025,shadowRadius:6,shadowOffset:{width:0,height:2}"

for(const file of files){
  if(!fs.existsSync(file))throw new Error(`Missing ${path.relative(root,file)}`)
  let src=fs.readFileSync(file,'utf8')
  if(!src.includes(duplicate)){
    console.log(`No duplicate shadow block found in ${path.basename(file)}; leaving unchanged.`)
    continue
  }
  src=src.split(duplicate).join(single)
  fs.writeFileSync(file,src)
  console.log(`Fixed duplicate shadow styles in ${path.basename(file)}`)
}

console.log('Reference UI shadow duplicate repair complete.')
console.log('Run: cd apps/ipad && npm run typecheck')
