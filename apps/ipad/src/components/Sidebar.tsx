import type { LucideIcon } from 'lucide-react-native'
import { BarChart3, Building2, Clapperboard, CreditCard, Globe2, Handshake, Home, Settings, Trophy, Wrench } from 'lucide-react-native'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { palette } from '../theme'
import type { AppArea, ClubAccount } from '../types'

const items: Array<{ key: AppArea; label: string; icon: LucideIcon }> = [
  { key: 'overview', label: 'Dashboard', icon: Home },
  { key: 'coaching', label: 'Coaching', icon: Trophy },
  { key: 'studio', label: 'Studio', icon: Clapperboard },
  { key: 'memberships', label: 'Memberships', icon: CreditCard },
  { key: 'website', label: 'Website', icon: Globe2 },
  { key: 'operations', label: 'Operations', icon: Wrench },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'sponsors', label: 'Sponsors', icon: Handshake },
  { key: 'settings', label: 'Settings', icon: Settings },
]

type Props = { active: AppArea; club: ClubAccount; onChange: (area: AppArea) => void; onSwitchClub: () => void }

export function Sidebar({ active, club, onChange, onSwitchClub }: Props) {
  return <View style={styles.shell}>
    <View style={styles.brand}>
      <View style={styles.mark}><Text style={styles.markText}>P</Text></View>
      <Text style={styles.brandName}>PLAYFOOTY</Text>
    </View>

    <View style={styles.nav}>
      {items.map(({ key, label, icon: Icon }) => {
        const selected=active===key
        return <Pressable key={key} onPress={() => onChange(key)} style={[styles.item,selected&&styles.itemActive]}>
          <Icon size={15} strokeWidth={2} color={selected?'#fff':'#8A93A3'}/>
          <Text style={[styles.itemLabel,selected&&styles.itemLabelActive]}>{label}</Text>
          {selected?<View style={styles.activeDot}/>:null}
        </Pressable>
      })}
    </View>

    <Pressable onPress={onSwitchClub} style={styles.club}>
      {club.logoUrl
        ? <Image source={{uri:club.logoUrl}} style={styles.clubLogo} resizeMode="contain"/>
        : <View style={styles.clubLogoFallback}><Building2 size={16} color={palette.blue}/></View>}
      <View style={styles.clubCopy}>
        <Text numberOfLines={1} style={styles.clubName}>{club.clubName}</Text>
        <Text style={styles.clubRole}>{club.role.replaceAll('_',' ')}</Text>
      </View>
    </Pressable>
  </View>
}

const styles=StyleSheet.create({
  shell:{width:166,backgroundColor:'#FFFFFF',borderRightWidth:1,borderRightColor:'#EFF1F5',paddingHorizontal:12,paddingTop:18,paddingBottom:14},
  brand:{height:50,flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:5},
  mark:{width:29,height:29,borderRadius:8,backgroundColor:palette.blue,alignItems:'center',justifyContent:'center',transform:[{skewX:'-9deg'}]},
  markText:{color:'#fff',fontSize:18,fontWeight:'900'},
  brandName:{fontSize:12.5,fontWeight:'900',color:'#151A26',letterSpacing:.2},
  nav:{marginTop:18,gap:4},
  item:{height:35,borderRadius:8,paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:9,position:'relative'},
  itemActive:{backgroundColor:palette.blue,shadowColor:palette.blue,shadowOpacity:.16,shadowRadius:8,shadowOffset:{width:0,height:4}},
  itemLabel:{fontSize:10.5,fontWeight:'600',color:'#70798A'},
  itemLabelActive:{color:'#fff',fontWeight:'800'},
  activeDot:{position:'absolute',right:8,width:4,height:4,borderRadius:2,backgroundColor:'#fff'},
  club:{marginTop:'auto',minHeight:54,borderTopWidth:1,borderTopColor:'#F0F1F4',paddingTop:12,flexDirection:'row',alignItems:'center',gap:8},
  clubLogo:{width:30,height:30,borderRadius:8},
  clubLogoFallback:{width:30,height:30,borderRadius:8,backgroundColor:palette.blueSoft,alignItems:'center',justifyContent:'center'},
  clubCopy:{flex:1},
  clubName:{fontSize:9.5,fontWeight:'800',color:'#202637'},
  clubRole:{fontSize:7.5,color:'#98A0AF',textTransform:'capitalize',marginTop:2},
})