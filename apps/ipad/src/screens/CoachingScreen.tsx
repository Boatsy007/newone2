import { useEffect, useMemo, useState } from 'react'
import {
  CalendarCheck,
  Check,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  RefreshCw,
  PencilRuler,
  Shield,
  Sparkles,
  Target,
  Trophy,
  Users,
} from 'lucide-react-native'
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { apiGet } from '../api'
import { connectedAwayName, connectedHomeName, connectedRoundLabel, loadClubConnections, selectConnectedSheet, sheetMatchesFixture, type CoachContext } from '../connections'
import { palette } from '../theme'
import type { AuthSession, ClubAccount } from '../types'

type Props = { club: ClubAccount; session: AuthSession; onOpenTrainingPlan: (sessionNumber: 1 | 2) => void; onOpenTrainingReport: (sessionNumber: 1 | 2) => void; onOpenAvailability: () => void; onOpenTeamSelection: () => void; onOpenGamePlan: () => void; onOpenMatchDay: () => void; onOpenWhiteboard: () => void }
type Fixture = { id:string; season:string; grade:string; round:number|null; matchDate:string|null; homeClubId:string; homeClubName:string; awayClubId:string; awayClubName:string; venue?:string|null }
type Sheet = { id:string; fixtureId:string|null; season:string; grade:string; roundLabel:string; opponentName:string|null; matchDate:string|null; status:string; players:Array<unknown> }
type AvailabilityPlayer = { status:string|null; reason:string|null }
type Availability = { selectedSheetId:string|null; players:AvailabilityPlayer[] }
type Plan = { id:string; planDate:string; title:string; focus:string|null }

const flow = [
  { key:'plan-one', eyebrow:'SESSION 1', title:'Training Plan', copy:'Build the first session for the week.', icon:ClipboardList },
  { key:'report-one', eyebrow:'SESSION 1', title:'Training Report', copy:'Record attendance and session outcomes.', icon:ClipboardCheck },
  { key:'availability', eyebrow:'PLAYERS', title:'Availability', copy:'Review responses before selection.', icon:Users },
  { key:'plan-two', eyebrow:'SESSION 2', title:'Training Plan', copy:'Prepare the final session before match day.', icon:ClipboardList },
  { key:'report-two', eyebrow:'SESSION 2', title:'Training Report', copy:'Close the week with the final report.', icon:ClipboardCheck },
  { key:'selection', eyebrow:'MATCH', title:'Team Selection', copy:'Select and publish the side.', icon:Trophy },
  { key:'game-plan', eyebrow:'PREPARE', title:'Game Plan', copy:'Set priorities, opposition notes and match-day instructions.', icon:Shield },
  { key:'match-day', eyebrow:'GAME DAY', title:'Match Day', copy:'Open the live match workspace.', icon:Target },
] as const

function dateLabel(value:string|null|undefined) {
  if (!value) return 'Date to be confirmed'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date to be confirmed' : date.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'})
}

