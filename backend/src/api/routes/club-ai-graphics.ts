import { Router } from 'express'
import { authenticateClubUser, membershipForClub, requireActiveClubMembership, roleCan } from '../../auth/club-auth.js'

const router = Router()
const clean = (value: unknown, max = 160) => String(value ?? '').trim().slice(0, max)
const isHex=(value:string)=>/^#[0-9a-f]{6}$/i.test(value)

async function requireMedia(req:any,res:any,next:any){
  const membership=res.locals.clubMembership as Awaited<ReturnType<typeof membershipForClub>>
  if(!membership||!roleCan(membership.role,'media'))return res.status(403).json({error:'Your club role cannot create media graphics'})
  next()
}

router.use(authenticateClubUser)
router.use('/clubs/:clubId',requireActiveClubMembership,requireMedia)

async function openAiJson(prompt:string){
  const apiKey=process.env.OPENAI_API_KEY||''
  if(!apiKey)throw Object.assign(new Error('AI generation is not configured. Add OPENAI_API_KEY to the backend environment.'),{status:503})
  const response=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},
    body:JSON.stringify({model:process.env.OPENAI_STUDIO_MODEL||'gpt-4.1-mini',input:prompt,text:{format:{type:'json_object'}}})
  })
  const payload=await response.json().catch(()=>({})) as any
  if(!response.ok)throw Object.assign(new Error(payload?.error?.message||'AI planning generation failed'),{status:response.status===429?429:502})
  const raw=payload?.output_text||payload?.output?.flatMap((item:any)=>item?.content||[]).map((item:any)=>item?.text||'').join('')||''
  try{return JSON.parse(raw)}catch{throw Object.assign(new Error('AI planning service returned invalid output'),{status:502})}
}

async function openAiBackground(prompt:string){
  const apiKey=process.env.OPENAI_API_KEY||''
  if(!apiKey)throw Object.assign(new Error('AI image generation is not configured. Add OPENAI_API_KEY to the backend environment.'),{status:503})
  const response=await fetch('https://api.openai.com/v1/images/generations',{
    method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},
    body:JSON.stringify({model:'gpt-image-1',prompt,size:'1024x1536',quality:'medium',background:'opaque',output_format:'png'})
  })
  const payload=await response.json().catch(()=>({})) as any
  if(!response.ok)throw Object.assign(new Error(payload?.error?.message||'AI background generation failed'),{status:response.status===429?429:502})
  const base64=payload?.data?.[0]?.b64_json
  if(!base64)throw Object.assign(new Error('AI image service returned no background image'),{status:502})
  return `data:image/png;base64,${base64}`
}

router.post('/clubs/:clubId/team-background',async(req,res)=>{
  try{
    const clubName=clean(req.body?.clubName)||'Australian football club'
    const opponentName=clean(req.body?.opponentName)||'opposition'
    const primary=clean(req.body?.primaryColour,20)||'#0b2f6b'
    const secondary=clean(req.body?.secondaryColour,20)||'#f4b000'
    const style=clean(req.body?.style,180)||'premium'
    const prompt=[
      `Create a premium vertical social-media background for an Australian rules football team selection announcement.`,
      `Club: ${clubName}. Opponent: ${opponentName}.`,
      `Use ${primary} as the dominant colour and ${secondary} as the accent colour.`,
      `Style: ${style}, elite sports broadcast design, dramatic stadium atmosphere, subtle field markings, strong depth and lighting.`,
      `Use one continuous full-bleed composition with no central rectangle, no boxed panel, no frame and no border.`,
      `Leave clear visual space for a structured team list and for club logos and a headline.`,
      `Do not include any words, letters, numbers, player names, logos, badges, sponsor marks, people, faces or watermarks.`,
      `The image must function only as a background template with excellent text contrast.`
    ].join(' ')
    const dataUrl=await openAiBackground(prompt)
    res.set('Cache-Control','no-store')
    res.json({data:{dataUrl,model:'gpt-image-1'}})
  }catch(error:any){res.status(error?.status||500).json({error:error?.message||'Unable to generate AI background'})}
})

