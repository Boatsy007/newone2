import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'
import { fetchFootballRecords, recordCategories, recordLabels, type FootballRecordsPayload, type RecordPeriod } from '../lib/footballRecords'

const BLUE = '#42b8ff'
const INK = '#0c0e13'
const LINE = '#e2e7ed'
const MUTE = '#687385'

export default function Records() {
  const [period, setPeriod] = useState<RecordPeriod>('week')
  const [season, setSeason] = useState('')
  const [state, setState] = useState('')
  const [league, setLeague] = useState('')
  const [grade, setGrade] = useState('')
  const [data, setData] = useState<FootballRecordsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void fetchFootballRecords({ period, season, state, league, grade, limit: 5 })
      .then(payload => { if (active) setData(payload) })
      .catch(() => { if (active) setError('Football records could not be loaded.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [period, season, state, league, grade])

  const leagues = useMemo(() => data?.options.leagues ?? [], [data])

  return <>
    <Nav />
    <main className="records-page">
      <section className="records-hero">
        <div className="records-shell records-hero-inner">
          <div><span>Across community football</span><h1>Footy records</h1><p>The biggest scores, tightest finishes and standout performances from every published result.</p></div>
          <Trophy size={76} aria-hidden="true" />
        </div>
      </section>

      <section className="records-shell records-controls" aria-label="Record filters">
        <div className="records-period">
          <button type="button" className={period === 'week' ? 'active' : ''} onClick={() => setPeriod('week')}>This week</button>
          <button type="button" className={period === 'season' ? 'active' : ''} onClick={() => setPeriod('season')}>Season</button>
        </div>
        <label>Season<select value={season} onChange={event => setSeason(event.target.value)}><option value="">All seasons</option>{data?.options.seasons.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>State<select value={state} onChange={event => setState(event.target.value)}><option value="">All states</option>{data?.options.states.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>League<select value={league} onChange={event => setLeague(event.target.value)}><option value="">All leagues</option>{leagues.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
        <label>Grade<select value={grade} onChange={event => setGrade(event.target.value)}><option value="">All grades</option>{data?.options.grades.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      </section>

      <section className="records-shell records-content">
        {loading && <div className="records-message">Loading records…</div>}
        {error && <div className="records-message error">{error}</div>}
        {!loading && !error && data && recordCategories.map(category => {
          const entries = data.categories[category] ?? []
          return <article className="records-section" key={category}>
            <div className="records-section-head"><div><span>{period === 'week' ? 'This week' : 'Season records'}</span><h2>{recordLabels[category]}</h2></div></div>
            {entries.length === 0 ? <p className="records-empty">No published results match these filters.</p> : <div className="records-list">
              {entries.map(entry => <div className="records-row" key={`${category}-${entry.resultId}-${entry.rank}`}>
                <span className="records-rank">{entry.rank}</span>
                <div className="records-team"><strong>{entry.clubName}</strong><small>{entry.leagueName} · {entry.state}{entry.round ? ` · ${entry.round}` : ''}</small></div>
                <div className="records-result"><strong>{entry.valueLabel}</strong><small>{entry.homeName} {entry.homePoints} — {entry.awayPoints} {entry.awayName}</small></div>
                <Link to={entry.matchUrl}>View match <ArrowRight size={16} /></Link>
              </div>)}
            </div>}
          </article>
        })}
      </section>
    </main>
    <Footer />
    <style>{`
      .records-page{background:#f3f6f8;color:${INK};min-height:100vh;font-family:Barlow,Inter,Arial,sans-serif}.records-shell{width:min(1180px,calc(100% - 40px));margin:0 auto}.records-hero{background:#050505;color:#fff}.records-hero-inner{min-height:300px;display:flex;align-items:center;justify-content:space-between;gap:30px}.records-hero span,.records-section-head span{text-transform:uppercase;font-size:10px;letter-spacing:.17em;font-weight:900;color:${BLUE}}.records-hero h1,.records-section h2{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase}.records-hero h1{font-size:clamp(4rem,9vw,7rem);line-height:.85;margin:10px 0 14px}.records-hero p{max-width:680px;color:#c9d0d9;font-size:18px;line-height:1.55}.records-hero svg{color:${BLUE};flex:0 0 auto}.records-controls{display:grid;grid-template-columns:1.25fr repeat(4,minmax(0,1fr));gap:12px;padding:24px 0}.records-controls label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:900;color:${MUTE}}.records-controls select{display:block;width:100%;margin-top:7px;border:1px solid ${LINE};border-radius:9px;background:#fff;padding:12px;color:${INK};font:inherit;text-transform:none;letter-spacing:0}.records-period{display:grid;grid-template-columns:1fr 1fr;align-self:end;background:#fff;border:1px solid ${LINE};border-radius:9px;padding:4px}.records-period button{border:0;background:transparent;border-radius:7px;padding:12px;font-weight:900;cursor:pointer}.records-period button.active{background:${BLUE};color:#050505}.records-content{padding:6px 0 54px;display:grid;gap:18px}.records-section{background:#fff;border:1px solid ${LINE};border-radius:12px;overflow:hidden}.records-section-head{padding:20px 22px;border-bottom:1px solid ${LINE}}.records-section h2{font-size:34px;line-height:1;margin:6px 0 0}.records-list{display:grid}.records-row{display:grid;grid-template-columns:44px minmax(0,1fr) minmax(0,1.1fr) auto;align-items:center;gap:14px;padding:15px 22px;border-bottom:1px solid #edf1f4}.records-row:last-child{border-bottom:0}.records-rank{display:grid;place-items:center;width:36px;height:36px;border-radius:8px;background:${BLUE};font-family:'Bebas Neue',Impact,sans-serif;font-size:24px}.records-team strong,.records-team small,.records-result strong,.records-result small{display:block}.records-team strong{font-size:16px}.records-team small,.records-result small{color:${MUTE};font-size:12px;margin-top:4px}.records-result>strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:27px;color:#0783c9}.records-row>a{display:inline-flex;align-items:center;gap:7px;color:#0783c9;text-decoration:none;text-transform:uppercase;font-size:11px;font-weight:900}.records-empty,.records-message{padding:26px 22px;color:${MUTE}.records-message.error{color:#b42318}}
      @media(max-width:900px){.records-controls{grid-template-columns:1fr 1fr}.records-period{grid-column:1/-1}.records-row{grid-template-columns:40px minmax(0,1fr) auto}.records-result{grid-column:2/-1}.records-row>a{grid-column:2/-1}}
      @media(max-width:560px){.records-shell{width:min(100% - 24px,1180px)}.records-hero-inner{min-height:250px}.records-hero svg{display:none}.records-hero h1{font-size:4.6rem}.records-hero p{font-size:15px}.records-controls{grid-template-columns:1fr}.records-period{grid-column:auto}.records-row{padding:14px}.records-section-head{padding:18px}.records-section h2{font-size:30px}}
    `}</style>
  </>
}