export function CoachingScreen({ club, session, onOpenTrainingPlan, onOpenTrainingReport, onOpenAvailability, onOpenTeamSelection, onOpenGamePlan, onOpenMatchDay, onOpenWhiteboard }: Props) {
  const [fixtures,setFixtures]=useState<Fixture[]>([])
  const [sheets,setSheets]=useState<Sheet[]>([])
  const [availability,setAvailability]=useState<Availability|null>(null)
  const [plans,setPlans]=useState<Plan[]>([])
  const [canonical,setCanonical]=useState<CoachContext|null>(null)
  const [grade,setGrade]=useState('')
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const token=session.access_token

  function load() {
    setLoading(true);setError('')
    Promise.all([
      loadClubConnections(club.clubId,token),
      apiGet<{data?:Fixture[]}>(`/fixtures/club/${encodeURIComponent(club.clubId)}?upcoming=true`).catch(()=>({data:[]})),
      apiGet<{data?:Sheet[]}>(`/club-portal/team-sheets/clubs/${encodeURIComponent(club.clubId)}/sheets`,token),
      apiGet<{data?:Availability}>(`/club-portal/availability/clubs/${encodeURIComponent(club.clubId)}/overview`,token).catch(()=>({data:undefined})),
      apiGet<{data?:{plans?:Plan[]}}>(`/club-portal/training-plans/clubs/${encodeURIComponent(club.clubId)}`,token).catch(()=>({data:undefined})),
    ]).then(([connections,fixturePayload,sheetPayload,availabilityPayload,planPayload])=>{
      const nextFixtures=(connections.fixtures.length?connections.fixtures:Array.isArray(fixturePayload.data)?fixturePayload.data:[]) as Fixture[]
      const nextSheets=(connections.sheets.length?connections.sheets:Array.isArray(sheetPayload.data)?sheetPayload.data:[]) as Sheet[]
      setCanonical(connections.context)
      setFixtures(nextFixtures);setSheets(nextSheets);setAvailability(availabilityPayload.data??null);setPlans(planPayload.data?.plans??[])
      const grades=[...new Set([...nextFixtures.map(item=>item.grade),...nextSheets.map(item=>item.grade)].filter(Boolean))]
      setGrade(current=>current&&grades.includes(current)?current:(connections.context?.team?.grade&&grades.includes(connections.context.team.grade)?connections.context.team.grade:(grades[0]??'')))
    }).catch(reason=>setError(reason instanceof Error?reason.message:'Unable to open Coaching')).finally(()=>setLoading(false))
  }
  useEffect(load,[club.clubId,token])

  const grades=useMemo(()=>[...new Set([...fixtures.map(item=>item.grade),...sheets.map(item=>item.grade)].filter(Boolean))],[fixtures,sheets])
  const canonicalGrade=canonical?.team?.grade
  const fixture=(canonical?.fixture&&(!grade||!canonicalGrade||grade===canonicalGrade)?canonical.fixture as unknown as Fixture:null)??fixtures.find(item=>(!grade||item.grade===grade)&&sheets.some(sheet=>sheetMatchesFixture(sheet as never,item as never)))??fixtures.find(item=>!grade||item.grade===grade)??fixtures[0]??null
  const sheet=selectConnectedSheet(canonical,sheets as never[],fixture as never) as unknown as Sheet|null
  const opponent=fixture?(fixture.homeClubId===club.clubId?(fixture.awayClubName??connectedAwayName(fixture as never)):(fixture.homeClubName??connectedHomeName(fixture as never))):(sheet?.opponentName??'Opponent to be confirmed')
  const counts=useMemo(()=>{
    const players=availability?.players??[]
    return {available:players.filter(row=>row.status==='AVAILABLE').length,unavailable:players.filter(row=>row.status==='UNAVAILABLE').length,test:players.filter(row=>row.status==='TEST'||row.status==='UNSURE'||row.status==='UNLIKELY').length,pending:players.filter(row=>!row.status).length,total:players.length}
  },[availability])
  const planReady=plans.some(plan=>{const time=new Date(plan.planDate).getTime();return Number.isFinite(time)&&time>=Date.now()-6*86400000})
  const selectionReady=Boolean(sheet?.players.length)
  const responseReady=counts.total>0&&counts.pending===0
  const completed=[planReady,responseReady,selectionReady].filter(Boolean).length
  const status=(key:string)=>key==='plan-one'||key==='plan-two'?planReady:key==='availability'?responseReady:key==='selection'?selectionReady:false

  return <View style={styles.page}>
    <View style={styles.topbar}><View><Text style={styles.title}>Coaching</Text><Text style={styles.subtitle}>Plan the week, select the side and run match day.</Text></View><View style={styles.gradePicker}>{grades.length?grades.map(item=><Pressable key={item} onPress={()=>setGrade(item)} style={[styles.gradeChip,grade===item&&styles.gradeChipActive]}><Text numberOfLines={1} style={[styles.gradeText,grade===item&&styles.gradeTextActive]}>{item}</Text></Pressable>):<Text style={styles.noGrade}>No grade connected</Text>}</View><Pressable onPress={load} style={styles.refresh}><RefreshCw size={18} color={palette.ink}/></Pressable></View>
    {loading?<View style={styles.state}><ActivityIndicator size="large" color={palette.blue}/><Text>Opening coaching workspace…</Text></View>:error?<View style={styles.state}><Shield size={35} color={palette.red}/><Text style={styles.errorTitle}>Coaching unavailable</Text><Text style={styles.stateCopy}>{error}</Text><Pressable onPress={load} style={styles.retry}><Text>Try again</Text></Pressable></View>:<ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.heroRow}>
        <View style={styles.matchCard}><View style={styles.cardHeading}><View><Text style={styles.eyebrow}>NEXT MATCH</Text><Text style={styles.matchTitle}>{connectedRoundLabel(fixture as never,sheet as never)}</Text></View><Text style={styles.matchDate}>{dateLabel(fixture?.matchDate??sheet?.matchDate)}</Text></View><View style={styles.teams}><Team logo={club.logoUrl} name={club.clubName}/><View style={styles.versus}><Text style={styles.versusText}>VS</Text><Text numberOfLines={1} style={styles.venue}>{fixture?.venue??'Venue TBC'}</Text></View><Team name={opponent}/></View></View>
        <View style={styles.readiness}><View style={styles.cardHeading}><View><Text style={styles.eyebrow}>CURRENT WEEK</Text><Text style={styles.panelTitle}>Week readiness</Text></View><Sparkles size={19} color={palette.blue}/></View><View style={styles.readinessBody}><View style={styles.ring}><Svg width={104} height={104}><Circle cx={52} cy={52} r={41} stroke="#E9EDF3" strokeWidth={9} fill="none"/><Circle cx={52} cy={52} r={41} stroke={palette.blue} strokeWidth={9} fill="none" strokeLinecap="round" strokeDasharray={`${completed/3*258} 258`} rotation="-90" origin="52,52"/></Svg><View style={styles.ringCopy}><Text style={styles.ringNumber}>{completed}/3</Text><Text style={styles.ringLabel}>READY</Text></View></View><View style={styles.checks}><ReadyLine label="Training plan" ready={planReady}/><ReadyLine label="Availability" ready={responseReady}/><ReadyLine label="Selected side" ready={selectionReady}/></View></View></View>
      </View>
      <View style={styles.stats}><Stat icon={Users} label="Available" value={counts.total?String(counts.available):'—'} tone={palette.green}/><Stat icon={Clock3} label="Awaiting response" value={counts.total?String(counts.pending):'—'} tone={palette.orange}/><Stat icon={Shield} label="Unavailable" value={counts.total?String(counts.unavailable):'—'} tone={palette.red}/><Stat icon={CalendarCheck} label="Test / unsure" value={counts.total?String(counts.test):'—'} tone={palette.purple}/></View>
      <View style={styles.sectionHead}><View><Text style={styles.eyebrow}>COACHING OPERATIONS</Text><Text style={styles.sectionTitle}>Weekly workflow</Text></View><Text style={styles.sectionNote}>Open each step in order as the week progresses.</Text></View>
      <View style={styles.workflow}>{flow.map((item,index)=>{const Icon=item.icon;const ready=status(item.key);const training=item.key==='plan-one'||item.key==='plan-two',report=item.key==='report-one'||item.key==='report-two';const action=training?()=>onOpenTrainingPlan(item.key==='plan-one'?1:2):report?()=>onOpenTrainingReport(item.key==='report-one'?1:2):item.key==='availability'?onOpenAvailability:item.key==='selection'?onOpenTeamSelection:item.key==='game-plan'?onOpenGamePlan:item.key==='match-day'?onOpenMatchDay:undefined;return <Pressable key={`${item.key}-${index}`} onPress={action} style={[styles.flowCard,ready&&styles.flowReady]}><View style={[styles.flowIcon,ready&&styles.flowIconReady]}>{ready?<Check size={19} color="#fff"/>:<Icon size={20} color={palette.blue}/>}</View><View style={styles.flowCopy}><Text style={styles.flowEyebrow}>{item.eyebrow}</Text><Text style={styles.flowTitle}>{item.title}</Text><Text style={styles.flowDescription}>{ready?'Complete · '+item.copy:item.copy}</Text></View><ChevronRight size={18} color={palette.muted}/></Pressable>})}</View>
      <View style={styles.sectionHead}><View><Text style={styles.eyebrow}>COACHING TOOLS</Text><Text style={styles.sectionTitle}>Tools</Text></View><Text style={styles.sectionNote}>Open a full-screen coaching workspace.</Text></View>
      <Pressable onPress={onOpenWhiteboard} style={styles.toolCard}><View style={styles.toolCardIcon}><PencilRuler size={23} color="#fff"/></View><View style={styles.flowCopy}><Text style={styles.flowEyebrow}>TACTICS & PRESENTATION</Text><Text style={styles.toolCardTitle}>Whiteboard</Text><Text style={styles.flowDescription}>Move players, draw structures, save tactics and open the same board from Match Day.</Text></View><ChevronRight size={20} color={palette.muted}/></Pressable>
    </ScrollView>}
  </View>
}

