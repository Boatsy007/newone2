import { ArrowRight, Award, CalendarDays, Check, Clock3, Play, ShieldCheck, Trophy, Upload, Vote } from 'lucide-react'
import { Link } from 'react-router-dom'
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'
import { useSeo } from '../lib/seo'

type AwardCategory = {
  id: string
  title: string
  eyebrow: string
  description: string
  icon: typeof Trophy
}

const categories: AwardCategory[] = [
  { id: 'goal', title: 'Goal of the week', eyebrow: 'The impossible finish', description: 'The best snaps, runs, set shots and match-winning goals from community football.', icon: Trophy },
  { id: 'mark', title: 'Mark of the week', eyebrow: 'The biggest grabs', description: 'Vote for the strongest contested marks, high flyers and courageous intercepts.', icon: Award },
  { id: 'play', title: 'Play of the week', eyebrow: 'The moment that changed it', description: 'Team football, pressure acts, chases, tackles and brilliant passages of play.', icon: Play },
  { id: 'performance', title: 'Performance of the week', eyebrow: 'The standout player', description: 'Recognising the player whose full-game performance deserves the national spotlight.', icon: ShieldCheck },
]

export default function Highlights() {
  useSeo({
    title: 'Weekly Awards & Community Football Highlights | PlayFooty',
    description: "Vote for Australia's best community football goals, marks, plays and performances each week.",
    path: '/highlights',
  })

  return <div className="pf-awards-page">
    <Nav />
    <main id="main-content">
      <section className="pf-awards-hero">
        <div className="pf-awards-shell pf-awards-hero-inner">
          <div className="pf-awards-hero-copy">
            <span className="pf-awards-kicker"><Vote size={16} /> Fan voted. Club driven.</span>
            <h1>PlayFooty<br /><em>weekly awards</em></h1>
            <p>Australia's best community football moments, chosen by the people who live them.</p>
            <div className="pf-awards-actions">
              <a href="#awards" className="pf-awards-primary">Explore the awards <ArrowRight size={18} /></a>
              <Link to="/admin" className="pf-awards-secondary"><Upload size={17} /> Submit a highlight</Link>
            </div>
          </div>
          <div className="pf-awards-hero-panel" aria-label="Weekly awards status">
            <span className="pf-awards-live"><i /> Weekly voting</span>
            <strong>Nominees<br />coming soon</strong>
            <p>Clubs will be able to submit verified highlights for the national weekly vote.</p>
            <div><Clock3 size={18} /><span>Voting windows will appear here when nominees are published.</span></div>
          </div>
        </div>
      </section>

      <section id="awards" className="pf-awards-shell pf-awards-section">
        <header className="pf-awards-heading">
          <div><span>Choose the moment</span><h2>This week's awards</h2></div>
          <p>Each category will display real club submissions only. No placeholder players, clubs, scores or vote totals are shown.</p>
        </header>
        <div className="pf-awards-grid">
          {categories.map(category => <AwardCard key={category.id} category={category} />)}
        </div>
      </section>

      <section className="pf-awards-process">
        <div className="pf-awards-shell">
          <header className="pf-awards-heading light"><div><span>How it works</span><h2>From local moment to national winner</h2></div></header>
          <div className="pf-awards-steps">
            <Step number="01" icon={Upload} title="Clubs submit" text="Verified clubs upload a highlight and attach the correct player, club, league and match details." />
            <Step number="02" icon={ShieldCheck} title="PlayFooty reviews" text="Submissions are checked before appearing publicly, protecting clubs and keeping the competition credible." />
            <Step number="03" icon={Vote} title="Supporters vote" text="Fans choose one nominee per category during the published weekly voting window." />
            <Step number="04" icon={Trophy} title="Winners live forever" text="Winning highlights are featured on the homepage and added to the permanent awards archive." />
          </div>
        </div>
      </section>

      <section className="pf-awards-shell pf-awards-archive">
        <div className="pf-awards-archive-copy">
          <span>Hall of fame</span>
          <h2>Every winner.<br />Every week.<br /><em>Forever.</em></h2>
          <p>The archive will preserve weekly and monthly winners by season, state, league and club once official voting begins.</p>
        </div>
        <div className="pf-awards-archive-panel">
          <CalendarDays size={28} />
          <strong>2026 awards archive</strong>
          <p>No winners have been published yet.</p>
          <span><Check size={15} /> Real verified results only</span>
        </div>
      </section>

      <section className="pf-awards-cta">
        <div className="pf-awards-shell">
          <div><span>Captured something special?</span><strong>Put your club's moment in front of Australia.</strong></div>
          <Link to="/admin">Club submission access <ArrowRight size={18} /></Link>
        </div>
      </section>
    </main>
    <Footer />
    <AwardsStyles />
  </div>
}

