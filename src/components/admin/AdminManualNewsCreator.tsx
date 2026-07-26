import { useEffect, useMemo, useState, type CSSProperties } from 'react'
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
  homepageOrder: number
}
type NewsArticle = {
  id: string
  slug: string
  title: string
  subtitle: string | null
  summary: string
  status: string
  heroSeed: string
  category: string
  publishedAt: string | null
  updatedAt: string
  tags: Record<string, unknown>
}
type ArticlePreview = NewsArticle & { body: string; author?: string }

const emptyForm: FormState = {
  title: '', subtitle: '', category: 'club-news', author: 'PlayFooty', summary: '', body: '', homepageFeatured: false, homepageOrder: 1,
}
const input: CSSProperties = {
  width: '100%', border: '1px solid #dce3eb', borderRadius: 12, padding: '12px 13px', font: 'inherit', background: '#fff', boxSizing: 'border-box',
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
  const [imagePreview, setImagePreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [positions, setPositions] = useState<string[]>(['', '', ''])
  const [preview, setPreview] = useState<ArticlePreview | null>(null)
  const [managerBusy, setManagerBusy] = useState(false)

  useEffect(() => {
    if (pathname !== '/admin' || !getKey()) { setTarget(null); return }
    let timer = 0
    const findNewsPage = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const heading = document.querySelector<HTMLElement>('.top strong')
        const content = document.querySelector<HTMLElement>('.content .page')
        if (!heading || heading.textContent?.trim() !== 'News' || !content || content.querySelector('.editor')) { setTarget(null); return }
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
    return () => { window.clearTimeout(timer); observer.disconnect() }
  }, [pathname])

  const loadArticles = async () => {
    if (!getKey()) return
    try {
      const response = await adminRequest<{ data: NewsArticle[] }>('GET', '/admin/newsroom/articles')
      const rows = Array.isArray(response.data) ? response.data : []
      setArticles(rows)
      const ordered = rows
        .filter(article => article.tags?.homepageFeatured === true)
        .sort((a, b) => Number(a.tags?.homepageOrder ?? 99) - Number(b.tags?.homepageOrder ?? 99) || +new Date(b.updatedAt) - +new Date(a.updatedAt))
        .slice(0, 3)
      setPositions([ordered[0]?.id ?? '', ordered[1]?.id ?? '', ordered[2]?.id ?? ''])
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
  }

  useEffect(() => { if (target) void loadArticles() }, [target])
  useEffect(() => {
    if (!file) { setImagePreview(''); return }
    const url = URL.createObjectURL(file)
    setImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const sortedArticles = useMemo(() => [...articles].sort((a, b) => {
    if (a.status === 'PUBLISHED' && b.status !== 'PUBLISHED') return -1
    if (b.status === 'PUBLISHED' && a.status !== 'PUBLISHED') return 1
    return +new Date(b.updatedAt) - +new Date(a.updatedAt)
  }), [articles])

  if (!target) return null
  const update = (key: keyof FormState, value: string | boolean | number) => setForm(current => ({ ...current, [key]: value }))

  const createArticle = async () => {
    if (!form.title.trim() || !form.summary.trim() || !form.body.trim()) { setMessage('Headline, summary and article body are required.'); return }
    if (file && !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setMessage('Use a PNG, JPG or WEBP image.'); return }
    if (file && file.size > 8 * 1024 * 1024) { setMessage('Article images must be under 8 MB.'); return }
    setBusy(true); setMessage('Creating article…')
    try {
      const created = await adminRequest<{ data: { id: string } }>('POST', '/admin/newsroom/articles/manual', {
        title: form.title, subtitle: form.subtitle, category: form.category, author: form.author, summary: form.summary, body: form.body,
      })
      await adminRequest('PATCH', `/admin/newsroom/articles/${created.data.id}`, {
        tags: { homepageFeatured: form.homepageFeatured, ...(form.homepageFeatured ? { homepageOrder: form.homepageOrder } : {}) },
      })
      if (file) {
        setMessage('Article created. Uploading image…')
        await adminRequest('POST', `/admin/newsroom/articles/${created.data.id}/image`, { fileName: file.name, contentType: file.type, dataUrl: await readDataUrl(file) })
      }
      setMessage('Article created as a draft. You can preview, order and publish it below.')
      clear(false)
      await loadArticles()
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }

  const clear = (clearMessage = true) => {
    setForm(emptyForm); setFile(null); setImagePreview(''); if (clearMessage) setMessage('')
    const picker = document.getElementById('manual-news-image') as HTMLInputElement | null
    if (picker) picker.value = ''
  }

  const setPosition = (index: number, id: string) => {
    setPositions(current => current.map((value, position) => position === index ? id : value === id && id ? '' : value))
  }

  const saveHomepageOrder = async () => {
    const selected = positions.filter(Boolean)
    if (new Set(selected).size !== selected.length) { setMessage('Each homepage position must use a different article.'); return }
    setManagerBusy(true); setMessage('Saving homepage order…')
    try {
      await Promise.all(articles.map(article => {
        const position = selected.indexOf(article.id)
        const tags = { ...(article.tags ?? {}) }
        if (position >= 0) { tags.homepageFeatured = true; tags.homepageOrder = position + 1 }
        else { tags.homepageFeatured = false; delete tags.homepageOrder }
        return adminRequest('PATCH', `/admin/newsroom/articles/${article.id}`, { tags })
      }))
      setMessage('Homepage story order saved. Only published selections will appear publicly.')
      await loadArticles()
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
    finally { setManagerBusy(false) }
  }

  const openPreview = async (id: string) => {
    setManagerBusy(true)
    try {
      const response = await adminRequest<{ data: ArticlePreview }>('GET', `/admin/platform/articles/${id}`)
      setPreview(response.data)
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
    finally { setManagerBusy(false) }
  }

  const toggleStatus = async (article: NewsArticle) => {
    setManagerBusy(true)
    try {
      const next = article.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
      await adminRequest('PATCH', `/admin/newsroom/articles/${article.id}`, { status: next })
      setMessage(next === 'PUBLISHED' ? 'Article published.' : 'Article unpublished and returned to draft.')
      await loadArticles()
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
    finally { setManagerBusy(false) }
  }

  return createPortal(<>
    <section className="manual-news-card">
      <div className="manual-news-head"><div><small>MANUAL PUBLISHING</small><h2>Create your own article</h2><p>Create the story, upload its image and save it as a draft before publishing.</p></div><button type="button" onClick={() => setOpen(value => !value)}>{open ? 'Close' : 'Create article'}</button></div>
      {open && <div className="manual-news-form">
        <label><span>Headline</span><input style={input} value={form.title} onChange={event => update('title', event.target.value)} /></label>
        <label><span>Subtitle</span><input style={input} value={form.subtitle} onChange={event => update('subtitle', event.target.value)} /></label>
        <label><span>Category</span><select style={input} value={form.category} onChange={event => update('category', event.target.value)}>{['club-news','league-news','rankings','state-news','transfers','player-spotlight','coach-spotlight','community','grassroots','history','opinion'].map(value => <option key={value} value={value}>{value.split('-').map(word => word[0].toUpperCase()+word.slice(1)).join(' ')}</option>)}</select></label>
        <label><span>Author</span><input style={input} value={form.author} onChange={event => update('author', event.target.value)} /></label>
        <label className="wide"><span>Summary</span><textarea style={{ ...input, minHeight: 92 }} value={form.summary} onChange={event => update('summary', event.target.value)} /></label>
        <label className="wide"><span>Article body</span><textarea style={{ ...input, minHeight: 260 }} placeholder="Write the article in normal paragraphs. Leave a blank line between paragraphs." value={form.body} onChange={event => update('body', event.target.value)} /></label>
        <div className="manual-news-image wide"><label><span>Article hero image</span><input id="manual-news-image" style={input} type="file" accept="image/png,image/jpeg,image/webp" onChange={event => setFile(event.target.files?.[0] ?? null)} /></label><div className="manual-news-preview">{imagePreview ? <img src={imagePreview} alt="Article preview" /> : <strong>No image selected</strong>}</div></div>
        <label className="manual-news-feature wide"><input type="checkbox" checked={form.homepageFeatured} onChange={event => update('homepageFeatured', event.target.checked)} /><span><strong>Reserve a homepage position</strong><small>The article will only appear there after it is published.</small></span></label>
        {form.homepageFeatured && <label><span>Homepage position</span><select style={input} value={form.homepageOrder} onChange={event => update('homepageOrder', Number(event.target.value))}><option value={1}>Position 1</option><option value={2}>Position 2</option><option value={3}>Position 3</option></select></label>}
        <div className="manual-news-actions"><button type="button" disabled={busy} onClick={() => void createArticle()}>{busy ? 'Creating…' : 'Create draft'}</button><button type="button" className="secondary" disabled={busy} onClick={() => clear()}>Clear</button></div>
      </div>}
    </section>

    <section className="manual-news-card news-publishing-manager">
      <div className="manual-news-head"><div><small>HOMEPAGE NEWS</small><h2>Preview and order stories</h2><p>Choose the exact order of the three homepage news slides. Drafts can be reserved but remain hidden until published.</p></div><button type="button" onClick={() => void loadArticles()}>Refresh</button></div>
      <div className="homepage-order-grid">{positions.map((articleId, index) => <label key={index}><span>Homepage position {index + 1}</span><select style={input} value={articleId} onChange={event => setPosition(index, event.target.value)}><option value="">Placeholder</option>{sortedArticles.map(article => <option key={article.id} value={article.id}>{article.status === 'PUBLISHED' ? 'LIVE' : article.status} · {article.title}</option>)}</select></label>)}</div>
      <div className="manual-news-actions"><button type="button" disabled={managerBusy} onClick={() => void saveHomepageOrder()}>{managerBusy ? 'Saving…' : 'Save homepage order'}</button></div>
      <div className="news-manager-list">{sortedArticles.map(article => <article key={article.id}><div><span className={`news-status is-${article.status.toLowerCase()}`}>{article.status}</span><strong>{article.title}</strong><small>{article.tags?.homepageFeatured === true ? `Homepage position ${Number(article.tags.homepageOrder ?? 0) || 'not set'}` : 'Not featured on homepage'}</small></div><div><button type="button" disabled={managerBusy} onClick={() => void openPreview(article.id)}>Preview</button><button type="button" className="dark" disabled={managerBusy} onClick={() => void toggleStatus(article)}>{article.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}</button>{article.status === 'PUBLISHED' && <a href={`/news/${article.slug}`} target="_blank" rel="noreferrer">Open live</a>}</div></article>)}</div>
    </section>

    {message && <div className="manual-news-message">{message}</div>}
    {preview && <PreviewModal article={preview} close={() => setPreview(null)} />}
    <style>{styles}</style>
  </>, target.host)
}

function PreviewModal({ article, close }: { article: ArticlePreview; close: () => void }) {
  const paragraphs = parseBody(article.body)
  return <div className="news-preview-overlay" role="dialog" aria-modal="true" aria-label="Article preview" onClick={close}><article className="news-preview-modal" onClick={event => event.stopPropagation()}><button className="news-preview-close" type="button" onClick={close}>Close</button><div className="news-preview-hero">{isImageUrl(article.heroSeed) ? <img src={article.heroSeed} alt="" /> : <div><span>PLAYFOOTY NEWS</span></div>}</div><div className="news-preview-copy"><small>{article.status} PREVIEW · {article.category.replaceAll('-', ' ')}</small><h1>{article.title}</h1>{article.subtitle && <h2>{article.subtitle}</h2>}<p className="news-preview-summary">{article.summary}</p>{paragraphs.map((paragraph, index) => paragraph.type === 'h' ? <h3 key={index}>{paragraph.text}</h3> : <p key={index}>{paragraph.text}</p>)}</div></article></div>
}

function parseBody(body: string) {
  try {
    const parsed = JSON.parse(body) as Array<{ type?: string; text?: string }>
    if (Array.isArray(parsed)) return parsed.filter(row => row?.text).map(row => ({ type: row.type ?? 'p', text: String(row.text) }))
  } catch { /* plain text fallback */ }
  return String(body ?? '').split(/\n{2,}/).filter(Boolean).map(text => ({ type: 'p', text }))
}
function isImageUrl(value: string) { return /^https?:\/\//i.test(value) || value.startsWith('/') }
function readDataUrl(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error ?? new Error('Could not read the image.')); reader.readAsDataURL(file) }) }

const styles = `
.admin-manual-news-host{display:grid;gap:18px}.manual-news-card{background:#fff;border:1px solid #dce3eb;border-radius:18px;padding:20px}.manual-news-head{display:flex;align-items:center;justify-content:space-between;gap:18px}.manual-news-head small{display:block;color:#168fd4;font-size:10px;font-weight:950;letter-spacing:.16em}.manual-news-head h2{margin:5px 0 4px;font-family:'Bebas Neue',Impact,sans-serif;font-size:36px;line-height:1;text-transform:uppercase}.manual-news-head p{margin:0;color:#687385;max-width:760px}.manual-news-head button,.manual-news-actions button,.news-manager-list button,.news-manager-list a{border:0;border-radius:999px;padding:11px 17px;background:#35b6ff;color:#050505;font-weight:950;text-transform:uppercase;cursor:pointer;white-space:nowrap;text-decoration:none;font-size:12px}.manual-news-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;margin-top:20px;padding-top:20px;border-top:1px solid #e5eaf0}.manual-news-form label,.homepage-order-grid label{display:grid;gap:6px}.manual-news-form label>span,.homepage-order-grid label>span{font-size:11px;font-weight:950;color:#687385;text-transform:uppercase}.manual-news-form .wide,.manual-news-actions{grid-column:1/-1}.manual-news-image{display:grid;grid-template-columns:minmax(0,1fr) minmax(230px,36%);gap:14px;align-items:center;padding:14px;border:1px solid #dce3eb;border-radius:15px;background:#f7f9fb}.manual-news-preview{aspect-ratio:16/9;border:1px solid #dce3eb;border-radius:12px;background:#fff;display:grid;place-items:center;overflow:hidden;color:#687385}.manual-news-preview img{width:100%;height:100%;object-fit:cover}.manual-news-feature{display:flex!important;grid-template-columns:auto 1fr!important;align-items:flex-start;gap:12px!important;padding:15px;border:1px solid #b8def5;border-radius:14px;background:#eef8ff}.manual-news-feature input{width:22px;height:22px;margin:1px 0 0}.manual-news-feature span{display:grid;gap:3px;text-transform:none!important}.manual-news-feature strong{color:#0b3851;font-size:14px}.manual-news-feature small{color:#557183;font-size:12px;font-weight:700;text-transform:none}.manual-news-message{position:sticky;bottom:14px;z-index:30;padding:12px 15px;border-radius:12px;background:#092b40;color:#fff;font-weight:850;box-shadow:0 10px 30px #0003}.manual-news-actions{display:flex;gap:10px;flex-wrap:wrap}.manual-news-actions .secondary,.news-manager-list .dark{background:#050505;color:#fff}.homepage-order-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:18px 0}.news-manager-list{display:grid;gap:9px;margin-top:18px}.news-manager-list article{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px;border:1px solid #e2e8ef;border-radius:14px}.news-manager-list article>div:first-child{display:grid;gap:4px;min-width:0}.news-manager-list article strong{font-size:17px}.news-manager-list article small{color:#687385}.news-manager-list article>div:last-child{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.news-status{width:max-content;padding:4px 8px;border-radius:999px;background:#e8edf3;color:#425066;font-size:9px;font-weight:950;letter-spacing:.08em}.news-status.is-published{background:#dff7e8;color:#08713a}.news-status.is-draft{background:#fff1ce;color:#7b5700}.news-preview-overlay{position:fixed;inset:0;z-index:10000;padding:24px;background:#000c;overflow:auto}.news-preview-modal{position:relative;width:min(1000px,100%);margin:auto;border-radius:20px;overflow:hidden;background:#fff;box-shadow:0 30px 90px #0008}.news-preview-close{position:absolute;right:16px;top:16px;z-index:3;border:0;border-radius:999px;padding:10px 15px;background:#fff;color:#050505;font-weight:950}.news-preview-hero{aspect-ratio:16/7;background:linear-gradient(135deg,#06111e,#0b3650 58%,#149ddd);overflow:hidden}.news-preview-hero img{width:100%;height:100%;object-fit:cover}.news-preview-hero>div{width:100%;height:100%;display:grid;place-items:center;color:#ffffff30;font-family:'Bebas Neue',Impact,sans-serif;font-size:70px}.news-preview-copy{padding:clamp(24px,5vw,58px)}.news-preview-copy>small{color:#168fd4;font-weight:950;letter-spacing:.12em;text-transform:uppercase}.news-preview-copy h1{margin:12px 0;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(3rem,7vw,6rem);line-height:.9;text-transform:uppercase}.news-preview-copy h2{color:#485565;font-size:22px}.news-preview-copy p{font-size:17px;line-height:1.7}.news-preview-summary{font-size:20px!important;font-weight:750;color:#324152}.news-preview-copy h3{font-size:26px;margin-top:30px}
@media(max-width:800px){.manual-news-head{align-items:flex-start;flex-direction:column}.manual-news-form,.homepage-order-grid{grid-template-columns:1fr}.manual-news-form .wide,.manual-news-actions{grid-column:auto}.manual-news-image{grid-template-columns:1fr}.news-manager-list article{align-items:flex-start;flex-direction:column}.news-manager-list article>div:last-child{justify-content:flex-start}.news-preview-overlay{padding:8px}.news-preview-copy{padding:24px 18px}.news-preview-copy h1{font-size:3.4rem}}
`
