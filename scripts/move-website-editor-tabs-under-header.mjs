import fs from 'node:fs'

const file='apps/ipad/src/screens/WebsiteScreen.tsx'
let src=fs.readFileSync(file,'utf8')

function replaceOnce(find,repl,label){
  if(!src.includes(find)) throw new Error(`Website editor nav patch failed: ${label}`)
  src=src.replace(find,repl)
}

// Shared editor navigation definition so the Facebook-style controls can live inside the page header.
replaceOnce(
  "type PreviewTab='home'|'about'|'highlights'|'match'|'sponsors'\n",
  "type PreviewTab='home'|'about'|'highlights'|'match'|'sponsors'\nconst EDITOR_TABS:[EditorTab,string][]=[['quick','Overview'],['about','About'],['contact','Contact'],['football','Football'],['links','Links'],['brand','Brand'],['highlights','Highlights'],['sponsors','Sponsors']]\n",
  'shared editor tabs'
)

// Pass current editor state into the live page preview.
src=src.replaceAll(
  "<Preview data={data} cover={cover} sponsors={sponsors} tab={previewTab} setTab={setPreviewTab} edit={setEditorTab}/>",
  "<Preview data={data} cover={cover} sponsors={sponsors} tab={previewTab} setTab={setPreviewTab} edit={setEditorTab} editorTab={editorTab}/>"
)

// Remove the duplicate pill-style tab row from the side editor. The editor remains the inspector/content area only.
replaceOnce(
  " const tabs:[EditorTab,string][]=[['quick','Quick edit'],['about','About'],['contact','Contact'],['football','Football'],['links','Links'],['brand','Brand'],['highlights','Highlights'],['sponsors','Sponsors']]\n return <ScrollView style={{flex:1}} contentContainerStyle={s.editorContent} keyboardShouldPersistTaps=\"handled\"><Text style={s.editorTitle}>Page editor</Text><Text style={s.editorCopy}>Tap anything in the preview or choose a section here.</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.editorTabs}>{tabs.map(([key,label])=><Pressable key={key} onPress={()=>setTab(key)} style={[s.editorTab,tab===key&&s.editorTabActive]}><Text style={[s.editorTabText,tab===key&&s.editorTabTextActive]}>{label}</Text></Pressable>)}</ScrollView>\n",
  " return <ScrollView style={{flex:1}} contentContainerStyle={s.editorContent} keyboardShouldPersistTaps=\"handled\"><View style={s.editorSectionHead}><Text style={s.editorEyebrow}>EDITING</Text><Text style={s.editorTitle}>{EDITOR_TABS.find(([key])=>key===tab)?.[1]??'Overview'}</Text><Text style={s.editorCopy}>Changes update the live page preview as you work.</Text></View>\n",
  'remove side editor tabs'
)

// Give Preview the active editor tab.
replaceOnce(
  "function Preview({data,cover,sponsors,tab,setTab,edit}:{data:Payload;cover:string|null;sponsors:Sponsor[];tab:PreviewTab;setTab:(v:PreviewTab)=>void;edit:(v:EditorTab)=>void}){",
  "function Preview({data,cover,sponsors,tab,setTab,edit,editorTab}:{data:Payload;cover:string|null;sponsors:Sponsor[];tab:PreviewTab;setTab:(v:PreviewTab)=>void;edit:(v:EditorTab)=>void;editorTab:EditorTab}){",
  'preview props'
)

