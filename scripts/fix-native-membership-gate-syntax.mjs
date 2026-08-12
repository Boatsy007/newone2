import fs from 'node:fs'
import path from 'node:path'

const file = path.resolve('apps/ipad/src/screens/MembershipAdvancedScreen.tsx')
const source = fs.readFileSync(file, 'utf8')
const start = source.indexOf('function Gate({club,session}:Props){')
const end = source.indexOf('\nfunction Reports({club,session}:Props){', start)
if (start < 0 || end < 0) throw new Error('Could not locate Gate section in MembershipAdvancedScreen.tsx')

const replacement = `function Gate({club,session}:Props){
 type Event={id:string;round:string|null;homeName:string;awayName:string;matchDate:string|null;venue:string|null;grade:string;admitted:number}
 type Result={result:string;title:string;message:string;member?:{displayName:string;productName:string|null;membershipNumber:string|null}}
 const[events,setEvents]=useState<Event[]>([])
 const[fixtureId,setFixtureId]=useState('')
 const[code,setCode]=useState('')
 const[result,setResult]=useState<Result|null>(null)
 const[loading,setLoading]=useState(true)
 const[busy,setBusy]=useState(false)
 const[error,setError]=useState('')
 async function load(){
  setLoading(true);setError('')
  try{
   const p=await apiGet<{data?:Event[]}>(\`${base(club.clubId)}/gate/events\`,session.access_token)
   const rows=Array.isArray(p.data)?p.data:[]
   setEvents(rows)
   setFixtureId(current=>current||rows[0]?.id||'')
  }catch(e){setError(e instanceof Error?e.message:'Unable to load gate events')}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[club.clubId,session.access_token])
 async function check(){
  if(!fixtureId||!code.trim())return
  setBusy(true);setError('');setResult(null)
  try{
   const p=await apiRequest<{data?:Result}>(\`${base(club.clubId)}/gate/check-in\`,{accessToken:session.access_token,method:'POST',body:{fixtureId,credentialToken:code.trim()}})
   setResult(p.data??null);setCode('');void load()
  }catch(e){setError(e instanceof Error?e.message:'Unable to check membership')}
  finally{setBusy(false)}
 }
 const selected=events.find(e=>e.id===fixtureId)
 return <Section eyebrow="GATE MODE" title="Membership entry" copy="Choose the club fixture and scan with a connected QR scanner, or enter a PlayFooty credential. No personal information is stored in the QR code.">
  {error?<ErrorBox text={error}/>:null}
  {loading?<ActivityIndicator color={palette.blue}/>:events.length?(
   <>
    <Text style={s.sectionLabel}>TODAY&apos;S EVENT</Text>
    <View style={s.choiceWrap}>
     {events.map(event=><Pressable key={event.id} onPress={()=>{setFixtureId(event.id);setResult(null)}} style={[s.choice,event.id===fixtureId&&s.choiceActive]}>
      <Text style={[s.choiceTitle,event.id===fixtureId&&s.choiceTitleActive]}>{event.homeName} v {event.awayName}</Text>
      <Text style={s.choiceMeta}>{event.round||event.grade} · {event.matchDate?new Date(event.matchDate).toLocaleString('en-AU',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}):'Time TBC'}</Text>
     </Pressable>)}
    </View>
    <View style={s.panel}>
     <QrCode size={30} color={palette.blue}/>
     <Text style={s.panelTitle}>Scan membership</Text>
     <Text style={s.panelCopy}>{selected?\`${selected.admitted} admitted${selected.venue?\` · ${selected.venue}\`:''}\`:'Select an event'}</Text>
     <Field labelText="Credential" value={code} setValue={setCode} placeholder="pfm_…"/>
     <Action text={busy?'CHECKING…':'CHECK ENTRY'} disabled={busy||!code.trim()} onPress={()=>void check()}/>
    </View>
    {result?<View style={[s.result,result.result==='VALID'?s.resultGood:result.result==='DUPLICATE'||result.result==='NO_ENTITLEMENT'?s.resultWarn:s.resultBad]}>
     <Text style={s.resultLabel}>{label(result.result)}</Text>
     <Text style={s.resultTitle}>{result.title}</Text>
     <Text style={s.resultCopy}>{result.message}</Text>
     {result.member?<Text style={s.resultMember}>{result.member.displayName} · {result.member.productName||'Membership'}{result.member.membershipNumber?\` · #${result.member.membershipNumber}\`:''}</Text>:null}
    </View>:null}
   </>
  ):(
   <View style={s.empty}>
    <QrCode size={30} color={palette.blue}/>
    <Text style={s.panelTitle}>No club fixture available</Text>
    <Text style={s.panelCopy}>Gate mode only uses canonical PlayFooty fixtures.</Text>
   </View>
  )}
 </Section>
}
`

fs.writeFileSync(file, source.slice(0,start)+replacement+source.slice(end), 'utf8')
console.log('Fixed MembershipAdvancedScreen Gate syntax.')
