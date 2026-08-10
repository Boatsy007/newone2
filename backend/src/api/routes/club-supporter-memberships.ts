import { Router } from 'express'
import { randomBytes, randomUUID } from 'node:crypto'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, clubUserCan, membershipForClub, requireActiveClubMembership } from '../../auth/club-auth.js'

const router = Router()
const PRODUCT_STATUSES = new Set(['DRAFT', 'ACTIVE', 'ARCHIVED'])
const REENTRY_POLICIES = new Set(['UNLIMITED', 'WARN', 'PREVENT'])
const MEMBERSHIP_STATUSES = new Set(['PENDING', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED'])
const PAYMENT_METHODS = new Set(['CASH', 'EFTPOS', 'BANK_TRANSFER', 'COMPLIMENTARY', 'SPONSOR', 'LIFE_MEMBER', 'OTHER'])
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
type MemberRow = {
  personId:string;firstName:string|null;lastName:string|null;displayName:string;email:string|null;phone:string|null;personCreatedAt:Date
  membershipId:string|null;productId:string|null;productName:string|null;membershipNumber:string|null;membershipStatus:string|null;season:string|null
  validFrom:Date|null;validUntil:Date|null;priceCents:number|null;currency:string|null;source:string|null;membershipCreatedAt:Date|null
  paymentMethod:string|null;paymentAmountCents:number|null;paymentStatus:string|null;paymentPaidAt:Date|null;digitalCardEnabled:boolean|null
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
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS club_member_people_email_idx ON club_member_people (club_id, LOWER(email)) WHERE email IS NOT NULL`)

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

    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS club_membership_purchases (
      id TEXT PRIMARY KEY, club_id TEXT NOT NULL, membership_id TEXT NOT NULL, purchaser_person_id TEXT,
      payment_method TEXT NOT NULL, amount_cents INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'AUD',
      payment_status TEXT NOT NULL DEFAULT 'RECORDED', notes TEXT, paid_at TIMESTAMPTZ,
      created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT club_membership_purchases_amount_check CHECK (amount_cents >= 0)
    )`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS club_membership_purchases_membership_idx ON club_membership_purchases (club_id, membership_id, created_at DESC)`)

    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS club_membership_history (
      id TEXT PRIMARY KEY, club_id TEXT NOT NULL, membership_id TEXT NOT NULL, member_person_id TEXT NOT NULL,
      action TEXT NOT NULL, from_status TEXT, to_status TEXT, details JSONB NOT NULL DEFAULT '{}'::jsonb,
      actor_user_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS club_membership_history_person_idx ON club_membership_history (club_id, member_person_id, created_at DESC)`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS club_membership_history_membership_idx ON club_membership_history (membership_id, created_at DESC)`)

    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS club_membership_credentials (
      id TEXT PRIMARY KEY, club_id TEXT NOT NULL, membership_id TEXT NOT NULL, credential_token TEXT NOT NULL UNIQUE, card_access_token TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'ACTIVE', issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), revoked_at TIMESTAMPTZ, replaced_by_id TEXT,
      CONSTRAINT club_membership_credentials_status_check CHECK (status IN ('ACTIVE','REVOKED'))
    )`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS club_membership_credentials_club_idx ON club_membership_credentials (club_id, membership_id, status)`)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS club_membership_credentials_active_membership_unique ON club_membership_credentials (membership_id) WHERE status='ACTIVE'`)
  })().catch(error => { schemaReady = null; throw error })
  return schemaReady
}

function clean(value:unknown,max=500){return String(value??'').trim().slice(0,max)}
function dateValue(value:unknown){const text=clean(value,80);if(!text)return null;const date=new Date(text);if(Number.isNaN(date.getTime()))throw new Error('One of the supplied dates is invalid');return date}
function intValue(value:unknown,min:number,max:number,fallback:number|null=null){if(value===null||value===undefined||value==='')return fallback;const number=Number(value);if(!Number.isInteger(number)||number<min||number>max)throw new Error(`Expected a whole number between ${min} and ${max}`);return number}
function boolValue(value:unknown,fallback=false){return value===undefined?fallback:Boolean(value)}
function benefitsValue(value:unknown){return Array.isArray(value)?value.map(item=>clean(item,120)).filter(Boolean).slice(0,30):[]}
function canManageMemberships(res:any){const membership=res.locals.clubMembership as Awaited<ReturnType<typeof membershipForClub>>;return Boolean(membership&&(membership.role==='OWNER'||membership.role==='ADMIN'||clubUserCan(membership,'memberships.access')))}
function generatedMembershipNumber(){return `PF-${randomUUID().replaceAll('-','').slice(0,8).toUpperCase()}`}
function normalisedEmail(value:unknown){const email=clean(value,240).toLowerCase();return email||null}

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

