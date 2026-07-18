import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const GROUPS: Record<string, string> = {
  Leagues: 'Content',
  'Universal Imports': 'Imports',
  Rankings: 'System',
}

function buttonLabel(button: HTMLButtonElement) {
  return (button.textContent ?? '').replace(/\s+/g, ' ').trim()
}

export default function AdminPhaseOnePolish() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    if (pathname !== '/admin') {
      setDrawerOpen(false)
      return
    }

    let quickImportButton: HTMLButtonElement | null = null
    const openUniversal = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
      navigate('/admin/universal-imports')
    }

    const polish = () => {
      const sidebar = document.querySelector<HTMLElement>('.pf-admin-sidebar')
      setDrawerOpen(Boolean(sidebar?.classList.contains('open')))

      document.querySelectorAll<HTMLElement>('.pf-admin-topbar-copy strong, .pf-page-hero h1').forEach(element => {
        if (element.textContent?.trim() === 'Image Imports') element.textContent = 'Universal Imports'
      })

      const nav = document.querySelector<HTMLElement>('.pf-admin-nav')
      if (nav) {
        nav.querySelectorAll('.pf-admin-nav-group').forEach(group => group.remove())
        const buttons = Array.from(nav.querySelectorAll<HTMLButtonElement>('button'))
        buttons.forEach(button => {
          const original = buttonLabel(button)
          if (original === 'Image Imports') {
            const textNode = Array.from(button.childNodes).find(node => node.nodeType === Node.TEXT_NODE)
            if (textNode) textNode.textContent = 'Universal Imports'
          }
        })

        Array.from(nav.querySelectorAll<HTMLButtonElement>('button')).forEach(button => {
          const label = buttonLabel(button)
          const heading = GROUPS[label]
          if (!heading) return
          const marker = document.createElement('div')
          marker.className = 'pf-admin-nav-group'
          marker.textContent = heading
          nav.insertBefore(marker, button)
        })
      }

      document.querySelectorAll<HTMLElement>('.pf-quick-action small').forEach(description => {
        description.hidden = true
      })

      const quickButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.pf-quick-action'))
      const first = quickButtons[0] ?? null
      if (quickImportButton !== first) {
        quickImportButton?.removeEventListener('click', openUniversal, true)
        quickImportButton = first
        quickImportButton?.addEventListener('click', openUniversal, true)
      }
      if (first) {
        const strong = first.querySelector('strong')
        if (strong) strong.textContent = 'Universal Imports'
      }
    }

    polish()
    const observer = new MutationObserver(polish)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })

    return () => {
      observer.disconnect()
      quickImportButton?.removeEventListener('click', openUniversal, true)
    }
  }, [navigate, pathname])

  if (pathname !== '/admin') return null

  return <>
    <style>{`
      .pf-admin-nav-group{padding:18px 13px 7px;color:#42b8ff;font-size:10px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}
      .pf-admin-nav-group:first-child{padding-top:4px}
      .pf-quick-action{grid-template-columns:42px 1fr 20px!important;min-height:78px}
      .pf-quick-action strong{display:block;font-size:17px;line-height:1.05}
      .pf-quick-action small{display:none!important}
      @media(max-width:820px){
        .pf-admin-sidebar{inset:0 58px 0 0!important;width:auto!important;height:100dvh!important;overflow-y:auto!important;box-shadow:18px 0 48px rgba(0,0,0,.35)}
        .pf-admin-sidebar.open{transform:translateX(0)!important}
        .pf-admin-menu{width:46px!important;height:46px!important;border-radius:12px!important;display:grid!important;place-items:center!important}
        .pf-page-hero{overflow:hidden!important;padding:28px 22px!important}
        .pf-page-hero h1{font-size:clamp(3.1rem,17vw,5.2rem)!important;overflow-wrap:anywhere!important;line-height:.88!important}
        .pf-page-hero p{font-size:16px!important;line-height:1.45!important}
        .pf-page section[style] > div[style*="grid-template-columns"]{grid-template-columns:1fr!important}
        .pf-page section[style] label,.pf-page section[style] input,.pf-page section[style] select{min-width:0!important;width:100%!important}
        .pf-quick-grid{padding:12px!important;gap:10px!important}
        .pf-quick-action{min-height:72px!important;padding:12px!important}
      }
    `}</style>
    {drawerOpen && <button aria-label="Close admin menu" onClick={() => document.querySelector<HTMLButtonElement>('.pf-admin-menu')?.click()} style={{position:'fixed',inset:0,zIndex:29,border:0,background:'rgba(0,0,0,.42)'}}/>}
  </>
}
