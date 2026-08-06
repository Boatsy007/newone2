(() => {
  if (window.__pfMatchDayAiGameContext) return
  window.__pfMatchDayAiGameContext = true

  const previousFetch = window.fetch.bind(window)
  const GAME_PLAN_KEY = 'playfooty.matchday.prep.gameplan'

  function safeJson(value, fallback = null) {
    try { return value ? JSON.parse(value) : fallback } catch { return fallback }
  }

  function clubId() {
    return location.pathname.match(/^\/club-portal\/([^/]+)/)?.[1] || ''
  }

  function kpiKey() {
    return `playfooty.matchday.kpis.v2.${clubId() || 'current'}`
  }

  function savedGamePlan() {
    const prepared = safeJson(localStorage.getItem(GAME_PLAN_KEY), null)
    if (prepared && typeof prepared === 'object') return prepared

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index) || ''
      if (!/game.?plan/i.test(key)) continue
      const value = safeJson(localStorage.getItem(key), null)
      if (value && typeof value === 'object') return value
    }
    return null
  }

  function savedKpis() {
    const exact = safeJson(localStorage.getItem(kpiKey()), null)
    if (exact && typeof exact === 'object') return exact

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index) || ''
      if (!/matchday\.kpis|match.?kpi/i.test(key)) continue
      const value = safeJson(localStorage.getItem(key), null)
      if (value && typeof value === 'object') return value
    }
    return {}
  }

  function normalisePriorities(plan) {
    if (!plan || typeof plan !== 'object') return []
    const candidates = [
      plan.priorities,
      plan.priority,
      plan.focusAreas,
      plan.focus,
      plan.keyFocus,
      plan.keyPriorities,
      plan.teamPriorities,
      plan.selectedPriorities,
    ]
    const values = []
    candidates.forEach(candidate => {
      if (Array.isArray(candidate)) values.push(...candidate)
      else if (typeof candidate === 'string') values.push(...candidate.split(/\n|,|;/))
      else if (candidate && typeof candidate === 'object') {
        Object.entries(candidate).forEach(([key, value]) => {
          if (value === true) values.push(key)
          else if (typeof value === 'string' && value.trim()) values.push(value)
        })
      }
    })
    return [...new Set(values.map(value => String(value).trim()).filter(Boolean))]
  }

  function readableGamePlan(plan) {
    if (!plan || typeof plan !== 'object') return null
    return {
      overview: plan.overview || null,
      teamInstructions: plan.teamInstructions || plan.instructions || null,
      stoppagePlan: plan.stoppagePlan || null,
      kickInPlan: plan.kickInPlan || null,
      quarterTimeReminders: plan.quarterTimeReminders || null,
      structure: plan.structure || plan.teamStructure || plan.style || plan.gameStyle || null,
      ballMovement: plan.ballMovement || plan.movement || null,
      defensivePlan: plan.defensivePlan || plan.defence || null,
      forwardPlan: plan.forwardPlan || plan.attack || null,
      priorities: normalisePriorities(plan),
      raw: plan,
    }
  }

  function currentKpiProgress(targets, snapshot) {
    const quarter = String(snapshot?.quarter || 1)
    const stats = snapshot?.stats?.[quarter]?.home || {}
    const labels = {
      i50: 'Inside 50s',
      clr: 'Clearances',
      r50: 'Rebound 50s',
      one: 'One percenters',
      tkl: 'Tackles',
      opm: 'Marks',
      mrk: 'Marks',
      fa: 'Frees against',
    }
    return Object.entries(targets || {}).map(([key, target]) => ({
      key,
      name: labels[key] || key,
      target: Number(target || 0),
      current: Number(stats?.[key] ?? (key === 'mrk' ? stats?.opm : key === 'opm' ? stats?.mrk : 0) ?? 0),
    }))
  }

  function buildContext(snapshot) {
    const rawPlan = savedGamePlan()
    const gamePlan = readableGamePlan(rawPlan)
    const kpiTargets = savedKpis()
    return {
      gamePlan,
      priorities: gamePlan?.priorities || [],
      kpis: {
        targets: kpiTargets,
        currentQuarterProgress: currentKpiProgress(kpiTargets, snapshot),
      },
      instruction: 'Judge the live match statistics against the coach’s saved game plan, stated priorities and KPI targets. Preserve the intended structure when it appears to be working. Recommend a change only when significant live evidence shows the plan is not producing the intended result. Never claim you can see the structure; say the numbers suggest, it looks like, we might be, or we are probably. Do not invent positioning, match-ups or causes that are not supplied.',
    }
  }

  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : input?.url || ''
    if (!url.includes('/api/ai-assistant-coach') || !init?.body) return previousFetch(input, init)

    try {
      const body = JSON.parse(String(init.body))
      if (!body?.snapshot) return previousFetch(input, init)
      const coachingContext = buildContext(body.snapshot)
      body.snapshot.coachingContext = coachingContext
      body.gamePlan = coachingContext.gamePlan
      body.priorities = coachingContext.priorities
      body.kpis = coachingContext.kpis
      body.contextInstruction = coachingContext.instruction
      return previousFetch(input, { ...init, body: JSON.stringify(body) })
    } catch {
      return previousFetch(input, init)
    }
  }
})()
