from pathlib import Path

def replace(path, old, new, label):
    p=Path(path); text=p.read_text()
    if old not in text:
        raise SystemExit(f'{label}: target not found in {path}')
    p.write_text(text.replace(old,new,1))
    print('Updated',path,label)

# --- auth: schema + membership fields + invitation propagation ---
p=Path('backend/src/auth/club-auth.ts'); t=p.read_text()
if "from './club-permissions.js'" not in t:
    t=t.replace("import { prisma } from '../db/client.js'", "import { prisma } from '../db/client.js'\nimport { effectiveClubPermissions, type ClubPermissionKey, type ClubPermissionPreset } from './club-permissions.js'")
t=t.replace("revokedAt: Date | null; createdAt: Date; updatedAt: Date\n}", "revokedAt: Date | null; createdAt: Date; updatedAt: Date\n  preset: ClubPermissionPreset | null; permissions: ClubPermissionKey[]\n}")
needle="      `ALTER TABLE club_portal_memberships ADD COLUMN IF NOT EXISTS review_notes TEXT`,"
if "ADD COLUMN IF NOT EXISTS preset" not in t:
    t=t.replace(needle, needle+"\n      `ALTER TABLE club_portal_memberships ADD COLUMN IF NOT EXISTS preset TEXT DEFAULT 'CUSTOM'`,\n      `ALTER TABLE club_portal_memberships ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]'::jsonb`,")
needle2="    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS \"club_portal_invites_email_idx\" ON club_portal_invitations (email, expires_at)`)"
if "club_portal_invitations ADD COLUMN IF NOT EXISTS preset" not in t:
    t=t.replace(needle2, "    await prisma.$executeRawUnsafe(`ALTER TABLE club_portal_invitations ADD COLUMN IF NOT EXISTS preset TEXT DEFAULT 'CUSTOM'`)\n    await prisma.$executeRawUnsafe(`ALTER TABLE club_portal_invitations ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]'::jsonb`)\n"+needle2)
t=t.replace(' created_at AS "createdAt", updated_at AS "updatedAt"`', ' created_at AS "createdAt", updated_at AS "updatedAt", preset, permissions`')
# Login and every membership lookup must create/upgrade the schema before selecting permission columns.
t=t.replace("export async function membershipsForUser(userId: string): Promise<ClubMembership[]> {\n  return prisma.$queryRawUnsafe", "export async function membershipsForUser(userId: string): Promise<ClubMembership[]> {\n  await ensureClubMembershipSchema()\n  return prisma.$queryRawUnsafe")
t=t.replace("export async function membershipForClub(userId: string, clubId: string) {\n  const rows = await prisma.$queryRawUnsafe", "export async function membershipForClub(userId: string, clubId: string) {\n  await ensureClubMembershipSchema()\n  const rows = await prisma.$queryRawUnsafe")
old="export async function issueClubInvitation(clubId: string, email: string, role: ClubRole, actorId: string) {\n  await ensureClubMembershipSchema(); const token = randomBytes(32).toString('hex')\n  await prisma.$executeRawUnsafe(`INSERT INTO club_portal_invitations (id,club_id,email,role,token_hash,invited_by,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`, randomUUID(), clubId, email.trim().toLowerCase(), role, hashToken(token), actorId, new Date(Date.now()+7*86400000))\n  return token\n}"
new="export async function issueClubInvitation(clubId: string, email: string, role: ClubRole, actorId: string, access?: { preset?: ClubPermissionPreset; permissions?: ClubPermissionKey[] }) {\n  await ensureClubMembershipSchema(); const token = randomBytes(32).toString('hex')\n  const preset=access?.preset??'CUSTOM',permissions=access?.permissions??[]\n  await prisma.$executeRawUnsafe(`INSERT INTO club_portal_invitations (id,club_id,email,role,token_hash,invited_by,expires_at,preset,permissions) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`, randomUUID(), clubId, email.trim().toLowerCase(), role, hashToken(token), actorId, new Date(Date.now()+7*86400000),preset,JSON.stringify(permissions))\n  return token\n}"
if old in t:t=t.replace(old,new)
t=t.replace("Array<{id:string;clubId:string;email:string;role:ClubRole;invitedBy:string}>>(`SELECT id,club_id AS \"clubId\",email,role,invited_by AS \"invitedBy\"", "Array<{id:string;clubId:string;email:string;role:ClubRole;invitedBy:string;preset:ClubPermissionPreset|null;permissions:ClubPermissionKey[]}>>(`SELECT id,club_id AS \"clubId\",email,role,invited_by AS \"invitedBy\",preset,permissions")
t=t.replace("(id,user_id,email,club_id,role,status,invited_by,approved_by,approved_at) VALUES ($1,$2,$3,$4,$5,'ACTIVE',$6,$6,NOW()) ON CONFLICT (user_id,club_id) DO UPDATE SET role=EXCLUDED.role,status='ACTIVE',invited_by=EXCLUDED.invited_by,approved_by=EXCLUDED.approved_by,approved_at=NOW(),revoked_at=NULL,updated_at=NOW()`", "(id,user_id,email,club_id,role,status,invited_by,approved_by,approved_at,preset,permissions) VALUES ($1,$2,$3,$4,$5,'ACTIVE',$6,$6,NOW(),$7,$8::jsonb) ON CONFLICT (user_id,club_id) DO UPDATE SET role=EXCLUDED.role,status='ACTIVE',invited_by=EXCLUDED.invited_by,approved_by=EXCLUDED.approved_by,approved_at=NOW(),preset=EXCLUDED.preset,permissions=EXCLUDED.permissions,revoked_at=NULL,updated_at=NOW()`")
t=t.replace("randomUUID(), user.id, invite.email, invite.clubId, invite.role, invite.invitedBy)", "randomUUID(), user.id, invite.email, invite.clubId, invite.role, invite.invitedBy,invite.preset??'CUSTOM',JSON.stringify(invite.permissions??[]))")
if "export function clubUserCan" not in t:
    t += "\nexport function clubUserCan(membership: ClubMembership, permission: ClubPermissionKey) { return effectiveClubPermissions(membership).includes(permission) }\n"
