import { useState } from 'react'
import { Share2 } from 'lucide-react'

async function createShareImage(): Promise<File | null> {
  const imageUrl = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content
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

export default function ShareButton() {
  const [state, setState] = useState<'idle' | 'creating' | 'copied'>('idle')

  const share = async () => {
    if (state === 'creating') return
    setState('creating')

    const pageUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`
    const pagePath = `${window.location.pathname}${window.location.search}`
    const previewUrl = `${window.location.origin}/api/share-link?path=${encodeURIComponent(pagePath)}`
    const title = document.title
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? 'PlayFooty'

    try {
      const card = await createShareImage()
      if (navigator.share) {
        if (card && navigator.canShare?.({ files: [card] })) {
          await navigator.share({
            title,
            text: `${description}\n\n${pageUrl}`,
            files: [card],
          })
        } else {
          await navigator.share({ title, text: description, url: previewUrl })
        }
        setState('idle')
        return
      }

      await navigator.clipboard.writeText(previewUrl)
      setState('copied')
      window.setTimeout(() => setState('idle'), 1800)
    } catch {
      setState('idle')
    }
  }

  return <button type="button" className="pf-share-action" aria-label="Create and share a PlayFooty graphic" onClick={share} disabled={state === 'creating'}>
    <Share2 size={20} />
    <span>{state === 'creating' ? 'Creating' : state === 'copied' ? 'Copied' : 'Share'}</span>
  </button>
}
