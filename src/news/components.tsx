/**
 * PlayFooty News — shared presentational components. Fully isolated: all CSS is
 * injected under `cnews-` prefixed classes via <NewsStyles/> so nothing leaks
 * into (or depends on) the rest of the app's styling.
 */
import { Link } from 'react-router-dom'
import { Clock, Zap } from 'lucide-react'
import { type Article, categoryOf, formatDate, newsPath } from './content'

export const PINK = '#d71920'
export const GOLD = '#f4c14d'
export const GOLD_DK = '#b8860b'
export const INK = '#111111'
export const MUTE = 'rgba(17,17,17,0.55)'
export const FAINT = 'rgba(17,17,17,0.4)'
export const LINE = 'rgba(17,17,17,0.1)'
export const PAGE = '#ffffff'
export const PAGE_ALT = '#f5f4f0'
export const DARK = '#0b0e17'

export function NewsStyles() {
  return (
    <style>{`
      .cnews-card{ transition: transform .28s cubic-bezier(.22,1,.36,1), box-shadow .28s; }
      .cnews-card:hover{ transform: translateY(-4px); }
      .cnews-card:hover .cnews-img{ transform: scale(1.05); }
      .cnews-card:hover .cnews-head{ color:${PINK}; }
      .cnews-img-wrap{ overflow:hidden; }
      .cnews-img{ transition: transform .5s cubic-bezier(.22,1,.36,1); }
      .cnews-head{ transition: color .2s; }
      .cnews-link{ text-decoration:none; color:inherit; display:block; }
      @keyframes cnewsMarquee{ 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
      .cnews-marquee{ display:flex; width:max-content; animation: cnewsMarquee 34s linear infinite; }
      .cnews-marquee:hover{ animation-play-state: paused; }
      .cnews-fade{ opacity:0; transform:translateY(14px); animation: cnewsFade .6s cubic-bezier(.22,1,.36,1) forwards; }
      @keyframes cnewsFade{ to{ opacity:1; transform:none } }
    `}</style>
  )
}

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) }
const DUOS: [string, string, string][] = [
  ['#d71920', '#7a0f43', '#1a0512'], ['#f4c14d', '#8a5a10', '#1a1204'],
  ['#4dd9f4', '#0f5f70', '#03151a'], ['#0b0e17', '#26305a', '#d71920'],
  ['#111111', '#3a2140', '#f4c14d'], ['#ff6bb5', '#7a0f43', '#0b0e17'],
]

function isImageUrl(value: string) {
  return /^https?:\/\//i.test(value) || value.startsWith('/') || value.startsWith('data:image/') || value.startsWith('blob:')
}

