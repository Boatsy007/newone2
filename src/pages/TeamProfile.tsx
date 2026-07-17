/**
 * Club page: each club's premium digital home. Feed is the default view and
 * Stats preserves the existing ranking, ladder and performance sections.
 * Every figure remains sourced from the existing live club response.
 */
import { lazy, Suspense, useState } from 'react'
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

type ClubTab = 'feed' | 'stats'

export default function TeamProfile() {
  const { clubId = '' } = useParams()
  const [activeTab, setActiveTab] = useState<ClubTab>('feed')
  const club = useAsync<ClubProfile>(() => fetchClub(clubId), [clubId])
  const explain = useAsync<ClubExplanation | null>(
    () => fetchClubExplain(clubId).catch(() => null),
    [clubId],
  )
  const data = club.data

  useSeo({
    title: data ? seoTitle(data) : 'Club | PlayFooty',
    description: data ? seoDesc(data) : 'Country football club profile, national ranking and current form.',
    path: `/team/${clubId}`,
    jsonLd: data ? buildJsonLd(data, clubId) : undefined,
  })

  return (
    <div style={{ background: '#ffffff', minHeight: '100vh' }}>
      <Nav />
      <ProductSearch />
      <main id="main-content">
        {club.loading && <HeroSkeleton />}
        {club.error && (
          <div className="font-condensed" style={{ minHeight: '50vh', display: 'grid', placeItems: 'center', color: '#dc2626', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, fontSize: 13 }}>
            Club not found
          </div>
        )}
        {data && (
          <>
            <ClubHero club={data} />
            <nav className="club-profile-tabs" aria-label="Club profile sections">
              <div role="tablist" aria-label={`${data.clubName} profile views`}>
                <button type="button" role="tab" aria-selected={activeTab === 'feed'} className={activeTab === 'feed' ? 'active' : ''} onClick={() => setActiveTab('feed')}>Feed</button>
                <button type="button" role="tab" aria-selected={activeTab === 'stats'} className={activeTab === 'stats' ? 'active' : ''} onClick={() => setActiveTab('stats')}>Stats</button>
              </div>
            </nav>

            {activeTab === 'feed' && (
              <div className="club-profile-area club-feed-area" role="tabpanel">
                <div className="club-profile-main club-feed-main">
                  <div className="club-feed-intro">
                    <span>Club feed</span>
                    <strong>{data.clubName}</strong>
                    <p>Latest club stories, updates and profile information.</p>
                  </div>
                  <div className="club-feed-card">
                    <Suspense fallback={<div style={{ minHeight: 360 }} aria-hidden />}>
                      <ClubNews club={data} />
                    </Suspense>
                  </div>
                  <div className="club-feed-card"><ClubInfo club={data} /></div>
                  <div className="club-feed-card"><ClubGallery club={data} /></div>
                  <div className="club-feed-card"><ClubSponsors club={data} /></div>
                </div>
                <aside className="club-profile-sidebar"><ClubSidebar club={data} /></aside>
              </div>
            )}

            {activeTab === 'stats' && (
              <div role="tabpanel" className="club-stats-panel">
                <ClubSnapshot club={data} />
                <div className="club-profile-area">
                  <div className="club-profile-main">
                    <Suspense fallback={<div style={{ minHeight: 320 }} aria-hidden />}>
                      <ClubJourney club={data} />
                    </Suspense>
                    <Suspense fallback={<div style={{ minHeight: 300 }} aria-hidden />}>
                      <ClubWhy club={data} reasoning={explain.data?.reasoning} />
                    </Suspense>
                    <ClubLadder club={data} />
                    <RelatedClubs club={data} />
                    <ClubClaim club={data} />
                  </div>
                  <aside className="club-profile-sidebar"><ClubSidebar club={data} /></aside>
                </div>
              </div>
            )}

            <style>{`
              .club-profile-tabs{position:sticky;top:0;z-index:8;background:#fff;border-bottom:1px solid #e3e7ec;box-shadow:0 4px 14px rgba(17,24,39,.04)}
              .club-profile-tabs>div{max-width:1180px;margin:0 auto;display:flex;gap:8px;padding:0 20px}
              .club-profile-tabs button{position:relative;min-width:112px;min-height:58px;padding:0 22px;border:0;background:transparent;color:#687385;font-family:'Bebas Neue',Impact,'Arial Narrow Bold',sans-serif;font-size:24px;letter-spacing:.035em;text-transform:uppercase;cursor:pointer}
              .club-profile-tabs button:after{content:'';position:absolute;left:18px;right:18px;bottom:0;height:4px;border-radius:4px 4px 0 0;background:transparent}
              .club-profile-tabs button.active{color:#050505}.club-profile-tabs button.active:after{background:#42b8ff}
              .club-profile-area{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:18px;align-items:start;padding:30px 20px 48px}
              .club-feed-area{background:#f3f5f7;max-width:none;padding-left:max(20px,calc((100% - 1180px)/2));padding-right:max(20px,calc((100% - 1180px)/2))}
              .club-profile-main>section,.club-feed-card>section{padding-left:0!important;padding-right:0!important}
              .club-profile-main>section>div,.club-feed-card>section>div{max-width:none!important}
              .club-feed-main{display:grid;gap:18px}.club-feed-card{overflow:hidden;border:1px solid #e0e5ea;border-radius:12px;background:#fff;box-shadow:0 5px 18px rgba(17,24,39,.055)}
              .club-feed-intro{padding:22px 24px;border:1px solid #e0e5ea;border-radius:12px;background:#fff;box-shadow:0 5px 18px rgba(17,24,39,.055)}
              .club-feed-intro span{display:block;color:#42b8ff;font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase}
              .club-feed-intro strong{display:block;margin-top:5px;font-family:'Bebas Neue',Impact,'Arial Narrow Bold',sans-serif;font-size:34px;line-height:1;text-transform:uppercase}
              .club-feed-intro p{margin:8px 0 0;color:#687385;font-size:14px}
              .club-profile-sidebar{position:sticky;top:78px}.club-stats-panel{background:#fff}
              @media (max-width:980px){
                .club-profile-tabs{top:0}.club-profile-tabs>div{padding:0 14px}.club-profile-tabs button{min-height:54px;min-width:96px;font-size:22px}
                .club-profile-area,.club-feed-area{display:block;padding:18px 14px 36px}.club-profile-sidebar{position:static;margin-top:18px}
                .club-profile-main>section,.club-feed-card>section{padding-top:20px!important;padding-bottom:20px!important}
                .club-feed-intro{padding:19px 18px}.club-feed-intro strong{font-size:30px}
              }
            `}</style>
          </>
        )}
      </main>
      <Footer />
    </div>
  )
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
  return (
    <div style={{ background: '#0c0e13', padding: '48px 20px 44px' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <Skel w={220} h={12} style={{ marginBottom: 28, background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
          <Skel w={92} h={92} r={20} style={{ background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ flex: 1 }}>
            <Skel w="55%" h={56} style={{ marginBottom: 12, background: 'rgba(255,255,255,0.1)' }} />
            <Skel w={260} h={14} style={{ background: 'rgba(255,255,255,0.08)' }} />
          </div>
        </div>
        <span className="font-condensed" style={{ display: 'block', marginTop: 22, color: MUTE, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Loading club</span>
      </div>
    </div>
  )
}

function buildJsonLd(d: ClubProfile, clubId: string) {
  const base = 'https://playfooty.com.au'
  const url = `${base}/team/${clubId}`
  const faqs: { q: string; a: string }[] = []
  if (d.rank != null) faqs.push({
    q: `What is ${d.clubName}'s national football ranking?`,
    a: `${d.clubName} is ranked #${d.rank} in Australia's community football Senior rankings on PlayFooty, with a power rating of ${d.powerRating?.toFixed(1) ?? '0.0'}${d.leagueName ? ` playing in the ${d.leagueName.replace(/\s*-\s*a grade.*/i, '')}` : ''}.`,
  })
  if (d.record.played > 0) faqs.push({
    q: `How is ${d.clubName} going this season?`,
    a: `${d.clubName} have a ${d.record.wins}-${d.record.losses}${d.record.draws ? `-${d.record.draws}` : ''} record${d.ladderPosition != null ? `, sitting ${ordinal(d.ladderPosition)} on the ladder` : ''}${d.percentage > 0 ? ` with a percentage of ${d.percentage.toFixed(0)}%` : ''}.`,
  })
  if (d.leagueName && d.leagueStrengthScore != null) faqs.push({
    q: `What league does ${d.clubName} play in?`,
    a: `${d.clubName} plays Senior football in the ${d.leagueName.replace(/\s*-\s*a grade.*/i, '')}, a ${strengthLabel(strengthStars(d.leagueStrengthScore)).toLowerCase()} ${strengthStars(d.leagueStrengthScore)}-star community football competition.`,
  })

  return [
    {
      '@context': 'https://schema.org', '@type': 'SportsTeam', '@id': `${url}#club`,
      name: d.clubName, sport: 'Football', url,
      ...(d.logoUrl ? { logo: d.logoUrl } : {}),
      ...(d.leagueName ? { memberOf: { '@type': 'SportsOrganization', name: d.leagueName.replace(/\s*-\s*a grade.*/i, '') } } : {}),
      ...(d.town || d.stateName ? { location: { '@type': 'Place', name: [d.town, d.stateName ?? d.state].filter(Boolean).join(', ') } } : {}),
      ...(d.websiteUrl ? { sameAs: [d.websiteUrl, d.facebookUrl, d.instagramUrl].filter(Boolean) } : {}),
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: base },
        ...(d.leagueId && d.leagueName ? [{ '@type': 'ListItem', position: 2, name: d.leagueName, item: `${base}/league/${d.leagueId}` }] : [{ '@type': 'ListItem', position: 2, name: 'Clubs', item: `${base}/directory` }]),
        { '@type': 'ListItem', position: 3, name: d.clubName, item: url },
      ],
    },
    ...(faqs.length ? [{
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    }] : []),
  ]
}
