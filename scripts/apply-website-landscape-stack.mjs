import fs from 'node:fs'

const path='apps/ipad/src/screens/WebsiteScreen.tsx'
let src=fs.readFileSync(path,'utf8')

const oldLayout=`{wide?<View style={s.split}><View style={s.editorPane}><Editor data={data} tab={editorTab} setTab={setEditorTab} patchProfile={patchProfile} patchClub={patchClub} cover={cover} chooseImage={chooseImage} removePhoto={removePhoto} removeCover={removeCover} uploading={uploading} sponsors={sponsors} setSponsors={setSponsors} clubId={club.clubId} token={token}/></View><View style={s.previewPane}><Preview data={data} cover={cover} sponsors={sponsors} tab={previewTab} setTab={setPreviewTab} edit={setEditorTab}/></View></View>:<ScrollView contentContainerStyle={s.mobile}><Preview data={data} cover={cover} sponsors={sponsors} tab={previewTab} setTab={setPreviewTab} edit={setEditorTab}/><Editor data={data} tab={editorTab} setTab={setEditorTab} patchProfile={patchProfile} patchClub={patchClub} cover={cover} chooseImage={chooseImage} removePhoto={removePhoto} removeCover={removeCover} uploading={uploading} sponsors={sponsors} setSponsors={setSponsors} clubId={club.clubId} token={token}/></ScrollView>}`

const newLayout=`{wide?<ScrollView style={s.landscapeScroll} contentContainerStyle={s.landscapeContent} keyboardShouldPersistTaps="handled"><View style={s.landscapePreview}><Preview data={data} cover={cover} sponsors={sponsors} tab={previewTab} setTab={setPreviewTab} edit={setEditorTab}/></View><View style={s.landscapeEditor}><Editor data={data} tab={editorTab} setTab={setEditorTab} patchProfile={patchProfile} patchClub={patchClub} cover={cover} chooseImage={chooseImage} removePhoto={removePhoto} removeCover={removeCover} uploading={uploading} sponsors={sponsors} setSponsors={setSponsors} clubId={club.clubId} token={token}/></View></ScrollView>:<ScrollView contentContainerStyle={s.mobile}><Preview data={data} cover={cover} sponsors={sponsors} tab={previewTab} setTab={setPreviewTab} edit={setEditorTab}/><Editor data={data} tab={editorTab} setTab={setEditorTab} patchProfile={patchProfile} patchClub={patchClub} cover={cover} chooseImage={chooseImage} removePhoto={removePhoto} removeCover={removeCover} uploading={uploading} sponsors={sponsors} setSponsors={setSponsors} clubId={club.clubId} token={token}/></ScrollView>}`

if(!src.includes(oldLayout)) throw new Error('Landscape patch failed: current wide layout not found')
src=src.replace(oldLayout,newLayout)

const styleAnchor="split:{flex:1,flexDirection:'row'},editorPane:{width:390,backgroundColor:'#fff',borderRightWidth:1,borderRightColor:palette.border},previewPane:{flex:1,backgroundColor:'#E9EDF2'},"
const styleReplacement="landscapeScroll:{flex:1,backgroundColor:'#E9EDF2'},landscapeContent:{paddingBottom:48},landscapePreview:{minHeight:560,backgroundColor:'#E9EDF2'},landscapeEditor:{minHeight:760,backgroundColor:'#fff',borderTopWidth:1,borderTopColor:palette.border},split:{flex:1,flexDirection:'row'},editorPane:{width:390,backgroundColor:'#fff',borderRightWidth:1,borderRightColor:palette.border},previewPane:{flex:1,backgroundColor:'#E9EDF2'},"
if(!src.includes(styleAnchor)) throw new Error('Landscape patch failed: style anchor not found')
src=src.replace(styleAnchor,styleReplacement)

fs.writeFileSync(path,src)
console.log('Website landscape layout updated: full-width live preview on top, page editor underneath.')
