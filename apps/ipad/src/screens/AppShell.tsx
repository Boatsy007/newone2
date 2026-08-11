import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Sidebar } from '../components/Sidebar'
import { palette } from '../theme'
import type { AppArea, ClubAccount } from '../types'
import { OverviewScreen } from './OverviewScreen'

type Props = { club: ClubAccount; onSwitchClub: () => void; onSignOut: () => void }

export function AppShell({club,onSwitchClub,onSignOut}:Props){
 const[area,setArea]=useState<AppArea>('overview')
 return <View style={styles.app}><Sidebar active={area} club={club} onChange={setArea} onSwitchClub={onSwitchClub}/><View style={styles.main}>{area==='overview'?<OverviewScreen club={club} onSignOut={onSignOut}/>:<View style={styles.coming}><Text style={styles.eyebrow}>PLAYFOOTY CLUB APP</Text><Text style={styles.title}>{area}</Text><Text style={styles.copy}>This completed PlayFooty module will be connected in its dedicated build stage.</Text></View>}</View></View>
}
const styles=StyleSheet.create({app:{flex:1,flexDirection:'row',backgroundColor:palette.canvas},main:{flex:1},coming:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:palette.canvas},eyebrow:{fontSize:10,color:palette.blue,fontWeight:'900',letterSpacing:1.4},title:{fontSize:40,fontWeight:'900',color:palette.ink,textTransform:'capitalize',marginTop:5},copy:{fontSize:13,color:palette.muted,marginTop:7}})
