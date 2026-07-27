/** Admin notifications endpoints — mounted at /admin/notifications. */
import { Router } from 'express'
import { prisma } from '../db/client.js'
import { requireAdminKey } from '../api/middleware/auth.js'
import { runNotificationEngine } from '../notifications/index.js'
import { seedNotificationRules, markDelivered } from '../notifications/notify.js'
import { notificationSummary } from '../notifications/reports.js'
import { generateDigest } from '../notifications/digests.js'
import { DIGEST_KINDS, type DigestKind } from '../notifications/types.js'
import { deliverEmailNotifications } from '../notifications/delivery.js'

const router=Router();router.use(requireAdminKey)
router.post('/scan',async(req,res)=>{const b=(req.body??{}) as{seed?:boolean;sections?:string[]};try{res.json({data:await runNotificationEngine({seed:b.seed,sections:b.sections})})}catch(err){res.status(500).json({error:err instanceof Error?err.message:'scan failed'})}})
router.post('/seed',async(_req,res)=>res.json({data:await seedNotificationRules()}))
router.get('/summary',async(_req,res)=>res.json({data:await notificationSummary()}))
router.get('/rules',async(_req,res)=>res.json({data:await prisma.notificationRule.findMany({orderBy:{type:'asc'}})}))
router.patch('/rules/:type',async(req,res)=>{const b=(req.body??{}) as{enabled?:boolean;defaultChannels?:string[]};const channels=b.defaultChannels?.map(v=>String(v).toUpperCase()).filter(v=>['IN_APP','EMAIL','WEBHOOK'].includes(v));const rule=await prisma.notificationRule.update({where:{type:req.params.type},data:{...(b.enabled!=null?{enabled:b.enabled}:{}),...(channels?{defaultChannels:JSON.stringify([...new Set(channels)])}:{})}}).catch(()=>null);if(!rule)return res.status(404).json({error:'rule not found'});res.json({data:rule})})
router.get('/runs',async(_req,res)=>res.json({data:await prisma.automationRun.findMany({orderBy:{ranAt:'desc'},take:100})}))
router.post('/digest',async(req,res)=>{const b=(req.body??{}) as{kind?:string;dryRun?:boolean};const kind=(b.kind??'DAILY_ADMIN').toUpperCase();if(!(DIGEST_KINDS as readonly string[]).includes(kind))return res.status(400).json({error:`kind must be one of ${DIGEST_KINDS.join('|')}`});res.json({data:await generateDigest(kind as DigestKind,{dryRun:b.dryRun!==false})})})
router.get('/digests',async(_req,res)=>res.json({data:await prisma.notificationDigest.findMany({orderBy:{createdAt:'desc'},take:50})}))
router.post('/deliver',async(req,res)=>{const b=(req.body??{}) as{ids?:string[];limit?:number};try{res.json({data:await deliverEmailNotifications({ids:Array.isArray(b.ids)?b.ids:undefined,limit:b.limit})})}catch(error){res.status(500).json({error:error instanceof Error?error.message:'Delivery failed'})}})
router.post('/retry-failed',async(req,res)=>{const b=(req.body??{}) as{ids?:string[];limit?:number};try{res.json({data:await deliverEmailNotifications({ids:Array.isArray(b.ids)?b.ids:undefined,limit:b.limit,includeFailed:true})})}catch(error){res.status(500).json({error:error instanceof Error?error.message:'Retry failed'})}})
router.post('/mark-delivered',async(req,res)=>{const b=(req.body??{}) as{ids?:string[]};if(!Array.isArray(b.ids))return res.status(400).json({error:'ids[] required'});res.json({data:await markDelivered(b.ids)})})
export{router as adminNotificationsRouter}
