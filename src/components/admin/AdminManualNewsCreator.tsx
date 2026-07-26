import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { getKey } from '../../lib/admin'

type Target = { host: HTMLElement }

type FormState = {
  title: string
  subtitle: string
  category: string
  author: string
  summary: string
  body: string
  homepageFeatured: boolean
}

const emptyForm: FormState = {
  title: '',
  subtitle: '',
  category: 'club-news',
  author: 'PlayFooty',
  summary: '',
  body: '',
  homepageFeatured: false,
}

const input: CSSProperties = {
  width: '100%',
  border: '1px solid #dce3eb',
  borderRadius: 12,
  padding: '12px 13px',
  font: 'inherit',
  background: '#fff',
  boxSizing: 'border-box',
}

async function adminRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${getKey()}` },
    body: body == null ? undefined : JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(payload.error ?? `HTTP ${response.status}`)
  return payload as T
}

export default function AdminManualNewsCreator() {
  const { pathname } = useLocation()
  const [target, setTarget] = useState<Target | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (pathname !== '/admin' || !getKey()) {
      setTarget(null)
      return
    }

    let timer = 0
    const findNewsPage = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const heading = document.querySelector<HTMLElement>('.top strong')
        const content = document.querySelector<HTMLElement>('.content .page')
        if (!heading || heading.textContent?.trim() !== 'News' || !content || content.querySelector('.editor')) {
          setTarget(null)
          return
        }
        let host = content.querySelector<HTMLElement>(':scope > .admin-manual-news-host')
        if (!host) {
          host = document.createElement('div')
          host.className = 'admin-manual-news-host'
          const hero = content.querySelector(':scope > .hero')
          if (hero?.nextSibling) content.insertBefore(host, hero.nextSibling)
          else content.prepend(host)
        }
        setTarget(current => current?.host === host ? current : { host })
      }, 80)
    }

    findNewsPage()
    const observer = new MutationObserver(findNewsPage)
    observer.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true })
    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
    }
  }, [pathname])

  useEffect(() => {
    if (!file) { setPreview(''); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  if (!target) return null

  const update = (key: keyof FormState, value: string | boolean) => setForm(current => ({ ...current, [key]: value }))

  const createArticle = async () => {
    if (!form.title.trim() || !form.summary.trim() || !form.body.trim()) {
      setMessage('Headline, summary and article body are required.')
      return
    }
    if (file && !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setMessage('Use a PNG, JPG or WEBP image.')
      return
    }
    if (file && file.size > 8 * 1024 * 1024) {
      setMessage('Article images must be under 8 MB.')
      return
    }

    setBusy(true)
    setMessage('Creating article…')
    try {
      const created = await adminRequest<{ data: { id: string } }>('POST', '/admin/newsroom/articles/manual', {
        title: form.title,
        subtitle: form.subtitle,
        category: form.category,
        author: form.author,
        summary: form.summary,
        body: form.body,
      })

      await adminRequest('PATCH', `/admin/newsroom/articles/${created.data.id}`, {
        tags: { homepageFeatured: form.homepageFeatured },
      })

      if (file) {
        setMessage('Article created. Uploading image…')
        await adminRequest('POST', `/admin/newsroom/articles/${created.data.id}/image`, {
          fileName: file.name,
          contentType: file.type,
          dataUrl: await readDataUrl(file),
        })
      }

      setMessage(`Article created${form.homepageFeatured ? ' and selected for the homepage' : ''}. Refreshing News…`)
      window.setTimeout(() => window.location.reload(), 500)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
      setBusy(false)
    }
  }

  const clear = () => {
    setForm(emptyForm)
    setFile(null)
    setPreview('')
    setMessage('')
    const picker = document.getElementById('manual-news-image') as HTMLInputElement | null
    if (picker) picker.value = ''
  }

  return createPortal(
    <section className="manual-news-card">
      <div className="manual-news-head">
        <div>
          <small>MANUAL PUBLISHING</small>
          <h2>Create your own article</h2>
          <p>Create the story, upload its image and choose whether it should appear in the homepage hero.</p>
        </div>
        <button type="button" onClick={() => setOpen(value => !value)}>{open ? 'Close' : 'Create article'}</button>
      </div>

      {open && <div className="manual-news-form">
        <label><span>Headline</span><input style={input} value={form.title} onChange={event => update('title', event.target.value)} /></label>
        <label><span>Subtitle</span><input style={input} value={form.subtitle} onChange={event => update('subtitle', event.target.value)} /></label>
        <label><span>Category</span><select style={input} value={form.category} onChange={event => update('category', event.target.value)}>
          <option value="club-news">Club News</option>
          <option value="league-news">League News</option>
          <option value="rankings">Rankings</option>
          <option value="state-news">State News</option>
          <option value="transfers">Transfers</option>
          <option value="player-spotlight">Player Spotlight</option>
          <option value="coach-spotlight">Coach Spotlight</option>
          <option value="community">Community</option>
          <option value="grassroots">Grassroots</option>
          <option value="history">History</option>
          <option value="opinion">Opinion</option>
        </select></label>
        <label><span>Author</span><input style={input} value={form.author} onChange={event => update('author', event.target.value)} /></label>
        <label className="wide"><span>Summary</span><textarea style={{ ...input, minHeight: 92 }} value={form.summary} onChange={event => update('summary', event.target.value)} /></label>
        <label className="wide"><span>Article body</span><textarea style={{ ...input, minHeight: 260 }} placeholder="Write the article in normal paragraphs. Leave a blank line between paragraphs." value={form.body} onChange={event => update('body', event.target.value)} /></label>

        <div className="manual-news-image wide">
          <label><span>Article hero image</span><input id="manual-news-image" style={input} type="file" accept="image/png,image/jpeg,image/webp" onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>
          <div className="manual-news-preview">{preview ? <img src={preview} alt="Article preview" /> : <strong>No image selected</strong>}</div>
        </div>

        <label className="manual-news-feature wide">
          <input type="checkbox" checked={form.homepageFeatured} onChange={event => update('homepageFeatured', event.target.checked)} />
          <span><strong>Feature this article on the homepage</strong><small>When published, it can fill one of the three News slides in the homepage hero carousel.</small></span>
        </label>

        {message && <div className="manual-news-message">{message}</div>}
        <div className="manual-news-actions">
          <button type="button" disabled={busy} onClick={() => { void createArticle() }}>{busy ? 'Creating…' : 'Create draft'}</button>
          <button type="button" className="secondary" disabled={busy} onClick={clear}>Clear</button>
        </div>
      </div>}

      <style>{`
        .admin-manual-news-host{display:block}.manual-news-card{background:#fff;border:1px solid #dce3eb;border-radius:18px;padding:20px}.manual-news-head{display:flex;align-items:center;justify-content:space-between;gap:18px}.manual-news-head small{display:block;color:#168fd4;font-size:10px;font-weight:950;letter-spacing:.16em}.manual-news-head h2{margin:5px 0 4px;font-family:'Bebas Neue',Impact,sans-serif;font-size:36px;line-height:1;text-transform:uppercase}.manual-news-head p{margin:0;color:#687385;max-width:760px}.manual-news-head button,.manual-news-actions button{border:0;border-radius:999px;padding:11px 17px;background:#35b6ff;color:#050505;font-weight:950;text-transform:uppercase;cursor:pointer;white-space:nowrap}.manual-news-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;margin-top:20px;padding-top:20px;border-top:1px solid #e5eaf0}.manual-news-form label{display:grid;gap:6px}.manual-news-form label>span{font-size:11px;font-weight:950;color:#687385;text-transform:uppercase}.manual-news-form .wide,.manual-news-message,.manual-news-actions{grid-column:1/-1}.manual-news-image{display:grid;grid-template-columns:minmax(0,1fr) minmax(230px,36%);gap:14px;align-items:center;padding:14px;border:1px solid #dce3eb;border-radius:15px;background:#f7f9fb}.manual-news-preview{aspect-ratio:16/9;border:1px solid #dce3eb;border-radius:12px;background:#fff;display:grid;place-items:center;overflow:hidden;color:#687385}.manual-news-preview img{width:100%;height:100%;object-fit:cover}.manual-news-feature{display:flex!important;grid-template-columns:auto 1fr!important;align-items:flex-start;gap:12px!important;padding:15px;border:1px solid #b8def5;border-radius:14px;background:#eef8ff}.manual-news-feature input{width:22px;height:22px;margin:1px 0 0}.manual-news-feature span{display:grid;gap:3px;text-transform:none!important}.manual-news-feature strong{color:#0b3851;font-size:14px}.manual-news-feature small{color:#557183;font-size:12px;font-weight:700;text-transform:none}.manual-news-message{padding:11px 13px;border-radius:11px;background:#eef8ff;color:#174a68;font-weight:800}.manual-news-actions{display:flex;gap:10px;flex-wrap:wrap}.manual-news-actions .secondary{background:#050505;color:#fff}@media(max-width:720px){.manual-news-head{align-items:flex-start;flex-direction:column}.manual-news-form{grid-template-columns:1fr}.manual-news-form .wide,.manual-news-message,.manual-news-actions{grid-column:auto}.manual-news-image{grid-template-columns:1fr}.manual-news-preview{width:100%}}
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
