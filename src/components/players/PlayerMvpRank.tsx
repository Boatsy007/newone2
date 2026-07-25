import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'

type PlayerProfile = {
  playerId?: string
  playerName: string
  clubId: string | null
  clubName: string
  season: string
}

type MvpEntry = {
  playerId: string | null
  playerName: string
  clubId: string | null
  clubName: string
  rank: number
  mvpPoints: number
  bp: number
}

function normalise(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export default function PlayerMvpRank() {
  const { pathname } = useLocation()
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [entry, setEntry] = useState<MvpEntry | null>(null)

  useEffect(() => {
    if (!pathname.startsWith('/player/')) {
      setHost(null)
      setEntry(null)
      return
    }

    let active = true
    let observer: MutationObserver | null = null
    const findHost = () => {
      const target = document.querySelector<HTMLElement>('.player-rank')
      if (target && active) setHost(target)
    }
    findHost()
    observer = new MutationObserver(findHost)
    observer.observe(document.body, { childList: true, subtree: true })

    const rawId = pathname.slice('/player/'.length).split('/')[0]
    const profileRowId = decodeURIComponent(rawId)
    void fetch(`/api/goal-kickers/player/${encodeURIComponent(profileRowId)}`)
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const payload = await response.json() as { data?: PlayerProfile }
        if (!payload.data) throw new Error('Player not found')
        return payload.data
      })
      .then(async profile => {
        const response = await fetch(`/api/mvp?season=${encodeURIComponent(profile.season)}&limit=1000`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const payload = await response.json() as { data?: MvpEntry[] }
        const rows = Array.isArray(payload.data) ? payload.data : []
        const profileName = normalise(profile.playerName)
        const profileClub = normalise(profile.clubName)
        const sameName = rows.filter(row => normalise(row.playerName) === profileName)

        return rows.find(row => row.playerId === profileRowId)
          ?? rows.find(row => Boolean(profile.playerId) && row.playerId === profile.playerId)
          ?? sameName.find(row => Boolean(profile.clubId) && row.clubId === profile.clubId)
          ?? sameName.find(row => profileClub && normalise(row.clubName) === profileClub)
          ?? (sameName.length === 1 ? sameName[0] : null)
      })
      .then(result => { if (active) setEntry(result) })
      .catch(() => { if (active) setEntry(null) })

    return () => {
      active = false
      observer?.disconnect()
    }
  }, [pathname])

  if (!host || !entry) return null

  return <>
    {createPortal(<div className="player-mvp-rank">
      <span>National MVP rank</span>
      <strong>#{entry.rank}</strong>
      <small>{entry.mvpPoints} MVP points · {entry.bp} BP</small>
    </div>, host)}
    <style>{`
      .player-mvp-rank{margin-top:24px;padding-top:20px;border-top:1px solid rgba(255,255,255,.18)}
      .player-mvp-rank span{display:block;color:#9da8b5;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.12em}
      .player-mvp-rank strong{display:block;color:#fff!important;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(3.2rem,7vw,5rem)!important;line-height:.85!important;margin-top:10px!important}
      .player-mvp-rank small{display:block;color:#c8d0da;margin-top:10px;font-weight:800}
      @media(max-width:850px){.player-mvp-rank{max-width:320px}.player-mvp-rank strong{font-size:4rem!important}}
    `}</style>
  </>
}
