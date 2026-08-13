import fs from 'node:fs'

function replaceOnce(src,find,replacement,label){
 if(!src.includes(find)) throw new Error(`Patch failed: ${label}`)
 return src.replace(find,replacement)
}

// 1) Wire the real WebsiteScreen back into AppShell.
{
 const file='apps/ipad/src/screens/AppShell.tsx'
 let src=fs.readFileSync(file,'utf8')
 if(!src.includes("import { WebsiteScreen } from './WebsiteScreen'")){
  src=replaceOnce(src,"import { WhiteboardScreen } from './WhiteboardScreen'\n","import { WhiteboardScreen } from './WhiteboardScreen'\nimport { WebsiteScreen } from './WebsiteScreen'\n",'WebsiteScreen import')
 }
 if(!src.includes("else if(area==='website')content=<WebsiteScreen")){
  src=replaceOnce(src," else if(area==='memberships')content=<MembershipsScreen club={club} session={session}/>\n"," else if(area==='memberships')content=<MembershipsScreen club={club} session={session}/>\n else if(area==='website')content=<WebsiteScreen club={club} session={session}/>\n",'WebsiteScreen route')
 }
 fs.writeFileSync(file,src,'utf8')
 console.log('Website module wired to the real profile editor.')
}

// 2) Make Coaching availability use the same selected sheet as the full Availability screen.
{
 const file='apps/ipad/src/screens/CoachingScreen.tsx'
 let src=fs.readFileSync(file,'utf8')
 const oldLoad=";void apiGet<{data?:Availability}>(`/club-portal/availability/clubs/${encodeURIComponent(club.clubId)}/overview`,token,6500).then(payload=>setAvailability(payload.data??null)).catch(()=>setAvailability(null));void apiGet<{data?:{plans?:Plan[]}}>(`/club-portal/training-plans/clubs/${encodeURIComponent(club.clubId)}`,token,6500)"
 const newLoad=";void apiGet<{data?:{plans?:Plan[]}}>(`/club-portal/training-plans/clubs/${encodeURIComponent(club.clubId)}`,token,6500)"
 if(src.includes(oldLoad)) src=src.replace(oldLoad,newLoad)

 const sheetLine=" const sheet=selectConnectedSheet(canonical,sheets as never[],fixture as never) as unknown as Sheet|null\n"
 const availabilityEffect=" const sheet=selectConnectedSheet(canonical,sheets as never[],fixture as never) as unknown as Sheet|null\n useEffect(()=>{if(!sheet?.id){setAvailability(null);return}apiGet<{data?:Availability}>(`/club-portal/availability/clubs/${encodeURIComponent(club.clubId)}/overview?sheetId=${encodeURIComponent(sheet.id)}`,token,6500).then(payload=>setAvailability(payload.data??null)).catch(()=>setAvailability(null))},[club.clubId,sheet?.id,token])\n"
 if(!src.includes('overview?sheetId=${encodeURIComponent(sheet.id)}')){
  src=replaceOnce(src,sheetLine,availabilityEffect,'connected availability effect')
 }

 // Give football workflow cards a deliberate 3-column desktop layout instead of squeezing seven across.
 const oldSteps="  <View style={s.stepGrid}>{steps.map((step,index)=><ActionTile key={step.title} icon={step.icon} title={step.title} copy={step.copy} tone={step.tone} onPress={step.onPress} badge={step.ready?'READY':`STEP ${index+1}`}/>)}</View>"
 const newSteps="  <View style={s.stepGrid}>{steps.map((step,index)=><View key={step.title} style={s.stepCell}><ActionTile icon={step.icon} title={step.title} copy={step.copy} tone={step.tone} onPress={step.onPress} badge={step.ready?'READY':`STEP ${index+1}`}/></View>)}</View>"
 if(src.includes(oldSteps)) src=src.replace(oldSteps,newSteps)

 const oldTools="  <View style={s.tools}><ActionTile icon={Target} title=\"Match Day\" copy=\"Open the live oval, interchange, scoreboard, KPIs and match controls.\" tone={premium.blue} onPress={onOpenMatchDay} badge=\"LIVE WORKSPACE\"/><ActionTile icon={PencilRuler} title=\"Whiteboard\" copy=\"Move players, draw structures and save tactical boards.\" tone={premium.purple} onPress={onOpenWhiteboard} badge=\"TACTICS\"/></View>"
 const newTools="  <View style={s.tools}><View style={s.toolCell}><ActionTile icon={Target} title=\"Match Day\" copy=\"Open the live oval, interchange, scoreboard, KPIs and match controls.\" tone={premium.blue} onPress={onOpenMatchDay} badge=\"LIVE WORKSPACE\"/></View><View style={s.toolCell}><ActionTile icon={PencilRuler} title=\"Whiteboard\" copy=\"Move players, draw structures and save tactical boards.\" tone={premium.purple} onPress={onOpenWhiteboard} badge=\"TACTICS\"/></View></View>"
 if(src.includes(oldTools)) src=src.replace(oldTools,newTools)

 const oldStyles="metrics:{flexDirection:'row',gap:12},stepGrid:{flexDirection:'row',flexWrap:'wrap',gap:12},tools:{flexDirection:'row',gap:12},})"
 const newStyles="metrics:{flexDirection:'row',gap:12},stepGrid:{flexDirection:'row',flexWrap:'wrap',gap:12},stepCell:{width:'31.8%',minWidth:260},tools:{flexDirection:'row',gap:12},toolCell:{flex:1,minWidth:340},})"
 src=replaceOnce(src,oldStyles,newStyles,'coaching workflow grid styles')
 fs.writeFileSync(file,src,'utf8')
 console.log('Coaching availability connected to selected sheet and workflow cards resized.')
}

console.log('Premium coaching + website connection repair complete.')
console.log('Run: cd apps/ipad && npm run typecheck')