export function EditorialImage({ seed, ratio = '16 / 10', label, rounded = 14 }: { seed: string; ratio?: string; label?: string; rounded?: number }) {
  if (isImageUrl(seed)) {
    return (
      <div className="cnews-img-wrap" style={{ aspectRatio: ratio, borderRadius: rounded, position: 'relative', background: '#e9eef2' }}>
        <img className="cnews-img" src={seed} alt={label ?? ''} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
        {label && <span className="font-condensed" style={{ position: 'absolute', left: 14, bottom: 12, color: '#fff', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', fontSize: 11, textShadow: '0 1px 5px rgba(0,0,0,.8)' }}>{label}</span>}
      </div>
    )
  }

  const [a, b, c] = DUOS[hash(seed) % DUOS.length]
  const ang = 90 + (hash(seed) % 120)
  return (
    <div className="cnews-img-wrap" style={{ aspectRatio: ratio, borderRadius: rounded, position: 'relative' }}>
      <div className="cnews-img" style={{ position: 'absolute', inset: 0, background: `linear-gradient(${ang}deg, ${a}, ${b} 55%, ${c})` }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 90% at 15% 10%, rgba(255,255,255,0.18), transparent 55%)' }} />
        <div style={{ position: 'absolute', inset: 0, opacity: 0.12, background: 'repeating-linear-gradient(135deg, #fff 0 2px, transparent 2px 9px)' }} />
        {label && <span className="font-condensed" style={{ position: 'absolute', left: 14, bottom: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', fontSize: 11 }}>{label}</span>}
      </div>
    </div>
  )
}

export function CategoryTag({ id, onDark }: { id: Article['category']; onDark?: boolean }) {
  const c = categoryOf(id)
  return (
    <span className="font-condensed" style={{ display: 'inline-block', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', fontSize: 10.5, color: onDark ? '#fff' : c.accent, background: onDark ? 'rgba(255,255,255,0.12)' : `${c.accent}1f`, padding: '4px 9px', borderRadius: 6 }}>
      {c.label}
    </span>
  )
}

export function MetaLine({ article, onDark }: { article: Article; onDark?: boolean }) {
  const col = onDark ? 'rgba(255,255,255,0.6)' : FAINT
  return (
    <span className="font-condensed" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: col, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em' }}>
      {formatDate(article.date)}
      <span style={{ opacity: 0.5 }}>·</span>
      <Clock size={12} /> {article.readingTime} min read
    </span>
  )
}

export function Eyebrow({ children, accent = GOLD_DK }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: 24, height: 2, background: PINK }} />
      <span className="font-condensed" style={{ fontWeight: 800, letterSpacing: '0.28em', textTransform: 'uppercase', fontSize: 11, color: accent }}>{children}</span>
    </div>
  )
}

export function SectionHead({ title, to }: { title: string; to?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, margin: '0 0 18px', borderBottom: `2px solid ${INK}`, paddingBottom: 10 }}>
      <h2 className="font-display" style={{ color: INK, fontSize: 'clamp(1.5rem,4vw,2.4rem)', margin: 0, lineHeight: 0.95 }}>{title}</h2>
      {to && <Link to={to} className="font-condensed" style={{ color: PINK, textDecoration: 'none', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 12, whiteSpace: 'nowrap' }}>All →</Link>}
    </div>
  )
}

export function ArticleCard({ article, variant = 'default' }: { article: Article; variant?: 'default' | 'large' | 'compact' }) {
  if (variant === 'compact') {
    return (
      <Link to={newsPath(article.slug)} className="cnews-link cnews-card" style={{ display: 'grid', gridTemplateColumns: '92px 1fr', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${LINE}` }}>
        <div className="cnews-img-wrap" style={{ borderRadius: 10 }}><EditorialImage seed={article.heroSeed} ratio="1 / 1" rounded={10} /></div>
        <div style={{ minWidth: 0 }}>
          <CategoryTag id={article.category} />
          <h3 className="cnews-head font-display" style={{ color: INK, fontSize: 17, margin: '6px 0 4px', lineHeight: 1.02 }}>{article.title}</h3>
          <MetaLine article={article} />
        </div>
      </Link>
    )
  }
  const large = variant === 'large'
  return (
    <Link to={newsPath(article.slug)} className="cnews-link cnews-card" style={{ display: 'block' }}>
      <div className="cnews-img-wrap" style={{ borderRadius: 14 }}>
        <EditorialImage seed={article.heroSeed} ratio={large ? '16 / 9' : '16 / 10'} label={categoryOf(article.category).label} />
      </div>
      <div style={{ padding: '14px 2px 0' }}>
        <CategoryTag id={article.category} />
        <h3 className="cnews-head font-display" style={{ color: INK, fontSize: large ? 'clamp(1.6rem,3vw,2.2rem)' : 20, margin: '8px 0 6px', lineHeight: 1.0 }}>{article.title}</h3>
        {large && <p style={{ color: MUTE, fontSize: 15, lineHeight: 1.5, margin: '0 0 10px' }}>{article.summary}</p>}
        <MetaLine article={article} />
      </div>
    </Link>
  )
}

export function BreakingBar({ items }: { items: { slug: string; title: string }[] }) {
  if (!items.length) return null
  const loop = [...items, ...items]
  return (
    <div style={{ background: INK, color: '#fff', display: 'flex', alignItems: 'stretch', overflow: 'hidden' }}>
      <div className="font-condensed" style={{ display: 'flex', alignItems: 'center', gap: 7, background: PINK, color: '#fff', padding: '10px 16px', fontWeight: 900, letterSpacing: '0.16em', textTransform: 'uppercase', fontSize: 12, flexShrink: 0, zIndex: 1 }}>
        <Zap size={14} fill="#fff" /> Breaking
      </div>
      <div style={{ position: 'relative', overflow: 'hidden', flex: 1 }}>
        <div className="cnews-marquee" style={{ alignItems: 'center' }}>
          {loop.map((it, i) => (
            <Link key={i} to={newsPath(it.slug)} className="font-condensed" style={{ display: 'inline-flex', alignItems: 'center', gap: 16, color: 'rgba(255,255,255,0.9)', textDecoration: 'none', padding: '10px 0', whiteSpace: 'nowrap', fontWeight: 700, fontSize: 13, letterSpacing: '0.02em' }}>
              <span style={{ marginLeft: 22 }}>{it.title}</span>
              <span style={{ color: GOLD, marginLeft: 22 }}>—</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
