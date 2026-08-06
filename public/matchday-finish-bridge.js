(() => {
  const ACTION_SELECTOR = '[data-md-control-action="FINISHMATCH"]'
  const END_MATCH_LABELS = new Set([
    'ENDMATCH',
    'FINISHMATCH',
    'COMPLETEMATCH',
    'FINALISEMATCH',
    'FINALIZEMATCH',
    'ENDGAME',
    'FINISHGAME',
  ])

  const normalise = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')

  const controlLabel = button => normalise([
    button.textContent,
    button.getAttribute('aria-label'),
    button.getAttribute('title'),
  ].filter(Boolean).join(' '))

  const findEndMatchControl = board => {
    const buttons = [...board.querySelectorAll('button')].filter(button =>
      button.dataset.mdMatchControls !== 'true' && button.dataset.mdControlAction !== 'FINISHMATCH',
    )

    return buttons.find(button => END_MATCH_LABELS.has(controlLabel(button))) ||
      buttons.find(button => {
        const label = controlLabel(button)
        return label.includes('ENDMATCH') || label.includes('FINISHMATCH') || label.includes('COMPLETEMATCH')
      })
  }

  const activate = source => {
    const eventOptions = { bubbles: true, cancelable: true }
    try {
      source.dispatchEvent(new PointerEvent('pointerdown', { ...eventOptions, pointerType: 'touch' }))
      source.dispatchEvent(new MouseEvent('mousedown', eventOptions))
      source.dispatchEvent(new PointerEvent('pointerup', { ...eventOptions, pointerType: 'touch' }))
      source.dispatchEvent(new MouseEvent('mouseup', eventOptions))
    } catch {
      // Older Safari can lack PointerEvent support; the native click below still runs.
    }
    source.click()
  }

  const bind = action => {
    if (action.dataset.mdFinishBridgeBound === 'true') return
    action.dataset.mdFinishBridgeBound = 'true'
    action.disabled = false

    action.addEventListener('click', event => {
      const board = action.closest('.md') || document.querySelector('.md')
      if (!board) return

      const source = findEndMatchControl(board)
      if (!source) return

      event.preventDefault()
      event.stopPropagation()
      activate(source)

      const panel = action.closest('#md-match-control-panel')
      if (panel) panel.hidden = true
      const tab = board.querySelector('[data-md-control-tab="true"]')
      if (tab) tab.setAttribute('aria-expanded', 'false')
    })
  }

  const reconcile = () => {
    document.querySelectorAll(ACTION_SELECTOR).forEach(bind)
  }

  const observer = new MutationObserver(reconcile)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  document.addEventListener('DOMContentLoaded', reconcile, { once: true })
  reconcile()
})()
