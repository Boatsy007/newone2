import { useEffect, useState } from 'react'
import { ArrowLeft, Check, ExternalLink, RefreshCw, Star, Trash2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getKey, setKey } from '../lib/admin'

type Row = {
  id: string; category: string; playerName: string; clubName: string; leagueName?: string | null
  videoUrl: string; description?: string | null; submitterName: string; submitterEmail: string
  status: string; weekKey: string; votingOpensAt?: string | null; votingClosesAt?: string | null
  winner: boolean; votes: number; createdAt: string; moderationNote?: string | null
}

const req = async <T,>(method: string, path: string, body?: unknown): Promise<T> => {
  const response = await fetch(path, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${getKey()}` }, body: body == null ? undefined : JSON.stringify(body) })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${response.status}`)
  return json as T
}

export default function AdminHighlights() {
  const [authed, setAuthed] = useState(!!getKey())
  const [key, setLocalKey] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [filter, setFilter] = useState('PENDING')
  const [message, setMessage] = useState('')
  const load = () => req<{ data: Row[] }>('GET', `/admin/highlights${filter === 'ALL' ? '' : `?status=${filter}`}`).then(r => setRows(r.data)).catch(e => setMessage(e.message))
  useEffect(() => { if (authed) load() }, [authed, filter])

  if (!authed) return <main className="hm-login"><section><h1>Highlights moderation</h1><p>Enter the existing PlayFooty admin key.</p><input type="password" value={key} onChange={e => setLocalKey(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && key.trim()) { setKey(key.trim()); setAuthed(true) } }} /><button onClick={() => { if (key.trim()) { setKey(key.trim()); setAuthed(true) } }}>Open moderation</button></section><Styles /></main>

  const update = async (id: string, body: Record<string, unknown>) => { try { await req('PATCH', `/admin/highlights/${id}`, body); setMessage('Saved'); load() } catch (e) { setMessage(e instanceof Error ? e.message : String(e)) } }
  const winner = async (id: string) => { try { await req('POST', `/admin/highlights/${id}/winner`); setMessage('Winner selected'); load() } catch (e) { setMessage(e instanceof Error ? e.message : String(e)) } }
  const remove = async (id: string) => { if (!confirm('Delete this highlight submission?')) return; try { await req('DELETE', `/admin/highlights/${id}`); load() } catch (e) { setMessage(e instanceof Error ? e.message : String(e)) } }

  return <main className="hm-page">
    <header><div><span>PLAYFOOTY OPERATIONS</span><h1>Highlights moderation</h1></div><div><Link to="/admin"><ArrowLeft size={17}/> Admin home</Link><button onClick={load}><RefreshCw size={17}/> Refresh</button></div></header>
    <nav>{['PENDING','APPROVED','REJECTED','ALL'].map(x => <button key={x} className={filter === x ? 'active' : ''} onClick={() => setFilter(x)}>{x}</button>)}</nav>
    {message && <p className="hm-message">{message}</p>}
    <section className="hm-list">
      {rows.map(row => <article key={row.id}>
        <div className="hm-video"><a href={row.videoUrl} target="_blank" rel="noreferrer">Open submitted video <ExternalLink size={17}/></a></div>
        <div className="hm-copy"><span>{row.category} · {row.weekKey}</span><h2>{row.playerName}</h2><strong>{row.clubName}{row.leagueName ? ` · ${row.leagueName}` : ''}</strong><p>{row.description || 'No description supplied.'}</p><small>Submitted by {row.submitterName} · {row.submitterEmail} · {new Date(row.createdAt).toLocaleString('en-AU')}</small>
          <div className="hm-dates"><label>Voting opens<input type="datetime-local" defaultValue={localDate(row.votingOpensAt)} onBlur={e => update(row.id, { votingOpensAt: e.target.value ? new Date(e.target.value).toISOString() : null })}/></label><label>Voting closes<input type="datetime-local" defaultValue={localDate(row.votingClosesAt)} onBlur={e => update(row.id, { votingClosesAt: e.target.value ? new Date(e.target.value).toISOString() : null })}/></label></div>
          <div className="hm-actions"><button className="approve" onClick={() => update(row.id, { status: 'APPROVED' })}><Check size={16}/> Approve</button><button onClick={() => update(row.id, { status: 'REJECTED' })}><X size={16}/> Reject</button><button onClick={() => winner(row.id)} disabled={row.status !== 'APPROVED'}><Star size={16}/> {row.winner ? 'Winner' : 'Select winner'}</button><button onClick={() => remove(row.id)}><Trash2 size={16}/></button></div>
          <b className="hm-votes">{row.votes} votes · {row.status}</b>
        </div>
      </article>)}
      {rows.length === 0 && <div className="hm-empty">No {filter.toLowerCase()} highlight submissions.</div>}
    </section><Styles />
  </main>
}

