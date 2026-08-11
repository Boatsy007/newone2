import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { restoreSession, saveSession, signIn } from './auth'
import { AppShell } from './screens/AppShell'
import { ClubPickerScreen } from './screens/ClubPickerScreen'
import { SignInScreen } from './screens/SignInScreen'
import { palette } from './theme'
import type { AuthSession, ClubAccount } from './types'

export default function App() {
  const [restoring,setRestoring]=useState(true)
  const [session,setSession]=useState<AuthSession|null>(null)
  const [club,setClub]=useState<ClubAccount|null>(null)
  useEffect(()=>{void restoreSession().then(value=>{setSession(value);if(value?.club_accounts?.length===1)setClub(value.club_accounts[0]??null)}).finally(()=>setRestoring(false))},[])
  async function login(email:string,password:string){const result=await signIn(email,password);const clubs=result.club_accounts??[];if(!clubs.length)throw new Error('This login is not linked to an active club. Contact PlayFooty to be invited.');setSession(result);if(clubs.length===1)setClub(clubs[0]??null);void saveSession(result).catch(()=>{})}
  async function signOut(){await saveSession(null);setSession(null);setClub(null)}
  if(restoring)return <View style={styles.loading}><ActivityIndicator size="large" color={palette.blue}/></View>
  return <><StatusBar style="dark"/>{!session?<SignInScreen onSubmit={login}/>:!club?<ClubPickerScreen clubs={session.club_accounts??[]} onChoose={setClub} onSignOut={signOut}/>:<AppShell club={club} session={session} onSwitchClub={()=>setClub(null)} onSignOut={signOut}/>}</>
}
const styles=StyleSheet.create({loading:{flex:1,backgroundColor:palette.canvas,alignItems:'center',justifyContent:'center'}})
