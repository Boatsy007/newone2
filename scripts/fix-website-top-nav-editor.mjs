import fs from 'node:fs'

const path='apps/ipad/src/screens/WebsiteScreen.tsx'
let src=fs.readFileSync(path,'utf8')

// 1) Make sure the editor can represent Match Centre.
src=src.replace(
  /type EditorTab='quick'\|'about'\|'contact'\|'football'\|'links'\|'brand'\|'highlights'\|'sponsors'(?:\|'match')?/,
  "type EditorTab='quick'|'about'|'contact'|'football'|'links'|'brand'|'highlights'|'sponsors'|'match'"
)

// 2) Remove the duplicate Page editor title/copy/buttons from inside Editor.
src=src.replace(
  /\n const tabs:\[EditorTab,string\]\[\]=\[\['quick','Quick edit'\][\s\S]*?\]\n return <ScrollView style=\{\{flex:1\}\} contentContainerStyle=\{s\.editorContent\} keyboardShouldPersistTaps="handled"><Text style=\{s\.editorTitle\}>Page editor<\/Text><Text style=\{s\.editorCopy\}>Tap anything in the preview or choose a section here\.<\/Text><ScrollView horizontal showsHorizontalScrollIndicator=\{false\} contentContainerStyle=\{s\.editorTabs\}>\{tabs\.map\(\(\[key,label\]\)=><Pressable key=\{key\} onPress=\{\(\)=>setTab\(key\)\} style=\{\[s\.editorTab,tab===key&&s\.editorTabActive\]\}><Text style=\{\[s\.editorTabText,tab===key&&s\.editorTabTextActive\]\}>\{label\}<\/Text><\/Pressable>\)\}<\/ScrollView>/,
  '\n return <ScrollView style={{flex:1}} contentContainerStyle={s.editorContent} keyboardShouldPersistTaps="handled">'
)

// 3) Home is the main editor: expose the old contact/football/links/brand sections there too.
src=src.replace(/\{tab==='contact'\?<Panel/g,"{(tab==='quick'||tab==='contact')?<Panel")
src=src.replace(/\{tab==='football'\?<Panel/g,"{(tab==='quick'||tab==='football')?<Panel")
src=src.replace(/\{tab==='links'\?<Panel/g,"{(tab==='quick'||tab==='links')?<Panel")
src=src.replace(/\{tab==='brand'\?<Panel/g,"{(tab==='quick'||tab==='brand')?<Panel")

// 4) Add an editor state for Match Centre if it is not already there.
if(!src.includes("tab==='match'?<Panel")){
  src=src.replace(
    /\n  \{tab==='highlights'\?<><PhotoPanel/,
    '\n  {tab===\'match\'?<Panel title="Match Centre" icon={<Trophy size={18} color={palette.blue}/>}><Text style={s.hint}>Fixtures, results, ladder, team selection and live match information are connected automatically from PlayFooty. There is nothing to re-enter here.</Text></Panel>:null}\n  {tab===\'highlights\'?<><PhotoPanel'
  )
}

// 5) The visible page tabs under the club name must drive BOTH preview and editor.
if(!src.includes('const editorFor=(key:PreviewTab)')){
  src=src.replace(
    /const tabs:\[PreviewTab,string\]\[\]=\[\['home','Home'\],\['about','About'\],\['highlights','Highlights'\],\['match','Match Centre'\],\['sponsors','Sponsors'\]\]/,
    "const tabs:[PreviewTab,string][]=[['home','Home'],['about','About'],['highlights','Highlights'],['match','Match Centre'],['sponsors','Sponsors']]\n const editorFor=(key:PreviewTab):EditorTab=>key==='home'?'quick':key==='match'?'match':key"
  )
}

src=src.replace(
  /onPress=\{\(\)=>setTab\(key\)\} style=\{\[s\.previewTab/g,
  'onPress={()=>{setTab(key);edit(editorFor(key))}} style={[s.previewTab'
)

// 6) Clicking editable cards in the preview should still land on the right top-level page.
src=src.replace(/edit\('contact'\)/g,"setTab('about');edit('contact')")
src=src.replace(/edit\('football'\)/g,"setTab('about');edit('football')")
src=src.replace(/edit\('links'\)/g,"setTab('home');edit('links')")
src=src.replace(/edit\('brand'\)/g,"setTab('home');edit('brand')")

fs.writeFileSync(path,src)
console.log('Website fixed: top Home/About/Highlights/Match Centre/Sponsors tabs now control the editor; duplicate Page editor navigation removed.')
