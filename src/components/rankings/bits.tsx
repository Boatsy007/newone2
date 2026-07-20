/**
 * Shared presentational bits for the rankings product, in the bright editorial
 * style matching the homepage: white/off-white pages, black display headings,
 * red highlights, gold for podium/leader accents.
 */
import { TrendingUp, TrendingDown, Minus, Star } from 'lucide-react'
import type { FormResult } from '../../lib/rankings'

// Light theme tokens
export const PAGE = '#ffffff'
export const PAGE_ALT = '#f5f4f0'
export const TEXT = '#111111'
export const MUTE = 'rgba(17,17,17,0.45)'
export const FAINT = 'rgba(17,17,17,0.32)'
export const LINE = 'rgba(17,17,17,0.09)'
export const PINK = '#d71920'
export const GOLD = '#f4c14d'
export const GOLD_DK = '#b8860b'
export const CYAN = '#4dd9f4'
export const DARK = '#0b0e17'   // premium dark feature blocks only

export function FormPips({ form }: { form: FormResult[] }) {
  if (!form?.length) return <span style={{ color: MUTE, fontSize: 12 }}>·</span>
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {form.slice(-5).map((r, i) => (
        <span key={i} title={r}
          style={{
            width: 20, height: 20, borderRadius: 5, display: 'grid', placeItems: 'center',
            fontSize: 11, fontWeight: 800,
            color: '#fff',
            background: r === 'W' ? '#22c55e' : r === 'L' ? '#dc2626' : '#168fd2',
          }}>{r}</span>
      ))}
    </div>
  )
}

export function StarStrength({ stars, size = 14 }: { stars: number; size?: number }) {
  return (
    <div style={{ display: 'inline-flex', gap: 2 }} aria-label={`${stars} of 5 strength`}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} size={size} fill={n <= stars ? GOLD : 'none'} color={n <= stars ? GOLD : 'rgba(17,17,17,0.2)'} strokeWidth={2} />
      ))}
    </div>
  )
}

export function Movement({ current, previous }: { current: number; previous: number | null }) {
  if (previous == null || previous === current)
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: MUTE, fontSize: 12, fontWeight: 700 }}><Minus size={13} /></span>
  const up = previous > current
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: up ? '#16a34a' : '#dc2626', fontSize: 12, fontWeight: 800 }}>
      {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{Math.abs(previous - current)}
    </span>
  )
}

export function QualBadge({ qualified, small }: { qualified: boolean; small?: boolean }) {
  return (
    <span className="font-condensed" style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
      fontSize: small ? 10 : 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
      padding: small ? '3px 8px' : '5px 12px', borderRadius: 999,
      color: qualified ? GOLD_DK : MUTE,
      background: qualified ? 'rgba(244,193,77,0.16)' : 'rgba(17,17,17,0.05)',
      border: `1px solid ${qualified ? 'rgba(244,193,77,0.5)' : LINE}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: qualified ? GOLD : 'rgba(17,17,17,0.25)' }} />
      {qualified ? 'Top 32 Ranked' : 'Nationally Ranked'}
    </span>
  )
}

/** Uppercase condensed eyebrow label with a pink tick — the homepage motif. */
export function Eyebrow({ children, accent = PINK }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: 24, height: 2, background: accent }} />
      <span className="font-condensed" style={{ fontWeight: 800, letterSpacing: '0.28em', textTransform: 'uppercase', fontSize: 11, color: GOLD_DK }}>{children}</span>
    </div>
  )
}

export function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-condensed" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: FAINT }}>{children}</div>
}

// Team crest slot — shows a real logo when `src` is provided (future-ready),
// otherwise a deterministic initials badge. Used across rankings, profiles,
// league pages, directory and search so a club reads consistently everywhere.
const CREST_DUOS: [string, string][] = [
  ['#d71920', '#7f1016'], ['#f4c14d', '#8a5a10'], ['#4dd9f4', '#0f5f70'],
  ['#111111', '#3a2140'], ['#ff6bb5', '#7f1016'], ['#0b0e17', '#26305a'],
]
function crestHash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) }
export function TeamLogo({ name, size = 34, src }: { name: string; size?: number; src?: string }) {
  const initials = (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
  const [a, b] = CREST_DUOS[crestHash(name || '') % CREST_DUOS.length]
  const hasLogo = Boolean(src)
  return (
    <span aria-hidden style={{
      width: size, height: size, flexShrink: 0,
      borderRadius: hasLogo ? 0 : '50%',
      display: 'inline-grid', placeItems: 'center',
      overflow: hasLogo ? 'visible' : 'hidden',
      background: hasLogo ? 'transparent' : `linear-gradient(135deg, ${a}, ${b})`,
      border: hasLogo ? 'none' : '1px solid rgba(17,17,17,0.1)',
      boxShadow: hasLogo ? 'none' : 'inset 0 1px 2px rgba(255,255,255,0.25)',
    }}>
      {src
        ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
        : <span className="font-display" style={{ color: '#fff', fontSize: size * 0.42, lineHeight: 1, letterSpacing: '0.02em' }}>{initials}</span>}
    </span>
  )
}
