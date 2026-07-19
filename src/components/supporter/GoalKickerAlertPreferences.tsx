import { useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'
import { loadGoalKickerAlertPreferences, saveGoalKickerAlertPreferences, type GoalKickerAlertPreferences as Preferences } from '../../lib/supporter'

const LABELS: Array<[keyof Preferences,string,string]> = [
  ['MILESTONES','Milestones','50 goals, 100 goals and fastest-to milestones'],
  ['LEADERSHIP','Leadership changes','National, league, club and top-10 changes'],
  ['WEEKLY','Weekly performances','Big weekly increases and standout updates'],
  ['UPDATES','General total updates','Normal goal-total changes for followed players'],
]

export default function GoalKickerAlertPreferences(){
  const [prefs,setPrefs]=useState<Preferences|null>(null),[saving,setSaving]=useState(false),[message,setMessage]=useState('')
  useEffect(()=>{loadGoalKickerAlertPreferences().then(setPrefs)},[])
  if(!prefs)return null
  const toggle=async(key:keyof Preferences)=>{const next={...prefs,[key]:!prefs[key]};setPrefs(next);setSaving(true);setMessage('');try{await saveGoalKickerAlertPreferences(next);setMessage('Saved')}catch{setPrefs(prefs);setMessage('Could not save')}finally{setSaving(false)}}
  return <section className="gkap"><header><BellRing size={20}/><div><span>Goal-kicker alerts</span><h2>Choose what you receive</h2></div>{message&&<small>{message}</small>}</header><div>{LABELS.map(([key,title,copy])=><button type="button" key={key} onClick={()=>void toggle(key)} disabled={saving} aria-pressed={prefs[key]}><span><strong>{title}</strong><small>{copy}</small></span><i className={prefs[key]?'on':''}><b/></i></button>)}</div><style>{`.gkap{margin-bottom:18px;border:1px solid #dfe5eb;border-radius:12px;background:#fff;overflow:hidden}.gkap>header{display:flex;align-items:center;gap:12px;padding:18px;border-bottom:1px solid #e6ebef}.gkap>header svg{color:#2daaf5}.gkap>header div{flex:1}.gkap>header span{color:#2daaf5;font-size:10px;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.gkap h2{margin:3px 0 0;font-family:'Bebas Neue',Impact,sans-serif;font-size:30px;text-transform:uppercase}.gkap>header>small{font-weight:800;color:#168447}.gkap>div{display:grid;grid-template-columns:1fr 1fr}.gkap button{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 18px;border:0;border-bottom:1px solid #edf0f3;background:#fff;text-align:left;cursor:pointer}.gkap button:nth-child(odd){border-right:1px solid #edf0f3}.gkap button strong,.gkap button small{display:block}.gkap button strong{font-size:14px}.gkap button small{margin-top:4px;color:#687385;line-height:1.3}.gkap i{width:43px;height:24px;padding:3px;border-radius:999px;background:#cdd5dd;flex:0 0 auto}.gkap i b{display:block;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .18s}.gkap i.on{background:#2daaf5}.gkap i.on b{transform:translateX(19px)}@media(max-width:650px){.gkap>div{grid-template-columns:1fr}.gkap button:nth-child(odd){border-right:0}}`}</style></section>
}
