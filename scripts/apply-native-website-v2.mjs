import fs from 'node:fs'

const websitePath='apps/ipad/src/screens/WebsiteScreen.tsx'
const serverPath='backend/src/server.ts'

let src=fs.readFileSync(websitePath,'utf8')

function replaceOnce(find,repl,label){
  if(!src.includes(find)) throw new Error(`Website patch failed: ${label}`)
  src=src.replace(find,repl)
}

replaceOnce(
"import { Camera, Check, ChevronRight, Edit3, ExternalLink, Globe2, ImagePlus, Mail, MapPin, Palette, Phone, Save, ShieldCheck, Trash2, Users } from 'lucide-react-native'",
"import { Camera, Check, ChevronRight, Edit3, ExternalLink, Globe2, ImagePlus, Mail, MapPin, Palette, Phone, Save, ShieldCheck, Trash2, Users, Trophy, Handshake, Plus } from 'lucide-react-native'",
'icons')

replaceOnce(
"type Payload={club:ClubMeta;profile:Profile}\ntype SectionKey='preview'|'about'|'contact'|'football'|'links'|'brand'|'photos'",
"type Sponsor={id:string;status?:string;package?:string;tier?:string;ctaLabel?:string|null;ctaUrl?:string|null;sponsor:{id?:string;name:string;businessName?:string|null;logoUrl?:string|null;websiteUrl?:string|null;email?:string|null;phone?:string|null;description?:string|null;industry?:string|null}}\ntype Payload={club:ClubMeta;profile:Profile}\ntype SectionKey='preview'|'about'|'contact'|'football'|'links'|'brand'|'highlights'|'sponsors'\ntype PreviewTab='home'|'about'|'highlights'|'match'|'sponsors'",
'types')

replaceOnce(
"const coverBase=(clubId:string)=>`/club-portal/club-covers/${encodeURIComponent(clubId)}`",
"const coverBase=(clubId:string)=>`/club-portal/club-covers/${encodeURIComponent(clubId)}`\nconst sponsorBase=(clubId:string)=>`/club-portal/sponsors/clubs/${encodeURIComponent(clubId)}/sponsors`",
'sponsor base')

replaceOnce(
"const[data,setData]=useState<Payload|null>(null),[cover,setCover]=useState<string|null>(club.coverImageUrl??null),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[uploading,setUploading]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState(''),[section,setSection]=useState<SectionKey>('preview')",
"const[data,setData]=useState<Payload|null>(null),[cover,setCover]=useState<string|null>(club.coverImageUrl??null),[sponsors,setSponsors]=useState<Sponsor[]>([]),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[uploading,setUploading]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState(''),[section,setSection]=useState<SectionKey>('preview'),[previewTab,setPreviewTab]=useState<PreviewTab>('home')",
'state')

replaceOnce(
"async function load(){setLoading(true);setError('');try{const[p,c]=await Promise.all([apiGet<{data?:Payload}>(base(club.clubId),token),apiGet<{data?:{coverPhotoUrl?:string|null}}>(coverBase(club.clubId),token).catch(()=>({data:{coverPhotoUrl:club.coverImageUrl??null}}))]);if(!p.data)throw new Error('Club profile was not returned');setData({club:p.data.club,profile:{...p.data.profile,gallery:Array.isArray(p.data.profile?.gallery)?p.data.profile.gallery:[],uniformPhotos:Array.isArray(p.data.profile?.uniformPhotos)?p.data.profile.uniformPhotos:[]}});setCover(c.data?.coverPhotoUrl??club.coverImageUrl??null)}catch(reason){setError(reason instanceof Error?reason.message:'Unable to load club website')}finally{setLoading(false)}}",
"async function load(){setLoading(true);setError('');try{const[p,c,sp]=await Promise.all([apiGet<{data?:Payload}>(base(club.clubId),token),apiGet<{data?:{coverPhotoUrl?:string|null}}>(coverBase(club.clubId),token).catch(()=>({data:{coverPhotoUrl:club.coverImageUrl??null}})),apiGet<{data?:Sponsor[]}>(sponsorBase(club.clubId),token).catch(()=>({data:[]}))]);if(!p.data)throw new Error('Club profile was not returned');setData({club:p.data.club,profile:{...p.data.profile,gallery:Array.isArray(p.data.profile?.gallery)?p.data.profile.gallery:[],uniformPhotos:Array.isArray(p.data.profile?.uniformPhotos)?p.data.profile.uniformPhotos:[]}});setCover(c.data?.coverPhotoUrl??club.coverImageUrl??null);setSponsors(Array.isArray(sp.data)?sp.data:[])}catch(reason){setError(reason instanceof Error?reason.message:'Unable to load club website')}finally{setLoading(false)}}",
'load sponsors')

