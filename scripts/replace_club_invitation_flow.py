from pathlib import Path
import re


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing marker: {label}')
    return text.replace(old, new, 1)

# Permission key for explicit legacy portal access
p = Path('backend/src/auth/club-permissions.ts')
s = p.read_text()
if "'legacy.portal'" not in s:
    s = s.replace("  'permissions.manage',\n] as const", "  'permissions.manage',\n  'legacy.portal',\n] as const")
p.write_text(s)

# Branded invitation delivery and new app join link
p = Path('backend/src/api/routes/club-permissions.ts')
s = p.read_text()
if 'sendPlayFootyInvite' not in s:
    marker = "async function activeOwnerCount(clubId: string) {"
    helper = r'''async function sendPlayFootyInvite(input:{email:string;clubName:string;clubLogoUrl:string|null;joinUrl:string;preset:string}) {
  const apiKey=String(process.env.RESEND_API_KEY??'').trim()
  if(!apiKey)return {sent:false,reason:'RESEND_API_KEY is not configured'}
  const from=String(process.env.PLAYFOOTY_INVITE_FROM??'PlayFooty <clubs@playfooty.com.au>')
  const logo=input.clubLogoUrl?`<img src="${input.clubLogoUrl}" alt="" width="72" height="72" style="display:block;border-radius:16px;margin:0 auto 18px;object-fit:contain;background:#fff">`:''
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({from,to:[input.email],subject:`Join ${input.clubName} on PlayFooty`,html:`<!doctype html><html><body style="margin:0;background:#07131d;font-family:Arial,sans-serif;color:#fff"><div style="max-width:560px;margin:0 auto;padding:36px 20px"><div style="color:#42b8ff;font-weight:900;letter-spacing:.16em;text-transform:uppercase">PlayFooty Club App</div><div style="margin-top:18px;padding:30px;border-radius:22px;background:#0d2130;border:1px solid #244457;text-align:center">${logo}<h1 style="margin:0 0 10px;font-size:34px">You’re invited to ${input.clubName}</h1><p style="margin:0 0 22px;color:#b9cbd7;line-height:1.5">Your access has been set as <b style="color:#fff">${input.preset.replaceAll('_',' ')}</b>. Join once, then PlayFooty will take you directly to the pages you can use.</p><a href="${input.joinUrl}" style="display:inline-block;padding:15px 24px;border-radius:12px;background:#42b8ff;color:#07131d;text-decoration:none;font-weight:900">Join club</a><p style="margin:22px 0 0;color:#7893a4;font-size:12px">This secure link can only be used once and expires in seven days.</p></div></div></body></html>`})})
  if(!response.ok)throw new Error(`Invitation email failed (${response.status})`)
  return {sent:true}
}

'''
    s = s.replace(marker, helper + marker)
old = """    const token=await issueClubInvitation(clubId,email,role as any,req.clubUser!.id,{preset,permissions})
    await auditMembership(existing[0]?.id??null,clubId,null,'PERMISSION_INVITATION_CREATED',req.clubUser!.id,{email,preset,permissions})
    return res.status(201).json({data:{email,preset,permissions,invitePath:`/club-portal?invite=${token}`,expiresInDays:7},message:'User invitation created'})"""
new = """    const token=await issueClubInvitation(clubId,email,role as any,req.clubUser!.id,{preset,permissions})
    const club=await prisma.club.findUnique({where:{id:clubId},select:{name:true,logoUrl:true}})
    const configuredOrigin=String(process.env.PUBLIC_SITE_URL??process.env.SITE_URL??'https://playfooty.com.au').replace(/\\/$/,'')
    const invitePath=`/coach-app/join?invite=${token}`
    const delivery=await sendPlayFootyInvite({email,clubName:club?.name??'your club',clubLogoUrl:club?.logoUrl??null,joinUrl:`${configuredOrigin}${invitePath}`,preset}).catch(error=>({sent:false,reason:error instanceof Error?error.message:String(error)}))
    await auditMembership(existing[0]?.id??null,clubId,null,'PERMISSION_INVITATION_CREATED',req.clubUser!.id,{email,preset,permissions,delivery})
    return res.status(201).json({data:{email,preset,permissions,invitePath,expiresInDays:7,emailSent:delivery.sent,emailError:'reason' in delivery?delivery.reason:null},message:delivery.sent?'PlayFooty invitation sent':'Invitation created — copy the secure join link'})"""
