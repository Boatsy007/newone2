import { useEffect, useState } from 'react'
import { Bell, CalendarDays, ChevronRight, CircleDollarSign, Handshake, Search, Trophy, Users } from 'lucide-react-native'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { connectedAwayName, connectedHomeName, connectedPlayerCount, connectedRoundLabel, loadClubConnections, type ClubConnections } from '../connections'
import { palette } from '../theme'
import type { AuthSession, ClubAccount } from '../types'

type Props={club:ClubAccount;session:AuthSession;onSignOut:()=>void}
type SeasonRecord={season:string|null;leagueName:string|null;ladderPosition:number|null;wins:number;losses:number;percentage:number}
type DirectoryClub={clubId:string;wins:number;losses:number;percentage:number}
type DirectoryResponse={season?:string|null;states?:Array<{leagues:Array<{name:string;clubs:DirectoryClub[]}>}>}

export function OverviewScreen({club,session,onSignOut}:Props){
 const[seasonRecord,setSeasonRecord]=useState<SeasonRecord|null>(null)
 const[connections,setConnections]=useState<ClubConnections|null>(null)

 useEffect(()=>{
  let active=true
  fetch('https://www.playfooty.com.au/api/directory',{headers:{accept:'application/json'}})
   .then(async response=>{if(!response.ok)throw new Error('Club season data unavailable');return await response.json() as DirectoryResponse})
   .then(payload=>{
    for(const state of payload.states??[]){for(const league of state.leagues){const index=league.clubs.findIndex(entry=>entry.clubId===club.clubId);if(index>=0){const entry=league.clubs[index]!;if(active)setSeasonRecord({season:payload.season??null,leagueName:league.name,ladderPosition:index+1,wins:entry.wins,losses:entry.losses,percentage:entry.percentage});return}}}
    if(active)setSeasonRecord(null)
   }).catch(()=>{if(active)setSeasonRecord(null)})
  return()=>{active=false}
 },[club.clubId])

 useEffect(()=>{let active=true;loadClubConnections(club.clubId,session.access_token).then(value=>{if(active)setConnections(value)}).catch(()=>{if(active)setConnections(null)});return()=>{active=false}},[club.clubId,session.access_token])

 const fixture=connections?.fixture??null
 const sheet=connections?.teamSheet??null
 const selectedPlayers=connectedPlayerCount(sheet)
 const opponent=fixture?(fixture.homeClubId===club.clubId?connectedAwayName(fixture):connectedHomeName(fixture)):(sheet?.opponentName??'Opponent TBC')
 const fixtureDate=fixture?.matchDate??sheet?.matchDate
 const fixtureDateLabel=fixtureDate?new Date(fixtureDate).toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'}):'Date TBC'
 const round=connectedRoundLabel(fixture,sheet)
 const played=(seasonRecord?.wins??0)+(seasonRecord?.losses??0)
 const winRate=played?Math.round(((seasonRecord?.wins??0)/played)*100):0

 return <View style={s.page}>
  <View style={s.header}>
   <View><Text style={s.headerTitle}>Dashboard</Text><Text style={s.headerSub}>{club.clubName}</Text></View>
   <View style={s.search}><Search size={14} color="#9AA3B2"/><Text style={s.searchText}>Search players, matches, staff, tools...</Text></View>
   <Pressable style={s.iconButton}><Bell size={16} color="#202637"/><View style={s.notification}/></Pressable>
   <Pressable onPress={onSignOut} style={s.avatar}><Text style={s.avatarText}>PF</Text></Pressable>
  </View>

  <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
   <View style={s.kpiRow}>
    <Kpi icon={Users} label="Players" value={selectedPlayers?String(selectedPlayers):'—'} meta="Current selected side" tone="#1787FF"/>
    <Kpi icon={Trophy} label="Wins" value={seasonRecord?String(seasonRecord.wins):'—'} meta={`${winRate}% win rate`} tone="#7C4DFF"/>
    <Kpi icon={Handshake} label="Sponsors" value="—" meta="Connected sponsor data" tone="#20B86A"/>
    <Kpi icon={CircleDollarSign} label="Membership" value="—" meta="Revenue & members" tone="#FF9F2D"/>
   </View>

   <View style={s.gridTop}>
    <View style={s.performanceCard}>
     <View style={s.cardHead}><View><Text style={s.cardEyebrow}>SEASON PERFORMANCE</Text><Text style={s.cardTitle}>Club performance</Text></View><View style={s.seasonPill}><Text style={s.seasonText}>{seasonRecord?.season??'Current'}</Text></View></View>
     <View style={s.performanceBody}>
      <View style={s.scoreRing}><View style={s.scoreRingInner}><Text style={s.scoreBig}>{seasonRecord?.ladderPosition?`#${seasonRecord.ladderPosition}`:'—'}</Text><Text style={s.scoreLabel}>LADDER</Text></View></View>
      <View style={s.performanceStats}>
       <Progress label="Wins" value={seasonRecord?.wins??0} max={Math.max(played,1)} tone="#20B86A"/>
       <Progress label="Losses" value={seasonRecord?.losses??0} max={Math.max(played,1)} tone="#EF5B78"/>
       <Progress label="Percentage" value={Math.round(seasonRecord?.percentage??0)} max={150} tone="#7C4DFF" suffix="%"/>
      </View>
     </View>
    </View>

    <View style={s.matchCard}>
     <View style={s.cardHead}><View><Text style={s.cardEyebrow}>TODAY'S MATCH</Text><Text style={s.cardTitle}>{round}</Text></View><CalendarDays size={17} color={palette.blue}/></View>
     <View style={s.matchBody}>
      <Team logo={club.logoUrl} name={club.clubName}/>
      <View style={s.vsWrap}><Text style={s.vs}>VS</Text><Text style={s.matchDate}>{fixtureDateLabel}</Text></View>
      <Team logo={null} name={opponent}/>
     </View>
     <View style={s.matchFooter}><Text numberOfLines={1} style={s.venue}>{fixture?.venue??'Venue TBC'}</Text><ChevronRight size={15} color="#A2A9B5"/></View>
    </View>
   </View>

   <View style={s.gridMiddle}>
    <View style={s.flowCard}>
     <View style={s.cardHead}><View><Text style={s.cardEyebrow}>CLUB OPERATIONS</Text><Text style={s.cardTitle}>Weekly flow</Text></View><Text style={s.smallMeta}>{selectedPlayers}/22 selected</Text></View>
     <View style={s.flowBody}>
      <FlowNode label="Training" tone="#1687FF"/><FlowLine tone="#B7D7FF"/><FlowNode label="Availability" tone="#7C4DFF"/><FlowLine tone="#D7C8FF"/><FlowNode label="Selection" tone="#FF9F2D"/><FlowLine tone="#FFD9A8"/><FlowNode label="Match Day" tone="#20B86A"/>
     </View>
     <View style={s.flowLabels}><Text>Plan & report</Text><Text>Player status</Text><Text>Publish 22</Text><Text>Live match</Text></View>
    </View>

    <View style={s.sideStack}>
     <MiniCard title="Competition" value={seasonRecord?.leagueName??'Not connected'} meta={seasonRecord?.season??'Current season'}/>
     <MiniCard title="Current side" value={selectedPlayers?`${selectedPlayers} players`:'No side published'} meta={sheet?sheet.status.toLowerCase():'Team Selection'}/>
    </View>
   </View>

   <View style={s.bottomGrid}>
    <ActionCard icon={Users} title="Memberships" copy="Members, cards, gate entry and renewals." tone="#1687FF"/>
    <ActionCard icon={Handshake} title="Sponsors" copy="Commercial partners, packages and delivery." tone="#7C4DFF"/>
    <ActionCard icon={CalendarDays} title="Operations" copy="Timekeeper, scorekeeper, KPIs and club tasks." tone="#20B86A"/>
   </View>
  </ScrollView>
 </View>
}

