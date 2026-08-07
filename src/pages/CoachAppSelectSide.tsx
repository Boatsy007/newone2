import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronRight, LogOut, Save, Users } from 'lucide-react'

const FIELD_ROWS = [
  ['BP_LEFT','FB','BP_RIGHT'],
  ['HBF_LEFT','CHB','HBF_RIGHT'],
  ['WING_LEFT','CENTRE','WING_RIGHT'],
  ['RUCK','RUCK_ROVER','ROVER'],
  ['HFF_LEFT','CHF','HFF_RIGHT'],
  ['FP_LEFT','FF','FP_RIGHT'],
]
const BENCH = ['INTERCHANGE_1','INTERCHANGE_2','INTERCHANGE_3','INTERCHANGE_4']
const EMERGENCIES = ['EMERGENCY_1','EMERGENCY_2','EMERGENCY_3']
const LABELS: Record<string,string> = {
  BP_LEFT:'BP',FB:'FB',BP_RIGHT:'BP',HBF_LEFT:'HBF',CHB:'CHB',HBF_RIGHT:'HBF',WING_LEFT:'Wing',CENTRE:'Centre',WING_RIGHT:'Wing',
  RUCK:'Ruck',RUCK_ROVER:'Rover',ROVER:'Rover',HFF_LEFT:'HFF',CHF:'CHF',HFF_RIGHT:'HFF',FP_LEFT:'FP',FF:'FF',FP_RIGHT:'FP',
  INTERCHANGE_1:'Interchange',INTERCHANGE_2:'Interchange',INTERCHANGE_3:'Interchange',INTERCHANGE_4:'Interchange',
  EMERGENCY_1:'Emergency',EMERGENCY_2:'Emergency',EMERGENCY_3:'Emergency',
}

type Player = { id:string; playerName:string; jumperNumber:number|null; active:boolean }
type Selected = { clubPlayerId:string; positionCode:string }
type Sheet = { id:string; players:Array<Player & { clubPlayerId:string; positionCode:string }> }

type Props = {
  clubId:string
  sheetId:string
  token:string
  onContinue:()=>void
  onExit:()=>void
}

export default function CoachAppSelectSide({ clubId, sheetId, token, onContinue, onExit }:Props) {
  const [players,setPlayers] = useState<Player[]>([])
  const [selected,setSelected] = useState<Selected[]>([])
  const [loading,setLoading] = useState(true)
  const [saving,setSaving] = useState(false)
  const [saved,setSaved] = useState(false)
  const [error,setError] = useState('')
  const headers = useMemo<Record<string,string>>(() => ({ authorization:`Bearer ${token}` }), [token])
  const jsonHeaders = useMemo<Record<string,string>>(() => ({ ...headers, 'content-type':'application/json' }), [headers])
  const used = useMemo(() => new Set(selected.map(item => item.clubPlayerId)), [selected])

  useEffect(() => {
    let live = true
    setLoading(true)
    Promise.all([
      fetch(`/api/club-portal/team-sheets/clubs/${encodeURIComponent(clubId)}/players`,{headers}).then(async r=>{const p=await r.json();if(!r.ok)throw new Error(p.error||'Unable to load players');return p}),
      fetch(`/api/club-portal/team-sheets/clubs/${encodeURIComponent(clubId)}/sheets`,{headers}).then(async r=>{const p=await r.json();if(!r.ok)throw new Error(p.error||'Unable to load team sheet');return p}),
    ]).then(([playerPayload,sheetPayload])=>{
      if(!live)return
      setPlayers((Array.isArray(playerPayload.data)?playerPayload.data:[]).filter((p:Player)=>p.active))
      const sheet=(Array.isArray(sheetPayload.data)?sheetPayload.data:[]).find((item:Sheet)=>item.id===sheetId) as Sheet|undefined
      setSelected(sheet?.players.map(player=>({clubPlayerId:player.clubPlayerId,positionCode:player.positionCode}))??[])
    }).catch(reason=>{if(live)setError(reason instanceof Error?reason.message:'Unable to load team selection')}).finally(()=>{if(live)setLoading(false)})
    return()=>{live=false}
  },[clubId,sheetId,headers])

  function assign(positionCode:string,clubPlayerId:string){
    setSaved(false)
    setSelected(current=>{
      const next=current.filter(item=>item.positionCode!==positionCode&&item.clubPlayerId!==clubPlayerId)
      return clubPlayerId?[...next,{positionCode,clubPlayerId}]:next
    })
  }

  async function save(continueAfter:boolean){
    setSaving(true);setError('');setSaved(false)
    try{
      const response=await fetch(`/api/club-portal/team-sheets/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(sheetId)}/positions`,{
        method:'PUT',headers:jsonHeaders,body:JSON.stringify({positions:selected}),
      })
      const payload=await response.json().catch(()=>({}))
      if(!response.ok)throw new Error(payload.error||'Unable to save selection')
      setSaved(true)
      if(continueAfter)onContinue()
    }catch(reason){setError(reason instanceof Error?reason.message:'Unable to save selection')}
    finally{setSaving(false)}
  }

  if(loading)return <section className="cas-state">Loading your squad…</section>

  return <section className="cas-root">
    <div className="cas-topline"><div><Users size={18}/><b>{selected.length} selected</b><span>{players.length} available</span></div>{saved&&<span className="cas-saved"><Check size={15}/> Saved</span>}</div>
    {error&&<div className="cas-error">{error}</div>}
    <div className="cas-layout">
      <div className="cas-field-wrap">
        <div className="cas-field">
          {FIELD_ROWS.map((row,index)=><div className="cas-row" key={index}>{row.map(code=><Position key={code} code={code} players={players} selected={selected.find(item=>item.positionCode===code)?.clubPlayerId||''} used={used} onChange={value=>assign(code,value)}/>)}</div>)}
        </div>
      </div>
      <aside className="cas-side">
        <div className="cas-panel"><h2>Interchange</h2>{BENCH.map(code=><Position key={code} code={code} players={players} selected={selected.find(item=>item.positionCode===code)?.clubPlayerId||''} used={used} onChange={value=>assign(code,value)}/>)}</div>
        <div className="cas-panel"><h2>Emergencies</h2>{EMERGENCIES.map(code=><Position key={code} code={code} players={players} selected={selected.find(item=>item.positionCode===code)?.clubPlayerId||''} used={used} onChange={value=>assign(code,value)}/>)}</div>
      </aside>
    </div>
    <nav className="cas-actions">
      <button className="quiet" onClick={onExit}><LogOut size={17}/> Save and Exit</button>
      <button onClick={()=>void save(false)} disabled={saving}><Save size={17}/>{saving?'Saving…':'Save Selection'}</button>
      <button className="primary" onClick={()=>void save(true)} disabled={saving}>Continue to Match Day <ChevronRight size={18}/></button>
    </nav>
    <style>{styles}</style>
  </section>
}

