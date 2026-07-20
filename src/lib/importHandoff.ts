export type ImportHandoffKind = 'ladder' | 'results' | 'fixtures' | 'goalKickers' | 'club' | 'league' | 'players'

const KEY = 'playfooty_import_handoff'
const BATCH_KEY = 'playfooty_import_handoff_batch'
const MAX_AGE = 30 * 60 * 1000

export interface ImportHandoff {
  kind: ImportHandoffKind
  name: string
  type: string
  dataUrl: string
  createdAt: number
}

export function saveImportHandoff(value: ImportHandoff): void {
  sessionStorage.setItem(KEY, JSON.stringify(value))
}

export function saveImportHandoffBatch(values: ImportHandoff[]): void {
  if (!values.length) {
    sessionStorage.removeItem(BATCH_KEY)
    return
  }
  sessionStorage.setItem(BATCH_KEY, JSON.stringify(values))
}

export function consumeImportHandoff(accepted: ImportHandoffKind[]): ImportHandoff | null {
  const raw = sessionStorage.getItem(KEY)
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as ImportHandoff
    if (!accepted.includes(value.kind) || !value.dataUrl || Date.now() - value.createdAt > MAX_AGE) return null
    sessionStorage.removeItem(KEY)
    return value
  } catch {
    sessionStorage.removeItem(KEY)
    return null
  }
}

export function consumeImportHandoffBatch(accepted: ImportHandoffKind[]): ImportHandoff[] {
  const raw = sessionStorage.getItem(BATCH_KEY)
  if (!raw) return []
  try {
    const values = JSON.parse(raw) as ImportHandoff[]
    sessionStorage.removeItem(BATCH_KEY)
    if (!Array.isArray(values)) return []
    return values.filter(value => accepted.includes(value.kind) && Boolean(value.dataUrl) && Date.now() - value.createdAt <= MAX_AGE)
  } catch {
    sessionStorage.removeItem(BATCH_KEY)
    return []
  }
}

export function handoffToFile(value: ImportHandoff): File {
  const [header, encoded = ''] = value.dataUrl.split(',', 2)
  const mime = header.match(/^data:([^;]+)/)?.[1] || value.type || 'image/png'
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new File([bytes], value.name || `import-${Date.now()}.png`, { type: mime })
}
