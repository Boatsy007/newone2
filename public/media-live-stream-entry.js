(() => {
  const ENTRY_ID = 'playfooty-media-live-stream-entry'

  function currentClubId() {
    const match = window.location.pathname.match(/^\/club-portal\/([^/]+)\/media\/?$/)
    return match?.[1] ? decodeURIComponent(match[1]) : ''
  }

  function createEntry(clubId) {
    const link = document.createElement('a')
    link.id = ENTRY_ID
    link.className = 'pf-media-stream-entry'
    link.href = `/live-stream-broadcast-v2.html?clubId=${encodeURIComponent(clubId)}`
    link.setAttribute('aria-label', 'Open Live Broadcast Studio')
    link.innerHTML = `
      <span class="pf-media-stream-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m16 13 5 3V8l-5 3z"></path>
          <rect width="13" height="14" x="3" y="5" rx="2" ry="2"></rect>
        </svg>
      </span>
      <strong>Live Broadcast Studio</strong>
      <span class="pf-media-stream-copy">Film from a phone with the live scoreboard, team branding and automatic score, quarter-time and interchange graphics.</span>
      <b>Stage 3</b>
    `
    return link
  }

  function ensureStyles() {
    if (document.getElementById(`${ENTRY_ID}-styles`)) return
    const style = document.createElement('style')
    style.id = `${ENTRY_ID}-styles`
    style.textContent = `
      .pf-media-stream-entry{position:relative;display:grid;align-content:start;gap:8px;min-height:150px;box-sizing:border-box;padding:18px;border:1px solid #b9dff5;border-radius:16px;background:linear-gradient(145deg,#f7fcff 0%,#e8f6ff 100%);color:#111318;text-decoration:none;box-shadow:0 8px 24px rgba(8,123,191,.08);transition:transform .15s ease,box-shadow .15s ease}
      .pf-media-stream-entry:hover{transform:translateY(-2px);box-shadow:0 14px 30px rgba(8,123,191,.14)}
      .pf-media-stream-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:#111318;color:#52c0ff}
      .pf-media-stream-entry strong{font-size:19px;line-height:1.15}
      .pf-media-stream-copy{color:#687385;line-height:1.4;font-size:14px}
      .pf-media-stream-entry b{position:absolute;top:14px;right:14px;padding:5px 8px;border-radius:999px;background:#dff3ff;color:#087bbf;font-size:9px;font-weight:950;letter-spacing:.06em;text-transform:uppercase}
      @media(max-width:520px){.pf-media-stream-entry{min-height:142px}}
    `
    document.head.appendChild(style)
  }

  function mount() {
    const clubId = currentClubId()
    if (!clubId) {
      document.getElementById(ENTRY_ID)?.remove()
      return
    }

    const actions = document.querySelector('.cmp-actions')
    if (!actions || document.getElementById(ENTRY_ID)) return
    ensureStyles()
    actions.appendChild(createEntry(clubId))
  }

  const observer = new MutationObserver(mount)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener('popstate', mount)
  document.addEventListener('DOMContentLoaded', mount)
  mount()
})()
