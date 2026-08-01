(() => {
  const ROUTE = /^\/club-portal\/([^/]+)\/whiteboard\/?$/
  const PREFIX = 'playfooty.whiteboard.recording.v1:'
  const SESSION_KEY = 'playfooty.clubPortal.session.v1'
  if (!ROUTE.test(window.location.pathname)) return

  const nativeSet = Storage.prototype.setItem
  const nativeGet = Storage.prototype.getItem
  const nativeRemove = Storage.prototype.removeItem
  const pending = new Map()

  const clubId = () => decodeURIComponent(window.location.pathname.match(ROUTE)?.[1] || '')
  const session = () => {
    try { return JSON.parse(nativeGet.call(window.localStorage, SESSION_KEY) || 'null') }
    catch { return null }
  }
  const selectedBoardId = () => document.querySelector('.wb .meta select')?.value || ''
  const savedBoard = id => Boolean(id && id !== 'new')
  const keyFor = id => `${PREFIX}${clubId()}:${id}`

  async function save(boardId, recording, storageKey) {
    const auth = session()
    if (!auth?.access_token || !savedBoard(boardId) || !recording) return
    const response = await fetch(`/api/club-portal/whiteboard/clubs/${encodeURIComponent(clubId())}/whiteboards/${encodeURIComponent(boardId)}/recording`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${auth.access_token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ recording }),
    })
    if (!response.ok) throw new Error('Unable to save shared whiteboard recording')
    nativeRemove.call(window.localStorage, storageKey)
    window.dispatchEvent(new CustomEvent('playfooty:whiteboard-recording-saved', { detail: { boardId } }))
  }

  function schedule(storageKey, raw) {
    if (!storageKey.startsWith(PREFIX)) return
    const suffix = storageKey.slice(PREFIX.length)
    const separator = suffix.indexOf(':')
    if (separator < 0 || suffix.slice(0, separator) !== clubId()) return
    const boardId = suffix.slice(separator + 1)
    if (!savedBoard(boardId)) return
    let recording
    try { recording = JSON.parse(raw) } catch { return }
    window.clearTimeout(pending.get(storageKey))
    pending.set(storageKey, window.setTimeout(() => {
      save(boardId, recording, storageKey).catch(() => {})
      pending.delete(storageKey)
    }, 300))
  }

  Storage.prototype.setItem = function (key, value) {
    nativeSet.call(this, key, value)
    if (this === window.localStorage && typeof key === 'string' && typeof value === 'string') schedule(key, value)
  }

  function migrateSelectedBoard() {
    const boardId = selectedBoardId()
    if (!savedBoard(boardId)) return
    const storageKey = keyFor(boardId)
    const raw = nativeGet.call(window.localStorage, storageKey)
    if (raw) schedule(storageKey, raw)
  }

  document.addEventListener('change', event => {
    if (event.target === document.querySelector('.wb .meta select')) window.setTimeout(migrateSelectedBoard, 80)
  }, true)

  const observer = new MutationObserver(() => migrateSelectedBoard())
  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.setTimeout(migrateSelectedBoard, 300)
})()