s = replace_once(s, old, new, 'permission invitation response')
p.write_text(s)

# Public one-time join API and permission-aware account information
p = Path('backend/src/api/routes/portal-auth.ts')
s = p.read_text()
if "from 'node:crypto'" not in s:
    s = "import { createHash } from 'node:crypto'\n" + s
if "defaultPermissionPage" not in s:
    s = s.replace("import { prisma } from '../../db/client.js'", "import { prisma } from '../../db/client.js'\nimport { defaultPermissionPage, effectiveClubPermissions } from '../../auth/club-permissions.js'")
if 'async function supabaseAdminCreateUser' not in s:
    marker = "async function relayAuth("
    helper = r'''async function supabaseAdminCreateUser(email:string,password:string) {
  const url=String(process.env.SUPABASE_URL??process.env.VITE_SUPABASE_URL??'').replace(/\/$/,'')
  const serviceKey=String(process.env.SUPABASE_SERVICE_ROLE_KEY??'')
  if(!url||!serviceKey)throw Object.assign(new Error('PlayFooty account creation is temporarily unavailable'),{status:503})
  const response=await fetch(`${url}/auth/v1/admin/users`,{method:'POST',headers:{apikey:serviceKey,authorization:`Bearer ${serviceKey}`,'content-type':'application/json'},body:JSON.stringify({email,password,email_confirm:true,user_metadata:{source:'playfooty_club_invitation'}}),signal:AbortSignal.timeout(8000)})
  const payload=await response.json().catch(()=>({})) as Record<string,unknown>
  if(!response.ok){const message=String(payload.msg??payload.message??payload.error??'Unable to create account');throw Object.assign(new Error(message),{status:response.status})}
  return payload
}

const inviteHash=(token:string)=>createHash('sha256').update(token).digest('hex')
async function invitationDetails(token:string){
  const rows=await prisma.$queryRawUnsafe<Array<{id:string;clubId:string;email:string;preset:string|null;permissions:string[];expiresAt:Date;clubName:string;clubLogoUrl:string|null}>>(`SELECT i.id,i.club_id AS "clubId",i.email,i.preset,i.permissions,i.expires_at AS "expiresAt",c.name AS "clubName",c.logo_url AS "clubLogoUrl" FROM club_portal_invitations i JOIN "Club" c ON c.id=i.club_id WHERE i.token_hash=$1 AND i.revoked_at IS NULL AND i.accepted_at IS NULL AND i.expires_at>NOW() LIMIT 1`,inviteHash(token))
  return rows[0]??null
}
async function clubAccountsFor(user:AuthenticatedClubUser){
  const memberships=(await membershipsForUser(user.id)).filter(item=>item.status==='ACTIVE')
  const clubIds=[...new Set(memberships.map(item=>item.clubId))]
  const clubs=clubIds.length?await prisma.club.findMany({where:{id:{in:clubIds},archivedAt:null},select:{id:true,name:true,logoUrl:true}}):[]
  const byId=new Map(clubs.map(club=>[club.id,club]))
  return memberships.map(membership=>{const permissions=effectiveClubPermissions(membership);return {clubId:membership.clubId,clubName:byId.get(membership.clubId)?.name??'Club',logoUrl:byId.get(membership.clubId)?.logoUrl??null,role:membership.role,permissions,defaultPage:defaultPermissionPage(permissions),legacyPortal:permissions.includes('legacy.portal')}})
}

'''
    s = s.replace(marker, helper + marker)
