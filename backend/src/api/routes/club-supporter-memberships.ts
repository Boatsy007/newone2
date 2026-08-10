import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, clubUserCan, membershipForClub, requireActiveClubMembership } from '../../auth/club-auth.js'

const router = Router()
const PRODUCT_STATUSES = new Set(['DRAFT', 'ACTIVE', 'ARCHIVED'])
const REENTRY_POLICIES = new Set(['UNLIMITED', 'WARN', 'PREVENT'])
let schemaReady: Promise<void> | null = null

type ProductRow = {
  id:string; clubId:string; name:string; description:string|null; priceCents:number; currency:string; category:string; status:string
  saleStart:Date|null; saleEnd:Date|null; validFrom:Date|null; validUntil:Date|null; season:string|null
  digitalCardEnabled:boolean; physicalCardEnabled:boolean; createdAt:Date; updatedAt:Date; archivedAt:Date|null
  regularSeasonHomeAccess:boolean; clubControlledFinalsAccess:boolean; admissionsPerEvent:number|null; totalAdmissions:number|null; reentryPolicy:string; peopleCovered:number; benefits:string[]
}
type EntitlementInput = {regularSeasonHomeAccess:boolean;clubControlledFinalsAccess:boolean;admissionsPerEvent:number|null;totalAdmissions:number|null;reentryPolicy:string;peopleCovered:number;benefits:string[]}
type ProductInput = {
  name:string;description:string|null;priceCents:number;currency:string;category:string;status:string
  saleStart:Date|null;saleEnd:Date|null;validFrom:Date|null;validUntil:Date|null;season:string|null
  digitalCardEnabled:boolean;physicalCardEnabled:boolean;entitlement:EntitlementInput
}

