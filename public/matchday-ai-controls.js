(() => {
  if (window.__pfMatchDayAiControls) return
  window.__pfMatchDayAiControls = true

  const originalFetch = window.fetch.bind(window)
  let latestRequest = null
  let busy = false

  const STYLE_ID = 'pf-matchday-ai-controls-style'
  const MODAL_ID = 'pf-matchday-ai-modal'

  function normalise(value) {
    return String(value || '').replace(/\s+/g, ' ').trim()
  }

  function number(value) {
    const match = String(value ?? '').match(/-?\d+(?:\.\d+)?/)
    return match ? Number(match[0]) : 0
  }

  function scoreText(score) {
    const goals = number(score?.goals)
    const behinds = number(score?.behinds)
    const total = number(score?.total)
    return `${goals}.${behinds} (${total})`
  }

  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : input?.url || ''
    if (url.includes('/api/ai-assistant-coach') && init?.body) {
      try {
        const body = JSON.parse(String(init.body))
        if (body?.snapshot) latestRequest = { url, init: { ...init }, body }
      } catch {}
    }
    return originalFetch(input, init)
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      .pf-ai-actions{display:grid!important;grid-template-columns:1fr 1fr 1.15fr!important;gap:6px!important;margin:8px 10px 10px!important}
      .pf-ai-actions button{min-width:0!important;height:32px!important;padding:0 7px!important;border:1px solid rgba(255,255,255,.2)!important;border-radius:8px!important;background:#122638!important;color:#fff!important;font:inherit!important;font-size:8px!important;font-weight:900!important;letter-spacing:.035em!important;text-transform:uppercase!important;white-space:nowrap!important}
      .pf-ai-actions button:last-child{background:#168ed4!important}
      .pf-ai-actions button:disabled{opacity:.45!important}
      #${MODAL_ID}{position:fixed!important;inset:0!important;z-index:2147483600!important;display:grid!important;place-items:center!important;padding:18px!important;background:rgba(3,10,17,.78)!important;backdrop-filter:blur(7px)!important;-webkit-backdrop-filter:blur(7px)!important}
      #${MODAL_ID}[hidden]{display:none!important}
      #${MODAL_ID} *{box-sizing:border-box!important}
      .pf-ai-card{width:min(720px,calc(100vw - 36px))!important;max-height:calc(100dvh - 36px)!important;overflow:auto!important;border:1px solid rgba(255,255,255,.16)!important;border-radius:18px!important;background:#f6f7f7!important;color:#0d1821!important;box-shadow:0 24px 70px rgba(0,0,0,.45)!important}
      .pf-ai-head{position:sticky!important;top:0!important;z-index:2!important;display:flex!important;align-items:center!important;justify-content:space-between!important;padding:16px 18px!important;background:#0b1722!important;color:#fff!important}
      .pf-ai-head strong{font-family:'Bebas Neue',Impact,sans-serif!important;font-size:27px!important;letter-spacing:.02em!important}
      .pf-ai-head button{width:38px!important;height:38px!important;border:0!important;border-radius:10px!important;background:rgba(255,255,255,.12)!important;color:#fff!important;font-size:24px!important}
      .pf-ai-body{padding:18px!important}
      .pf-ai-quick{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important;margin-bottom:12px!important}
      .pf-ai-quick button,.pf-ai-submit,.pf-ai-report-actions button{min-height:42px!important;border:0!important;border-radius:10px!important;background:#168ed4!important;color:#fff!important;font:inherit!important;font-size:12px!important;font-weight:900!important;padding:9px 12px!important}
      .pf-ai-ask-row{display:grid!important;grid-template-columns:1fr 46px 92px!important;gap:8px!important}
      .pf-ai-ask-row input{width:100%!important;min-height:46px!important;border:1px solid #ccd4da!important;border-radius:10px!important;padding:0 13px!important;font:inherit!important;font-size:14px!important;background:#fff!important;color:#111!important}
      .pf-ai-mic{border:0!important;border-radius:10px!important;background:#162b3d!important;color:#fff!important;font-size:20px!important}
      .pf-ai-answer{margin-top:16px!important;padding:15px!important;border-radius:12px!important;background:#fff!important;border:1px solid #dce2e6!important;font-size:15px!important;line-height:1.45!important}
      .pf-ai-report-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:12px!important}
      .pf-ai-section{padding:14px!important;border:1px solid #dce2e6!important;border-radius:12px!important;background:#fff!important}
      .pf-ai-section h3{margin:0 0 8px!important;font-size:11px!important;letter-spacing:.12em!important;text-transform:uppercase!important;color:#168ed4!important}
      .pf-ai-section p{margin:0!important;font-size:14px!important;line-height:1.42!important}
      .pf-ai-score{grid-column:1/-1!important;display:flex!important;justify-content:space-between!important;gap:16px!important;padding:15px 18px!important;border-radius:12px!important;background:#0b1722!important;color:#fff!important}
      .pf-ai-score strong{font-size:20px!important}
      .pf-ai-kpis{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important}
      .pf-ai-kpi{padding:10px!important;border-radius:10px!important;background:#edf2f5!important;text-align:center!important}
      .pf-ai-kpi b{display:block!important;font-size:18px!important}
      .pf-ai-kpi small{font-size:9px!important;text-transform:uppercase!important}
      .pf-ai-report-actions{display:flex!important;gap:8px!important;margin-top:14px!important}
      .pf-ai-loading{display:flex!important;align-items:center!important;gap:10px!important;color:#64717b!important}
      .pf-ai-loading::before{content:'';width:18px;height:18px;border:3px solid #c9e9f8;border-top-color:#168ed4;border-radius:50%;animation:pfAiSpin .8s linear infinite}
      @keyframes pfAiSpin{to{transform:rotate(360deg)}}
      @media(max-width:700px){.pf-ai-report-grid{grid-template-columns:1fr!important}.pf-ai-score{grid-column:auto!important}.pf-ai-quick{grid-template-columns:1fr!important}.pf-ai-ask-row{grid-template-columns:1fr 46px!important}.pf-ai-submit{grid-column:1/-1!important}.pf-ai-kpis{grid-template-columns:1fr 1fr!important}}
    `
    document.head.appendChild(style)
  }

  function getModal() {
    ensureStyle()
    let modal = document.getElementById(MODAL_ID)
    if (modal) return modal
    modal = document.createElement('div')
    modal.id = MODAL_ID
    modal.hidden = true
    document.documentElement.appendChild(modal)
    return modal
  }

  function closeModal() {
    const modal = document.getElementById(MODAL_ID)
    if (modal) modal.hidden = true
  }

  function currentSnapshot() {
    return latestRequest?.body?.snapshot || null
  }

  async function callCoach(mode, question) {
    if (!latestRequest || busy) throw new Error('Live match data is still loading.')
    busy = true
    try {
      const body = {
        ...latestRequest.body,
        mode,
        question,
        manualRequest: true,
        outputContract: mode === 'quarter_report'
          ? 'Return a concise quarter report with summary, working, concern, adjustment and playerNotes.'
          : 'Answer the coach in one or two short, direct and practical sentences.',
      }
      const response = await originalFetch(latestRequest.url, { ...latestRequest.init, body: JSON.stringify(body) })
      if (!response.ok) throw new Error('The assistant could not generate a response.')
      return await response.json()
    } finally {
      busy = false
    }
  }

  function extractAnswer(payload) {
    return normalise([
      payload?.analysis?.headline,
      payload?.analysis?.recommendation,
      payload?.analysis?.summary,
      payload?.answer,
      payload?.message,
    ].filter(Boolean).join(' ')).replace(/NO_MESSAGE/gi, '').trim() || 'I could not find a clear answer from the available match data.'
  }

  function openAsk(prefill = '') {
    const modal = getModal()
    modal.hidden = false
    modal.innerHTML = `
      <section class="pf-ai-card" role="dialog" aria-modal="true" aria-label="Ask Assistant Coach">
        <header class="pf-ai-head"><strong>ASK ASSISTANT COACH</strong><button type="button" data-close>×</button></header>
        <div class="pf-ai-body">
          <div class="pf-ai-quick">
            <button type="button" data-question="What's hurting us most right now?">WHAT'S HURTING US?</button>
            <button type="button" data-question="What should I change right now?">WHAT SHOULD I CHANGE?</button>
            <button type="button" data-question="Who should come on next and why?">WHO SHOULD COME ON?</button>
          </div>
          <div class="pf-ai-ask-row">
            <input type="text" value="${prefill.replace(/"/g, '&quot;')}" placeholder="Ask Assistant Coach…" aria-label="Question for Assistant Coach">
            <button type="button" class="pf-ai-mic" aria-label="Speak question">🎙</button>
            <button type="button" class="pf-ai-submit">ASK COACH</button>
          </div>
          <div class="pf-ai-answer" hidden></div>
        </div>
      </section>`

    modal.querySelector('[data-close]')?.addEventListener('click', closeModal)
    modal.addEventListener('click', event => { if (event.target === modal) closeModal() }, { once: true })
    const input = modal.querySelector('input')
    const answer = modal.querySelector('.pf-ai-answer')
    modal.querySelectorAll('[data-question]').forEach(button => button.addEventListener('click', () => {
      input.value = button.dataset.question || ''
      input.focus()
    }))

    const ask = async () => {
      const question = normalise(input.value)
      if (!question) return
      answer.hidden = false
      answer.className = 'pf-ai-answer pf-ai-loading'
      answer.textContent = 'Assistant Coach is checking the live match…'
      try {
        const payload = await callCoach('manual', question)
        answer.className = 'pf-ai-answer'
        answer.textContent = extractAnswer(payload)
      } catch (error) {
        answer.className = 'pf-ai-answer'
        answer.textContent = error instanceof Error ? error.message : 'Unable to contact Assistant Coach.'
      }
    }

    modal.querySelector('.pf-ai-submit')?.addEventListener('click', ask)
    input?.addEventListener('keydown', event => { if (event.key === 'Enter') ask() })
    modal.querySelector('.pf-ai-mic')?.addEventListener('click', () => {
      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!Recognition) {
        answer.hidden = false
        answer.textContent = 'Voice input is not available in this browser. You can type the question instead.'
        return
      }
      const recognition = new Recognition()
      recognition.lang = 'en-AU'
      recognition.interimResults = false
      recognition.maxAlternatives = 1
      recognition.onresult = event => { input.value = event.results?.[0]?.[0]?.transcript || ''; input.focus() }
      recognition.start()
    })
    input?.focus()
  }

  function fallbackReport(snapshot) {
    const q = number(snapshot?.quarter) || 1
    const stats = snapshot?.stats?.[String(q)] || { home: {}, away: {} }
    const h = stats.home || {}, a = stats.away || {}
    const i50 = [number(h.i50), number(a.i50)]
    const clr = [number(h.clr), number(a.clr)]
    const mrk = [number(h.mrk ?? h.opm), number(a.mrk ?? a.opm)]
    const margin = number(snapshot?.score?.home?.total) - number(snapshot?.score?.away?.total)
    const territory = i50[0] - i50[1]
    const summary = territory >= 5 ? 'We controlled territory for most of the quarter.' : territory <= -5 ? 'The opposition controlled territory and kept us defending.' : 'The territory battle was fairly even.'
    const concern = margin < 0 && territory > 0 ? 'We are getting enough entries but are not turning them into scoreboard reward.' : clr[0] < clr[1] ? 'We need to improve our first possession and clearance work.' : 'Keep watching how efficiently each side uses its inside 50s.'
    return { quarter:q, summary, working: territory > 0 ? 'Our ball movement is generating forward entries.' : 'Our defensive group is continuing to compete.', concern, adjustment: clr[0] < clr[1] ? 'Tighten the stoppage setup and prioritise the first clean possession.' : 'Keep the structure, but sharpen the next action after winning the ball.', kpis:[['Inside 50s',...i50],['Clearances',...clr],['Marks',...mrk]], playerNotes:'Use the live TOG, interchange time, scoring and plus/minus numbers to choose the next rotation.' }
  }

  async function openQuarterReport() {
    const modal = getModal()
    const snapshot = currentSnapshot()
    modal.hidden = false
    modal.innerHTML = `<section class="pf-ai-card" role="dialog" aria-modal="true"><header class="pf-ai-head"><strong>QUARTER REPORT</strong><button type="button" data-close>×</button></header><div class="pf-ai-body"><div class="pf-ai-loading">Generating the quarter report from all available match data…</div></div></section>`
    modal.querySelector('[data-close]')?.addEventListener('click', closeModal)
    try {
      const payload = await callCoach('quarter_report', 'Generate the completed quarter report using score, quarter statistics, game plan, priorities, KPIs, player scoring, plus/minus, time on ground, interchange time and injuries.')
      const fallback = fallbackReport(snapshot)
      const analysis = payload?.analysis || payload?.report || {}
      const report = {
        ...fallback,
        summary: normalise(analysis.summary || analysis.headline) || fallback.summary,
        working: normalise(analysis.working || analysis.whatWorked) || fallback.working,
        concern: normalise(analysis.concern || analysis.needsAttention || analysis.reason) || fallback.concern,
        adjustment: normalise(analysis.adjustment || analysis.recommendation) || fallback.adjustment,
        playerNotes: normalise(analysis.playerNotes || analysis.watch) || fallback.playerNotes,
      }
      renderReport(modal, snapshot, report)
    } catch {
      renderReport(modal, snapshot, fallbackReport(snapshot))
    }
  }

  function renderReport(modal, snapshot, report) {
    const title = `Q${report.quarter} REPORT`
    modal.innerHTML = `
      <section class="pf-ai-card" role="dialog" aria-modal="true" aria-label="${title}">
        <header class="pf-ai-head"><strong>${title}</strong><button type="button" data-close>×</button></header>
        <div class="pf-ai-body">
          <div class="pf-ai-report-grid">
            <div class="pf-ai-score"><div><small>YOUR TEAM</small><br><strong>${scoreText(snapshot?.score?.home)}</strong></div><div style="text-align:right"><small>OPPOSITION</small><br><strong>${scoreText(snapshot?.score?.away)}</strong></div></div>
            <section class="pf-ai-section"><h3>What happened</h3><p>${report.summary}</p></section>
            <section class="pf-ai-section"><h3>Recommended adjustment</h3><p>${report.adjustment}</p></section>
            <section class="pf-ai-section"><h3>What is working</h3><p>${report.working}</p></section>
            <section class="pf-ai-section"><h3>What needs attention</h3><p>${report.concern}</p></section>
            <section class="pf-ai-section" style="grid-column:1/-1"><h3>Key numbers</h3><div class="pf-ai-kpis">${report.kpis.map(item => `<div class="pf-ai-kpi"><b>${item[1]}–${item[2]}</b><small>${item[0]}</small></div>`).join('')}</div></section>
            <section class="pf-ai-section" style="grid-column:1/-1"><h3>Player and rotation notes</h3><p>${report.playerNotes}</p></section>
          </div>
          <div class="pf-ai-report-actions"><button type="button" data-ask>ASK ABOUT THIS QUARTER</button><button type="button" data-share>SHARE REPORT</button></div>
        </div>
      </section>`
    modal.querySelector('[data-close]')?.addEventListener('click', closeModal)
    modal.querySelector('[data-ask]')?.addEventListener('click', () => openAsk(`Looking at the Q${report.quarter} report, `))
    modal.querySelector('[data-share]')?.addEventListener('click', async () => {
      const text = `${title}\n${scoreText(snapshot?.score?.home)} – ${scoreText(snapshot?.score?.away)}\n${report.summary}\nAdjustment: ${report.adjustment}`
      try {
        if (navigator.share) await navigator.share({ title, text })
        else { await navigator.clipboard.writeText(text); alert('Quarter report copied.') }
      } catch {}
    })
  }

  async function analyseNow(button) {
    if (busy) return
    button.disabled = true
    const previous = button.textContent
    button.textContent = 'CHECKING…'
    try {
      const payload = await callCoach('manual', 'What is the single most important live coaching message right now? Use all available match data and be direct.')
      openAsk('')
      const modal = getModal()
      const answer = modal.querySelector('.pf-ai-answer')
      if (answer) { answer.hidden = false; answer.textContent = extractAnswer(payload) }
    } catch (error) {
      openAsk('')
      const answer = getModal().querySelector('.pf-ai-answer')
      if (answer) { answer.hidden = false; answer.textContent = error instanceof Error ? error.message : 'Unable to analyse the match.' }
    } finally {
      button.disabled = false
      button.textContent = previous
    }
  }

  function installControls() {
    ensureStyle()
    const panel = document.querySelector('.md-ai-coach-placeholder')
    if (!(panel instanceof HTMLElement) || panel.querySelector('.pf-ai-actions')) return
    const actions = document.createElement('div')
    actions.className = 'pf-ai-actions'
    actions.innerHTML = '<button type="button" data-ask>ASK COACH</button><button type="button" data-analyse>ANALYSE</button><button type="button" data-report>QTR REPORT</button>'
    panel.appendChild(actions)
    actions.querySelector('[data-ask]')?.addEventListener('click', () => openAsk())
    actions.querySelector('[data-analyse]')?.addEventListener('click', event => analyseNow(event.currentTarget))
    actions.querySelector('[data-report]')?.addEventListener('click', openQuarterReport)
  }

  const observer = new MutationObserver(installControls)
  observer.observe(document.documentElement, { childList:true, subtree:true })
  window.addEventListener('playfooty:matchday-stats', installControls)
  window.setInterval(installControls, 1000)
  installControls()
})()