function Team({logo,name}:{logo?:string|null;name:string}){return <View style={styles.team}>{logo?<Image source={{uri:logo}} style={styles.teamLogo} resizeMode="contain"/>:<View style={styles.teamFallback}><Text style={styles.teamFallbackText}>{name.slice(0,1)}</Text></View>}<Text numberOfLines={2} style={styles.teamName}>{name}</Text></View>}
function ReadyLine({label,ready}:{label:string;ready:boolean}){return <View style={styles.readyLine}><View style={[styles.readyDot,ready&&styles.readyDotDone]}>{ready&&<Check size={10} color="#fff"/>}</View><Text style={styles.readyLabel}>{label}</Text><Text style={ready?styles.done:styles.waiting}>{ready?'Ready':'Pending'}</Text></View>}
function Stat({icon:Icon,label,value,tone}:{icon:typeof Users;label:string;value:string;tone:string}){return <View style={styles.stat}><View style={[styles.statIcon,{backgroundColor:`${tone}16`}]}><Icon size={18} color={tone}/></View><View><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View></View>}

const styles=StyleSheet.create({
  toolCard:{height:88,borderWidth:1,borderColor:palette.border,borderRadius:13,backgroundColor:palette.surface,padding:13,flexDirection:'row',alignItems:'center',gap:12},
  toolCardIcon:{width:48,height:48,borderRadius:13,backgroundColor:palette.blue,alignItems:'center',justifyContent:'center'},
  toolCardTitle:{fontSize:17,fontWeight:'900',color:palette.ink,marginTop:3},
  page:{flex:1,backgroundColor:palette.canvas},topbar:{height:90,paddingHorizontal:22,backgroundColor:palette.surface,borderBottomWidth:1,borderBottomColor:palette.border,flexDirection:'row',alignItems:'center',gap:18},title:{fontSize:23,fontWeight:'900',color:palette.ink},subtitle:{fontSize:11,color:palette.muted,marginTop:3},gradePicker:{flex:1,flexDirection:'row',justifyContent:'flex-end',gap:7},gradeChip:{maxWidth:160,height:34,borderWidth:1,borderColor:palette.border,borderRadius:9,paddingHorizontal:11,justifyContent:'center',backgroundColor:palette.surface},gradeChipActive:{backgroundColor:palette.blue,borderColor:palette.blue},gradeText:{fontSize:10,fontWeight:'800',color:palette.ink},gradeTextActive:{color:'#fff'},noGrade:{fontSize:11,color:palette.muted},refresh:{width:38,height:38,borderWidth:1,borderColor:palette.border,borderRadius:10,alignItems:'center',justifyContent:'center'},content:{padding:18,gap:14},state:{flex:1,alignItems:'center',justifyContent:'center',gap:10},stateCopy:{fontSize:12,color:palette.muted,maxWidth:400,textAlign:'center'},errorTitle:{fontSize:22,fontWeight:'900',color:palette.ink},retry:{marginTop:4,backgroundColor:palette.blueSoft,paddingHorizontal:16,paddingVertical:10,borderRadius:9},heroRow:{flexDirection:'row',gap:14},matchCard:{flex:1,height:214,borderWidth:1,borderColor:palette.border,borderRadius:14,backgroundColor:palette.surface,padding:17},readiness:{width:340,height:214,borderWidth:1,borderColor:palette.border,borderRadius:14,backgroundColor:palette.surface,padding:17},cardHeading:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between'},eyebrow:{fontSize:8,fontWeight:'900',letterSpacing:1.2,color:palette.blue},matchTitle:{fontSize:21,fontWeight:'900',color:palette.ink,marginTop:4},matchDate:{fontSize:11,fontWeight:'800',color:palette.muted},teams:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:23},team:{width:150,alignItems:'center',gap:6},teamLogo:{width:65,height:65},teamFallback:{width:65,height:65,borderRadius:18,backgroundColor:palette.blueSoft,alignItems:'center',justifyContent:'center'},teamFallbackText:{fontSize:28,fontWeight:'900',color:palette.blue},teamName:{fontSize:11,fontWeight:'800',color:palette.ink,textAlign:'center'},versus:{alignItems:'center',gap:5},versusText:{fontSize:17,fontWeight:'900',color:palette.ink},venue:{fontSize:8,color:palette.muted,maxWidth:90,textAlign:'center'},panelTitle:{fontSize:16,fontWeight:'900',color:palette.ink,marginTop:4},readinessBody:{flex:1,flexDirection:'row',alignItems:'center'},ring:{width:112,height:112,alignItems:'center',justifyContent:'center'},ringCopy:{position:'absolute',alignItems:'center'},ringNumber:{fontSize:19,fontWeight:'900',color:palette.blue},ringLabel:{fontSize:7,fontWeight:'900',color:palette.muted,marginTop:1},checks:{flex:1,gap:12},readyLine:{flexDirection:'row',alignItems:'center',gap:7},readyDot:{width:17,height:17,borderRadius:9,borderWidth:1,borderColor:palette.border,alignItems:'center',justifyContent:'center'},readyDotDone:{backgroundColor:palette.green,borderColor:palette.green},readyLabel:{fontSize:10,color:palette.ink,flex:1},done:{fontSize:8,fontWeight:'800',color:palette.green},waiting:{fontSize:8,fontWeight:'800',color:palette.muted},stats:{flexDirection:'row',gap:11},stat:{flex:1,height:76,borderWidth:1,borderColor:palette.border,borderRadius:12,backgroundColor:palette.surface,padding:13,flexDirection:'row',alignItems:'center',gap:10},statIcon:{width:36,height:36,borderRadius:10,alignItems:'center',justifyContent:'center'},statLabel:{fontSize:9,fontWeight:'800',color:palette.muted,textTransform:'uppercase'},statValue:{fontSize:21,fontWeight:'900',color:palette.ink,marginTop:2},sectionHead:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',marginTop:4},sectionTitle:{fontSize:21,fontWeight:'900',color:palette.ink,marginTop:4},sectionNote:{fontSize:10,color:palette.muted},workflow:{flexDirection:'row',flexWrap:'wrap',gap:11},flowCard:{width:'32%',minWidth:235,height:104,borderWidth:1,borderColor:palette.border,borderRadius:13,backgroundColor:palette.surface,padding:13,flexDirection:'row',alignItems:'center',gap:11},flowReady:{borderColor:'#BCE8D4',backgroundColor:'#FBFFFD'},flowIcon:{width:39,height:39,borderRadius:11,backgroundColor:palette.blueSoft,alignItems:'center',justifyContent:'center'},flowIconReady:{backgroundColor:palette.green},flowCopy:{flex:1},flowEyebrow:{fontSize:7,fontWeight:'900',letterSpacing:.9,color:palette.blue},flowTitle:{fontSize:14,fontWeight:'900',color:palette.ink,marginTop:3},flowDescription:{fontSize:9,color:palette.muted,lineHeight:13,marginTop:3},
})