replaceOnce(
"const editor=<Editor data={data} section={section} setSection={setSection} patchProfile={patchProfile} patchClub={patchClub} saving={saving} uploading={uploading} save={save} chooseImage={chooseImage} removePhoto={removePhoto} cover={cover} removeCover={removeCover}/>\n const preview=<Preview data={data} cover={cover} onEdit={(next)=>setSection(next)} onOpenPublic={()=>void Linking.openURL(`https://www.playfooty.com.au/team/${encodeURIComponent(club.clubId)}`)}/>",
"const editor=<Editor data={data} section={section} setSection={setSection} patchProfile={patchProfile} patchClub={patchClub} saving={saving} uploading={uploading} save={save} chooseImage={chooseImage} removePhoto={removePhoto} cover={cover} removeCover={removeCover} sponsors={sponsors} setSponsors={setSponsors} clubId={club.clubId} token={token}/>\n const preview=<Preview data={data} cover={cover} sponsors={sponsors} tab={previewTab} setTab={setPreviewTab} onEdit={(next)=>setSection(next)} onOpenPublic={()=>void Linking.openURL(`https://www.playfooty.com.au/team/${encodeURIComponent(club.clubId)}`)}/>",
'editor preview props')

replaceOnce(
"function Editor({data,section,setSection,patchProfile,patchClub,saving,uploading,save,chooseImage,removePhoto,cover,removeCover}:{data:Payload;section:SectionKey;setSection:(v:SectionKey)=>void;patchProfile:(k:keyof Profile,v:string)=>void;patchClub:(k:'primaryColour'|'secondaryColour',v:string)=>void;saving:boolean;uploading:string;save:()=>Promise<void>;chooseImage:(kind:'cover'|'gallery'|'uniform')=>Promise<void>;removePhoto:(url:string,kind:'gallery'|'uniform')=>Promise<void>;cover:string|null;removeCover:()=>Promise<void>}){",
"function Editor({data,section,setSection,patchProfile,patchClub,saving,uploading,save,chooseImage,removePhoto,cover,removeCover,sponsors,setSponsors,clubId,token}:{data:Payload;section:SectionKey;setSection:(v:SectionKey)=>void;patchProfile:(k:keyof Profile,v:string)=>void;patchClub:(k:'primaryColour'|'secondaryColour',v:string)=>void;saving:boolean;uploading:string;save:()=>Promise<void>;chooseImage:(kind:'cover'|'gallery'|'uniform')=>Promise<void>;removePhoto:(url:string,kind:'gallery'|'uniform')=>Promise<void>;cover:string|null;removeCover:()=>Promise<void>;sponsors:Sponsor[];setSponsors:React.Dispatch<React.SetStateAction<Sponsor[]>>;clubId:string;token:string}){",
'editor signature')

replaceOnce(
"const tabs:[SectionKey,string][]=[['preview','Quick edit'],['about','About'],['contact','Contact'],['football','Football'],['links','Links'],['brand','Brand'],['photos','Photos']]",
"const tabs:[SectionKey,string][]=[['preview','Quick edit'],['about','About'],['contact','Contact'],['football','Football'],['links','Links'],['brand','Brand'],['highlights','Highlights'],['sponsors','Sponsors']]",
'editor tabs')

replaceOnce(
"{section==='photos'?<><PhotoPanel title=\"Club & ground gallery\" photos={p.gallery} kind=\"gallery\" uploading={uploading} chooseImage={chooseImage} removePhoto={removePhoto}/><PhotoPanel title=\"Team & uniform photos\" photos={p.uniformPhotos} kind=\"uniform\" uploading={uploading} chooseImage={chooseImage} removePhoto={removePhoto}/></>:null}",
"{section==='highlights'?<><PhotoPanel title=\"Highlights\" photos={p.gallery} kind=\"gallery\" uploading={uploading} chooseImage={chooseImage} removePhoto={removePhoto}/><PhotoPanel title=\"Team & club photos\" photos={p.uniformPhotos} kind=\"uniform\" uploading={uploading} chooseImage={chooseImage} removePhoto={removePhoto}/></>:null}{section==='sponsors'?<SponsorManager sponsors={sponsors} setSponsors={setSponsors} clubId={clubId} token={token}/>:null}",
'highlights sponsors editor')

