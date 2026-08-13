import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd()
const src=path.join(root,'apps/ipad/src')
const screensDir=path.join(src,'screens')
const sidebarPath=path.join(src,'components/Sidebar.tsx')
const themePath=path.join(src,'theme.ts')
if(!fs.existsSync(screensDir)||!fs.existsSync(sidebarPath))throw new Error('Run from playfooty-ipad repo root')

// Strong visual reset based on the supplied dashboard reference.
fs.writeFileSync(themePath,`export const palette = {
  blue: '#2867F0',
  blueDark: '#174FCB',
  blueSoft: '#EEF4FF',
  canvas: '#F7F8FC',
  surface: '#FFFFFF',
  border: '#ECEEF3',
  ink: '#171B24',
  muted: '#7D8492',
  green: '#20B874',
  orange: '#FFAA19',
  purple: '#7D4CFF',
  pink: '#EA4E9D',
  red: '#F05B67',
} as const
`)

// Replace the sidebar component completely so the difference is unmistakable.
let sidebar=fs.readFileSync(sidebarPath,'utf8')
const head=sidebar.slice(0,sidebar.indexOf('export function Sidebar'))
const newSidebar=`export function Sidebar({ active, club, onChange, onSwitchClub }: Props) {
  return <View style={styles.shell}>
    <View style={styles.brand}>
      <View style={styles.mark}><Text style={styles.markText}>P</Text></View>
      <Text style={styles.brandName}>PLAYFOOTY</Text>
    </View>
    <View style={styles.nav}>{items.map(({ key, label, icon: Icon }) => {
      const selected=active===key
      return <Pressable key={key} onPress={()=>onChange(key)} style={[styles.item,selected&&styles.itemActive]}>
        <View style={[styles.iconBox,selected&&styles.iconBoxActive]}><Icon size={15} strokeWidth={2.1} color={selected?'#fff':'#7B8290'}/></View>
        <Text numberOfLines={1} style={[styles.itemLabel,selected&&styles.itemLabelActive]}>{label}</Text>
      </Pressable>
    })}</View>
    <Pressable onPress={onSwitchClub} style={styles.club}>
      {club.logoUrl?<Image source={{uri:club.logoUrl}} style={{width:30,height:30,borderRadius:15}} resizeMode="contain"/>:<View style={styles.clubLogoFallback}><Building2 size={15} color={palette.blue}/></View>}
      <View style={styles.clubCopy}><Text numberOfLines={1} style={styles.clubName}>{club.clubName}</Text><Text numberOfLines={1} style={styles.clubRole}>{club.role.replaceAll('_',' ')}</Text></View>
    </Pressable>
  </View>
}

const styles=StyleSheet.create({
  shell:{width:176,backgroundColor:'#FFFFFF',borderRightWidth:1,borderRightColor:'#F0F1F4',paddingHorizontal:12,paddingTop:18,paddingBottom:14},
  brand:{height:48,flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:5},
  mark:{width:30,height:30,borderRadius:8,backgroundColor:palette.blue,alignItems:'center',justifyContent:'center',transform:[{skewX:'-8deg'}]},
  markText:{color:'#fff',fontSize:18,fontWeight:'900'},
  brandName:{fontSize:12,fontWeight:'900',letterSpacing:.35,color:palette.ink},
  nav:{marginTop:18,gap:5},
  item:{height:36,borderRadius:9,paddingHorizontal:8,flexDirection:'row',alignItems:'center',gap:8},
  itemActive:{backgroundColor:palette.blue,shadowColor:palette.blue,shadowOpacity:.16,shadowRadius:8,shadowOffset:{width:0,height:4}},
  iconBox:{width:23,height:23,borderRadius:7,alignItems:'center',justifyContent:'center'},
  iconBoxActive:{backgroundColor:'rgba(255,255,255,.12)'},
  itemLabel:{fontSize:10.5,fontWeight:'600',color:'#777F8C'},
  itemLabelActive:{fontWeight:'800',color:'#fff'},
  club:{marginTop:'auto',paddingTop:12,borderTopWidth:1,borderTopColor:'#F1F2F5',flexDirection:'row',alignItems:'center',gap:8},
  clubLogoFallback:{width:30,height:30,borderRadius:15,backgroundColor:palette.blueSoft,alignItems:'center',justifyContent:'center'},
  clubCopy:{flex:1},clubName:{fontSize:9.5,fontWeight:'800',color:palette.ink},clubRole:{fontSize:7.5,color:palette.muted,textTransform:'capitalize',marginTop:2},
})
`
fs.writeFileSync(sidebarPath,head+newSidebar)

