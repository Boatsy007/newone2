import fs from 'node:fs'
const file='apps/ipad/src/screens/MembershipsScreen.tsx'
let src=fs.readFileSync(file,'utf8')
const importLine="import { PremiumMembershipDashboard } from '../components/PremiumMembershipDashboard'\n"
if(!src.includes(importLine))src=src.replace("import { MembershipAdvancedScreen, type MembershipAdvancedMode } from './MembershipAdvancedScreen'\n",`import { MembershipAdvancedScreen, type MembershipAdvancedMode } from './MembershipAdvancedScreen'\n${importLine}`)
const start=src.indexOf('function Dashboard(')
if(start<0)throw new Error('Membership Dashboard function not found')
const brace=src.indexOf('{',start)
let depth=0,end=-1
for(let i=brace;i<src.length;i++){if(src[i]==='{')depth++;else if(src[i]==='}'){depth--;if(depth===0){end=i+1;break}}}
if(end<0)throw new Error('Membership Dashboard function end not found')
const replacement=`function Dashboard({overview,members,products,onOpen}:{overview:Overview|null;members:Member[];products:Product[];onOpen:(view:ViewMode)=>void}){return <PremiumMembershipDashboard overview={overview} members={members} products={products} onOpen={value=>onOpen(value as ViewMode)}/>}\n`
src=src.slice(0,start)+replacement+src.slice(end)
fs.writeFileSync(file,src,'utf8')
console.log('Premium Membership dashboard installed. Member/product/card editors and APIs were preserved.')
