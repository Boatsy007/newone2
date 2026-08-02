(() => {
  let lastHandled = ''

  function openRequestedSection() {
    const url = new URL(window.location.href)
    const match = url.pathname.match(/^\/club-portal\/[^/]+\/media\/?$/)
    const requested = url.searchParams.get('section')
    if (!match || !requested) return

    const key = `${url.pathname}?section=${requested}`
    if (lastHandled === key) return

    const buttons = Array.from(document.querySelectorAll('.cmp-sidebar nav button'))
    const button = buttons.find((item) => item.textContent?.trim().toLowerCase().startsWith(requested.toLowerCase()))
    if (!button) return

    lastHandled = key
    button.click()
    url.searchParams.delete('section')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }

  const observer = new MutationObserver(openRequestedSection)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener('popstate', openRequestedSection)
  window.addEventListener('pageshow', openRequestedSection)
  document.addEventListener('DOMContentLoaded', openRequestedSection)
  openRequestedSection()
})()
