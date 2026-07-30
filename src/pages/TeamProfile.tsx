/**
 * Club page: each club's premium digital home. Section tabs expose the
 * existing live club content without changing its data sources or route.
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import Nav from '../components/layout/Nav'
import ProductSearch from '../components/rankings/ProductSearch'
import Footer from '../components/layout/Footer'
import ClubLiveHub from '../components/club/ClubLiveHub'
import ClubTeamSheet from '../components/club/ClubTeamSheetPortal'
import ClubSponsorsLive from '../components/club/ClubSponsorsLive'
import PublicClubGallery from '../components/club/PublicClubGallery'
import PublicGoalKickersPanel from '../components/goal-kickers/PublicGoalKickersPanel'
import { useSeo } from '../lib/seo'
import { fetchClub, fetchClubExplain, useAsync, strengthLabel, strengthStars, type ClubProfile, type ClubExplanation } from '../lib/rankings'
import { Skel, MUTE } from '../components/home/ui'
import { ClubHero, ClubSnapshot, ClubLadder, RelatedClubs, ClubSidebar, ordinal } from '../components/club/sections'

const ClubWhy = lazy(() => import('../components/club/sections').then(m => ({ default: m.ClubWhy })))
const ClubJourney = lazy(() => import('../components/club/sections').then(m => ({ default: m.ClubJourney })))
const ClubNews = lazy(() => import('../components/club/sections').then(m => ({ default: m.ClubNews })))

type ClubTab = 'overview' | 'match-centre' | 'news' | 'stats' | 'highlights' | 'sponsors' | 'related' | 'team-selection'

const CLUB_TABS: { id: Exclude<ClubTab, 'team-selection'>; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'match-centre', label: 'Match Center' },
  { id: 'news', label: 'Club news' },
  { id: 'stats', label: 'Stats' },
  { id: 'highlights', label: 'Highlights' },
  { id: 'sponsors', label: 'Sponsors' },
  { id: 'related', label: 'Related clubs' },
]

export default function TeamProfile() {
  const { clubId = '' } = useParams()
  const location = useLocation()
  const [activeTab, setActiveTab] = useState<ClubTab>('overview')
  const [teamSelectionOpened, setTeamSelectionOpened] = useState(false)
  const club = useAsync<ClubProfile>(() => fetchClub(clubId), [clubId])
  const explain = useAsync<ClubExplanation | null>(() => fetchClubExplain(clubId).catch(() => null), [clubId])
  const data = club.data

  useEffect(() => {
    if (new URLSearchParams(location.search).get('tab') === 'team-selection') {
      setTeamSelectionOpened(true)
      setActiveTab('team-selection')
    }
  }, [location.search, clubId])

  useSeo({
    title: data ? seoTitle(data) : 'Club | PlayFooty',
    description: data ? seoDesc(data) : 'Country football club profile, national ranking and current form.',
    path: `/team/${clubId}`,
    jsonLd: data ? buildJsonLd(data, clubId) : undefined,
  })

  return (
    <div className={`club-profile-page club-tab-${activeTab}`} style={{ background: '#ffffff', minHeight: '100vh' }}>
      <Nav />
      <ProductSearch />
      <main id="main-content">
        {club.loading && <HeroSkeleton />}
        {club.error && <div className="font-condensed" style={{ minHeight: '50vh', display: 'grid', placeItems: 'center', color: '#dc2626', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, fontSize: 13 }}>Club not found</div>}
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
                  {activeTab === 'overview' && (
                    <div className="club-overview-stack">
                      <div className="club-feed-card"><ClubSponsorsLive club={data} /></div>
                      <div className="club-live-overview-only"><ClubLiveHub club={data} /></div>
                      <ClubInformationPanel club={data} />
                    </div>
                  )}

                  {activeTab === 'match-centre' && <div className="club-match-centre-stack club-live-matches-only"><ClubLiveHub club={data} /></div>}

                  <div className="club-team-selection-stack" style={{ display: activeTab === 'team-selection' ? 'grid' : 'none' }} aria-hidden={activeTab !== 'team-selection'}>
                    {teamSelectionOpened && <ClubTeamSheet clubId={clubId} />}
                  </div>

                  {activeTab === 'news' && <div className="club-feed-card"><Suspense fallback={<div style={{ minHeight: 360 }} aria-hidden />}><ClubNews club={data} /></Suspense></div>}

                  {activeTab === 'stats' && (
                    <div className="club-stats-stack">
                      <PublicGoalKickersPanel clubId={clubId} eyebrow={`${data.season?.match(/\d{4}/)?.[0] ?? new Date().getFullYear()} club leaders`} title="Leading goal kickers" />
                      <ClubSnapshot club={data} />
                      <Suspense fallback={<div style={{ minHeight: 320 }} aria-hidden />}><ClubJourney club={data} /></Suspense>
                      <Suspense fallback={<div style={{ minHeight: 300 }} aria-hidden />}><ClubWhy club={data} reasoning={explain.data?.reasoning} /></Suspense>
                      <ClubLadder club={data} />
                    </div>
                  )}

                  {activeTab === 'highlights' && (
                    <div className="club-highlights-stack">
                      <div className="club-feed-card"><PublicClubGallery club={data} /></div>
                      <div className="club-live-highlights-only"><ClubLiveHub club={data} /></div>
                    </div>
                  )}

                  {activeTab === 'sponsors' && <div className="club-feed-card"><ClubSponsorsLive club={data} /></div>}
                  {activeTab === 'related' && <div className="club-feed-card"><RelatedClubs club={data} /></div>}
                </div>
                <aside className="club-profile-sidebar"><ClubSidebar club={data} /></aside>
              </div>
            </div>

            <style>{`
              .club-profile-tabs{position:sticky;top:0;z-index:8;background:#fff;border-bottom:1px solid #e3e7ec;box-shadow:0 4px 14px rgba(17,24,39,.04)}
              .club-profile-tabs>div{max-width:1180px;margin:0 auto;display:flex;gap:2px;padding:0 20px;overflow-x:auto;scrollbar-width:none}.club-profile-tabs>div::-webkit-scrollbar{display:none}
              .club-profile-tabs button{position:relative;flex:0 0 auto;min-height:58px;padding:0 18px;border:0;background:transparent;color:#687385;font-family:'Bebas Neue',Impact,'Arial Narrow Bold',sans-serif;font-size:21px;letter-spacing:.035em;text-transform:uppercase;white-space:nowrap;cursor:pointer}
              .club-profile-tabs button:after{content:'';position:absolute;left:14px;right:14px;bottom:0;height:4px;border-radius:4px 4px 0 0;background:transparent}.club-profile-tabs button.active{color:#050505}.club-profile-tabs button.active:after{background:#42b8ff}
              .club-section-bg{background:#f3f5f7;min-height:420px}.club-profile-area{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:18px;align-items:start;padding:28px 20px 48px}
              .club-overview-stack,.club-match-centre-stack,.club-team-selection-stack,.club-highlights-stack{display:grid;gap:18px}
              .club-tab-overview #pf-club-mvp-slot,.club-tab-match-centre #pf-club-mvp-slot,.club-tab-news #pf-club-mvp-slot,.club-tab-highlights #pf-club-mvp-slot,.club-tab-sponsors #pf-club-mvp-slot,.club-tab-related #pf-club-mvp-slot,.club-tab-team-selection #pf-club-mvp-slot{display:none!important}

              .club-live-overview-only .club-live-hub>.club-feature-match,.club-live-overview-only .club-live-hub>.club-last-match,.club-live-overview-only .club-live-hub>.public-gk-panel,.club-live-overview-only .club-live-hub>.club-live-card:last-of-type{display:none!important}
              .club-live-overview-only .club-live-columns{grid-template-columns:1fr!important}.club-live-overview-only .club-live-columns>section:nth-child(2){display:none!important}
              .club-live-matches-only .club-live-summary,.club-live-matches-only .public-gk-panel,.club-live-matches-only .club-live-columns,.club-live-matches-only .club-live-hub>.club-live-card:last-of-type{display:none!important}
              .club-live-highlights-only .club-live-summary,.club-live-highlights-only .club-feature-match,.club-live-highlights-only .club-last-match,.club-live-highlights-only .public-gk-panel,.club-live-highlights-only .club-live-columns{display:none!important}

              .club-profile-main>section,.club-feed-card>section,.club-stats-stack>section{padding-left:0!important;padding-right:0!important}.club-profile-main>section>div,.club-feed-card>section>div,.club-stats-stack>section>div{max-width:none!important}
              .club-feed-card,.club-info-panel{overflow:hidden;border:1px solid #e0e5ea;border-radius:12px;background:#fff;box-shadow:0 5px 18px rgba(17,24,39,.055)}.club-stats-stack,.club-info-stack{display:grid;gap:18px}.club-stats-stack>section{overflow:hidden;border:1px solid #e0e5ea;border-radius:12px;background:#fff;box-shadow:0 5px 18px rgba(17,24,39,.055)}
              .club-info-panel{padding:24px}.club-info-kicker{display:block;color:#42b8ff;font-size:11px;font-weight:900;letter-spacing:.17em;text-transform:uppercase}.club-info-title{margin:6px 0 12px;font-family:'Bebas Neue',Impact,'Arial Narrow Bold',sans-serif;font-size:36px;line-height:1;text-transform:uppercase;color:#111318}.club-info-bio{margin:0;color:#46515f;font-size:15px;line-height:1.65;white-space:pre-wrap}
              .club-contact-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:18px}.club-contact-item{min-width:0;padding:15px;border:1px solid #e3e7ec;border-radius:9px;background:#f8fafb}.club-contact-item span{display:block;color:#687385;font-size:10px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.club-contact-item strong,.club-contact-item a{display:block;margin-top:5px;color:#111318;font-size:14px;font-weight:800;line-height:1.35;text-decoration:none;overflow-wrap:anywhere;white-space:pre-wrap}.club-contact-item a:hover{color:#209fe9}.club-profile-sidebar{position:sticky;top:78px}
              @media(max-width:980px){.club-profile-tabs>div{padding:0 10px}.club-profile-tabs button{min-height:54px;padding:0 14px;font-size:19px}.club-profile-tabs button:after{left:10px;right:10px}.club-profile-area{display:block;padding:18px 14px 36px}.club-profile-sidebar{position:static;margin-top:18px}.club-profile-main>section,.club-feed-card>section,.club-stats-stack>section{padding-top:20px!important;padding-bottom:20px!important}.club-info-panel{padding:19px}.club-info-title{font-size:31px}.club-contact-grid{grid-template-columns:1fr}}
            `}</style>
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}

function ClubInformationPanel({ club }: { club: ClubProfile }) {
  const extra = club as ClubProfile & Record<string, unknown>
  const read = (...keys: string[]) => keys.map(key => extra[key]).find(value => typeof value === 'string' && value.trim()) as string | undefined
  const location = club.stateName ?? club.state
  const bio = read('bio', 'description', 'about', 'clubBio', 'history') ?? `${club.clubName} is a community football club${club.town ? ` based in ${club.town}` : ''}${club.leagueName ? ` competing in ${club.leagueName}` : ''}${location ? ` in ${location}` : ''}. This profile brings together the club's latest news, information and current football performance.`
  const details = [
    ['Founded', read('foundedYear')], ['Club colours', read('clubColours')], ['Home ground', read('groundName', 'homeGround', 'venueName', 'ground')], ['Address', read('address', 'groundAddress', 'venueAddress')],
    ['Training nights', read('trainingNights')], ['Home facilities', read('homeCourt')], ['President', read('president', 'presidentName', 'clubPresident')], ['Secretary', read('secretary', 'secretaryName', 'clubSecretary')],
    ['Senior coach', read('coach')], ['Assistant coach', read('assistantCoach')], ['Committee', read('committee')], ['Email', read('email', 'clubEmail', 'contactEmail'), read('email', 'clubEmail', 'contactEmail') ? `mailto:${read('email', 'clubEmail', 'contactEmail')}` : undefined],
    ['Phone', read('phone', 'phoneNumber', 'clubPhone', 'contactPhone'), read('phone', 'phoneNumber', 'clubPhone', 'contactPhone') ? `tel:${read('phone', 'phoneNumber', 'clubPhone', 'contactPhone')?.replace(/\s/g, '')}` : undefined],
    ['Google Maps', read('googleMapsUrl') ? 'Open ground location' : undefined, read('googleMapsUrl')], ['Website', club.websiteUrl ?? undefined, club.websiteUrl ?? undefined], ['Facebook', club.facebookUrl ? 'Club Facebook' : undefined, club.facebookUrl ?? undefined],
    ['Instagram', club.instagramUrl ? 'Club Instagram' : undefined, club.instagramUrl ?? undefined], ['TikTok', read('tiktokUrl') ? 'Club TikTok' : undefined, read('tiktokUrl')], ['YouTube', read('youtubeUrl') ? 'Club YouTube' : undefined, read('youtubeUrl')],
    ['Membership', read('membershipLink') ? 'Join the club' : undefined, read('membershipLink')], ['Volunteer', read('volunteerLink') ? 'Volunteer with the club' : undefined, read('volunteerLink')],
  ].filter((row): row is [string, string, string?] => Boolean(row[1]))

  return <div className="club-info-stack">
    <section className="club-info-panel"><span className="club-info-kicker">About the club</span><h2 className="club-info-title">{club.clubName}</h2><p className="club-info-bio">{bio}</p></section>
    {details.length > 0 && <section className="club-info-panel"><span className="club-info-kicker">Club profile</span><h2 className="club-info-title">Information and contacts</h2><div className="club-contact-grid">
      {details.map(([label, value, href]) => <div key={label} className="club-contact-item"><span>{label}</span>{href ? <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noreferrer' : undefined}>{value}</a> : <strong>{value}</strong>}</div>)}
    </div></section>}
  </div>
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
  if (d.record.played > 0) bits.push(`${d.clubName} have a ${d.record.wins}-${d.record.losses}${d.record.draws ? `-${d.record.draws}` : ''} record${d.ladderPosition != null ? `, sitting ${ordinal(d.ladderPosition)} on the ladder` : ''}${d.percentage > 0 ? ` with a percentage of ${d.percentage.toFixed(0)}%` : ''}.`)
  bits.push('Live ladder, fixtures, results, goal kickers, form and national ranking, updated every week.')
  return bits.join(' ')
}
function HeroSkeleton() { return <div style={{ background: '#0c0e13', padding: '48px 20px 44px' }}><div style={{ maxWidth: 1120, margin: '0 auto' }}><Skel w={220} h={12} style={{ marginBottom: 28, background: 'rgba(255,255,255,0.08)' }} /><div style={{ display: 'flex', gap: 22, alignItems: 'center' }}><Skel w={92} h={92} r={20} style={{ background: 'rgba(255,255,255,0.1)' }} /><div style={{ flex: 1 }}><Skel w="55%" h={56} style={{ marginBottom: 12, background: 'rgba(255,255,255,0.1)' }} /><Skel w={260} h={14} style={{ background: 'rgba(255,255,255,0.08)' }} /></div></div><span className="font-condensed" style={{ display: 'block', marginTop: 22, color: MUTE, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Loading club</span></div></div> }
function buildJsonLd(d: ClubProfile, clubId: string) {
  const base = 'https://playfooty.com.au', url = `${base}/team/${clubId}`
  const faqs: { q: string; a: string }[] = []
  if (d.rank != null) faqs.push({ q: `What is ${d.clubName}'s national football ranking?`, a: `${d.clubName} is ranked #${d.rank} nationally on PlayFooty with a power rating of ${d.powerRating?.toFixed(1) ?? '0.0'}.` })
  if (d.record.played > 0) faqs.push({ q: `How is ${d.clubName} going this season?`, a: `${d.clubName} have a ${d.record.wins}-${d.record.losses}${d.record.draws ? `-${d.record.draws}` : ''} record${d.ladderPosition != null ? `, sitting ${ordinal(d.ladderPosition)} on the ladder` : ''}.` })
  if (d.leagueName && d.leagueStrengthScore != null) faqs.push({ q: `What league does ${d.clubName} play in?`, a: `${d.clubName} plays Senior football in the ${d.leagueName.replace(/\s*-\s*a grade.*/i, '')}, a ${strengthLabel(strengthStars(d.leagueStrengthScore)).toLowerCase()} ${strengthStars(d.leagueStrengthScore)}-star community football competition.` })
  return [{ '@context': 'https://schema.org', '@type': 'SportsTeam', '@id': `${url}#club`, name: d.clubName, sport: 'Football', url, ...(d.logoUrl ? { logo: d.logoUrl } : {}), ...(d.leagueName ? { memberOf: { '@type': 'SportsOrganization', name: d.leagueName.replace(/\s*-\s*a grade.*/i, '') } } : {}), ...(d.town || d.stateName ? { location: { '@type': 'Place', name: [d.town, d.stateName ?? d.state].filter(Boolean).join(', ') } } : {}), ...(d.websiteUrl ? { sameAs: [d.websiteUrl, d.facebookUrl, d.instagramUrl].filter(Boolean) } : {}) }, { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: base }, ...(d.leagueId && d.leagueName ? [{ '@type': 'ListItem', position: 2, name: d.leagueName, item: `${base}/league/${d.leagueId}` }] : [{ '@type': 'ListItem', position: 2, name: 'Clubs', item: `${base}/directory` }]), { '@type': 'ListItem', position: 3, name: d.clubName, item: url }] }, ...(faqs.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }] : [])]
}
