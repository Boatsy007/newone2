import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require=createRequire(import.meta.url)
const ts=require('../apps/ipad/node_modules/typescript')
const root=process.cwd()
const screensDir=path.join(root,'apps/ipad/src/screens')
const componentsDir=path.join(root,'apps/ipad/src/components')
const themePath=path.join(root,'apps/ipad/src/theme.ts')

if(!fs.existsSync(screensDir))throw new Error('Run this from the playfooty-ipad repository root')

fs.writeFileSync(themePath,`export const palette = {
  blue: '#176BFF',
  blueDark: '#0F4FD1',
  blueSoft: '#EEF5FF',
  canvas: '#F7F8FB',
  surface: '#FFFFFF',
  border: '#EDF0F4',
  ink: '#171C27',
  muted: '#858E9E',
  green: '#20B86A',
  orange: '#FF9F2D',
  purple: '#7C4DFF',
  pink: '#EC4899',
  red: '#EF5B78',
} as const
`)

const textLike=/title|label|copy|text|meta|value|eyebrow|name|description|note|caption|sub|hint|number|count|score|initial|role/i
const containerLike=/card|panel|tile|metric|stat$|kpi|box$|section$|sheet$|modal|workspace|hero$|preview$|empty$|alert$|result$|rowCard|flowCard|toolCard|memberCard|productCard|settingCard|actionCard/i
const inputLike=/input|field|search|picker|select|textarea/i
const chipLike=/chip|pill|badge|tab$|filter|segment/i
const buttonLike=/button|action$|primary$|secondary$|refresh$|save$|back$|cta/i
const iconLike=/icon|logo|avatar|mark|dot/i

