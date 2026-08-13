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
   <View style={s.brandCopy}><Text style={s.brandName}>PLAYFOOTY</Text><Text style={s.brandSub}>CLUB HUB</Text></View>
  </View>

  <View style={s.nav}>
   {items.map(({key,label,icon:Icon})=>{const selected=active===key;return <Pressable key={key} hitSlop={10} onPress={()=>onChange(key)} style={({pressed})=>[s.navItem,selected&&s.navItemActive,pressed&&s.pressed]}>
    <View style={[s.iconWrap,selected&&s.iconWrapActive]}><Icon size={21} strokeWidth={2.15} color={selected?'#FFFFFF':'#6A768A'}/></View>
    <Text numberOfLines={1} style={[s.navLabel,selected&&s.navLabelActive]}>{label}</Text>
    {selected?<View style={s.activeAccent}/>:null}
   </Pressable>})}
  </View>

  <Pressable onPress={onSwitchClub} hitSlop={10} style={({pressed})=>[s.profile,pressed&&s.pressed]}>
   {club.logoUrl?<View style={s.clubLogoShell}><Image source={{uri:club.logoUrl}} style={s.clubLogo} resizeMode="contain"/></View>:<View style={s.clubFallback}><Building2 size={20} color={palette.blue}/></View>}
   <View style={s.profileCopy}><Text numberOfLines={1} style={s.clubName}>{club.clubName}</Text><Text numberOfLines={1} style={s.role}>{club.role.replaceAll('_',' ')}</Text></View>
  </Pressable>
 </View>
}

const s=StyleSheet.create({
 shell:{width:220,backgroundColor:'#FFFFFF',borderRightWidth:1,borderRightColor:'#E9EDF3',paddingHorizontal:16,paddingTop:18,paddingBottom:96,position:'relative'},
 brandWrap:{height:74,flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:4},brandMark:{width:44,height:44,borderRadius:13,backgroundColor:'#176BFF',alignItems:'center',justifyContent:'center',transform:[{skewX:'-9deg'}],shadowColor:'#176BFF',shadowOpacity:.18,shadowRadius:12,shadowOffset:{width:0,height:5}},brandMarkText:{color:'#FFFFFF',fontSize:24,fontWeight:'900',transform:[{skewX:'9deg'}]},brandCopy:{flex:1},brandName:{fontSize:15,fontWeight:'900',color:'#141A24',letterSpacing:.15},brandSub:{fontSize:8.5,fontWeight:'900',color:'#A0A9B8',letterSpacing:1.35,marginTop:2},
 nav:{marginTop:14,gap:8},navItem:{height:52,borderRadius:14,paddingHorizontal:11,flexDirection:'row',alignItems:'center',gap:11,position:'relative'},navItemActive:{backgroundColor:'#176BFF',shadowColor:'#176BFF',shadowOpacity:.16,shadowRadius:12,shadowOffset:{width:0,height:5}},iconWrap:{width:30,height:30,borderRadius:9,alignItems:'center',justifyContent:'center'},iconWrapActive:{backgroundColor:'rgba(255,255,255,.12)'},navLabel:{fontSize:14.5,fontWeight:'700',color:'#556176',flex:1},navLabelActive:{color:'#FFFFFF',fontWeight:'900'},activeAccent:{position:'absolute',right:8,width:4,height:25,borderRadius:3,backgroundColor:'#FF4D9E'},pressed:{opacity:.76},
 profile:{position:'absolute',left:16,right:16,bottom:16,minHeight:64,borderWidth:1,borderColor:'#E8EDF4',borderRadius:14,backgroundColor:'#FAFBFD',padding:10,flexDirection:'row',alignItems:'center',gap:10,shadowColor:'#172033',shadowOpacity:.035,shadowRadius:8,shadowOffset:{width:0,height:3}},clubLogoShell:{width:40,height:40,borderRadius:12,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E6EBF2',alignItems:'center',justifyContent:'center'},clubLogo:{width:32,height:32},clubFallback:{width:40,height:40,borderRadius:12,backgroundColor:'#EEF4FF',alignItems:'center',justifyContent:'center'},profileCopy:{flex:1,minWidth:0},clubName:{fontSize:12.5,fontWeight:'900',color:'#1D2430'},role:{fontSize:9,color:'#929CAB',textTransform:'capitalize',marginTop:2}
})