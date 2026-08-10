from pathlib import Path
import subprocess

media_original = subprocess.check_output([
    'git','show','c3a6c46ad5fe4e634fe5e48a349f74165a4ae001:src/pages/ClubPortalMedia.tsx'
], text=True)
Path('src/pages/ClubPortalMedia.tsx').write_text(media_original)

studio = subprocess.check_output([
    'git','show','7f9f5acf1c13c4934ec541f1f42a8a305adfb6fa:src/pages/ClubPortalMedia.tsx'
], text=True)
studio = studio.replace('export default function ClubPortalMedia(){','export default function ClubPortalStudio(){',1)
needle = "  <section className=\"studio-grid\">\n"
media_card = "   <Link className=\"studio-card\" to={`/club-portal/${clubId}/media`}><i><Image size={27}/></i><span><small>ASSETS</small><strong>Media Library</strong><p>Upload and reuse player, match, milestone, sponsor and club images from the existing shared media library.</p></span><b>Open library <ArrowRight size={16}/></b></Link>\n"
if media_card not in studio:
    studio = studio.replace(needle, needle + media_card, 1)
Path('src/pages/ClubPortalStudio.tsx').write_text(studio)

main = Path('src/main.tsx')
text = main.read_text()
if "import ClubPortalStudio from './pages/ClubPortalStudio.tsx'" not in text:
    anchor = "import ClubPortalMedia from './pages/ClubPortalMedia.tsx'\n"
    if anchor not in text: raise SystemExit('Studio import anchor missing')
    text = text.replace(anchor, anchor + "import ClubPortalStudio from './pages/ClubPortalStudio.tsx'\n", 1)
studio_route = '    <Route path="/club-portal/:clubId/studio" element={<ClubPortalStudio/>}/>\n'
if studio_route not in text:
    anchor = '    <Route path="/club-portal/:clubId/media" element={<ClubPortalMedia/>}/>\n'
    if anchor not in text: raise SystemExit('Studio route anchor missing')
    text = text.replace(anchor, studio_route + anchor, 1)
main.write_text(text)

nav = Path('src/components/club/ClubPortalAppNav.tsx')
text = nav.read_text()
text = text.replace("const STUDIO_SECTIONS=new Set(['media','news'])", "const STUDIO_SECTIONS=new Set(['studio','media','news'])")
text = text.replace("{label:'Studio',href:`/club-portal/${clubId}/media`,icon:Image,active:STUDIO_SECTIONS.has(section)},", "{label:'Studio',href:`/club-portal/${clubId}/studio`,icon:Image,active:STUDIO_SECTIONS.has(section)},")
text = text.replace("media:'Studio',news:'Newsroom'", "studio:'Studio',media:'Media Library',news:'Newsroom'")
old = " if(STUDIO_SECTIONS.has(section))return[\n  {label:'Studio',description:'Media command centre',href:`/club-portal/${clubId}/media`,icon:Image,active:section==='media'},\n  {label:'Newsroom',description:'Create and publish club stories',href:`/club-portal/${clubId}/news`,icon:ClipboardList,active:section==='news'},\n ]"
new = " if(STUDIO_SECTIONS.has(section))return[\n  {label:'Studio',description:'Media command centre',href:`/club-portal/${clubId}/studio`,icon:Image,active:section==='studio'},\n  {label:'Media Library',description:'Shared club images and assets',href:`/club-portal/${clubId}/media`,icon:Image,active:section==='media'},\n  {label:'Newsroom',description:'Create and publish club stories',href:`/club-portal/${clubId}/news`,icon:ClipboardList,active:section==='news'},\n ]"
if old not in text: raise SystemExit('Studio navigation block missing')
text = text.replace(old,new,1)
nav.write_text(text)
