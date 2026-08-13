import fs from 'node:fs'

const path='apps/ipad/src/screens/WebsiteScreen.tsx'
let src=fs.readFileSync(path,'utf8')

function replaceOnce(find,replacement,label){
  if(!src.includes(find)) throw new Error(`Website inline editor patch failed: ${label}`)
  src=src.replace(find,replacement)
}

replaceOnce(
  "type EditorTab='quick'|'about'|'contact'|'football'|'links'|'brand'|'highlights'|'sponsors'",
  "type EditorTab='quick'|'about'|'contact'|'football'|'links'|'brand'|'highlights'|'sponsors'|'match'",
  'editor tab type'
)

replaceOnce(
  " const p=data.profile\n const tabs:[EditorTab,string][]=[['quick','Quick edit'],['about','About'],['contact','Contact'],['football','Football'],['links','Links'],['brand','Brand'],['highlights','Highlights'],['sponsors','Sponsors']]\n return <ScrollView style={{flex:1}} contentContainerStyle={s.editorContent} keyboardShouldPersistTaps=\"handled\"><Text style={s.editorTitle}>Page editor</Text><Text style={s.editorCopy}>Tap anything in the preview or choose a section here.</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.editorTabs}>{tabs.map(([key,label])=><Pressable key={key} onPress={()=>setTab(key)} style={[s.editorTab,tab===key&&s.editorTabActive]}><Text style={[s.editorTabText,tab===key&&s.editorTabTextActive]}>{label}</Text></Pressable>)}</ScrollView>",
  " const p=data.profile\n return <ScrollView style={{flex:1}} contentContainerStyle={s.editorContent} keyboardShouldPersistTaps=\"handled\">",
  'remove duplicate page editor navigation'
)

replaceOnce("{tab==='contact'?<Panel", "{(tab==='quick'||tab==='contact')?<Panel", 'contact on home')
replaceOnce("{tab==='football'?<Panel", "{(tab==='quick'||tab==='football')?<Panel", 'football on home')
replaceOnce("{tab==='links'?<Panel", "{(tab==='quick'||tab==='links')?<Panel", 'links on home')
replaceOnce("{tab==='brand'?<Panel", "{(tab==='quick'||tab==='brand')?<Panel", 'brand on home')

replaceOnce(
  "  {tab==='highlights'?<><PhotoPanel",
  "  {tab==='match'?<Panel title=\"Match Centre\" icon={<Trophy size={18} color={palette.blue}/>}><Text style={s.hint}>Fixtures, results, ladder, team selection and live match information are connected automatically from PlayFooty. There is nothing to re-enter here.</Text></Panel>:null}\n  {tab==='highlights'?<><PhotoPanel",
  'match centre editor state'
)

replaceOnce(
  " const tabs:[PreviewTab,string][]=[['home','Home'],['about','About'],['highlights','Highlights'],['match','Match Centre'],['sponsors','Sponsors']]",
  " const tabs:[PreviewTab,string][]=[['home','Home'],['about','About'],['highlights','Highlights'],['match','Match Centre'],['sponsors','Sponsors']]\n const editorFor=(key:PreviewTab):EditorTab=>key==='home'?'quick':key==='match'?'match':key",
  'preview editor mapping'
)

replaceOnce(
  "onPress={()=>setTab(key)} style={[s.previewTab",
  "onPress={()=>{setTab(key);edit(editorFor(key))}} style={[s.previewTab",
  'preview tabs drive editor'
)

fs.writeFileSync(path,src)
console.log('Website editor navigation updated: Home/About/Highlights/Match Centre/Sponsors now drive the editor directly; duplicate Page editor tabs removed.')