const files=fs.readdirSync(screensDir).filter(f=>f.endsWith('.tsx'))
let changed=0
for(const name of files){
  const file=path.join(screensDir,name)
  let s=fs.readFileSync(file,'utf8')
  const before=s

  // Page chrome: light grey canvas with compact white toolbar like the reference.
  s=s.replace(/page:\{flex:1,backgroundColor:palette\.(?:canvas|surface)\}/g,"page:{flex:1,backgroundColor:'#F7F8FC'}")
  s=s.replace(/page: \{ flex: 1, backgroundColor: palette\.(?:canvas|surface) \}/g,"page: { flex: 1, backgroundColor: '#F7F8FC' }")
  s=s.replace(/topbar:\{height:\d+,paddingHorizontal:\d+,backgroundColor:palette\.surface,borderBottomWidth:1,borderBottomColor:[^,}]+/g,"topbar:{height:64,paddingHorizontal:18,backgroundColor:'#FFFFFF',borderBottomWidth:1,borderBottomColor:'#F0F1F4'")
  s=s.replace(/top: \{\s*height: \d+,\s*paddingHorizontal: \d+,\s*borderBottomWidth: 1,\s*borderBottomColor: palette\.border/g,"top: { height:64, paddingHorizontal:18, backgroundColor:'#FFFFFF', borderBottomWidth:1, borderBottomColor:'#F0F1F4'")
  s=s.replace(/content:\{padding:\d+,gap:\d+\}/g,"content:{padding:14,gap:10}")
  s=s.replace(/content: \{ padding: \d+, gap: \d+ \}/g,"content: { padding:14, gap:10 }")

  // Typography density.
  s=s.replace(/fontSize:23,fontWeight:'900'/g,"fontSize:18,fontWeight:'800'")
  s=s.replace(/fontSize:21,fontWeight:'900'/g,"fontSize:17,fontWeight:'800'")
  s=s.replace(/fontSize:20,fontWeight:'900'/g,"fontSize:17,fontWeight:'800'")
  s=s.replace(/fontSize:17,fontWeight:'900'/g,"fontSize:14,fontWeight:'800'")
  s=s.replace(/fontSize:16,fontWeight:'900'/g,"fontSize:13,fontWeight:'800'")
  s=s.replace(/fontSize:14,fontWeight:'900'/g,"fontSize:12.5,fontWeight:'800'")

  // Cards: flatter, cleaner, smaller radius, very subtle elevation.
  s=s.replace(/borderWidth:1,borderColor:palette\.border,borderRadius:14,backgroundColor:palette\.surface/g,"borderWidth:1,borderColor:'#ECEEF3',borderRadius:11,backgroundColor:'#FFFFFF',shadowColor:'#101828',shadowOpacity:.025,shadowRadius:6,shadowOffset:{width:0,height:2}")
  s=s.replace(/borderWidth:1,borderColor:palette\.border,borderRadius:13,backgroundColor:palette\.surface/g,"borderWidth:1,borderColor:'#ECEEF3',borderRadius:11,backgroundColor:'#FFFFFF',shadowColor:'#101828',shadowOpacity:.025,shadowRadius:6,shadowOffset:{width:0,height:2}")
  s=s.replace(/borderWidth:1,borderColor:palette\.border,borderRadius:12,backgroundColor:palette\.surface/g,"borderWidth:1,borderColor:'#ECEEF3',borderRadius:10,backgroundColor:'#FFFFFF',shadowColor:'#101828',shadowOpacity:.02,shadowRadius:5,shadowOffset:{width:0,height:2}")
  s=s.replace(/borderRadius: 14,/g,'borderRadius: 11,')
  s=s.replace(/borderColor: palette\.border/g,"borderColor: '#ECEEF3'")

  // Chips and buttons.
  s=s.replace(/borderRadius:10/g,'borderRadius:8')
  s=s.replace(/borderRadius:9/g,'borderRadius:8')
  s=s.replace(/borderRadius:13/g,'borderRadius:11')
  s=s.replace(/padding:17/g,'padding:14')
  s=s.replace(/padding:16/g,'padding:14')
  s=s.replace(/padding:15/g,'padding:13')
  s=s.replace(/padding:13/g,'padding:11')

  if(s!==before){fs.writeFileSync(file,s);changed++}
}

// Overview: specifically reshape the dashboard so it reads like the supplied example, not the old app.
const overviewPath=path.join(screensDir,'OverviewScreen.tsx')
if(fs.existsSync(overviewPath)){
 let s=fs.readFileSync(overviewPath,'utf8')
 s=s.replace(/content: \{ padding:14, gap:10 \}/,"content:{padding:12,gap:9}")
 s=s.replace(/heroRow: \{ flexDirection: "row", gap: 14 \}/,"heroRow:{flexDirection:'row',gap:9}")
 s=s.replace(/height: 214,/g,'height: 158,')
 s=s.replace(/width: 320,/g,'width: 270,')
 s=s.replace(/width: "32%",/g,'width:"23%",')
 s=s.replace(/fontSize: 26,/g,'fontSize:20,')
 s=s.replace(/marginTop: 18,/g,'marginTop:10,')
 s=s.replace(/metrics: \{ flexDirection: "row", gap: 12 \}/,"metrics:{flexDirection:'row',gap:8}")
 s=s.replace(/height: 145,/g,'height:108,')
 s=s.replace(/fontSize: 26,/g,'fontSize:21,')
 s=s.replace(/lower: \{ flexDirection: "row", gap: 14 \}/,"lower:{flexDirection:'row',gap:9}")
 s=s.replace(/height: 250,/g,'height:210,')
 s=s.replace(/sideColumn: \{ width: 320, gap: 14 \}/,"sideColumn:{width:270,gap:9}")
 s=s.replace(/bottom: \{ flexDirection: "row", gap: 14, minHeight: 165 \}/,"bottom:{flexDirection:'row',gap:9,minHeight:140}")
 fs.writeFileSync(overviewPath,s)
}

console.log(`Reference UI overhaul applied across ${changed} native screens.`)
console.log('This is a visual/layout-density pass only. Existing routes, API calls and workflows are preserved.')
console.log('Run: cd apps/ipad && npm run typecheck')