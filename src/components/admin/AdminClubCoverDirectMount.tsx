import { useEffect } from 'react'

const ADMIN_KEY = 'cnca_admin_key'

type ClubRow = { id: string; name: string }

function fileDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Unable to read image'))
    reader.readAsDataURL(file)
  })
}

function exactText(root: ParentNode, value: string) {
  return Array.from(root.querySelectorAll<HTMLElement>('h1,h2,h3,h4,strong,span,div'))
    .find(element => element.children.length === 0 && element.textContent?.trim().toLowerCase() === value.toLowerCase()) ?? null
}

function logoCard() {
  const heading = exactText(document.querySelector('.pf-admin-content') ?? document, 'Club Logo')
  if (!heading) return null
  let node: HTMLElement | null = heading
  while (node && node.parentElement && node.parentElement !== document.body) {
    const text = node.textContent ?? ''
    if (/upload or replace the logo/i.test(text) && node.querySelector('input[type="file"]')) return node
    node = node.parentElement
  }
  return heading.parentElement
}

function clubNameFromEditor() {
  const content = document.querySelector('.pf-admin-content')
  if (!content) return ''
  const labels = Array.from(content.querySelectorAll('label'))
  const label = labels.find(item => /^club\s*name$/i.test((item.childNodes[0]?.textContent ?? item.textContent ?? '').trim()))
  const labelledInput = label?.querySelector<HTMLInputElement>('input')
  if (labelledInput?.value.trim()) return labelledInput.value.trim()

  const inputs = Array.from(content.querySelectorAll<HTMLInputElement>('input'))
  const heading = exactText(content, 'Club Name')
  if (heading) {
    const nearby = heading.parentElement?.querySelector<HTMLInputElement>('input')
    if (nearby?.value.trim()) return nearby.value.trim()
  }
  return inputs.find(input => input.value.trim() && input.closest('label')?.textContent?.toLowerCase().includes('club name'))?.value.trim() ?? ''
}

function makePanel(clubId: string) {
  const panel = document.createElement('section')
  panel.dataset.clubCoverManager = `admin:${clubId}`
  panel.style.cssText = 'background:#fff;border:1px solid #dce4ea;border-radius:14px;padding:19px;margin:14px 0;box-shadow:0 8px 24px rgba(15,23,42,.045);font-family:Barlow,Inter,Arial,sans-serif'
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap">
      <div><span style="display:block;color:#0783c9;font-size:10px;font-weight:900;letter-spacing:.15em;text-transform:uppercase">Profile branding</span><h2 style="font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:32px;line-height:.95;margin:5px 0 7px">Cover photo</h2><p style="margin:0;color:#687385;line-height:1.5">Optional. Without a cover photo, the public club profile keeps its current PlayFooty header.</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><label style="display:inline-flex;align-items:center;gap:7px;background:#2daaf5;color:#071018;border-radius:999px;padding:11px 15px;font-weight:900;cursor:pointer;text-transform:uppercase">Upload cover<input data-cover-file type="file" accept="image/png,image/jpeg,image/webp" style="display:none"></label><button data-cover-remove type="button" style="display:none;border:1px solid #d71920;border-radius:999px;padding:10px 14px;background:#fff;color:#b11920;font-weight:900;cursor:pointer;text-transform:uppercase">Remove cover</button></div>
    </div>
    <div data-cover-status style="margin-top:12px;color:#687385;font-size:13px">Loading current cover…</div>
    <div data-cover-preview style="display:none;margin-top:14px;border-radius:12px;overflow:hidden;background:#101318"><img alt="Club cover preview" style="display:block;width:100%;aspect-ratio:16/5;object-fit:cover"></div>`

  const input = panel.querySelector<HTMLInputElement>('[data-cover-file]')!
  const remove = panel.querySelector<HTMLButtonElement>('[data-cover-remove]')!
  const status = panel.querySelector<HTMLElement>('[data-cover-status]')!
  const preview = panel.querySelector<HTMLElement>('[data-cover-preview]')!
  const image = preview.querySelector<HTMLImageElement>('img')!
  const endpoint = `/admin/club-covers/${encodeURIComponent(clubId)}`
  const headers = () => ({ authorization: `Bearer ${localStorage.getItem(ADMIN_KEY) ?? ''}` })
  const show = (url: string | null) => {
    preview.style.display = url ? 'block' : 'none'
    remove.style.display = url ? 'inline-flex' : 'none'
    if (url) image.src = url
  }

  void fetch(endpoint, { headers: headers() }).then(async response => {
    const payload = await response.json().catch(() => ({})) as { data?: { coverPhotoUrl?: string | null }; error?: string }
    if (!response.ok) throw new Error(payload.error || 'Unable to load current cover')
    const url = payload.data?.coverPhotoUrl ?? null
    show(url)
    status.textContent = url ? 'Current public cover photo.' : 'No cover photo is currently connected.'
  }).catch(error => { status.textContent = error instanceof Error ? error.message : 'Unable to load current cover' })

  input.addEventListener('change', async () => {
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { status.textContent = 'Cover photos must be 10 MB or smaller.'; return }
    status.textContent = 'Uploading and publishing cover photo…'
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { ...headers(), 'content-type': 'application/json' }, body: JSON.stringify({ contentType: file.type, dataUrl: await fileDataUrl(file) }) })
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
      const response = await fetch(endpoint, { method: 'DELETE', headers: headers() })
      const payload = await response.json().catch(() => ({})) as { error?: string; message?: string }
      if (!response.ok) throw new Error(payload.error || 'Unable to remove cover')
      show(null)
      status.textContent = payload.message || 'Default club hero restored.'
    } catch (error) { status.textContent = error instanceof Error ? error.message : 'Unable to remove cover' }
  })

  return panel
}

export default function AdminClubCoverDirectMount() {
  useEffect(() => {
    let resolving = false
    let lastName = ''

    const connect = async () => {
      if (window.location.pathname !== '/admin' || document.querySelector('[data-club-cover-manager^="admin:"]') || resolving) return
      const card = logoCard()
      const clubName = clubNameFromEditor()
      if (!card || !clubName) return
      resolving = true
      lastName = clubName
      try {
        const response = await fetch('/admin/manage/clubs', { headers: { authorization: `Bearer ${localStorage.getItem(ADMIN_KEY) ?? ''}` } })
        const payload = await response.json().catch(() => ({})) as { data?: ClubRow[] }
        if (!response.ok) return
        const normalise = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')
        const club = (payload.data ?? []).find(item => normalise(item.name) === normalise(clubName))
        if (!club || !card.isConnected || clubNameFromEditor() !== lastName) return
        card.insertAdjacentElement('afterend', makePanel(club.id))
      } finally { resolving = false }
    }

    void connect()
    const observer = new MutationObserver(() => { void connect() })
    observer.observe(document.body, { childList: true, subtree: true })
    const timer = window.setInterval(() => { void connect() }, 500)
    return () => { observer.disconnect(); window.clearInterval(timer) }
  }, [])
  return null
}
