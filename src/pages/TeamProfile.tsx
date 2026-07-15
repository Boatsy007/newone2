/**
 * Club page (Phase 4): the highest-traffic page on PlayFooty and each club's
 * premium digital home. Hero identity, snapshot, current ladder, rankings
 * journey, the rating explained, club news, and a claim CTA. Every figure is
 * real; missing data is invited, never invented. Route stays /team/:clubId.
 */
import { lazy, Suspense } from 'react'
import { useParams } from 'react-router-dom'
import Nav from '../components/layout/Nav'
import ProductSearch from '../components/rankings/ProductSearch'
import Footer from '../components/layout/Footer'
import { useSeo } from '../lib/seo'
import { fetchClub, fetchClubExplain, useAsync, strengthLabel, strengthStars, type ClubProfile, type ClubExplanation } from '../lib/rankings'
import { Skel, MUTE } from '../components/home/ui'
import { ClubHero, ClubSnapshot, ClubLadder, ClubClaim, ClubInfo, ClubGallery, ClubSponsors, RelatedClubs, ClubSidebar, ordinal } from '../components/club/sections'

const ClubWhy = lazy(() => import('../components/club/sections').then(m => ({ default: m.ClubWhy })))
const ClubJourney = lazy(() => import('../components/club/sections').then(m => ({ default: m.ClubJourney })))
const ClubNews = lazy(() => import('../components/club/sections').then(m => ({ default: m.ClubNews })))

type ClubWithGoalKicker = ClubProfile & {
  leadingGoalKicker?: { playerName: string; goals: number; matches: number | null; clubName: string; leagueName: string } | null
}

export default function TeamProfile() {
  const { clubId = '' } = useParams()
  const club = useAsync<ClubProfile>(() => fetchClub(clubId), [clubId])
  const explain = useAsync<ClubExplanation | null>(() => fetchClubExplain(clubId).catch(() => null), [clubId])
  const data = club.data as ClubWithGoalKicker | null

  useSeo({ title: data ? seoTitle(data) : 'Club | PlayFooty', description: data ? seoDesc(data) : 'Country football club profile, national ranking and current form.', path: `/team/${clubId}`, jsonLd: data ? buildJsonLd(data, clubId) : undefined })

  return (
    <div style={{ background: '#ffffff', minHeight: '100vh' }}>
      <Nav /><ProductSearch />
      <main id="main-content">
        {club.loading && <HeroSkeleton />}
        {club.error && <div className="font-condensed" style={{ minHeight: '50vh', display: 'grid', placeItems: 'center', color: '#dc2626', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, fontSize: 13 }}>Club not found</div>}
        {data && <>
          <ClubHero club={data} />
          <ClubSnapshot club={data} />
          <LeadingGoalKickerCard club={data} />
          <div className="club-profile-shell">
            <div className="club-profile-main">
              <Suspense fallback={<div style={{ minHeight: 320 }} aria-hidden />}><ClubJourney club={data} /></Suspense>
              <Suspense fallback={<div style={{ minHeight: 300 }} aria-hidden />}><ClubWhy club={data} reasoning={explain.data?.reasoning} /></Suspense>
              <ClubLadder club={data} />
              <Suspense fallback={<div style={{ minHeight: 360 }} aria-hidden />}><ClubNews club={data} /></Suspense>
              <ClubInfo club={data} /><ClubGallery club={data} /><ClubSponsors club={data} /><RelatedClubs club={data} /><ClubClaim club={data} />
            </div>
            <ClubSidebar club={data} />
          </div>
          <style>{`.club-profile-shell{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:18px;align-items:start;padding:0 20px 48px}.club-profile-main > section{padding-left:0!important;padding-right:0!important}.club-profile-main > section > div{max-width:none!important}@media (max-width:980px){.club-profile-shell{display:block;padding:0 14px 36px}.club-profile-main > section{padding-top:22px!important;padding-bottom:22px!important}}`}</style>
        </>}
      </main>
      <Footer />
    </div>
  )
}

