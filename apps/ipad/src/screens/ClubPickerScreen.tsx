import { Building2, ChevronRight, LogOut } from 'lucide-react-native'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { palette } from '../theme'
import type { ClubAccount } from '../types'

type Props = { clubs: ClubAccount[]; onChoose: (club: ClubAccount) => void; onSignOut: () => void }

export function ClubPickerScreen({ clubs, onChoose, onSignOut }: Props) {
  return <View style={styles.page}><View style={styles.panel}><Text style={styles.eyebrow}>PLAYFOOTY CLUB APP</Text><Text style={styles.title}>Choose your club</Text><Text style={styles.copy}>You only see clubs linked to your PlayFooty account.</Text><View style={styles.list}>{clubs.map(club => <Pressable key={club.clubId} onPress={() => onChoose(club)} style={styles.club}>{club.logoUrl ? <Image source={{uri:club.logoUrl}} style={styles.logo} resizeMode="contain"/> : <View style={styles.logoFallback}><Building2 color={palette.blue}/></View>}<View style={styles.details}><Text style={styles.name}>{club.clubName}</Text><Text style={styles.role}>{club.role.replaceAll('_',' ')}</Text></View><ChevronRight color={palette.blue}/></Pressable>)}</View><Pressable onPress={onSignOut} style={styles.signOut}><LogOut size={16}/><Text style={styles.signOutText}>Sign out</Text></Pressable></View></View>
}

const styles=StyleSheet.create({page:{flex:1,backgroundColor:palette.canvas,alignItems:'center',justifyContent:'center',padding:28},panel:{width:560,backgroundColor:'#fff',borderRadius:20,borderWidth:1,borderColor:palette.border,padding:28},eyebrow:{fontSize:10,fontWeight:'900',letterSpacing:1.5,color:palette.blue},title:{fontSize:34,fontWeight:'900',color:palette.ink,marginTop:5},copy:{fontSize:13,color:palette.muted,marginTop:5,marginBottom:20},list:{gap:10},club:{height:72,borderWidth:1,borderColor:palette.border,borderRadius:13,padding:11,flexDirection:'row',alignItems:'center',gap:12},logo:{width:48,height:48,borderRadius:11},logoFallback:{width:48,height:48,borderRadius:11,backgroundColor:palette.blueSoft,alignItems:'center',justifyContent:'center'},details:{flex:1},name:{fontSize:15,fontWeight:'800',color:palette.ink},role:{fontSize:10,color:palette.muted,textTransform:'capitalize',marginTop:4},signOut:{alignSelf:'center',flexDirection:'row',gap:7,alignItems:'center',marginTop:20,padding:9},signOutText:{fontSize:12,fontWeight:'700',color:palette.ink}})