function Kpi({icon:Icon,label,value,meta,tone}:{icon:typeof Users;label:string;value:string;meta:string;tone:string}){return <View style={s.kpi}><View style={[s.kpiIcon,{backgroundColor:`${tone}12`}]}><Icon size={15} color={tone}/></View><Text style={s.kpiLabel}>{label}</Text><Text style={s.kpiValue}>{value}</Text><Text style={s.kpiMeta}>{meta}</Text></View>}
function Team({logo,name}:{logo?:string|null;name:string}){return <View style={s.team}>{logo?<Image source={{uri:logo}} style={s.teamLogo} resizeMode="contain"/>:<View style={s.teamFallback}><Text style={s.teamInitial}>{name.slice(0,1)}</Text></View>}<Text numberOfLines={2} style={s.teamName}>{name}</Text></View>}
function Progress({label,value,max,tone,suffix='' }:{label:string;value:number;max:number;tone:string;suffix?:string}){const pct=Math.max(0,Math.min(100,(value/max)*100));return <View><View style={s.progressHead}><Text style={s.progressLabel}>{label}</Text><Text style={s.progressValue}>{value}{suffix}</Text></View><View style={s.track}><View style={[s.fill,{width:`${pct}%`,backgroundColor:tone}]}/></View></View>}
function FlowNode({label,tone}:{label:string;tone:string}){return <View style={[s.flowNode,{backgroundColor:tone}]}><Text style={s.flowNodeText}>{label.slice(0,1)}</Text></View>}
function FlowLine({tone}:{tone:string}){return <View style={[s.flowLine,{backgroundColor:tone}]}/>}
function MiniCard({title,value,meta}:{title:string;value:string;meta:string}){return <View style={s.miniCard}><Text style={s.miniTitle}>{title}</Text><Text numberOfLines={2} style={s.miniValue}>{value}</Text><Text style={s.miniMeta}>{meta}</Text></View>}
function ActionCard({icon:Icon,title,copy,tone}:{icon:typeof Users;title:string;copy:string;tone:string}){return <View style={s.actionCard}><View style={[s.actionIcon,{backgroundColor:`${tone}12`}]}><Icon size={17} color={tone}/></View><Text style={s.actionTitle}>{title}</Text><Text style={s.actionCopy}>{copy}</Text><ChevronRight size={15} color="#A8AFBB" style={s.actionArrow}/></View>}

