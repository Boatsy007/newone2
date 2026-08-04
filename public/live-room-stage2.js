(() => {
  let peer = null
  let resourceUrl = ''
  let activeUrl = ''

  function waitForIce(pc) {
    return new Promise(resolve => {
      if (pc.iceGatheringState === 'complete') return resolve()
      const done = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', done)
          resolve()
        }
      }
      pc.addEventListener('icegatheringstatechange', done)
      setTimeout(resolve, 5000)
    })
  }

  async function stopPlayback() {
    if (resourceUrl) fetch(resourceUrl, { method: 'DELETE' }).catch(() => {})
    resourceUrl = ''
    activeUrl = ''
    peer?.close()
    peer = null
    const video = document.getElementById('player')
    if (video) video.srcObject = null
  }

  async function startPlayback(url, video) {
    if (!url || activeUrl === url || !video) return
    await stopPlayback()
    activeUrl = url
    const pc = new RTCPeerConnection()
    pc.addTransceiver('video', { direction: 'recvonly' })
    pc.addTransceiver('audio', { direction: 'recvonly' })
    pc.ontrack = event => {
      const stream = event.streams?.[0] || new MediaStream([event.track])
      video.srcObject = stream
      video.hidden = false
      document.getElementById('waiting')?.setAttribute('hidden', '')
      video.play().catch(() => {})
    }
    await pc.setLocalDescription(await pc.createOffer())
    await waitForIce(pc)
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/sdp' },
      body: pc.localDescription?.sdp || '',
    })
    if (!response.ok) throw new Error('Unable to connect to the live broadcast')
    await pc.setRemoteDescription({ type: 'answer', sdp: await response.text() })
    const location = response.headers.get('location') || ''
    resourceUrl = location ? new URL(location, url).href : ''
    peer = pc
  }

  const descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src')
  if (descriptor?.set && descriptor.get) {
    Object.defineProperty(HTMLMediaElement.prototype, 'src', {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set(value) {
        const url = String(value || '')
        if (this.id === 'player' && /\/webRTC\/play(?:$|[/?#])/i.test(url)) {
          startPlayback(url, this).catch(error => {
            const box = document.getElementById('error')
            if (box) { box.style.display = 'block'; box.textContent = error instanceof Error ? error.message : 'Unable to play the broadcast' }
          })
          return
        }
        descriptor.set.call(this, value)
      },
    })
  }

  const nativeFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
    const response = await nativeFetch(input, init)
    const match = url.match(/\/api\/live-match\/clubs\/([^?/#]+)/)
    if (!match || !response.ok) return response
    try {
      const clubId = decodeURIComponent(match[1])
      const [matchPayload, streamResponse] = await Promise.all([
        response.clone().json(),
        nativeFetch('/api/live-stream/clubs/' + encodeURIComponent(clubId) + '?watch=' + Date.now(), { cache: 'no-store' }),
      ])
      const streamPayload = streamResponse.ok ? await streamResponse.json() : { data: {} }
      const merged = { ...matchPayload, data: { ...(matchPayload.data || {}), ...(streamPayload.data || {}) } }
      if (!merged.data.isStreaming) stopPlayback().catch(() => {})
      return new Response(JSON.stringify(merged), { status: response.status, statusText: response.statusText, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
    } catch {
      return response
    }
  }

  window.addEventListener('beforeunload', () => { stopPlayback().catch(() => {}) })
})()
