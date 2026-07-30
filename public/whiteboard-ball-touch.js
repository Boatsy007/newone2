(() => {
  const ROUTE = /^\/club-portal\/[^/]+\/whiteboard\/?$/
  if (!ROUTE.test(window.location.pathname)) return

  const active = new Map()
  const field = () => document.querySelector('.wb .oval')

  function point(event) {
    const oval = field()
    if (!oval) return null
    const box = oval.getBoundingClientRect()
    if (!box.width || !box.height) return null
    return {
      x: Math.max(0, Math.min(100, ((event.clientX - box.left) / box.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - box.top) / box.height) * 100)),
    }
  }

  document.addEventListener('pointerdown', event => {
    const ball = event.target instanceof Element ? event.target.closest('.pf-record-ball') : null
    const oval = field()
    if (!ball || !oval?.contains(ball) || !oval.classList.contains('tool-select') || document.body.classList.contains('pf-whiteboard-playing')) return
    event.preventDefault()
    event.stopPropagation()
    active.set(event.pointerId, ball)
    try { ball.setPointerCapture(event.pointerId) } catch {}
  }, true)

  document.addEventListener('pointermove', event => {
    const ball = active.get(event.pointerId)
    if (!ball) return
    event.preventDefault()
    event.stopPropagation()
    requestAnimationFrame(() => {
      const next = point(event)
      if (!next || !ball.isConnected) return
      ball.style.left = `${next.x}%`
      ball.style.top = `${next.y}%`
    })
  }, true)

  const finish = event => {
    const ball = active.get(event.pointerId)
    if (!ball) return
    active.delete(event.pointerId)
    try { ball.releasePointerCapture(event.pointerId) } catch {}
  }
  document.addEventListener('pointerup', finish, true)
  document.addEventListener('pointercancel', finish, true)
})()
