import { useEffect } from 'react'

function valid(value: unknown, fallback: string) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : fallback
}

function applyInlineAccents(root: HTMLElement, primary: string, secondary: string) {
  const hero = root.querySelector<HTMLElement>('#main-content > header')
  if (hero) {
    hero.style.setProperty('border-bottom-color', secondary, 'important')
    const labels = Array.from(hero.querySelectorAll<HTMLElement>('div,span')).filter(node => node.textContent?.trim().toLowerCase() === 'national rank')
    for (const label of labels) {
      const stat = label.parentElement
      const value = stat?.children.item(1) as HTMLElement | null
      if (value) value.style.setProperty('color', secondary, 'important')
    }
    for (const link of hero.querySelectorAll<HTMLElement>('a')) link.style.setProperty('color', primary, 'important')
  }
}

export default function ClubProfileTheme() {
  useEffect(() => {
    let currentClubId = ''
    let cancelled = false
    let observer: MutationObserver | null = null

    const connect = async () => {
      const match = window.location.pathname.match(/^\/team\/([^/]+)$/)
      const root = document.querySelector<HTMLElement>('.club-profile-page')
      if (!match || !root) {
        currentClubId = ''
        observer?.disconnect()
        observer = null
        return
      }
      const clubId = decodeURIComponent(match[1])
      if (clubId === currentClubId && root.dataset.clubThemeReady === 'true') return
      currentClubId = clubId
      try {
        const response = await fetch(`/api/clubs/${encodeURIComponent(clubId)}`)
        if (!response.ok) return
        const payload = await response.json() as { data?: { primaryColour?: string | null; secondaryColour?: string | null } }
        if (cancelled || currentClubId !== clubId) return
        const primary = valid(payload.data?.primaryColour, '#2DAAF5')
        const secondary = valid(payload.data?.secondaryColour, '#D61B8C')
        root.style.setProperty('--club-primary', primary)
        root.style.setProperty('--club-secondary', secondary)
        root.dataset.clubThemeReady = 'true'
        applyInlineAccents(root, primary, secondary)
        observer?.disconnect()
        observer = new MutationObserver(() => applyInlineAccents(root, primary, secondary))
        observer.observe(root, { childList: true, subtree: true })
      } catch { /* existing PlayFooty colours remain */ }
    }

    const style = document.createElement('style')
    style.dataset.clubProfileTheme = 'true'
    style.textContent = `
      .club-profile-page{--club-primary:#2DAAF5;--club-secondary:#D61B8C}
      .club-profile-page .club-profile-tabs button.active:after{background:var(--club-primary)!important}
      .club-profile-page .club-info-kicker,
      .club-profile-page .club-sponsors-head>span,
      .club-profile-page .club-sponsor-group-head span,
      .club-profile-page .club-sponsor-empty>span{color:var(--club-primary)!important}
      .club-profile-page .club-sponsors-head h2 em{color:var(--club-primary)!important}
      .club-profile-page .club-sponsor-card small,
      .club-profile-page .club-contact-item a:hover{color:var(--club-primary)!important}
      .club-profile-page a.club-sponsor-card:hover{border-color:var(--club-primary)!important}
      .club-profile-page .club-sponsor-arrow:hover{background:var(--club-primary)!important}
      .club-profile-page #pf-club-mvp-slot a,
      .club-profile-page #pf-club-mvp-slot button{border-color:var(--club-primary)!important}
      .club-profile-page .club-section-bg a:not(.club-sponsor-card):hover{color:var(--club-primary)}
      .club-profile-page [data-club-secondary-accent]{color:var(--club-secondary)!important}
    `
    document.head.appendChild(style)
    void connect()
    const timer = window.setInterval(() => void connect(), 500)
    return () => {
      cancelled = true
      observer?.disconnect()
      window.clearInterval(timer)
      style.remove()
    }
  }, [])
  return null
}