function LeadingGoalKickerCard({ club }: { club: ClubWithGoalKicker }) {
  const leader = club.leadingGoalKicker
  if (!leader) return null
  return <section style={{ maxWidth: 1180, margin: '0 auto', padding: '0 20px 24px' }} aria-label="Leading goal kicker">
    <div className="gn-card" style={{ padding: '18px 20px', borderTop: '3px solid #d71920', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
      <div><div className="font-condensed" style={{ color: '#d71920', fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 7 }}>Leading goal kicker</div><strong className="font-display" style={{ display: 'block', fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', lineHeight: 1 }}>{leader.playerName}</strong><small className="font-condensed" style={{ color: '#65758b', display: 'block', marginTop: 6 }}>{leader.matches != null ? `${leader.matches} games · ` : ''}{leader.clubName}</small></div>
      <div style={{ textAlign: 'right' }}><strong className="font-display" style={{ display: 'block', fontSize: 'clamp(2rem, 5vw, 3.2rem)', lineHeight: .9, color: '#062a5f' }}>{leader.goals}</strong><span className="font-condensed" style={{ color: '#65758b', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Goals</span></div>
    </div>
  </section>
}

function seoTitle(d: ClubProfile): string {
  const yr = d.season?.match(/\d{4}/)?.[0] ?? String(new Date().getFullYear())
  if (d.rank != null) return `${d.clubName} Football: #${d.rank} in Australia, Ladder & Form ${yr} | PlayFooty`
  return `${d.clubName} Football: Profile, Ladder & Results ${yr} | PlayFooty`
}
function seoDesc(d: ClubProfile): string {
  const where = [d.town, d.leagueName?.replace(/\s*-\s*a grade.*/i, ''), d.stateName ?? d.state].filter(Boolean).join(', ')
  const bits = [`${d.clubName} community football on PlayFooty${where ? ` (${where})` : ''}.`]
  if (d.rank != null) bits.push(`Ranked #${d.rank} nationally with a power rating of ${d.powerRating?.toFixed(1) ?? '0.0'}.`)
  if (d.record.played > 0) bits.push(`${d.record.wins}-${d.record.losses} this season${d.ladderPosition != null ? `, ${ordinal(d.ladderPosition)} on the ladder` : ''}.`)
  bits.push('Live ladder, form and national ranking, updated every week.')
  return bits.join(' ')
}

function HeroSkeleton() {
  return <div style={{ background: '#0c0e13', padding: '48px 20px 44px' }}><div style={{ maxWidth: 1120, margin: '0 auto' }}><Skel w={220} h={12} style={{ marginBottom: 28, background: 'rgba(255,255,255,0.08)' }} /><div style={{ display: 'flex', gap: 22, alignItems: 'center' }}><Skel w={92} h={92} r={20} style={{ background: 'rgba(255,255,255,0.1)' }} /><div style={{ flex: 1 }}><Skel w="55%" h={56} style={{ marginBottom: 12, background: 'rgba(255,255,255,0.1)' }} /><Skel w={260} h={14} style={{ background: 'rgba(255,255,255,0.08)' }} /></div></div><span className="font-condensed" style={{ display: 'block', marginTop: 22, color: MUTE, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Loading club</span></div></div>
}

function buildJsonLd(d: ClubProfile, clubId: string) {
  const base = 'https://playfooty.com.au', url = `${base}/team/${clubId}`, faqs: { q: string; a: string }[] = []
  if (d.rank != null) faqs.push({ q: `What is ${d.clubName}'s national football ranking?`, a: `${d.clubName} is ranked #${d.rank} in Australia's community football Senior rankings on PlayFooty, with a power rating of ${d.powerRating?.toFixed(1) ?? '0.0'}${d.leagueName ? ` playing in the ${d.leagueName.replace(/\s*-\s*a grade.*/i, '')}` : ''}.` })
  if (d.record.played > 0) faqs.push({ q: `How is ${d.clubName} going this season?`, a: `${d.clubName} have a ${d.record.wins}-${d.record.losses}${d.record.draws ? `-${d.record.draws}` : ''} record${d.ladderPosition != null ? `, sitting ${ordinal(d.ladderPosition)} on the ladder` : ''}${d.percentage > 0 ? ` with a percentage of ${d.percentage.toFixed(0)}%` : ''}.` })
  if (d.leagueName && d.leagueStrengthScore != null) faqs.push({ q: `What league does ${d.clubName} play in?`, a: `${d.clubName} plays Senior football in the ${d.leagueName.replace(/\s*-\s*a grade.*/i, '')}, a ${strengthLabel(strengthStars(d.leagueStrengthScore)).toLowerCase()} ${strengthStars(d.leagueStrengthScore)}-star community football competition.` })
  return [{ '@context': 'https://schema.org', '@type': 'SportsTeam', '@id': `${url}#club`, name: d.clubName, sport: 'Football', url, ...(d.logoUrl ? { logo: d.logoUrl } : {}), ...(d.leagueName ? { memberOf: { '@type': 'SportsOrganization', name: d.leagueName.replace(/\s*-\s*a grade.*/i, '') } } : {}), ...(d.town || d.stateName ? { location: { '@type': 'Place', name: [d.town, d.stateName ?? d.state].filter(Boolean).join(', ') } } : {}), ...(d.websiteUrl ? { sameAs: [d.websiteUrl, d.facebookUrl, d.instagramUrl].filter(Boolean) } : {}) }, { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: base }, ...(d.leagueId && d.leagueName ? [{ '@type': 'ListItem', position: 2, name: d.leagueName, item: `${base}/league/${d.leagueId}` }] : [{ '@type': 'ListItem', position: 2, name: 'Clubs', item: `${base}/directory` }]), { '@type': 'ListItem', position: 3, name: d.clubName, item: url }] }, ...(faqs.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }] : [])]
}
