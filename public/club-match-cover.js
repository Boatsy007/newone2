(() => {
  if (!/^\/team\/[^/?#]+/.test(window.location.pathname)) return

  const selector = '.club-feature-game-top, .club-last-result-top'
  let observer = null
  let timer = null

  const renderedHeroCover = () => {
    const hero = document.querySelector('#main-content > header')
    if (!(hero instanceof HTMLElement)) return ''
    const inline = hero.style.backgroundImage
    if (inline && inline !== 'none') return inline
    const computed = window.getComputedStyle(hero).backgroundImage
    return computed && computed !== 'none' ? computed : ''
  }

  const applyCover = () => {
    const backgroundImage = renderedHeroCover()
    if (!backgroundImage || !backgroundImage.includes('url(')) return false

    const targets = Array.from(document.querySelectorAll(selector))
    targets.forEach((element) => {
      if (!(element instanceof HTMLElement)) return
      element.style.setProperty('background-image', backgroundImage, 'important')
      element.style.setProperty('background-size', 'cover', 'important')
      element.style.setProperty('background-position', 'center center', 'important')
      element.style.setProperty('background-repeat', 'no-repeat', 'important')
    })
    return targets.length > 0
  }

  const start = () => {
    applyCover()
    observer = new MutationObserver(applyCover)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] })
    timer = window.setInterval(applyCover, 500)
    window.setTimeout(() => {
      if (timer) window.clearInterval(timer)
      timer = null
    }, 20000)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
  else start()
})()
