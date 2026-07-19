import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSeo } from '../../lib/seo'
import PublicGoalKickersPanel, { type PublicGoalKicker } from './PublicGoalKickersPanel'

type PlayerSeoData = {
  id: string
  playerName: string
  clubId: string | null
  clubName: string
  leagueId: string | null
  leagueName: string
  season: string
  grade: string | null
  goals: number
  matches: number | null
  goalsPerGame: number | null
  rank: number | null
  clubLogoUrl: string | null
  town: string | null
  stateName: string | null
  state: string | null
}

export default function GoalKickerPublicIntegration() {
  const { pathname } = useLocation()
  const clubMatch = pathname.match(/^\/team\/([^/]+)/)
  const playerMatch = pathname.match(/^\/player\/([^/]+)/)
  return <>
    {clubMatch && <ClubGoalKickersPortal clubId={decodeURIComponent(clubMatch[1])} />}
    {playerMatch && <PlayerSeo playerId={decodeURIComponent(playerMatch[1])} />}
    <SearchPlayerProfileBridge />
  </>
}

function ClubGoalKickersPortal({ clubId }: { clubId: string }) {
  const [target, setTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    let active = true
    const attach = () => {
      if (!active) return
      const section = document.querySelector<HTMLElement>('.club-section-bg')
      if (!section) return
      let node = document.getElementById('pf-club-goal-kickers-slot')
      if (!node) {
        node = document.createElement('div')
        node.id = 'pf-club-goal-kickers-slot'
        node.className = 'pf-club-goal-kickers-slot'
        section.insertAdjacentElement('beforebegin', node)
      }
      setTarget(node)
    }
    attach()
    const observer = new MutationObserver(attach)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => { active = false; observer.disconnect(); setTarget(null); document.getElementById('pf-club-goal-kickers-slot')?.remove() }
  }, [clubId])

  if (!target) return null
  return createPortal(<div className="pf-club-goal-kickers-shell">
    <PublicGoalKickersPanel clubId={clubId} eyebrow={`${new Date().getFullYear()} club leaders`} title="Leading goal kickers" />
    <style>{`.pf-club-goal-kickers-slot{background:#f3f5f7;padding:24px 20px 0}.pf-club-goal-kickers-shell{max-width:1180px;margin:0 auto}.pf-club-goal-kickers-shell .public-gk-panel{max-width:842px}@media(max-width:980px){.pf-club-goal-kickers-slot{padding:18px 14px 0}.pf-club-goal-kickers-shell .public-gk-panel{max-width:none}}`}</style>
  </div>, target)
}

function PlayerSeo({ playerId }: { playerId: string }) {
  const [data, setData] = useState<PlayerSeoData | null>(null)
  useEffect(() => {
    let active = true
    fetch(`/api/goal-kickers/player/${encodeURIComponent(playerId)}`)
      .then(async response => {
        const payload = await response.json() as { data?: PlayerSeoData }
        if (!response.ok || !payload.data) throw new Error('Player not found')
        return payload.data
      })
      .then(value => { if (active) setData(value) })
      .catch(() => { if (active) setData(null) })
    return () => { active = false }
  }, [playerId])

  const base = 'https://playfooty.com.au'
  const url = `${base}/player/${playerId}`
  const location = data ? [data.town, data.stateName ?? data.state].filter(Boolean).join(', ') : ''
  useSeo({
    title: data ? `${data.playerName}: ${data.goals} Goals for ${data.clubName} ${data.season} | PlayFooty` : 'Player Profile | PlayFooty',
    description: data ? `${data.playerName} has kicked ${data.goals} goals${data.matches ? ` in ${data.matches} matches` : ''} for ${data.clubName} in ${data.leagueName}${location ? `, ${location}` : ''}. View season history, goals per game, records and rankings.` : 'Community football player profile and goal-kicking statistics.',
    path: `/player/${playerId}`,
    jsonLd: data ? [
      {
        '@context': 'https://schema.org',
        '@type': 'Person',
        '@id': `${url}#player`,
        name: data.playerName,
        url,
        ...(data.clubLogoUrl ? { image: data.clubLogoUrl } : {}),
        affiliation: [
          { '@type': 'SportsOrganization', name: data.clubName, ...(data.clubId ? { url: `${base}/team/${data.clubId}` } : {}) },
          { '@type': 'SportsOrganization', name: data.leagueName, ...(data.leagueId ? { url: `${base}/league/${data.leagueId}` } : {}) },
        ],
        description: `${data.playerName} is a community football player for ${data.clubName}, with ${data.goals} goals in the ${data.season} ${data.grade ?? 'football'} season.`,
      },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: base },
        { '@type': 'ListItem', position: 2, name: 'Goal Kickers', item: `${base}/goal-kickers` },
        { '@type': 'ListItem', position: 3, name: data.playerName, item: url },
      ] },
    ] : undefined,
  })
  return null
}

function SearchPlayerProfileBridge() {
  const navigate = useNavigate()
  const [players, setPlayers] = useState<PublicGoalKicker[]>([])

  useEffect(() => {
    fetch('/api/goal-kickers?mode=raw&limit=500')
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((payload: { data?: PublicGoalKicker[] }) => setPlayers(Array.isArray(payload.data) ? payload.data : []))
      .catch(() => setPlayers([]))
  }, [])

  useEffect(() => {
    const handle = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('.pf-search-result') : null
      if (!button) return
      const group = button.closest<HTMLElement>('.pf-search-group')
      if (group?.querySelector('h3')?.textContent?.trim() !== 'Players & goal kickers') return
      const playerName = button.querySelector('strong')?.textContent?.trim()
      const detail = button.querySelector('small')?.textContent?.trim() ?? ''
      if (!playerName) return
      const match = players.find(player => player.playerName === playerName && detail.startsWith(player.clubName))
        ?? players.find(player => player.playerName === playerName)
      if (!match?.id) return
      event.preventDefault()
      event.stopPropagation()
      navigate(`/player/${encodeURIComponent(match.id)}`)
    }
    document.addEventListener('click', handle, true)
    return () => document.removeEventListener('click', handle, true)
  }, [navigate, players])

  return null
}
