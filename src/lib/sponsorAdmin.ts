import { getKey, type LogoUploadPayload } from './admin'

export type SponsorRecord = {
  id: string
  name: string
  businessName?: string | null
  logoUrl: string | null
  websiteUrl: string | null
  email?: string | null
  phone?: string | null
  description?: string | null
  industry?: string | null
  state?: string | null
  tier?: string | null
  status?: string | null
}

export type SponsorshipRecord = {
  id: string
  sponsorId: string
  scope?: string | null
  clubId?: string | null
  leagueId?: string | null
  package?: string | null
  tier?: string | null
  status: string
  startDate?: string | null
  endDate?: string | null
  displayPriority?: number | null
  bannerPosition?: string | null
  ctaLabel?: string | null
  ctaUrl?: string | null
  sponsor: SponsorRecord | null
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${getKey()}` },
    body: body == null ? undefined : JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error((payload as { error?: string }).error ?? `HTTP ${response.status}`)
  return payload as T
}

export const sponsorAdmin = {
  listSponsors: () => request<{ data: SponsorRecord[] }>('GET', '/api/sponsors').then(result => result.data),
  createSponsor: (body: Record<string, unknown>) => request<{ data: SponsorRecord }>('POST', '/api/sponsors', body).then(result => result.data),
  updateSponsor: (id: string, body: Record<string, unknown>) => request<{ data: SponsorRecord }>('PATCH', `/api/sponsors/${id}`, body).then(result => result.data),
  uploadSponsorLogo: (id: string, body: LogoUploadPayload) => request<{ data: SponsorRecord }>('POST', `/api/sponsors/${id}/logo`, body).then(result => result.data),
  removeSponsorLogo: (id: string) => request<{ data: SponsorRecord }>('DELETE', `/api/sponsors/${id}/logo`).then(result => result.data),
  listEntitySponsorships: (kind: 'club' | 'league', entityId: string) => request<{ data: SponsorshipRecord[] }>('GET', `/api/${kind === 'club' ? 'clubs' : 'leagues'}/${encodeURIComponent(entityId)}/sponsors?all=true`).then(result => result.data),
  createSponsorship: (body: Record<string, unknown>) => request<{ data: SponsorshipRecord }>('POST', '/api/commercial/sponsorships', body).then(result => result.data),
  setSponsorshipStatus: (id: string, status: string, note?: string) => request<{ data: SponsorshipRecord }>('PATCH', `/api/commercial/sponsorships/${id}`, { status, note }).then(result => result.data),
  archiveSponsorship: (id: string) => request<{ data: { archived: true } }>('DELETE', `/api/commercial/sponsorships/${id}`).then(result => result.data),
}
