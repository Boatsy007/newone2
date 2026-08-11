import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Sidebar } from '../components/Sidebar'
import { palette } from '../theme'
import type { AppArea, AuthSession, ClubAccount } from '../types'
import { CoachingScreen } from './CoachingScreen'
import { TrainingPlanScreen } from './TrainingPlanScreen'
import { TrainingReportScreen } from './TrainingReportScreen'
import { AvailabilityScreen } from './AvailabilityScreen'
import { TeamSelectionScreen } from './TeamSelectionScreen'
import { MatchDayScreen } from './MatchDayScreen'
import { GamePlanScreen } from './GamePlanScreen'
import { OverviewScreen } from './OverviewScreen'
import { StudioScreen, type StudioTool } from './StudioScreen'
import { StudioTeamSelectionScreen } from './StudioTeamSelectionScreen'
import { StudioLiveMatchScreen } from './StudioLiveMatchScreen'

type Props = { club: ClubAccount; session: AuthSession; onSwitchClub: () => void; onSignOut: () => void }

export function AppShell({club,session,onSwitchClub,onSignOut}:Props){
 const[area,setArea]=useState<AppArea>('overview')
 const[trainingSession,setTrainingSession]=useState<1|2|null>(null)
 const[reportSession,setReportSession]=useState<1|2|null>(null)
 const[availabilityOpen,setAvailabilityOpen]=useState(false)
 const[teamSelectionOpen,setTeamSelectionOpen]=useState(false)
 const[matchDayOpen,setMatchDayOpen]=useState(false)
 const[gamePlanOpen,setGamePlanOpen]=useState(false)
 const[studioTool,setStudioTool]=useState<StudioTool|null>(null)
 function changeArea(next:AppArea){setTrainingSession(null);setReportSession(null);setAvailabilityOpen(false);setTeamSelectionOpen(false);setGamePlanOpen(false);setMatchDayOpen(false);setStudioTool(null);setArea(next)}
 function continueToMatch(){setGamePlanOpen(false);setMatchDayOpen(true)}
 return <View style={styles.app}>{!matchDayOpen&&<Sidebar active={area} club={club} onChange={changeArea} onSwitchClub={onSwitchClub}/>}<View style={styles.main}>{area==='overview'?<OverviewScreen club={club} onSignOut={onSignOut}/>:area==='coaching'&&trainingSession?<TrainingPlanScreen club={club} session={session} sessionNumber={trainingSession} onBack={()=>setTrainingSession(null)}/>:area==='coaching'&&reportSession?<TrainingReportScreen club={club} session={session} sessionNumber={reportSession} onBack={()=>setReportSession(null)}/>:area==='coaching'&&availabilityOpen?<AvailabilityScreen club={club} session={session} onBack={()=>setAvailabilityOpen(false)}/>:area==='coaching'&&teamSelectionOpen?<TeamSelectionScreen club={club} session={session} onBack={()=>setTeamSelectionOpen(false)}/>:area==='coaching'&&gamePlanOpen?<GamePlanScreen club={club} session={session} onBack={()=>setGamePlanOpen(false)} onContinue={continueToMatch}/>:area==='coaching'&&matchDayOpen?<MatchDayScreen club={club} session={session} onBack={()=>setMatchDayOpen(false)}/>:area==='coaching'?<CoachingScreen club={club} session={session} onOpenTrainingPlan={setTrainingSession} onOpenTrainingReport={setReportSession} onOpenAvailability={()=>setAvailabilityOpen(true)} onOpenTeamSelection={()=>setTeamSelectionOpen(true)} onOpenGamePlan={()=>setGamePlanOpen(true)} onOpenMatchDay={()=>setMatchDayOpen(true)}/>:area==='studio'&&studioTool==='team-selection'?<StudioTeamSelectionScreen club={club} session={session} onBack={()=>setStudioTool(null)}/>:area==='studio'&&studioTool==='live-match'?<StudioLiveMatchScreen club={club} session={session} onBack={()=>setStudioTool(null)}/>:area==='studio'?<StudioScreen club={club} session={session} onOpen={setStudioTool}/>:<View style={styles.coming}><Text style={styles.eyebrow}>PLAYFOOTY CLUB APP</Text><Text style={styles.title}>{area}</Text><Text style={styles.copy}>This completed PlayFooty module will be connected in its dedicated build stage.</Text></View>}</View></View>
}
const styles=StyleSheet.create({app:{flex:1,flexDirection:'row',backgroundColor:palette.canvas},main:{flex:1},coming:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:palette.canvas},eyebrow:{fontSize:10,color:palette.blue,fontWeight:'900',letterSpacing:1.4},title:{fontSize:40,fontWeight:'900',color:palette.ink,textTransform:'capitalize',marginTop:5},copy:{fontSize:13,color:palette.muted,marginTop:7}})