const start=src.indexOf('function Preview({data,cover,onEdit,onOpenPublic}')
const end=src.indexOf('\nfunction Panel(',start)
if(start<0||end<0) throw new Error('Website patch failed: preview function block')
const newPreview=String.raw`function Preview({data,cover,sponsors,tab,setTab,onEdit,onOpenPublic}:{data:Payload;cover:string|null;sponsors:Sponsor[];tab:PreviewTab;setTab:(tab:PreviewTab)=>void;onEdit:(key:SectionKey)=>void;onOpenPublic:()=>void}){
 const p=data.profile,primary=safeColour(data.club.primaryColour,'#1478F2')
 const details=useMemo(()=>[[MapPin,text(p.ground)||text(p.address),'contact'],[Mail,text(p.email),'contact'],[Phone,text(p.phone),'contact'],[Users,text(p.trainingNights),'football']].filter(([,value])=>Boolean(value)) as [any,string,SectionKey][],[p.ground,p.address,p.email,p.phone,p.trainingNights])
 const tabs:[PreviewTab,string][]=[['home','Home'],['about','About'],['highlights','Highlights'],['match','Match Centre'],['sponsors','Sponsors']]
 return <ScrollView style={s.previewScroll} contentContainerStyle={s.previewContent} removeClippedSubviews>
  <View style={s.previewHeader}><Text style={s.previewLabel}>LIVE PAGE PREVIEW</Text><Pressable onPress={onOpenPublic} style={s.previewOpen}><ExternalLink size={14} color={palette.blue}/><Text style={s.previewOpenText}>OPEN LIVE</Text></Pressable></View>
  <View style={s.facebookPage}>
   <Pressable onPress={()=>onEdit('preview')} style={s.coverWrap}>{cover?<ImageBackground source={{uri:cover}} style={s.cover} imageStyle={s.coverImage}/>:<View style={[s.cover,{backgroundColor:primary}]}><Text style={s.coverEmpty}>ADD COVER PHOTO</Text></View>}<View style={s.coverEdit}><Camera size={14} color="#fff"/><Text style={s.coverEditText}>EDIT COVER</Text></View></Pressable>
   <View style={s.identity}><View style={s.logoOverlap}>{data.club.logoUrl?<Image source={{uri:data.club.logoUrl}} style={s.pageLogo}/>:<View style={[s.pageLogo,s.logoFallback,{backgroundColor:primary}]}><Text style={s.pageLogoFallback}>{data.club.name.slice(0,2).toUpperCase()}</Text></View>}</View><View style={s.identityCopy}><Text style={s.pageName}>{data.club.name}</Text><Text style={s.pageMeta}>{[data.club.leagueName,data.club.state?.code,data.club.season,data.club.grade].filter(Boolean).join(' · ')}</Text></View></View>
   <View style={s.actionRow}>{p.websiteUrl?<MiniAction text="Website"/>:null}{p.membershipLink?<MiniAction text="Join club" primary/>:null}{p.volunteerLink?<MiniAction text="Volunteer"/>:null}</View>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.publicTabs}>{tabs.map(([key,label])=><Pressable key={key} onPress={()=>setTab(key)}><Text style={[s.publicTab,tab===key&&s.publicTabActive,tab===key&&{color:primary,borderBottomColor:primary}]}>{label}</Text></Pressable>)}</ScrollView>
  </View>
  {tab==='home'?<View style={s.previewColumns}><View style={s.previewMain}><PreviewCard title="About" onEdit={()=>onEdit('about')}><Text style={s.aboutText}>{text(p.history)||'Add a club description so supporters know who you are.'}</Text>{p.foundedYear?<InfoLine label="Founded" value={p.foundedYear}/>:null}{p.clubColours?<InfoLine label="Club colours" value={p.clubColours}/>:null}</PreviewCard>{p.gallery.length?<PreviewCard title="Highlights" onEdit={()=>onEdit('highlights')}><View style={s.previewPhotos}>{p.gallery.slice(0,6).map(url=><Image key={url} source={{uri:url}} style={s.previewPhoto}/>)}</View></PreviewCard>:null}</View><View style={s.previewSide}><PreviewCard title="Club information" onEdit={()=>onEdit('contact')}>{details.length?details.map(([Icon,value,key],i)=><Pressable key={String(value)+'-'+i} onPress={()=>onEdit(key)} style={s.detailRow}><Icon size={16} color={palette.muted}/><Text style={s.detailText}>{value}</Text></Pressable>):<Text style={s.emptyInfo}>Add the club's ground, contact details and training nights.</Text>}{p.president?<InfoLine label="President" value={p.president}/>:null}{p.secretary?<InfoLine label="Secretary" value={p.secretary}/>:null}{p.coach?<InfoLine label="Senior coach" value={p.coach}/>:null}</PreviewCard>{sponsors.length?<PreviewCard title="Sponsors" onEdit={()=>onEdit('sponsors')}><SponsorLogos sponsors={sponsors}/></PreviewCard>:null}</View></View>:null}
  {tab==='about'?<View style={s.singlePreview}><PreviewCard title="About the club" onEdit={()=>onEdit('about')}><Text style={s.aboutText}>{text(p.history)||'No club story added yet.'}</Text>{p.foundedYear?<InfoLine label="Founded" value={p.foundedYear}/>:null}{p.clubColours?<InfoLine label="Club colours" value={p.clubColours}/>:null}{p.committee?<InfoLine label="Committee" value={p.committee}/>:null}{p.president?<InfoLine label="President" value={p.president}/>:null}{p.secretary?<InfoLine label="Secretary" value={p.secretary}/>:null}{p.coach?<InfoLine label="Senior coach" value={p.coach}/>:null}{p.assistantCoach?<InfoLine label="Assistant coach" value={p.assistantCoach}/>:null}{p.ground?<InfoLine label="Home ground" value={p.ground}/>:null}{p.trainingNights?<InfoLine label="Training" value={p.trainingNights}/>:null}</PreviewCard></View>:null}
  {tab==='highlights'?<View style={s.singlePreview}><PreviewCard title="Highlights" onEdit={()=>onEdit('highlights')}>{[...p.gallery,...p.uniformPhotos].length?<View style={s.highlightGrid}>{[...p.gallery,...p.uniformPhotos].slice(0,12).map((url,i)=><Image key={url+i} source={{uri:url}} style={s.highlightPhoto}/>)}</View>:<Text style={s.emptyInfo}>No highlights uploaded yet.</Text>}</PreviewCard></View>:null}
  {tab==='match'?<View style={s.singlePreview}><View style={s.previewCard}><View style={s.previewCardHead}><Text style={s.previewCardTitle}>Match Centre</Text><Trophy size={18} color={primary}/></View><Text style={s.aboutText}>Fixtures, results, ladder, team selection and live match information come from PlayFooty's connected football data. Clubs do not need to type them twice.</Text><Pressable onPress={onOpenPublic} style={s.matchButton}><Text style={s.matchButtonText}>OPEN LIVE MATCH CENTRE</Text><ChevronRight size={15} color="#fff"/></Pressable></View></View>:null}
  {tab==='sponsors'?<View style={s.singlePreview}><PreviewCard title="Club sponsors" onEdit={()=>onEdit('sponsors')}>{sponsors.length?<SponsorLogos sponsors={sponsors}/>:<Text style={s.emptyInfo}>No sponsors added yet.</Text>}</PreviewCard></View>:null}
 </ScrollView>
}

function SponsorLogos({sponsors}:{sponsors:Sponsor[]}){return <View style={s.sponsorLogoGrid}>{sponsors.slice(0,12).map(item=><View key={item.id} style={s.sponsorLogoCard}>{item.sponsor.logoUrl?<Image source={{uri:item.sponsor.logoUrl}} style={s.sponsorLogo}/>:<View style={s.sponsorLogoFallback}><Handshake size={18} color={palette.blue}/></View>}<Text numberOfLines={2} style={s.sponsorLogoName}>{item.sponsor.name}</Text></View>)}</View>}

function SponsorManager({sponsors,setSponsors,clubId,token}:{sponsors:Sponsor[];setSponsors:React.Dispatch<React.SetStateAction<Sponsor[]>>;clubId:string;token:string}){
 const[name,setName]=useState(''),[websiteUrl,setWebsiteUrl]=useState(''),[description,setDescription]=useState(''),[email,setEmail]=useState(''),[phone,setPhone]=useState(''),[tier,setTier]=useState('CLUB'),[busy,setBusy]=useState(false),[msg,setMsg]=useState('')
 async function add(){if(!name.trim()||busy)return;setBusy(true);setMsg('');try{const r=await apiRequest<{data?:Sponsor;message?:string}>(sponsorBase(clubId),{accessToken:token,method:'POST',body:{name:name.trim(),businessName:name.trim(),websiteUrl:websiteUrl.trim()||null,description:description.trim()||null,email:email.trim()||null,phone:phone.trim()||null,tier,package:'CLUB_PARTNER',bannerPosition:'CLUB_PROFILE',ctaLabel:'Visit sponsor',ctaUrl:websiteUrl.trim()||null}});if(r.data)setSponsors(current=>[r.data!,...current]);setName('');setWebsiteUrl('');setDescription('');setEmail('');setPhone('');setMsg(r.message||'Sponsor saved')}catch(e){setMsg(e instanceof Error?e.message:'Unable to add sponsor')}finally{setBusy(false)}}
 return <><Panel icon={<Handshake size={18} color={palette.blue}/>} title="Sponsors" copy="Add sponsors once and they can appear on the club website and across PlayFooty."><Field label="Sponsor name" value={name} set={setName}/><Field label="Website" value={websiteUrl} set={setWebsiteUrl}/><Field label="Description" value={description} set={setDescription} multiline/><Field label="Email" value={email} set={setEmail}/><Field label="Phone" value={phone} set={setPhone}/><Field label="Tier" value={tier} set={setTier}/><Pressable disabled={!name.trim()||busy} onPress={()=>void add()} style={[s.bigAction,(!name.trim()||busy)&&s.disabled]}>{busy?<ActivityIndicator color="#fff"/>:<Plus size={18} color="#fff"/>}<Text style={s.bigActionText}>ADD SPONSOR</Text></Pressable>{msg?<Text style={s.smallCopy}>{msg}</Text>:null}</Panel><Panel icon={<Users size={18} color={palette.blue}/>} title="Current sponsors" copy="Sponsors already attached to this club.">{sponsors.length?sponsors.map(item=><View key={item.id} style={s.sponsorRow}>{item.sponsor.logoUrl?<Image source={{uri:item.sponsor.logoUrl}} style={s.sponsorRowLogo}/>:<View style={s.sponsorRowLogo}/>}<View style={{flex:1}}><Text style={s.sponsorRowName}>{item.sponsor.name}</Text><Text style={s.smallCopy}>{[item.tier,item.status].filter(Boolean).join(' · ')}</Text></View></View>):<Text style={s.emptyInfo}>No sponsors yet.</Text>}</Panel></>}
`
src=src.slice(0,start)+newPreview+src.slice(end)