p.write_text(t); print('Updated auth')

# route mount
p=Path('backend/src/api/routes/club-portal-access.ts');t=p.read_text()
if "clubPermissionsRouter" not in t:
    t=t.replace("import { coachAppRouter } from './coach-app.js'", "import { coachAppRouter } from './coach-app.js'\nimport { clubPermissionsRouter } from './club-permissions.js'")
    t=t.replace("router.use('/coach-app',coachAppRouter)", "router.use('/permissions',clubPermissionsRouter)\nrouter.use('/coach-app',coachAppRouter)")
p.write_text(t); print('Mounted permission router')

# coach context permission-aware
p=Path('backend/src/api/routes/coach-app.ts');t=p.read_text()
t=t.replace("import { authenticateClubUser, membershipsForUser, roleCan } from '../../auth/club-auth.js'", "import { authenticateClubUser, membershipsForUser } from '../../auth/club-auth.js'\nimport { allowedClubAreas, defaultPermissionPage, effectiveClubPermissions } from '../../auth/club-permissions.js'")
t=t.replace("const memberships = (await membershipsForUser(req.clubUser!.id)).filter(item => item.status === 'ACTIVE' && roleCan(item.role, 'team_selection'))\n    if (!memberships.length) return res.status(403).json({ error: 'This account does not have access to team selection' })", "const memberships = (await membershipsForUser(req.clubUser!.id)).filter(item => item.status === 'ACTIVE' && effectiveClubPermissions(item).length > 0)\n    if (!memberships.length) return res.status(403).json({ error: 'This account does not have active app permissions' })")
t=t.replace("membership:{ role:membership.role,canSelectTeam:true,canOverrideFixture:membership.role==='OWNER'||membership.role==='ADMIN' },", "membership:{ role:membership.role,canSelectTeam:effectiveClubPermissions(membership).includes('coaching.select-team'),canOverrideFixture:membership.role==='OWNER'||membership.role==='ADMIN' },\n      access:{permissions:effectiveClubPermissions(membership),allowedAreas:allowedClubAreas(effectiveClubPermissions(membership)),defaultPage:defaultPermissionPage(effectiveClubPermissions(membership))},")
p.write_text(t);print('Updated coach context')

