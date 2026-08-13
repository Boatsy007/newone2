import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd()
const files=[
 'apps/ipad/src/screens/AvailabilityScreen.tsx','apps/ipad/src/screens/GamePlanScreen.tsx','apps/ipad/src/screens/LiveStatsScreen.tsx','apps/ipad/src/screens/MembershipAdvancedScreen.tsx','apps/ipad/src/screens/ScorekeeperScreen.tsx','apps/ipad/src/screens/SignInScreen.tsx','apps/ipad/src/screens/ClubPickerScreen.tsx','apps/ipad/src/screens/StudioBroadcastScreen.tsx','apps/ipad/src/screens/StudioEventsScreen.tsx','apps/ipad/src/screens/StudioFundraisingScreen.tsx','apps/ipad/src/screens/StudioLiveMatchScreen.tsx','apps/ipad/src/screens/StudioMilestonesScreen.tsx','apps/ipad/src/screens/StudioNewsScreen.tsx','apps/ipad/src/screens/StudioTeamSelectionScreen.tsx','apps/ipad/src/screens/TimekeeperScreen.tsx','apps/ipad/src/screens/TrainingPlanScreen.tsx','apps/ipad/src/screens/TrainingReportScreen.tsx','apps/ipad/src/screens/WebsiteScreen.tsx'
]

const replacements=[
 ["backgroundColor:'#FAFBFC'","backgroundColor:'#FAFBFD'"],["backgroundColor:'#F7F8FA'","backgroundColor:'#F5F7FB'"],["backgroundColor:'#F7F8FB'","backgroundColor:'#F5F7FB'"],
 ["borderColor:'#EEF1F4'","borderColor:'#E8EDF4'"],["borderColor:'#EDF0F4'","borderColor:'#E8EDF4'"],["borderColor:'#DCE2E8'","borderColor:'#E8EDF4'"],
 ["borderRadius:8","borderRadius:10"],["borderRadius:9","borderRadius:11"],["borderRadius:10","borderRadius:12"],["borderRadius:11","borderRadius:13"],["borderRadius:12","borderRadius:14"],
 ["fontSize:8,","fontSize:9,"],["fontSize:9,","fontSize:10,"],["fontSize:10,","fontSize:11,"],["fontSize:11,","fontSize:12,"],
 ["fontSize:8.5,","fontSize:9.5,"],["fontSize:9.5,","fontSize:10.5,"],["fontSize:10.5,","fontSize:11.5,"],
]

for(const rel of files){const file=path.join(root,rel);if(!fs.existsSync(file)){console.log('skip missing',rel);continue}let src=fs.readFileSync(file,'utf8');for(const[from,to]of replacements)src=src.split(from).join(to)
 // larger application headers without touching football ovals / match-day canvas
 src=src.replace(/topbar:\{height:(?:80|86|90|92),/g,'topbar:{height:78,')
 src=src.replace(/topbar:\{minHeight:(?:80|86|90|92),/g,'topbar:{minHeight:78,')
 src=src.replace(/title:\{fontSize:(?:29|30|32|34|36|40|42),/g,'title:{fontSize:26,')
 src=src.replace(/subtitle:\{fontSize:(?:10|11|12|13),/g,'subtitle:{fontSize:12,')
 // give common cards the soft elevated product treatment
 src=src.replace(/(borderRadius:(?:14|15|16|17|18),backgroundColor:(?:palette\.surface|'#fff'|'#FFFFFF'))/g,"$1,shadowColor:'#1E2A3A',shadowOpacity:.045,shadowRadius:10,shadowOffset:{width:0,height:4}")
 fs.writeFileSync(file,src,'utf8');console.log('premium surface',rel)}

// Website: connect the same canonical club sponsor endpoint used elsewhere.
const website=path.join(root,'apps/ipad/src/screens/WebsiteScreen.tsx')
if(fs.existsSync(website)){let src=fs.readFileSync(website,'utf8');src=src.replace('`/club-portal/sponsors/clubs/${encodeURIComponent(clubId)}/sponsors`','`/club-portal/clubs/${encodeURIComponent(clubId)}/sponsors`');fs.writeFileSync(website,src,'utf8')}
console.log('Premium functional-surface pass complete. Purpose-built oval / Match Day / Whiteboard layouts were not structurally changed.')