router.post('/clubs/:clubId/studio-package',async(req,res)=>{
  try{
    const kind=clean(req.body?.kind,20).toUpperCase()
    if(kind!=='EVENT'&&kind!=='FUNDRAISING')return res.status(400).json({error:'kind must be EVENT or FUNDRAISING'})
    const wantsPoster=req.body?.wantsPoster!==false
    const wantsPlan=req.body?.wantsPlan!==false
    if(!wantsPoster&&!wantsPlan)return res.status(400).json({error:'Choose a plan, poster or both.'})
    const clubName=clean(req.body?.club?.name,140)||'Community Football Club'
    const primaryRaw=clean(req.body?.club?.primaryColour,20)
    const secondaryRaw=clean(req.body?.club?.secondaryColour,20)
    const primary=isHex(primaryRaw)?primaryRaw:'#0b73b9'
    const secondary=isHex(secondaryRaw)?secondaryRaw:'#42b8ff'
    const style=clean(req.body?.style,80)||'AUTO'
    const subtype=clean(req.body?.subtype,140)||kind
    const supplied=req.body?.answers&&typeof req.body.answers==='object'?req.body.answers:{}
    const answers=Object.fromEntries(Object.entries(supplied).slice(0,80).map(([key,value])=>[clean(key,60),clean(value,1800)]).filter(([,value])=>Boolean(value)))
    const disclaimer=kind==='EVENT'
      ?'Planning guide only. PlayFooty does not provide legal, safety, medical, licensing, insurance or regulatory advice. The club is responsible for checking all applicable local, state/territory and federal laws, permits, licences, venue conditions, league/governing-body requirements, child-safety obligations, food and alcohol rules, insurance requirements and professional advice relevant to the event before proceeding.'
      :'PlayFooty provides planning and promotional guidance only. It does not provide legal, financial, tax, gambling, fundraising, licensing, insurance, safety or regulatory advice. Clubs are responsible for confirming all applicable laws, permits, licences, tax obligations, fundraising and gaming rules, venue requirements, league/governing-body requirements, insurance conditions and professional advice before conducting a fundraising activity.'
    const coverage=kind==='EVENT'
      ?'objectives; assumptions and information still to confirm; pre-event timeline; detailed event run sheet; accountable roles; venue and setup; budget/ticketing/RSVP; catering and bar if relevant; volunteers; suppliers and equipment; communications and promotion; sponsorship deliverables; accessibility; parking and transport; wet-weather and cancellation contingencies; first aid and emergency response; child safety if relevant; food and alcohol checks if relevant; security and crowd management; incident reporting; insurance, permits and licence checks; cleanup; reconciliation and post-event review.'
      :'campaign strategy; realistic target breakdown and revenue channels; campaign story and key messages; launch and promotion timeline; milestone content; supporter call to action; business/prize outreach; volunteer roles; financial controls; expenses; cash handling and reconciliation; donor/payment records and privacy; method-specific raffle, gaming or fundraising checks if relevant; event/food/alcohol/child-safety considerations if relevant; safety, insurance and governance; final reporting, thank-you communications and close-out.'
    const prompt=`You are the senior event director, fundraising strategist and creative director for an Australian community football club. Build a genuinely tailored ${kind==='EVENT'?'event':'fundraising campaign'} package from the supplied facts. This must NOT read like a generic template. Prioritise, sequence and word the plan according to the exact activity, target, audience, venue, timing, resources and details supplied. You may infer sensible planning actions but must label uncertain matters as checks or assumptions. Never invent named people, confirmed suppliers, confirmed bookings, permits, licences, sales, legal approvals, insurance coverage or commitments. Never claim compliance is satisfied. Use practical Australian community-football language, not corporate AI jargon.
Club: ${clubName}. Club colours: ${primary}, ${secondary}. Type: ${subtype}. Requested visual style: ${style}. Wants plan: ${wantsPlan}. Wants poster: ${wantsPoster}. Supplied answers: ${JSON.stringify(answers)}.
For the plan, cover what is actually relevant from: ${coverage} Do not pad irrelevant sections merely to fill space. Include enough detail that a volunteer committee could actually run the activity from the document.
For the poster, act like a premium sports creative director. Decide the strongest information hierarchy, headline, supporting line, call to action, short detail lines, colour treatment and visual direction based on the supplied facts. Poster copy must be concise enough for a 1080x1350 social graphic. Do not invent missing dates, prices, links or venues; omit them or use a truthful CTA such as Contact the club where necessary.
Return STRICT JSON only in this exact shape: {"plan":{"title":"","subtitle":"","executiveSummary":"","objectives":[""],"assumptions":[""],"sections":[{"title":"","intro":"","items":[{"label":"","detail":"","owner":"","timing":"","priority":"HIGH|MEDIUM|LOW"}]}],"timeline":[{"when":"","action":"","owner":""}],"runSheet":[{"time":"","action":"","owner":"","notes":""}],"finalChecks":[""]},"creative":{"eyebrow":"","headline":"","subheadline":"","callToAction":"","detailLines":[""],"primaryColour":"#RRGGBB","accentColour":"#RRGGBB","textColour":"#RRGGBB","layout":"HERO|EDITORIAL|BOLD|HERITAGE|COMMUNITY|PREMIUM","visualDirection":"","backgroundPrompt":"","socialCaption":""}}. Always create both JSON objects even if one output is not requested. The plan title/subtitle and creative must be unique to these supplied facts. The legal disclaimer is added separately by PlayFooty, so do not repeat it.`
    const generated=await openAiJson(prompt)
    const creative=generated?.creative||{}
    let backgroundDataUrl:string|undefined
    if(wantsPoster){
      const backgroundPrompt=[
        `Create a premium vertical 4:5 social poster BACKGROUND for an Australian community football club ${kind==='EVENT'?'event':'fundraising campaign'}.`,
        `Club: ${clubName}. Activity: ${subtype}.`,
        `Creative direction: ${clean(creative.visualDirection,1200)||'premium, authentic community football, strong visual hierarchy and atmosphere'}.`,
        `Specific background direction: ${clean(creative.backgroundPrompt,1600)}.`,
        `Use ${isHex(clean(creative.primaryColour,20))?clean(creative.primaryColour,20):primary} as dominant colour and ${isHex(clean(creative.accentColour,20))?clean(creative.accentColour,20):secondary} as accent.`,
        `Leave purposeful negative space for headline, details, club logo and call-to-action overlays.`,
        `One full-bleed composition, sophisticated sports design, highly legible contrast zones, no border and no frame.`,
        `CRITICAL: include NO words, letters, numbers, dates, prices, logos, badges, sponsor marks, QR codes, watermarks, people or faces. This is background artwork only.`
      ].join(' ')
      backgroundDataUrl=await openAiBackground(backgroundPrompt)
    }
    res.set('Cache-Control','no-store')
    res.json({data:{plan:generated?.plan||{},creative,backgroundDataUrl,disclaimer,textModel:process.env.OPENAI_STUDIO_MODEL||'gpt-4.1-mini',imageModel:wantsPoster?'gpt-image-1':null}})
  }catch(error:any){res.status(error?.status||500).json({error:error?.message||'Unable to generate AI Studio package'})}
})

