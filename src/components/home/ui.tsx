/**
 * Homepage design-system primitives. One card, one section shell, one skeleton,
 * one motion vocabulary. Every homepage section builds from these so the page
 * reads as a single publication, not a stack of widgets.
 */
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { ReactNode, CSSProperties } from 'react'

export const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]
export const TEXT = '#111111'
export const MUTE = 'rgba(17,17,17,0.5)'
export const FAINT = 'rgba(17,17,17,0.34)'
export const LINE = 'rgba(17,17,17,0.09)'
export const PINK = '#2daaf5'
export const GOLD = '#2daaf5'
export const GOLD_DK = '#0878bd'
export const UP = '#16a34a'
export const DOWN = '#dc2626'
export const BAND = '#f5f8fb'
export const CYANISH = '#2daaf5'

/** Section shell: consistent width, rhythm and optional alternate band. */
export function Section({ children, band, id, pad = true }: { children: ReactNode; band?: boolean; id?: string; pad?: boolean }) {
  return (
    <section id={id} style={{ background: band ? BAND : '#ffffff' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: pad ? 'clamp(52px, 7vw, 84px) 20px' : '0 20px' }}>
        {children}
      </div>
    </section>
  )
}

/** Section header: kicker (small caps), display title, optional right-side link. */
export function SectionHead({ kicker, title, accent, to, toLabel, sub }: {
  kicker?: string; title: ReactNode; accent?: string; to?: string; toLabel?: string; sub?: string
}) {
  return (
    <Reveal>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, marginBottom: 'clamp(22px, 3.5vw, 34px)', flexWrap: 'wrap' }}>
        <div>
          {kicker && (
            <div className="font-condensed" style={{ fontWeight: 800, letterSpacing: '0.26em', textTransform: 'uppercase', fontSize: 11, color: accent ?? PINK, marginBottom: 10 }}>
              {kicker}
            </div>
          )}
          <h2 className="font-display" style={{ fontSize: 'clamp(2.1rem, 4.6vw, 3.4rem)', color: TEXT, lineHeight: 0.92, margin: 0 }}>
            {title}
          </h2>
          {sub && <p style={{ color: MUTE, fontSize: 15, margin: '10px 0 0', maxWidth: '58ch', lineHeight: 1.6 }}>{sub}</p>}
        </div>
        {to && (
          <Link to={to} className="font-condensed" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: TEXT, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 12, textDecoration: 'none', paddingBottom: 6, whiteSpace: 'nowrap' }}>
            {toLabel ?? 'View all'} <ArrowRight size={14} />
          </Link>
        )}
      </div>
    </Reveal>
  )
}

/** Reveal on scroll: a single, quiet entrance used everywhere. */
export function Reveal({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: CSSProperties }) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.65, delay, ease: EASE }}
      style={style}
    >
      {children}
    </motion.div>
  )
}

/** Skeleton bar (shimmer respects reduced motion via CSS). */
export function Skel({ w = '100%', h = 16, r = 10, style }: { w?: number | string; h?: number; r?: number; style?: CSSProperties }) {
  return <span className="gn-skel" aria-hidden style={{ display: 'block', width: w, height: h, borderRadius: r, ...style }} />
}

/** Category / meta tag pill. */
export function Tag({ children, color = PINK }: { children: ReactNode; color?: string }) {
  return (
    <span className="font-condensed" style={{
      display: 'inline-flex', alignItems: 'center', fontSize: 10.5, fontWeight: 800,
      letterSpacing: '0.16em', textTransform: 'uppercase', padding: '4px 10px',
      borderRadius: 999, color, background: `color-mix(in srgb, ${color} 10%, #ffffff)`,
      border: `1px solid color-mix(in srgb, ${color} 30%, #ffffff)`, whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}

/** Movement pill: green up, red down, quiet steady. */
export function Move({ delta, size = 12 }: { delta: number; size?: number }) {
  if (!delta) return <span className="font-condensed" aria-label="no movement" style={{ color: FAINT, fontSize: size, fontWeight: 800 }}>&middot;</span>
  const up = delta > 0
  return (
    <span className="font-condensed" aria-label={`${up ? 'up' : 'down'} ${Math.abs(delta)} places`} style={{
      display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 800, fontSize: size,
      color: up ? UP : DOWN, letterSpacing: '0.04em',
    }}>
      <svg width={size - 2} height={size - 2} viewBox="0 0 10 10" aria-hidden style={{ transform: up ? 'none' : 'rotate(180deg)' }}>
        <path d="M5 0 L10 7 L0 7 Z" fill="currentColor" />
      </svg>
      {Math.abs(delta)}
    </span>
  )
}
