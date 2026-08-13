import type { LucideIcon } from 'lucide-react-native'
import { BarChart3, Building2, Clapperboard, CreditCard, Globe2, Handshake, Home, Settings, Trophy, Wrench } from 'lucide-react-native'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { palette } from '../theme'
import type { AppArea, ClubAccount } from '../types'

const items:Array<{key:AppArea;label:string;icon:LucideIcon}>=[
 {key:'overview',label:'Dashboard',icon:Home},{key:'coaching',label:'Coaching',icon:Trophy},{key:'studio',label:'Studio',icon:Clapperboard},{key:'memberships',label:'Memberships',icon:CreditCard},{key:'website',label:'Website',icon:Globe2},{key:'operations',label:'Operations',icon:Wrench},{key:'analytics',label:'Analytics',icon:BarChart3},{key:'sponsors',label:'Sponsors',icon:Handshake},{key:'settings',label:'Settings',icon:Settings},
]

type Props={active:AppArea;club:ClubAccount;onChange:(area:AppArea)=>void;onSwitchClub:()=>void}

export function Sidebar({active,club,onChange,onSwitchClub}:Props){
 return <View style={s.shell}>
  <View style={s.brandWrap}>
   <View style={s.brandMark}><Text style={s.brandMarkText}>P</Text></View>
   <View><Text style={s.brandName}>PLAYFOOTY</Text><Text style={s.brandSub}>CLUB HUB</Text></View>
  </View>
  <View style={s.nav}>
   {items.map(({key,label,icon:Icon})=>{const selected=active===key;return <Pressable key={key} hitSlop={10} onPress={()=>onChange(key)} style={({pressed})=>[s.navItem,selected&&s.navItemActive,pressed&&s.pressed]}>
    <View style={[s.iconWrap,selected&&s.iconWrapActive]}><Icon size={20} strokeWidth={2.2} color={selected?'#FFFFFF':'#667286'}/></View>
    <Text numberOfLines={1} style={[s.navLabel,selected&&s.navLabelActive]}>{label}</Text>
    {selected?<View style={s.activeAccent}/>:null}
   </Pressable>})}
  </View>
  <Pressable onPress={onSwitchClub} hitSlop={10} style={({pressed})=>[s.profile,pressed&&s.pressed]}>
   {club.logoUrl?<Image source={{uri:club.logoUrl}} style={s.clubLogo} resizeMode="contain"/>:<View style={s.clubFallback}><Building2 size={19} color={palette.blue}/></View>}
   <View style={s.profileCopy}><Text numberOfLines={1} style={s.clubName}>{club.clubName}</Text><Text numberOfLines={1} style={s.role}>{club.role.replaceAll('_',' ')}</Text></View>
  </Pressable>
 </View>
}

const s=StyleSheet.create({
 shell:{width:205,backgroundColor:'#FFFFFF',borderRightWidth:1,borderRightColor:'#E7ECF3',paddingHorizontal:15,paddingTop:18,paddingBottom:16},
 brandWrap:{height:72,flexDirection:'row',alignItems:'center',gap:11,paddingHorizontal:5},brandMark:{width:42,height:42,borderRadius:12,backgroundColor:'#176BFF',alignItems:'center',justifyContent:'center',transform:[{skewX:'-9deg'}],shadowColor:'#176BFF',shadowOpacity:.2,shadowRadius:12,shadowOffset:{width:0,height:5}},brandMarkText:{color:'#FFFFFF',fontSize:23,fontWeight:'900',transform:[{skewX:'9deg'}]},brandName:{fontSize:14,fontWeight:'900',color:'#161C28',letterSpacing:.25},brandSub:{fontSize:8.5,fontWeight:'900',color:'#9AA4B3',letterSpacing:1.25,marginTop:2},
 nav:{flex:1,justifyContent:'space-evenly',paddingVertical:16},navItem:{height:50,borderRadius:13,paddingHorizontal:11,flexDirection:'row',alignItems:'center',gap:11,position:'relative'},navItemActive:{backgroundColor:'#176BFF',shadowColor:'#176BFF',shadowOpacity:.18,shadowRadius:12,shadowOffset:{width:0,height:5}},iconWrap:{width:28,height:28,alignItems:'center',justifyContent:'center'},iconWrapActive:{backgroundColor:'rgba(255,255,255,.10)',borderRadius:8},navLabel:{fontSize:13.5,fontWeight:'700',color:'#566174',flex:1},navLabelActive:{color:'#FFFFFF',fontWeight:'900'},activeAccent:{position:'absolute',right:8,width:4,height:24,borderRadius:3,backgroundColor:'#FF4D9E'},pressed:{opacity:.72},
 profile:{minHeight:68,borderTopWidth:1,borderTopColor:'#EDF0F5',paddingTop:15,flexDirection:'row',alignItems:'center',gap:10},clubLogo:{width:38,height:38,borderRadius:19,backgroundColor:'#F8FAFD'},clubFallback:{width:38,height:38,borderRadius:19,backgroundColor:'#EEF4FF',alignItems:'center',justifyContent:'center'},profileCopy:{flex:1,minWidth:0},clubName:{fontSize:11.5,fontWeight:'900',color:'#1E2430'},role:{fontSize:8.8,color:'#96A0AF',textTransform:'capitalize',marginTop:2}
})