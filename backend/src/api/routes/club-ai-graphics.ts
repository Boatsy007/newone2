import { Router } from 'express'
import { authenticateClubUser, membershipForClub, requireActiveClubMembership, roleCan } from '../../auth/club-auth.js'

const router = Router()
const clean = (value: unknown, max = 160) => String(value ?? '').trim().slice(0, max)

async function requireMedia(req:any,res:any,next:any){
  const membership=res.locals.clubMembership as Awaited<ReturnType<typeof membershipForClub>>
  if(!membership||!roleCan(membership.role,'media'))return res.status(403).json({error:'Your club role cannot create media graphics'})
  next()
}

router.use(authenticateClubUser)
router.use('/clubs/:clubId',requireActiveClubMembership,requireMedia)

router.post('/clubs/:clubId/team-background',async(req,res)=>{
  try{
    const apiKey=process.env.OPENAI_API_KEY||''
    if(!apiKey)return res.status(503).json({error:'AI image generation is not configured. Add OPENAI_API_KEY to the backend environment.'})
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
    const response=await fetch('https://api.openai.com/v1/images/generations',{
      method:'POST',
      headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},
      body:JSON.stringify({model:'gpt-image-1',prompt,size:'1024x1536',quality:'medium',background:'opaque',output_format:'png'})
    })
    const payload=await response.json().catch(()=>({})) as any
    if(!response.ok)return res.status(response.status===429?429:502).json({error:payload?.error?.message||'AI background generation failed'})
    const base64=payload?.data?.[0]?.b64_json
    if(!base64)return res.status(502).json({error:'AI image service returned no background image'})
    res.set('Cache-Control','no-store')
    res.json({data:{dataUrl:`data:image/png;base64,${base64}`,model:'gpt-image-1'}})
  }catch(error){res.status(500).json({error:'Unable to generate AI background',detail:String(error)})}
})

router.post('/clubs/:clubId/news-draft',async(req,res)=>{
  try{
    const apiKey=process.env.OPENAI_API_KEY||''
    if(!apiKey)return res.status(503).json({error:'AI news generation is not configured. Add OPENAI_API_KEY to the backend environment.'})
    const type=clean(req.body?.type,40)||'CLUB_UPDATE'
    const tone=clean(req.body?.tone,30)||'PROFESSIONAL'
    const details=clean(req.body?.details,5000)
    const author=clean(req.body?.author,100)
    if(!details)return res.status(400).json({error:'Add the key facts before generating the article.'})
    const prompt=`You are an experienced Australian community football media manager. Write a factual club story using only the supplied facts. Do not invent scores, names, quotes, dates or achievements. Story type: ${type}. Tone: ${tone}. Author: ${author||'Club media team'}. Facts: ${details}. Return strict JSON with these string fields only: title, subtitle, summary, body, socialCaption. The body should use short readable paragraphs separated by blank lines. The social caption should be suitable for Facebook and Instagram and may include restrained emojis only when the tone is energetic or community.`
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},
      body:JSON.stringify({model:'gpt-4.1-mini',input:prompt,text:{format:{type:'json_object'}}})
    })
    const payload=await response.json().catch(()=>({})) as any
    if(!response.ok)return res.status(response.status===429?429:502).json({error:payload?.error?.message||'AI news generation failed'})
    const raw=payload?.output_text||payload?.output?.flatMap((item:any)=>item?.content||[]).map((item:any)=>item?.text||'').join('')||''
    let draft:any
    try{draft=JSON.parse(raw)}catch{return res.status(502).json({error:'AI news service returned an invalid draft'})}
    res.set('Cache-Control','no-store')
    res.json({data:{title:clean(draft.title,180),subtitle:clean(draft.subtitle,240),summary:clean(draft.summary,500),body:clean(draft.body,12000),socialCaption:clean(draft.socialCaption,2200)}})
  }catch(error){res.status(500).json({error:'Unable to generate AI news draft',detail:String(error)})}
})

export {router as clubAiGraphicsRouter}
