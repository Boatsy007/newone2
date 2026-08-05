import { Router } from 'express'

export const aiAssistantCoachRouter=Router()

type AnalysisMode='live'|'quarter'
type RequestBody={mode?:AnalysisMode;clubId?:string;quarter?:number;snapshot?:unknown}
type NumericMap=Record<string,number>
type Player={name?:string;position?:string;plusMinus?:number;goals?:number;behinds?:number;onField?:boolean}
type MatchSnapshot={
 score?:{home?:{name?:string;total?:number;detail?:string};away?:{name?:string;total?:number;detail?:string}}
 stats?:Record<string,{home?:NumericMap;away?:NumericMap}>
 players?:Player[]
 clock?:string
}

const MODELS=['claude-sonnet-4-20250514','claude-3-7-sonnet-20250219','claude-3-5-haiku-20241022','claude-3-haiku-20240307']
let cachedModel=''
let cachedUntil=0

function number(value:unknown){const parsed=Number(value);return Number.isFinite(parsed)?parsed:0}
function clean(value:unknown){return typeof value==='string'?value.trim():''}
function stat(snapshot:MatchSnapshot,quarter:number,side:'home'|'away',key:string){return number(snapshot.stats?.[String(quarter)]?.[side]?.[key])}
function margin(snapshot:MatchSnapshot){return number(snapshot.score?.home?.total)-number(snapshot.score?.away?.total)}
function topPlayers(players:Player[],limit=3){return [...players].filter(player=>clean(player.name)).sort((a,b)=>number(b.plusMinus)-number(a.plusMinus)||number(b.goals)-number(a.goals)).slice(0,limit)}
function playerLabel(player:Player){const score=number(player.goals)*6+number(player.behinds);const pieces=[clean(player.name)];if(number(player.plusMinus)!==0)pieces.push(`${number(player.plusMinus)>0?'+':''}${number(player.plusMinus)} plus/minus`);if(score>0)pieces.push(`${number(player.goals)}.${number(player.behinds)}`);return pieces.filter(Boolean).join(' — ')}

function localAnalysis(mode:AnalysisMode,quarter:number,snapshot:MatchSnapshot){
 const homeName=clean(snapshot.score?.home?.name)||'Your team'
 const awayName=clean(snapshot.score?.away?.name)||'Opposition'
 const homeScore=number(snapshot.score?.home?.total)
 const awayScore=number(snapshot.score?.away?.total)
 const scoreMargin=margin(snapshot)
 const comparisons=[
  ['Inside 50s','i50'],['clearances','clr'],['rebound 50s','r50'],['one percenters','one'],['tackles','tkl'],['opposition marks','opm'],['frees against','fa'],
 ] as const
 const differences=comparisons.map(([label,key])=>({label,key,home:stat(snapshot,quarter,'home',key),away:stat(snapshot,quarter,'away',key)}))
 const strengths=differences.filter(item=>item.key!=='opm'&&item.key!=='fa'&&item.home>item.away).sort((a,b)=>(b.home-b.away)-(a.home-a.away))
 const weaknesses=differences.filter(item=>item.key==='opm'||item.key==='fa'?item.home>item.away:item.home<item.away).sort((a,b)=>Math.abs(b.home-b.away)-Math.abs(a.home-a.away))
 const players=Array.isArray(snapshot.players)?snapshot.players:[]
 const leaders=topPlayers(players)
 const scorers=players.filter(player=>number(player.goals)>0).sort((a,b)=>number(b.goals)-number(a.goals))
 const scoreText=`${homeName} ${homeScore}–${awayScore} ${awayName}`
 const leading=scoreMargin>0
 const trailing=scoreMargin<0
 const primaryWeakness=weaknesses[0]
 const primaryStrength=strengths[0]
 const recommendation=primaryWeakness
  ?primaryWeakness.key==='opm'?`Close down the opposition's uncontested marks and force the next possession wider.`
   :primaryWeakness.key==='fa'?`Tighten discipline around the contest and avoid giving away repeat entries.`
   :primaryWeakness.key==='clr'?`Add numbers and first contact at stoppage to regain clearance control.`
   :primaryWeakness.key==='i50'?`Lift forward-half pressure and move the ball more directly to create repeat inside 50s.`
   :primaryWeakness.key==='tkl'?`Increase pressure around the ball carrier and finish tackles.`
   :`Focus on ${primaryWeakness.label} over the next passage of play.`
  :trailing?`Increase pressure at the contest and create the next two scoring opportunities.`
  :`Keep the current structure and protect the next possession after scoring.`

 if(mode==='quarter'){
  const doingWell=[
   primaryStrength?`${primaryStrength.label}: ${primaryStrength.home}–${primaryStrength.away}`:'The team structure has remained competitive.',
   leaders[0]?`${playerLabel(leaders[0])} is providing the strongest impact.`:'Player impact is evenly spread.',
   leading?`Leading by ${scoreMargin} points at the break.`:scoreMargin===0?'Scores are level at the break.':`Still within ${Math.abs(scoreMargin)} points at the break.`,
  ].slice(0,3)
  const improve=[
   primaryWeakness?`${primaryWeakness.label}: ${primaryWeakness.home}–${primaryWeakness.away}.`:'Create a clearer statistical edge after the break.',
   trailing?'Convert the next period of momentum into scoreboard pressure.':'Protect the lead by limiting easy opposition exits.',
   scorers.length<2?'Find more scoring involvement across the forward group.':'Keep multiple forwards involved in scoring chains.',
  ].slice(0,3)
  return{
   headline:`Quarter ${quarter}: ${scoreText}`,
   summary:`${scoreText}. ${primaryStrength?`${homeName} led ${primaryStrength.label.toLowerCase()} ${primaryStrength.home}–${primaryStrength.away}. `:''}${primaryWeakness?`${awayName} held the edge in ${primaryWeakness.label.toLowerCase()} ${primaryWeakness.away}–${primaryWeakness.home}. `:''}${recommendation}`,
   doingWell,
   improve,
   playerNotes:leaders.map(playerLabel),
   nextQuarter:[recommendation,primaryStrength?`Keep using the advantage in ${primaryStrength.label.toLowerCase()}.`:'Win the first five minutes.',`Track the score response and plus/minus of the next rotation.`],
  }
 }
 return{
  headline:primaryWeakness?`Fix the ${primaryWeakness.label} gap`:(leading?'Protect the advantage':'Create the next momentum swing'),
  recommendation,
  reason:primaryWeakness?`${primaryWeakness.label} currently reads ${primaryWeakness.home}–${primaryWeakness.away}.`:`The score is ${scoreText}.`,
  watch:leaders[0]?`Keep ${clean(leaders[0].name)} involved; current plus/minus is ${number(leaders[0].plusMinus)>0?'+':''}${number(leaders[0].plusMinus)}.`:'Watch the impact of the next rotation.',
 }
}