export function ensureSupporterMembershipSchema() {
  if (!schemaReady) schemaReady = (async () => {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS club_member_people (
      id TEXT PRIMARY KEY, club_id TEXT NOT NULL, user_id TEXT, first_name TEXT, last_name TEXT,
      display_name TEXT NOT NULL, email TEXT, phone TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), archived_at TIMESTAMPTZ
    )`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS club_member_people_club_idx ON club_member_people (club_id, archived_at)`)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS club_member_people_club_user_unique ON club_member_people (club_id, user_id) WHERE user_id IS NOT NULL`)

    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS club_membership_products (
      id TEXT PRIMARY KEY, club_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT,
      price_cents INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'AUD', category TEXT NOT NULL DEFAULT 'CUSTOM',
      status TEXT NOT NULL DEFAULT 'DRAFT', sale_start TIMESTAMPTZ, sale_end TIMESTAMPTZ,
      valid_from TIMESTAMPTZ, valid_until TIMESTAMPTZ, season TEXT,
      digital_card_enabled BOOLEAN NOT NULL DEFAULT TRUE, physical_card_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), archived_at TIMESTAMPTZ,
      CONSTRAINT club_membership_products_status_check CHECK (status IN ('DRAFT','ACTIVE','ARCHIVED')),
      CONSTRAINT club_membership_products_price_check CHECK (price_cents >= 0)
    )`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS club_membership_products_club_status_idx ON club_membership_products (club_id, status, archived_at)`)

    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS club_membership_product_entitlements (
      id TEXT PRIMARY KEY, product_id TEXT NOT NULL, club_id TEXT NOT NULL, entitlement_type TEXT NOT NULL,
      configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS club_membership_product_entitlements_type_unique ON club_membership_product_entitlements (product_id, entitlement_type)`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS club_membership_product_entitlements_club_idx ON club_membership_product_entitlements (club_id, product_id)`)

    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS club_memberships (
      id TEXT PRIMARY KEY, club_id TEXT NOT NULL, product_id TEXT, member_person_id TEXT NOT NULL,
      membership_number TEXT, status TEXT NOT NULL DEFAULT 'PENDING', season TEXT,
      valid_from TIMESTAMPTZ, valid_until TIMESTAMPTZ, price_cents INTEGER, currency TEXT NOT NULL DEFAULT 'AUD', source TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), activated_at TIMESTAMPTZ, cancelled_at TIMESTAMPTZ,
      CONSTRAINT club_memberships_status_check CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','CANCELLED','EXPIRED'))
    )`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS club_memberships_club_status_idx ON club_memberships (club_id, status, season)`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS club_memberships_person_idx ON club_memberships (member_person_id, club_id)`)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS club_memberships_number_unique ON club_memberships (club_id, membership_number) WHERE membership_number IS NOT NULL`)
  })().catch(error => { schemaReady = null; throw error })
  return schemaReady
}

function clean(value:unknown,max=500){return String(value??'').trim().slice(0,max)}
function dateValue(value:unknown){const text=clean(value,80);if(!text)return null;const date=new Date(text);if(Number.isNaN(date.getTime()))throw new Error('One of the supplied dates is invalid');return date}
function intValue(value:unknown,min:number,max:number,fallback:number|null=null){if(value===null||value===undefined||value==='')return fallback;const number=Number(value);if(!Number.isInteger(number)||number<min||number>max)throw new Error(`Expected a whole number between ${min} and ${max}`);return number}
function boolValue(value:unknown,fallback=false){return value===undefined?fallback:Boolean(value)}
function benefitsValue(value:unknown){return Array.isArray(value)?value.map(item=>clean(item,120)).filter(Boolean).slice(0,30):[]}
function canManageMemberships(res:any){const membership=res.locals.clubMembership as Awaited<ReturnType<typeof membershipForClub>>;return Boolean(membership&&(membership.role==='OWNER'||membership.role==='ADMIN'||clubUserCan(membership,'memberships.access')))}

function parseProduct(body:any):ProductInput{
  const name=clean(body?.name,120);if(!name)throw new Error('Membership name is required')
  const status=clean(body?.status,20).toUpperCase()||'DRAFT';if(!PRODUCT_STATUSES.has(status))throw new Error('Invalid membership product status')
  const saleStart=dateValue(body?.saleStart),saleEnd=dateValue(body?.saleEnd),validFrom=dateValue(body?.validFrom),validUntil=dateValue(body?.validUntil)
  if(saleStart&&saleEnd&&saleEnd<saleStart)throw new Error('Sale end must be after sale start')
  if(validFrom&&validUntil&&validUntil<validFrom)throw new Error('Valid until must be after valid from')
  const entitlement=body?.entitlement??{},reentryPolicy=clean(entitlement.reentryPolicy,20).toUpperCase()||'WARN'
  if(!REENTRY_POLICIES.has(reentryPolicy))throw new Error('Invalid re-entry policy')
  return {name,description:clean(body?.description,3000)||null,priceCents:intValue(body?.priceCents,0,100000000,0)??0,currency:'AUD',category:clean(body?.category,60).toUpperCase()||'CUSTOM',status,saleStart,saleEnd,validFrom,validUntil,season:clean(body?.season,30)||null,digitalCardEnabled:boolValue(body?.digitalCardEnabled,true),physicalCardEnabled:boolValue(body?.physicalCardEnabled,true),entitlement:{regularSeasonHomeAccess:boolValue(entitlement.regularSeasonHomeAccess),clubControlledFinalsAccess:boolValue(entitlement.clubControlledFinalsAccess),admissionsPerEvent:intValue(entitlement.admissionsPerEvent,1,100),totalAdmissions:intValue(entitlement.totalAdmissions,1,1000),reentryPolicy,peopleCovered:intValue(entitlement.peopleCovered,1,50,1)??1,benefits:benefitsValue(entitlement.benefits)}}
}

const selectProducts=`p.id,p.club_id AS "clubId",p.name,p.description,p.price_cents AS "priceCents",p.currency,p.category,p.status,p.sale_start AS "saleStart",p.sale_end AS "saleEnd",p.valid_from AS "validFrom",p.valid_until AS "validUntil",p.season,p.digital_card_enabled AS "digitalCardEnabled",p.physical_card_enabled AS "physicalCardEnabled",p.created_at AS "createdAt",p.updated_at AS "updatedAt",p.archived_at AS "archivedAt",COALESCE((e.configuration->>'regularSeasonHomeAccess')::boolean,false) AS "regularSeasonHomeAccess",COALESCE((e.configuration->>'clubControlledFinalsAccess')::boolean,false) AS "clubControlledFinalsAccess",NULLIF(e.configuration->>'admissionsPerEvent','')::int AS "admissionsPerEvent",NULLIF(e.configuration->>'totalAdmissions','')::int AS "totalAdmissions",COALESCE(e.configuration->>'reentryPolicy','WARN') AS "reentryPolicy",COALESCE(NULLIF(e.configuration->>'peopleCovered','')::int,1) AS "peopleCovered",COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(e.configuration->'benefits','[]'::jsonb))),ARRAY[]::text[]) AS benefits`
async function productsForClub(clubId:string,id?:string){await ensureSupporterMembershipSchema();return prisma.$queryRawUnsafe<ProductRow[]>(`SELECT ${selectProducts} FROM club_membership_products p LEFT JOIN club_membership_product_entitlements e ON e.product_id=p.id AND e.entitlement_type='MATCH_ACCESS' WHERE p.club_id=$1 ${id?'AND p.id=$2':''} ORDER BY CASE p.status WHEN 'ACTIVE' THEN 0 WHEN 'DRAFT' THEN 1 ELSE 2 END,p.created_at DESC`,...(id?[clubId,id]:[clubId]))}
function serialise(row:ProductRow){return{...row,entitlement:{regularSeasonHomeAccess:row.regularSeasonHomeAccess,clubControlledFinalsAccess:row.clubControlledFinalsAccess,admissionsPerEvent:row.admissionsPerEvent,totalAdmissions:row.totalAdmissions,reentryPolicy:row.reentryPolicy,peopleCovered:row.peopleCovered,benefits:row.benefits}}}
function entitlementJson(input:EntitlementInput){return JSON.stringify(input)}

router.use(authenticateClubUser)
router.use('/clubs/:clubId',requireActiveClubMembership)
router.use('/clubs/:clubId',(_req,res,next)=>{if(!canManageMemberships(res)){res.status(403).json({error:'Your club access does not include Memberships'});return}next()})

router.get('/clubs/:clubId/overview',async(req,res)=>{try{await ensureSupporterMembershipSchema();const clubId=req.params.clubId;const [p,m]=await Promise.all([prisma.$queryRawUnsafe<Array<{status:string;count:bigint}>>(`SELECT status,COUNT(*)::bigint AS count FROM club_membership_products WHERE club_id=$1 GROUP BY status`,clubId),prisma.$queryRawUnsafe<Array<{count:bigint}>>(`SELECT COUNT(*)::bigint AS count FROM club_memberships WHERE club_id=$1 AND status='ACTIVE'`,clubId)]);const counts=Object.fromEntries(p.map(row=>[row.status,Number(row.count)]));res.json({data:{activeProducts:counts.ACTIVE||0,draftProducts:counts.DRAFT||0,archivedProducts:counts.ARCHIVED||0,activeMemberships:Number(m[0]?.count||0)}})}catch(error){res.status(500).json({error:'Unable to load memberships overview',detail:String(error)})}})
router.get('/clubs/:clubId/products',async(req,res)=>{try{res.json({data:(await productsForClub(req.params.clubId)).map(serialise)})}catch(error){res.status(500).json({error:'Unable to load membership products',detail:String(error)})}})
router.post('/clubs/:clubId/products',async(req,res)=>{try{const input=parseProduct(req.body),id=randomUUID(),clubId=req.params.clubId;await ensureSupporterMembershipSchema();await prisma.$transaction(async tx=>{await tx.$executeRawUnsafe(`INSERT INTO club_membership_products (id,club_id,name,description,price_cents,currency,category,status,sale_start,sale_end,valid_from,valid_until,season,digital_card_enabled,physical_card_enabled,created_by,archived_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,id,clubId,input.name,input.description,input.priceCents,input.currency,input.category,input.status,input.saleStart,input.saleEnd,input.validFrom,input.validUntil,input.season,input.digitalCardEnabled,input.physicalCardEnabled,req.clubUser?.id??null,input.status==='ARCHIVED'?new Date():null);await tx.$executeRawUnsafe(`INSERT INTO club_membership_product_entitlements (id,product_id,club_id,entitlement_type,configuration) VALUES ($1,$2,$3,'MATCH_ACCESS',$4::jsonb)`,randomUUID(),id,clubId,entitlementJson(input.entitlement))});const row=(await productsForClub(clubId,id))[0];res.status(201).json({data:serialise(row),message:'Membership product created'})}catch(error){res.status(400).json({error:error instanceof Error?error.message:'Unable to create membership product'})}})
router.patch('/clubs/:clubId/products/:productId',async(req,res)=>{try{const input=parseProduct(req.body),clubId=req.params.clubId,productId=req.params.productId,existing=(await productsForClub(clubId,productId))[0];if(!existing){res.status(404).json({error:'Membership product not found'});return}await prisma.$transaction(async tx=>{await tx.$executeRawUnsafe(`UPDATE club_membership_products SET name=$1,description=$2,price_cents=$3,currency=$4,category=$5,status=$6,sale_start=$7,sale_end=$8,valid_from=$9,valid_until=$10,season=$11,digital_card_enabled=$12,physical_card_enabled=$13,archived_at=$14,updated_at=NOW() WHERE id=$15 AND club_id=$16`,input.name,input.description,input.priceCents,input.currency,input.category,input.status,input.saleStart,input.saleEnd,input.validFrom,input.validUntil,input.season,input.digitalCardEnabled,input.physicalCardEnabled,input.status==='ARCHIVED'?(existing.archivedAt??new Date()):null,productId,clubId);await tx.$executeRawUnsafe(`INSERT INTO club_membership_product_entitlements (id,product_id,club_id,entitlement_type,configuration) VALUES ($1,$2,$3,'MATCH_ACCESS',$4::jsonb) ON CONFLICT (product_id,entitlement_type) DO UPDATE SET configuration=EXCLUDED.configuration,updated_at=NOW()`,randomUUID(),productId,clubId,entitlementJson(input.entitlement))});res.json({data:serialise((await productsForClub(clubId,productId))[0]),message:'Membership product updated'})}catch(error){res.status(400).json({error:error instanceof Error?error.message:'Unable to update membership product'})}})
router.post('/clubs/:clubId/products/:productId/archive',async(req,res)=>{try{await ensureSupporterMembershipSchema();const count=await prisma.$executeRawUnsafe(`UPDATE club_membership_products SET status='ARCHIVED',archived_at=NOW(),updated_at=NOW() WHERE id=$1 AND club_id=$2`,req.params.productId,req.params.clubId);if(!count){res.status(404).json({error:'Membership product not found'});return}res.json({data:{archived:true},message:'Membership product archived'})}catch(error){res.status(500).json({error:'Unable to archive membership product',detail:String(error)})}})
router.post('/clubs/:clubId/products/:productId/duplicate',async(req,res)=>{try{const clubId=req.params.clubId,source=(await productsForClub(clubId,req.params.productId))[0];if(!source){res.status(404).json({error:'Membership product not found'});return}const id=randomUUID();await prisma.$transaction(async tx=>{await tx.$executeRawUnsafe(`INSERT INTO club_membership_products (id,club_id,name,description,price_cents,currency,category,status,sale_start,sale_end,valid_from,valid_until,season,digital_card_enabled,physical_card_enabled,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,'DRAFT',$8,$9,$10,$11,$12,$13,$14,$15)`,id,clubId,`${source.name} Copy`,source.description,source.priceCents,source.currency,source.category,source.saleStart,source.saleEnd,source.validFrom,source.validUntil,source.season,source.digitalCardEnabled,source.physicalCardEnabled,req.clubUser?.id??null);await tx.$executeRawUnsafe(`INSERT INTO club_membership_product_entitlements (id,product_id,club_id,entitlement_type,configuration) VALUES ($1,$2,$3,'MATCH_ACCESS',$4::jsonb)`,randomUUID(),id,clubId,entitlementJson({regularSeasonHomeAccess:source.regularSeasonHomeAccess,clubControlledFinalsAccess:source.clubControlledFinalsAccess,admissionsPerEvent:source.admissionsPerEvent,totalAdmissions:source.totalAdmissions,reentryPolicy:source.reentryPolicy,peopleCovered:source.peopleCovered,benefits:source.benefits}))});res.status(201).json({data:serialise((await productsForClub(clubId,id))[0]),message:'Membership product duplicated as a draft'})}catch(error){res.status(500).json({error:'Unable to duplicate membership product',detail:String(error)})}})

export { router as clubSupporterMembershipsRouter }
