import type { LucideIcon } from 'lucide-react-native'
import { BarChart3, Building2, Clapperboard, CreditCard, Globe2, Handshake, Home, Settings, Trophy, Wrench } from 'lucide-react-native'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { palette } from '../theme'
import type { AppArea, ClubAccount } from '../types'

const items: Array<{ key: AppArea; label: string; icon: LucideIcon }> = [
  { key: 'overview', label: 'Overview', icon: Home },
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
    <View style={styles.brand}><View style={styles.mark}><Text style={styles.markText}>P</Text></View><View><Text style={styles.brandName}>PLAYFOOTY</Text><Text style={styles.brandSub}>CLUB HUB</Text></View></View>
    <View style={styles.nav}>{items.map(({ key, label, icon: Icon }) => <Pressable key={key} onPress={() => onChange(key)} style={[styles.item, active === key && styles.itemActive]}><Icon size={18} strokeWidth={2.2} color={active === key ? '#fff' : palette.ink}/><Text style={[styles.itemLabel, active === key && styles.itemLabelActive]}>{label}</Text></Pressable>)}</View>
    <Pressable onPress={onSwitchClub} style={styles.club}>
      {club.logoUrl ? <Image source={{ uri: club.logoUrl }} style={styles.clubLogo} resizeMode="contain"/> : <View style={styles.clubLogoFallback}><Building2 size={20} color={palette.blue}/></View>}
      <View style={styles.clubCopy}><Text numberOfLines={1} style={styles.clubName}>{club.clubName}</Text><Text style={styles.clubRole}>{club.role.replaceAll('_', ' ')}</Text></View>
      <Text style={styles.chevron}>⌄</Text>
    </Pressable>
  </View>
}

const styles = StyleSheet.create({
  shell:{width:228,backgroundColor:palette.surface,borderRightWidth:1,borderRightColor:palette.border,paddingHorizontal:18,paddingTop:28,paddingBottom:18},
  brand:{height:64,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:6},mark:{width:42,height:42,borderRadius:13,backgroundColor:palette.blue,alignItems:'center',justifyContent:'center',transform:[{skewX:'-8deg'}]},markText:{color:'#fff',fontSize:25,fontWeight:'900'},brandName:{color:palette.ink,fontWeight:'900',fontSize:17,letterSpacing:.2},brandSub:{color:palette.muted,fontSize:9,fontWeight:'700',letterSpacing:1.3,marginTop:1},
  nav:{gap:5,marginTop:20},item:{height:45,borderRadius:10,paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:12},itemActive:{backgroundColor:palette.blue,shadowColor:palette.blue,shadowOpacity:.25,shadowRadius:9,shadowOffset:{width:0,height:5}},itemLabel:{fontSize:13,color:palette.ink,fontWeight:'600'},itemLabelActive:{color:'#fff',fontWeight:'800'},
  club:{marginTop:'auto',minHeight:68,borderWidth:1,borderColor:palette.border,borderRadius:13,padding:10,flexDirection:'row',alignItems:'center',gap:9},clubLogo:{width:38,height:38,borderRadius:10},clubLogoFallback:{width:38,height:38,borderRadius:10,backgroundColor:palette.blueSoft,alignItems:'center',justifyContent:'center'},clubCopy:{flex:1},clubName:{fontSize:12,color:palette.ink,fontWeight:'800'},clubRole:{fontSize:9,color:palette.muted,textTransform:'capitalize',marginTop:3},chevron:{fontSize:17,color:palette.muted}
})