async function membersForClub(clubId:string,filters:{search?:string;status?:string;productId?:string}={}){
  await ensureSupporterMembershipSchema()
  const params:unknown[]=[clubId];const where=[`p.club_id=$1`,`p.archived_at IS NULL`]
  if(filters.search){params.push(`%${filters.search.toLowerCase()}%`);where.push(`(LOWER(p.display_name) LIKE $${params.length} OR LOWER(COALESCE(p.email,'')) LIKE $${params.length} OR LOWER(COALESCE(m.membership_number,'')) LIKE $${params.length})`)}
  if(filters.status){params.push(filters.status);where.push(`m.status=$${params.length}`)}
  if(filters.productId){params.push(filters.productId);where.push(`m.product_id=$${params.length}`)}
  return prisma.$queryRawUnsafe<MemberRow[]>(`SELECT p.id AS "personId",p.first_name AS "firstName",p.last_name AS "lastName",p.display_name AS "displayName",p.email,p.phone,p.created_at AS "personCreatedAt",
    m.id AS "membershipId",m.product_id AS "productId",pr.name AS "productName",m.membership_number AS "membershipNumber",m.status AS "membershipStatus",m.season,m.valid_from AS "validFrom",m.valid_until AS "validUntil",m.price_cents AS "priceCents",m.currency,m.source,m.created_at AS "membershipCreatedAt",
    pu.payment_method AS "paymentMethod",pu.amount_cents AS "paymentAmountCents",pu.payment_status AS "paymentStatus",pu.paid_at AS "paymentPaidAt",pr.digital_card_enabled AS "digitalCardEnabled"
    FROM club_member_people p
    LEFT JOIN LATERAL (SELECT * FROM club_memberships mx WHERE mx.club_id=p.club_id AND mx.member_person_id=p.id ORDER BY CASE WHEN mx.status='ACTIVE' THEN 0 WHEN mx.status='PENDING' THEN 1 ELSE 2 END,mx.created_at DESC LIMIT 1) m ON TRUE
    LEFT JOIN club_membership_products pr ON pr.id=m.product_id
    LEFT JOIN LATERAL (SELECT * FROM club_membership_purchases pux WHERE pux.club_id=p.club_id AND pux.membership_id=m.id ORDER BY pux.created_at DESC LIMIT 1) pu ON TRUE
    WHERE ${where.join(' AND ')} ORDER BY p.display_name ASC`,...params)
}

async function personHistory(clubId:string,personId:string){
  await ensureSupporterMembershipSchema()
  const memberships=await prisma.$queryRawUnsafe<Array<{id:string;productId:string|null;productName:string|null;membershipNumber:string|null;status:string;season:string|null;validFrom:Date|null;validUntil:Date|null;priceCents:number|null;createdAt:Date;activatedAt:Date|null;cancelledAt:Date|null}>>(`SELECT m.id,m.product_id AS "productId",p.name AS "productName",m.membership_number AS "membershipNumber",m.status,m.season,m.valid_from AS "validFrom",m.valid_until AS "validUntil",m.price_cents AS "priceCents",m.created_at AS "createdAt",m.activated_at AS "activatedAt",m.cancelled_at AS "cancelledAt" FROM club_memberships m LEFT JOIN club_membership_products p ON p.id=m.product_id WHERE m.club_id=$1 AND m.member_person_id=$2 ORDER BY m.created_at DESC`,clubId,personId)
  const purchases=await prisma.$queryRawUnsafe<Array<{id:string;membershipId:string;paymentMethod:string;amountCents:number;paymentStatus:string;notes:string|null;paidAt:Date|null;createdAt:Date}>>(`SELECT id,membership_id AS "membershipId",payment_method AS "paymentMethod",amount_cents AS "amountCents",payment_status AS "paymentStatus",notes,paid_at AS "paidAt",created_at AS "createdAt" FROM club_membership_purchases WHERE club_id=$1 AND purchaser_person_id=$2 ORDER BY created_at DESC`,clubId,personId)
  const history=await prisma.$queryRawUnsafe<Array<{id:string;membershipId:string;action:string;fromStatus:string|null;toStatus:string|null;details:unknown;createdAt:Date}>>(`SELECT id,membership_id AS "membershipId",action,from_status AS "fromStatus",to_status AS "toStatus",details,created_at AS "createdAt" FROM club_membership_history WHERE club_id=$1 AND member_person_id=$2 ORDER BY created_at DESC`,clubId,personId)
  return{memberships,purchases,history}
}

