import { prisma } from '../db/client.js'
import { logger } from '../utils/logger.js'

type DeliveryRow = {
  id:string; recipientScope:string; recipientId:string|null; type:string; title:string; body:string|null; entityType:string|null; entityId:string|null; data:string|null; status:string; dedupeKey:string
}

type DeliveryResult = { attempted:number; delivered:number; failed:number; skipped:number; errors:Array<{id:string;error:string}> }

function parseData(value:string|null){try{return value?JSON.parse(value) as Record<string,unknown>:{}}catch{return{}}}
function cleanEmail(value:unknown){const email=String(value??'').trim().toLowerCase();return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:null}

async function recipientEmails(row:DeliveryRow):Promise<string[]>{
  const direct=cleanEmail(parseData(row.data).email)
  if(direct)return[direct]
  if(row.recipientScope==='ADMIN'||row.recipientScope==='PLATFORM'){
    const configured=(process.env.NOTIFICATION_ADMIN_EMAIL||process.env.ADMIN_EMAIL||'').split(',').map(cleanEmail).filter(Boolean) as string[]
    return [...new Set(configured)]
  }
  if(row.recipientScope==='CLUB'&&row.recipientId){
    const rows=await prisma.$queryRawUnsafe<Array<{email:string}>>(`SELECT email FROM club_portal_memberships WHERE club_id=$1 AND status='ACTIVE' AND email IS NOT NULL`,row.recipientId).catch(()=>[])
    return [...new Set(rows.map(item=>cleanEmail(item.email)).filter(Boolean) as string[])]
  }
  if(row.recipientScope==='LEAGUE'&&row.recipientId){
    const rows=await prisma.$queryRawUnsafe<Array<{email:string}>>(`SELECT email FROM league_portal_memberships WHERE league_id=$1 AND status='ACTIVE' AND email IS NOT NULL`,row.recipientId).catch(()=>[])
    return [...new Set(rows.map(item=>cleanEmail(item.email)).filter(Boolean) as string[])]
  }
  if(row.recipientScope==='USER'&&row.recipientId){
    const rows=await prisma.$queryRawUnsafe<Array<{email:string}>>(`SELECT email FROM club_portal_memberships WHERE user_id=$1 AND status='ACTIVE' UNION SELECT email FROM league_portal_memberships WHERE user_id=$1 AND status='ACTIVE'`,row.recipientId).catch(()=>[])
    return [...new Set(rows.map(item=>cleanEmail(item.email)).filter(Boolean) as string[])]
  }
  return[]
}

function absoluteHref(data:Record<string,unknown>){const base=(process.env.PUBLIC_SITE_URL||process.env.APP_URL||'https://playfooty.com.au').replace(/\/$/,'');const href=typeof data.href==='string'&&data.href.startsWith('/')?data.href:null;return href?`${base}${href}`:base}
function escapeHtml(value:string){return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]!))}
function emailHtml(row:DeliveryRow){const data=parseData(row.data),href=absoluteHref(data);return `<!doctype html><html><body style="margin:0;background:#eef3f7;font-family:Arial,sans-serif;color:#111318"><div style="max-width:620px;margin:0 auto;padding:30px 16px"><div style="background:#050505;color:#fff;border-radius:16px;padding:28px"><div style="color:#42b8ff;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase">PlayFooty</div><h1 style="font-size:32px;line-height:1.05;margin:10px 0 14px">${escapeHtml(row.title)}</h1>${row.body?`<p style="color:#d5dce4;line-height:1.55">${escapeHtml(row.body)}</p>`:''}<a href="${href}" style="display:inline-block;margin-top:14px;background:#42b8ff;color:#050505;text-decoration:none;border-radius:8px;padding:12px 17px;font-weight:800">Open PlayFooty</a></div><p style="font-size:11px;color:#687385;text-align:center;margin-top:16px">This message was generated from your PlayFooty notification settings.</p></div></body></html>`}

async function sendEmail(to:string[],row:DeliveryRow){
  const key=process.env.RESEND_API_KEY
  const from=process.env.NOTIFICATION_FROM_EMAIL||process.env.RESEND_FROM_EMAIL||'PlayFooty <notifications@playfooty.com.au>'
  if(!key)throw new Error('RESEND_API_KEY is not configured')
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json','Idempotency-Key':row.dedupeKey.slice(0,256)},body:JSON.stringify({from,to,subject:row.title,html:emailHtml(row),text:[row.title,row.body,absoluteHref(parseData(row.data))].filter(Boolean).join('\n\n')})})
  if(!response.ok)throw new Error(`Email provider returned HTTP ${response.status}: ${(await response.text().catch(()=>'' )).slice(0,300)}`)
  return response.json().catch(()=>({}))
}

export async function deliverEmailNotifications(options:{ids?:string[];limit?:number;includeFailed?:boolean}={}):Promise<DeliveryResult>{
  const limit=Math.min(Math.max(Number(options.limit??50),1),200)
  const statuses=options.includeFailed?['PENDING','QUEUED','FAILED']:['PENDING','QUEUED']
  const rows=await prisma.notification.findMany({where:{channel:'EMAIL',status:{in:statuses},...(options.ids?.length?{id:{in:options.ids}}:{})},orderBy:{createdAt:'asc'},take:limit}) as DeliveryRow[]
  const result:DeliveryResult={attempted:rows.length,delivered:0,failed:0,skipped:0,errors:[]}
  for(const row of rows){
    try{
      await prisma.notification.update({where:{id:row.id},data:{status:'QUEUED'}})
      const emails=await recipientEmails(row)
      if(!emails.length){
        const data={...parseData(row.data),delivery:{failedAt:new Date().toISOString(),error:'No recipient email resolved'}}
        await prisma.notification.update({where:{id:row.id},data:{status:'FAILED',data:JSON.stringify(data)}})
        result.skipped++;result.failed++;result.errors.push({id:row.id,error:'No recipient email resolved'});continue
      }
      const provider=await sendEmail(emails,row)
      const data={...parseData(row.data),delivery:{deliveredAt:new Date().toISOString(),recipients:emails,provider}}
      await prisma.notification.update({where:{id:row.id},data:{status:'DELIVERED',sentAt:new Date(),data:JSON.stringify(data)}})
      result.delivered++
    }catch(error){
      const message=error instanceof Error?error.message:String(error)
      const data={...parseData(row.data),delivery:{failedAt:new Date().toISOString(),error:message}}
      await prisma.notification.update({where:{id:row.id},data:{status:'FAILED',data:JSON.stringify(data)}}).catch(()=>null)
      result.failed++;result.errors.push({id:row.id,error:message})
    }
  }
  logger.info('Notification email delivery completed',result)
  return result
}
