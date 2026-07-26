import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { fetchClub, type ClubProfile } from '../../lib/rankings'
import ConnectedClubLadder from './ConnectedClubLadder'

export default function ConnectedClubLadderPortal() {
  const { pathname } = useLocation()
  const match = pathname.match(/^\/team\/([^/]+)/)
  const clubId = match?.[1] ? decodeURIComponent(match[1]) : ''
  const [club, setClub] = useState<ClubProfile | null>(null)
  const [target, setTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!clubId) {
      setClub(null)
      return
    }
    let active = true
    void fetchClub(clubId).then(data => { if (active) setClub(data) }).catch(() => { if (active) setClub(null) })
    return () => { active = false }
  }, [clubId])

  useEffect(() => {
    if (!clubId) {
      setTarget(null)
      return
    }

    let marker: HTMLDivElement | null = null
    let oldSection: HTMLElement | null = null

    const attach = () => {
      const stack = document.querySelector<HTMLElement>('.club-stats-stack')
      if (!stack) return false
      const sections = Array.from(stack.querySelectorAll<HTMLElement>(':scope > section'))
      oldSection = sections.find(section => {
        const heading = section.querySelector('h2')?.textContent?.toLowerCase() ?? ''
        const copy = section.textContent?.toLowerCase() ?? ''
        return heading.includes('ladder') && copy.includes('where') && copy.includes('sits')
      }) ?? null
      if (!oldSection) return false

      oldSection.style.display = 'none'
      marker = document.createElement('div')
      marker.className = 'connected-club-ladder-slot'
      oldSection.before(marker)
      setTarget(marker)
      return true
    }

    if (!attach()) {
      const observer = new MutationObserver(() => {
        if (attach()) observer.disconnect()
      })
      observer.observe(document.body, { childList: true, subtree: true })
      const timeout = window.setTimeout(() => observer.disconnect(), 15000)
      return () => {
        window.clearTimeout(timeout)
        observer.disconnect()
        if (oldSection) oldSection.style.display = ''
        marker?.remove()
        setTarget(null)
      }
    }

    return () => {
      if (oldSection) oldSection.style.display = ''
      marker?.remove()
      setTarget(null)
    }
  }, [clubId])

  if (!club || !target) return null
  return createPortal(<ConnectedClubLadder club={club} />, target)
}
