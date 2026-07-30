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

      /* Existing safe profile accents */
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
      .club-profile-page .club-section-bg a:not(.club-sponsor-card):hover{color:var(--club-primary)}

      /* Live hub: headings, links and values only */
      .club-profile-page .club-live-summary header span,
      .club-profile-page .club-live-card header span,
      .club-profile-page .club-live-summary header a,
      .club-profile-page .club-live-card header a,
      .club-profile-page .club-activity-list small,
      .club-profile-page .club-highlight-grid>a>span{color:var(--club-primary)!important}
      .club-profile-page .club-live-metrics strong,
      .club-profile-page .club-match-list>a>b,
      .club-profile-page .club-record-list strong{color:var(--club-secondary)!important}
      .club-profile-page .club-highlight-grid>a>div{color:var(--club-primary)!important}

      /* Goal kickers */
      .club-profile-page .public-gk-panel>header span,
      .club-profile-page .public-gk-panel>header>a,
      .club-profile-page .public-gk-rank,
      .club-profile-page .public-gk-numbers em,
      .club-profile-page .public-gk-links a{color:var(--club-primary)!important}
      .club-profile-page .public-gk-numbers b{color:var(--club-secondary)!important}
      .club-profile-page .public-gk-links a{background:color-mix(in srgb,var(--club-primary) 10%,white)!important}

      /* Club MVP */
      .club-profile-page .scope-mvp header small,
      .club-profile-page .scope-mvp header>a,
      .club-profile-page .scope-mvp-leader span{color:var(--club-primary)!important}
      .club-profile-page .scope-mvp-leader>b,
      .club-profile-page .scope-mvp-list>article>em>b{color:var(--club-secondary)!important}
      .club-profile-page #pf-club-mvp-slot a,
      .club-profile-page #pf-club-mvp-slot button{border-color:var(--club-primary)!important}

      /* Explicit profile promotion/action cards only */
      .club-profile-page .club-profile-sidebar a,
      .club-profile-page .club-profile-sidebar button{--profile-action-colour:var(--club-primary)}
      .club-profile-page .club-profile-sidebar a[style*="background"],
      .club-profile-page .club-profile-sidebar button[style*="background"]{background:var(--club-primary)!important;border-color:var(--club-primary)!important}
      .club-profile-page .club-profile-sidebar a[style*="background"] *,
      .club-profile-page .club-profile-sidebar button[style*="background"] *{color:#fff!important}

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
