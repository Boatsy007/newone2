import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'

export default function ClubPortal() {
  return (
    <>
      <Nav />
      <main style={{ minHeight: '60vh', background: '#f3f5f7', padding: '48px 20px' }}>
        <section style={{ maxWidth: 820, margin: '0 auto', background: '#fff', border: '1px solid #dfe5eb', borderRadius: 12, padding: 28 }}>
          <span style={{ color: '#2daaf5', fontSize: 11, fontWeight: 900, letterSpacing: '.16em', textTransform: 'uppercase' }}>Club manager</span>
          <h1 style={{ margin: '8px 0 12px', fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 'clamp(3rem,7vw,5.5rem)', lineHeight: .9, textTransform: 'uppercase' }}>Club profile access</h1>
          <p style={{ margin: 0, color: '#687385', lineHeight: 1.6 }}>Your secure club editing link is being prepared. Rankings, fixtures, results, ladders and imported football data remain protected.</p>
        </section>
      </main>
      <Footer />
    </>
  )
}
