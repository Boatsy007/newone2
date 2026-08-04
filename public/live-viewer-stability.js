(() => {
  const clubId = new URLSearchParams(location.search).get('clubId') || ''
  const playerShell = document.querySelector('.player')
  const score = document.querySelector('.score')
  const liveVideo = document.getElementById('player')
  if (!clubId || !playerShell || !(liveVideo instanceof HTMLVideoElement)) return

  const style = document.createElement('style')
  style.textContent = `
    .player>.score,.player .score.pf-score-overlay{position:absolute!important;left:50%!important;bottom:12px!important;transform:translateX(-50%)!important;z-index:9!important;width:min(620px,calc(100% - 28px))!important;margin:0!important;pointer-events:none!important}
    .player>.score .team,.player>.score .centre{pointer-events:auto}
    .pf-goal-fallback{position:absolute;inset:0;z-index:14;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at center,rgba(22,63,88,.95),rgba(3,8,13,.97));color:#fff;text-align:center;opacity:0;transform:scale(1.04);pointer-events:none;transition:opacity .22s ease,transform .28s ease}
    .pf-goal-fallback.show{opacity:1;transform:scale(1)}.pf-goal-fallback small{display:block;color:#78ceff;font:1000 11px/1 Inter,Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase}.pf-goal-fallback strong{display:block;margin-top:10px;font:1000 clamp(58px,12vw,126px)/.84 Impact,'Arial Narrow Bold',sans-serif;text-transform:uppercase}.pf-goal-fallback span{display:block;margin-top:14px;font:900 clamp(15px,3vw,24px)/1.2 Inter,Arial,sans-serif}
    @media(max-width:700px){.player>.score,.player .score.pf-score-overlay{bottom:7px!important;width:calc(100% - 14px)!important}.pf-goal-fallback{padding:14px}}
    @media(prefers-reduced-motion:reduce){.pf-goal-fallback{transition:none}}
  `
  document.head.appendChild(style)

  if (score && score.parentElement !== playerShell) {
    score.classList.add('pf-score-overlay')
    playerShell.appendChild(score)
  }

  const fallback = document.createElement('div')
  fallback.className = 'pf-goal-fallback'
  fallback.innerHTML = '<div><small>PlayFooty Live</small><strong>Goal</strong><span></span></div>'
  playerShell.appendChild(fallback)

  let replayActive = false
  let lastMatch = null
  let matchTimer = 0
  let latencyTimer = 0
  let fallbackTimer = 0

  function liveEdge() {
    try {
      if (!liveVideo.seekable.length) return null
      return liveVideo.seekable.end(liveVideo.seekable.length - 1)
    } catch { return null }
  }

  function returnToLive() {
    replayActive = false
    const edge = liveEdge()
    try {
      if (edge != null && Number.isFinite(edge)) liveVideo.currentTime = Math.max(0, edge - 0.8)
      liveVideo.playbackRate = 1
      const result = liveVideo.play()
      if (result?.catch) result.catch(() => {})
    } catch {}
  }

  function keepNearLiveEdge() {
    if (replayActive || liveVideo.paused || liveVideo.hidden) return
    const edge = liveEdge()
    if (edge == null || !Number.isFinite(edge) || !Number.isFinite(liveVideo.currentTime)) return
    const lag = edge - liveVideo.currentTime
    try {
      if (lag > 7) {
        liveVideo.currentTime = Math.max(0, edge - 0.8)
        liveVideo.playbackRate = 1
      } else if (lag > 3.5) {
        liveVideo.playbackRate = 1.08
      } else if (lag < 1.8) {
        liveVideo.playbackRate = 1
      }
    } catch {}
  }

  function bindReplay() {
    const overlay = document.querySelector('.pf-goal-replay')
    const replayVideo = overlay?.querySelector('video')
    if (!(overlay instanceof HTMLElement) || !(replayVideo instanceof HTMLVideoElement) || replayVideo.dataset.stabilityBound === '1') return
    replayVideo.dataset.stabilityBound = '1'
    replayVideo.preload = 'auto'

    const startReplay = () => {
      replayActive = true
      try { liveVideo.pause(); liveVideo.playbackRate = 1 } catch {}
    }
    replayVideo.addEventListener('playing', startReplay)
    replayVideo.addEventListener('ended', returnToLive)
    replayVideo.addEventListener('error', returnToLive)
    replayVideo.addEventListener('abort', returnToLive)

    const observer = new MutationObserver(() => {
      if (!overlay.classList.contains('show') && replayActive) returnToLive()
    })
    observer.observe(overlay, { attributes:true, attributeFilter:['class'] })
  }

  const nativePlay = HTMLMediaElement.prototype.play
  if (!window.__playFootyReplaySafePlay) {
    window.__playFootyReplaySafePlay = true
    HTMLMediaElement.prototype.play = function (...args) {
      if (!(this instanceof HTMLVideoElement) || !this.closest?.('.pf-goal-replay') || this.readyState >= 3) return nativePlay.apply(this, args)
      return new Promise((resolve, reject) => {
        let settled = false
        const finish = () => {
          if (settled) return
          settled = true
          clearTimeout(timeout)
          this.removeEventListener('canplay', finish)
          this.removeEventListener('error', fail)
          nativePlay.apply(this, args).then(resolve).catch(reject)
        }
        const fail = () => {
          if (settled) return
          settled = true
          clearTimeout(timeout)
          this.removeEventListener('canplay', finish)
          this.removeEventListener('error', fail)
          reject(new Error('Replay could not be loaded'))
        }
        const timeout = setTimeout(fail, 10000)
        this.addEventListener('canplay', finish, { once:true })
        this.addEventListener('error', fail, { once:true })
        try { this.load() } catch {}
      })
    }
  }

  function showGoalFallback(label) {
    clearTimeout(fallbackTimer)
    fallback.querySelector('span').textContent = label || 'Score updated'
    fallback.classList.add('show')
    fallbackTimer = setTimeout(() => fallback.classList.remove('show'), 2200)
  }

  function processMatch(data) {
    if (!data) return
    const current = {
      homeGoals:Number(data.homeGoals)||0,
      awayGoals:Number(data.awayGoals)||0,
      homeName:String(data.clubName||'Home'),
      awayName:String(data.opponentName||'Away'),
      lastEvent:String(data.lastEvent||''),
    }
    if (!lastMatch) { lastMatch = current; return }
    const homeGoal = current.homeGoals > lastMatch.homeGoals
    const awayGoal = current.awayGoals > lastMatch.awayGoals
    if (homeGoal || awayGoal) {
      const label = current.lastEvent || (homeGoal ? current.homeName : current.awayName)
      setTimeout(() => {
        const director = document.querySelector('.pf-director-overlay.show')
        if (!director) showGoalFallback(label)
      }, 900)
    }
    lastMatch = current
  }

  async function pollMatch() {
    try {
      const response = await fetch(`/api/live-match/clubs/${encodeURIComponent(clubId)}?viewerStability=${Date.now()}`, { cache:'no-store', headers:{'cache-control':'no-cache'} })
      const payload = await response.json()
      if (response.ok) processMatch(payload.data || payload)
    } catch {}
  }

  const domObserver = new MutationObserver(() => bindReplay())
  domObserver.observe(playerShell, { childList:true, subtree:true })
  bindReplay(); pollMatch(); keepNearLiveEdge()
  matchTimer = setInterval(pollMatch, 700)
  latencyTimer = setInterval(keepNearLiveEdge, 1200)
  liveVideo.addEventListener('playing', keepNearLiveEdge)
  liveVideo.addEventListener('progress', keepNearLiveEdge)
  window.addEventListener('beforeunload', () => {
    clearInterval(matchTimer); clearInterval(latencyTimer); clearTimeout(fallbackTimer); domObserver.disconnect()
  })
})()
