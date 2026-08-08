import { Router } from 'express'

export const whiteboardAnalysisRouter=Router()

type Magnet={id?:string;name?:string;number?:number|null;team?:'US'|'THEM';x?:number;y?:number}
type Stroke={tool?:string;points?:Array<{x?:number;y?:number}>}
type Frame={id?:string;name?:string;state?:{magnets?:Magnet[];strokes?:Stroke[]}}
type RequestBody={fixtureLabel?:string;scope?:'frame'|'play';activeFrameId?:string;frames?:Frame[];match?:unknown}
type Analysis={headline:string;summary:string;strengths:string[];risks:string[];adjustments:string[];coachMessage:string}

function clean(value:unknown){return typeof value==='string'?value.trim():''}
function num(value:unknown){const parsed=Number(value);return Number.isFinite(parsed)?parsed:0}
function localAnalysis(body:RequestBody):Analysis{
 const frames=Array.isArray(body.frames)?body.frames:[]
 const active=frames.find(frame=>frame.id===body.activeFrameId)||frames[0]
 const magnets=active?.state?.magnets||[]
 const ours=magnets.filter(item=>item.team==='US')
 const opposition=magnets.filter(item=>item.team==='THEM')
 const forward=ours.filter(item=>num(item.y)<35)
 const defensive=ours.filter(item=>num(item.y)>65)
 const central=ours.filter(item=>num(item.x)>35&&num(item.x)<65)
 const wide=ours.filter(item=>num(item.x)<20||num(item.x)>80)
 const spread=ours.length?Math.max(...ours.map(item=>num(item.x)))-Math.min(...ours.map(item=>num(item.x))):0
 const strengths:string[]=[]
 const risks:string[]=[]
 const adjustments:string[]=[]
 if(central.length>=5)strengths.push('Strong numbers through the central corridor support contest and connection.')
 if(forward.length>=5)strengths.push('The forward structure has enough targets to keep the ground wide and deep.')
 if(spread>=55)strengths.push('Good lateral width should make it harder for the opposition to defend one side.')
 if(defensive.length<5)risks.push('The setup is light behind the ball if possession is lost.')
 if(wide.length<2)risks.push('The structure is narrow and may become predictable under pressure.')
 if(opposition.length&&ours.length&&opposition.filter(item=>num(item.y)<35).length>defensive.length)risks.push('The opposition has an extra forward-side number against the defensive shape.')
 if(defensive.length<5)adjustments.push('Hold one winger or high forward five to ten metres deeper as turnover cover.')
 if(wide.length<2)adjustments.push('Push one player to each outer lane to create a clearer release option.')
 if(frames.length<2&&body.scope==='play')adjustments.push('Add a second frame showing the first movement after possession is won.')
 if(!strengths.length)strengths.push('The board gives the group a clear starting reference point.')
 if(!risks.length)risks.push('The main risk is timing: players must move together rather than independently.')
 if(!adjustments.length)adjustments.push('Add one clear first option and one safety option before presenting the play.')
 return{
  headline:'Tactical structure review',
  summary:`${clean(body.fixtureLabel)||'Current match'}: the board has ${ours.length} team magnets across ${frames.length||1} frame${frames.length===1?'':'s'}. The recommendation is based only on the positions and match data supplied.`,
  strengths:strengths.slice(0,3),risks:risks.slice(0,3),adjustments:adjustments.slice(0,3),
  coachMessage:`Keep the message simple: ${adjustments[0]}`,
 }
}

async function anthropic(apiKey:string,body:RequestBody){
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),14000)
 try{
  const response=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',signal:controller.signal,headers:{'content-type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:process.env.ANTHROPIC_MODEL?.trim()||'claude-sonnet-4-20250514',max_tokens:900,temperature:.15,system:`You are PlayFooty's Australian rules football tactics analyst. Analyse only the supplied whiteboard frames and match data. Coordinates use x=0 left, x=100 right, y=0 attacking goal and y=100 defensive goal. US magnets are the coach's team and THEM magnets are the opposition. Be practical, specific and concise. Do not invent player abilities, opposition tendencies or events. Return valid JSON only with headline, summary, strengths, risks, adjustments and coachMessage. strengths, risks and adjustments must each have 1 to 3 short strings. coachMessage must be one sentence a coach can say to players.`,messages:[{role:'user',content:`Analyse the ${body.scope==='play'?'full animated play':'current frame'} for ${clean(body.fixtureLabel)||'this match'}. Consider spacing, width, depth, numbers behind the ball, contest balance, likely first movement and any supplied live KPIs.\n\nDATA:\n${JSON.stringify(body)}`}]})})
  const payload=await response.json().catch(()=>null) as any
  if(!response.ok)throw new Error(payload?.error?.message||`AI request failed (${response.status})`)
  const text=Array.isArray(payload?.content)?payload.content.find((item:any)=>item?.type==='text')?.text:''
  if(!text)throw new Error('AI returned no tactical analysis')
  return JSON.parse(String(text).replace(/^```json\s*|\s*```$/g,'')) as Analysis
 }finally{clearTimeout(timeout)}
}

whiteboardAnalysisRouter.post('/',async(req,res)=>{
 const body=(req.body||{}) as RequestBody
 if(!Array.isArray(body.frames)||!body.frames.length)return res.status(400).json({error:'At least one whiteboard frame is required'})
 const fallback=localAnalysis(body)
 const apiKey=process.env.ANTHROPIC_API_KEY?.trim()
 if(!apiKey)return res.json({analysis:fallback,source:'tactics-engine',generatedAt:new Date().toISOString()})
 try{
  const analysis=await anthropic(apiKey,body)
  return res.json({analysis,source:'anthropic',generatedAt:new Date().toISOString()})
 }catch(error){
  console.error('Whiteboard tactical analysis fallback',error instanceof Error?error.message:error)
  return res.json({analysis:fallback,source:'tactics-engine',generatedAt:new Date().toISOString()})
 }
})