if "router.get('/club-invite/:token'" not in s:
    marker = "router.post('/signin', async (req, res) => {"
    routes = r'''router.get('/club-invite/:token',async(req,res)=>{
  try{const token=String(req.params.token??'').trim();if(!token)return res.status(400).json({error:'Invitation token is required'});const invite=await invitationDetails(token);if(!invite)return res.status(404).json({error:'This invitation is invalid, expired or has already been used'});return res.json({data:{email:invite.email,clubName:invite.clubName,clubLogoUrl:invite.clubLogoUrl,preset:invite.preset,permissions:invite.permissions,expiresAt:invite.expiresAt}})}catch(reason){return res.status(500).json({error:reason instanceof Error?reason.message:'Unable to open invitation'})}
})

router.post('/club-invite/:token/accept',async(req,res)=>{
  const token=String(req.params.token??'').trim(),email=String(req.body?.email??'').trim().toLowerCase(),password=String(req.body?.password??''),mode=String(req.body?.mode??'signin')
  if(!token||!email||password.length<8)return res.status(400).json({error:'Email and a password of at least 8 characters are required'})
  try{
    const invite=await invitationDetails(token);if(!invite)return res.status(404).json({error:'This invitation is invalid, expired or has already been used'})
    if(invite.email!==email)return res.status(403).json({error:'Use the email address that received this invitation'})
    if(mode==='signup')await supabaseAdminCreateUser(email,password)
    const result=await supabaseRequest('token?grant_type=password',{email,password})
    const auth=result.payload as AuthPayload,user=authenticatedUser(auth,email)
    const membership=await acceptClubInvitation(user,token);if(!membership)return res.status(404).json({error:'This invitation could not be accepted'})
    const accounts=await clubAccountsFor(user)
    const accepted=accounts.find(account=>account.clubId===invite.clubId)
    return res.json({...auth,club_accounts:accounts,accepted_club:accepted,redirect:'/coach-app'})
  }catch(reason){const error=reason as Error&{status?:number};const message=error.message.includes('already been registered')?'A PlayFooty account already exists for this email. Choose “I already have an account” and sign in.':error.message;return res.status(error.status??503).json({error:message||'Unable to join this club'})}
})

'''
    s = s.replace(marker, routes + marker)
# Replace duplicated club account assembly with helper
pattern = re.compile(r"\n    const memberships = \(await membershipsForUser\(user\.id\)\).*?\n    return res\.json\(\{ \.\.\.auth, club_accounts: clubAccounts \}\)", re.S)
replacement = "\n    const clubAccounts=await clubAccountsFor(user)\n    return res.json({ ...auth, club_accounts: clubAccounts })"
s, count = pattern.subn(replacement, s, count=1)
if count != 1:
    raise SystemExit('could not replace signin club account assembly')
p.write_text(s)

