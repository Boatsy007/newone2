import { Router } from 'express'

const router = Router()

const escapeXml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;')

const clamp = (value: unknown, fallback: string, max: number) => {
  const text = typeof value === 'string' && value.trim() ? value.trim() : fallback
  return text.slice(0, max)
}

const wrap = (text: string, max = 27) => {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > max && current) {
      lines.push(current)
      current = word
    } else current = next
  }
  if (current) lines.push(current)
  return lines.slice(0, 3)
}

router.get('/', (req, res) => {
  const title = clamp(req.query.title, 'PlayFooty', 90)
  const subtitle = clamp(req.query.subtitle, 'Australia’s home of community football', 150)
  const label = clamp(req.query.label, 'PLAYFOOTY', 30).toUpperCase()
  const accent = /^#[0-9a-f]{6}$/i.test(String(req.query.accent ?? '')) ? String(req.query.accent) : '#2daaf5'
  const lines = wrap(title)
  const titleSvg = lines.map((line, index) => `<text x="72" y="${230 + index * 92}" font-family="Arial Narrow, Arial, sans-serif" font-size="78" font-weight="900" letter-spacing="-2" fill="#ffffff">${escapeXml(line.toUpperCase())}</text>`).join('')
  const subtitleY = 250 + lines.length * 92

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#050505"/><stop offset="1" stop-color="#171717"/></linearGradient>
    <pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M 36 0 L 0 0 0 36" fill="none" stroke="#ffffff" stroke-opacity="0.045" stroke-width="1"/></pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <path d="M830 0H1200V630H690C810 500 865 384 855 278C847 182 838 92 830 0Z" fill="${accent}"/>
  <circle cx="1040" cy="154" r="205" fill="#ffffff" fill-opacity="0.10"/>
  <circle cx="1094" cy="522" r="300" fill="#050505" fill-opacity="0.18"/>
  <text x="72" y="88" font-family="Arial, sans-serif" font-size="22" font-weight="900" letter-spacing="5" fill="${accent}">${escapeXml(label)}</text>
  ${titleSvg}
  <text x="72" y="${subtitleY}" font-family="Arial, sans-serif" font-size="27" font-weight="700" fill="#cbd5df">${escapeXml(subtitle)}</text>
  <g transform="translate(900 250)"><ellipse cx="105" cy="90" rx="125" ry="70" fill="#050505" transform="rotate(-18 105 90)"/><path d="M20 83C58 50 124 28 195 41" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="4"/><path d="M38 119C88 92 145 79 211 84" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="4"/><text x="105" y="104" text-anchor="middle" font-family="Arial Narrow, Arial, sans-serif" font-size="48" font-weight="900" fill="#ffffff">PF</text></g>
  <rect x="72" y="558" width="1056" height="2" fill="#ffffff" fill-opacity="0.18"/>
  <text x="72" y="598" font-family="Arial, sans-serif" font-size="21" font-weight="800" fill="#ffffff">PLAYFOOTY.COM.AU</text>
  <text x="1128" y="598" text-anchor="end" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#050505">REAL CLUBS. REAL FOOTBALL.</text>
</svg>`

  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800')
  res.send(svg)
})

export { router as shareCardsRouter }
