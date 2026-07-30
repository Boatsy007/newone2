(() => {
  const match = window.location.pathname.match(/^\/team\/([^/?#]+)/)
  if (!match) return

  const clubId = decodeURIComponent(match[1])
  const selector = '.club-feature-game-top, .club-last-result-top'
  let coverUrl = ''
  let observer = null
  let stopTimer = null

  const applyCover = () => {
    if (!coverUrl) return false
    const targets = Array.from(document.querySelectorAll(selector))
    targets.forEach((element) => {
      if (!(element instanceof HTMLElement)) return
      element.style.backgroundImage = `linear-gradient(135deg, rgba(20, 8, 38, .82), rgba(5, 14, 35, .78) 52%, rgba(4, 48, 73, .80)), url("${coverUrl.replace(/"/g, '%22')}")`
      element.style.backgroundSize = 'cover'
      element.style.backgroundPosition = 'center center'
      element.style.backgroundRepeat = 'no-repeat'
    })
    return targets.length >= 2
  }

  fetch(`/api/club-covers/${encodeURIComponent(clubId)}`)
    .then((response) => response.ok ? response.json() : null)
    .then((payload) => {
      coverUrl = typeof payload?.data?.coverPhotoUrl === 'string' ? payload.data.coverPhotoUrl.trim() : ''
      if (!coverUrl) return

      if (applyCover()) return

      observer = new MutationObserver(() => {
        if (applyCover()) {
          observer?.disconnect()
          observer = null
          if (stopTimer) window.clearTimeout(stopTimer)
        }
      })
      observer.observe(document.body, { childList: true, subtree: true })
      stopTimer = window.setTimeout(() => observer?.disconnect(), 15000)
    })
    .catch(() => {
      // Keep the existing gradient when no cover can be loaded.
    })
})()
