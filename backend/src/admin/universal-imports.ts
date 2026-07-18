import { Router } from 'express'
import { prisma } from '../db/client.js'
import { requireAdminKey } from '../api/middleware/auth.js'
import { classifyImportImage } from '../ocr/classify-image.js'

const router=Router();router.use(requireAdminKey)
router.post('/classify',async(req,res)=>{try{const image=(req.body??{}).image as string|undefined;if(!image)return res.status(400).json({error:'image required'});res.json({data:await classifyImportImage(image)})}catch(e){res.status(500).json({error:e instanceof Error?e.message:'classification failed'})}})
router.get('/history',async(req,res)=>{const take=Math.min(Number(req.query.limit)||100,300);const[ocr,audit]=await Promise.all([
 prisma.ocrImport.findMany({orderBy:{createdAt:'desc'},take,select:{id:true,status:true,detectedLeague:true,detectedGrade:true,rowCount:true,uncertainCount:true,confidence:true,notes:true,createdAt:true,committedAt:true}}).catch(()=>[]),
 prisma.auditLog.findMany({where:{action:{in:['IMAGE_IMPORT','IMPORT_RESULTS','UPDATE_CLUB_PROFILE','UPDATE_LEAGUE_PROFILE','GOAL_KICKER_IMAGE_IMPORT','PROFILE_IMAGE_IMPORT']}},orderBy:{createdAt:'desc'},take,select:{id:true,action:true,entityType:true,entityId:true,source:true,after:true,createdAt:true}}).catch(()=>[]),
]);const rows=[...ocr.map(x=>({id:x.id,kind:'ladder',status:x.status,title:x.detectedLeague??'Ladder image import',detail:`${x.rowCount} rows · ${x.uncertainCount} uncertain`,confidence:x.confidence,createdAt:x.createdAt,committedAt:x.committedAt,revert:'Open the league ladder and import the corrected screenshot; manual image imports are audit logged.'})),...audit.map(x=>({id:x.id,kind:x.action,status:'COMMITTED',title:x.action.replaceAll('_',' '),detail:x.entityType+(x.entityId?` · ${x.entityId}`:''),confidence:null,createdAt:x.createdAt,committedAt:x.createdAt,revert:'Use the relevant admin editor or re-import a corrected screenshot. The original change remains in the audit log.',source:x.source,after:x.after}))].sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,take);res.json({data:rows})})
export{router as adminUniversalImportsRouter}
