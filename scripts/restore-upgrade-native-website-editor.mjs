import fs from 'node:fs'

const appShellPath='apps/ipad/src/screens/AppShell.tsx'
let app=fs.readFileSync(appShellPath,'utf8')
if(!app.includes("import { WebsiteScreen } from './WebsiteScreen'")){
  app=app.replace("import { WhiteboardScreen } from './WhiteboardScreen'", "import { WhiteboardScreen } from './WhiteboardScreen'\nimport { WebsiteScreen } from './WebsiteScreen'")
}
if(!app.includes("else if(area==='website')content=<WebsiteScreen")){
  app=app.replace("else if(area==='memberships')content=<MembershipsScreen club={club} session={session}/>", "else if(area==='memberships')content=<MembershipsScreen club={club} session={session}/>\n else if(area==='website')content=<WebsiteScreen club={club} session={session}/>")
}
fs.writeFileSync(appShellPath,app,'utf8')

const websitePath='apps/ipad/src/screens/WebsiteScreen.tsx'
let src=fs.readFileSync(websitePath,'utf8')

src=src.replace(
  "const sponsorBase=(clubId:string)=>`/club-portal/sponsors/clubs/${encodeURIComponent(clubId)}/sponsors`",
  "const sponsorBase=(clubId:string)=>`/club-portal/clubs/${encodeURIComponent(clubId)}/sponsors`"
)

// Make the live club page the main canvas and the editor a premium inspector on the right.
src=src.replace(
  "{wide?<View style={s.split}><View style={s.editorPane}><Editor data={data} tab={editorTab} setTab={setEditorTab} patchProfile={patchProfile} patchClub={patchClub} cover={cover} chooseImage={chooseImage} removePhoto={removePhoto} removeCover={removeCover} uploading={uploading} sponsors={sponsors} setSponsors={setSponsors} clubId={club.clubId} token={token}/></View><View style={s.previewPane}><Preview data={data} cover={cover} sponsors={sponsors} tab={previewTab} setTab={setPreviewTab} edit={setEditorTab}/></View></View>",
  "{wide?<View style={s.split}><View style={s.previewPane}><Preview data={data} cover={cover} sponsors={sponsors} tab={previewTab} setTab={setPreviewTab} edit={setEditorTab}/></View><View style={s.editorPane}><Editor data={data} tab={editorTab} setTab={setEditorTab} patchProfile={patchProfile} patchClub={patchClub} cover={cover} chooseImage={chooseImage} removePhoto={removePhoto} removeCover={removeCover} uploading={uploading} sponsors={sponsors} setSponsors={setSponsors} clubId={club.clubId} token={token}/></View></View>"
)