const s=StyleSheet.create({
 page:{flex:1,backgroundColor:'#F7F8FB'},
 header:{height:58,backgroundColor:'#FFFFFF',borderBottomWidth:1,borderBottomColor:'#EFF1F5',paddingHorizontal:16,flexDirection:'row',alignItems:'center',gap:10},
 headerTitle:{fontSize:15,fontWeight:'800',color:'#171C27'},headerSub:{fontSize:8.5,color:'#9AA3B2',marginTop:1},
 search:{marginLeft:'auto',width:255,height:32,borderRadius:8,backgroundColor:'#FAFBFD',borderWidth:1,borderColor:'#EFF1F4',paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:7},searchText:{fontSize:8.5,color:'#A0A7B3',flex:1},
 iconButton:{width:32,height:32,borderRadius:8,backgroundColor:'#FAFBFD',borderWidth:1,borderColor:'#EFF1F4',alignItems:'center',justifyContent:'center'},notification:{position:'absolute',right:7,top:6,width:5,height:5,borderRadius:3,backgroundColor:'#EF476F'},
 avatar:{width:32,height:32,borderRadius:9,backgroundColor:'#EEF4FF',alignItems:'center',justifyContent:'center'},avatarText:{fontSize:9,fontWeight:'900',color:palette.blue},
 content:{padding:14,gap:10},
 kpiRow:{flexDirection:'row',gap:8},kpi:{flex:1,minHeight:82,backgroundColor:'#FFFFFF',borderRadius:11,borderWidth:1,borderColor:'#EDF0F4',padding:10,position:'relative'},kpiIcon:{position:'absolute',right:9,top:9,width:26,height:26,borderRadius:8,alignItems:'center',justifyContent:'center'},kpiLabel:{fontSize:8.5,fontWeight:'700',color:'#6F7888'},kpiValue:{fontSize:20,fontWeight:'900',color:'#161B26',marginTop:5},kpiMeta:{fontSize:7.5,color:'#9DA4B0',marginTop:2},
 gridTop:{flexDirection:'row',gap:10},performanceCard:{flex:1,height:220,backgroundColor:'#FFFFFF',borderRadius:12,borderWidth:1,borderColor:'#EDF0F4',padding:13},matchCard:{width:300,height:220,backgroundColor:'#FFFFFF',borderRadius:12,borderWidth:1,borderColor:'#EDF0F4',padding:13},
 cardHead:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between'},cardEyebrow:{fontSize:7,fontWeight:'900',letterSpacing:.9,color:'#9AA3B2'},cardTitle:{fontSize:13,fontWeight:'800',color:'#181E2A',marginTop:3},seasonPill:{paddingHorizontal:8,paddingVertical:5,borderRadius:7,backgroundColor:'#F5F7FA'},seasonText:{fontSize:7.5,fontWeight:'800',color:'#727B8B'},
 performanceBody:{flex:1,flexDirection:'row',alignItems:'center',gap:22},scoreRing:{width:118,height:118,borderRadius:59,borderWidth:11,borderColor:'#DCE9FF',alignItems:'center',justifyContent:'center'},scoreRingInner:{width:84,height:84,borderRadius:42,borderWidth:8,borderColor:'#A8CCFF',alignItems:'center',justifyContent:'center'},scoreBig:{fontSize:22,fontWeight:'900',color:'#181E2A'},scoreLabel:{fontSize:7,fontWeight:'900',color:'#8D96A5',marginTop:1},performanceStats:{flex:1,gap:15},progressHead:{flexDirection:'row',justifyContent:'space-between',marginBottom:5},progressLabel:{fontSize:8.5,fontWeight:'700',color:'#697386'},progressValue:{fontSize:8.5,fontWeight:'800',color:'#202637'},track:{height:5,borderRadius:3,backgroundColor:'#F0F2F5',overflow:'hidden'},fill:{height:5,borderRadius:3},
 matchBody:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:4},team:{width:92,alignItems:'center',gap:5},teamLogo:{width:52,height:52},teamFallback:{width:52,height:52,borderRadius:16,backgroundColor:'#EEF4FF',alignItems:'center',justifyContent:'center'},teamInitial:{fontSize:20,fontWeight:'900',color:palette.blue},teamName:{fontSize:8.5,fontWeight:'800',color:'#252B37',textAlign:'center'},vsWrap:{alignItems:'center',gap:6},vs:{fontSize:11,fontWeight:'900',color:'#303746'},matchDate:{fontSize:7.5,color:'#9099A8'},matchFooter:{height:28,borderTopWidth:1,borderTopColor:'#F0F2F5',flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between'},venue:{fontSize:8,color:'#8A93A2',maxWidth:230},
 gridMiddle:{flexDirection:'row',gap:10},flowCard:{flex:1,height:178,backgroundColor:'#FFFFFF',borderRadius:12,borderWidth:1,borderColor:'#EDF0F4',padding:13},flowBody:{flex:1,flexDirection:'row',alignItems:'center',paddingHorizontal:10},flowNode:{width:34,height:34,borderRadius:17,alignItems:'center',justifyContent:'center'},flowNodeText:{fontSize:10,fontWeight:'900',color:'#fff'},flowLine:{flex:1,height:5,borderRadius:3,marginHorizontal:3},flowLabels:{flexDirection:'row',justifyContent:'space-between'},flowLabels:{},smallMeta:{fontSize:7.5,fontWeight:'700',color:'#8D96A5'},
 sideStack:{width:300,gap:10},miniCard:{flex:1,backgroundColor:'#FFFFFF',borderRadius:12,borderWidth:1,borderColor:'#EDF0F4',padding:12},miniTitle:{fontSize:7.5,fontWeight:'900',letterSpacing:.7,color:'#9BA3AF'},miniValue:{fontSize:13,fontWeight:'800',color:'#202632',marginTop:5},miniMeta:{fontSize:8,color:'#929BA9',marginTop:3},
 bottomGrid:{flexDirection:'row',gap:10},actionCard:{flex:1,minHeight:94,backgroundColor:'#FFFFFF',borderRadius:12,borderWidth:1,borderColor:'#EDF0F4',padding:12,position:'relative'},actionIcon:{width:30,height:30,borderRadius:9,alignItems:'center',justifyContent:'center'},actionTitle:{fontSize:11,fontWeight:'800',color:'#202632',marginTop:7},actionCopy:{fontSize:8,lineHeight:12,color:'#8C95A4',marginTop:3,maxWidth:'85%'},actionArrow:{position:'absolute',right:10,top:12},
 flowLabels:{flexDirection:'row',justifyContent:'space-between',paddingHorizontal:2},
})