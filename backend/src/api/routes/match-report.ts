import { Router } from 'express'

export const matchReportRouter=Router()

type ReportType='quarter'|'full'
type RequestBody={type?:ReportType;quarter?:number;club?:{name?:string;logoUrl?:string|null};match?:unknown}

type Report={headline:string;summary:string;keyStory:string;teamPerformance:string;playerHighlights:string[];rotationInsights:string[];areasToAddress:string[];nextFocus:string[]}

function fallback(body:RequestBody):Report{
 const data=(body.match||{}) as any
 const home=data?.score?.home||{}
 const away=data?.score?.away||{}
 const players=Array.isArray(data?.players)?data.players:[]
 const sorted=[...players].sort((a,b)=>(Number(b.plusMinus)||0)-(Number(a.plusMinus)||0))
 const title=body.type==='full'?'Full-Time Match Report':`Quarter ${Math.max(1,Math.min(4,Number(body.quarter)||1))} Report`
 const score=`${home.name||body.club?.name||'Your team'} ${home.goals||0}.${home.behinds||0} (${home.total||0}) — ${away.name||'Opposition'} ${away.goals||0}.${away.behinds||0} (${away.total||0})`
 return {headline:title,summary:score,keyStory:'The report reflects the live score, team KPIs, player scoring, time on ground, rotations and plus/minus captured in Match Day.',teamPerformance:'Review the strongest KPI and the largest gap before the next period.',playerHighlights:sorted.slice(0,3).map(p=>`${p.name}: ${p.goals||0}.${p.behinds||0}, ${Number(p.plusMinus)>0?'+':''}${p.plusMinus||0} plus/minus, ${p.timeOnGroundPercent||0}% time on ground`),rotationInsights:sorted.slice(-2).map(p=>`${p.name}: ${p.timeOnGroundPercent||0}% time on ground and ${Number(p.plusMinus)>0?'+':''}${p.plusMinus||0} plus/minus`),areasToAddress:['Use the live KPI comparison to identify the clearest area for improvement.'],nextFocus:body.type==='full'?['Use the report in the post-match review.']:['Set one clear priority for the next quarter.']}
}

function extractText(payload:any){
 if(typeof payload?.output_text==='string')return payload.output_text
 const output=Array.isArray(payload?.output)?payload.output:[]
 for(const item of output){for(const part of Array.isArray(item?.content)?item.content:[]){if(part?.type==='output_text'&&typeof part.text==='string')return part.text}}
 return ''
}

matchReportRouter.post('/',async(req,res)=>{
 const body=(req.body||{}) as RequestBody
 const type:ReportType=body.type==='full'?'full':'quarter'
 const quarter=Math.max(1,Math.min(4,Number(body.quarter)||1))
 if(!body.match||typeof body.match!=='object')return res.status(400).json({error:'Match data is required'})
 const local=fallback({...body,type,quarter})
 const apiKey=process.env.OPENAI_API_KEY?.trim()
 if(!apiKey)return res.json({report:local,source:'match-engine',generatedAt:new Date().toISOString()})
 const schema={type:'object',additionalProperties:false,properties:{headline:{type:'string'},summary:{type:'string'},keyStory:{type:'string'},teamPerformance:{type:'string'},playerHighlights:{type:'array',items:{type:'string'},maxItems:5},rotationInsights:{type:'array',items:{type:'string'},maxItems:4},areasToAddress:{type:'array',items:{type:'string'},maxItems:4},nextFocus:{type:'array',items:{type:'string'},maxItems:4}},required:['headline','summary','keyStory','teamPerformance','playerHighlights','rotationInsights','areasToAddress','nextFocus']}
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),20000)
 try{
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:controller.signal,headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MATCH_REPORT_MODEL?.trim()||'gpt-5-mini',store:false,instructions:"You are PlayFooty's professional Australian rules football match analyst. Write for coaches. Use only supplied data and never invent events or statistics. Analyse score, all team KPIs, player goals and behinds, time on ground, interchange status, injuries, positions, plus/minus and event history. Be specific, balanced and professional. Quarter reports should assess that point in the match and set practical next-quarter priorities. Full-time reports should provide a complete match review. Avoid generic motivational language.",input:`Create a ${type==='full'?'full-time':'quarter '+quarter} report for ${body.club?.name||'the team'}. MATCH DATA: ${JSON.stringify(body.match)}`,text:{format:{type:'json_schema',name:'match_report',strict:true,schema}}})})
  const payload=await response.json().catch(()=>null) as any
  if(!response.ok)throw new Error(payload?.error?.message||`OpenAI request failed (${response.status})`)
  const text=extractText(payload);if(!text)throw new Error('OpenAI returned no report')
  const report=JSON.parse(text) as Report
  return res.json({report,source:'openai',model:payload?.model||null,generatedAt:new Date().toISOString()})
 }catch(error){console.error('OpenAI match report fallback',error instanceof Error?error.message:error);return res.json({report:local,source:'match-engine',generatedAt:new Date().toISOString()})}finally{clearTimeout(timeout)}
})
