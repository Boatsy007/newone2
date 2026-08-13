import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd()
const src=path.join(root,'apps/ipad/src')
const screens=path.join(src,'screens')
const sidebarPath=path.join(src,'components/Sidebar.tsx')
const themePath=path.join(src,'theme.ts')
if(!fs.existsSync(screens)||!fs.existsSync(sidebarPath)||!fs.existsSync(themePath))throw new Error('Run this from the playfooty-ipad repository root')

// Premium PlayFooty design tokens. Functionality and component trees are intentionally untouched.
fs.writeFileSync(themePath,`export const palette = {
  blue: '#176BFF',
  blueDark: '#0B4FD4',
  blueSoft: '#EDF4FF',
  canvas: '#F6F7FB',
  surface: '#FFFFFF',
  border: '#E9ECF2',
  ink: '#111827',
  muted: '#7C8496',
  green: '#18B777',
  orange: '#FFAA2B',
  purple: '#7B61FF',
  pink: '#EC4899',
  red: '#EF476F',
} as const
`)

let sidebar=fs.readFileSync(sidebarPath,'utf8')
sidebar=sidebar.replace(/const styles = StyleSheet\.create\([\s\S]*$/,
`const styles = StyleSheet.create({
  shell:{width:190,backgroundColor:'#FFFFFF',borderRightWidth:1,borderRightColor:'#EEF0F4',paddingHorizontal:12,paddingTop:18,paddingBottom:14,shadowColor:'#0F172A',shadowOpacity:.035,shadowRadius:18,shadowOffset:{width:4,height:0}},
  brand:{height:54,flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:7},
  mark:{width:34,height:34,borderRadius:9,backgroundColor:palette.blue,alignItems:'center',justifyContent:'center',transform:[{skewX:'-8deg'}],shadowColor:palette.blue,shadowOpacity:.20,shadowRadius:8,shadowOffset:{width:0,height:4}},
  markText:{color:'#fff',fontSize:21,fontWeight:'900'},brandName:{color:palette.ink,fontWeight:'900',fontSize:14,letterSpacing:.1},brandSub:{color:'#9CA3AF',fontSize:7,fontWeight:'800',letterSpacing:1.15,marginTop:1},
  nav:{gap:3,marginTop:15},item:{height:38,borderRadius:9,paddingHorizontal:11,flexDirection:'row',alignItems:'center',gap:10},itemActive:{backgroundColor:palette.blue,shadowColor:palette.blue,shadowOpacity:.18,shadowRadius:10,shadowOffset:{width:0,height:5}},itemLabel:{fontSize:11.5,color:'#626B7C',fontWeight:'600'},itemLabelActive:{color:'#fff',fontWeight:'800'},
  club:{marginTop:'auto',minHeight:58,borderWidth:1,borderColor:'#ECEFF4',borderRadius:12,padding:8,flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#FBFCFE'},clubLogo:{width:34,height:34,borderRadius:9},clubLogoFallback:{width:34,height:34,borderRadius:9,backgroundColor:palette.blueSoft,alignItems:'center',justifyContent:'center'},clubCopy:{flex:1},clubName:{fontSize:10.5,color:palette.ink,fontWeight:'800'},clubRole:{fontSize:8,color:palette.muted,textTransform:'capitalize',marginTop:2},chevron:{fontSize:15,color:'#9CA3AF'}
})`)
fs.writeFileSync(sidebarPath,sidebar)

const files=fs.readdirSync(screens).filter(name=>name.endsWith('.tsx'))
let changed=0
for(const name of files){
 const file=path.join(screens,name)
 let s=fs.readFileSync(file,'utf8')
 const before=s
 // Compact application chrome like the supplied premium tablet reference.
 s=s.replace(/height:90,paddingHorizontal:22,backgroundColor:palette\.surface,borderBottomWidth:1,borderBottomColor:palette\.border/g,"height:70,paddingHorizontal:20,backgroundColor:palette.surface,borderBottomWidth:1,borderBottomColor:'#EEF0F4'")
 s=s.replace(/height:78,\s*paddingHorizontal:24,\s*borderBottomWidth:1,\s*borderBottomColor:palette\.border/g,"height:70, paddingHorizontal:20, borderBottomWidth:1, borderBottomColor:'#EEF0F4'")
 s=s.replace(/content:\{padding:18,gap:14\}/g,"content:{padding:16,gap:12}")
 s=s.replace(/content: \{ padding: 18, gap: 14 \}/g,"content: { padding: 16, gap: 12 }")
 // Larger, smoother card system. This targets existing cards without altering layout or behaviour.
 s=s.replace(/borderRadius:14,backgroundColor:palette\.surface/g,"borderRadius:16,backgroundColor:palette.surface,shadowColor:'#0F172A',shadowOpacity:.035,shadowRadius:10,shadowOffset:{width:0,height:4}")
 s=s.replace(/borderRadius:13,backgroundColor:palette\.surface/g,"borderRadius:15,backgroundColor:palette.surface,shadowColor:'#0F172A',shadowOpacity:.03,shadowRadius:9,shadowOffset:{width:0,height:4}")
 s=s.replace(/borderRadius:12,backgroundColor:palette\.surface/g,"borderRadius:14,backgroundColor:palette.surface,shadowColor:'#0F172A',shadowOpacity:.025,shadowRadius:8,shadowOffset:{width:0,height:3}")
 s=s.replace(/borderRadius: 14,\s*overflow: "hidden",\s*flexDirection: "row",\s*backgroundColor: "#FCFDFF"/g,"borderRadius: 16, overflow: 'hidden', flexDirection: 'row', backgroundColor: '#FFFFFF', shadowColor:'#0F172A',shadowOpacity:.035,shadowRadius:10,shadowOffset:{width:0,height:4}")
 // Inputs/chips/buttons: lighter borders and softer geometry.
 s=s.replace(/borderRadius:10,alignItems:'center',justifyContent:'center'/g,"borderRadius:11,alignItems:'center',justifyContent:'center',backgroundColor:'#FFFFFF'")
 s=s.replace(/borderRadius:9,paddingHorizontal/g,"borderRadius:10,paddingHorizontal")
 s=s.replace(/borderRadius:8,paddingHorizontal/g,"borderRadius:10,paddingHorizontal")
 // Make page titles feel like the reference: compact and confident rather than oversized.
 s=s.replace(/title:\{fontSize:23,fontWeight:'900'/g,"title:{fontSize:20,fontWeight:'800'")
 s=s.replace(/sectionTitle:\{fontSize:21,fontWeight:'900'/g,"sectionTitle:{fontSize:18,fontWeight:'800'")
 s=s.replace(/panelTitle:\{fontSize:16,fontWeight:'900'/g,"panelTitle:{fontSize:14,fontWeight:'800'")
 s=s.replace(/flowTitle:\{fontSize:14,fontWeight:'900'/g,"flowTitle:{fontSize:13,fontWeight:'800'")
 s=s.replace(/toolCardTitle:\{fontSize:17,fontWeight:'900'/g,"toolCardTitle:{fontSize:15,fontWeight:'800'")
 if(s!==before){fs.writeFileSync(file,s);changed++}
}

// Overview gets a dedicated dashboard polish because it sets the visual standard for the whole product.
const overviewPath=path.join(screens,'OverviewScreen.tsx')
if(fs.existsSync(overviewPath)){
 let s=fs.readFileSync(overviewPath,'utf8')
 s=s.replace('page: { flex: 1, backgroundColor: palette.surface }','page: { flex: 1, backgroundColor: palette.canvas }')
 s=s.replace('welcome: { fontSize: 20, fontWeight: "900", color: palette.ink }','welcome: { fontSize: 19, fontWeight: "800", color: palette.ink, letterSpacing: -0.25 }')
 s=s.replace('width: 330,\n    height: 40,','width: 300,\n    height: 36,')
 s=s.replace('borderRadius: 9,','borderRadius: 10,\n    backgroundColor: "#FAFBFD",')
 s=s.replace('width: 40,\n    height: 40,','width: 36,\n    height: 36,')
 s=s.replace('borderRadius: 20,','borderRadius: 18,')
 s=s.replace('metricValue: {\n    fontSize: 26,','metricValue: {\n    fontSize: 23,')
 s=s.replace('panelTitle: { fontSize: 13, fontWeight: "800", color: palette.ink }','panelTitle: { fontSize: 12.5, fontWeight: "800", color: palette.ink }')
 fs.writeFileSync(overviewPath,s)
}

console.log(`Premium native UI applied across ${changed} screens.`)
console.log('No routes, API calls, state, navigation, data models or workflows were intentionally changed.')
console.log('Run: cd apps/ipad && npm run typecheck')
