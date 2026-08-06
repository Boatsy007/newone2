(() => {
  if (window.__pfMatchDayInlineAssistant) return
  window.__pfMatchDayInlineAssistant = true

  const originalFetch = window.fetch.bind(window)
  let latestRequest = null
  let busy = false

  function normalise(value) {
    return String(value || '').replace(/\s+/g, ' ').trim()
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
    if (document.getElementById('pf-inline-ai-style')) return
    const style = document.createElement('style')
    style.id = 'pf-inline-ai-style'
    style.textContent = `
      .pf-inline-ai-controls{display:grid!important;grid-template-columns:44px minmax(0,1fr) 96px 108px!important;gap:7px!important;align-items:center!important;margin:8px 10px 10px!important;padding:0!important}
      .pf-inline-ai-controls input{min-width:0!important;width:100%!important;height:34px!important;border:1px solid rgba(120,210,255,.42)!important;border-radius:8px!important;background:rgba(4,18,30,.86)!important;color:#fff!important;padding:0 10px!important;font:inherit!important;font-size:9px!important;outline:none!important}
      .pf-inline-ai-controls input::placeholder{color:rgba(255,255,255,.58)!important}
      .pf-inline-ai-controls button{height:34px!important;border:1px solid rgba(255,255,255,.2)!important;border-radius:8px!important;color:#fff!important;font:inherit!important;font-size:8px!important;font-weight:900!important;letter-spacing:.04em!important;text-transform:uppercase!important;white-space:nowrap!important;padding:0 8px!important}
      .pf-inline-ai-mic{background:#173147!important;font-size:17px!important;padding:0!important}
      .pf-inline-ai-ask{background:#1099df!important}
      .pf-inline-ai-report{background:#132638!important}
      .pf-inline-ai-answer{margin:0 10px 8px!important;padding:9px 11px!important;border:1px solid rgba(120,210,255,.28)!important;border-radius:8px!important;background:rgba(7,20,31,.78)!important;color:#fff!important;font-size:9px!important;line-height:1.35!important}
      .pf-inline-ai-answer[hidden]{display:none!important}
      .pf-inline-ai-working{opacity:.72!important}
      .pf-inline-ai-hidden{display:none!important}
      @media(max-width:760px){.pf-inline-ai-controls{grid-template-columns:40px minmax(0,1fr) 82px 92px!important;gap:5px!important}.pf-inline-ai-controls button{font-size:7px!important}.pf-inline-ai-controls input{font-size:8px!important}}
    `
    document.head.appendChild(style)
  }

  function findPanel() {
    const nodes = [...document.querySelectorAll('.md *')]
    const heading = nodes.find(node => normalise(node.textContent).toUpperCase() === 'AI ASSISTANT COACH') ||
      nodes.find(node => normalise(node.textContent).toUpperCase().includes('AI ASSISTANT COACH'))
    if (!(heading instanceof HTMLElement)) return null

    let panel = heading
    while (panel.parentElement && panel.parentElement.closest('.md')) {
      const text = normalise(panel.textContent).toUpperCase()
      if (text.includes('ASSISTANT READY') || text.includes('LIVE COACHING FEED')) return panel
      panel = panel.parentElement
    }
    return heading.closest('section,article,div')
  }

  function findFeedArea(panel) {
    const ready = [...panel.querySelectorAll('*')].find(node => normalise(node.textContent).toUpperCase() === 'ASSISTANT READY')
    return ready?.parentElement || panel
  }

  function hideOldControls(panel) {
    panel.querySelectorAll('.pf-ai-actions').forEach(node => node.classList.add('pf-inline-ai-hidden'))
    const buttons = [...panel.querySelectorAll('button')]
    buttons.forEach(button => {
      const text = normalise(button.textContent).toUpperCase()
      if (['ANALYSE', 'ASK COACH', 'QTR REPORT'].includes(text) && !button.closest('.pf-inline-ai-controls')) {
        const row = button.parentElement
        if (row && [...row.querySelectorAll('button')].length >= 1) row.classList.add('pf-inline-ai-hidden')
        else button.classList.add('pf-inline-ai-hidden')
      }
    })
  }

  function extractAnswer(payload) {
    return normalise([
      payload?.analysis?.headline,
      payload?.analysis?.recommendation,
      payload?.analysis?.summary,
      payload?.answer,
      payload?.message,
    ].filter(Boolean).join(' ')).replace(/NO_MESSAGE/gi, '').trim() || 'No clear recommendation from the available match data.'
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
          ? 'Return a concise, easy-to-read quarter report using all available score, stats, game plan, priorities, KPIs, player scoring, plus/minus, time on ground, interchange time and injury data.'
          : 'Answer in one or two short, direct and practical coaching sentences.',
      }
      const response = await originalFetch(latestRequest.url, { ...latestRequest.init, body: JSON.stringify(body) })
      if (!response.ok) throw new Error('The assistant could not generate a response.')
      return await response.json()
    } finally {
      busy = false
    }
  }

  async function ask(panel, question, mode = 'manual') {
    const answer = panel.querySelector('.pf-inline-ai-answer')
    if (!(answer instanceof HTMLElement)) return
    answer.hidden = false
    answer.classList.add('pf-inline-ai-working')
    answer.textContent = mode === 'quarter_report' ? 'Generating quarter report…' : 'Assistant Coach is checking the live match…'
    try {
      const payload = await callCoach(mode, question)
      answer.textContent = extractAnswer(payload)
    } catch (error) {
      answer.textContent = error instanceof Error ? error.message : 'Unable to contact Assistant Coach.'
    } finally {
      answer.classList.remove('pf-inline-ai-working')
    }
  }

  function startVoice(panel) {
    const input = panel.querySelector('.pf-inline-ai-input')
    if (!(input instanceof HTMLInputElement)) return
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) {
      const answer = panel.querySelector('.pf-inline-ai-answer')
      if (answer instanceof HTMLElement) {
        answer.hidden = false
        answer.textContent = 'Voice input is not available in this browser. Type your question instead.'
      }
      return
    }
    const recognition = new Recognition()
    recognition.lang = 'en-AU'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = event => {
      input.value = event.results?.[0]?.[0]?.transcript || ''
      input.focus()
    }
    recognition.start()
  }

  function mount() {
    ensureStyle()
    const panel = findPanel()
    if (!(panel instanceof HTMLElement)) return
    hideOldControls(panel)

    let controls = panel.querySelector('.pf-inline-ai-controls')
    if (!(controls instanceof HTMLElement)) {
      controls = document.createElement('div')
      controls.className = 'pf-inline-ai-controls'
      controls.innerHTML = `
        <button type="button" class="pf-inline-ai-mic" aria-label="Speak to Assistant Coach">🎙</button>
        <input class="pf-inline-ai-input" type="text" placeholder="Ask Assistant Coach…" aria-label="Ask Assistant Coach">
        <button type="button" class="pf-inline-ai-ask">Ask Coach</button>
        <button type="button" class="pf-inline-ai-report">QTR Report</button>
      `
      const answer = document.createElement('div')
      answer.className = 'pf-inline-ai-answer'
      answer.hidden = true

      panel.appendChild(answer)
      panel.appendChild(controls)

      const input = controls.querySelector('.pf-inline-ai-input')
      const submit = () => {
        const question = normalise(input?.value)
        if (question) ask(panel, question, 'manual')
      }
      controls.querySelector('.pf-inline-ai-mic')?.addEventListener('click', () => startVoice(panel))
      controls.querySelector('.pf-inline-ai-ask')?.addEventListener('click', submit)
      controls.querySelector('.pf-inline-ai-report')?.addEventListener('click', () => ask(panel, 'Generate the quarter report using all available match information.', 'quarter_report'))
      input?.addEventListener('keydown', event => { if (event.key === 'Enter') submit() })
    }
  }

  const observer = new MutationObserver(mount)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener('playfooty:matchday-stats', mount)
  window.setInterval(mount, 700)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true })
  else mount()
})()
