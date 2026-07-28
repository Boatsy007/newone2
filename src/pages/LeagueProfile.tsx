/**
 * League page: the definitive digital home for a competition.
 */
import { lazy, Suspense, useState } from 'react'
import { useParams } from 'react-router-dom'
import Nav from '../components/layout/Nav'
import ProductSearch from '../components/rankings/ProductSearch'
import Footer from '../components/layout/Footer'
import LeagueLiveData from '../components/league/LeagueLiveData'
import LeagueHubExtras from '../components/league/LeagueHubExtras'
import LeagueLadderPolish from '../components/league/LeagueLadderPolish'
import LeaguePublicInformation from '../components/league/LeaguePublicInformation'
import { LeagueMvpPanel } from '../components/mvp/MvpPanels'
import { useSeo } from '../lib/seo'
import { fetchLeague, useAsync, strengthStars, strengthLabel, type LeagueDetail } from '../lib/rankings'
import { Skel, MUTE } from '../components/home/ui'
import {
  deriveFacts, weeklyStory, LeagueHero, LeagueSubnav, LeagueSnapshot,
  LeagueStrength, LeagueNews, RelatedLeagues, LeagueSidebar,
} from '../components/league/sections'
import { LeagueLadder, ClubRankingCards } from '../components/league/ladder'
import type { LeagueRow } from '../components/home/useHomeData'

const LeagueStats = lazy(() => import('../components/league/sections').then(module => ({ default: module.LeagueStats })))
const fetchLeagues = () => fetch('/api/leagues').then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json() as Promise<{ data: LeagueRow[] }> }).then(response => response.data)