function newCredentialToken(){return `pfm_${randomBytes(18).toString('base64url')}`}
function newCardAccessToken(){return `pfc_${randomBytes(24).toString('base64url')}`}

router.get('/card/:accessToken',async(req,res)=>{try{
  await ensureSupporterMembershipSchema();const accessToken=clean(req.params.accessToken,120);if(!accessToken.startsWith('pfc_')){res.status(404).json({error:'Membership card not found'});return}
  const rows=await prisma.$queryRawUnsafe<Array<{credentialToken:string;membershipId:string;membershipNumber:string|null;membershipStatus:string;season:string|null;validFrom:Date|null;validUntil:Date|null;productName:string;digitalCardEnabled:boolean;displayName:string;clubId:string;clubName:string;logoUrl:string|null;primaryColour:string|null;secondaryColour:string|null}>>(`SELECT c.credential_token AS "credentialToken",m.id AS "membershipId",m.membership_number AS "membershipNumber",m.status AS "membershipStatus",m.season,m.valid_from AS "validFrom",m.valid_until AS "validUntil",pr.name AS "productName",pr.digital_card_enabled AS "digitalCardEnabled",mp.display_name AS "displayName",cl.id AS "clubId",cl.name AS "clubName",cl.logo_url AS "logoUrl",cl.primary_colour AS "primaryColour",cl.secondary_colour AS "secondaryColour" FROM club_membership_credentials c JOIN club_memberships m ON m.id=c.membership_id AND m.club_id=c.club_id JOIN club_member_people mp ON mp.id=m.member_person_id AND mp.club_id=m.club_id LEFT JOIN club_membership_products pr ON pr.id=m.product_id JOIN clubs cl ON cl.id=m.club_id WHERE c.card_access_token=$1 AND c.status='ACTIVE' LIMIT 1`,accessToken);const row=rows[0];if(!row||!row.digitalCardEnabled){res.status(404).json({error:'Membership card not found'});return}
  const expired=Boolean(row.validUntil&&row.validUntil.getTime()<Date.now());const status=expired&&row.membershipStatus==='ACTIVE'?'EXPIRED':row.membershipStatus
  res.json({data:{club:{id:row.clubId,name:row.clubName,logoUrl:row.logoUrl,primaryColour:row.primaryColour,secondaryColour:row.secondaryColour},member:{displayName:row.displayName},membership:{id:row.membershipId,number:row.membershipNumber,status,season:row.season,validFrom:row.validFrom,validUntil:row.validUntil,productName:row.productName},credential:{token:row.credentialToken}}})
}catch(error){res.status(500).json({error:'Unable to load membership card',detail:String(error)})}})

router.use(authenticateClubUser)
router.use('/clubs/:clubId',requireActiveClubMembership)
router.use('/clubs/:clubId',(_req,res,next)=>{if(!canManageMemberships(res)){res.status(403).json({error:'Your club access does not include Memberships'});return}next()})

