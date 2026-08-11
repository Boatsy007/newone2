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
type Fixture = { id:string; season:string; grade:string; round:number|null; matchDate:string|null; homeClubId:string; homeClubName:string; awayClubId:string; awayClubName:string; venue?:string|null; homeClubLogoUrl?:string|null; awayClubLogoUrl?:string|null; homeLogoUrl?:string|null; awayLogoUrl?:string|null; homeLogo?:string|null; awayLogo?:string|null }
type Sheet = { id:string; fixtureId:string|null; season:string; grade:string; roundLabel:string; opponentName:string|null; matchDate:string|null; status:string; players:Array<unknown> }
type AvailabilityPlayer = { status:string|null; reason:string|null }
type Availability = { selectedSheetId:string|null; players:AvailabilityPlayer[] }
type Plan = { id:string; planDate:string; title:string; focus:string|null; status?:string|null; publishedAt?:string|null; sessionNumber?:number|null }
type ReportSession = { id:string; sessionDate:string; reportCompletedAt:string|null; status?:string|null; publishedAt?:string|null }
type OppositionPlan = { status?:string|null; publishedAt?:string|null; overview?:string|null; teamInstructions?:string|null; stoppagePlan?:string|null; kickInPlan?:string|null; quarterTimeReminders?:string|null }
type ClubProfile = { logoUrl?:string|null }

const flow = [
  { key:'plan-one', eyebrow:'SESSION 1', title:'Training Plan', copy:'Build the first session for the week.', icon:ClipboardList },
  { key:'report-one', eyebrow:'SESSION 1', title:'Training Report', copy:'Record attendance and session outcomes.', icon:ClipboardCheck },
  { key:'availability', eyebrow:'PLAYERS', title:'Availability', copy:'Review responses before selection.', icon:Users },
  { key:'plan-two', eyebrow:'SESSION 2', title:'Training Plan', copy:'Prepare the final session before match day.', icon:ClipboardList },
  { key:'report-two', eyebrow:'SESSION 2', title:'Training Report', copy:'Close the week with the final report.', icon:ClipboardCheck },
  { key:'selection', eyebrow:'MATCH', title:'Team Selection', copy:'Select and publish the side.', icon:Trophy },
  { key:'game-plan', eyebrow:'PREPARE', title:'Game Plan', copy:'Set priorities, opposition notes and match-day instructions.', icon:Shield },
] as const

function dateLabel(value:string|null|undefined) {
  if (!value) return 'Date to be confirmed'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date to be confirmed' : date.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'})
}

function isPublished(value:{status?:string|null;publishedAt?:string|null}|null|undefined){
  return value?.status?.toUpperCase()==='PUBLISHED'||Boolean(value?.publishedAt)
}

function cleanTeamName(name:string,competition:string){
  const trimmed=name.trim(),grade=competition.trim()
  if(!grade)return trimmed
  const lowerName=trimmed.toLowerCase(),lowerGrade=grade.toLowerCase()
  if(lowerName.endsWith(lowerGrade))return trimmed.slice(0,trimmed.length-grade.length).replace(/[\s·\-–—]+$/,'').trim()||trimmed
  return trimmed
}

