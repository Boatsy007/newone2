import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import MatchDayGameSummary from './MatchDayGameSummary'

type Session = { access_token?: string }
type Sheet = { id: string; opponentName: string | null }
type MatchState = {
  sheetId: string
  quarter: number
  elapsed: number
  homeGoals: number
  homeBehinds: number
  awayGoals: number
  awayBehinds: number
  slots: Array<{ clubPlayerId: string; playerName: string; jumperNumber: number | null; positionCode: string; onGround: boolean; plusMinus: number; goals?: number; behinds?: number }>
  events: Array<{ id: string; quarter: number; seconds: number; kind: 'SCORE' | 'SWAP' | 'QUARTER'; label: string; delta?: number; affected?: string[]; before?: Array<{ clubPlayerId: string; playerName: string; jumperNumber: number | null; positionCode: string; onGround: boolean; plusMinus: number; goals?: number; behinds?: number }> }>
  finishedAt?: string | null
}

const SESSION_KEY = 'playfooty.clubPortal.session.v1'
function token() {
  try {
    return (JSON.parse(localStorage.getItem(SESSION_KEY) || '{}') as Session).access_token || ''
  } catch {
    return ''
  }
}

export default function MatchDayGameSummaryOverlay({ clubId }: { clubId: string }) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [state, setState] = useState<MatchState | null>(null)
  const [opponent, setOpponent] = useState('Opposition')
  const accessToken = useMemo(() => token(), [clubId])

  useEffect(() => {
    let active = true
    const attach = () => {
      if (!active) return
      const next = document.getElementById('pf-match-summary-host')
      if (next) setHost(next)
    }
    attach()
    const observer = new MutationObserver(attach)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => { active = false; observer.disconnect(); setHost(null) }
  }, [])

  useEffect(() => {
    if (!accessToken) return
    let active = true
    const read = async () => {
      const sheetId = document.querySelector<HTMLSelectElement>('.md-picker select')?.value
      if (!sheetId) return
      try {
        const headers = { authorization: `Bearer ${accessToken}` }
        const [stateResponse, sheetsResponse] = await Promise.all([
          fetch(`/api/club-portal/match-day/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(sheetId)}`, { headers }),
          fetch(`/api/club-portal/team-sheets/clubs/${encodeURIComponent(clubId)}/sheets`, { headers }),
        ])
        const statePayload = await stateResponse.json().catch(() => ({}))
        const sheetsPayload = await sheetsResponse.json().catch(() => ({}))
        if (!active) return
        const next = stateResponse.ok ? statePayload.data?.state as MatchState | undefined : undefined
        setState(next?.finishedAt ? next : null)
        const sheets = Array.isArray(sheetsPayload.data) ? sheetsPayload.data as Sheet[] : []
        setOpponent(sheets.find(sheet => sheet.id === sheetId)?.opponentName || 'Opposition')
      } catch {
        if (active) setState(null)
      }
    }
    void read()
    const timer = window.setInterval(() => void read(), 2000)
    return () => { active = false; window.clearInterval(timer) }
  }, [accessToken, clubId])

  if (!host || !state) return null
  return createPortal(<><MatchDayGameSummary state={state} opponent={opponent} clubId={clubId}/><style>{`.pf-game-summary{display:none!important}`}</style></>, host)
}
