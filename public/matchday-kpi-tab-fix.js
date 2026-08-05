(() => {
  const STYLE_ID = 'pf-matchday-kpi-tab-fix-styles'

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      html body .md .pf-kpi-tab {
        position: static !important;
        inset: auto !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 112px !important;
        min-width: 112px !important;
        max-width: 112px !important;
        height: 48px !important;
        min-height: 48px !important;
        max-height: 48px !important;
        margin: 0 !important;
        padding: 0 16px !important;
        border: 1px solid rgba(255,255,255,.15) !important;
        border-radius: 10px !important;
        background: #d5a112 !important;
        color: #101820 !important;
        box-shadow: none !important;
        font-size: 11px !important;
        font-weight: 950 !important;
        line-height: 1 !important;
        letter-spacing: .6px !important;
        text-transform: uppercase !important;
        writing-mode: horizontal-tb !important;
        transform: none !important;
        white-space: nowrap !important;
        touch-action: manipulation !important;
      }
    `
    document.head.appendChild(style)
  }

  function placeTab() {
    installStyles()
    const board = document.querySelector('.md')
    const tab = board?.querySelector('.pf-kpi-tab')
    if (!board || !tab) return

    const gamePlan = [...board.querySelectorAll('button')].find((button) =>
      button !== tab && button.textContent?.replace(/\s+/g, ' ').trim().toUpperCase().includes('GAME PLAN')
    )

    if (gamePlan?.parentElement) {
      gamePlan.insertAdjacentElement('afterend', tab)
    }
  }

  const observer = new MutationObserver(placeTab)
  observer.observe(document.body, { childList: true, subtree: true })
  document.addEventListener('fullscreenchange', placeTab)
  document.addEventListener('webkitfullscreenchange', placeTab)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', placeTab, { once: true })
  else placeTab()
})()
