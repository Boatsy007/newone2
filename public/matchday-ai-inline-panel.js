(() => {
  if (window.__pfMatchDayQuarterReport) return
  window.__pfMatchDayQuarterReport = true

  const originalFetch = window.fetch.bind(window)
  let latestRequest = null
  let busy = false

  const normalise = value => String(value || '').replace(/\s+/g, ' ').trim()

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
    if (document.getElementById('pf-quarter-report-style')) return
    const style = document.createElement('style')
    style.id = 'pf-quarter-report-style'
    style.textContent = `
      .pf-quarter-report-shell{display:block!important;width:100%!important;margin:6px 0 0!important;padding:0!important}
      .pf-quarter-report-button{display:flex!important;align-items:center!important;justify-content:center!important;gap:8px!important;width:100%!important;height:38px!important;border:1px solid rgba(255,255,255,.2)!important;border-radius:9px!important;background:#1099df!important;color:#fff!important;font:inherit!important;font-size:9px!important;font-weight:900!important;letter-spacing:.05em!important;text-transform:uppercase!important}
      .pf-quarter-report-status{display:none!important;margin-top:6px!important;padding:8px 10px!important;border:1px solid rgba(120,210,255,.28)!important;border-radius:8px!important;background:rgba(7,20,31,.82)!important;color:#fff!important;font-size:8px!important;line-height:1.35!important}
      .pf-quarter-report-status.is-visible{display:block!important}
      .pf-quarter-report-stage{display:flex!important;align-items:center!important;gap:7px!important;opacity:.45!important;margin:3px 0!important}
      .pf-quarter-report-stage.is-active{opacity:1!important}
      .pf-quarter-report-dot{width:7px!important;height:7px!important;border-radius:50%!important;background:#19b8ff!important;box-shadow:0 0 8px rgba(25,184,255,.85)!important}
      .pf-quarter-report-modal{position:fixed!important;inset:0!important;z-index:2147483647!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:18px!important;background:rgba(0,8,16,.86)!important}
      .pf-quarter-report-modal[hidden]{display:none!important}
      .pf-quarter-report-card{position:relative!important;max-width:min(92vw,720px)!important;max-height:92vh!important;padding:12px!important;border:1px solid rgba(120,210,255,.45)!important;border-radius:14px!important;background:#071522!important;box-shadow:0 20px 70px rgba(0,0,0,.55)!important}
      .pf-quarter-report-image{display:block!important;max-width:100%!important;max-height:78vh!important;border-radius:10px!important;background:#081522!important}
      .pf-quarter-report-actions{display:flex!important;gap:8px!important;margin-top:10px!important}
      .pf-quarter-report-actions a,.pf-quarter-report-actions button{flex:1!important;height:38px!important;border-radius:8px!important;border:1px solid rgba(255,255,255,.2)!important;color:#fff!important;font:inherit!important;font-size:9px!important;font-weight:900!important;text-transform:uppercase!important;display:flex!important;align-items:center!important;justify-content:center!important;text-decoration:none!important}
      .pf-quarter-report-save{background:#1099df!important}.pf-quarter-report-close{background:#14283a!important}
      @media(max-width:760px){.pf-quarter-report-button{height:34px!important;font-size:8px!important}.pf-quarter-report-card{padding:8px!important}.pf-quarter-report-image{max-height:74vh!important}}
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

  function removeLegacyControls(panel) {
    panel.querySelectorAll('.pf-ai-actions,.pf-inline-ai-shell,.pf-inline-ai-answer').forEach(node => node.remove())
    ;[...panel.querySelectorAll('button')].forEach(button => {
      if (button.closest('.pf-quarter-report-shell')) return
      const text = normalise(button.textContent).toUpperCase()
      if (['ANALYSE','ASK COACH','QTR REPORT','GENERATE REPORT'].includes(text)) {
        const row = button.parentElement
        if (row && row !== panel && [...row.querySelectorAll('button')].length > 1) row.remove()
        else button.remove()
      }
    })
  }

  function getSnapshot() {
    return latestRequest?.body?.snapshot || {}
  }

  function getQuarter(snapshot) {
    return snapshot.quarter || snapshot.currentQuarter || snapshot.period || 1
  }

  function getScore(snapshot, side) {
    const source = side === 'team'
      ? (snapshot.teamScore || snapshot.yourTeamScore || snapshot.score?.team || snapshot.score?.home || {})
      : (snapshot.oppositionScore || snapshot.opponentScore || snapshot.score?.opposition || snapshot.score?.away || {})
    const goals = Number(source.goals ?? source.g ?? 0)
    const behinds = Number(source.behinds ?? source.b ?? 0)
    const total = Number(source.total ?? source.points ?? goals * 6 + behinds)
    return { goals, behinds, total }
  }

  function collectStats(snapshot) {
    const source = snapshot.quarterStats || snapshot.stats || snapshot.teamStats || {}
    const opposition = snapshot.oppositionStats || snapshot.opponentStats || source.opposition || {}
    const team = source.team || source.yourTeam || source
    const keys = [
      ['Inside 50s','inside50s','I50'],
      ['Clearances','clearances','CLR'],
      ['Rebound 50s','rebound50s','R50'],
      ['One percenters','onePercenters','1%'],
      ['Tackles','tackles','TKL'],
      ['Marks','marks','MRK'],
      ['Frees against','freesAgainst','FA'],
    ]
    return keys.map(([label,key,short]) => ({
      label, short,
      team: Number(team?.[key] ?? team?.[short] ?? 0),
      opposition: Number(opposition?.[key] ?? opposition?.[short] ?? 0),
    }))
  }

  function extractNarrative(payload) {
    const analysis = payload?.analysis || {}
    const good = normalise(analysis.whatIsWorking || analysis.strengths || analysis.positive || analysis.headline || payload?.whatIsWorking)
    const improve = normalise(analysis.whatNeedsAttention || analysis.improvements || analysis.recommendation || payload?.recommendation)
    const summary = normalise(analysis.summary || payload?.answer || payload?.message)
    return {
      good: good || summary || 'The available quarter data has been compiled.',
      improve: improve || 'Review the KPI gaps and make the clearest practical adjustment for the next quarter.'
    }
  }

  async function requestReport() {
    if (!latestRequest) throw new Error('Live match data is still loading.')
    const body = {
      ...latestRequest.body,
      mode: 'quarter_report',
      manualRequest: true,
      question: 'Generate a detailed quarter report from the completed quarter only.',
      outputContract: 'Return concise report fields for whatIsWorking, whatNeedsAttention, recommendation and summary. Use score, quarter score differential, KPIs, live stats, game plan, priorities, player scoring, plus/minus, time on ground, interchange and injury data.'
    }
    const response = await originalFetch(latestRequest.url, { ...latestRequest.init, body: JSON.stringify(body) })
    if (!response.ok) throw new Error('The quarter report could not be generated.')
    return response.json()
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 5) {
    const words = normalise(text).split(' ')
    let line = ''
    let lines = 0
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y)
        y += lineHeight
        lines += 1
        line = word
        if (lines >= maxLines) return y
      } else line = test
    }
    if (line && lines < maxLines) ctx.fillText(line, x, y)
    return y + lineHeight
  }

  function createReportImage(payload) {
    const snapshot = getSnapshot()
    const quarter = getQuarter(snapshot)
    const teamScore = getScore(snapshot, 'team')
    const oppScore = getScore(snapshot, 'opposition')
    const differential = teamScore.total - oppScore.total
    const stats = collectStats(snapshot)
    const narrative = extractNarrative(payload)

    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 1600
    const ctx = canvas.getContext('2d')

    const gradient = ctx.createLinearGradient(0,0,1200,1600)
    gradient.addColorStop(0,'#061522')
    gradient.addColorStop(1,'#02080e')
    ctx.fillStyle = gradient
    ctx.fillRect(0,0,1200,1600)

    ctx.strokeStyle = '#19b8ff'
    ctx.lineWidth = 4
    ctx.strokeRect(42,42,1116,1516)

    ctx.fillStyle = '#19b8ff'
    ctx.font = '700 28px Arial'
    ctx.fillText('PLAYFOOTY COACHING',70,95)
    ctx.fillStyle = '#ffffff'
    ctx.font = '900 62px Arial'
    ctx.fillText(`Q${quarter} QUARTER REPORT`,70,165)

    ctx.fillStyle = '#0b2131'
    ctx.fillRect(70,210,1060,190)
    ctx.fillStyle = '#ffffff'
    ctx.font = '800 30px Arial'
    ctx.fillText('YOUR TEAM',110,260)
    ctx.fillText('OPPOSITION',770,260)
    ctx.font = '900 70px Arial'
    ctx.fillText(`${teamScore.goals}.${teamScore.behinds}`,110,340)
    ctx.fillText(`${oppScore.goals}.${oppScore.behinds}`,770,340)
    ctx.font = '700 28px Arial'
    ctx.fillStyle = '#a9bed0'
    ctx.fillText(`${teamScore.total} points`,110,380)
    ctx.fillText(`${oppScore.total} points`,770,380)
    ctx.fillStyle = differential >= 0 ? '#31d67b' : '#ff4257'
    ctx.font = '900 34px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`DIFFERENTIAL ${differential >= 0 ? '+' : ''}${differential}`,600,345)
    ctx.textAlign = 'left'

    ctx.fillStyle = '#ffffff'
    ctx.font = '900 34px Arial'
    ctx.fillText('QUARTER KPIs & STATS',70,465)
    let y = 510
    for (const stat of stats) {
      ctx.fillStyle = '#0b2131'
      ctx.fillRect(70,y,1060,105)
      ctx.fillStyle = '#ffffff'
      ctx.font = '800 28px Arial'
      ctx.fillText(stat.short,100,y+43)
      ctx.font = '500 20px Arial'
      ctx.fillStyle = '#9fb5c5'
      ctx.fillText(stat.label,100,y+76)
      ctx.font = '900 38px Arial'
      ctx.fillStyle = stat.team >= stat.opposition ? '#31d67b' : '#ff4257'
      ctx.fillText(String(stat.team),610,y+62)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(String(stat.opposition),1000,y+62)
      y += 120
    }

    ctx.fillStyle = '#ffffff'
    ctx.font = '900 32px Arial'
    ctx.fillText('WHAT WE ARE DOING WELL',70,1380)
    ctx.fillStyle = '#c8d7e2'
    ctx.font = '500 24px Arial'
    y = wrapText(ctx,narrative.good,70,1425,1060,34,3)

    ctx.fillStyle = '#ffffff'
    ctx.font = '900 32px Arial'
    ctx.fillText('WHAT WE CAN IMPROVE',70,y+18)
    ctx.fillStyle = '#c8d7e2'
    ctx.font = '500 24px Arial'
    wrapText(ctx,narrative.improve,70,y+60,1060,34,3)

    return canvas.toDataURL('image/png')
  }

  function showReportImage(dataUrl) {
    let modal = document.querySelector('.pf-quarter-report-modal')
    if (!(modal instanceof HTMLElement)) {
      modal = document.createElement('div')
      modal.className = 'pf-quarter-report-modal'
      modal.hidden = true
      modal.innerHTML = `
        <div class="pf-quarter-report-card">
          <img class="pf-quarter-report-image" alt="Quarter report">
          <div class="pf-quarter-report-actions">
            <a class="pf-quarter-report-save" download="playfooty-quarter-report.png">Save Image</a>
            <button type="button" class="pf-quarter-report-close">Close</button>
          </div>
        </div>
      `
      document.body.appendChild(modal)
      modal.querySelector('.pf-quarter-report-close')?.addEventListener('click', () => { modal.hidden = true })
      modal.addEventListener('click', event => { if (event.target === modal) modal.hidden = true })
    }
    const image = modal.querySelector('.pf-quarter-report-image')
    const save = modal.querySelector('.pf-quarter-report-save')
    if (image instanceof HTMLImageElement) image.src = dataUrl
    if (save instanceof HTMLAnchorElement) save.href = dataUrl
    modal.hidden = false
  }

  async function generate(panel) {
    if (busy) return
    busy = true
    const button = panel.querySelector('.pf-quarter-report-button')
    const status = panel.querySelector('.pf-quarter-report-status')
    const stages = [...panel.querySelectorAll('.pf-quarter-report-stage')]
    if (button instanceof HTMLButtonElement) button.disabled = true
    if (status instanceof HTMLElement) status.classList.add('is-visible')

    const activate = index => stages.forEach((stage,i) => stage.classList.toggle('is-active',i === index))
    try {
      activate(0)
      await new Promise(resolve => setTimeout(resolve,700))
      activate(1)
      const payloadPromise = requestReport()
      await new Promise(resolve => setTimeout(resolve,700))
      activate(2)
      const payload = await payloadPromise
      const dataUrl = createReportImage(payload)
      showReportImage(dataUrl)
    } catch (error) {
      if (status instanceof HTMLElement) status.innerHTML = `<div>${error instanceof Error ? error.message : 'Unable to generate the quarter report.'}</div>`
    } finally {
      busy = false
      if (button instanceof HTMLButtonElement) button.disabled = false
      setTimeout(() => {
        if (status instanceof HTMLElement) status.classList.remove('is-visible')
        stages.forEach(stage => stage.classList.remove('is-active'))
      },900)
    }
  }

  function mount() {
    ensureStyle()
    const panel = findPanel()
    if (!(panel instanceof HTMLElement)) return
    removeLegacyControls(panel)

    let shell = panel.querySelector('.pf-quarter-report-shell')
    if (!(shell instanceof HTMLElement)) {
      shell = document.createElement('div')
      shell.className = 'pf-quarter-report-shell'
      shell.innerHTML = `
        <button type="button" class="pf-quarter-report-button">▣ Generate Quarter Report</button>
        <div class="pf-quarter-report-status">
          <div class="pf-quarter-report-stage"><span class="pf-quarter-report-dot"></span><span>Collecting data</span></div>
          <div class="pf-quarter-report-stage"><span class="pf-quarter-report-dot"></span><span>Compiling results</span></div>
          <div class="pf-quarter-report-stage"><span class="pf-quarter-report-dot"></span><span>Generating report</span></div>
        </div>
      `
      panel.appendChild(shell)
      shell.querySelector('.pf-quarter-report-button')?.addEventListener('click', () => generate(panel))
    }
  }

  const observer = new MutationObserver(mount)
  observer.observe(document.documentElement,{childList:true,subtree:true})
  window.addEventListener('playfooty:matchday-stats',mount)
  window.setInterval(mount,700)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',mount,{once:true})
  else mount()
})()
