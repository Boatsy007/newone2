(() => {
  if (window.__pfMatchDayAiSignificanceGate) return
  window.__pfMatchDayAiSignificanceGate = true

  const originalFetch = window.fetch.bind(window)
  const history = new Map()
  const recentMessages = []
  const FIVE_MINUTES = 5 * 60 * 1000

  const POLICY = `You are an AI assistant coach for a community Australian rules football team. Speak like a normal country footy assistant coach: short, direct, practical and conversational. Your default output is exactly NO_MESSAGE. Do not speak because one statistic changes. Only send one or two short sentences when there is a significant, useful and actionable pattern. Before speaking confirm the difference is large enough, has lasted long enough, is supported by more than one statistic, the scoreboard or a genuine rotation issue, gives the coach something useful to do, and is not substantially the same advice sent in the last five minutes. Normal team-stat analysis should wait until five minutes of the quarter, at least eight relevant events, a clearly dominant run, or a real rotation threshold. Starting thresholds: inside 50 gap 5, 70 percent with at least 7 total, four consecutive entries, or plus 6 without scoreboard reward; clearances gap 4 or double with at least 6 total; rebound 50s at least 5 and supporting territory evidence; marks gap 8 or double with at least 12 total; tackles gap 6 and preferably supporting clearances or territory; one percenters gap 5 and supporting another pattern; frees against at least 4 or three in a short period. Scoreboard overrides include three unanswered opposition goals, 18 unanswered points, an 18-point lead reduction, dominance without scoreboard reward, very efficient opposition scoring or repeated missed chances. Prefer combined patterns and send only the highest priority message. A player merely turning orange or green is not a message. Rotation advice requires a green player off at least seven minutes, an unusually long uninterrupted stint, meaningful plus/minus over enough time, or a clearly strong available option. Do not react strongly to plus/minus until about 10 minutes time on ground unless the swing is extreme; normally require plus or minus 12. Do not repeat the same advice for five minutes unless it becomes substantially worse. Output only NO_MESSAGE or one natural coaching message. Never output headings, bullet points, reports, explanations of silence, or phrases such as no significant trends detected.`

  function number(value) {
    const match = String(value ?? '').match(/-?\d+(?:\.\d+)?/)
    return match ? Number(match[0]) : 0
  }

  function elapsedSeconds(clock) {
    const parts = String(clock || '').match(/(\d+):(\d{2})/)
    if (!parts) return 0
    return Number(parts[1]) * 60 + Number(parts[2])
  }

  function currentQuarterStats(snapshot) {
    const quarter = String(snapshot?.quarter || 1)
    return snapshot?.stats?.[quarter] || { home: {}, away: {} }
  }

  function stat(stats, side, key) {
    return number(stats?.[side]?.[key])
  }

  function totalEvents(stats) {
    return ['i50', 'clr', 'r50', 'one', 'tkl', 'opm', 'fa']
      .reduce((sum, key) => sum + stat(stats, 'home', key) + stat(stats, 'away', key), 0)
  }

  function activeCategories(stats, side) {
    return ['i50', 'clr', 'r50', 'one', 'tkl', 'opm', 'fa']
      .filter(key => stat(stats, side, key) > 0).length
  }

  function benchRotations() {
    return [...document.querySelectorAll('.md-bench .md-player')].map(card => {
      const name = card.querySelector('strong')?.textContent?.replace(/\s+/g, ' ').trim() || ''
      const status = card.getAttribute('data-pf-interchange-status') || ''
      const time = card.getAttribute('data-pf-interchange-time') || ''
      const injured = card.getAttribute('data-pf-injured') === 'true'
      return { name, status, interchangeSeconds: elapsedSeconds(time), injured }
    }).filter(player => player.name)
  }

  function scoreRun(snapshot, previous) {
    if (!previous) return { home: 0, away: 0 }
    return {
      home: Math.max(0, number(snapshot?.score?.home?.total) - number(previous?.score?.home?.total)),
      away: Math.max(0, number(snapshot?.score?.away?.total) - number(previous?.score?.away?.total)),
    }
  }

  function gate(snapshot) {
    const stats = currentQuarterStats(snapshot)
    const elapsed = elapsedSeconds(snapshot?.clock)
    const events = totalEvents(stats)
    const key = `${snapshot?.sheetId || 'current'}:${snapshot?.quarter || 1}`
    const previous = history.get(key)
    const run = scoreRun(snapshot, previous)
    history.set(key, snapshot)

    const homeScore = number(snapshot?.score?.home?.total)
    const awayScore = number(snapshot?.score?.away?.total)
    const scoreMargin = homeScore - awayScore
    const oppositionInactive = awayScore === 0 && activeCategories(stats, 'away') === 0
    const narrowTestPattern = oppositionInactive && activeCategories(stats, 'home') <= 2

    if (narrowTestPattern) return { speak: false, reason: 'test-or-one-sided-sample' }

    const scoreboardOverride = run.away >= 18 || run.home >= 18 || Math.abs(scoreMargin) >= 18 && previous && Math.abs(number(previous?.score?.home?.total) - number(previous?.score?.away?.total) - scoreMargin) >= 18
    const enoughSample = elapsed >= 300 || events >= 8 || scoreboardOverride
    if (!enoughSample) return { speak: false, reason: 'minimum-sample' }

    const i50Home = stat(stats, 'home', 'i50'), i50Away = stat(stats, 'away', 'i50')
    const clrHome = stat(stats, 'home', 'clr'), clrAway = stat(stats, 'away', 'clr')
    const r50Home = stat(stats, 'home', 'r50'), r50Away = stat(stats, 'away', 'r50')
    const mrkHome = stat(stats, 'home', 'opm'), mrkAway = stat(stats, 'away', 'opm')
    const tklHome = stat(stats, 'home', 'tkl'), tklAway = stat(stats, 'away', 'tkl')
    const oneHome = stat(stats, 'home', 'one'), oneAway = stat(stats, 'away', 'one')
    const faHome = stat(stats, 'home', 'fa')

    const triggers = []
    if (scoreboardOverride) triggers.push({ priority: 1, pattern: 'scoreboard-run' })
    if ((i50Away - i50Home >= 5 && clrAway - clrHome >= 3) || (clrAway - clrHome >= 4 && i50Away - i50Home >= 3)) triggers.push({ priority: 2, pattern: 'clearance-territory-loss' })
    if (i50Home - i50Away >= 6 && scoreMargin <= 6) triggers.push({ priority: 3, pattern: 'inside-50-dominance-no-score' })
    if (i50Home >= 7 && r50Away >= 5 && scoreMargin <= 6) triggers.push({ priority: 3, pattern: 'entries-coming-out' })
    if (clrHome - clrAway >= 4 && i50Home <= i50Away) triggers.push({ priority: 3, pattern: 'clearances-no-territory' })

    const rotations = benchRotations()
    const overdue = rotations.find(player => player.status === 'green' && player.interchangeSeconds >= 420 && !player.injured)
    if (overdue) triggers.push({ priority: 4, pattern: 'overdue-rotation', player: overdue.name })

    const meaningfulPlayer = [...(snapshot?.players || [])]
      .filter(player => number(player?.onFieldMinutes) >= 10 && Math.abs(number(player?.plusMinus)) >= 12)
      .sort((a, b) => Math.abs(number(b?.plusMinus)) - Math.abs(number(a?.plusMinus)))[0]
    if (meaningfulPlayer) triggers.push({ priority: 5, pattern: 'player-plus-minus', player: meaningfulPlayer.name })
    if (faHome >= 4) triggers.push({ priority: 6, pattern: 'frees-against' })
    if (Math.abs(mrkHome - mrkAway) >= 8 && mrkHome + mrkAway >= 12 && Math.abs(i50Home - i50Away) >= 3) triggers.push({ priority: 7, pattern: 'marks-supporting-territory' })
    if (Math.abs(tklHome - tklAway) >= 6 && (Math.abs(clrHome - clrAway) >= 3 || Math.abs(i50Home - i50Away) >= 3)) triggers.push({ priority: 7, pattern: 'tackles-supporting-pattern' })
    if (Math.abs(oneHome - oneAway) >= 5 && (Math.abs(i50Home - i50Away) >= 3 || Math.abs(r50Home - r50Away) >= 3)) triggers.push({ priority: 7, pattern: 'one-percenters-supporting-pattern' })

    if (!triggers.length) return { speak: false, reason: 'no-significant-pattern' }
    triggers.sort((a, b) => a.priority - b.priority)
    const chosen = triggers[0]
    const recent = recentMessages.find(item => item.pattern === chosen.pattern && Date.now() - item.time < FIVE_MINUTES)
    if (recent) return { speak: false, reason: 'cooldown', pattern: chosen.pattern }
    return { speak: true, pattern: chosen.pattern, player: chosen.player, elapsed, events, rotations }
  }

  function noMessageResponse() {
    return new Response(JSON.stringify({ analysis: { headline: 'NO_MESSAGE', recommendation: '', reason: '', watch: '' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : input?.url || ''
    if (!url.includes('/api/ai-assistant-coach') || !init?.body) return originalFetch(input, init)

    try {
      const body = JSON.parse(String(init.body))
      if (body?.mode !== 'live' || !body?.snapshot) return originalFetch(input, init)
      const decision = gate(body.snapshot)
      if (!decision.speak) return noMessageResponse()

      body.snapshot.quarterElapsedSeconds = decision.elapsed
      body.snapshot.relevantEventCount = decision.events
      body.snapshot.rotationState = decision.rotations
      body.snapshot.significancePattern = decision.pattern
      body.snapshot.significancePolicy = POLICY
      body.significancePolicy = POLICY
      body.outputContract = 'Return exactly NO_MESSAGE or one short natural coaching message.'
      body.recentAdvice = recentMessages.slice(-5)

      const response = await originalFetch(input, { ...init, body: JSON.stringify(body) })
      const clone = response.clone()
      clone.json().then(payload => {
        const text = [payload?.analysis?.headline, payload?.analysis?.recommendation, payload?.analysis?.summary].filter(Boolean).join(' ').trim()
        if (text && text !== 'NO_MESSAGE') recentMessages.push({ pattern: decision.pattern, text, time: Date.now() })
        while (recentMessages.length > 12) recentMessages.shift()
      }).catch(() => {})
      return response
    } catch {
      return originalFetch(input, init)
    }
  }

  function cleanFeed() {
    document.querySelectorAll('.md-ai-message').forEach(message => {
      const text = message.textContent?.replace(/\s+/g, ' ').trim() || ''
      if (/NO_MESSAGE/i.test(text)) message.remove()
    })

    const messages = [...document.querySelectorAll('.md-ai-message')]
    const seen = new Map()
    messages.forEach(message => {
      const paragraphs = [...message.querySelectorAll('p')].map(node => node.textContent?.trim()).filter(Boolean).join(' ').toLowerCase()
      if (!paragraphs) return
      const signature = paragraphs.replace(/\b\d+\b/g, '#').replace(/[^a-z# ]/g, '').replace(/\s+/g, ' ').trim()
      const previous = seen.get(signature)
      if (previous) message.remove()
      else seen.set(signature, message)
    })
  }

  const observer = new MutationObserver(cleanFeed)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.setInterval(cleanFeed, 2000)
})()