// Upgrade the existing Facebook-style editor without changing its data/API behaviour.
const replacements=[
 ["topbar:{minHeight:86,paddingHorizontal:22,paddingVertical:13,backgroundColor:'#fff',borderBottomWidth:1,borderBottomColor:palette.border,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:14}","topbar:{minHeight:88,paddingHorizontal:26,paddingVertical:14,backgroundColor:'#fff',borderBottomWidth:1,borderBottomColor:'#E6EBF2',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:16}"],
 ["eyebrow:{fontSize:9,fontWeight:'900',letterSpacing:1.4,color:palette.blue}","eyebrow:{fontSize:9.5,fontWeight:'900',letterSpacing:1.55,color:palette.blue}"],
 ["title:{fontSize:29,fontWeight:'900',color:palette.ink}","title:{fontSize:28,fontWeight:'900',color:palette.ink,letterSpacing:-.6}"],
 ["subtitle:{fontSize:11,color:palette.muted,marginTop:2}","subtitle:{fontSize:11.5,color:palette.muted,marginTop:3}"],
 ["split:{flex:1,flexDirection:'row'}","split:{flex:1,flexDirection:'row',backgroundColor:'#F4F7FB'}"],
 ["editorPane:{width:390,backgroundColor:'#fff',borderRightWidth:1,borderRightColor:palette.border}","editorPane:{width:380,backgroundColor:'#FFFFFF',borderLeftWidth:1,borderLeftColor:'#E6EBF2'}"],
 ["previewPane:{flex:1,backgroundColor:'#E9EDF2'}","previewPane:{flex:1,backgroundColor:'#F2F5F9'}"],
 ["editorContent:{padding:15,paddingBottom:45,gap:11}","editorContent:{padding:18,paddingBottom:56,gap:13}"],
 ["editorTitle:{fontSize:22,fontWeight:'900',color:palette.ink}","editorTitle:{fontSize:22,fontWeight:'900',color:palette.ink,letterSpacing:-.35}"],
 ["editorCopy:{fontSize:10,color:palette.muted}","editorCopy:{fontSize:10.5,color:palette.muted,lineHeight:15}"],
 ["editorTab:{height:33,paddingHorizontal:10,borderRadius:8,borderWidth:1,borderColor:palette.border,justifyContent:'center'}","editorTab:{height:36,paddingHorizontal:11,borderRadius:10,borderWidth:1,borderColor:'#E2E8F0',justifyContent:'center',backgroundColor:'#FAFBFD'}"],
 ["editorTabText:{fontSize:8,fontWeight:'900',color:palette.ink}","editorTabText:{fontSize:9,fontWeight:'900',color:palette.ink}"],
 ["panel:{padding:13,borderWidth:1,borderColor:palette.border,borderRadius:13,backgroundColor:'#fff',gap:10}","panel:{padding:15,borderWidth:1,borderColor:'#E6EBF2',borderRadius:16,backgroundColor:'#fff',gap:11,shadowColor:'#172033',shadowOpacity:.035,shadowRadius:10,shadowOffset:{width:0,height:4}}"],
 ["panelTitle:{fontSize:16,fontWeight:'900',color:palette.ink}","panelTitle:{fontSize:16.5,fontWeight:'900',color:palette.ink}"],
 ["input:{minHeight:42,borderRadius:8,borderWidth:1,borderColor:palette.border,paddingHorizontal:10,fontSize:11,color:palette.ink,backgroundColor:'#fff'}","input:{minHeight:44,borderRadius:10,borderWidth:1,borderColor:'#DDE4EE',paddingHorizontal:11,fontSize:11.5,color:palette.ink,backgroundColor:'#FBFCFE'}"],
 ["previewContent:{padding:20,paddingBottom:48,maxWidth:900,width:'100%',alignSelf:'center',gap:12}","previewContent:{padding:24,paddingBottom:56,maxWidth:980,width:'100%',alignSelf:'center',gap:14}"],
 ["pageCard:{backgroundColor:'#fff',borderRadius:15,borderWidth:1,borderColor:'#D8DEE6',overflow:'hidden'}","pageCard:{backgroundColor:'#fff',borderRadius:20,borderWidth:1,borderColor:'#E1E7EF',overflow:'hidden',shadowColor:'#172033',shadowOpacity:.06,shadowRadius:18,shadowOffset:{width:0,height:7}}"],
 ["coverWrap:{height:205}","coverWrap:{height:220}"],
 ["identity:{minHeight:98,paddingHorizontal:18,paddingBottom:10,flexDirection:'row',alignItems:'flex-end',gap:13}","identity:{minHeight:108,paddingHorizontal:22,paddingBottom:12,flexDirection:'row',alignItems:'flex-end',gap:15}"],
 ["pageLogo:{width:88,height:88,borderRadius:20,borderWidth:4,borderColor:'#fff',resizeMode:'contain',backgroundColor:'#fff'}","pageLogo:{width:94,height:94,borderRadius:23,borderWidth:4,borderColor:'#fff',resizeMode:'contain',backgroundColor:'#fff'}"],
 ["clubName:{fontSize:25,fontWeight:'900',color:palette.ink}","clubName:{fontSize:27,fontWeight:'900',color:palette.ink,letterSpacing:-.55}"],
 ["previewTabText:{fontSize:9,fontWeight:'900',color:palette.muted}","previewTabText:{fontSize:10,fontWeight:'900',color:palette.muted}"],
 ["previewCard:{backgroundColor:'#fff',borderWidth:1,borderColor:'#DCE2E8',borderRadius:12,padding:14,gap:9}","previewCard:{backgroundColor:'#fff',borderWidth:1,borderColor:'#E2E8F0',borderRadius:16,padding:16,gap:10,shadowColor:'#172033',shadowOpacity:.035,shadowRadius:10,shadowOffset:{width:0,height:4}}"],
 ["cardTitle:{fontSize:16,fontWeight:'900',color:palette.ink}","cardTitle:{fontSize:17,fontWeight:'900',color:palette.ink}"],
 ["body:{fontSize:10.5,color:'#344054',lineHeight:16}","body:{fontSize:11.5,color:'#344054',lineHeight:17}"],
]
for(const [from,to] of replacements){if(src.includes(from))src=src.replace(from,to)}

fs.writeFileSync(websitePath,src,'utf8')
console.log('Restored real Website profile editor in AppShell.')
console.log('Upgraded the Facebook-style live preview + editor layout.')
console.log('Profile fields, cover photo, highlights, sponsors, brand colours and Save & Publish remain connected.')