# dashboard add permissions
p=Path('src/components/CoachAppClubDashboard.tsx');t=p.read_text()
t=t.replace("import { BarChart3, ChevronRight, Clapperboard, Globe2, Settings2, ShieldCheck, Trophy }", "import { BarChart3, ChevronRight, Clapperboard, Globe2, Settings2, ShieldCheck, Trophy, UsersRound }")
t=t.replace("export type ClubAppArea = 'coaching' | 'studio' | 'website' | 'operations' | 'analytics'", "export type ClubAppArea = 'coaching' | 'studio' | 'website' | 'operations' | 'analytics' | 'permissions'")
if "key:'permissions'" not in t:
    t=t.replace("  {key:'analytics',title:'Analytics',description:'Review club, team, player and commercial performance.',icon:BarChart3,live:false},", "  {key:'analytics',title:'Analytics',description:'Review club, team, player and commercial performance.',icon:BarChart3,live:false},\n  {key:'permissions',title:'Permissions',description:'Add users and control access down to individual pages.',icon:UsersRound,live:true},")
p.write_text(t);print('Updated club dashboard')

# Coach App integration
p=Path('src/pages/CoachApp.tsx');t=p.read_text()
if "CoachAppPermissions" not in t:
    t=t.replace("import CoachAppClubDashboard, { type ClubAppArea } from '../components/CoachAppClubDashboard'", "import CoachAppClubDashboard, { type ClubAppArea } from '../components/CoachAppClubDashboard'\nimport CoachAppPermissions from './CoachAppPermissions'")
t=t.replace("  nextStep: 'SELECT_SIDE' | 'MATCH_DAY'\n}", "  nextStep: 'SELECT_SIDE' | 'MATCH_DAY'\n  access?: { permissions: string[]; allowedAreas: ClubAppArea[]; defaultPage: string }\n}")
t=t.replace("type Screen = 'CLUB_DASHBOARD' | 'DASHBOARD' |", "type Screen = 'CLUB_DASHBOARD' | 'PERMISSIONS' | 'DASHBOARD' |")
t=t.replace("setClubs([]);setContext(next);setScreen(new URLSearchParams(window.location.search).get('screen')==='match-day'?'MATCH_DAY':'CLUB_DASHBOARD')", "setClubs([]);setContext(next);const requested=new URLSearchParams(window.location.search).get('screen');setScreen(requested==='match-day'?'MATCH_DAY':next.access?.defaultPage==='STATS'?'STATS':'CLUB_DASHBOARD')")
t=t.replace("const pageLabel=screen==='CLUB_DASHBOARD'?'Club Dashboard':", "const pageLabel=screen==='CLUB_DASHBOARD'?'Club Dashboard':screen==='PERMISSIONS'?'Permissions':")
t=t.replace("onOpen={(area:ClubAppArea)=>{if(area==='coaching')setScreen('DASHBOARD')}}", "allowedAreas={context.access?.allowedAreas} onOpen={(area:ClubAppArea)=>{if(area==='coaching')setScreen('DASHBOARD');if(area==='permissions')setScreen('PERMISSIONS')}}")
needle="    {screen==='GAME_PLAN'?<CoachAppGamePlan"
if "screen==='PERMISSIONS'?" not in t:
    t=t.replace(needle, "    {screen==='PERMISSIONS'?<CoachAppPermissions clubId={context.club.id} token={session.access_token} onExit={()=>setScreen('CLUB_DASHBOARD')}/>:screen==='GAME_PLAN'?<CoachAppGamePlan")
t=t.replace("screen!=='DASHBOARD'&&screen!=='CLUB_DASHBOARD'?", "screen!=='DASHBOARD'&&screen!=='CLUB_DASHBOARD'&&screen!=='PERMISSIONS'?")
p.write_text(t);print('Integrated permissions page')

p=Path('src/pages/CoachAppPermissions.tsx');t=p.read_text().replace("applicantName?:string|null}","applicantName?:string|null;updatedAt?:string}")
p.write_text(t)
