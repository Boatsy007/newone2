import { useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'
import {
  loadNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferences as Preferences,
} from '../../lib/supporter'

const PLATFORM: Array<[keyof Preferences, string, string]> = [
  ['FIXTURES', 'Fixtures', 'Upcoming matches and fixture changes for followed clubs and leagues'],
  ['RESULTS', 'Results', 'Final scores and newly published results'],
  ['RANKINGS', 'Rankings', 'National and league ranking movements'],
  ['NEWS', 'News', 'Articles and match reports connected to what you follow'],
  ['HIGHLIGHTS', 'Highlights', 'Approved nominees, voting updates and weekly winners'],
  ['RECORDS', 'Records', 'New club, player, weekly and season records'],
]

const GOAL_KICKERS: Array<[keyof Preferences, string, string]> = [
  ['MILESTONES', 'Goal milestones', '50 goals, 100 goals and fastest-to milestones'],
  ['LEADERSHIP', 'Goal-kicker leaders', 'National, league, club and top-10 changes'],
  ['WEEKLY', 'Weekly goal performances', 'Big weekly increases and standout updates'],
  ['UPDATES', 'Goal-total updates', 'Normal total changes for followed players'],
]

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState<Preferences | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { void loadNotificationPreferences().then(setPrefs) }, [])
  if (!prefs) return null

  const toggle = async (key: keyof Preferences) => {
    const previous = prefs
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    setSaving(true)
    setMessage('')
    try {
      await saveNotificationPreferences(next)
      setMessage('Saved')
    } catch {
      setPrefs(previous)
      setMessage('Could not save')
    } finally {
      setSaving(false)
    }
  }

  const rows = (items: Array<[keyof Preferences, string, string]>) => items.map(([key, title, copy]) => (
    <button type="button" key={key} onClick={() => void toggle(key)} disabled={saving} aria-pressed={prefs[key]}>
      <span><strong>{title}</strong><small>{copy}</small></span>
      <i className={prefs[key] ? 'on' : ''}><b /></i>
    </button>
  ))

  return <section className="nprefs">
    <header><BellRing size={20} /><div><span>Notification preferences</span><h2>Choose what you receive</h2><p>These settings apply to updates from the clubs, leagues and players you follow.</p></div>{message && <small>{message}</small>}</header>
    <section><h3>Matches and platform updates</h3><div>{rows(PLATFORM)}</div></section>
    <section><h3>Goal-kicker updates</h3><div>{rows(GOAL_KICKERS)}</div></section>
    <style>{`.nprefs{margin-bottom:18px;border:1px solid #dfe5eb;border-radius:12px;background:#fff;overflow:hidden}.nprefs>header{display:flex;align-items:flex-start;gap:12px;padding:18px;border-bottom:1px solid #e6ebef}.nprefs>header svg{margin-top:3px;color:#2daaf5}.nprefs>header div{flex:1}.nprefs>header span{color:#2daaf5;font-size:10px;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.nprefs h2{margin:3px 0 0;font-family:'Bebas Neue',Impact,sans-serif;font-size:30px;text-transform:uppercase}.nprefs>header p{margin:4px 0 0;color:#687385;font-size:13px}.nprefs>header>small{font-weight:800;color:#168447}.nprefs>section>h3{margin:0;padding:12px 18px;background:#f6f8fa;color:#687385;font-size:10px;font-weight:950;letter-spacing:.12em;text-transform:uppercase}.nprefs>section>div{display:grid;grid-template-columns:1fr 1fr}.nprefs button{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 18px;border:0;border-bottom:1px solid #edf0f3;background:#fff;text-align:left;cursor:pointer}.nprefs button:nth-child(odd){border-right:1px solid #edf0f3}.nprefs button:disabled{cursor:wait;opacity:.75}.nprefs button strong,.nprefs button small{display:block}.nprefs button strong{font-size:14px}.nprefs button small{margin-top:4px;color:#687385;line-height:1.3}.nprefs i{width:43px;height:24px;padding:3px;border-radius:999px;background:#cdd5dd;flex:0 0 auto}.nprefs i b{display:block;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .18s}.nprefs i.on{background:#2daaf5}.nprefs i.on b{transform:translateX(19px)}@media(max-width:650px){.nprefs>section>div{grid-template-columns:1fr}.nprefs button:nth-child(odd){border-right:0}.nprefs>header{align-items:flex-start}.nprefs>header>small{position:absolute;right:28px}}`}</style>
  </section>
}
