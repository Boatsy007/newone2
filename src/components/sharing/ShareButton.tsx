import { useState } from 'react'
import { Share2 } from 'lucide-react'

type ShareMeta = { title: string; description: string; imageUrl: string | null; pageUrl: string; previewUrl: string }

async function loadShareMeta(path: string): Promise<ShareMeta> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  const pageUrl = `${window.location.origin}${cleanPath}`
  const previewUrl = `${window.location.origin}/api/share-link?path=${encodeURIComponent(cleanPath)}`
  let title = document.title
  let description = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? 'PlayFooty'
  let imageUrl = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content ?? null

  if (cleanPath !== `${window.location.pathname}${window.location.search}`) {
    try {
      const response = await fetch(previewUrl)
      if (response.ok) {
        const html = await response.text()
        const doc = new DOMParser().parseFromString(html, 'text/html')
        title = doc.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content ?? doc.title ?? title
        description = doc.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content ?? description
        imageUrl = doc.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content ?? imageUrl
      }
    } catch {
      // Use the current page metadata as a safe fallback.
    }
  }

  return { title, description, imageUrl, pageUrl, previewUrl }
}

async function createShareImage(imageUrl: string | null): Promise<File | null> {
  if (!imageUrl) return null
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) return null
    const svgBlob = await response.blob()
    const objectUrl = URL.createObjectURL(svgBlob)
    try {
      const image = new Image()
      image.decoding = 'async'
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('Could not render sharing card'))
        image.src = objectUrl
      })
      const canvas = document.createElement('canvas')
      canvas.width = 1200
      canvas.height = 630
      const context = canvas.getContext('2d')
      if (!context) return null
      context.drawImage(image, 0, 0, 1200, 630)
      const png = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png', 0.96))
      return png ? new File([png], 'playfooty-card.png', { type: 'image/png' }) : null
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  } catch {
    return null
  }
}

export async function sharePlayFootyPath(path: string) {
  const meta = await loadShareMeta(path)
  const card = await createShareImage(meta.imageUrl)
  if (navigator.share) {
    if (card && navigator.canShare?.({ files: [card] })) {
      await navigator.share({ title: meta.title, text: `${meta.description}\n\n${meta.pageUrl}`, files: [card] })
    } else {
      await navigator.share({ title: meta.title, text: meta.description, url: meta.previewUrl })
    }
    return 'shared' as const
  }
  await navigator.clipboard.writeText(meta.previewUrl)
  return 'copied' as const
}

export default function ShareButton() {
  const [state, setState] = useState<'idle' | 'creating' | 'copied'>('idle')
  const share = async () => {
    if (state === 'creating') return
    setState('creating')
    try {
      const result = await sharePlayFootyPath(`${window.location.pathname}${window.location.search}`)
      setState(result === 'copied' ? 'copied' : 'idle')
      if (result === 'copied') window.setTimeout(() => setState('idle'), 1800)
    } catch {
      setState('idle')
    }
  }
  return <button type="button" className="pf-share-action" aria-label="Create and share a PlayFooty graphic" onClick={share} disabled={state === 'creating'}>
    <Share2 size={20} />
    <span>{state === 'creating' ? 'Creating' : state === 'copied' ? 'Copied' : 'Share'}</span>
  </button>
}
