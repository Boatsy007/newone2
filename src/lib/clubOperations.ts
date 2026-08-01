const SESSION_KEY='playfooty.clubPortal.session.v1'

type Session={access_token:string}
export type ClubOperationsPayload={volunteers:unknown[];shifts:unknown[];equipment:unknown[];updatedAt?:string|null;updatedBy?:string|null}

function session():Session|null{
 try{const raw=localStorage.getItem(SESSION_KEY);return raw?JSON.parse(raw) as Session:null}catch{return null}
}

function headers(json=false){
 const current=session()
 if(!current?.access_token)throw new Error('Sign in through the Club Portal to continue.')
 return{authorization:`Bearer ${current.access_token}`,...(json?{'content-type':'application/json'}:{})}
}

async function response<T>(request:Promise<Response>):Promise<T>{
 const result=await request
 const payload=await result.json().catch(()=>({}))
 if(!result.ok)throw new Error(payload.error||'Club operations request failed')
 return payload.data as T
}

export function loadClubOperations(clubId:string){
 return response<ClubOperationsPayload>(fetch(`/api/club-portal/operations/clubs/${encodeURIComponent(clubId)}`,{headers:headers()}))
}

export function saveVolunteerOperations(clubId:string,volunteers:unknown[],shifts:unknown[]){
 return response<{volunteers:unknown[];shifts:unknown[]}>(fetch(`/api/club-portal/operations/clubs/${encodeURIComponent(clubId)}/volunteers`,{method:'PUT',headers:headers(true),body:JSON.stringify({volunteers,shifts})}))
}

export function saveEquipmentOperations(clubId:string,equipment:unknown[]){
 return response<{equipment:unknown[]}>(fetch(`/api/club-portal/operations/clubs/${encodeURIComponent(clubId)}/equipment`,{method:'PUT',headers:headers(true),body:JSON.stringify({equipment})}))
}
