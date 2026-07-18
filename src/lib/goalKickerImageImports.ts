import { getKey } from './admin'

async function request<T>(path:string,body:unknown):Promise<T>{const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${getKey()}`},body:JSON.stringify(body)});const json=await response.json().catch(()=>({}));if(!response.ok)throw new Error((json as {error?:string}).error??`HTTP ${response.status}`);return json as T}
export type GoalKickerImageRow={playerName:string;clubName:string;goals:number;matches?:number;clubMatch:{clubId:string|null;matchedName:string|null;score:number;confident:boolean};playerMatch:{id:string;playerName:string;clubName:string;goals:number;matches:number|null}|null}
export type GoalKickerImagePreview={league:string|null;grade:string;season:string;matchedLeagueId:string|null;rows:GoalKickerImageRow[];uncertain:number;notes:string|null}
export type GoalKickerCommitIssue={playerName:string;error?:string;warning?:string}
export type GoalKickerCommitResponse={data:{imported:number;weeklyChanges:number;errors:number;warnings:number;league:string;season:string;grade:string};errors?:GoalKickerCommitIssue[];warnings?:GoalKickerCommitIssue[]}
export const goalKickerImageImports={
 parse:(image:string,leagueId?:string)=>request<{data:GoalKickerImagePreview}>('/admin/goal-kicker-images/parse',{image,leagueId}).then(r=>r.data),
 commit:(body:{leagueId:string;season:string;grade:string;rows:Array<{playerName:string;clubName:string;clubId:string|null;goals:number;matches:number|null}>})=>request<GoalKickerCommitResponse>('/admin/goal-kicker-images/commit',body),
}
