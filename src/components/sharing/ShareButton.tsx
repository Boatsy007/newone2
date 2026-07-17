import { useState } from 'react'
import { Share2 } from 'lucide-react'

export default function ShareButton() {
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const pagePath = `${window.location.pathname}${window.location.search}`
    const shareUrl = `${window.location.origin}/api/share-link?path=${encodeURIComponent(pagePath)}`
    const title = document.title
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? 'PlayFooty'
    try {
      if (navigator.share) {
        await navigator.share({ title, text: description, url: shareUrl })
        return
      }
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // The user cancelled the native share sheet or clipboard access was unavailable.
    }
  }

  return <button type="button" className="pf-share-action" aria-label="Share this page with a PlayFooty card" onClick={share}>
    <Share2 size={20} />
    <span>{copied ? 'Copied' : 'Share'}</span>
  </button>
}