export function CoachingScreen({ club, session, onOpenTrainingPlan, onOpenTrainingReport, onOpenAvailability, onOpenTeamSelection, onOpenGamePlan, onOpenMatchDay, onOpenWhiteboard }: Props) {
  const [fixtures,setFixtures]=useState<Fixture[]>([])
  const [sheets,setSheets]=useState<Sheet[]>([])
  const [availability,setAvailability]=useState<Availability|null>(null)
  const [plans,setPlans]=useState<Plan[]>([])
  const [reportSessions,setReportSessions]=useState<ReportSession[]>([])
  const [oppositionPlan,setOppositionPlan]=useState<OppositionPlan|null>(null)
  const [opponentClubLogo,setOpponentClubLogo]=useState<string|null>(null)
  const [canonical,setCanonical]=useState<CoachContext|null>(null)
  const [grade,setGrade]=useState('')
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const token=session.access_token

  function load() {
    setLoading(true);setError('')
    loadClubConnections(club.clubId,token).then(connections=>{
      const nextFixtures=connections.fixtures as Fixture[]
      const nextSheets=connections.sheets as Sheet[]
      setCanonical(connections.context)
      setFixtures(nextFixtures);setSheets(nextSheets)
      const grades=[...new Set([...nextFixtures.map(item=>item.grade),...nextSheets.map(item=>item.grade)].filter(Boolean))]
      setGrade(current=>current&&grades.includes(current)?current:(connections.context?.team?.grade&&grades.includes(connections.context.team.grade)?connections.context.team.grade:(grades[0]??'')))
      setLoading(false)
      void apiGet<{data?:Availability}>(`/club-portal/availability/clubs/${encodeURIComponent(club.clubId)}/overview`,token,6500).then(payload=>setAvailability(payload.data??null)).catch(()=>setAvailability(null))
      void apiGet<{data?:{plans?:Plan[]}}>(`/club-portal/training-plans/clubs/${encodeURIComponent(club.clubId)}`,token,6500).then(payload=>setPlans(payload.data?.plans??[])).catch(()=>setPlans([]))
      void apiGet<{data?:{sessions?:ReportSession[]}}>(`/club-portal/training-attendance/clubs/${encodeURIComponent(club.clubId)}`,token,6500).then(payload=>setReportSessions(payload.data?.sessions??[])).catch(()=>setReportSessions([]))
    }).catch(reason=>setError(reason instanceof Error?reason.message:'Unable to open Coaching')).finally(()=>setLoading(false))
  }
  useEffect(load,[club.clubId,token])

  const grades=useMemo(()=>[...new Set([...fixtures.map(item=>item.grade),...sheets.map(item=>item.grade)].filter(Boolean))],[fixtures,sheets])
  const canonicalGrade=canonical?.team?.grade
  const fixture=(canonical?.fixture&&(!grade||!canonicalGrade||grade===canonicalGrade)?canonical.fixture as unknown as Fixture:null)??fixtures.find(item=>(!grade||item.grade===grade)&&sheets.some(sheet=>sheetMatchesFixture(sheet as never,item as never)))??fixtures.find(item=>!grade||item.grade===grade)??fixtures[0]??null
  const sheet=selectConnectedSheet(canonical,sheets as never[],fixture as never) as unknown as Sheet|null
  const opponent=fixture?(fixture.homeClubId===club.clubId?(fixture.awayClubName??connectedAwayName(fixture as never)):(fixture.homeClubName??connectedHomeName(fixture as never))):(sheet?.opponentName??'Opponent to be confirmed')
  const opponentClubId=fixture?(fixture.homeClubId===club.clubId?fixture.awayClubId:fixture.homeClubId):null
  const fixtureOpponentLogo=fixture?(fixture.homeClubId===club.clubId?(fixture.awayClubLogoUrl??fixture.awayLogoUrl??fixture.awayLogo??null):(fixture.homeClubLogoUrl??fixture.homeLogoUrl??fixture.homeLogo??null)):null
  const opponentLogo=fixtureOpponentLogo??opponentClubLogo
  const competition=grade||fixture?.grade||sheet?.grade||''

  useEffect(()=>{
    setOpponentClubLogo(null)
    if(!opponentClubId||opponentClubId===club.clubId)return
    apiGet<{data?:ClubProfile}>(`/clubs/${encodeURIComponent(opponentClubId)}`,undefined,6500).then(payload=>setOpponentClubLogo(payload.data?.logoUrl??null)).catch(()=>setOpponentClubLogo(null))
  },[club.clubId,opponentClubId])

  useEffect(()=>{
    if(!sheet?.id){setOppositionPlan(null);return}
    apiGet<{data?:{plan?:OppositionPlan|null}}>(`/club-portal/opposition/clubs/${encodeURIComponent(club.clubId)}/sheets/${encodeURIComponent(sheet.id)}`,token,6500).then(payload=>setOppositionPlan(payload.data?.plan??null)).catch(()=>setOppositionPlan(null))
  },[club.clubId,sheet?.id,token])

  const counts=useMemo(()=>{
    const players=availability?.players??[]
    return {available:players.filter(row=>row.status==='AVAILABLE').length,unavailable:players.filter(row=>row.status==='UNAVAILABLE').length,test:players.filter(row=>row.status==='TEST'||row.status==='UNSURE'||row.status==='UNLIKELY').length,pending:players.filter(row=>!row.status).length,total:players.length}
  },[availability])

  const weeklyPlans=useMemo(()=>[...plans].filter(plan=>{const time=new Date(plan.planDate).getTime();return Number.isFinite(time)&&time>=Date.now()-8*86400000&&time<=Date.now()+8*86400000}).sort((a,b)=>a.planDate.localeCompare(b.planDate)).slice(0,2),[plans])
  const planOne=weeklyPlans.find(item=>item.sessionNumber===1)??weeklyPlans[0]??null
  const planTwo=weeklyPlans.find(item=>item.sessionNumber===2)??weeklyPlans[1]??null
  const reportFor=(plan:Plan|null)=>plan?reportSessions.find(item=>item.sessionDate===plan.planDate)??null:null
  const planOneReady=isPublished(planOne),planTwoReady=isPublished(planTwo)
  const reportOneReady=Boolean(reportFor(planOne)?.reportCompletedAt)||isPublished(reportFor(planOne))
  const reportTwoReady=Boolean(reportFor(planTwo)?.reportCompletedAt)||isPublished(reportFor(planTwo))
  const availabilityReady=counts.total>0&&counts.pending===0
  const selectionReady=sheet?.status?.toUpperCase()==='PUBLISHED'
  const gamePlanReady=isPublished(oppositionPlan)
  const readiness=[
    {label:'Training Plan 1',ready:planOneReady},
    {label:'Training Report 1',ready:reportOneReady},
    {label:'Availability',ready:availabilityReady},
    {label:'Training Plan 2',ready:planTwoReady},
    {label:'Training Report 2',ready:reportTwoReady},
    {label:'Team Selection',ready:selectionReady},
    {label:'Game Plan',ready:gamePlanReady},
  ]
  const completed=readiness.filter(item=>item.ready).length
  const status=(key:string)=>key==='plan-one'?planOneReady:key==='report-one'?reportOneReady:key==='availability'?availabilityReady:key==='plan-two'?planTwoReady:key==='report-two'?reportTwoReady:key==='selection'?selectionReady:key==='game-plan'?gamePlanReady:false

  return <View style={styles.page}>
    <View style={styles.topbar}><View><Text style={styles.title}>Coaching</Text><Text style={styles.subtitle}>Plan the week, select the side and run match day.</Text></View><View style={styles.gradePicker}>{grades.length?grades.map(item=><Pressable key={item} onPress={()=>setGrade(item)} style={[styles.gradeChip,grade===item&&styles.gradeChipActive]}><Text numberOfLines={1} style={[styles.gradeText,grade===item&&styles.gradeTextActive]}>{item}</Text></Pressable>):<Text style={styles.noGrade}>No grade connected</Text>}</View><Pressable onPress={load} style={styles.refresh}><RefreshCw size={18} color={palette.ink}/></Pressable></View>
    {loading?<View style={styles.state}><ActivityIndicator size="large" color={palette.blue}/><Text>Opening coaching workspace…</Text></View>:error?<View style={styles.state}><Shield size={35} color={palette.red}/><Text style={styles.errorTitle}>Coaching unavailable</Text><Text style={styles.stateCopy}>{error}</Text><Pressable onPress={load} style={styles.retry}><Text>Try again</Text></Pressable></View>:<ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.heroRow}>
        <View style={styles.matchCard}><View style={styles.cardHeading}><View><Text style={styles.eyebrow}>NEXT MATCH</Text><Text style={styles.matchTitle}>{connectedRoundLabel(fixture as never,sheet as never)}</Text></View><Text style={styles.matchDate}>{dateLabel(fixture?.matchDate??sheet?.matchDate)}</Text></View><View style={styles.teams}><Team logo={club.logoUrl} name={club.clubName} competition={competition}/><View style={styles.versus}><Text style={styles.versusText}>VS</Text><Text numberOfLines={1} style={styles.venue}>{fixture?.venue??'Venue TBC'}</Text></View><Team logo={opponentLogo} name={opponent} competition={competition}/></View></View>
        <View style={styles.readiness}><View style={styles.cardHeading}><View><Text style={styles.eyebrow}>CURRENT WEEK</Text><Text style={styles.panelTitle}>Week readiness</Text></View><Sparkles size={19} color={palette.blue}/></View><View style={styles.readinessBody}><View style={styles.ring}><Svg width={96} height={96}><Circle cx={48} cy={48} r={38} stroke="#E9EDF3" strokeWidth={8} fill="none"/><Circle cx={48} cy={48} r={38} stroke={palette.blue} strokeWidth={8} fill="none" strokeLinecap="round" strokeDasharray={`${completed/7*239} 239`} rotation="-90" origin="48,48"/></Svg><View style={styles.ringCopy}><Text style={styles.ringNumber}>{completed}/7</Text><Text style={styles.ringLabel}>READY</Text></View></View><View style={styles.checks}>{readiness.map(item=><ReadyLine key={item.label} label={item.label} ready={item.ready}/>)}</View></View></View>
      </View>
      <View style={styles.stats}><Stat icon={Users} label="Available" value={counts.total?String(counts.available):'—'} tone={palette.green}/><Stat icon={Clock3} label="Awaiting response" value={counts.total?String(counts.pending):'—'} tone={palette.orange}/><Stat icon={Shield} label="Unavailable" value={counts.total?String(counts.unavailable):'—'} tone={palette.red}/><Stat icon={CalendarCheck} label="Test / unsure" value={counts.total?String(counts.test):'—'} tone={palette.purple}/></View>
      <View style={styles.sectionHead}><View><Text style={styles.eyebrow}>COACHING OPERATIONS</Text><Text style={styles.sectionTitle}>Weekly workflow</Text></View><Text style={styles.sectionNote}>Open each step in order as the week progresses.</Text></View>
      <View style={styles.workflow}>{flow.map((item,index)=>{const Icon=item.icon;const ready=status(item.key);const training=item.key==='plan-one'||item.key==='plan-two',report=item.key==='report-one'||item.key==='report-two';const action=training?()=>onOpenTrainingPlan(item.key==='plan-one'?1:2):report?()=>onOpenTrainingReport(item.key==='report-one'?1:2):item.key==='availability'?onOpenAvailability:item.key==='selection'?onOpenTeamSelection:item.key==='game-plan'?onOpenGamePlan:undefined;return <Pressable key={`${item.key}-${index}`} onPress={action} style={[styles.flowCard,ready&&styles.flowReady]}><View style={[styles.flowIcon,ready&&styles.flowIconReady]}>{ready?<Check size={19} color="#fff"/>:<Icon size={20} color={palette.blue}/>}</View><View style={styles.flowCopy}><Text style={styles.flowEyebrow}>{item.eyebrow}</Text><Text style={styles.flowTitle}>{item.title}</Text><Text style={styles.flowDescription}>{ready?'Published · '+item.copy:item.copy}</Text></View><ChevronRight size={18} color={palette.muted}/></Pressable>})}</View>
      <View style={styles.sectionHead}><View><Text style={styles.eyebrow}>COACHING TOOLS</Text><Text style={styles.sectionTitle}>Tools</Text></View><Text style={styles.sectionNote}>Open a full-screen coaching workspace.</Text></View>
      <View style={styles.toolsRow}><Pressable onPress={onOpenMatchDay} style={styles.toolCard}><View style={styles.toolCardIcon}><Target size={23} color="#fff"/></View><View style={styles.flowCopy}><Text style={styles.flowEyebrow}>GAME DAY</Text><Text style={styles.toolCardTitle}>Match Day</Text><Text style={styles.flowDescription}>Open the live match workspace. Match Day is separate from the 7-step readiness total.</Text></View><ChevronRight size={20} color={palette.muted}/></Pressable><Pressable onPress={onOpenWhiteboard} style={styles.toolCard}><View style={styles.toolCardIcon}><PencilRuler size={23} color="#fff"/></View><View style={styles.flowCopy}><Text style={styles.flowEyebrow}>TACTICS & PRESENTATION</Text><Text style={styles.toolCardTitle}>Whiteboard</Text><Text style={styles.flowDescription}>Move players, draw structures, save tactics and open the same board from Match Day.</Text></View><ChevronRight size={20} color={palette.muted}/></Pressable></View>
    </ScrollView>}
  </View>
}

