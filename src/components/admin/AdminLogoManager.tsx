import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { admin, getKey, type ClubProfileDetail, type LeagueProfileDetail } from '../../lib/admin'

type EntityKind = 'club' | 'league' | 'article'
type Target = { kind: EntityKind; id: string; host: HTMLElement }
type ArticleProfile = { id: string; title: string; heroSeed: string; slug: string; tags?: string | Record<string, unknown> | null }
type Profile = ClubProfileDetail | LeagueProfileDetail | ArticleProfile

const input: CSSProperties = {
  width: '100%', border: '1px solid #dce3eb', borderRadius: 12, padding: '12px 13px', font: 'inherit', background: '#fff', boxSizing: 'border-box',
}
const button: CSSProperties = {
  border: 0, borderRadius: 999, padding: '11px 17px', background: '#35b6ff', color: '#050505', fontWeight: 950, textTransform: 'uppercase', cursor: 'pointer',
}

async function adminRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${getKey()}` },
    body: body == null ? undefined : JSON.stringify(body),
  })
  const json = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(json.error ?? `HTTP ${response.status}`)
  return json as T
}

function articleTags(profile: ArticleProfile | null): Record<string, unknown> {
  if (!profile?.tags) return {}
  if (typeof profile.tags === 'object') return profile.tags
  try { return JSON.parse(profile.tags) as Record<string, unknown> } catch { return {} }
}

export default function AdminLogoManager() {
  const { pathname } = useLocation()
  const [target, setTarget] = useState<Target | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [localPreview, setLocalPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (pathname !== '/admin' || !getKey()) { setTarget(null); return }

    let timer = 0
    let active = true
    const findEditor = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        void (async () => {
          const body = document.querySelector<HTMLElement>('.editor .eb')
          if (!body || !active) { setTarget(current => current ? null : current); return }

          const link = document.querySelector<HTMLAnchorElement>('.editor .eh a[href^="/team/"], .editor .eh a[href^="/league/"]')
          if (link) {
            const match = link.getAttribute('href')?.match(/^\/(team|league)\/([^/?#]+)/)
            if (!match) return
            const kind: EntityKind = match[1] === 'team' ? 'club' : 'league'
            const id = decodeURIComponent(match[2])
            let host = body.querySelector<HTMLElement>(':scope > .admin-editor-logo-host')
            if (!host) { host = document.createElement('div'); host.className = 'admin-editor-logo-host'; body.prepend(host) }
            if (active) setTarget(current => current?.kind === kind && current.id === id && current.host === host ? current : { kind, id, host })
            return
          }

          const heading = document.querySelector<HTMLElement>('.editor .eh h2')?.textContent?.trim()
          const status = document.querySelector<HTMLElement>('.editor .eh span')?.textContent?.trim()
          if (!heading || !status) { setTarget(current => current?.kind === 'article' ? null : current); return }
          const list = await adminRequest<{ data: Array<{ id: string; title: string; status: string }> }>('GET', '/admin/platform/articles?status=ALL')
          const article = list.data.find(item => item.title === heading && item.status === status) ?? list.data.find(item => item.title === heading)
          if (!article || !active) return
          let host = body.querySelector<HTMLElement>(':scope > .admin-editor-news-image-host')
          if (!host) { host = document.createElement('div'); host.className = 'admin-editor-news-image-host'; body.prepend(host) }
          setTarget(current => current?.kind === 'article' && current.id === article.id && current.host === host ? current : { kind: 'article', id: article.id, host })
        })().catch(() => {})
      }, 100)
    }

    findEditor()
    const observer = new MutationObserver(findEditor)
    observer.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true })
    return () => { active = false; window.clearTimeout(timer); observer.disconnect() }
  }, [pathname])

  useEffect(() => {
    if (!target) { setProfile(null); setFile(null); setLocalPreview(''); setMessage(''); return }
    let active = true
    const load = target.kind === 'club'
      ? admin.getClubProfile(target.id)
      : target.kind === 'league'
        ? admin.getLeagueProfile(target.id)
        : adminRequest<{ data: ArticleProfile }>('GET', `/admin/platform/articles/${target.id}`).then(result => result.data)
    void load.then(value => { if (active) setProfile(value) }).catch(error => { if (active) setMessage(String(error)) })
    return () => { active = false }
  }, [target?.kind, target?.id])

  useEffect(() => {
    if (!file) { setLocalPreview(''); return }
    const url = URL.createObjectURL(file)
    setLocalPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  if (!target) return null

  const refresh = async () => {
    const value = target.kind === 'club'
      ? await admin.getClubProfile(target.id)
      : target.kind === 'league'
        ? await admin.getLeagueProfile(target.id)
        : (await adminRequest<{ data: ArticleProfile }>('GET', `/admin/platform/articles/${target.id}`)).data
    setProfile(value)
  }

  const upload = async () => {
    if (!file) return setMessage(`Choose a ${target.kind === 'article' ? 'hero' : 'logo'} image first.`)
    if (!file.type.startsWith('image/')) return setMessage('The selected file must be an image.')
    const max = target.kind === 'article' ? 8 : 5
    if (file.size > max * 1024 * 1024) return setMessage(`Images must be under ${max} MB.`)
    setBusy(true); setMessage('Uploading…')
    try {
      const dataUrl = await readDataUrl(file)
      const payload = { fileName: file.name, contentType: file.type, dataUrl }
      if (target.kind === 'club') await admin.uploadClubLogo(target.id, payload)
      else if (target.kind === 'league') await admin.uploadLeagueLogo(target.id, payload)
      else await adminRequest('POST', `/admin/newsroom/articles/${target.id}/image`, payload)
      await refresh(); setFile(null); setLocalPreview('')
      const fileInput = document.getElementById(`admin-editor-image-file-${target.kind}-${target.id}`) as HTMLInputElement | null
      if (fileInput) fileInput.value = ''
      setMessage(target.kind === 'article' ? 'Hero image uploaded. It will appear on the homepage and News pages.' : 'Logo uploaded successfully. The preview is now updated.')
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }

  const remove = async () => {
    setBusy(true); setMessage('Removing…')
    try {
      if (target.kind === 'club') await admin.removeClubLogo(target.id)
      else if (target.kind === 'league') await admin.removeLeagueLogo(target.id)
      else await adminRequest('DELETE', `/admin/newsroom/articles/${target.id}/image`)
      await refresh(); setMessage(target.kind === 'article' ? 'Hero image removed. Generated artwork will be used instead.' : 'Logo removed.')
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }

  const setHomepageFeatured = async (featured: boolean) => {
    if (target.kind !== 'article') return
    setBusy(true)
    setMessage(featured ? 'Adding article to homepage features…' : 'Removing article from homepage features…')
    try {
      const current = articleTags(profile as ArticleProfile | null)
      await adminRequest('PATCH', `/admin/newsroom/articles/${target.id}`, { tags: { ...current, homepageFeatured: featured } })
      await refresh()
      setMessage(featured ? 'This article is selected for the homepage hero once published.' : 'This article will no longer appear in the homepage hero.')
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }

  const isArticle = target.kind === 'article'
  const articleProfile = isArticle ? profile as ArticleProfile | null : null
  const featured = Boolean(articleTags(articleProfile).homepageFeatured)
  const currentImage = isArticle ? articleProfile?.heroSeed : (profile as ClubProfileDetail | LeagueProfileDetail | null)?.logoUrl
  const hasRealArticleImage = isArticle && Boolean(currentImage && (/^https?:\/\//i.test(currentImage) || currentImage.startsWith('/')))
  const preview = localPreview || (hasRealArticleImage || !isArticle ? currentImage ?? '' : '')
  const name = isArticle ? articleProfile?.title ?? 'Article' : (profile as ClubProfileDetail | LeagueProfileDetail | null)?.name ?? target.kind

  return createPortal(
    <section className={`admin-editor-logo-card${isArticle ? ' is-news-image' : ''}`}>
      <div className="admin-editor-logo-copy">
        <small>{isArticle ? 'NEWS PRESENTATION' : 'PROFILE BRANDING'}</small>
        <h3>{isArticle ? 'Article hero image' : target.kind === 'club' ? 'Club logo' : 'League logo'}</h3>
        <p>{isArticle ? 'Upload the main image and choose whether this article should appear in the homepage hero carousel.' : 'Upload or replace the logo for this exact profile. The updated logo appears here immediately.'}</p>
      </div>
      <div className="admin-editor-logo-preview">
        {preview ? <img src={preview} alt={`${name} ${isArticle ? 'hero' : 'logo'}`} /> : <strong>{isArticle ? 'Generated image fallback' : 'No logo'}</strong>}
      </div>
      <label className="admin-editor-logo-file">
        <span>{isArticle ? 'Hero image' : 'Logo image'}</span>
        <input id={`admin-editor-image-file-${target.kind}-${target.id}`} style={input} type="file" accept={isArticle ? 'image/png,image/jpeg,image/webp' : 'image/png,image/jpeg,image/webp,image/svg+xml'} onChange={event => setFile(event.target.files?.[0] ?? null)} />
      </label>
      {isArticle && <label className="admin-news-feature-toggle">
        <input type="checkbox" checked={featured} disabled={busy} onChange={event => { void setHomepageFeatured(event.target.checked) }} />
        <span><strong>Feature on homepage</strong><small>When published, this article can fill one of the three News slides in the homepage hero.</small></span>
      </label>}
      {message && <div className="admin-editor-logo-message">{message}</div>}
      <div className="admin-editor-logo-actions">
        <button type="button" style={button} disabled={busy} onClick={() => { void upload() }}>{busy ? 'Working…' : preview ? `Replace ${isArticle ? 'image' : 'logo'}` : `Upload ${isArticle ? 'image' : 'logo'}`}</button>
        {(hasRealArticleImage || (!isArticle && currentImage)) && <button type="button" className="admin-editor-logo-remove" disabled={busy} onClick={() => { void remove() }}>Remove {isArticle ? 'image' : 'logo'}</button>}
      </div>
      <style>{`
        .admin-editor-logo-host,.admin-editor-news-image-host{grid-column:1/-1}
        .admin-editor-logo-card{display:grid;grid-template-columns:minmax(0,1fr) 110px;gap:16px;align-items:center;padding:18px;border:1px solid #dce3eb;border-radius:16px;background:#f7f9fb}
        .admin-editor-logo-card.is-news-image{grid-template-columns:minmax(0,1fr) minmax(220px,38%)}
        .admin-editor-logo-copy small{display:block;color:#168fd4;font-size:10px;font-weight:950;letter-spacing:.16em}.admin-editor-logo-copy h3{margin:5px 0 4px;font-family:'Bebas Neue',Impact,sans-serif;font-size:34px;line-height:1;text-transform:uppercase}.admin-editor-logo-copy p{margin:0;color:#687385}
        .admin-editor-logo-preview{width:96px;height:96px;border-radius:16px;background:#fff;border:1px solid #e2e7ec;display:grid;place-items:center;overflow:hidden;color:#687385;text-align:center}.admin-editor-logo-preview img{width:100%;height:100%;object-fit:contain}
        .is-news-image .admin-editor-logo-preview{width:100%;height:auto;aspect-ratio:16/9;border-radius:14px}.is-news-image .admin-editor-logo-preview img{object-fit:cover}
        .admin-editor-logo-file{grid-column:1/-1;display:grid;gap:6px}.admin-editor-logo-file>span{font-size:11px;font-weight:950;color:#687385;text-transform:uppercase}
        .admin-news-feature-toggle{grid-column:1/-1;display:flex;align-items:flex-start;gap:12px;padding:14px;border:1px solid #b8def5;border-radius:13px;background:#eef8ff}.admin-news-feature-toggle input{width:22px;height:22px;margin:1px 0 0}.admin-news-feature-toggle span{display:grid;gap:3px}.admin-news-feature-toggle strong{color:#0b3851}.admin-news-feature-toggle small{color:#557183;font-weight:700}
        .admin-editor-logo-message{grid-column:1/-1;padding:11px 13px;border-radius:11px;background:#eef8ff;color:#174a68;font-weight:800}.admin-editor-logo-actions{grid-column:1/-1;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.admin-editor-logo-remove{border:1px solid #d71920;border-radius:999px;background:#fff;color:#d71920;padding:10px 16px;font-weight:950;text-transform:uppercase;cursor:pointer}
        @media(max-width:620px){.admin-editor-logo-card,.admin-editor-logo-card.is-news-image{grid-template-columns:1fr}.admin-editor-logo-preview{width:82px;height:82px}.is-news-image .admin-editor-logo-preview{width:100%;height:auto}.admin-editor-logo-file,.admin-editor-logo-message,.admin-editor-logo-actions,.admin-news-feature-toggle{grid-column:auto}}
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
