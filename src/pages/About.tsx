/**
 * About PlayFooty — mission and how the platform works. Editorial, static.
 */
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'
import { Link } from 'react-router-dom'
import { useSeo } from '../lib/seo'

const TEXT = '#111111'
const BLUE = '#2daaf5'
const MUTE = 'rgba(17,17,17,0.58)'

export default function About() {
  useSeo({
    title: 'About PlayFooty — Australia’s community football platform',
    description: 'PlayFooty connects community football rankings, league ladders, club and player profiles, results, news, highlights and supporter updates across Australia.',
    path: '/about',
  })

  return (
    <>
      <Nav />
      <main style={{ background: '#ffffff' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '56px 20px 90px' }}>
          <p className="font-condensed font-bold tracking-[0.28em] uppercase" style={{ fontSize: '0.72rem', color: BLUE, marginBottom: 16 }}>
            About
          </p>
          <h1 className="font-display leading-none" style={{ fontSize: 'clamp(2.6rem, 6vw, 5rem)', color: TEXT, marginBottom: 24 }}>
            AUSTRALIA’S COMMUNITY<br /><span style={{ color: BLUE }}>FOOTBALL PLATFORM</span>
          </h1>

          <div style={{ color: MUTE, fontSize: 16.5, lineHeight: 1.75, display: 'grid', gap: 18 }}>
            <p>
              PlayFooty exists to make community football easier to discover, follow and celebrate across Australia.
            </p>
            <p>
              The platform connects national and league rankings, ladders, fixtures, results, goal kickers, MVP voting, player and club profiles, records, news, highlights and supporter updates.
            </p>
            <p>
              Official competition systems remain responsible for registrations and competition administration. PlayFooty adds the connected public experience around that data for clubs, leagues, players, supporters and commercial partners.
            </p>
            <p>
              Every public feature is designed to connect back to the canonical club, league, player, fixture, result or article record rather than creating competing versions of the same information.
            </p>
          </div>

          <div style={{ marginTop: 36, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link to="/rankings" className="btn-pink font-bold rounded-full" style={{ fontSize: '0.85rem', padding: '0.95rem 2.2rem', letterSpacing: '0.06em', textDecoration: 'none' }}>
              VIEW NATIONAL RANKINGS
            </Link>
            <Link to="/leagues" className="font-semibold rounded-full border-2" style={{ fontSize: '0.85rem', padding: '0.95rem 2rem', letterSpacing: '0.06em', borderColor: 'rgba(17,17,17,0.15)', color: MUTE, textDecoration: 'none' }}>
              BROWSE LEAGUES
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
