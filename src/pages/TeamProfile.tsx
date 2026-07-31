/**
 * Club page: each club's premium digital home. Section tabs expose the
 * existing live club content without changing its data sources or route.
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import Nav from '../components/layout/Nav'
import ProductSearch from '../components/rankings/ProductSearch'
import Footer from '../components/layout/Footer'
import ClubLiveHub from '../components/club/ClubLiveHubDetailed'
import ClubTeamSheet from '../components/club/ClubTeamSheetPortal'
import ClubSponsorsLive from '../components/club/ClubSponsorsLive'
import PublicClubGallery from '../components/club/PublicClubGallery'
import ClubUploadedLadder from '../components/club/ClubUploadedLadder'
import RelatedClubsWithLogos from '../components/club/RelatedClubsWithLogos'
import PublicGoalKickersPanel from '../components/goal-kickers/PublicGoalKickersPanel'
import { useSeo } from '../lib/seo'
import { fetchClub, fetchClubExplain, useAsync, strengthLabel, strengthStars, type ClubProfile, type ClubExplanation } from '../lib/rankings'
import { Skel, MUTE } from '../components/home/ui'
import { ClubHero, ClubSidebar, ordinal } from '../components/club/sections'

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

  const showSharedLive = activeTab === 'overview' || activeTab === 'match-centre' || activeTab === 'highlights'

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
                  <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
                ))}
              </div>
            </nav>

            <div className="club-section-bg">
              <div className="club-profile-area" role="tabpanel">
                <div className="club-profile-main">
                  <div id="playfooty-live-match-overview-slot" style={{ display: activeTab === 'overview' ? 'block' : 'none' }} />
                  <div className={`club-shared-live club-live-mode-${activeTab}`} style={{ display: showSharedLive ? 'grid' : 'none' }} aria-hidden={!showSharedLive}>
                    <div style={{ display: activeTab === 'overview' ? 'block' : 'none' }}><div className="club-feed-card"><ClubSponsorsLive club={data} /></div></div>
                    <div style={{ display: activeTab === 'overview' ? 'block' : 'none' }}><ClubAboutPanel club={data} /></div>
                    <div style={{ display: activeTab === 'highlights' ? 'block' : 'none' }}><div className="club-feed-card"><PublicClubGallery club={data} /></div></div>
                    <div className="club-live-shared-instance"><ClubLiveHub club={data} /></div>
                    <div style={{ display: activeTab === 'overview' ? 'block' : 'none' }}><ClubContactsPanel club={data} /></div>
                  </div>

                  <div className="club-team-selection-stack" style={{ display: activeTab === 'team-selection' ? 'grid' : 'none' }} aria-hidden={activeTab !== 'team-selection'}>{teamSelectionOpened && <ClubTeamSheet clubId={clubId} />}</div>
                  {activeTab === 'news' && <div className="club-feed-card"><Suspense fallback={<div style={{ minHeight: 360 }} aria-hidden />}><ClubNews club={data} /></Suspense></div>}
                  {activeTab === 'stats' && <div className="club-stats-stack"><PublicGoalKickersPanel clubId={clubId} eyebrow={`${data.season?.match(/\d{4}/)?.[0] ?? new Date().getFullYear()} club leaders`} title="Leading goal kickers" /><Suspense fallback={<div style={{ minHeight: 320 }} aria-hidden />}><ClubJourney club={data} /></Suspense><Suspense fallback={<div style={{ minHeight: 300 }} aria-hidden />}><ClubWhy club={data} reasoning={explain.data?.reasoning} /></Suspense><ClubUploadedLadder club={data} /></div>}
                  {activeTab === 'sponsors' && <div className="club-feed-card"><ClubSponsorsLive club={data} /></div>}
                  {activeTab === 'related' && <div className="club-feed-card"><RelatedClubsWithLogos club={data} /></div>}
                </div>
                <aside className="club-profile-sidebar"><ClubSidebar club={data} /></aside>
              </div>
            </div>

            <style>{`
              .club-profile-tabs{position:sticky;top:0;z-index:8;background:#fff;border-bottom:1px solid #e3e7ec;box-shadow:0 4px 14px rgba(17,24,39,.04)}
              .club-profile-tabs>div{max-width:1180px;margin:0 auto;display:flex;gap:2px;padding:0 20px;overflow-x:auto;scrollbar-width:none}.club-profile-tabs>div::-webkit-scrollbar{display:none}
              .club-profile-tabs button{position:relative;flex:0 0 auto;min-height:58px;padding:0 18px;border:0;background:transparent;color:#687385;font-family:'Bebas Neue',Impact,'Arial Narrow Bold',sans-serif;font-size:21px;letter-spacing:.035em;text-transform:uppercase;white-space:nowrap;cursor:pointer}
              .club-profile-tabs button:after{content:'';position:absolute;left:14px;right:14px;bottom:0;height:4px;border-radius:4px 4px 0 0;background:transparent}.club-profile-tabs button.active{color:#050505}.club-profile-tabs button.active:after{background:#42b8ff}
              .club-tab-news .club-feed-card h2 span,.club-tab-news .club-feed-card .gn-card>.font-condensed{color:var(--club-primary,#b49a60)!important}
              .club-section-bg{background:#f3f5f7;min-height:420px}.club-profile-area{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:18px;align-items:start;padding:28px 20px 48px}
              #playfooty-live-match-overview-slot:not(:empty){margin-bottom:18px}.club-shared-live,.club-team-selection-stack{gap:18px}.club-live-shared-instance{min-width:0}
              .club-tab-overview #pf-club-mvp-slot,.club-tab-match-centre #pf-club-mvp-slot,.club-tab-news #pf-club-mvp-slot,.club-tab-highlights #pf-club-mvp-slot,.club-tab-sponsors #pf-club-mvp-slot,.club-tab-related #pf-club-mvp-slot,.club-tab-team-selection #pf-club-mvp-slot{display:none!important}
              .club-live-mode-overview .club-live-hub>.club-feature-match,.club-live-mode-overview .club-live-hub>.club-last-match,.club-live-mode-overview .club-live-hub>.public-gk-panel,.club-live-mode-overview .club-live-hub>.club-live-card:last-of-type{display:none!important}
              .club-live-mode-overview .club-live-columns{grid-template-columns:1fr!important}.club-live-mode-overview .club-live-columns>section:nth-child(2){display:none!important}
              .club-live-mode-match-centre .club-live-summary,.club-live-mode-match-centre .public-gk-panel,.club-live-mode-match-centre .club-live-columns,.club-live-mode-match-centre .club-live-hub>.club-live-card:last-of-type{display:none!important}
              .club-live-mode-highlights .club-live-summary,.club-live-mode-highlights .club-feature-match,.club-live-mode-highlights .club-last-match,.club-live-mode-highlights .public-gk-panel,.club-live-mode-highlights .club-live-columns{display:none!important}
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

function readClubValue(club: ClubProfile, ...keys: string[]) { const extra = club as ClubProfile & Record<string, unknown>; return keys.map(key => extra[key]).find(value => typeof value === 'string' && value.trim()) as string | undefined }
function ClubAboutPanel({ club }: { club: ClubProfile }) { const location = club.stateName ?? club.state; const bio = readClubValue(club, 'bio', 'description', 'about', 'clubBio', 'history') ?? `${club.clubName} is a community football club${club.town ? ` based in ${club.town}` : ''}${club.leagueName ? ` competing in ${club.leagueName}` : ''}${location ? ` in ${location}` : ''}. This profile brings together the club's latest news, information and current football performance.`; return <section className="club-info-panel"><span className="club-info-kicker">About the club</span><h2 className="club-info-title">{club.clubName}</h2><p className="club-info-bio">{bio}</p></section> }
function ClubContactsPanel({ club }: { club: ClubProfile }) { const read = (...keys: string[]) => readClubValue(club, ...keys); const details = [['Founded', read('foundedYear')], ['Club colours', read('clubColours')], ['Home ground', read('groundName', 'homeGround', 'venueName', 'ground')], ['Address', read('address', 'groundAddress', 'venueAddress')], ['Training nights', read('trainingNights')], ['Home facilities', read('homeCourt')], ['President', read('president', 'presidentName', 'clubPresident')], ['Secretary', read('secretary', 'secretaryName', 'clubSecretary')], ['Senior coach', read('coach')], ['Assistant coach', read('assistantCoach')], ['Committee', read('committee')], ['Email', club.email, club.email ? `mailto:${club.email}` : undefined], ['Phone', club.phone, club.phone ? `tel:${club.phone}` : undefined], ['Website', club.websiteUrl, club.websiteUrl || undefined]].filter((item): item is [string,string,string?] => Boolean(item[1])); if (!details.length) return null; return <section className="club-info-panel"><span className="club-info-kicker">Club details</span><h2 className="club-info-title">Contact and information</h2><div className="club-contact-grid">{details.map(([label,value,href]) => <div className="club-contact-item" key={label}><span>{label}</span>{href ? <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noreferrer' : undefined}>{value}</a> : <strong>{value}</strong>}</div>)}</div></section> }
function HeroSkeleton() { return <div style={{ minHeight: 520, background: '#0c0e13', padding: '80px 20px' }}><div style={{ maxWidth: 1120, margin: '0 auto' }}><Skel h={18} w="35%" /><div style={{ height: 40 }} /><Skel h={80} w="70%" /></div></div> }
function seoTitle(c: ClubProfile) { return `${c.clubName} — Ranking, Results & Form | PlayFooty` }
function seoDesc(c: ClubProfile) { const record = c.record.played ? ` ${c.record.wins}-${c.record.losses}${c.record.draws ? `-${c.record.draws}` : ''} record.` : ''; return `${c.clubName}${c.leagueName ? ` in ${c.leagueName}` : ''}.${record}${c.rank ? ` Ranked #${c.rank} nationally.` : ''}` }
function buildJsonLd(c: ClubProfile, clubId: string) { return { '@context': 'https://schema.org', '@type': 'SportsTeam', name: c.clubName, sport: 'Australian rules football', url: `https://playfooty.com.au/team/${clubId}`, logo: c.logoUrl || undefined, memberOf: c.leagueName ? { '@type': 'SportsOrganization', name: c.leagueName } : undefined, location: c.town ? { '@type': 'Place', name: [c.town, c.stateName ?? c.state].filter(Boolean).join(', ') } : undefined } }
