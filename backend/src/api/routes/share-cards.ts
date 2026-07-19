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

const safeImage = (value: unknown) => {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString().slice(0, 1000) : null
  } catch { return null }
}

const wrap = (text: string, max = 25, limit = 3) => {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > max && current) { lines.push(current); current = word } else current = next
  }
  if (current) lines.push(current)
  return lines.slice(0, limit)
}

async function embeddedImage(url: string | null) {
  if (!url) return null
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!response.ok) return null
    const type = response.headers.get('content-type')?.split(';')[0] ?? ''
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'].includes(type)) return null
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.byteLength > 2_500_000) return null
    return `data:${type};base64,${bytes.toString('base64')}`
  } catch { return null }
}

router.get('/', async (req, res) => {
  const title = clamp(req.query.title, 'PlayFooty', 90)
  const subtitle = clamp(req.query.subtitle, 'Australia’s home of community football', 160)
  const label = clamp(req.query.label, 'PLAYFOOTY', 30).toUpperCase()
  const stat1 = clamp(req.query.stat1, '', 28).toUpperCase()
  const stat2 = clamp(req.query.stat2, '', 28).toUpperCase()
  const featureStat = clamp(req.query.featureStat, '', 12).toUpperCase()
  const featureLabel = clamp(req.query.featureLabel, '', 28).toUpperCase()
  const logo = await embeddedImage(safeImage(req.query.logo))
  const accent = /^#[0-9a-f]{6}$/i.test(String(req.query.accent ?? '')) ? String(req.query.accent) : '#2daaf5'
  const lines = wrap(title)
  const subtitleLines = wrap(subtitle, 48, 3)
  const titleSvg = lines.map((line, index) => `<text x="72" y="${220 + index * 82}" font-family="Arial Narrow, Arial, sans-serif" font-size="70" font-weight="900" letter-spacing="-2" fill="#ffffff">${escapeXml(line.toUpperCase())}</text>`).join('')
  const subtitleY = 250 + lines.length * 82
  const subtitleSvg = subtitleLines.map((line, index) => `<text x="72" y="${subtitleY + index * 34}" font-family="Arial, sans-serif" font-size="25" font-weight="700" fill="#cbd5df">${escapeXml(line)}</text>`).join('')
  const logoSvg = logo
    ? `<rect x="888" y="76" width="208" height="208" rx="26" fill="#ffffff"/><image href="${logo}" x="906" y="94" width="172" height="172" preserveAspectRatio="xMidYMid meet"/>`
    : `<g transform="translate(900 98)"><ellipse cx="105" cy="90" rx="125" ry="70" fill="#050505" transform="rotate(-18 105 90)"/><path d="M20 83C58 50 124 28 195 41" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="4"/><path d="M38 119C88 92 145 79 211 84" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="4"/><text x="105" y="104" text-anchor="middle" font-family="Arial Narrow, Arial, sans-serif" font-size="48" font-weight="900" fill="#ffffff">PF</text></g>`
  const stats = [stat1, stat2].filter(Boolean)
  const statsSvg = stats.map((stat, index) => `<g transform="translate(${872 + index * 132} 470)"><rect width="118" height="64" rx="14" fill="#050505" fill-opacity="0.92"/><text x="59" y="39" text-anchor="middle" font-family="Arial Narrow, Arial, sans-serif" font-size="19" font-weight="900" fill="#ffffff">${escapeXml(stat)}</text></g>`).join('')
  const featureSvg = featureStat
    ? `<g transform="translate(852 300)"><text x="132" y="94" text-anchor="middle" font-family="Arial Narrow, Arial, sans-serif" font-size="112" font-weight="900" letter-spacing="-4" fill="#050505">${escapeXml(featureStat)}</text><text x="132" y="128" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="900" letter-spacing="3" fill="#050505">${escapeXml(featureLabel || 'LATEST PERFORMANCE')}</text></g>`
    : ''

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#050505"/><stop offset="1" stop-color="#171717"/></linearGradient><pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M 36 0 L 0 0 0 36" fill="none" stroke="#ffffff" stroke-opacity="0.045" stroke-width="1"/></pattern></defs>
  <rect width="1200" height="630" fill="url(#bg)"/><rect width="1200" height="630" fill="url(#grid)"/>
  <path d="M820 0H1200V630H690C810 500 865 384 855 278C847 182 838 92 820 0Z" fill="${accent}"/>
  <circle cx="1040" cy="154" r="205" fill="#ffffff" fill-opacity="0.10"/><circle cx="1094" cy="522" r="300" fill="#050505" fill-opacity="0.18"/>
  <text x="72" y="82" font-family="Arial, sans-serif" font-size="22" font-weight="900" letter-spacing="5" fill="${accent}">${escapeXml(label)}</text>
  ${titleSvg}${subtitleSvg}${logoSvg}${featureSvg}${statsSvg}
  <rect x="72" y="558" width="1056" height="2" fill="#ffffff" fill-opacity="0.18"/>
  <text x="72" y="598" font-family="Arial, sans-serif" font-size="21" font-weight="800" fill="#ffffff">PLAYFOOTY.COM.AU</text>
  <text x="1128" y="598" text-anchor="end" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#050505">REAL CLUBS. REAL FOOTBALL.</text>
</svg>`

  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=1800')
  res.send(svg)
})

export { router as shareCardsRouter }