function AwardCard({ category }: { category: AwardCategory }) {
  const Icon = category.icon
  return <article className="pf-award-card">
    <div className="pf-award-card-top"><span><Icon size={21} /></span><small>Voting not open</small></div>
    <div className="pf-award-video-placeholder"><Play size={34} fill="currentColor" /><span>Nominee videos will appear here</span></div>
    <div className="pf-award-card-copy"><span>{category.eyebrow}</span><h3>{category.title}</h3><p>{category.description}</p></div>
    <button type="button" disabled>Voting opens with nominees</button>
  </article>
}

function Step({ number, icon: Icon, title, text }: { number: string; icon: typeof Trophy; title: string; text: string }) {
  return <article className="pf-awards-step"><span>{number}</span><Icon size={24} /><h3>{title}</h3><p>{text}</p></article>
}

function AwardsStyles() {
  return <style>{`
    .pf-awards-page{min-height:100vh;background:#fff;color:#111318;font-family:Barlow,Inter,Arial,sans-serif}.pf-awards-shell{width:min(1280px,calc(100% - 48px));margin:0 auto}.pf-awards-hero{overflow:hidden;background:#050505;color:#fff;border-bottom:5px solid #42b8ff}.pf-awards-hero-inner{min-height:590px;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(360px,.85fr);gap:70px;align-items:center;padding-top:68px;padding-bottom:68px}.pf-awards-hero-copy{position:relative;z-index:2}.pf-awards-kicker{display:inline-flex;align-items:center;gap:9px;color:#42b8ff;font-size:12px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}.pf-awards-hero h1,.pf-awards-heading h2,.pf-award-card h3,.pf-awards-step h3,.pf-awards-archive h2,.pf-awards-hero-panel strong,.pf-awards-archive-panel strong,.pf-awards-cta strong{font-family:'Bebas Neue',Impact,'Arial Narrow Bold',sans-serif;text-transform:uppercase}.pf-awards-hero h1{margin:18px 0 20px;font-size:clamp(5rem,9vw,9rem);line-height:.78;letter-spacing:-.025em}.pf-awards-hero h1 em,.pf-awards-archive h2 em{font-style:normal;color:#42b8ff}.pf-awards-hero-copy>p{max-width:650px;margin:0;color:#d8dee5;font-size:20px;line-height:1.5}.pf-awards-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}.pf-awards-actions a,.pf-awards-cta a{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:48px;padding:0 20px;border-radius:7px;text-decoration:none;text-transform:uppercase;font-size:12px;font-weight:900;letter-spacing:.04em}.pf-awards-primary,.pf-awards-cta a{background:#42b8ff;color:#050505}.pf-awards-secondary{border:1px solid rgba(255,255,255,.26);color:#fff;background:rgba(255,255,255,.05)}.pf-awards-hero-panel{position:relative;padding:32px;border:1px solid rgba(255,255,255,.17);border-radius:12px;background:linear-gradient(145deg,rgba(255,255,255,.09),rgba(255,255,255,.025));box-shadow:0 24px 70px rgba(0,0,0,.32)}.pf-awards-hero-panel:after{content:'';position:absolute;right:-90px;bottom:-110px;width:250px;height:250px;border-radius:50%;background:#42b8ff;opacity:.18}.pf-awards-live{display:flex;align-items:center;gap:9px;color:#fff;font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.pf-awards-live i{width:9px;height:9px;border-radius:50%;background:#42b8ff;box-shadow:0 0 0 6px rgba(66,184,255,.13)}.pf-awards-hero-panel>strong{position:relative;z-index:1;display:block;margin-top:28px;font-size:clamp(3.2rem,5vw,5.5rem);line-height:.82}.pf-awards-hero-panel>p{position:relative;z-index:1;color:#cbd3dc;line-height:1.55}.pf-awards-hero-panel>div{position:relative;z-index:1;display:flex;gap:10px;align-items:flex-start;margin-top:25px;padding-top:20px;border-top:1px solid rgba(255,255,255,.14);color:#42b8ff}.pf-awards-hero-panel>div span{color:#eef3f7;font-size:13px;line-height:1.45}.pf-awards-section{padding-top:64px;padding-bottom:72px}.pf-awards-heading{display:flex;align-items:end;justify-content:space-between;gap:36px;margin-bottom:25px}.pf-awards-heading>div>span,.pf-awards-archive-copy>span{color:#42b8ff;font-size:11px;font-weight:900;letter-spacing:.17em;text-transform:uppercase}.pf-awards-heading h2{margin:6px 0 0;font-size:clamp(3rem,5.5vw,5.5rem);line-height:.86}.pf-awards-heading>p{max-width:440px;margin:0;color:#687385;line-height:1.55}.pf-awards-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.pf-award-card{overflow:hidden;border:1px solid #e0e5ea;border-radius:11px;background:#fff;box-shadow:0 8px 24px rgba(17,24,39,.06)}.pf-award-card-top{display:flex;align-items:center;justify-content:space-between;padding:16px 18px}.pf-award-card-top>span{display:grid;place-items:center;width:42px;height:42px;border-radius:7px;background:#42b8ff;color:#050505}.pf-award-card-top small{color:#687385;font-size:10px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.pf-award-video-placeholder{aspect-ratio:16/8.2;display:grid;place-items:center;align-content:center;gap:12px;background:linear-gradient(145deg,#0c0d0f,#20242a);color:#42b8ff}.pf-award-video-placeholder span{color:#dce3ea;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}.pf-award-card-copy{padding:22px 22px 17px}.pf-award-card-copy>span{color:#42b8ff;font-size:10px;font-weight:900;letter-spacing:.15em;text-transform:uppercase}.pf-award-card h3{margin:6px 0 9px;font-size:36px;line-height:.95}.pf-award-card p{margin:0;color:#687385;line-height:1.55}.pf-award-card button{width:calc(100% - 44px);min-height:45px;margin:0 22px 22px;border:1px solid #dce2e8;border-radius:7px;background:#f3f5f7;color:#7d8794;text-transform:uppercase;font-size:11px;font-weight:900;letter-spacing:.05em}.pf-awards-process{background:#050505;color:#fff;padding:68px 0}.pf-awards-heading.light h2{color:#fff}.pf-awards-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.pf-awards-step{position:relative;min-height:245px;padding:24px;border:1px solid rgba(255,255,255,.14);border-radius:10px;background:#0c0d0f}.pf-awards-step>span{position:absolute;right:18px;top:16px;color:#42b8ff;font-family:'Bebas Neue',Impact,sans-serif;font-size:29px}.pf-awards-step>svg{color:#42b8ff;margin-top:18px}.pf-awards-step h3{margin:23px 0 9px;font-size:29px}.pf-awards-step p{margin:0;color:#b9c2cc;font-size:14px;line-height:1.55}.pf-awards-archive{display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:70px;align-items:center;padding-top:72px;padding-bottom:72px}.pf-awards-archive h2{margin:8px 0 18px;font-size:clamp(4rem,7vw,7.2rem);line-height:.8}.pf-awards-archive-copy p{max-width:600px;color:#687385;font-size:17px;line-height:1.6}.pf-awards-archive-panel{padding:30px;border:1px solid #dde3e9;border-radius:11px;background:#f6f8fa}.pf-awards-archive-panel>svg{color:#42b8ff}.pf-awards-archive-panel strong{display:block;margin:21px 0 8px;font-size:32px}.pf-awards-archive-panel p{color:#687385}.pf-awards-archive-panel span{display:flex;align-items:center;gap:8px;margin-top:23px;padding-top:18px;border-top:1px solid #dce2e8;color:#111318;font-size:12px;font-weight:850;text-transform:uppercase}.pf-awards-archive-panel span svg{color:#42b8ff}.pf-awards-cta{background:#42b8ff;color:#050505}.pf-awards-cta>.pf-awards-shell{min-height:150px;display:flex;align-items:center;justify-content:space-between;gap:28px}.pf-awards-cta span{display:block;font-size:11px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}.pf-awards-cta strong{display:block;margin-top:5px;font-size:clamp(2rem,4vw,4rem);line-height:.9}.pf-awards-cta a{background:#050505;color:#fff;flex:0 0 auto}
    @media(max-width:980px){.pf-awards-hero-inner{grid-template-columns:1fr;gap:34px;min-height:0}.pf-awards-hero-panel{max-width:650px}.pf-awards-steps{grid-template-columns:repeat(2,minmax(0,1fr))}.pf-awards-archive{grid-template-columns:1fr;gap:30px}.pf-awards-archive-panel{max-width:620px}.pf-awards-cta>.pf-awards-shell{padding:28px 0}}
    @media(max-width:700px){.pf-awards-shell{width:min(100% - 28px,1280px)}.pf-awards-hero-inner{padding-top:48px;padding-bottom:48px}.pf-awards-hero h1{font-size:clamp(4.4rem,21vw,7rem)}.pf-awards-hero-copy>p{font-size:17px}.pf-awards-actions{display:grid}.pf-awards-actions a{width:100%;box-sizing:border-box}.pf-awards-heading{display:block}.pf-awards-heading>p{margin-top:16px}.pf-awards-grid,.pf-awards-steps{grid-template-columns:1fr}.pf-awards-section{padding-top:48px;padding-bottom:50px}.pf-awards-process{padding:50px 0}.pf-awards-archive{padding-top:50px;padding-bottom:50px}.pf-awards-cta>.pf-awards-shell{display:block}.pf-awards-cta a{margin-top:20px;width:100%;box-sizing:border-box}.pf-awards-hero-panel{padding:24px}.pf-award-card h3{font-size:32px}}
    @media(max-width:390px){.pf-awards-hero h1{font-size:4.5rem}.pf-awards-hero-panel>strong{font-size:3.4rem}.pf-awards-archive h2{font-size:4rem}}
  `}</style>
}