const localDate = (value?: string | null) => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0,16) : ''
function Styles(){return <style>{`.hm-page,.hm-login{min-height:100vh;background:#f4f6f8;color:#111318;font-family:Inter,Arial,sans-serif;padding:28px}.hm-page>header{max-width:1180px;margin:0 auto 20px;display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap}.hm-page h1,.hm-login h1,.hm-copy h2{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase}.hm-page h1{font-size:56px;line-height:.9;margin:6px 0}.hm-page header span{color:#2daaf5;font-size:11px;font-weight:900;letter-spacing:.17em}.hm-page header>div:last-child{display:flex;gap:9px}.hm-page a,.hm-page button,.hm-login button{display:inline-flex;align-items:center;gap:7px;border:1px solid #dce2e8;border-radius:8px;background:#fff;color:#111318;padding:11px 14px;font-weight:850;text-decoration:none;cursor:pointer}.hm-page>nav{max-width:1180px;margin:0 auto 18px;display:flex;gap:8px;overflow:auto}.hm-page>nav button.active{background:#050505;color:#fff}.hm-message{max-width:1180px;margin:0 auto 14px;padding:12px;border-radius:8px;background:#e8f6ff}.hm-list{max-width:1180px;margin:0 auto;display:grid;gap:14px}.hm-list article{display:grid;grid-template-columns:260px minmax(0,1fr);background:#fff;border:1px solid #dfe5eb;border-radius:12px;overflow:hidden}.hm-video{display:grid;place-items:center;min-height:250px;background:#0c0d0f;padding:20px}.hm-video a{background:#2daaf5;border:0}.hm-copy{padding:22px}.hm-copy>span{color:#2daaf5;text-transform:uppercase;font-size:10px;font-weight:900;letter-spacing:.14em}.hm-copy h2{font-size:38px;margin:7px 0 2px}.hm-copy p,.hm-copy small{color:#687385}.hm-dates{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0}.hm-dates label{display:grid;gap:6px;font-size:11px;font-weight:850;text-transform:uppercase}.hm-dates input{border:1px solid #dfe5eb;border-radius:8px;padding:10px}.hm-actions{display:flex;gap:8px;flex-wrap:wrap}.hm-actions .approve{background:#2daaf5;border-color:#2daaf5}.hm-votes{display:block;margin-top:14px}.hm-empty{padding:40px;text-align:center;background:#fff;border:1px solid #dfe5eb;border-radius:12px}.hm-login{display:grid;place-items:center}.hm-login section{width:min(430px,100%);background:#fff;border:1px solid #dfe5eb;border-radius:14px;padding:28px}.hm-login h1{font-size:42px;margin:0}.hm-login input{width:100%;box-sizing:border-box;border:1px solid #dfe5eb;border-radius:8px;padding:13px;margin:10px 0}.hm-login button{width:100%;justify-content:center;background:#2daaf5;border:0}@media(max-width:760px){.hm-page{padding:18px 12px}.hm-page h1{font-size:43px}.hm-list article{grid-template-columns:1fr}.hm-video{min-height:150px}.hm-dates{grid-template-columns:1fr}}`}</style>}
