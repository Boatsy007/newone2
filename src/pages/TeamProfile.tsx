/**
 * Club page: each club's premium digital home. Section tabs expose the
 * existing live club content without changing its data sources or route.
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

type ClubTab = 'news' | 'information' | 'photos' | 'sponsors' | 'stats' | 'related'

const CLUB_TABS: { id: ClubTab; label: string }[] = [
  { id: 'news', label: 'Club news' },
  { id: 'information', label: 'Information' },
  { id: 'photos', label: 'Photos' },
  { id: 'sponsors', label: 'Sponsors' },
  { id: 'stats', label: 'Stats' },
  { id: 'related', label: 'Related clubs' },
]

export default function TeamProfile() {
  const { clubId = '' } = useParams()
  const [activeTab, setActiveTab] = useState<ClubTab>('news')
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
              <div role="tablist" aria-label={`${data.clubName} profile sections`}>
                {CLUB_TABS.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    className={activeTab === tab.id ? 'active' : ''}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </nav>

            <div className="club-section-bg">
              <div className="club-profile-area" role="tabpanel">
                <div className="club-profile-main">
                  {activeTab === 'news' && (
                    <div className="club-feed-card">
                      <Suspense fallback={<div style={{ minHeight: 360 }} aria-hidden />}>
                        <ClubNews club={data} />
                      </Suspense>
                    </div>
                  )}

                  {activeTab === 'information' && <div className="club-feed-card"><ClubInfo club={data} /></div>}
                  {activeTab === 'photos' && <div className="club-feed-card"><ClubGallery club={data} /></div>}
                  {activeTab === 'sponsors' && <div className="club-feed-card"><ClubSponsors club={data} /></div>}

                  {activeTab === 'stats' && (
                    <div className="club-stats-stack">
                      <ClubSnapshot club={data} />
                      <Suspense fallback={<div style={{ minHeight: 320 }} aria-hidden />}>
                        <ClubJourney club={data} />
                      </Suspense>
                      <Suspense fallback={<div style={{ minHeight: 300 }} aria-hidden />}>
                        <ClubWhy club={data} reasoning={explain.data?.reasoning} />
                      </Suspense>
                      <ClubLadder club={data} />
                      <ClubClaim club={data} />
                    </div>
                  )}

                  {activeTab === 'related' && <div className="club-feed-card"><RelatedClubs club={data} /></div>}
                </div>
                <aside className="club-profile-sidebar"><ClubSidebar club={data} /></aside>
              </div>
            </div>

            <style>{`
              .club-profile-tabs{position:sticky;top:0;z-index:8;background:#fff;border-bottom:1px solid #e3e7ec;box-shadow:0 4px 14px rgba(17,24,39,.04)}
              .club-profile-tabs>div{max-width:1180px;margin:0 auto;display:flex;gap:2px;padding:0 20px;overflow-x:auto;scrollbar-width:none}
              .club-profile-tabs>div::-webkit-scrollbar{display:none}
              .club-profile-tabs button{position:relative;flex:0 0 auto;min-height:58px;padding:0 18px;border:0;background:transparent;color:#687385;font-family:'Bebas Neue',Impact,'Arial Narrow Bold',sans-serif;font-size:21px;letter-spacing:.035em;text-transform:uppercase;white-space:nowrap;cursor:pointer}
              .club-profile-tabs button:after{content:'';position:absolute;left:14px;right:14px;bottom:0;height:4px;border-radius:4px 4px 0 0;background:transparent}
              .club-profile-tabs button.active{color:#050505}.club-profile-tabs button.active:after{background:#42b8ff}
              .club-section-bg{background:#f3f5f7;min-height:420px}
              .club-profile-area{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:18px;align-items:start;padding:28px 20px 48px}
              .club-profile-main>section,.club-feed-card>section,.club-stats-stack>section{padding-left:0!important;padding-right:0!important}
              .club-profile-main>section>div,.club-feed-card>section>div,.club-stats-stack>section>div{max-width:none!important}
              .club-feed-card{overflow:hidden;border:1px solid #e0e5ea;border-radius:12px;background:#fff;box-shadow:0 5px 18px rgba(17,24,39,.055)}
              .club-stats-stack{display:grid;gap:18px}.club-stats-stack>section{overflow:hidden;border:1px solid #e0e5ea;border-radius:12px;background:#fff;box-shadow:0 5px 18px rgba(17,24,39,.055)}
              .club-profile-sidebar{position:sticky;top:78px}
              @media (max-width:980px){
                .club-profile-tabs>div{padding:0 10px}.club-profile-tabs button{min-height:54px;padding:0 14px;font-size:19px}.club-profile-tabs button:after{left:10px;right:10px}
                .club-profile-area{display:block;padding:18px 14px 36px}.club-profile-sidebar{position:static;margin-top:18px}
                .club-profile-main>section,.club-feed-card>section,.club-stats-stack>section{padding-top:20px!important;padding-bottom:20px!important}
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
