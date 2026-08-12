import fs from 'node:fs'

const file='apps/ipad/src/screens/TeamSelectionScreen.tsx'
let text=fs.readFileSync(file,'utf8')

const oldSlot="const slot=(isLandscape?LANDSCAPE_SLOTS:PORTRAIT_SLOTS)[code];const selectedRow="
const newSlot="const slot=(isLandscape?LANDSCAPE_SLOTS:PORTRAIT_SLOTS)[code];if(!slot)return null;const selectedRow="
if(!text.includes(newSlot)){
  if(!text.includes(oldSlot)) throw new Error('Could not find Team Selection slot anchor')
  text=text.replace(oldSlot,newSlot)
}

text=text.replace("benchCard:{flex:1,maxWidth:'none',minWidth:0,height:45}","benchCard:{flex:1,minWidth:0,height:45}")

fs.writeFileSync(file,text)
console.log('Fixed Team Selection TypeScript errors: guarded slot lookup and removed invalid maxWidth.')
