import { Router } from 'express'

export const aiAssistantCoachRouter=Router()

type AnalysisMode='live'|'quarter'
type RequestBody={mode?:AnalysisMode;clubId?:string;quarter?:number;snapshot?:unknown}
type AnthropicModel={id?:string;display_name?:string}

const FALLBACK_MODELS=['claude-sonnet-4-20250514','claude-3-7-sonnet-20250219','claude-3-5-haiku-20241022','claude-3-haiku-20240307']
let cachedModel=''
let cachedUntil=0

async function resolveAnthropicModel(apiKey:string){
 const configured=process.env.ANTHROPIC_MODEL?.trim()
 if(configured)return configured
 if(cachedModel&&Date.now()<cachedUntil)return cachedModel
 try{
  const response=await fetch('https://api.anthropic.com/v1/models?limit=100',{
   headers:{'x-api-key':apiKey,'anthropic-version':'2023-06-01'},
  })
  const payload=await response.json().catch(()=>null) as {data?:AnthropicModel[]}|null
  if(response.ok&&Array.isArray(payload?.data)){
   const ids=payload.data.map(item=>item.id).filter((id):id is string=>Boolean(id))
   const preferred=ids.find(id=>/sonnet/i.test(id))||ids.find(id=>/haiku/i.test(id))||ids[0]
   if(preferred){cachedModel=preferred;cachedUntil=Date.now()+60*60*1000;return preferred}
  }
 }catch(error){console.warn('Unable to list Anthropic models',error)}
 return FALLBACK_MODELS[0]
}

async function callAnthropic(apiKey:string,requestBody:Record<string,unknown>){
 const preferred=await resolveAnthropicModel(apiKey)
 const candidates=[preferred,...FALLBACK_MODELS].filter((model,index,list)=>model&&list.indexOf(model)===index)
 let lastError='Anthropic request failed'
 for(const model of candidates){
  const response=await fetch('https://api.anthropic.com/v1/messages',{
   method:'POST',
   headers:{'content-type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},
   body:JSON.stringify({...requestBody,model}),
  })
  const payload=await response.json().catch(()=>null) as any
  if(response.ok){cachedModel=model;cachedUntil=Date.now()+60*60*1000;return{payload,model}}
  lastError=payload?.error?.message||`Anthropic request failed (${response.status})`
  const modelProblem=response.status===404||/model|not found|permission/i.test(lastError)
  if(!modelProblem)throw new Error(lastError)
 }
 throw new Error(lastError)
}

aiAssistantCoachRouter.post('/',async(req,res)=>{
 try{
  const apiKey=process.env.ANTHROPIC_API_KEY?.trim()
  if(!apiKey)return res.status(503).json({error:'AI Assistant Coach is not configured'})
  const body=(req.body||{}) as RequestBody
  const mode:AnalysisMode=body.mode==='quarter'?'quarter':'live'
  const quarter=Math.max(1,Math.min(4,Number(body.quarter)||1))
  const snapshot=body.snapshot
  if(!snapshot||typeof snapshot!=='object')return res.status(400).json({error:'Match snapshot is required'})
  const system=`You are PlayFooty's live Australian rules football assistant coach. Analyse only the supplied match data. Be practical, brief and specific. Never invent events, players or statistics. Interpret I50 as inside 50s, CLR as clearances, R50 as rebound 50s, 1% as one percenters, TKL as tackles, OPM as opposition marks and FA as frees against. Use score, goals, behinds, player scoring, plus/minus, positions, interchange and quarter statistics together. Return valid JSON only.`
  const instruction=mode==='quarter'
   ?`Create an end-of-quarter ${quarter} summary. Return JSON with keys headline, summary, doingWell, improve, playerNotes and nextQuarter. doingWell, improve, playerNotes and nextQuarter must each be arrays of no more than 3 short strings. Mention the score and the most important statistical differences. Keep summary under 70 words.`
   :`Create one live coaching recommendation for quarter ${quarter}. Return JSON with keys headline, recommendation, reason and watch. Each value must be a short string. Prioritise the single most useful action right now. Keep the total under 90 words.`
  const {payload,model}=await callAnthropic(apiKey,{
   max_tokens:700,
   temperature:0.2,
   system,
   messages:[{role:'user',content:`${instruction}\n\nMATCH DATA:\n${JSON.stringify(snapshot)}`}],
  })
  const text=Array.isArray(payload?.content)?payload.content.find((item:any)=>item?.type==='text')?.text:''
  if(!text)return res.status(502).json({error:'The AI coach returned no analysis'})
  let analysis:unknown
  try{analysis=JSON.parse(String(text).replace(/^```json\s*|\s*```$/g,''))}catch{analysis={headline:'Assistant coach',recommendation:String(text)}}
  return res.json({mode,quarter,analysis,model,generatedAt:new Date().toISOString()})
 }catch(error){
  const message=error instanceof Error?error.message:'Unable to generate assistant coach analysis'
  console.error('AI assistant coach failed',message)
  const safe=/credit|billing|balance/i.test(message)?'Anthropic API billing or credits need attention':'The AI coach could not analyse the match. Try again shortly.'
  return res.status(502).json({error:safe})
 }
})