function Position({code,players,selected,used,onChange}:{code:string;players:Player[];selected:string;used:Set<string>;onChange:(value:string)=>void}){
  return <label className="cas-position"><span>{LABELS[code]}</span><select value={selected} onChange={e=>onChange(e.target.value)}><option value="">Select</option>{players.filter(player=>player.id===selected||!used.has(player.id)).map(player=><option key={player.id} value={player.id}>{player.jumperNumber?`${player.jumperNumber}. `:''}{player.playerName}</option>)}</select></label>
}

const styles=`
.cas-root{padding:18px max(18px,env(safe-area-inset-right)) 110px max(18px,env(safe-area-inset-left));font-family:Barlow,Inter,Arial,sans-serif}.cas-state{min-height:60vh;display:grid;place-items:center;font-weight:900}.cas-topline{max-width:1200px;margin:0 auto 14px;display:flex;align-items:center;justify-content:space-between}.cas-topline>div{display:flex;align-items:center;gap:9px}.cas-topline span{color:#657482;font-size:13px}.cas-saved{display:flex;align-items:center;gap:5px!important;color:#0b8d55!important;font-weight:900}.cas-error{max-width:1200px;margin:0 auto 14px;padding:12px;border-radius:10px;background:#fff0f0;color:#a32822;font-weight:850}.cas-layout{max-width:1200px;margin:auto;display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:18px}.cas-field-wrap,.cas-panel{border:1px solid #d7e0e7;border-radius:20px;background:#fff;box-shadow:0 10px 30px rgba(18,38,55,.06)}.cas-field-wrap{padding:18px}.cas-field{width:min(700px,100%);aspect-ratio:4/5;margin:auto;padding:9% 6%;box-sizing:border-box;border:4px solid #17202a;border-radius:48%/16%;background:repeating-linear-gradient(0deg,#b8dc91 0 8.33%,#9fce78 8.33% 16.66%)}.cas-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:8%}.cas-side{display:grid;gap:16px;align-content:start}.cas-panel{padding:16px}.cas-panel h2{margin:0 0 10px;font-family:'Bebas Neue',Impact,sans-serif;font-size:28px;text-transform:uppercase}.cas-panel .cas-position{margin-top:10px}.cas-position{display:grid;gap:4px;min-width:0}.cas-position span{font-size:9px;font-weight:950;letter-spacing:.08em;text-transform:uppercase}.cas-position select{width:100%;min-width:0;box-sizing:border-box;border:1px solid rgba(17,24,39,.25);border-radius:9px;background:#fff;padding:10px 7px;font-size:13px;font-weight:800}.cas-actions{position:fixed;z-index:1250;right:0;bottom:0;left:0;display:flex;justify-content:flex-end;gap:10px;padding:12px max(18px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(18px,env(safe-area-inset-left));border-top:1px solid #d5dde4;background:rgba(255,255,255,.97);backdrop-filter:blur(14px)}.cas-actions button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:48px;border:0;border-radius:11px;background:#e7edf2;padding:11px 16px;color:#10151a;font-weight:950;text-transform:uppercase}.cas-actions button.primary{background:#22c77a}.cas-actions button.quiet{margin-right:auto}.cas-actions button:disabled{opacity:.55}
@media(max-width:900px){.cas-layout{grid-template-columns:1fr}.cas-side{grid-template-columns:1fr 1fr}.cas-field{max-width:620px}}@media(max-width:650px){.cas-root{padding-left:10px;padding-right:10px}.cas-field-wrap{padding:8px}.cas-position select{font-size:11px;padding:8px 4px}.cas-side{grid-template-columns:1fr}.cas-actions{display:grid;grid-template-columns:1fr 1fr}.cas-actions button.quiet{margin:0}.cas-actions button.primary{grid-column:1/-1}.cas-root{padding-bottom:166px}}@media(orientation:landscape) and (max-height:760px){.cas-layout{grid-template-columns:minmax(0,1fr) 260px}.cas-field{width:min(540px,100%)}.cas-actions{padding-top:8px;padding-bottom:max(8px,env(safe-area-inset-bottom))}}
`
