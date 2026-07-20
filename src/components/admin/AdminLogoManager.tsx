import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useLocation } from 'react-router-dom'
import { admin, getKey, type AdminClub, type FootballLeague } from '../../lib/admin'

type EntityKind = 'club' | 'league'

const input: CSSProperties = {
  width: '100%',
  border: '1px solid #dce3eb',
  borderRadius: 12,
  padding: '12px 13px',
  font: 'inherit',
  background: '#fff',
  boxSizing: 'border-box',
}

const button: CSSProperties = {
  border: 0,
  borderRadius: 999,
  padding: '12px 18px',
  background: '#35b6ff',
  color: '#050505',
  fontWeight: 950,
  textTransform: 'uppercase',
  cursor: 'pointer',
}

export default function AdminLogoManager() {
  const { pathname } = useLocation()
  const [kind, setKind] = useState<EntityKind>('club')
  const [clubs, setClubs] = useState<AdminClub[]>([])
  const [leagues, setLeagues] = useState<FootballLeague[]>([])
  const [entityId, setEntityId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [open, setOpen] = useState(false)

  const isAdmin = pathname === '/admin'

  useEffect(() => {
    if (!isAdmin || !getKey()) return
    void Promise.all([admin.listClubs(), admin.listFootballLeagues()])
      .then(([clubRows, leagueRows]) => {
        setClubs(clubRows)
        setLeagues(leagueRows)
      })
      .catch(error => setMessage(String(error)))
  }, [isAdmin])

  useEffect(() => {
    setEntityId('')
    setFile(null)
    setMessage('')
  }, [kind])

  const entities = useMemo(
    () => (kind === 'club' ? clubs : leagues).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [clubs, leagues, kind],
  )

  if (!isAdmin || !getKey()) return null

  const upload = async () => {
    if (!entityId) return setMessage(`Choose a ${kind}.`)
    if (!file) return setMessage('Choose a logo image.')
    if (!file.type.startsWith('image/')) return setMessage('The selected file must be an image.')
    if (file.size > 5 * 1024 * 1024) return setMessage('Logo images must be under 5 MB.')

    setBusy(true)
    setMessage('Uploading…')
    try {
      const dataUrl = await readDataUrl(file)
      const payload = { fileName: file.name, contentType: file.type, dataUrl }
      if (kind === 'club') await admin.uploadClubLogo(entityId, payload)
      else await admin.uploadLeagueLogo(entityId, payload)
      setMessage('Logo uploaded successfully.')
      setFile(null)
      const fileInput = document.getElementById('admin-logo-file') as HTMLInputElement | null
      if (fileInput) fileInput.value = ''
      const [clubRows, leagueRows] = await Promise.all([admin.listClubs(), admin.listFootballLeagues()])
      setClubs(clubRows)
      setLeagues(leagueRows)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!entityId) return setMessage(`Choose a ${kind}.`)
    setBusy(true)
    setMessage('Removing…')
    try {
      if (kind === 'club') await admin.removeClubLogo(entityId)
      else await admin.removeLeagueLogo(entityId)
      setMessage('Logo removed.')
      const [clubRows, leagueRows] = await Promise.all([admin.listClubs(), admin.listFootballLeagues()])
      setClubs(clubRows)
      setLeagues(leagueRows)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const selected = entities.find(entity => entity.id === entityId)

  return (
    <aside className={`admin-logo-manager${open ? ' open' : ''}`}>
      <button className="admin-logo-toggle" type="button" onClick={() => setOpen(value => !value)}>
        {open ? 'Close logo manager' : 'Upload club or league logo'}
      </button>
      {open && (
        <section className="admin-logo-panel">
          <div>
            <small>PROFILE BRANDING</small>
            <h2>Logo Manager</h2>
            <p>Upload or replace the real logo stored against an existing club or league.</p>
          </div>
          <div className="admin-logo-grid">
            <label>
              <span>Profile type</span>
              <select style={input} value={kind} onChange={event => setKind(event.target.value as EntityKind)}>
                <option value="club">Club</option>
                <option value="league">League</option>
              </select>
            </label>
            <label>
              <span>{kind === 'club' ? 'Club' : 'League'}</span>
              <select style={input} value={entityId} onChange={event => setEntityId(event.target.value)}>
                <option value="">Choose {kind}</option>
                {entities.map(entity => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
              </select>
            </label>
            <label className="admin-logo-file-field">
              <span>Logo image</span>
              <input id="admin-logo-file" style={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={event => setFile(event.target.files?.[0] ?? null)} />
            </label>
          </div>
          {selected && (
            <div className="admin-logo-preview">
              <div>{selected.logoUrl ? <img src={selected.logoUrl} alt="Current logo" /> : <strong>No logo</strong>}</div>
              <span><b>{selected.name}</b><small>{selected.logoUrl ? 'Current stored logo' : 'No logo currently stored'}</small></span>
            </div>
          )}
          {message && <div className="admin-logo-message">{message}</div>}
          <div className="admin-logo-actions">
            <button type="button" style={button} disabled={busy} onClick={() => { void upload() }}>{busy ? 'Working…' : 'Upload logo'}</button>
            {selected?.logoUrl && <button type="button" className="admin-logo-remove" disabled={busy} onClick={() => { void remove() }}>Remove logo</button>}
          </div>
        </section>
      )}
      <style>{`
        .admin-logo-manager{position:fixed;right:18px;bottom:18px;z-index:95;font-family:Inter,system-ui,sans-serif}
        .admin-logo-toggle{border:0;border-radius:999px;background:#050505;color:#fff;padding:13px 18px;font-weight:950;text-transform:uppercase;box-shadow:0 12px 32px rgba(0,0,0,.25);cursor:pointer}
        .admin-logo-panel{width:min(520px,calc(100vw - 24px));max-height:calc(100vh - 110px);overflow:auto;margin-bottom:10px;background:#fff;border:1px solid #dce3eb;border-radius:20px;padding:20px;box-shadow:0 22px 60px rgba(0,0,0,.28);display:grid;gap:16px}
        .admin-logo-panel small{display:block;color:#168fd4;font-size:10px;font-weight:950;letter-spacing:.16em}.admin-logo-panel h2{margin:5px 0 4px;font-family:'Bebas Neue',Impact,sans-serif;font-size:38px;line-height:1}.admin-logo-panel p{margin:0;color:#687385}
        .admin-logo-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.admin-logo-grid label{display:grid;gap:6px}.admin-logo-grid label>span{font-size:10px;font-weight:950;color:#687385;text-transform:uppercase}.admin-logo-file-field{grid-column:1/-1}
        .admin-logo-preview{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid #e3e8ee;border-radius:14px;background:#f7f9fb}.admin-logo-preview>div{width:64px;height:64px;border-radius:12px;background:#fff;display:grid;place-items:center;overflow:hidden}.admin-logo-preview img{width:100%;height:100%;object-fit:contain}.admin-logo-preview span{display:grid}.admin-logo-preview small{color:#687385;letter-spacing:0;font-weight:700;margin-top:3px}
        .admin-logo-message{padding:11px 13px;border-radius:11px;background:#eef8ff;color:#174a68;font-weight:800}.admin-logo-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.admin-logo-remove{border:1px solid #d71920;border-radius:999px;background:#fff;color:#d71920;padding:11px 16px;font-weight:950;text-transform:uppercase;cursor:pointer}
        @media(max-width:620px){.admin-logo-manager{right:12px;bottom:12px;left:12px}.admin-logo-toggle{width:100%}.admin-logo-grid{grid-template-columns:1fr}.admin-logo-file-field{grid-column:auto}}
      `}</style>
    </aside>
  )
}

function readDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the image.'))
    reader.readAsDataURL(file)
  })
}
