import { useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { palette } from '../theme'

type Props = { onSubmit: (email: string, password: string) => Promise<void> }

export function SignInScreen({ onSubmit }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit() {
    if (!email.trim() || !password) return setError('Enter your email and password.')
    setBusy(true); setError('')
    try { await onSubmit(email, password) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to sign in') } finally { setBusy(false) }
  }
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.brand}><View style={styles.mark}><Text style={styles.markText}>P</Text></View><Text style={styles.brandText}>PLAYFOOTY</Text><Text style={styles.brandSub}>CLUB APP</Text></View>
    <View style={styles.card}><Text style={styles.eyebrow}>WELCOME BACK</Text><Text style={styles.title}>Run your club.</Text><Text style={styles.copy}>Sign in with the same PlayFooty account you use on the web.</Text>
      <Text style={styles.label}>EMAIL</Text><TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.input} placeholder="you@club.com.au" placeholderTextColor="#98A2B3"/>
      <Text style={styles.label}>PASSWORD</Text><TextInput secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} onSubmitEditing={submit} style={styles.input} placeholder="Your password" placeholderTextColor="#98A2B3"/>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Pressable disabled={busy} onPress={submit} style={styles.button}>{busy ? <ActivityIndicator color="#fff"/> : <Text style={styles.buttonText}>OPEN CLUB APP</Text>}</Pressable>
    </View>
  </KeyboardAvoidingView>
}

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:palette.canvas,alignItems:'center',justifyContent:'center',padding:30},brand:{alignItems:'center',marginBottom:22},mark:{width:60,height:60,borderRadius:18,backgroundColor:palette.blue,alignItems:'center',justifyContent:'center',transform:[{skewX:'-8deg'}]},markText:{color:'#fff',fontWeight:'900',fontSize:34},brandText:{fontSize:20,fontWeight:'900',color:palette.ink,marginTop:10},brandSub:{fontSize:9,color:palette.muted,fontWeight:'800',letterSpacing:2,marginTop:2},card:{width:420,backgroundColor:'#fff',borderRadius:20,borderWidth:1,borderColor:palette.border,padding:30,shadowColor:'#1D2939',shadowOpacity:.08,shadowRadius:28,shadowOffset:{width:0,height:12}},eyebrow:{fontSize:10,fontWeight:'900',letterSpacing:1.5,color:palette.blue},title:{fontSize:34,fontWeight:'900',letterSpacing:-1.1,color:palette.ink,marginTop:5},copy:{fontSize:13,color:palette.muted,lineHeight:19,marginTop:7,marginBottom:22},label:{fontSize:9,fontWeight:'900',letterSpacing:1,color:palette.ink,marginBottom:7,marginTop:12},input:{height:48,borderWidth:1,borderColor:'#D9E0E8',borderRadius:10,paddingHorizontal:14,fontSize:14,color:palette.ink,backgroundColor:'#FCFDFE'},error:{fontSize:12,color:palette.red,marginTop:12},button:{height:50,borderRadius:10,backgroundColor:palette.blue,alignItems:'center',justifyContent:'center',marginTop:20},buttonText:{color:'#fff',fontSize:12,fontWeight:'900',letterSpacing:.7}
})