// Insert a Facebook-style management tab bar directly beneath the club identity/header and above public page navigation.
replaceOnce(
  "</View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.previewTabs}>{tabs.map(([key,label])=><Pressable key={key} onPress={()=>setTab(key)} style={[s.previewTab,tab===key&&{borderBottomColor:primary,borderBottomWidth:3}]}><Text style={[s.previewTabText,tab===key&&{color:primary}]}>{label}</Text></Pressable>)}</ScrollView></View>",
  "</View><View style={s.pageEditorNav}><View style={s.pageEditorNavLead}><Edit3 size={15} color={primary}/><Text style={s.pageEditorNavLabel}>EDIT PAGE</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pageEditorTabs}>{EDITOR_TABS.map(([key,label])=><Pressable key={key} onPress={()=>edit(key)} style={[s.pageEditorTab,editorTab===key&&{borderBottomColor:primary}]}><Text style={[s.pageEditorTabText,editorTab===key&&{color:primary}]}>{label}</Text></Pressable>)}</ScrollView></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.previewTabs}>{tabs.map(([key,label])=><Pressable key={key} onPress={()=>setTab(key)} style={[s.previewTab,tab===key&&{borderBottomColor:primary,borderBottomWidth:3}]}><Text style={[s.previewTabText,tab===key&&{color:primary}]}>{label}</Text></Pressable>)}</ScrollView></View>",
  'header editor navigation'
)

// Add the new premium Facebook-style navigation styles.
replaceOnce(
  "editorContent:{padding:15,paddingBottom:45,gap:11},editorTitle:{fontSize:22,fontWeight:'900',color:palette.ink},editorCopy:{fontSize:10,color:palette.muted},editorTabs:{gap:6,paddingVertical:4},editorTab:{height:33,paddingHorizontal:10,borderRadius:8,borderWidth:1,borderColor:palette.border,justifyContent:'center'},editorTabActive:{backgroundColor:palette.blue,borderColor:palette.blue},editorTabText:{fontSize:8,fontWeight:'900',color:palette.ink},editorTabTextActive:{color:'#fff'},",
  "editorContent:{padding:18,paddingBottom:45,gap:13},editorSectionHead:{paddingBottom:4},editorEyebrow:{fontSize:8.5,fontWeight:'900',letterSpacing:1.25,color:palette.blue},editorTitle:{fontSize:24,fontWeight:'900',color:palette.ink,marginTop:2},editorCopy:{fontSize:10.5,color:palette.muted,marginTop:3},editorTabs:{gap:6,paddingVertical:4},editorTab:{height:33,paddingHorizontal:10,borderRadius:8,borderWidth:1,borderColor:palette.border,justifyContent:'center'},editorTabActive:{backgroundColor:palette.blue,borderColor:palette.blue},editorTabText:{fontSize:8,fontWeight:'900',color:palette.ink},editorTabTextActive:{color:'#fff'},",
  'editor heading styles'
)

replaceOnce(
  "clubMeta:{fontSize:9,color:palette.muted,marginTop:2},previewTabs:{paddingHorizontal:18,gap:18,borderTopWidth:1,borderTopColor:'#EEF1F4'},",
  "clubMeta:{fontSize:9,color:palette.muted,marginTop:2},pageEditorNav:{minHeight:54,borderTopWidth:1,borderTopColor:'#E9EDF3',backgroundColor:'#FFFFFF',paddingHorizontal:18,flexDirection:'row',alignItems:'center',gap:16},pageEditorNavLead:{height:34,flexDirection:'row',alignItems:'center',gap:6,paddingRight:15,borderRightWidth:1,borderRightColor:'#E9EDF3'},pageEditorNavLabel:{fontSize:8.5,fontWeight:'900',letterSpacing:1.05,color:palette.muted},pageEditorTabs:{alignItems:'stretch',gap:22},pageEditorTab:{height:54,justifyContent:'center',borderBottomWidth:3,borderBottomColor:'transparent'},pageEditorTabText:{fontSize:10.5,fontWeight:'800',color:'#667085'},previewTabs:{paddingHorizontal:18,gap:18,borderTopWidth:1,borderTopColor:'#EEF1F4',backgroundColor:'#FAFBFC'},",
  'page editor nav styles'
)

fs.writeFileSync(file,src,'utf8')
console.log('Website editor navigation moved beneath the club header.')
console.log('The editor now behaves like a Facebook Page manager: header -> edit tabs -> page navigation -> live content.')
console.log('All profile fields, photos, sponsors and Save & Publish logic were preserved.')
