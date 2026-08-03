import { useEffect } from 'react'

type PublicSponsor = { id?: string; sponsor?: { id?: string; name?: string } }

export default function ClubHqSponsorStatusSync({ clubId }: { clubId: string }) {
  useEffect(() => {
    if (!clubId) return
    let active = true
    let timer: number | undefined

    const clean = () => {
      document.querySelectorAll<HTMLElement>('.hqcc-today a,.hqcc-action').forEach(item => {
        const title = item.querySelector('strong')?.textContent?.trim().toLowerCase()
        if (title === 'connect the club sponsors') item.remove()
      })

      document.querySelectorAll<HTMLElement>('.hq-ai-copy p').forEach(item => {
        if (item.textContent?.trim() === 'No active sponsor is connected to Club HQ yet.') item.remove()
      })

      const actionCount = document.querySelector<HTMLElement>('.hqcc-counts b:first-child')
      const visibleActions = document.querySelectorAll('.hqcc-today > div:first-child > a,.hqcc-today > div:first-child > .hqcc-action').length
      if (actionCount) {
        const textNode = Array.from(actionCount.childNodes).find(node => node.nodeType === Node.TEXT_NODE)
        if (textNode) textNode.textContent = String(visibleActions)
      }
    }

    const sync = async () => {
      try {
        const response = await fetch(`/api/clubs/${encodeURIComponent(clubId)}/sponsors`, { cache: 'no-store' })
        if (!response.ok) return
        const payload = await response.json().catch(() => ({})) as { data?: unknown }
        const sponsors = Array.isArray(payload.data)
          ? payload.data.filter((item): item is PublicSponsor => Boolean(item && typeof item === 'object'))
          : []
        if (!active || sponsors.length === 0) return

        document.documentElement.dataset.clubHqHasSponsors = 'true'
        window.requestAnimationFrame(clean)
      } catch {
        // Keep the existing dashboard state when the public feed is temporarily unavailable.
      }
    }

    void sync()
    timer = window.setInterval(() => void sync(), 15000)

    return () => {
      active = false
      if (timer) window.clearInterval(timer)
      delete document.documentElement.dataset.clubHqHasSponsors
    }
  }, [clubId])

  return null
}
