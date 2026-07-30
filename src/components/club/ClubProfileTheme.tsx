import { useEffect } from 'react'

function valid(value: unknown, fallback: string) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : fallback
}

const PRIMARY_RGB = new Set([
  'rgb(45, 170, 245)',
  'rgb(66, 184, 255)',
  'rgb(7, 131, 201)',
  'rgb(8, 120, 189)',
  'rgb(32, 159, 233)',
  'rgb(8, 123, 191)',
  'rgb(82, 191, 255)',
  'rgb(0, 153, 204)',
])
const SECONDARY_RGB = new Set([
  'rgb(214, 27, 140)',
  'rgb(215, 25, 142)',
  'rgb(210, 24, 135)',
  'rgb(204, 24, 132)',
])

function themed(value: string, primary: string, secondary: string) {
  if (PRIMARY_RGB.has(value)) return primary
  if (SECONDARY_RGB.has(value)) return secondary
  return null
}

function applyKnownAccentColours(scope: HTMLElement, primary: string, secondary: string) {
  const nodes = [scope, ...Array.from(scope.querySelectorAll<HTMLElement>('*'))]
  for (const node of nodes) {
    const computed = getComputedStyle(node)
    const color = themed(computed.color, primary, secondary)
    const background = themed(computed.backgroundColor, primary, secondary)
    const borderTop = themed(computed.borderTopColor, primary, secondary)
    const borderRight = themed(computed.borderRightColor, primary, secondary)
    const borderBottom = themed(computed.borderBottomColor, primary, secondary)
    const borderLeft = themed(computed.borderLeftColor, primary, secondary)
    const fill = themed(computed.fill, primary, secondary)
    const stroke = themed(computed.stroke, primary, secondary)
    if (color) node.style.setProperty('color', color, 'important')
    if (background) node.style.setProperty('background-color', background, 'important')
    if (borderTop) node.style.setProperty('border-top-color', borderTop, 'important')
    if (borderRight) node.style.setProperty('border-right-color', borderRight, 'important')
    if (borderBottom) node.style.setProperty('border-bottom-color', borderBottom, 'important')
    if (borderLeft) node.style.setProperty('border-left-color', borderLeft, 'important')
    if (fill && node instanceof SVGElement) node.style.setProperty('fill', fill, 'important')
    if (stroke && node instanceof SVGElement) node.style.setProperty('stroke', stroke, 'important')
  }
}

function applyInlineAccents(root: HTMLElement, primary: string, secondary: string) {
  const main = root.querySelector<HTMLElement>('#main-content')
  if (!main) return

  const hero = main.querySelector<HTMLElement>(':scope > header')
  if (hero) {
    hero.style.setProperty('border-bottom-color', secondary, 'important')
    const labels = Array.from(hero.querySelectorAll<HTMLElement>('div,span')).filter(node => node.textContent?.trim().toLowerCase() === 'national rank')
    for (const label of labels) {
      const value = label.parentElement?.children.item(1) as HTMLElement | null
      if (value) value.style.setProperty('color', secondary, 'important')
    }
    for (const link of hero.querySelectorAll<HTMLElement>('a')) link.style.setProperty('color', primary, 'important')
  }

  applyKnownAccentColours(main, primary, secondary)

  for (const node of Array.from(main.querySelectorAll<HTMLElement>('a,button,div,section'))) {
    const text = node.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() ?? ''
    const isClaim = text === 'claim club' || text.includes('claiming coming soon') || text.includes('national pathway coming soon')
    if (!isClaim) continue
    if (node.matches('a,button') || node.children.length <= 3) {
      node.style.setProperty('background-color', primary, 'important')
      node.style.setProperty('border-color', primary, 'important')
      node.style.setProperty('color', '#ffffff', 'important')
      for (const child of node.querySelectorAll<HTMLElement>('*')) child.style.setProperty('color', '#ffffff', 'important')
    }
  }
}

export default function ClubProfileTheme() {
  useEffect(() => {
    let currentClubId = ''
    let cancelled = false
    let observer: MutationObserver | null = null
    let scheduled = 0

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
        observer = new MutationObserver(() => {
          window.cancelAnimationFrame(scheduled)
          scheduled = window.requestAnimationFrame(() => applyInlineAccents(root, primary, secondary))
        })
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
      window.cancelAnimationFrame(scheduled)
      window.clearInterval(timer)
      style.remove()
    }
  }, [])
  return null
}