export default function LeagueProfile() {
  const { leagueId = '' } = useParams()
  const league = useAsync<LeagueDetail>(() => fetchLeague(leagueId), [leagueId])
  const leagues = useAsync<LeagueRow[]>(fetchLeagues, [])
  const [query, setQuery] = useState('')
  const data = league.data
  const facts = data ? deriveFacts(data, leagues.data ?? []) : null

  useSeo({
    title: data ? `${data.name} Football: Ladder, Rankings, Results & Goal Kickers ${seasonYear(data)} | PlayFooty` : 'League | PlayFooty',
    description: data && facts
      ? [data.description || `${data.name} Senior football on PlayFooty${facts.nationalRank != null ? `: the #${facts.nationalRank} ranked league in Australia` : ''}.`, `Live ladder, national club rankings, leading goal kickers and ${strengthLabel(facts.stars).toLowerCase()} ${facts.stars}/5 strength rating`, facts.leader ? `${facts.leader.clubName} lead the ladder.` : '', 'Updated every week of the season.'].filter(Boolean).join(' ')
      : 'Country football league ladder, goal kickers, national rankings and strength rating, updated weekly.',
    path: `/league/${leagueId}`,
    jsonLd: data && facts ? buildJsonLd(data, facts, leagueId) : undefined,
  })

  return <div className="league-profile-page" style={{ background: '#ffffff', minHeight: '100vh' }}>
    <Nav />
    <ProductSearch />
    <LeagueLadderPolish />
    <main id="main-content">
      {league.loading && <HeroSkeleton />}
      {league.error && <div className="font-condensed" style={{ minHeight: '50vh', display: 'grid', placeItems: 'center', color: '#dc2626', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, fontSize: 13 }}>League not found</div>}
      {data && facts && <>
        <LeagueHero league={data} facts={facts} />
        <LeagueSubnav />
        <LeagueSnapshot league={data} facts={facts} />
        <LeagueLiveData league={data} />
        <div className="league-profile-shell">
          <div className="league-profile-main">
            <LeaguePublicInformation leagueId={leagueId} />
            <LeagueMvpPanel leagueId={leagueId} leagueName={data.name} />
            <LeagueHubExtras league={data} />
            <LeagueLadder league={data} query={query} onQuery={setQuery} />
            <ClubRankingCards league={data} query={query} totalRanked={data.totalRanked} />
            <LeagueStrength league={data} facts={facts} />
            <LeagueNews leagueName={data.name} />
            <Suspense fallback={<div style={{ minHeight: 280 }} aria-hidden />}><LeagueStats league={data} facts={facts} /></Suspense>
            <RelatedLeagues league={data} allLeagues={leagues.data ?? []} />
          </div>
          <LeagueSidebar league={data} facts={facts} />
        </div>
        <style>{`
          .league-profile-page,.league-profile-page #main-content{width:100%;max-width:100%;min-width:0;overflow-x:clip}
          .league-profile-page #main-content>*{max-width:100%;min-width:0}
          .league-profile-shell{width:100%;max-width:1180px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:18px;align-items:start;padding:24px 20px 48px}
          .league-profile-main{display:grid;gap:18px;min-width:0;width:100%;overflow:hidden}
          .league-profile-main > section{min-width:0;max-width:100%;padding-left:0!important;padding-right:0!important}
          .league-profile-main > section > div{max-width:none!important;min-width:0!important}
          .league-sidebar{width:320px;min-width:0;max-width:320px}
          @media (max-width:1280px){
            .league-profile-shell{display:block;width:100%;max-width:1180px;padding:22px 20px 44px}
            .league-profile-main{width:100%;max-width:100%;overflow:hidden}
            .league-sidebar{display:none!important}
          }
          @media (max-width:980px){
            .league-profile-page,.league-profile-page #main-content{width:100vw!important;max-width:100vw!important;min-width:0!important;margin:0!important;transform:none!important;zoom:1!important}
            .league-profile-page #main-content>*{width:100%!important;max-width:100%!important;min-width:0!important}
            .league-profile-shell{display:block;width:100%!important;max-width:100%!important;min-width:0!important;padding:18px 14px 36px;margin:0!important}
            .league-profile-main{width:100%!important;max-width:100%!important;min-width:0!important;overflow:hidden}
            .league-profile-main > section{width:100%!important;max-width:100%!important;min-width:0!important;padding-top:22px!important;padding-bottom:22px!important}
          }
        `}</style>
      </>}
    </main>
    <Footer />
  </div>
}

function seasonYear(detail: LeagueDetail): string { return detail.currentSeason?.match(/\d{4}/)?.[0] ?? String(new Date().getFullYear()) }
function HeroSkeleton() { return <div style={{ background: '#0c0e13', padding: '52px 20px 46px' }}><div style={{ maxWidth: 1120, margin: '0 auto' }}><Skel w={200} h={12} style={{ marginBottom: 30, background: 'rgba(255,255,255,0.08)' }} /><Skel w="55%" h={64} style={{ marginBottom: 18, background: 'rgba(255,255,255,0.1)' }} /><Skel w={280} h={14} style={{ background: 'rgba(255,255,255,0.08)' }} /><span className="font-condensed" style={{ display: 'block', marginTop: 22, color: MUTE, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Loading league</span></div></div> }

function buildJsonLd(detail: LeagueDetail, facts: NonNullable<ReturnType<typeof deriveFacts>>, leagueId: string) {
  const base = 'https://playfooty.com.au'
  const url = `${base}/league/${leagueId}`
  const faqs: { q: string; a: string }[] = []
  if (facts.nationalRank != null) faqs.push({ q: `How strong is the ${detail.name} in football?`, a: `The ${detail.name} is currently the #${facts.nationalRank} ranked community football league of ${facts.leagueCount} tracked in Australia, with a ${strengthLabel(strengthStars(detail.strengthScore)).toLowerCase()} strength rating of ${strengthStars(detail.strengthScore)}/5 on PlayFooty.` })
  if (facts.leader) faqs.push({ q: `Who is on top of the ${detail.name} football ladder?`, a: `${facts.leader.clubName} currently lead the ${detail.name} Senior ladder with a ${facts.leader.wins}-${facts.leader.losses} record${facts.leader.points ? ` and ${facts.leader.points} points` : ''}.` })
  if (facts.bestClub) faqs.push({ q: `Which ${detail.name} club is ranked highest in Australia?`, a: `${facts.bestClub.clubName} is the highest nationally ranked club in the ${detail.name}, at #${facts.bestClub.rank} in Australia with a power rating of ${facts.bestClub.powerRating.toFixed(1)}.` })
  const story = weeklyStory(detail, facts)
  return [
    { '@context': 'https://schema.org', '@type': 'SportsOrganization', '@id': `${url}#league`, name: detail.name, sport: 'Football', url, areaServed: { '@type': 'State', name: detail.stateName ?? detail.state }, ...(detail.description || story ? { description: detail.description || `${detail.name} Senior football. ${story}` } : {}), ...(detail.logoUrl ? { logo: detail.logoUrl } : {}), ...(detail.websiteUrl ? { sameAs: [detail.websiteUrl, detail.facebookUrl].filter(Boolean) } : {}), memberOf: { '@type': 'Organization', name: 'PlayFooty', url: base } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: base }, { '@type': 'ListItem', position: 2, name: 'Leagues', item: `${base}/leagues` }, { '@type': 'ListItem', position: 3, name: detail.name, item: url }] },
    ...(faqs.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(item => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })) }] : []),
  ]
}
