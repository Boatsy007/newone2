const API_BASE = 'https://www.playfooty.com.au/api'

export async function apiGet<T>(path: string, accessToken?: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        accept: 'application/json',
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      signal: controller.signal,
    })
    const payload = (await response.json().catch(() => ({}))) as T & { error?: string }
    if (!response.ok) throw new Error(payload.error || `PlayFooty request failed (${response.status})`)
    return payload
  } catch (reason) {
    if (reason instanceof Error && reason.name === 'AbortError') throw new Error('PlayFooty took too long to respond.')
    throw reason
  } finally {
    clearTimeout(timeout)
  }
}
