import type { LucideIcon } from 'lucide-react-native'
import { BarChart3, Building2, Clapperboard, CreditCard, Globe2, Handshake, Home, Settings, Trophy, Wrench } from 'lucide-react-native'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { palette } from '../theme'
import type { AppArea, ClubAccount } from '../types'

const items:Array<{key:AppArea;label:string;icon:LucideIcon}>=[
 {key:'overview',label:'Dashboard',icon:Home},
 {key:'coaching',label:'Coaching',icon:Trophy},
 {key:'studio',label:'Studio',icon:Clapperboard},
 {key:'memberships',label:'Memberships',icon:CreditCard},
 {key:'website',label:'Website',icon:Globe2},
 {key:'operations',label:'Operations',icon:Wrench},
 {key:'analytics',label:'Analytics',icon:BarChart3},
 {key:'sponsors',label:'Sponsors',icon:Handshake},
 {key:'settings',label:'Settings',icon:Settings},
]

type Props={active:AppArea;club:ClubAccount;onChange:(area:AppArea)=>void;onSwitchClub:()=>void}

export function Sidebar({active,club,onChange,onSwitchClub}:Props){
 return <View style={s.shell} pointerEvents="auto">
  <View style={s.brandWrap}>
   <View style={s.brandMark}><Text style={s.brandMarkText}>P</Text></View>
   <Text style={s.brandName}>PLAYFOOTY</Text>
  </View>

  <View style={s.nav}>
   {items.map(({key,label,icon:Icon})=>{
    const selected=active===key
    return <Pressable
      key={key}
      hitSlop={6}
      onPress={()=>onChange(key)}
      style={({pressed})=>[s.navItem,selected&&s.navItemActive,pressed&&s.pressed]}
    >
     <View style={[s.iconWrap,selected&&s.iconWrapActive]}>
      <Icon size={17} strokeWidth={2} color={selected?'#FFFFFF':'#8992A3'}/>
     </View>
     <Text numberOfLines={1} style={[s.navLabel,selected&&s.navLabelActive]}>{label}</Text>
     {selected?<View style={s.activeAccent}/>:null}
    </Pressable>
   })}
  </View>

  <Pressable hitSlop={6} onPress={onSwitchClub} style={({pressed})=>[s.profile,pressed&&s.pressed]}>
   {club.logoUrl
    ? <Image source={{uri:club.logoUrl}} style={s.clubLogo} resizeMode="contain"/>
    : <View style={s.clubFallback}><Building2 size={16} color={palette.blue}/></View>}
   <View style={s.profileCopy}>
    <Text numberOfLines={1} style={s.clubName}>{club.clubName}</Text>
    <Text numberOfLines={1} style={s.role}>{club.role.replaceAll('_',' ')}</Text>
   </View>
  </Pressable>
 </View>
}

const s=StyleSheet.create({
 shell:{width:162,backgroundColor:'#FFFFFF',borderRightWidth:1,borderRightColor:'#EEF1F5',paddingHorizontal:11,paddingTop:14,paddingBottom:12},
 brandWrap:{height:58,flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:5},
 brandMark:{width:36,height:36,borderRadius:10,backgroundColor:'#176BFF',alignItems:'center',justifyContent:'center',transform:[{skewX:'-10deg'}],shadowColor:'#176BFF',shadowOpacity:.22,shadowRadius:9,shadowOffset:{width:0,height:4}},
 brandMarkText:{color:'#FFFFFF',fontSize:20,fontWeight:'900',transform:[{skewX:'10deg'}]},
 brandName:{fontSize:11.5,fontWeight:'900',color:'#171C27',letterSpacing:.2},
 nav:{marginTop:14,gap:5},
 navItem:{height:44,borderRadius:10,paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:9,position:'relative'},
 navItemActive:{backgroundColor:'#176BFF',shadowColor:'#176BFF',shadowOpacity:.2,shadowRadius:8,shadowOffset:{width:0,height:4}},
 iconWrap:{width:22,height:22,alignItems:'center',justifyContent:'center'},
 iconWrapActive:{backgroundColor:'rgba(255,255,255,.08)',borderRadius:6},
 navLabel:{fontSize:11,fontWeight:'600',color:'#687284',flex:1},
 navLabelActive:{color:'#FFFFFF',fontWeight:'800'},
 activeAccent:{position:'absolute',right:6,width:4,height:20,borderRadius:2,backgroundColor:'#FF3D9A'},
 pressed:{opacity:.72},
 profile:{marginTop:'auto',borderTopWidth:1,borderTopColor:'#EEF1F5',paddingTop:12,minHeight:58,flexDirection:'row',alignItems:'center',gap:8},
 clubLogo:{width:32,height:32,borderRadius:16,backgroundColor:'#F8FAFD'},
 clubFallback:{width:32,height:32,borderRadius:16,backgroundColor:'#EEF4FF',alignItems:'center',justifyContent:'center'},
 profileCopy:{flex:1,minWidth:0},
 clubName:{fontSize:9.6,fontWeight:'800',color:'#1E2430'},
 role:{fontSize:7.8,color:'#9AA3B2',textTransform:'capitalize',marginTop:1},
})