router.post('/clubs/:clubId/memberships/:membershipId/card',async(req,res)=>{try{
  await ensureSupporterMembershipSchema();const clubId=req.params.clubId,membershipId=req.params.membershipId;const rows=await prisma.$queryRawUnsafe<Array<{id:string;status:string;digitalCardEnabled:boolean}>>(`SELECT m.id,m.status,COALESCE(p.digital_card_enabled,false) AS "digitalCardEnabled" FROM club_memberships m LEFT JOIN club_membership_products p ON p.id=m.product_id WHERE m.id=$1 AND m.club_id=$2 LIMIT 1`,membershipId,clubId);const membership=rows[0];if(!membership){res.status(404).json({error:'Membership not found'});return}if(!membership.digitalCardEnabled){res.status(400).json({error:'Digital card is disabled for this membership product'});return}if(membership.status!=='ACTIVE'){res.status(400).json({error:'Only active memberships can issue a digital card'});return}
  let credentials=await prisma.$queryRawUnsafe<Array<{cardAccessToken:string}>>(`SELECT card_access_token AS "cardAccessToken" FROM club_membership_credentials WHERE membership_id=$1 AND club_id=$2 AND status='ACTIVE' LIMIT 1`,membershipId,clubId);if(!credentials[0]){const id=randomUUID(),credentialToken=newCredentialToken(),cardAccessToken=newCardAccessToken();await prisma.$executeRawUnsafe(`INSERT INTO club_membership_credentials (id,club_id,membership_id,credential_token,card_access_token,status) VALUES ($1,$2,$3,$4,$5,'ACTIVE')`,id,clubId,membershipId,credentialToken,cardAccessToken);credentials=[{cardAccessToken}]}
  res.json({data:{cardUrl:`/membership-card/${encodeURIComponent(credentials[0].cardAccessToken)}`},message:'Digital membership card ready'})
}catch(error){res.status(500).json({error:'Unable to prepare digital membership card',detail:String(error)})}})

