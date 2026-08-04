(() => {
  const clubId = new URLSearchParams(location.search).get('clubId') || ''
  const player = document.querySelector('.player')
  if (!clubId || !player) return

  const viewerId = localStorage.getItem('playfooty-live-viewer-id') || ''
  const style = document.createElement('style')
  style.textContent = `
    .pf-presented{position:absolute;left:12px;bottom:12px;z-index:45;display:none;align-items:center;gap:9px;max-width:min(320px,55%);padding:7px 10px;border:1px solid rgba(255,255,255,.22);border-radius:9px;background:rgba(4,10,16,.82);color:#fff;text-decoration:none;box-shadow:0 8px 24px rgba(0,0,0,.38);backdrop-filter:blur(10px)}.pf-presented.show{display:flex}.pf-presented img{width:34px;height:24px;object-fit:contain;background:#fff;border-radius:4px;padding:2px}.pf-presented span{min-width:0;font:800 9px/1.2 Inter,Arial,sans-serif;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pf-presented b{display:block;margin-top:2px;font-size:11px;text-transform:none}
    .pf-sponsor-break{position:absolute;inset:0;z-index:66;display:grid;place-items:center;padding:26px;background:linear-gradient(145deg,rgba(4,10,16,.96),rgba(12,28,40,.96));transform:translateY(105%);opacity:0;pointer-events:none;transition:.42s cubic-bezier(.22,.8,.24,1)}.pf-sponsor-break.show{transform:translateY(0);opacity:1;pointer-events:auto}.pf-sponsor-break-card{width:min(520px,90%);padding:28px;border:1px solid rgba(255,255,255,.2);border-radius:18px;background:rgba(255,255,255,.97);color:#07111c;text-align:center;box-shadow:0 22px 70px rgba(0,0,0,.5)}.pf-sponsor-break small{display:block;color:#49606f;font:1000 10px/1 Inter,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase}.pf-sponsor-break img{display:block;max-width:220px;max-height:90px;margin:18px auto;object-fit:contain}.pf-sponsor-break strong{display:block;font:1000 25px/1.1 Inter,Arial,sans-serif}.pf-sponsor-break a{display:inline-flex;margin-top:16px;padding:10px 15px;border-radius:999px;background:#42b8ff;color:#03131e;text-decoration:none;font:950 11px/1 Inter,Arial,sans-serif;text-transform:uppercase}
    .pf-replay-sponsor{position:absolute;left:14px;top:14px;z-index:2;display:flex;align-items:center;gap:7px;padding:7px 9px;border-radius:8px;background:rgba(4,10,16,.86);color:#fff;font:900 9px/1 Inter,Arial,sans-serif;text-transform:uppercase;box-shadow:0 8px 22px rgba(0,0,0,.4)}.pf-replay-sponsor img{width:30px;height:20px;object-fit:contain;background:#fff;border-radius:3px;padding:2px}
    @media(min-width:700px) and (max-width:1180px){.pf-presented{left:50%;right:auto;top:max(12px,env(safe-area-inset-top));bottom:auto;transform:translateX(-50%);max-width:min(380px,58%);justify-content:center}}
    @media(max-width:600px){.pf-presented{left:7px;bottom:7px;max-width:52%;padding:5px 7px}.pf-presented img{width:28px;height:20px}.pf-presented span{font-size:7px}.pf-presented b{font-size:9px}.pf-sponsor-break-card{padding:20px}.pf-sponsor-break img{max-width:170px;max-height:70px}.pf-sponsor-break strong{font-size:20px}.pf-replay-sponsor{left:8px;top:8px;font-size:7px;padding:5px 7px}}
    @media(prefers-reduced-motion:reduce){.pf-sponsor-break{transition:none}}
  `
  document.head.appendChild(style)

  const presented = document.createElement('a')
  presented.className = 'pf-presented'
  presented.target = '_blank'; presented.rel = 'noopener sponsored'
  player.appendChild(presented)

  const breakOverlay = document.createElement('div')
  breakOverlay.className = 'pf-sponsor-break'
  breakOverlay.innerHTML = '<div class="pf-sponsor-break-card"><small>Quarter break presented by</small><img alt=""><strong></strong><a target="_blank" rel="noopener sponsored">Visit sponsor</a></div>'
  player.appendChild(breakOverlay)

  let sponsors = [], presenting = null, replaySponsor = null, breakSponsor = null, breakTimer = 0, replayBound = false, lastBreakKey = '', directorState = 'LIVE'
  const text = value => String(value || '').toUpperCase()
  const placement = deal => text(`${deal.bannerPosition || ''} ${deal.package || ''} ${deal.tier || ''}`)
  const pick = words => sponsors.find(deal => words.some(word => placement(deal).includes(word))) || null

  async function track(deal, place, eventType) {
    if (!deal?.id || !deal?.sponsor?.id) return
    try {
      await fetch('/api/analytics/event', {
        method:'POST', headers:{'content-type':'application/json'},
        body:JSON.stringify({eventType:eventType === 'CLICK' ? 'SPONSOR_CLICK' : 'SPONSOR_IMPRESSION',entityType:'SPONSOR',entityId:String(deal.sponsor.id),sessionId:viewerId,visitorId:viewerId,path:location.pathname,meta:{clubId,sponsorshipId:String(deal.id),placement:place,broadcast:true}}),
      })
    } catch {}
  }

  function sponsorUrl(deal) { return deal?.ctaUrl || deal?.sponsor?.websiteUrl || '#' }
  function sponsorName(deal) { return deal?.sponsor?.name || 'Club sponsor' }
  function sponsorLogo(deal) { return deal?.sponsor?.logoUrl || '' }

  function showPresented() {
    if (!presenting) return
    const logo = sponsorLogo(presenting)
    presented.href = sponsorUrl(presenting)
    presented.innerHTML = `${logo ? `<img src="${logo.replaceAll('"','%22')}" alt="">` : ''}<span>Broadcast presented by<b>${sponsorName(presenting)}</b></span>`
    presented.onclick = () => track(presenting, 'BROADCAST', 'CLICK')
    if (directorState === 'LIVE' || directorState === 'REPLAY') presented.classList.add('show')
    track(presenting, 'BROADCAST', 'IMPRESSION')
  }

  function showBreak(key = '') {
    const deal = breakSponsor || presenting
    if (!deal || (key && key === lastBreakKey)) return
    if (key) lastBreakKey = key
    const card = breakOverlay.querySelector('.pf-sponsor-break-card')
    const image = card.querySelector('img'), link = card.querySelector('a')
    image.src = sponsorLogo(deal); image.style.display = image.src ? 'block' : 'none'
    card.querySelector('strong').textContent = sponsorName(deal)
    link.href = sponsorUrl(deal); link.textContent = deal.ctaLabel || 'Visit sponsor'
    link.onclick = () => track(deal, 'QUARTER', 'CLICK')
    breakOverlay.classList.add('show'); track(deal, 'QUARTER', 'IMPRESSION')
    clearTimeout(breakTimer); breakTimer = setTimeout(() => breakOverlay.classList.remove('show'), 9000)
  }

  function bindReplaySponsor() {
    const overlay = document.querySelector('.pf-rt-replay, .pf-goal-replay')
    if (!overlay || replayBound || !(replaySponsor || presenting)) return
    replayBound = true
    const deal = replaySponsor || presenting
    const badge = document.createElement('div'); badge.className = 'pf-replay-sponsor'
    const logo = sponsorLogo(deal)
    badge.innerHTML = `${logo ? `<img src="${logo.replaceAll('"','%22')}" alt="">` : ''}<span>Replay presented by ${sponsorName(deal)}</span>`
    overlay.appendChild(badge)
    const observer = new MutationObserver(() => { if (overlay.classList.contains('show')) track(deal, 'REPLAY', 'IMPRESSION') })
    observer.observe(overlay, {attributes:true,attributeFilter:['class']})
  }

  async function loadSponsors() {
    try {
      const response = await fetch(`/api/clubs/${encodeURIComponent(clubId)}/sponsors?broadcast=${Date.now()}`, {cache:'no-store'})
      const payload = await response.json(); if (!response.ok) return
      sponsors = Array.isArray(payload.data) ? payload.data.filter(item => item?.sponsor) : []
      presenting = pick(['BROADCAST','PRESENTING']) || sponsors[0] || null
      replaySponsor = pick(['REPLAY'])
      breakSponsor = pick(['QUARTER','BREAK','HALF TIME','HALFTIME'])
      showPresented(); bindReplaySponsor()
    } catch {}
  }

  document.addEventListener('pf-director-state', event => {
    directorState = String(event.detail?.state || 'LIVE')
    const canShow = directorState === 'LIVE' || directorState === 'REPLAY'
    presented.classList.toggle('show', Boolean(presenting && canShow))
    if (directorState !== 'SPONSOR') breakOverlay.classList.remove('show')
  })
  document.addEventListener('pf-director-request-sponsor', event => {
    showBreak(`director-${event.detail?.quarter || ''}-${Date.now()}`)
  })

  loadSponsors()
  const bindTimer = setInterval(bindReplaySponsor, 250)
  window.addEventListener('beforeunload', () => { clearInterval(bindTimer); clearTimeout(breakTimer) })
})()
