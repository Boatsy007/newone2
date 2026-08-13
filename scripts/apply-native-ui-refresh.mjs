import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd()
const themePath=path.join(root,'apps/ipad/src/theme.ts')
const sidebarPath=path.join(root,'apps/ipad/src/components/Sidebar.tsx')
const shellPath=path.join(root,'apps/ipad/src/screens/AppShell.tsx')

for(const file of [themePath,sidebarPath,shellPath]){
  if(!fs.existsSync(file))throw new Error(`UI refresh: missing ${path.relative(root,file)}`)
}

fs.writeFileSync(themePath,`export const palette = {
  blue: '#2F6BFF',
  blueDark: '#1F4ED8',
  blueSoft: '#EEF4FF',
  canvas: '#F7F8FC',
  surface: '#FFFFFF',
  border: '#E8EBF2',
  ink: '#161B2B',
  muted: '#7A8396',
  green: '#22B573',
  orange: '#FF9F43',
  purple: '#7C3AED',
  pink: '#EC4899',
  red: '#EF476F',
} as const
`)

let sidebar=fs.readFileSync(sidebarPath,'utf8')
sidebar=sidebar.replace(
  /const styles = StyleSheet\.create\([\s\S]*$/,
`const styles = StyleSheet.create({
  shell:{
    width:218,
    backgroundColor:'#FFFFFF',
    borderRightWidth:1,
    borderRightColor:'#EEF0F5',
    paddingHorizontal:14,
    paddingTop:22,
    paddingBottom:16,
    shadowColor:'#111827',
    shadowOpacity:.04,
    shadowRadius:18,
    shadowOffset:{width:4,height:0},
  },
  brand:{height:58,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:7},
  mark:{
    width:38,height:38,borderRadius:11,backgroundColor:palette.blue,
    alignItems:'center',justifyContent:'center',transform:[{skewX:'-8deg'}],
    shadowColor:palette.blue,shadowOpacity:.22,shadowRadius:10,shadowOffset:{width:0,height:5},
  },
  markText:{color:'#fff',fontSize:23,fontWeight:'900'},
  brandName:{color:palette.ink,fontWeight:'900',fontSize:16,letterSpacing:.15},
  brandSub:{color:'#A0A7B5',fontSize:8,fontWeight:'800',letterSpacing:1.35,marginTop:1},
  nav:{gap:4,marginTop:18},
  item:{height:42,borderRadius:10,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:11},
  itemActive:{
    backgroundColor:palette.blue,
    shadowColor:palette.blue,shadowOpacity:.20,shadowRadius:12,shadowOffset:{width:0,height:6},
  },
  itemLabel:{fontSize:12.5,color:'#545D6F',fontWeight:'650'},
  itemLabelActive:{color:'#fff',fontWeight:'850'},
  club:{
    marginTop:'auto',minHeight:64,borderWidth:1,borderColor:'#ECEFF4',borderRadius:14,
    padding:9,flexDirection:'row',alignItems:'center',gap:9,backgroundColor:'#FBFCFE',
  },
  clubLogo:{width:38,height:38,borderRadius:11},
  clubLogoFallback:{width:38,height:38,borderRadius:11,backgroundColor:palette.blueSoft,alignItems:'center',justifyContent:'center'},
  clubCopy:{flex:1},
  clubName:{fontSize:11.5,color:palette.ink,fontWeight:'850'},
  clubRole:{fontSize:8.5,color:palette.muted,textTransform:'capitalize',marginTop:3},
  chevron:{fontSize:17,color:'#A0A7B5'}
})`
)
if(!sidebar.includes("backgroundColor:'#FFFFFF'"))throw new Error('UI refresh: Sidebar style patch failed')
fs.writeFileSync(sidebarPath,sidebar)

let shell=fs.readFileSync(shellPath,'utf8')
shell=shell.replace(
  /const styles=StyleSheet\.create\([\s\S]*$/,
`const styles=StyleSheet.create({
  app:{
    flex:1,
    flexDirection:'row',
    backgroundColor:palette.canvas,
  },
  main:{
    flex:1,
    backgroundColor:palette.canvas,
  },
  coming:{
    flex:1,
    alignItems:'center',
    justifyContent:'center',
    backgroundColor:palette.canvas,
    margin:18,
    borderRadius:18,
    borderWidth:1,
    borderColor:palette.border,
  },
  eyebrow:{fontSize:9,color:palette.blue,fontWeight:'900',letterSpacing:1.5},
  title:{fontSize:38,fontWeight:'900',color:palette.ink,textTransform:'capitalize',marginTop:5,letterSpacing:-.8},
  copy:{fontSize:12.5,color:palette.muted,marginTop:7}
})`
)
if(!shell.includes('borderRadius:18'))throw new Error('UI refresh: AppShell style patch failed')
fs.writeFileSync(shellPath,shell)

console.log('Native UI refresh applied.')
console.log('Preserved screen logic and navigation; changed shared visual styling only.')