function propName(node,sf){
 if(ts.isIdentifier(node.name)||ts.isStringLiteral(node.name)||ts.isNumericLiteral(node.name))return String(node.name.text)
 return node.name.getText(sf)
}
function objectMap(obj,sf){
 const map=new Map(); const extras=[]
 for(const p of obj.properties){
  if(ts.isPropertyAssignment(p))map.set(propName(p,sf),p.initializer.getText(sf))
  else if(ts.isShorthandPropertyAssignment(p))map.set(propName(p,sf),p.name.getText(sf))
  else extras.push(p.getText(sf))
 }
 return {map,extras}
}
function set(map,key,val){map.set(key,val)}
function del(map,...keys){for(const k of keys)map.delete(k)}
function numFrom(v){if(!v)return null;const n=Number(String(v).replace(/[^0-9.\-]/g,''));return Number.isFinite(n)?n:null}
function capFont(map,max,min=undefined){const n=numFrom(map.get('fontSize'));if(n!=null){let v=Math.min(n,max);if(min!=null)v=Math.max(v,min);set(map,'fontSize',String(v))}}
function premiumCard(map){
 set(map,'backgroundColor',"'#FFFFFF'");set(map,'borderWidth','1');set(map,'borderColor',"'#EDF0F4'");set(map,'borderRadius','12')
 del(map,'shadowColor','shadowOpacity','shadowRadius','shadowOffset','elevation')
 set(map,'shadowColor',"'#101828'");set(map,'shadowOpacity','0.025');set(map,'shadowRadius','6');set(map,'shadowOffset','{width:0,height:2}');set(map,'elevation','1')
}
function applyRules(name,map){
 const lower=name.toLowerCase()
 if(['page','screen','root','app','workspace'].includes(lower)||/page$/.test(lower)){set(map,'backgroundColor',"'#F7F8FB'")}
 if(/^(topbar|header|pageheader|toolbar|top)$/.test(lower)||/topbar|pageheader/.test(lower)){
  set(map,'backgroundColor',"'#FFFFFF'");set(map,'borderBottomWidth','1');set(map,'borderBottomColor',"'#EFF1F5'")
  const h=numFrom(map.get('height'));if(h!=null&&h>64)set(map,'height','58')
  const ph=numFrom(map.get('paddingHorizontal'));if(ph!=null&&ph>18)set(map,'paddingHorizontal','16')
 }
 if((lower==='content'||lower==='container'||lower==='scrollcontent'||lower==='body')&&map.has('padding')){
  const n=numFrom(map.get('padding'));if(n!=null&&n>14)set(map,'padding','14')
 }
 if((lower==='content'||lower==='container'||lower==='scrollcontent'||lower==='body')&&map.has('gap')){
  const n=numFrom(map.get('gap'));if(n!=null&&n>10)set(map,'gap','10')
 }
 if(containerLike.test(name)&&!textLike.test(name)&&!iconLike.test(name))premiumCard(map)
 if(inputLike.test(name)&&!textLike.test(name)){
  set(map,'backgroundColor',"'#FAFBFD'");set(map,'borderWidth','1');set(map,'borderColor',"'#E9EDF3'");set(map,'borderRadius','9')
 }
 if(chipLike.test(name)&&!textLike.test(name)){
  if(!/active|selected|done|good|warn|bad/i.test(name))set(map,'backgroundColor',"'#F7F9FC'")
  set(map,'borderRadius','8')
 }
 if(buttonLike.test(name)&&!textLike.test(name)&&!iconLike.test(name)){
  const br=numFrom(map.get('borderRadius'));if(br==null||br>10)set(map,'borderRadius','9')
  const h=numFrom(map.get('height'));if(h!=null&&h>44)set(map,'height','40')
 }
 if(/title/i.test(name)&&!/(container|card$|panel$)/i.test(name)){capFont(map,/hero|page|screen|header/i.test(name)?20:16);set(map,'fontWeight',"'800'")}
 if(/subtitle|copy|description|meta|note|hint|caption/i.test(name)){capFont(map,11);if(map.has('color'))set(map,'color',"'#858E9E'")}
 if(/eyebrow/i.test(name)){capFont(map,8);set(map,'fontWeight',"'900'");set(map,'letterSpacing','1')}
 if(/label/i.test(name)&&!/(active|selected)/i.test(name)){capFont(map,10)}
 if(/value|number|count|score/i.test(name)&&!/(input|field)/i.test(name)){capFont(map,22);if(map.has('fontWeight'))set(map,'fontWeight',"'800'")}
 if(/active|selected/i.test(name)&&map.get('backgroundColor')&&String(map.get('backgroundColor')).includes('palette.blue')){set(map,'shadowColor',"'#176BFF'");set(map,'shadowOpacity','0.12');set(map,'shadowRadius','8');set(map,'shadowOffset','{width:0,height:3}')}
 // Remove very heavy legacy shadows from any remaining style.
 const op=numFrom(map.get('shadowOpacity'));if(op!=null&&op>0.12)set(map,'shadowOpacity','0.08')
 const radius=numFrom(map.get('shadowRadius'));if(radius!=null&&radius>12)set(map,'shadowRadius','10')
}
function rebuildObject(obj,sf,name){
 const {map,extras}=objectMap(obj,sf);applyRules(name,map)
 const props=[...map.entries()].map(([k,v])=>`${k}:${v}`)
 return `{${[...props,...extras].join(',')}}`
}
function transformFile(file){
 const src=fs.readFileSync(file,'utf8')
 const sf=ts.createSourceFile(file,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
 const edits=[]
 function visit(node){
  if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='create'&&node.expression.expression.getText(sf)==='StyleSheet'&&node.arguments[0]&&ts.isObjectLiteralExpression(node.arguments[0])){
   const styles=node.arguments[0]
   for(const p of styles.properties){
    if(ts.isPropertyAssignment(p)&&ts.isObjectLiteralExpression(p.initializer)){
     const name=propName(p,sf);const replacement=rebuildObject(p.initializer,sf,name)
     edits.push({start:p.initializer.getStart(sf),end:p.initializer.getEnd(),text:replacement})
    }
   }
  }
  ts.forEachChild(node,visit)
 }
 visit(sf)
 if(!edits.length)return false
 edits.sort((a,b)=>b.start-a.start)
 let out=src
 for(const e of edits)out=out.slice(0,e.start)+e.text+out.slice(e.end)
 if(out!==src){fs.writeFileSync(file,out);return true}
 return false
}

const targets=[]
for(const dir of [screensDir,componentsDir]){
 if(!fs.existsSync(dir))continue
 for(const name of fs.readdirSync(dir))if(name.endsWith('.tsx'))targets.push(path.join(dir,name))
}
let changed=0
for(const file of targets){if(transformFile(file))changed++}

// Sidebar gets a deliberate reference-style layout, not just token changes.
const sidebarPath=path.join(componentsDir,'Sidebar.tsx')
if(fs.existsSync(sidebarPath)){
 let src=fs.readFileSync(sidebarPath,'utf8')
 const sf=ts.createSourceFile(sidebarPath,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
 // Transformer above already modernised its StyleSheet. Add tighter sidebar proportions by direct safe value replacements.
 src=src.replace(/width:\s*(?:190|200|210|218|220|230)/g,'width:176')
 src=src.replace(/height:\s*(?:38|40|42),borderRadius:\s*(?:9|10|11)/g,'height:36,borderRadius:8')
 fs.writeFileSync(sidebarPath,src)
}

console.log(`Full native UI overhaul applied to ${changed} TSX files.`)
console.log('Visual system: compact white chrome, light canvas, modern cards, refined inputs/buttons, tighter typography and spacing.')
console.log('Screen logic, routes, API calls, state, data models and workflows were not intentionally changed.')
console.log('Next: cd apps/ipad && npm run typecheck')
