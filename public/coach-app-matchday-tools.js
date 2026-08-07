(() => {
  const CARD_ID = 'coach-app-matchday-tools'
  const STYLE_ID = 'coach-app-matchday-tools-styles'

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      .camd .camd-tools-card {
        width: min(100%, 1000px);
        margin: 8px auto 0;
        padding: 7px;
        border: 1px solid #253b49;
        border-radius: 12px;
        background: #0a1721;
        box-shadow: 0 8px 22px rgba(0,0,0,.22);
      }
      .camd .camd-tools-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 7px;
      }
      .camd .camd-tool-button {
        min-height: 46px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        border: 1px solid rgba(255,255,255,.16);
        border-radius: 9px;
        padding: 8px 10px;
        color: #fff;
        font-family: Barlow, Inter, Arial, sans-serif;
        font-size: 12px;
        font-weight: 950;
        letter-spacing: .025em;
        text-transform: uppercase;
        box-shadow: 0 4px 0 rgba(0,0,0,.34);
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        transition: transform .09s ease, box-shadow .09s ease, filter .09s ease;
      }
      .camd .camd-tool-button:active {
        transform: translateY(4px) scale(.98);
        box-shadow: 0 0 0 rgba(0,0,0,0);
        filter: brightness(.91);
      }
      .camd .camd-tool-button.whiteboard { background: #233c4d; }
      .camd .camd-tool-button.game-plan { background: #058ec6; }
      .camd .camd-tool-button.kpis { background: #d18a05; color: #101419; }
      .camd .camd-tool-icon {
        font-size: 17px;
        line-height: 1;
      }
      @media (orientation: landscape) and (min-width: 900px) {
        .camd .camd-oval {
          height: calc(100% - 151px) !important;
          min-height: 365px !important;
        }
        .camd .camd-interchange {
          height: 72px !important;
        }
        .camd .camd-tools-card {
          margin-top: 4px;
          padding: 4px;
        }
        .camd .camd-tools-grid { gap: 5px; }
        .camd .camd-tool-button {
          min-height: 39px;
          padding: 5px 8px;
          font-size: 10px;
        }
        .camd .camd-tool-icon { font-size: 14px; }
      }
      @media (orientation: portrait) and (max-width: 900px) {
        .camd .camd-tools-card { margin-top: 7px; }
        .camd .camd-tool-button {
          min-height: 48px;
          font-size: 11px;
        }
      }
    `
    document.head.appendChild(style)
  }

  function makeButton(label, className, icon) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `camd-tool-button ${className}`
    button.setAttribute('aria-label', `${label} — coming later`)
    button.innerHTML = `<span class="camd-tool-icon" aria-hidden="true">${icon}</span><span>${label}</span>`
    button.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
    })
    return button
  }

  function installCard() {
    if (!location.pathname.startsWith('/coach-app')) return
    installStyles()
    const interchange = document.querySelector('.camd .camd-interchange')
    if (!(interchange instanceof HTMLElement)) return
    if (document.getElementById(CARD_ID)) return

    const card = document.createElement('section')
    card.id = CARD_ID
    card.className = 'camd-tools-card'
    card.setAttribute('aria-label', 'Match Day coaching tools')

    const grid = document.createElement('div')
    grid.className = 'camd-tools-grid'
    grid.append(
      makeButton('Whiteboard', 'whiteboard', '✎'),
      makeButton('Game Plan', 'game-plan', '●'),
      makeButton('KPIs', 'kpis', '▦'),
    )
    card.appendChild(grid)
    interchange.insertAdjacentElement('afterend', card)
  }

  const observer = new MutationObserver(installCard)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener('pageshow', installCard)
  window.addEventListener('popstate', installCard)
  window.setInterval(installCard, 1200)
  installCard()
})()
