const API='https://api.anthropic.com/v1/messages'
export type UniversalImageKind='ladder'|'results'|'fixtures'|'goalKickers'|'club'|'league'|'players'|'unknown'
export interface UniversalClassification{kind:UniversalImageKind;confidence:number;reason:string}
function source(image:string){const m=image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);return m?{media_type:m[1],data:m[2]}:{media_type:'image/png',data:image.replace(/^base64,/,'')}}
export async function classifyImportImage(image:string):Promise<UniversalClassification>{
 const key=process.env.ANTHROPIC_API_KEY;if(!key)throw new Error('ANTHROPIC_API_KEY not configured')
 const src=source(image);const prompt=`Classify this community Australian football screenshot into exactly one type: ladder, results, fixtures, goalKickers, club, league, players, unknown. Return ONLY minified JSON: {"kind":"...","confidence":0.0,"reason":"short reason"}. Use results when completed scores are shown, fixtures when future matches/times are shown, goalKickers when player goal totals are listed, players for team/player lists, club or league for profile/contact information.`
 const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:process.env.ANTHROPIC_MODEL??'claude-opus-4-8',max_tokens:250,messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:src.media_type,data:src.data}},{type:'text',text:prompt}]}]}),signal:AbortSignal.timeout(60000)})
 if(!r.ok)throw new Error(`Anthropic API ${r.status}: ${(await r.text()).slice(0,200)}`)
 const body=await r.json() as {content?:{type:string;text?:string}[]};const text=(body.content??[]).filter(x=>x.type==='text').map(x=>x.text??'').join('').replace(/^```(?:json)?/i,'').replace(/```$/,'').trim()
 const p=JSON.parse(text) as Partial<UniversalClassification>;const allowed=new Set(['ladder','results','fixtures','goalKickers','club','league','players','unknown']);return{kind:allowed.has(String(p.kind))?p.kind as UniversalImageKind:'unknown',confidence:Math.max(0,Math.min(1,Number(p.confidence)||0)),reason:String(p.reason??'No reason supplied')}
}
