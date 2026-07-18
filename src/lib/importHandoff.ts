export type ImportHandoffKind = 'ladder' | 'results' | 'fixtures' | 'goalKickers' | 'club' | 'league' | 'players'

const KEY = 'playfooty_import_handoff'

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

export function consumeImportHandoff(accepted: ImportHandoffKind[]): ImportHandoff | null {
  const raw = sessionStorage.getItem(KEY)
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as ImportHandoff
    if (!accepted.includes(value.kind) || !value.dataUrl || Date.now() - value.createdAt > 30 * 60 * 1000) return null
    sessionStorage.removeItem(KEY)
    return value
  } catch {
    sessionStorage.removeItem(KEY)
    return null
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