router.post('/clubs/:clubId/news-draft',async(req,res)=>{
  try{
    const type=clean(req.body?.type,40)||'CLUB_UPDATE'
    const tone=clean(req.body?.tone,30)||'PROFESSIONAL'
    const details=clean(req.body?.details,5000)
    const author=clean(req.body?.author,100)
    if(!details)return res.status(400).json({error:'Add the key facts before generating the article.'})
    const prompt=`You are an experienced Australian community football media manager. Write a factual club story using only the supplied facts. Do not invent scores, names, quotes, dates or achievements. Story type: ${type}. Tone: ${tone}. Author: ${author||'Club media team'}. Facts: ${details}. Return strict JSON with these string fields only: title, subtitle, summary, body, socialCaption. The body should use short readable paragraphs separated by blank lines. The social caption should be suitable for Facebook and Instagram and may include restrained emojis only when the tone is energetic or community.`
    const draft=await openAiJson(prompt)
    res.set('Cache-Control','no-store')
    res.json({data:{title:clean(draft.title,180),subtitle:clean(draft.subtitle,240),summary:clean(draft.summary,500),body:clean(draft.body,12000),socialCaption:clean(draft.socialCaption,2200)}})
  }catch(error:any){res.status(error?.status||500).json({error:error?.message||'Unable to generate AI news draft'})}
})

export {router as clubAiGraphicsRouter}
