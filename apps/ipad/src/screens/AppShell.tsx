import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Sidebar } from '../components/Sidebar'
import { palette } from '../theme'
import type { AppArea, AuthSession, ClubAccount } from '../types'
import { AvailabilityScreen } from './AvailabilityScreen'
import { CoachingScreen } from './CoachingScreen'
import { GamePlanScreen } from './GamePlanScreen'
import { LiveStatsScreen } from './LiveStatsScreen'
import { MatchDayScreen } from './MatchDayScreen'
import { MembershipsScreen } from './MembershipsScreen'
import { OperationsScreen } from './OperationsScreen'
import { OverviewScreen } from './OverviewScreen'
import { StudioBroadcastScreen } from './StudioBroadcastScreen'
import { StudioEventsScreen } from './StudioEventsScreen'
import { StudioFundraisingScreen } from './StudioFundraisingScreen'
import { StudioLiveMatchScreen } from './StudioLiveMatchScreen'
import { StudioMilestonesScreen } from './StudioMilestonesScreen'
import { StudioNewsScreen } from './StudioNewsScreen'
import { StudioScreen, type StudioTool } from './StudioScreen'
import { StudioTeamSelectionScreen } from './StudioTeamSelectionScreen'
import { TeamSelectionScreen } from './TeamSelectionScreen'
import { TimekeeperScreen } from './TimekeeperScreen'
import { TrainingPlanScreen } from './TrainingPlanScreen'
import { TrainingReportScreen } from './TrainingReportScreen'
import { WhiteboardScreen } from './WhiteboardScreen'

type Props={club:ClubAccount;session:AuthSession;onSwitchClub:()=>void;onSignOut:()=>void}

