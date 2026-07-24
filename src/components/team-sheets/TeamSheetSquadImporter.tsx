import { useState } from 'react'
import { UploadCloud, X } from 'lucide-react'
import { getKey } from '../../lib/admin'

type ImportedPlayer = {
  playerName: string
  jumperNumber: number | null
  skip?: boolean
}

type ParsePayload = {
  data?: {
    players?: Array<{ playerName?: string; jumperNumber?: number | null }>
    notes?: string | null
  }
  error?: string
}

export default function TeamSheetSquadImporter({ clubId, onImported }: { clubId: string; onImported: () => Promise<void> | void }) {
  const [image, setImage] = useState<string>('')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ImportedPlayer[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function choose(file?: File) {
    if (!file) return
    setMessage('Loading screenshot…')
    try {
      const dataUrl = await readDataUrl(file)
      setImage(dataUrl)
      setFileName(file.name)
      setRows([])
      setMessage('Screenshot ready. Capture the player list when you are ready.')
    } catch {
      setMessage('The screenshot could not be opened.')
    }
  }

  async function capture() {
    if (!image || !clubId) return
    setBusy(true)
    setMessage('Reading jumper numbers and player names…')
    try {
      const response = await fetch('/admin/profile-images/parse', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${getKey()}`,
        },
        body: JSON.stringify({ image, kind: 'players' }),
      })
      const payload = await response.json() as ParsePayload
      if (!response.ok) throw new Error(payload.error ?? `HTTP ${response.status}`)
      const players = Array.isArray(payload.data?.players) ? payload.data!.players! : []
      const unique = new Map<string, ImportedPlayer>()
      for (const player of players) {
        const playerName = String(player.playerName ?? '').trim()
        if (!playerName) continue
        const key = playerName.toLocaleLowerCase('en-AU')
        unique.set(key, {
          playerName,
          jumperNumber: Number.isFinite(Number(player.jumperNumber)) ? Number(player.jumperNumber) : null,
        })
      }
      setRows([...unique.values()])
      setMessage(unique.size ? `${unique.size} players captured. Review the list before adding it to the squad.` : 'No player rows were detected. Try a clearer screenshot.')
    } catch (error) {
      setRows([])
      setMessage(error instanceof Error ? error.message : 'The player list could not be read.')
    } finally {
      setBusy(false)
    }
  }

  async function importRows() {
    const confirmed = rows.filter(row => !row.skip && row.playerName.trim())
    if (!clubId || !confirmed.length) return
    setBusy(true)
    setMessage(`Adding ${confirmed.length} players to the club squad…`)
    try {
      let saved = 0
      for (const row of confirmed) {
        const response = await fetch(`/admin/team-sheets/club/${encodeURIComponent(clubId)}/players`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ playerName: row.playerName.trim(), jumperNumber: row.jumperNumber }),
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({})) as { error?: string }
          throw new Error(payload.error ?? `Could not save ${row.playerName}`)
        }
        saved += 1
      }
      await onImported()
      setMessage(`${saved} players added or updated. You can now select their positions below.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The squad could not be updated.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="tsi-card">
    <header>
      <div><small>SCREENSHOT IMPORT</small><h2>Capture club squad</h2><p>Upload the PlayHQ player-list screenshot, review every detected name and number, then add them to this club’s reusable squad.</p></div>
    </header>
    <label className="tsi-drop">
      <UploadCloud size={34} />
      <strong>{fileName || 'Choose player-list screenshot'}</strong>
      <span>PNG, JPG, WebP, HEIC or HEIF</span>
      <input hidden type="file" accept="image/*,.heic,.heif,.png,.jpg,.jpeg,.webp" onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void choose(file) }} />
    </label>
    {image ? <div className="tsi-preview"><img src={image} alt="Selected player-list screenshot" /><button type="button" disabled={busy} onClick={() => void capture()}>{busy ? 'Reading…' : 'Capture players'}</button></div> : null}
    {rows.length ? <>
      <div className="tsi-review">
        {rows.map((row, index) => <div className={row.skip ? 'is-skipped' : ''} key={`${index}-${row.playerName}`}>
          <input aria-label="Jumper number" inputMode="numeric" value={row.jumperNumber ?? ''} onChange={event => setRows(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, jumperNumber: event.target.value === '' ? null : Number(event.target.value) } : item))} />
          <input aria-label="Player name" value={row.playerName} onChange={event => setRows(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, playerName: event.target.value } : item))} />
          <button type="button" aria-label={row.skip ? 'Restore player' : 'Skip player'} onClick={() => setRows(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, skip: !item.skip } : item))}><X size={16} />{row.skip ? 'Restore' : 'Skip'}</button>
        </div>)}
      </div>
      <button className="tsi-import" type="button" disabled={busy || !rows.some(row => !row.skip && row.playerName.trim())} onClick={() => void importRows()}>{busy ? 'Saving…' : 'Add confirmed players to squad'}</button>
    </> : null}
    {message ? <p className="tsi-message" role="status">{message}</p> : null}
    <style>{styles}</style>
  </section>
}

function readDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid image'))
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'))
    reader.readAsDataURL(file)
  })
}

const styles = `.tsi-card{background:#fff;border:1px solid #dce3e9;border-radius:14px;padding:20px;margin-top:18px;box-shadow:0 6px 18px rgba(17,24,39,.05);font-family:Barlow,Inter,Arial,sans-serif}.tsi-card header small{color:#118fd3;font-size:10px;font-weight:950;letter-spacing:.16em}.tsi-card h2{margin:5px 0 3px;font-family:'Bebas Neue',Impact,sans-serif;font-size:34px;line-height:1;text-transform:uppercase}.tsi-card header p{margin:0;color:#687385;line-height:1.45}.tsi-drop{display:grid;justify-items:center;gap:5px;margin-top:16px;padding:20px;border:2px dashed #8dcef1;border-radius:12px;background:#f5fbff;color:#111318;cursor:pointer;text-align:center}.tsi-drop svg{color:#118fd3}.tsi-drop strong{font-size:14px}.tsi-drop span{font-size:11px;color:#687385}.tsi-preview{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;margin-top:14px}.tsi-preview img{width:100%;max-height:260px;object-fit:contain;border:1px solid #dce3e9;border-radius:10px;background:#eef3f7}.tsi-card button{border:0;border-radius:8px;background:#42b8ff;color:#071018;padding:11px 14px;font-weight:900;text-transform:uppercase;cursor:pointer}.tsi-card button:disabled{opacity:.55;cursor:wait}.tsi-review{display:grid;gap:8px;margin-top:16px}.tsi-review>div{display:grid;grid-template-columns:78px minmax(0,1fr) auto;gap:8px}.tsi-review>div.is-skipped{opacity:.45}.tsi-review input{min-width:0;border:1px solid #cfd8e1;border-radius:8px;padding:10px;font:inherit}.tsi-review button{display:flex;align-items:center;gap:5px;background:#e8edf2;padding:9px 11px}.tsi-import{width:100%;margin-top:14px;background:#21c879!important}.tsi-message{margin:13px 0 0;padding:11px 13px;border-radius:9px;background:#eef3f7;color:#26313a;font-weight:750}@media(max-width:620px){.tsi-card{padding:16px 12px}.tsi-preview{grid-template-columns:1fr}.tsi-preview button{width:100%}.tsi-review>div{grid-template-columns:62px minmax(0,1fr)}.tsi-review>div button{grid-column:1/-1;justify-content:center}}`