replaceOnce(
"mobileContent:{padding:14,paddingBottom:50,gap:12},mobileLabel:",
"singlePreview:{marginTop:12},highlightGrid:{flexDirection:'row',flexWrap:'wrap',gap:7},highlightPhoto:{width:'32%',aspectRatio:1.25,borderRadius:9,resizeMode:'cover'},matchButton:{marginTop:8,minHeight:44,borderRadius:9,backgroundColor:palette.blue,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},matchButtonText:{fontSize:9,fontWeight:'900',color:'#fff'},sponsorLogoGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},sponsorLogoCard:{width:'31%',minHeight:92,borderRadius:10,borderWidth:1,borderColor:palette.border,backgroundColor:'#fff',alignItems:'center',justifyContent:'center',padding:8},sponsorLogo:{width:54,height:46,resizeMode:'contain'},sponsorLogoFallback:{width:54,height:46,alignItems:'center',justifyContent:'center',backgroundColor:palette.blueSoft,borderRadius:8},sponsorLogoName:{fontSize:8,fontWeight:'800',color:palette.ink,textAlign:'center',marginTop:5},sponsorRow:{minHeight:58,flexDirection:'row',alignItems:'center',gap:10,paddingVertical:7,borderBottomWidth:1,borderBottomColor:palette.border},sponsorRowLogo:{width:44,height:44,borderRadius:8,backgroundColor:palette.blueSoft,resizeMode:'contain'},sponsorRowName:{fontSize:11,fontWeight:'900',color:palette.ink},mobileContent:{padding:14,paddingBottom:50,gap:12},mobileLabel:",
'new styles')

fs.writeFileSync(websitePath,src)

let server=fs.readFileSync(serverPath,'utf8')
if(!server.includes("clubPortalSponsorsRouter")){
  const anchor="import { clubPortalAccessRouter } from './api/routes/club-portal-access.js'"
  if(!server.includes(anchor)) throw new Error('Server patch failed: import anchor')
  server=server.replace(anchor,anchor+"\nimport { clubPortalSponsorsRouter } from './api/routes/club-portal-sponsors.js'")
  const route="app.use('/api/club-portal', clubPortalAccessRouter)"
  if(!server.includes(route)) throw new Error('Server patch failed: route anchor')
  server=server.replace(route,"app.use('/api/club-portal/sponsors', clubPortalSponsorsRouter)\n"+route)
  fs.writeFileSync(serverPath,server)
}

console.log('Website V2 applied: clickable preview tabs, Highlights, Match Centre, Sponsors, sponsor add flow, and lighter preview rendering.')