/**
 * Notification emitter (Phase B9).
 * Single entry point for deduplicated, preference-aware multi-channel alerts.
 */
import { prisma } from '../db/client.js'
import { TYPE_BY_KEY, VALID_TYPES, NOTIFICATION_TYPES } from './types.js'
import { logger } from '../utils/logger.js'

export interface NotifyInput { type:string;title:string;body?:string;recipientScope?:string;recipientId?:string|null;entityType?:string;entityId?:string;data?:unknown;channel?:string;dedupeKey:string;severity?:string }
export interface NotifyResult { created:boolean;id?:string;suppressed?:boolean;reason?:string;channels?:Array<{channel:string;id?:string;created:boolean;suppressed?:boolean}> }

export async function seedNotificationRules():Promise<{seeded:number}>{let seeded=0;for(const t of NOTIFICATION_TYPES){await prisma.notificationRule.upsert({where:{type:t.type},create:{type:t.type,label:t.label,category:t.category,severity:t.severity,recipientScope:t.recipientScope},update:{label:t.label,category:t.category}});seeded++}return{seeded}}
function parseChannels(value:string|null|undefined){try{const rows=value?JSON.parse(value):['IN_APP'];return Array.isArray(rows)?[...new Set(rows.map(v=>String(v).toUpperCase()).filter(v=>['IN_APP','EMAIL','WEBHOOK'].includes(v)))]:['IN_APP']}catch{return['IN_APP']}}

export async function notify(input:NotifyInput):Promise<NotifyResult>{
 if(!VALID_TYPES.has(input.type))return{created:false,reason:`unknown type ${input.type}`}
 const def=TYPE_BY_KEY.get(input.type)!,rule=await prisma.notificationRule.findUnique({where:{type:input.type}}).catch(()=>null)
 if(rule&&!rule.enabled)return{created:false,suppressed:true,reason:'rule disabled'}
 const recipientScope=input.recipientScope??rule?.recipientScope??def.recipientScope,severity=input.severity??rule?.severity??def.severity
 const channels=input.channel?[input.channel.toUpperCase()]:parseChannels(rule?.defaultChannels)
 const results:Array<{channel:string;id?:string;created:boolean;suppressed?:boolean}>=[]
 for(const channel of channels){
  const dedupeKey=channels.length===1?input.dedupeKey:`${input.dedupeKey}:${channel.toLowerCase()}`
  const existing=await prisma.notification.findUnique({where:{dedupeKey},select:{id:true,status:true}})
  if(existing){results.push({channel,id:existing.id,created:false,suppressed:existing.status==='SUPPRESSED'});continue}
  let status=channel==='IN_APP'?'DELIVERED':'PENDING'
  if(input.recipientId){const pref=await prisma.notificationPreference.findUnique({where:{recipientScope_recipientId_type_channel:{recipientScope,recipientId:input.recipientId,type:input.type,channel}}}).catch(()=>null);if(pref&&(!pref.enabled||pref.frequency==='OFF'))status='SUPPRESSED'}
  const n=await prisma.notification.create({data:{recipientScope,recipientId:input.recipientId??null,type:input.type,category:rule?.category??def.category,severity,title:input.title,body:input.body??null,entityType:input.entityType??null,entityId:input.entityId??null,data:input.data?JSON.stringify(input.data):null,channel,status,dedupeKey,sentAt:status==='DELIVERED'?new Date():null}})
  results.push({channel,id:n.id,created:status!=='SUPPRESSED',suppressed:status==='SUPPRESSED'})
 }
 const first=results[0]
 return{created:results.some(r=>r.created),id:first?.id,suppressed:results.every(r=>r.suppressed),channels:results}
}

export async function markRead(id:string){return prisma.notification.update({where:{id},data:{status:'READ',readAt:new Date()}}).catch(()=>null)}
export async function markDelivered(ids:string[]){if(!ids.length)return{count:0};const r=await prisma.notification.updateMany({where:{id:{in:ids},status:{in:['PENDING','QUEUED']}},data:{status:'DELIVERED',sentAt:new Date()}});logger.info('Notifications marked delivered',{count:r.count});return{count:r.count}}