# App join page
join = r'''import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, LoaderCircle, LockKeyhole } from 'lucide-react'

type Invite={email:string;clubName:string;clubLogoUrl:string|null;preset:string|null;permissions:string[];expiresAt:string}
type Session={access_token:string;refresh_token:string;expires_at?:number;expires_in?:number;user?:{id?:string;email?:string|null};club_accounts?:unknown[]}
const SESSION_KEY='playfooty.clubPortal.session.v1',CLUB_KEY='playfooty.coachApp.club.v1'
export default function CoachAppJoin(){
 const token=new URLSearchParams(location.search).get('invite')??''
 const[invite,setInvite]=useState<Invite|null>(null),[mode,setMode]=useState<'signup'|'signin'>('signup'),[password,setPassword]=useState(''),[loading,setLoading]=useState(true),[joining,setJoining]=useState(false),[error,setError]=useState('')
 useEffect(()=>{void fetch(`/api/portal-auth/club-invite/${encodeURIComponent(token)}`).then(async r=>{const p=await r.json();if(!r.ok)throw new Error(p.error||'Unable to open invitation');setInvite(p.data)}).catch(e=>setError(e instanceof Error?e.message:'Unable to open invitation')).finally(()=>setLoading(false))},[token])
 async function join(e:React.FormEvent){e.preventDefault();if(!invite)return;setJoining(true);setError('');try{const r=await fetch(`/api/portal-auth/club-invite/${encodeURIComponent(token)}/accept`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:invite.email,password,mode})});const p=await r.json();if(!r.ok)throw new Error(p.error||'Unable to join club');const session=p as Session;localStorage.setItem(SESSION_KEY,JSON.stringify(session));if(p.accepted_club?.clubId)localStorage.setItem(CLUB_KEY,p.accepted_club.clubId);location.replace('/coach-app')}catch(e){setError(e instanceof Error?e.message:'Unable to join club')}finally{setJoining(false)}}
 if(loading)return <main className="join-load"><LoaderCircle/><b>Opening your invitation…</b><style>{styles}</style></main>
 return <main className="join"><style>{styles}</style><section className="join-card">{invite?.clubLogoUrl?<img src={invite.clubLogoUrl} alt=""/>:<div className="join-logo">PF</div>}<span>PlayFooty Club App</span><h1>{invite?`Join ${invite.clubName}`:'Invitation unavailable'}</h1>{invite&&<><p>You have been invited as <b>{(invite.preset??'Custom access').replaceAll('_',' ')}</b>. Create or use your PlayFooty login and you’ll go straight to the pages you are allowed to use.</p><div className="join-email"><LockKeyhole/><span><small>Invited email</small><b>{invite.email}</b></span></div><div className="join-tabs"><button className={mode==='signup'?'active':''} onClick={()=>setMode('signup')}>Create account</button><button className={mode==='signin'?'active':''} onClick={()=>setMode('signin')}>I already have an account</button></div><form onSubmit={join}><label>{mode==='signup'?'Create a password':'Your password'}<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} autoComplete={mode==='signup'?'new-password':'current-password'} required/></label>{error&&<div className="join-error">{error}</div>}<button disabled={joining}>{joining?<><LoaderCircle/> Joining…</>:<>{mode==='signup'?'Create account and join':'Sign in and join'} <ArrowRight/></>}</button></form><ul><li><CheckCircle2/> One secure step</li><li><CheckCircle2/> Automatic sign-in</li><li><CheckCircle2/> Only your approved access</li></ul></>}{!invite&&<div className="join-error">{error||'This invitation is invalid or has expired.'}</div>}</section></main>
}
const styles=`.join,.join *{box-sizing:border-box}.join,.join-load{min-height:100dvh;background:#07131d;color:#fff;font-family:Barlow,Inter,Arial,sans-serif;display:grid;place-items:center;padding:22px}.join-load{gap:14px;align-content:center}.join-load svg,.join form button svg{animation:spin .8s linear infinite;color:#42b8ff}.join-load b{font-size:20px}.join-card{width:min(520px,100%);padding:28px;border:1px solid #234252;border-radius:24px;background:#0d2130;box-shadow:0 28px 80px rgba(0,0,0,.35)}.join-card>img,.join-logo{width:82px;height:82px;display:grid;place-items:center;margin:0 auto 18px;border-radius:18px;background:#fff;object-fit:contain;color:#07131d;font-weight:1000}.join-card>span{display:block;color:#42b8ff;text-align:center;text-transform:uppercase;font-size:11px;font-weight:950;letter-spacing:.16em}.join h1{margin:7px 0 10px;text-align:center;font-family:'Bebas Neue',Impact,sans-serif;font-size:48px;line-height:.95;text-transform:uppercase}.join-card>p{margin:0 auto 20px;text-align:center;color:#b9cbd7;line-height:1.5}.join-email{display:flex;align-items:center;gap:12px;padding:13px;border:1px solid #28495d;border-radius:14px;background:#081923}.join-email svg{color:#42b8ff}.join-email span,.join-email small,.join-email b{display:block}.join-email small{color:#7893a4;text-transform:uppercase;font-weight:900}.join-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0}.join-tabs button{min-height:45px;border:1px solid #31566c;border-radius:11px;background:transparent;color:#a9bfcc;font-weight:900}.join-tabs button.active{background:#42b8ff;color:#07131d;border-color:#42b8ff}.join form{display:grid;gap:12px}.join label{display:grid;gap:7px;font-size:12px;font-weight:900;text-transform:uppercase}.join input{min-height:52px;padding:0 14px;border:1px solid #41657a;border-radius:12px;background:#06111a;color:#fff;font:inherit;font-size:17px}.join form>button{min-height:54px;display:flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:12px;background:#42b8ff;color:#07131d;font-weight:1000;font-size:16px}.join form>button svg{width:19px;color:inherit}.join-error{padding:12px;border-radius:11px;background:#401923;color:#ffbec8}.join ul{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:18px 0 0;padding:0;list-style:none}.join li{display:flex;align-items:center;justify-content:center;gap:5px;color:#96afbd;text-align:center;font-size:11px}.join li svg{width:15px;color:#37d58a}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:560px){.join{padding:12px}.join-card{padding:22px 17px}.join h1{font-size:41px}.join ul{grid-template-columns:1fr}}`
'''
Path('src/pages/CoachAppJoin.tsx').write_text(join)

