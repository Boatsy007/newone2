const API_BASE = 'https://www.playfooty.com.au/api'

export async function apiGet<T>(path: string, accessToken?: string) {
  return apiRequest<T>(path, { accessToken })
}

export async function apiRequest<T>(path: string, options: { accessToken?: string; method?: string; body?: unknown } = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        accept: 'application/json',
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(options.accessToken ? { authorization: `Bearer ${options.accessToken}` } : {}),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
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
