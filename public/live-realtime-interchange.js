(() => {
  const clubId = new URLSearchParams(location.search).get('clubId') || ''
  const player = document.querySelector('.player, .video-wrap, #playerShell')
  if (!clubId || !player || window.PlayFootyRealtimeInterchange) return
  window.PlayFootyRealtimeInterchange = true

  const style = document.createElement('style')
  style.textContent = `
    .pf-public-swap{position:absolute;left:max(14px,env(safe-area-inset-left));bottom:max(88px,calc(env(safe-area-inset-bottom) + 70px));z-index:65;width:min(460px,calc(100% - 28px));pointer-events:none;opacity:0;visibility:hidden;transform:translateX(calc(-100% - 28px));transition:transform .38s cubic-bezier(.2,.8,.2,1),opacity .2s ease,visibility .2s ease}
    .pf-public-swap.show{opacity:1;visibility:visible;transform:translateX(0)}
    .pf-public-swap-card{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:12px;padding:11px 14px;border:1px solid rgba(255,255,255,.22);border-left:5px solid var(--swap-colour,#2daaf5);border-radius:14px;background:linear-gradient(100deg,rgba(3,9,14,.96),rgba(3,9,14,.88)),var(--swap-cover,none);background-position:center;background-size:cover;box-shadow:0 14px 38px rgba(0,0,0,.52);color:#fff;overflow:hidden;backdrop-filter:blur(12px)}
    .pf-public-swap-card:after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,color-mix(in srgb,var(--swap-colour,#2daaf5) 24%,transparent),transparent 58%);pointer-events:none}.pf-public-swap-card>*{position:relative;z-index:1}
    .pf-public-swap-logo{display:none;width:54px;height:54px;object-fit:contain;filter:drop-shadow(0 5px 10px rgba(0,0,0,.62))}.pf-public-swap-logo.show{display:block}
    .pf-public-swap-copy{min-width:0}.pf-public-swap-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:7px}.pf-public-swap-team{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:1000;letter-spacing:.13em;text-transform:uppercase;color:#dcecf5}.pf-public-swap-title{font-size:9px;font-weight:1000;letter-spacing:.14em;text-transform:uppercase;color:#8fcff5}
    .pf-public-swap-players{display:grid;gap:5px}.pf-public-swap-player{display:grid;grid-template-columns:44px minmax(0,1fr);align-items:center;gap:8px;min-width:0}.pf-public-swap-player small{display:grid;place-items:center;height:22px;border-radius:6px;font-size:9px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase}.pf-public-swap-player strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;line-height:1.05;text-transform:uppercase}.pf-public-swap-player.off small{background:#6f2028;color:#ffd9dc}.pf-public-swap-player.on small{background:#176b45;color:#d8ffec}
    @media(max-width:620px){.pf-public-swap{left:8px;bottom:max(76px,calc(env(safe-area-inset-bottom) + 66px));width:min(390px,calc(100% - 16px))}.pf-public-swap-card{gap:9px;padding:9px 10px;border-radius:11px}.pf-public-swap-logo{width:42px;height:42px}.pf-public-swap-player{grid-template-columns:38px minmax(0,1fr);gap:6px}.pf-public-swap-player small{height:20px;font-size:8px}.pf-public-swap-player strong{font-size:13px}.pf-public-swap-head{margin-bottom:5px}.pf-public-swap-team,.pf-public-swap-title{font-size:8px}}
    @media(prefers-reduced-motion:reduce){.pf-public-swap{transition:none}}
  `
  document.head.appendChild(style)

  const visual = document.createElement('section')
  visual.className = 'pf-public-swap'
  visual.setAttribute('aria-live', 'polite')
  visual.innerHTML = `
    <article class="pf-public-swap-card">
      <img class="pf-public-swap-logo" alt="">
      <div class="pf-public-swap-copy">
        <div class="pf-public-swap-head"><div class="pf-public-swap-team">Your Team</div><div class="pf-public-swap-title">Interchange</div></div>
        <div class="pf-public-swap-players">
          <div class="pf-public-swap-player off"><small>Off</small><strong></strong></div>
          <div class="pf-public-swap-player on"><small>On</small><strong></strong></div>
        </div>
      </div>
    </article>`
  player.appendChild(visual)

  const logo = visual.querySelector('.pf-public-swap-logo')
  const team = visual.querySelector('.pf-public-swap-team')
  const playerOff = visual.querySelector('.off strong')
  const playerOn = visual.querySelector('.on strong')
  let ready = false
  let lastEvent = ''
  let polling = false
  let timer = 0
  let hideTimer = 0

  const value = (...items) => items.find(item => typeof item === 'string' && item.trim())?.trim() || ''
  const parseSwap = event => {
    const match = String(event || '').trim().match(/^(.+?)\s+swapped\s+with\s+(.+)$/i)
    return match ? { off: match[1].trim(), on: match[2].trim() } : null
  }

  function showSwap(swap, data) {
    clearTimeout(hideTimer)
    team.textContent = value(data.clubName, data.homeName, 'Your Team')
    playerOff.textContent = swap.off
    playerOn.textContent = swap.on
    visual.style.setProperty('--swap-colour', value(data.homePrimaryColour, data.clubPrimaryColour, '#2daaf5'))
    const cover = value(data.homeCoverUrl, data.clubCoverUrl)
    visual.style.setProperty('--swap-cover', cover ? `url("${cover.replace(/"/g, '%22')}")` : 'none')
    const logoUrl = value(data.homeLogoUrl, data.clubLogoUrl, data.clubLogo, data.homeLogo)
    if (logoUrl) { logo.src = logoUrl; logo.classList.add('show') } else { logo.removeAttribute('src'); logo.classList.remove('show') }
    visual.classList.remove('show')
    requestAnimationFrame(() => visual.classList.add('show'))
    hideTimer = setTimeout(() => visual.classList.remove('show'), 4200)
  }

  async function inspect() {
    if (polling) return
    polling = true
    try {
      const response = await fetch(`/api/live-match/clubs/${encodeURIComponent(clubId)}?interchange=${Date.now()}`, { cache: 'no-store', headers: { 'cache-control': 'no-cache', pragma: 'no-cache' } })
      const payload = await response.json()
      if (!response.ok) return
      const data = payload.data || payload
      const event = String(data?.lastEvent || '').trim()
      if (!ready) { lastEvent = event; ready = true; return }
      if (event && event !== lastEvent) {
        const swap = parseSwap(event)
        if (swap) showSwap(swap, data)
      }
      if (event) lastEvent = event
    } catch {
      // Keep the live video unaffected if match-state retrieval fails.
    } finally {
      polling = false
    }
  }

  inspect()
  timer = window.setInterval(inspect, 650)
  window.addEventListener('beforeunload', () => { clearInterval(timer); clearTimeout(hideTimer) })
})()
