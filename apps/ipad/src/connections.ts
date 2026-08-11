import { apiGet } from './api'

export type ConnectedFixture = {
  id:string; leagueId?:string; season:string; grade:string; round:number|string|null; matchDate:string|null
  homeClubId:string; awayClubId:string; homeClubName?:string; awayClubName?:string; homeName?:string; awayName?:string; venue?:string|null
}
export type ConnectedSheetPlayer = { clubPlayerId?:string; id?:string; positionCode?:string; [key:string]:unknown }
export type ConnectedSheet = {
  id:string; clubId?:string; fixtureId:string|null; season:string; grade:string; roundLabel:string; opponentName:string|null
  matchDate:string|null; status:string; playerCount?:number; players?:ConnectedSheetPlayer[]
}
export type CoachContext = {
  club?:{id:string;name?:string}; team?:{leagueId?:string;leagueName?:string;season?:string;grade?:string}|null
  fixture:ConnectedFixture|null; teamSheet:ConnectedSheet|null; matchDay?:{started?:boolean;version?:number;updatedAt?:string}|null
  nextStep?:'MATCH_DAY'|'SELECT_SIDE'
}
export type ClubConnections = { context:CoachContext|null; fixture:ConnectedFixture|null; teamSheet:ConnectedSheet|null; fixtures:ConnectedFixture[]; sheets:ConnectedSheet[]; ownerClubId:string }

const norm=(value:unknown)=>String(value??'').trim().toLowerCase().replace(/[^a-z0-9]+/g,' ')
const roundNumber=(value:unknown)=>{const match=String(value??'').match(/\d+/);return match?Number(match[0]):null}
const dateValue=(value:unknown)=>{const time=new Date(String(value??'')).getTime();return Number.isFinite(time)?time:Number.MAX_SAFE_INTEGER}
const todayValue=()=>{const now=new Date();return new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime()}
const isUpcoming=(fixture:ConnectedFixture)=>dateValue(fixture.matchDate)>=todayValue()
const playerCount=(sheet:ConnectedSheet)=>sheet.players?.length??sheet.playerCount??0

export function sheetMatchesFixture(sheet:ConnectedSheet,fixture:ConnectedFixture|null){
  if(!fixture)return false
  if(sheet.fixtureId&&sheet.fixtureId===fixture.id)return true
  const sameGrade=!sheet.grade||!fixture.grade||norm(sheet.grade)===norm(fixture.grade)
  const sameRound=roundNumber(sheet.roundLabel)!=null&&roundNumber(sheet.roundLabel)===roundNumber(fixture.round)
  const names=[fixture.homeName,fixture.awayName,fixture.homeClubName,fixture.awayClubName].filter(Boolean).map(norm)
  return sameGrade&&(sameRound||Boolean(sheet.opponentName&&names.includes(norm(sheet.opponentName))))
}

export function selectConnectedSheet(context:CoachContext|null,sheets:ConnectedSheet[],fixture:ConnectedFixture|null=context?.fixture??null){
  const exact=context?.teamSheet?.id&&sheets.find(row=>row.id===context.teamSheet?.id)
  if(exact)return exact
  const matching=sheets.filter(row=>sheetMatchesFixture(row,fixture)).sort((a,b)=>Number(b.status==='PUBLISHED')-Number(a.status==='PUBLISHED')||playerCount(b)-playerCount(a))
  if(matching[0])return matching[0]
  if(context?.teamSheet)return {...context.teamSheet,players:context.teamSheet.players??[]}
  if(fixture)return null
  return [...sheets].sort((a,b)=>Number(b.status==='PUBLISHED')-Number(a.status==='PUBLISHED')||playerCount(b)-playerCount(a)||dateValue(a.matchDate)-dateValue(b.matchDate))[0]??null
}

export function selectConnectedFixture(context:CoachContext|null,fixtures:ConnectedFixture[],sheet:ConnectedSheet|null){
  const upcoming=fixtures.filter(isUpcoming)
  if(context?.fixture&&isUpcoming(context.fixture))return context.fixture
  if(sheet?.fixtureId){const exact=upcoming.find(row=>row.id===sheet.fixtureId);if(exact)return exact}
  if(sheet){const match=upcoming.find(row=>sheetMatchesFixture(sheet,row));if(match)return match}
  return [...upcoming].sort((a,b)=>dateValue(a.matchDate)-dateValue(b.matchDate)||((roundNumber(a.round)??0)-(roundNumber(b.round)??0)))[0]??null
}

export async function loadClubConnections(clubId:string,accessToken:string):Promise<ClubConnections>{
  const [contextResult,fixtureResult,sheetResult]=await Promise.all([
    apiGet<{data?:CoachContext}>(`/club-portal/coach-app/context?clubId=${encodeURIComponent(clubId)}`,accessToken,6500).catch(()=>({data:undefined})),
    apiGet<{data?:ConnectedFixture[]}>(`/fixtures/club/${encodeURIComponent(clubId)}?upcoming=true`,undefined,6500).catch(()=>({data:[]})),
    apiGet<{data?:ConnectedSheet[]}>(`/club-portal/team-sheets/clubs/${encodeURIComponent(clubId)}/sheets`,accessToken,6500).catch(()=>({data:[]})),
  ])
  const context=contextResult.data??null
  let ownerClubId=context?.teamSheet?.clubId||context?.club?.id||clubId
  let sheets=Array.isArray(sheetResult.data)?sheetResult.data:[]
  if(ownerClubId!==clubId){
    const owner=await apiGet<{data?:ConnectedSheet[]}>(`/club-portal/team-sheets/clubs/${encodeURIComponent(ownerClubId)}/sheets`,accessToken,6500).catch(()=>({data:[]}))
    const rows=Array.isArray(owner.data)?owner.data:[]
    if(rows.length)sheets=rows
  }
  const fixtures=Array.isArray(fixtureResult.data)?fixtureResult.data:[]
  let fixture=selectConnectedFixture(context,fixtures,context?.teamSheet??null)
  const teamSheet=selectConnectedSheet(context,sheets,fixture)
  fixture=selectConnectedFixture(context,fixtures,teamSheet)
  ownerClubId=teamSheet?.clubId||ownerClubId
  const resolvedContext:CoachContext=(context?{...context}:{fixture:null,teamSheet:null})
  resolvedContext.fixture=fixture
  resolvedContext.teamSheet=teamSheet
  return {context:resolvedContext,fixture,teamSheet,fixtures,sheets,ownerClubId}
}

export const connectedPlayerCount=(sheet:ConnectedSheet|null)=>sheet?playerCount(sheet):0
export const connectedRoundLabel=(fixture:ConnectedFixture|null,sheet:ConnectedSheet|null)=>fixture?.round==null?(sheet?.roundLabel||'Upcoming match'):`Round ${roundNumber(fixture.round)??fixture.round}`
export const connectedHomeName=(fixture:ConnectedFixture)=>fixture.homeName||fixture.homeClubName||'Home'
export const connectedAwayName=(fixture:ConnectedFixture)=>fixture.awayName||fixture.awayClubName||'Away'