async function callAnthropic(apiKey:string,requestBody:Record<string,unknown>){
 const configured=process.env.ANTHROPIC_MODEL?.trim()
 const candidates=[configured,cachedModel,...MODELS].filter((model,index,list):model is string=>Boolean(model)&&list.indexOf(model)===index)
 let lastError='Anthropic request failed'
 for(const model of candidates){
  const controller=new AbortController()
  const timeout=setTimeout(()=>controller.abort(),12000)
  try{
   const response=await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',signal:controller.signal,
    headers:{'content-type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},
    body:JSON.stringify({...requestBody,model}),
   })
   const payload=await response.json().catch(()=>null) as any
   if(response.ok){cachedModel=model;cachedUntil=Date.now()+60*60*1000;return{payload,model}}
   lastError=payload?.error?.message||`Anthropic request failed (${response.status})`
   const tryNext=response.status===404||/model|not found|permission|access/i.test(lastError)
   if(!tryNext)break
  }catch(error){lastError=error instanceof Error?error.message:'Anthropic request failed'}finally{clearTimeout(timeout)}
 }
 throw new Error(lastError)
}

aiAssistantCoachRouter.post('/',async(req,res)=>{
 const body=(req.body||{}) as RequestBody
 const mode:AnalysisMode=body.mode==='quarter'?'quarter':'live'
 const quarter=Math.max(1,Math.min(4,Number(body.quarter)||1))
 const snapshot=body.snapshot as MatchSnapshot|undefined
 if(!snapshot||typeof snapshot!=='object')return res.status(400).json({error:'Match snapshot is required'})
 const fallback=localAnalysis(mode,quarter,snapshot)
 const apiKey=process.env.ANTHROPIC_API_KEY?.trim()
 if(!apiKey)return res.json({mode,quarter,analysis:fallback,source:'match-engine',generatedAt:new Date().toISOString()})
 try{
  const system=`You are PlayFooty's live Australian rules football assistant coach. Analyse only the supplied match data. Be practical, brief and specific. Never invent events, players or statistics. Interpret I50 as inside 50s, CLR as clearances, R50 as rebound 50s, 1% as one percenters, TKL as tackles, OPM as opposition marks and FA as frees against. Use score, goals, behinds, player scoring, plus/minus, positions, interchange and quarter statistics together. Return valid JSON only.`
  const instruction=mode==='quarter'
   ?`Create an end-of-quarter ${quarter} summary. Return JSON with keys headline, summary, doingWell, improve, playerNotes and nextQuarter. Arrays must contain no more than 3 short strings. Mention the score and key statistical differences. Keep summary under 70 words.`
   :`Create one live coaching recommendation for quarter ${quarter}. Return JSON with keys headline, recommendation, reason and watch. Prioritise one useful action now. Keep the total under 90 words.`
  const {payload,model}=await callAnthropic(apiKey,{max_tokens:700,temperature:0.2,system,messages:[{role:'user',content:`${instruction}\n\nMATCH DATA:\n${JSON.stringify(snapshot)}`}]})
  const text=Array.isArray(payload?.content)?payload.content.find((item:any)=>item?.type==='text')?.text:''
  if(!text)throw new Error('Anthropic returned no analysis')
  let analysis:unknown
  try{analysis=JSON.parse(String(text).replace(/^```json\s*|\s*```$/g,''))}catch{analysis=fallback}
  return res.json({mode,quarter,analysis,model,source:'anthropic',generatedAt:new Date().toISOString()})
 }catch(error){
  console.error('AI assistant coach Anthropic fallback',error instanceof Error?error.message:error)
  return res.json({mode,quarter,analysis:fallback,source:'match-engine',generatedAt:new Date().toISOString()})
 }
})