router.get('/clubs/:clubId/overview',async(req,res)=>{try{await ensureSupporterMembershipSchema();const clubId=req.params.clubId;const [p,m]=await Promise.all([prisma.$queryRawUnsafe<Array<{status:string;count:bigint}>>(`SELECT status,COUNT(*)::bigint AS count FROM club_membership_products WHERE club_id=$1 GROUP BY status`,clubId),prisma.$queryRawUnsafe<Array<{count:bigint}>>(`SELECT COUNT(*)::bigint AS count FROM club_memberships WHERE club_id=$1 AND status='ACTIVE'`,clubId)]);const counts=Object.fromEntries(p.map(row=>[row.status,Number(row.count)]));res.json({data:{activeProducts:counts.ACTIVE||0,draftProducts:counts.DRAFT||0,archivedProducts:counts.ARCHIVED||0,activeMemberships:Number(m[0]?.count||0)}})}catch(error){res.status(500).json({error:'Unable to load memberships overview',detail:String(error)})}})
router.get('/clubs/:clubId/products',async(req,res)=>{try{res.json({data:(await productsForClub(req.params.clubId)).map(serialise)})}catch(error){res.status(500).json({error:'Unable to load membership products',detail:String(error)})}})
router.post('/clubs/:clubId/products',async(req,res)=>{try{const input=parseProduct(req.body),id=randomUUID(),clubId=req.params.clubId;await ensureSupporterMembershipSchema();await prisma.$transaction(async tx=>{await tx.$executeRawUnsafe(`INSERT INTO club_membership_products (id,club_id,name,description,price_cents,currency,category,status,sale_start,sale_end,valid_from,valid_until,season,digital_card_enabled,physical_card_enabled,created_by,archived_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,id,clubId,input.name,input.description,input.priceCents,input.currency,input.category,input.status,input.saleStart,input.saleEnd,input.validFrom,input.validUntil,input.season,input.digitalCardEnabled,input.physicalCardEnabled,req.clubUser?.id??null,input.status==='ARCHIVED'?new Date():null);await tx.$executeRawUnsafe(`INSERT INTO club_membership_product_entitlements (id,product_id,club_id,entitlement_type,configuration) VALUES ($1,$2,$3,'MATCH_ACCESS',$4::jsonb)`,randomUUID(),id,clubId,entitlementJson(input.entitlement))});const row=(await productsForClub(clubId,id))[0];res.status(201).json({data:serialise(row),message:'Membership product created'})}catch(error){res.status(400).json({error:error instanceof Error?error.message:'Unable to create membership product'})}})
router.patch('/clubs/:clubId/products/:productId',async(req,res)=>{try{const input=parseProduct(req.body),clubId=req.params.clubId,productId=req.params.productId,existing=(await productsForClub(clubId,productId))[0];if(!existing){res.status(404).json({error:'Membership product not found'});return}await prisma.$transaction(async tx=>{await tx.$executeRawUnsafe(`UPDATE club_membership_products SET name=$1,description=$2,price_cents=$3,currency=$4,category=$5,status=$6,sale_start=$7,sale_end=$8,valid_from=$9,valid_until=$10,season=$11,digital_card_enabled=$12,physical_card_enabled=$13,archived_at=$14,updated_at=NOW() WHERE id=$15 AND club_id=$16`,input.name,input.description,input.priceCents,input.currency,input.category,input.status,input.saleStart,input.saleEnd,input.validFrom,input.validUntil,input.season,input.digitalCardEnabled,input.physicalCardEnabled,input.status==='ARCHIVED'?(existing.archivedAt??new Date()):null,productId,clubId);await tx.$executeRawUnsafe(`INSERT INTO club_membership_product_entitlements (id,product_id,club_id,entitlement_type,configuration) VALUES ($1,$2,$3,'MATCH_ACCESS',$4::jsonb) ON CONFLICT (product_id,entitlement_type) DO UPDATE SET configuration=EXCLUDED.configuration,updated_at=NOW()`,randomUUID(),productId,clubId,entitlementJson(input.entitlement))});res.json({data:serialise((await productsForClub(clubId,productId))[0]),message:'Membership product updated'})}catch(error){res.status(400).json({error:error instanceof Error?error.message:'Unable to update membership product'})}})
router.post('/clubs/:clubId/products/:productId/archive',async(req,res)=>{try{await ensureSupporterMembershipSchema();const count=await prisma.$executeRawUnsafe(`UPDATE club_membership_products SET status='ARCHIVED',archived_at=NOW(),updated_at=NOW() WHERE id=$1 AND club_id=$2`,req.params.productId,req.params.clubId);if(!count){res.status(404).json({error:'Membership product not found'});return}res.json({data:{archived:true},message:'Membership product archived'})}catch(error){res.status(500).json({error:'Unable to archive membership product',detail:String(error)})}})
router.post('/clubs/:clubId/products/:productId/duplicate',async(req,res)=>{try{const clubId=req.params.clubId,source=(await productsForClub(clubId,req.params.productId))[0];if(!source){res.status(404).json({error:'Membership product not found'});return}const id=randomUUID();await prisma.$transaction(async tx=>{await tx.$executeRawUnsafe(`INSERT INTO club_membership_products (id,club_id,name,description,price_cents,currency,category,status,sale_start,sale_end,valid_from,valid_until,season,digital_card_enabled,physical_card_enabled,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,'DRAFT',$8,$9,$10,$11,$12,$13,$14,$15)`,id,clubId,`${source.name} Copy`,source.description,source.priceCents,source.currency,source.category,source.saleStart,source.saleEnd,source.validFrom,source.validUntil,source.season,source.digitalCardEnabled,source.physicalCardEnabled,req.clubUser?.id??null);await tx.$executeRawUnsafe(`INSERT INTO club_membership_product_entitlements (id,product_id,club_id,entitlement_type,configuration) VALUES ($1,$2,$3,'MATCH_ACCESS',$4::jsonb)`,randomUUID(),id,clubId,entitlementJson({regularSeasonHomeAccess:source.regularSeasonHomeAccess,clubControlledFinalsAccess:source.clubControlledFinalsAccess,admissionsPerEvent:source.admissionsPerEvent,totalAdmissions:source.totalAdmissions,reentryPolicy:source.reentryPolicy,peopleCovered:source.peopleCovered,benefits:source.benefits}))});res.status(201).json({data:serialise((await productsForClub(clubId,id))[0]),message:'Membership product duplicated as a draft'})}catch(error){res.status(500).json({error:'Unable to duplicate membership product',detail:String(error)})}})

router.get('/clubs/:clubId/members',async(req,res)=>{try{const status=clean(req.query.status,20).toUpperCase(),productId=clean(req.query.productId,100),search=clean(req.query.search,120);if(status&& !MEMBERSHIP_STATUSES.has(status)){res.status(400).json({error:'Invalid membership status filter'});return}res.json({data:await membersForClub(req.params.clubId,{search:search||undefined,status:status||undefined,productId:productId||undefined})})}catch(error){res.status(500).json({error:'Unable to load members',detail:String(error)})}})
router.get('/clubs/:clubId/members/:personId/history',async(req,res)=>{try{await ensureSupporterMembershipSchema();const people=await prisma.$queryRawUnsafe<Array<{id:string;displayName:string;firstName:string|null;lastName:string|null;email:string|null;phone:string|null}>>(`SELECT id,display_name AS "displayName",first_name AS "firstName",last_name AS "lastName",email,phone FROM club_member_people WHERE id=$1 AND club_id=$2 AND archived_at IS NULL LIMIT 1`,req.params.personId,req.params.clubId);if(!people[0]){res.status(404).json({error:'Member not found'});return}res.json({data:{person:people[0],...(await personHistory(req.params.clubId,req.params.personId))}})}catch(error){res.status(500).json({error:'Unable to load membership history',detail:String(error)})}})
router.post('/clubs/:clubId/members',async(req,res)=>{try{
  await ensureSupporterMembershipSchema();const clubId=req.params.clubId,body=req.body??{};const firstName=clean(body.firstName,100),lastName=clean(body.lastName,100),displayName=clean(body.displayName,200)||`${firstName} ${lastName}`.trim();if(!displayName)throw new Error('Member name is required')
  const productId=clean(body.productId,100);if(!productId)throw new Error('Membership product is required');const product=(await productsForClub(clubId,productId))[0];if(!product||product.status==='ARCHIVED')throw new Error('Membership product is not available')
  const paymentMethod=clean(body.paymentMethod,30).toUpperCase();if(!PAYMENT_METHODS.has(paymentMethod))throw new Error('Select a valid manual payment method')
  const status=clean(body.status,20).toUpperCase()||'ACTIVE';if(!MEMBERSHIP_STATUSES.has(status))throw new Error('Invalid membership status')
  const amountCents=intValue(body.amountCents,0,100000000,product.priceCents)??product.priceCents;const membershipNumber=clean(body.membershipNumber,80)||generatedMembershipNumber();const personId=randomUUID(),membershipId=randomUUID(),purchaseId=randomUUID();const now=new Date();
  await prisma.$transaction(async tx=>{
    await tx.$executeRawUnsafe(`INSERT INTO club_member_people (id,club_id,user_id,first_name,last_name,display_name,email,phone) VALUES ($1,$2,NULL,$3,$4,$5,$6,$7)`,personId,clubId,firstName||null,lastName||null,displayName,normalisedEmail(body.email),clean(body.phone,80)||null)
    await tx.$executeRawUnsafe(`INSERT INTO club_memberships (id,club_id,product_id,member_person_id,membership_number,status,season,valid_from,valid_until,price_cents,currency,source,activated_at,cancelled_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'AUD',$11,$12,$13)`,membershipId,clubId,productId,personId,membershipNumber,status,clean(body.season,30)||product.season,body.validFrom?dateValue(body.validFrom):product.validFrom,body.validUntil?dateValue(body.validUntil):product.validUntil,amountCents,paymentMethod,status==='ACTIVE'?now:null,status==='CANCELLED'?now:null)
    await tx.$executeRawUnsafe(`INSERT INTO club_membership_purchases (id,club_id,membership_id,purchaser_person_id,payment_method,amount_cents,currency,payment_status,notes,paid_at,created_by) VALUES ($1,$2,$3,$4,$5,$6,'AUD','RECORDED',$7,$8,$9)`,purchaseId,clubId,membershipId,personId,paymentMethod,amountCents,clean(body.paymentNotes,500)||null,status==='ACTIVE'?now:null,req.clubUser?.id??null)
    await tx.$executeRawUnsafe(`INSERT INTO club_membership_history (id,club_id,membership_id,member_person_id,action,from_status,to_status,details,actor_user_id) VALUES ($1,$2,$3,$4,'CREATED',NULL,$5,$6::jsonb,$7)`,randomUUID(),clubId,membershipId,personId,status,JSON.stringify({productId,productName:product.name,paymentMethod,amountCents}),req.clubUser?.id??null)
  })
  res.status(201).json({data:{personId,membershipId,membershipNumber},message:'Member added'})
}catch(error){const message=error instanceof Error?error.message:'Unable to add member';res.status(message.includes('unique')||message.includes('duplicate')?409:400).json({error:message})}})

router.patch('/clubs/:clubId/members/:personId',async(req,res)=>{try{
  await ensureSupporterMembershipSchema();const clubId=req.params.clubId,personId=req.params.personId,body=req.body??{};const rows=await prisma.$queryRawUnsafe<Array<{id:string}>>(`SELECT id FROM club_member_people WHERE id=$1 AND club_id=$2 AND archived_at IS NULL LIMIT 1`,personId,clubId);if(!rows[0]){res.status(404).json({error:'Member not found'});return}
  const firstName=clean(body.firstName,100),lastName=clean(body.lastName,100),displayName=clean(body.displayName,200)||`${firstName} ${lastName}`.trim();if(!displayName)throw new Error('Member name is required')
  await prisma.$executeRawUnsafe(`UPDATE club_member_people SET first_name=$1,last_name=$2,display_name=$3,email=$4,phone=$5,updated_at=NOW() WHERE id=$6 AND club_id=$7`,firstName||null,lastName||null,displayName,normalisedEmail(body.email),clean(body.phone,80)||null,personId,clubId)
  res.json({data:{personId},message:'Member details updated'})
}catch(error){res.status(400).json({error:error instanceof Error?error.message:'Unable to update member'})}})

router.patch('/clubs/:clubId/memberships/:membershipId',async(req,res)=>{try{
  await ensureSupporterMembershipSchema();const clubId=req.params.clubId,membershipId=req.params.membershipId,body=req.body??{};const rows=await prisma.$queryRawUnsafe<Array<{id:string;memberPersonId:string;status:string;productId:string|null}>>(`SELECT id,member_person_id AS "memberPersonId",status,product_id AS "productId" FROM club_memberships WHERE id=$1 AND club_id=$2 LIMIT 1`,membershipId,clubId);const current=rows[0];if(!current){res.status(404).json({error:'Membership not found'});return}
  const status=clean(body.status,20).toUpperCase()||current.status;if(!MEMBERSHIP_STATUSES.has(status))throw new Error('Invalid membership status')
  const productId=clean(body.productId,100)||current.productId;const product=productId?(await productsForClub(clubId,productId))[0]:null;if(productId&&!product)throw new Error('Membership product not found')
  const membershipNumber=clean(body.membershipNumber,80)||generatedMembershipNumber();const season=clean(body.season,30)||product?.season||null;const validFrom=body.validFrom!==undefined?dateValue(body.validFrom):product?.validFrom??null;const validUntil=body.validUntil!==undefined?dateValue(body.validUntil):product?.validUntil??null;const priceCents=intValue(body.priceCents,0,100000000,product?.priceCents??0)??0;const now=new Date()
  await prisma.$transaction(async tx=>{
    await tx.$executeRawUnsafe(`UPDATE club_memberships SET product_id=$1,membership_number=$2,status=$3,season=$4,valid_from=$5,valid_until=$6,price_cents=$7,activated_at=CASE WHEN $3='ACTIVE' AND activated_at IS NULL THEN $8 ELSE activated_at END,cancelled_at=CASE WHEN $3='CANCELLED' THEN $8 ELSE NULL END,updated_at=NOW() WHERE id=$9 AND club_id=$10`,productId,membershipNumber,status,season,validFrom,validUntil,priceCents,now,membershipId,clubId)
    if(status==='CANCELLED')await tx.$executeRawUnsafe(`UPDATE club_membership_credentials SET status='REVOKED',revoked_at=NOW() WHERE membership_id=$1 AND club_id=$2 AND status='ACTIVE'`,membershipId,clubId)
    await tx.$executeRawUnsafe(`INSERT INTO club_membership_history (id,club_id,membership_id,member_person_id,action,from_status,to_status,details,actor_user_id) VALUES ($1,$2,$3,$4,'UPDATED',$5,$6,$7::jsonb,$8)`,randomUUID(),clubId,membershipId,current.memberPersonId,current.status,status,JSON.stringify({productId,season,validFrom,validUntil,priceCents}),req.clubUser?.id??null)
  })
  res.json({data:{membershipId,status},message:status==='CANCELLED'?'Membership cancelled':'Membership updated'})
}catch(error){const message=error instanceof Error?error.message:'Unable to update membership';res.status(message.includes('unique')||message.includes('duplicate')?409:400).json({error:message})}})

export { router as clubSupporterMembershipsRouter }
