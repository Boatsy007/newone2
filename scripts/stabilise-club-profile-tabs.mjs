import { readFileSync, writeFileSync } from 'node:fs'

const path = 'src/pages/TeamProfile.tsx'
let source = readFileSync(path, 'utf8')
const original = source

const oldEffect = `  useEffect(() => {
    if (new URLSearchParams(location.search).get('tab') === 'team-selection') {
      setTeamSelectionOpened(true)
      setActiveTab('team-selection')
    }
  }, [location.search, clubId])`

const newEffect = `  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('tab') as ClubTab | null
    const validTabs: ClubTab[] = ['overview', 'match-centre', 'news', 'stats', 'highlights', 'sponsors', 'related', 'team-selection']
    const nextTab = requested && validTabs.includes(requested) ? requested : 'overview'
    setTeamSelectionOpened(nextTab === 'team-selection')
    setActiveTab(nextTab)
  }, [location.search, clubId])`

if (source.includes(oldEffect)) source = source.replace(oldEffect, newEffect)

const oldClick = `                    onClick={() => setActiveTab(tab.id)}`
const newClick = `                    onClick={() => {
                      setActiveTab(tab.id)
                      setTeamSelectionOpened(false)
                      const nextUrl = new URL(window.location.href)
                      nextUrl.searchParams.set('tab', tab.id)
                      window.history.replaceState(window.history.state, '', \`${'${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}'}\`)
                    }}`
if (source.includes(oldClick)) source = source.replace(oldClick, newClick)

const oldShared = `                  <div
                    className={\`club-shared-live club-live-mode-${'${activeTab}'}\`}
                    style={{ display: showSharedLive ? 'grid' : 'none' }}
                    aria-hidden={!showSharedLive}
                  >
                    <div style={{ display: activeTab === 'overview' ? 'block' : 'none' }}>
                      <div className="club-feed-card"><ClubSponsorsLive club={data} /></div>
                    </div>
                    <div style={{ display: activeTab === 'overview' ? 'block' : 'none' }}>
                      <ClubAboutPanel club={data} />
                    </div>
                    <div style={{ display: activeTab === 'highlights' ? 'block' : 'none' }}>
                      <div className="club-feed-card"><PublicClubGallery club={data} /></div>
                    </div>
                    <div className="club-live-shared-instance"><ClubLiveHub club={data} /></div>
                    <div style={{ display: activeTab === 'overview' ? 'block' : 'none' }}>
                      <ClubContactsPanel club={data} />
                    </div>
                  </div>`

const newShared = `                  {showSharedLive && (
                    <div className={\`club-shared-live club-live-mode-${'${activeTab}'}\`}>
                      {activeTab === 'overview' && <div className="club-feed-card"><ClubSponsorsLive club={data} /></div>}
                      {activeTab === 'overview' && <ClubAboutPanel club={data} />}
                      {activeTab === 'highlights' && <div className="club-feed-card"><PublicClubGallery club={data} /></div>}
                      <div className="club-live-shared-instance"><ClubLiveHub club={data} /></div>
                      {activeTab === 'overview' && <ClubContactsPanel club={data} />}
                    </div>
                  )}`

if (source.includes(oldShared)) source = source.replace(oldShared, newShared)

if (source === original) {
  console.log('Club profile tab stabiliser: source already patched or expected source not found.')
} else {
  writeFileSync(path, source)
  console.log('Club profile tab stabiliser applied.')
}