export function AppShell({club,session,onSwitchClub,onSignOut}:Props){
 const[area,setArea]=useState<AppArea>('overview'),[trainingSession,setTrainingSession]=useState<1|2|null>(null),[reportSession,setReportSession]=useState<1|2|null>(null)
 const[availabilityOpen,setAvailabilityOpen]=useState(false),[teamSelectionOpen,setTeamSelectionOpen]=useState(false),[matchDayOpen,setMatchDayOpen]=useState(false),[gamePlanOpen,setGamePlanOpen]=useState(false),[whiteboardOpen,setWhiteboardOpen]=useState(false)
 const[timekeeperOpen,setTimekeeperOpen]=useState(false),[liveStatsOpen,setLiveStatsOpen]=useState(false)
 const[studioTool,setStudioTool]=useState<StudioTool|null>(null)
 function changeArea(next:AppArea){setTrainingSession(null);setReportSession(null);setAvailabilityOpen(false);setTeamSelectionOpen(false);setGamePlanOpen(false);setMatchDayOpen(false);setWhiteboardOpen(false);setTimekeeperOpen(false);setLiveStatsOpen(false);setStudioTool(null);setArea(next)}
 function continueToMatch(){setGamePlanOpen(false);setMatchDayOpen(true)}
 let content:React.ReactNode
 if(whiteboardOpen)content=<WhiteboardScreen club={club} session={session} onBack={()=>setWhiteboardOpen(false)}/>
 else if(area==='overview')content=<OverviewScreen club={club} session={session} onSignOut={onSignOut}/>
 else if(area==='coaching'&&trainingSession)content=<TrainingPlanScreen club={club} session={session} sessionNumber={trainingSession} onBack={()=>setTrainingSession(null)}/>
 else if(area==='coaching'&&reportSession)content=<TrainingReportScreen club={club} session={session} sessionNumber={reportSession} onBack={()=>setReportSession(null)}/>
 else if(area==='coaching'&&availabilityOpen)content=<AvailabilityScreen club={club} session={session} onBack={()=>setAvailabilityOpen(false)}/>
 else if(area==='coaching'&&teamSelectionOpen)content=<TeamSelectionScreen club={club} session={session} onBack={()=>setTeamSelectionOpen(false)}/>
 else if(area==='coaching'&&gamePlanOpen)content=<GamePlanScreen club={club} session={session} onBack={()=>setGamePlanOpen(false)} onContinue={continueToMatch}/>
 else if(area==='coaching'&&matchDayOpen)content=<MatchDayScreen club={club} session={session} onBack={()=>setMatchDayOpen(false)} onWhiteboard={()=>setWhiteboardOpen(true)}/>
 else if(area==='coaching')content=<CoachingScreen club={club} session={session} onOpenTrainingPlan={setTrainingSession} onOpenTrainingReport={setReportSession} onOpenAvailability={()=>setAvailabilityOpen(true)} onOpenTeamSelection={()=>setTeamSelectionOpen(true)} onOpenGamePlan={()=>setGamePlanOpen(true)} onOpenMatchDay={()=>setMatchDayOpen(true)} onOpenWhiteboard={()=>setWhiteboardOpen(true)}/>
 else if(area==='studio'&&studioTool==='team-selection')content=<StudioTeamSelectionScreen club={club} session={session} onBack={()=>setStudioTool(null)}/>
 else if(area==='studio'&&studioTool==='live-match')content=<StudioLiveMatchScreen club={club} session={session} onBack={()=>setStudioTool(null)}/>
 else if(area==='studio'&&studioTool==='events')content=<StudioEventsScreen club={club} session={session} onBack={()=>setStudioTool(null)}/>
 else if(area==='studio'&&studioTool==='fundraising')content=<StudioFundraisingScreen club={club} session={session} onBack={()=>setStudioTool(null)}/>
 else if(area==='studio'&&studioTool==='milestones')content=<StudioMilestonesScreen club={club} session={session} onBack={()=>setStudioTool(null)}/>
 else if(area==='studio'&&studioTool==='news')content=<StudioNewsScreen club={club} session={session} onBack={()=>setStudioTool(null)}/>
 else if(area==='studio'&&studioTool==='broadcast')content=<StudioBroadcastScreen club={club} session={session} onBack={()=>setStudioTool(null)}/>
 else if(area==='studio')content=<StudioScreen club={club} session={session} onOpen={setStudioTool}/>
 else if(area==='memberships')content=<MembershipsScreen club={club} session={session}/>
 else if(area==='operations'&&timekeeperOpen)content=<TimekeeperScreen club={club} session={session} onBack={()=>setTimekeeperOpen(false)}/>
 else if(area==='operations'&&liveStatsOpen)content=<LiveStatsScreen club={club} session={session} onBack={()=>setLiveStatsOpen(false)}/>
 else if(area==='operations')content=<OperationsScreen club={club} session={session} onOpenTimekeeper={()=>setTimekeeperOpen(true)} onOpenStats={()=>setLiveStatsOpen(true)}/>
 else content=<View style={styles.coming}><Text style={styles.eyebrow}>PLAYFOOTY CLUB APP</Text><Text style={styles.title}>{area}</Text><Text style={styles.copy}>This completed PlayFooty module will be connected in its dedicated build stage.</Text></View>
 const hideSidebar=matchDayOpen||whiteboardOpen||teamSelectionOpen||timekeeperOpen||liveStatsOpen
 return <View style={styles.app}>{!hideSidebar&&<Sidebar active={area} club={club} onChange={changeArea} onSwitchClub={onSwitchClub}/>}<View style={styles.main}>{content}</View></View>
}
const styles=StyleSheet.create({app:{flex:1,flexDirection:'row',backgroundColor:palette.canvas},main:{flex:1},coming:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:palette.canvas},eyebrow:{fontSize:10,color:palette.blue,fontWeight:'900',letterSpacing:1.4},title:{fontSize:40,fontWeight:'900',color:palette.ink,textTransform:'capitalize',marginTop:5},copy:{fontSize:13,color:palette.muted,marginTop:7}})
