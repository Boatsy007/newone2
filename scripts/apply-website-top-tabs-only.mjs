import fs from 'node:fs'

const path='apps/ipad/src/screens/WebsiteScreen.tsx'
let src=fs.readFileSync(path,'utf8')

// Ensure Match Centre can be represented by the editor state.
src=src.replace(
  "type EditorTab='quick'|'about'|'contact'|'football'|'links'|'brand'|'highlights'|'sponsors'",
  "type EditorTab='quick'|'about'|'contact'|'football'|'links'|'brand'|'highlights'|'sponsors'|'match'"
)

// Remove the separate Page editor title/copy and its duplicate tab bar, regardless of whether
// the earlier inline-nav patch was applied.
src=src.replace(
  /<Text style=\{s\.editorTitle\}>Page editor<\/Text>\s*<Text style=\{s\.editorCopy\}>[^<]*<\/Text>\s*<ScrollView horizontal showsHorizontalScrollIndicator=\{false\} contentContainerStyle=\{s\.editorTabs\}>[\s\S]*?<\/ScrollView>/,
  ''
)

// Home is the general editing surface, so expose all general profile groups there.
src=src.replace("{tab==='contact'?<Panel", "{(tab==='quick'||tab==='contact')?<Panel")
src=src.replace("{tab==='football'?<Panel", "{(tab==='quick'||tab==='football')?<Panel")
src=src.replace("{tab==='links'?<Panel", "{(tab==='quick'||tab==='links')?<Panel")
src=src.replace("{tab==='brand'?<Panel", "{(tab==='quick'||tab==='brand')?<Panel")

// Add a non-editable Match Centre editor panel if not already present.
if(!src.includes("tab==='match'?<Panel title=\"Match Centre\"")){
  src=src.replace(
    "  {tab==='highlights'?<><PhotoPanel",
    "  {tab==='match'?<Panel title=\"Match Centre\" icon={<Trophy size={18} color={palette.blue}/>}><Text style={s.hint}>Fixtures, results, ladder, team selection and live match information are connected automatically from PlayFooty. There is nothing to re-enter here.</Text></Panel>:null}\n  {tab==='highlights'?<><PhotoPanel"
  )
}

// Make the top page tabs drive both the preview AND which editor controls appear below.
if(!src.includes('const editorFor=(key:PreviewTab):EditorTab')){
  src=src.replace(
    " const tabs:[PreviewTab,string][]=[['home','Home'],['about','About'],['highlights','Highlights'],['match','Match Centre'],['sponsors','Sponsors']]",
    " const tabs:[PreviewTab,string][]=[['home','Home'],['about','About'],['highlights','Highlights'],['match','Match Centre'],['sponsors','Sponsors']]\n const editorFor=(key:PreviewTab):EditorTab=>key==='home'?'quick':key==='match'?'match':key"
  )
}

src=src.replace(
  /onPress=\{\(\)=>setTab\(key\)\}/g,
  "onPress={()=>{setTab(key);edit(editorFor(key))}}"
)

// If the earlier patch already changed the handler, leave it alone.

fs.writeFileSync(path,src)
console.log('Website updated: Home/About/Highlights/Match Centre/Sponsors are now the only editor navigation. The separate Page editor tabs are removed.')
