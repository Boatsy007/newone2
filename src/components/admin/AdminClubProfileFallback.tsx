import { useEffect } from 'react'

const CLUB_DETAIL = /^\/admin\/platform\/clubs\/([^/?#]+)$/
const CLUB_LIST = '/admin/manage/clubs'

function pathnameOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    try { return new URL(input, window.location.origin).pathname } catch { return input }
  }
  if (input instanceof URL) return input.pathname
  try { return new URL(input.url, window.location.origin).pathname } catch { return input.url }
}

function methodOf(input: RequestInfo | URL, init?: RequestInit): string {
  return (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
}

export default function AdminClubProfileFallback() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window)

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const match = methodOf(input, init) === 'GET' ? pathnameOf(input).match(CLUB_DETAIL) : null
      if (!match) return originalFetch(input, init)

      const clubId = decodeURIComponent(match[1])
      let detailResponse: Response | null = null

      try {
        detailResponse = await Promise.race([
          originalFetch(input, init),
          new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('Club profile request timed out')), 5000)),
        ])
        if (detailResponse.ok) return detailResponse
      } catch {
        // Fall through to the stable club-list endpoint.
      }

      try {
        const listResponse = await originalFetch(CLUB_LIST, {
          method: 'GET',
          headers: init?.headers ?? (input instanceof Request ? input.headers : undefined),
        })
        if (!listResponse.ok) return detailResponse ?? listResponse

        const payload = await listResponse.json() as { data?: Array<Record<string, unknown>> }
        const club = Array.isArray(payload.data) ? payload.data.find(row => String(row.id) === clubId) : undefined
        if (!club) return detailResponse ?? new Response(JSON.stringify({ error: 'Club not found' }), { status: 404, headers: { 'content-type': 'application/json' } })

        return new Response(JSON.stringify({ data: { ...club, leagueSeasons: [], rankingEntries: [], nameVariants: [] } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      } catch {
        return detailResponse ?? new Response(JSON.stringify({ error: 'Unable to load club profile' }), { status: 500, headers: { 'content-type': 'application/json' } })
      }
    }

    return () => { window.fetch = originalFetch }
  }, [])

  return null
}
