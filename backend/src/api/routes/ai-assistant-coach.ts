import { Router } from 'express'

export const aiAssistantCoachRouter=Router()

type AnalysisMode='live'|'quarter'

type RequestBody={
 mode?:AnalysisMode
 clubId?:string
 quarter?:number
 snapshot?:unknown
}

aiAssistantCoachRouter.post('/',async(req,res)=>{
 try{
  const apiKey=process.env.ANTHROPIC_API_KEY
  if(!apiKey)return res.status(503).json({error:'AI assistant is not configured'})
  const body=(req.body||{}) as RequestBody
  const mode:AnalysisMode=body.mode==='quarter'?'quarter':'live'
  const quarter=Math.max(1,Math.min(4,Number(body.quarter)||1))
  const snapshot=body.snapshot
  if(!snapshot||typeof snapshot!=='object')return res.status(400).json({error:'Match snapshot is required'})
  const system=`You are PlayFooty's live Australian rules football assistant coach. Analyse only the supplied match data. Be practical, brief and specific. Never invent events, players or statistics. Interpret I50 as inside 50s, CLR as clearances, R50 as rebound 50s, 1% as one percenters, TKL as tackles, OPM as opposition marks and FA as frees against. Use score, goals, behinds, player scoring, plus/minus, positions, interchange and quarter statistics together. Return valid JSON only.`
  const instruction=mode==='quarter'
   ?`Create an end-of-quarter ${quarter} summary. Return JSON with keys headline, summary, doingWell, improve, playerNotes and nextQuarter. doingWell, improve, playerNotes and nextQuarter must each be arrays of no more than 3 short strings. Mention the score and the most important statistical differences. Keep summary under 70 words.`
   :`Create one live coaching recommendation for quarter ${quarter}. Return JSON with keys headline, recommendation, reason and watch. Each value must be a short string. Prioritise the single most useful action right now. Keep the total under 90 words.`
  const response=await fetch('https://api.anthropic.com/v1/messages',{
   method:'POST',
   headers:{'content-type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},
   body:JSON.stringify({
    model:process.env.ANTHROPIC_MODEL||'claude-sonnet-4-20250514',
    max_tokens:700,
    temperature:0.2,
    system,
    messages:[{role:'user',content:`${instruction}\n\nMATCH DATA:\n${JSON.stringify(snapshot)}`}],
   }),
  })
  const payload=await response.json().catch(()=>null) as any
  if(!response.ok)return res.status(502).json({error:payload?.error?.message||'Anthropic request failed'})
  const text=Array.isArray(payload?.content)?payload.content.find((item:any)=>item?.type==='text')?.text:''
  if(!text)return res.status(502).json({error:'Anthropic returned no analysis'})
  let analysis:unknown
  try{analysis=JSON.parse(String(text).replace(/^```json\s*|\s*```$/g,''))}catch{analysis={headline:'Assistant coach',recommendation:String(text)}}
  return res.json({mode,quarter,analysis,generatedAt:new Date().toISOString()})
 }catch(error){
  console.error('AI assistant coach failed',error)
  return res.status(500).json({error:'Unable to generate assistant coach analysis'})
 }
})
