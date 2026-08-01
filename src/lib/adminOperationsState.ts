import { getKey } from './admin'

type StateRow<T> = { value: T | null; updatedAt: string | null }

export async function loadAdminOperationsState<T>(key: string): Promise<StateRow<T>> {
  const response = await fetch(`/admin/quality/operations-state/${encodeURIComponent(key)}`, {
    headers: { authorization: `Bearer ${getKey()}` },
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => ({})) as { data?: StateRow<T>; error?: string }
  if (!response.ok) throw new Error(payload.error || `Unable to load ${key}`)
  return payload.data ?? { value: null, updatedAt: null }
}

export async function saveAdminOperationsState<T>(key: string, value: T): Promise<void> {
  const response = await fetch(`/admin/quality/operations-state/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${getKey()}`, 'content-type': 'application/json' },
    body: JSON.stringify({ value }),
  })
  const payload = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(payload.error || `Unable to save ${key}`)
}