# Register route
p=Path('src/main.tsx');s=p.read_text()
if "CoachAppJoin" not in s:
    anchor="import ClubPortal from './pages/ClubPortal.tsx'"
    s=replace_once(s,anchor,anchor+"\nimport CoachAppJoin from './pages/CoachAppJoin.tsx'",'main import')
    route='    <Route path="/club-portal" element={<ClubPortal/>}/>'
    s=replace_once(s,route,route+'\n    <Route path="/coach-app/join" element={<CoachAppJoin/>}/>','main route')
p.write_text(s)

# Make Club Portal route app-only users to coach app
p=Path('src/lib/portalAuth.ts');s=p.read_text()
s=s.replace("  role: string\n}","  role: string\n  permissions?: string[]\n  defaultPage?: string\n  legacyPortal?: boolean\n}",1)
p.write_text(s)
p=Path('src/pages/ClubPortal.tsx');s=p.read_text()
s=s.replace("function openClub(clubId:string){window.location.assign(safeReturnTo()??`/club-portal/${encodeURIComponent(clubId)}`)}","function openClub(account:PortalClubAccount){const destination=safeReturnTo()??(account.legacyPortal?`/club-portal/${encodeURIComponent(account.clubId)}`:'/coach-app');window.location.assign(destination)}")
s=s.replace("openClub(current.club_accounts[0].clubId)","openClub(current.club_accounts[0])")
s=s.replace("function chooseClub(clubId:string){setOpeningClub(true);openClub(clubId)}","function chooseClub(account:PortalClubAccount){setOpeningClub(true);openClub(account)}")
s=s.replace("onClick={()=>chooseClub(account.clubId)}","onClick={()=>chooseClub(account)}")
p.write_text(s)

# Frontend permissions label
p=Path('src/pages/CoachAppPermissions.tsx');s=p.read_text()
if "'legacy.portal'" not in s:
    s=s.replace("  | 'analytics.access'|'permissions.manage'","  | 'analytics.access'|'permissions.manage'|'legacy.portal'")
    s=s.replace("  'analytics.access':'Analytics','permissions.manage':'Manage permissions',","  'analytics.access':'Analytics','permissions.manage':'Manage permissions','legacy.portal':'Legacy Club Portal',")
    s=s.replace("{title:'Administration',keys:['permissions.manage'] as PermissionKey[]}","{title:'Administration',keys:['permissions.manage','legacy.portal'] as PermissionKey[]}")
p.write_text(s)

print('replacement invitation flow applied')
