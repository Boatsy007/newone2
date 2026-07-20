import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { admin, getKey, type ClubProfileDetail, type LeagueProfileDetail } from '../../lib/admin'

type EntityKind = 'club' | 'league'
type Target = { kind: EntityKind; id: string; host: HTMLElement }
type Profile = ClubProfileDetail | LeagueProfileDetail

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
  padding: '11px 17px',
  background: '#35b6ff',
  color: '#050505',
  fontWeight: 950,
  textTransform: 'uppercase',
  cursor: 'pointer',
}

export default function AdminLogoManager() {
  const { pathname } = useLocation()
  const [target, setTarget] = useState<Target | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (pathname !== '/admin' || !getKey()) {
      setTarget(null)
      return
    }

    let timer = 0
    const findEditor = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const link = document.querySelector<HTMLAnchorElement>('.editor .eh a[href^="/team/"], .editor .eh a[href^="/league/"]')
        const body = document.querySelector<HTMLElement>('.editor .eb')
        if (!link || !body) {
          setTarget(current => current ? null : current)
          return
        }

        const match = link.getAttribute('href')?.match(/^\/(team|league)\/([^/?#]+)/)
        if (!match) return
        const kind: EntityKind = match[1] === 'team' ? 'club' : 'league'
        const id = decodeURIComponent(match[2])

        let host = body.querySelector<HTMLElement>(':scope > .admin-editor-logo-host')
        if (!host) {
          host = document.createElement('div')
          host.className = 'admin-editor-logo-host'
          body.prepend(host)
        }

        setTarget(current => current?.kind === kind && current.id === id && current.host === host ? current : { kind, id, host })
      }, 80)
    }

    findEditor()
    const observer = new MutationObserver(findEditor)
    observer.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true })
    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
    }
  }, [pathname])

  useEffect(() => {
    if (!target) {
      setProfile(null)
      setFile(null)
      setMessage('')
      return
    }

    let active = true
    const load = target.kind === 'club' ? admin.getClubProfile(target.id) : admin.getLeagueProfile(target.id)
    void load.then(value => { if (active) setProfile(value) }).catch(error => { if (active) setMessage(String(error)) })
    return () => { active = false }
  }, [target?.kind, target?.id])

  if (!target) return null

  const refresh = async () => {
    const value = target.kind === 'club' ? await admin.getClubProfile(target.id) : await admin.getLeagueProfile(target.id)
    setProfile(value)
  }

  const upload = async () => {
    if (!file) return setMessage('Choose a logo image first.')
    if (!file.type.startsWith('image/')) return setMessage('The selected file must be an image.')
    if (file.size > 5 * 1024 * 1024) return setMessage('Logo images must be under 5 MB.')

    setBusy(true)
    setMessage('Uploading…')
    try {
      const dataUrl = await readDataUrl(file)
      const payload = { fileName: file.name, contentType: file.type, dataUrl }
      if (target.kind === 'club') await admin.uploadClubLogo(target.id, payload)
      else await admin.uploadLeagueLogo(target.id, payload)
      await refresh()
      setFile(null)
      const fileInput = document.getElementById(`admin-editor-logo-file-${target.kind}-${target.id}`) as HTMLInputElement | null
      if (fileInput) fileInput.value = ''
      setMessage('Logo uploaded successfully. The preview is now updated.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    setMessage('Removing…')
    try {
      if (target.kind === 'club') await admin.removeClubLogo(target.id)
      else await admin.removeLeagueLogo(target.id)
      await refresh()
      setMessage('Logo removed.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <section className="admin-editor-logo-card">
      <div className="admin-editor-logo-copy">
        <small>PROFILE BRANDING</small>
        <h3>{target.kind === 'club' ? 'Club logo' : 'League logo'}</h3>
        <p>Upload or replace the logo for this exact profile. The updated logo appears here immediately.</p>
      </div>
      <div className="admin-editor-logo-preview">
        {profile?.logoUrl ? <img src={profile.logoUrl} alt={`${profile.name} logo`} /> : <strong>No logo</strong>}
      </div>
      <label className="admin-editor-logo-file">
        <span>Logo image</span>
        <input id={`admin-editor-logo-file-${target.kind}-${target.id}`} style={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={event => setFile(event.target.files?.[0] ?? null)} />
      </label>
      {message && <div className="admin-editor-logo-message">{message}</div>}
      <div className="admin-editor-logo-actions">
        <button type="button" style={button} disabled={busy} onClick={() => { void upload() }}>{busy ? 'Working…' : profile?.logoUrl ? 'Replace logo' : 'Upload logo'}</button>
        {profile?.logoUrl && <button type="button" className="admin-editor-logo-remove" disabled={busy} onClick={() => { void remove() }}>Remove logo</button>}
      </div>
      <style>{`
        .admin-editor-logo-host{grid-column:1/-1}
        .admin-editor-logo-card{display:grid;grid-template-columns:minmax(0,1fr) 110px;gap:16px;align-items:center;padding:18px;border:1px solid #dce3eb;border-radius:16px;background:#f7f9fb}
        .admin-editor-logo-copy small{display:block;color:#168fd4;font-size:10px;font-weight:950;letter-spacing:.16em}.admin-editor-logo-copy h3{margin:5px 0 4px;font-family:'Bebas Neue',Impact,sans-serif;font-size:34px;line-height:1;text-transform:uppercase}.admin-editor-logo-copy p{margin:0;color:#687385}
        .admin-editor-logo-preview{width:96px;height:96px;border-radius:16px;background:#fff;border:1px solid #e2e7ec;display:grid;place-items:center;overflow:hidden;color:#687385;text-align:center}.admin-editor-logo-preview img{width:100%;height:100%;object-fit:contain}
        .admin-editor-logo-file{grid-column:1/-1;display:grid;gap:6px}.admin-editor-logo-file>span{font-size:11px;font-weight:950;color:#687385;text-transform:uppercase}
        .admin-editor-logo-message{grid-column:1/-1;padding:11px 13px;border-radius:11px;background:#eef8ff;color:#174a68;font-weight:800}.admin-editor-logo-actions{grid-column:1/-1;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.admin-editor-logo-remove{border:1px solid #d71920;border-radius:999px;background:#fff;color:#d71920;padding:10px 16px;font-weight:950;text-transform:uppercase;cursor:pointer}
        @media(max-width:620px){.admin-editor-logo-card{grid-template-columns:1fr}.admin-editor-logo-preview{width:82px;height:82px}.admin-editor-logo-file,.admin-editor-logo-message,.admin-editor-logo-actions{grid-column:auto}}
      `}</style>
    </section>,
    target.host,
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