function Team({logo,name,competition}:{logo?:string|null;name:string;competition:string}){const teamName=cleanTeamName(name,competition);return <View style={styles.team}>{logo?<Image source={{uri:logo}} style={styles.teamLogo} resizeMode="contain"/>:<View style={styles.teamFallback}><Text style={styles.teamFallbackText}>{teamName.slice(0,1)}</Text></View>}<Text numberOfLines={2} style={styles.teamName}>{teamName}</Text>{competition?<Text numberOfLines={1} style={styles.teamCompetition}>{competition}</Text>:null}</View>}
function ReadyLine({label,ready}:{label:string;ready:boolean}){return <View style={styles.readyLine}><View style={[styles.readyDot,ready&&styles.readyDotDone]}>{ready&&<Check size={9} color="#fff"/>}</View><Text numberOfLines={1} style={styles.readyLabel}>{label}</Text><Text style={ready?styles.done:styles.waiting}>{ready?'Ready':'Pending'}</Text></View>}
function Stat({icon:Icon,label,value,tone}:{icon:typeof Users;label:string;value:string;tone:string}){return <View style={styles.stat}><View style={[styles.statIcon,{backgroundColor:`${tone}16`}]}><Icon size={18} color={tone}/></View><View><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View></View>}

const styles=StyleSheet.create({
  toolsRow:{flexDirection:'row',gap:11},toolCard:{flex:1,height:88,borderWidth:1,borderColor:palette.border,borderRadius:13,backgroundColor:palette.surface,padding:13,flexDirection:'row',alignItems:'center',gap:12},
  toolCardIcon:{width:48,height:48,borderRadius:13,backgroundColor:palette.blue,alignItems:'center',justifyContent:'center'},
  toolCardTitle:{fontSize:17,fontWeight:'900',color:palette.ink,marginTop:3},
  page:{flex:1,backgroundColor:palette.canvas},topbar:{height:90,paddingHorizontal:22,backgroundColor:palette.surface,borderBottomWidth:1,borderBottomColor:palette.border,flexDirection:'row',alignItems:'center',gap:18},title:{fontSize:23,fontWeight:'900',color:palette.ink},subtitle:{fontSize:11,color:palette.muted,marginTop:3},gradePicker:{flex:1,flexDirection:'row',justifyContent:'flex-end',gap:7},gradeChip:{maxWidth:160,height:34,borderWidth:1,borderColor:palette.border,borderRadius:9,paddingHorizontal:11,justifyContent:'center',backgroundColor:palette.surface},gradeChipActive:{backgroundColor:palette.blue,borderColor:palette.blue},gradeText:{fontSize:10,fontWeight:'800',color:palette.ink},gradeTextActive:{color:'#fff'},noGrade:{fontSize:11,color:palette.muted},refresh:{width:38,height:38,borderWidth:1,borderColor:palette.border,borderRadius:10,alignItems:'center',justifyContent:'center'},content:{padding:18,gap:14},state:{flex:1,alignItems:'center',justifyContent:'center',gap:10},stateCopy:{fontSize:12,color:palette.muted,maxWidth:400,textAlign:'center'},errorTitle:{fontSize:22,fontWeight:'900',color:palette.ink},retry:{marginTop:4,backgroundColor:palette.blueSoft,paddingHorizontal:16,paddingVertical:10,borderRadius:9},heroRow:{flexDirection:'row',gap:14},matchCard:{flex:1,height:214,borderWidth:1,borderColor:palette.border,borderRadius:14,backgroundColor:palette.surface,padding:17},readiness:{width:370,height:214,borderWidth:1,borderColor:palette.border,borderRadius:14,backgroundColor:palette.surface,padding:15},cardHeading:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between'},eyebrow:{fontSize:8,fontWeight:'900',letterSpacing:1.2,color:palette.blue},matchTitle:{fontSize:21,fontWeight:'900',color:palette.ink,marginTop:4},matchDate:{fontSize:11,fontWeight:'800',color:palette.muted},teams:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},team:{width:132,alignItems:'center',gap:4},teamLogo:{width:62,height:62},teamFallback:{width:62,height:62,borderRadius:18,backgroundColor:palette.blueSoft,alignItems:'center',justifyContent:'center'},teamFallbackText:{fontSize:28,fontWeight:'900',color:palette.blue},teamName:{fontSize:11,fontWeight:'800',color:palette.ink,textAlign:'center'},teamCompetition:{fontSize:9,fontWeight:'700',color:palette.muted,textAlign:'center'},versus:{width:82,alignItems:'center',gap:5},versusText:{fontSize:17,fontWeight:'900',color:palette.ink},venue:{fontSize:8,color:palette.muted,maxWidth:82,textAlign:'center'},panelTitle:{fontSize:16,fontWeight:'900',color:palette.ink,marginTop:4},readinessBody:{flex:1,flexDirection:'row',alignItems:'center',gap:5},ring:{width:102,height:102,alignItems:'center',justifyContent:'center'},ringCopy:{position:'absolute',alignItems:'center'},ringNumber:{fontSize:18,fontWeight:'900',color:palette.blue},ringLabel:{fontSize:7,fontWeight:'900',color:palette.muted,marginTop:1},checks:{flex:1,gap:4},readyLine:{height:18,flexDirection:'row',alignItems:'center',gap:6},readyDot:{width:15,height:15,borderRadius:8,borderWidth:1,borderColor:palette.border,alignItems:'center',justifyContent:'center'},readyDotDone:{backgroundColor:palette.green,borderColor:palette.green},readyLabel:{fontSize:9,color:palette.ink,flex:1},done:{fontSize:7,fontWeight:'800',color:palette.green},waiting:{fontSize:7,fontWeight:'800',color:palette.muted},stats:{flexDirection:'row',gap:11},stat:{flex:1,height:76,borderWidth:1,borderColor:palette.border,borderRadius:12,backgroundColor:palette.surface,padding:13,flexDirection:'row',alignItems:'center',gap:10},statIcon:{width:36,height:36,borderRadius:10,alignItems:'center',justifyContent:'center'},statLabel:{fontSize:9,fontWeight:'800',color:palette.muted,textTransform:'uppercase'},statValue:{fontSize:21,fontWeight:'900',color:palette.ink,marginTop:2},sectionHead:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',marginTop:4},sectionTitle:{fontSize:21,fontWeight:'900',color:palette.ink,marginTop:4},sectionNote:{fontSize:10,color:palette.muted},workflow:{flexDirection:'row',flexWrap:'wrap',gap:11},flowCard:{width:'32%',minWidth:235,height:104,borderWidth:1,borderColor:palette.border,borderRadius:13,backgroundColor:palette.surface,padding:13,flexDirection:'row',alignItems:'center',gap:11},flowReady:{borderColor:'#BCE8D4',backgroundColor:'#FBFFFD'},flowIcon:{width:39,height:39,borderRadius:11,backgroundColor:palette.blueSoft,alignItems:'center',justifyContent:'center'},flowIconReady:{backgroundColor:palette.green},flowCopy:{flex:1},flowEyebrow:{fontSize:7,fontWeight:'900',letterSpacing:.9,color:palette.blue},flowTitle:{fontSize:14,fontWeight:'900',color:palette.ink,marginTop:3},flowDescription:{fontSize:9,color:palette.muted,lineHeight:13,marginTop:3},
})