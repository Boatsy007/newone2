import { useEffect } from 'react'

const CLUB_DETAIL = /^\/admin\/(?:platform\/clubs|manage\/clubs)\/([^/?#]+)$/
const CLUB_LIST = '/admin/manage/clubs'
const PORTAL_SESSION_KEY = 'playfooty.clubPortal.session.v1'
const ADMIN_KEY = 'cnca_admin_key'

function pathnameOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    try { return new URL(input, window.location.origin).pathname } catch { return input }
  }
  if (input instanceof URL) return input.pathname
  try { return new URL(input.url, window.location.origin).pathname } catch { return input.url }
}

function methodOf(input: RequestInfo | URL, init?: RequestInit): string {
  return (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
}

function dataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Unable to read image'))
    reader.readAsDataURL(file)
  })
}

function portalToken() {
  try {
    const raw = localStorage.getItem(PORTAL_SESSION_KEY)
    return raw ? String((JSON.parse(raw) as { access_token?: string }).access_token ?? '') : ''
  } catch { return '' }
}

function makePanel(kind: 'portal' | 'admin', clubId: string) {
  const panel = document.createElement('section')
  panel.dataset.clubCoverManager = `${kind}:${clubId}`
  panel.style.cssText = 'background:#fff;border:1px solid #dce4ea;border-radius:14px;padding:19px;margin:14px 0;box-shadow:0 8px 24px rgba(15,23,42,.045);font-family:Barlow,Inter,Arial,sans-serif'
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap">
      <div><span style="display:block;color:#0783c9;font-size:10px;font-weight:900;letter-spacing:.15em;text-transform:uppercase">Profile branding</span><h2 style="font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:32px;line-height:.95;margin:5px 0 7px">Cover photo</h2><p style="margin:0;color:#687385;line-height:1.5">Optional. If no cover is uploaded, the current PlayFooty club header stays unchanged.</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><label style="display:inline-flex;align-items:center;gap:7px;background:#2daaf5;color:#071018;border-radius:999px;padding:11px 15px;font-weight:900;cursor:pointer;text-transform:uppercase">Upload cover<input data-cover-file type="file" accept="image/png,image/jpeg,image/webp" style="display:none"></label><button data-cover-remove type="button" style="display:none;border:1px solid #d71920;border-radius:999px;padding:10px 14px;background:#fff;color:#b11920;font-weight:900;cursor:pointer;text-transform:uppercase">Remove cover</button></div>
    </div>
    <div data-cover-status style="margin-top:12px;color:#687385;font-size:13px"></div>
    <div data-cover-preview style="display:none;margin-top:14px;border-radius:12px;overflow:hidden;background:#101318"><img alt="Club cover preview" style="display:block;width:100%;aspect-ratio:16/5;object-fit:cover"></div>`

  const input = panel.querySelector<HTMLInputElement>('[data-cover-file]')!
  const remove = panel.querySelector<HTMLButtonElement>('[data-cover-remove]')!
  const status = panel.querySelector<HTMLElement>('[data-cover-status]')!
  const preview = panel.querySelector<HTMLElement>('[data-cover-preview]')!
  const image = preview.querySelector('img')!
  const base = kind === 'portal' ? `/api/club-portal/club-covers/${encodeURIComponent(clubId)}` : `/admin/club-covers/${encodeURIComponent(clubId)}`
  const headers = () => ({ authorization: `Bearer ${kind === 'portal' ? portalToken() : localStorage.getItem(ADMIN_KEY) ?? ''}` })

  const show = (url: string | null) => {
    preview.style.display = url ? 'block' : 'none'
    remove.style.display = url ? 'inline-flex' : 'none'
    if (url) image.src = url
  }

  void fetch(base, { headers: headers() }).then(async response => {
    if (!response.ok) throw new Error('Unable to load current cover')
    const payload = await response.json() as { data?: { coverPhotoUrl?: string | null } }
    show(payload.data?.coverPhotoUrl ?? null)
    status.textContent = payload.data?.coverPhotoUrl ? 'Current public cover photo.' : 'No cover photo is currently connected.'
  }).catch(() => { status.textContent = 'No cover photo is currently connected.' })

  input.addEventListener('change', async () => {
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { status.textContent = 'Cover photos must be 10 MB or smaller.'; return }
    status.textContent = 'Uploading and publishing cover photo…'
    try {
      const response = await fetch(base, { method: 'POST', headers: { ...headers(), 'content-type': 'application/json' }, body: JSON.stringify({ contentType: file.type, dataUrl: await dataUrl(file) }) })
      const payload = await response.json().catch(() => ({})) as { data?: { coverPhotoUrl?: string | null }; error?: string; message?: string }
      if (!response.ok) throw new Error(payload.error || 'Upload failed')
      show(payload.data?.coverPhotoUrl ?? null)
      status.textContent = payload.message || 'Cover photo published.'
    } catch (error) { status.textContent = error instanceof Error ? error.message : 'Upload failed' }
  })

  remove.addEventListener('click', async () => {
    if (!window.confirm('Remove this cover photo and restore the default club hero?')) return
    status.textContent = 'Removing cover photo…'
    try {
      const response = await fetch(base, { method: 'DELETE', headers: headers() })
      const payload = await response.json().catch(() => ({})) as { error?: string; message?: string }
      if (!response.ok) throw new Error(payload.error || 'Unable to remove cover')
      show(null)
      status.textContent = payload.message || 'Default club hero restored.'
    } catch (error) { status.textContent = error instanceof Error ? error.message : 'Unable to remove cover' }
  })
  return panel
}

function editorClubId(activeId: string) {
  if (activeId) return activeId
  const publicLink = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/team/"]')).find(link => link.closest('.pf-admin-content'))
  const match = publicLink?.getAttribute('href')?.match(/^\/team\/([^/?#]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

function logoCard() {
  const headings = Array.from(document.querySelectorAll<HTMLElement>('.pf-admin-content h1,.pf-admin-content h2,.pf-admin-content h3'))
  const heading = headings.find(item => item.textContent?.trim().toLowerCase() === 'club logo')
  if (!heading) return null
  return heading.closest<HTMLElement>('section') || heading.parentElement?.parentElement || heading.parentElement
}

export default function AdminClubProfileFallback() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window)
    let activeAdminClubId = ''
    let publicHero: HTMLElement | null = null

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const match = methodOf(input, init) === 'GET' ? pathnameOf(input).match(CLUB_DETAIL) : null
      if (!match) return originalFetch(input, init)

      const clubId = decodeURIComponent(match[1])
      activeAdminClubId = clubId
      if (pathnameOf(input).startsWith('/admin/manage/clubs/')) return originalFetch(input, init)

      let detailResponse: Response | null = null
      try {
        detailResponse = await Promise.race([
          originalFetch(input, init),
          new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('Club profile request timed out')), 5000)),
        ])
        if (detailResponse.ok) return detailResponse
      } catch { /* stable fallback below */ }

      try {
        const listResponse = await originalFetch(CLUB_LIST, { method: 'GET', headers: init?.headers ?? (input instanceof Request ? input.headers : undefined) })
        if (!listResponse.ok) return detailResponse ?? listResponse
        const payload = await listResponse.json() as { data?: Array<Record<string, unknown>> }
        const club = Array.isArray(payload.data) ? payload.data.find(row => String(row.id) === clubId) : undefined
        if (!club) return detailResponse ?? new Response(JSON.stringify({ error: 'Club not found' }), { status: 404, headers: { 'content-type': 'application/json' } })
        return new Response(JSON.stringify({ data: { ...club, leagueSeasons: [], rankingEntries: [], nameVariants: [] } }), { status: 200, headers: { 'content-type': 'application/json' } })
      } catch {
        return detailResponse ?? new Response(JSON.stringify({ error: 'Unable to load club profile' }), { status: 500, headers: { 'content-type': 'application/json' } })
      }
    }

    const connect = () => {
      const teamMatch = window.location.pathname.match(/^\/team\/([^/]+)$/)
      if (teamMatch) {
        const clubId = decodeURIComponent(teamMatch[1])
        const hero = document.querySelector<HTMLElement>('#main-content > header')
        if (hero && hero !== publicHero) {
          publicHero = hero
          void originalFetch(`/api/club-covers/${encodeURIComponent(clubId)}`).then(r => r.ok ? r.json() : null).then((payload: { data?: { coverPhotoUrl?: string | null } } | null) => {
            const url = payload?.data?.coverPhotoUrl
            if (!url || !hero.isConnected) return
            hero.dataset.hasClubCover = 'true'
            hero.style.backgroundImage = `linear-gradient(90deg,rgba(7,10,15,.92),rgba(7,10,15,.68) 55%,rgba(7,10,15,.78)),url("${url.replace(/"/g, '%22')}")`
            hero.style.backgroundSize = 'cover'
            hero.style.backgroundPosition = 'center'
          }).catch(() => undefined)
        }
      } else if (publicHero) {
        publicHero.style.removeProperty('background-image')
        publicHero.style.removeProperty('background-size')
        publicHero.style.removeProperty('background-position')
        publicHero = null
      }

      const portalMatch = window.location.pathname.match(/^\/club-portal\/([^/]+)\/profile$/)
      if (portalMatch && !document.querySelector('[data-club-cover-manager^="portal:"]')) {
        const target = document.querySelector('.cpp .save')
        if (target) target.insertAdjacentElement('afterend', makePanel('portal', decodeURIComponent(portalMatch[1])))
      }

      if (window.location.pathname === '/admin') {
        const clubId = editorClubId(activeAdminClubId)
        const logo = logoCard()
        if (clubId && logo && !document.querySelector(`[data-club-cover-manager="admin:${CSS.escape(clubId)}"]`)) {
          logo.insertAdjacentElement('afterend', makePanel('admin', clubId))
        }
      }
    }

    connect()
    const observer = new MutationObserver(connect)
    observer.observe(document.body, { childList: true, subtree: true })
    const timer = window.setInterval(connect, 500)
    return () => {
      observer.disconnect()
      window.clearInterval(timer)
      window.fetch = originalFetch
      if (publicHero) {
        publicHero.style.removeProperty('background-image')
        publicHero.style.removeProperty('background-size')
        publicHero.style.removeProperty('background-position')
      }
    }
  }, [])

  return null
}
