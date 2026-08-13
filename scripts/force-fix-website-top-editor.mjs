import fs from 'node:fs'

const path='apps/ipad/src/screens/WebsiteScreen.tsx'
let src=fs.readFileSync(path,'utf8')

const original=src

// 1) Allow a dedicated Match Centre editor state.
src=src.replace(
  "type EditorTab='quick'|'about'|'contact'|'football'|'links'|'brand'|'highlights'|'sponsors'",
  "type EditorTab='quick'|'about'|'contact'|'football'|'links'|'brand'|'highlights'|'sponsors'|'match'"
)

// 2) Remove the duplicate Page editor heading + secondary tab row completely.
src=src.replace(
  /\n const tabs:\[EditorTab,string\]\[\]=\[\['quick','Quick edit'\].*?\]\n return <ScrollView style=\{\{flex:1\}\} contentContainerStyle=\{s\.editorContent\} keyboardShouldPersistTaps="handled"><Text style=\{s\.editorTitle\}>Page editor<\/Text><Text style=\{s\.editorCopy\}>Tap anything in the preview or choose a section here\.<\/Text><ScrollView horizontal showsHorizontalScrollIndicator=\{false\} contentContainerStyle=\{s\.editorTabs\}>\{tabs\.map\(\(\[key,label\]\)=><Pressable key=\{key\} onPress=\{\(\)=>setTab\(key\)\} style=\{\[s\.editorTab,tab===key&&s\.editorTabActive\]\}><Text style=\{\[s\.editorTabText,tab===key&&s\.editorTabTextActive\]\}>\{label\}<\/Text><\/Pressable>\)\}<\/ScrollView>/s,
  '\n return <ScrollView style={{flex:1}} contentContainerStyle={s.editorContent} keyboardShouldPersistTaps="handled">'
)

// 3) Home is the all-purpose editor: show all general editable sections there.
src=src.replace("{tab==='contact'?<Panel", "{(tab==='quick'||tab==='contact')?<Panel")
src=src.replace("{tab==='football'?<Panel", "{(tab==='quick'||tab==='football')?<Panel")
src=src.replace("{tab==='links'?<Panel", "{(tab==='quick'||tab==='links')?<Panel")
src=src.replace("{tab==='brand'?<Panel", "{(tab==='quick'||tab==='brand')?<Panel")

// 4) Give Match Centre its own editor state so Home controls don't show when Match Centre is selected.
if(!src.includes("tab==='match'?<Panel title=\"Match Centre\"")){
  src=src.replace(
    "  {tab==='highlights'?<><PhotoPanel",
    "  {tab==='match'?<Panel title=\"Match Centre\" icon={<Trophy size={18} color={palette.blue}/>}><Text style={s.hint}>Fixtures, results, ladder, team selection and live match information are connected automatically from PlayFooty. There is nothing to manually re-enter here.</Text></Panel>:null}\n  {tab==='highlights'?<><PhotoPanel"
  )
}

// 5) The visible page tabs under the team name now control BOTH the preview and editor.
src=src.replace(
  "onPress={()=>setTab(key)} style={[s.previewTab",
  "onPress={()=>{setTab(key);edit(key==='home'?'quick':key==='match'?'match':key)}} style={[s.previewTab"
)

if(src===original) throw new Error('No Website changes were made. Local file does not match the expected WebsiteScreen structure.')
if(src.includes('>Page editor</Text>')) throw new Error('Page editor heading is still present after patch; refusing partial update.')
if(src.includes("['quick','Quick edit']")) throw new Error('Duplicate editor tab row is still present after patch; refusing partial update.')

fs.writeFileSync(path,src)
console.log('Website fixed: Home/About/Highlights/Match Centre/Sponsors are now the only editor navigation; duplicate Page editor navigation removed.')