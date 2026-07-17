import { useState } from 'react'
import { Share2 } from 'lucide-react'

export default function ShareButton() {
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const url = window.location.href
    const title = document.title
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? 'PlayFooty'
    try {
      if (navigator.share) {
        await navigator.share({ title, text: description, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // User cancelled the native share sheet or clipboard access was unavailable.
    }
  }

  return <button type="button" className="pf-share-action" aria-label="Share this page" onClick={share}>
    <Share2 size={20} />
    <span>{copied ? 'Copied' : 'Share'}</span>
  </button>
}
