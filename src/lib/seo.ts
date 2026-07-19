/**
 * Dynamic SEO for the SPA — sets title, description, canonical, robots,
 * Open Graph / Twitter tags, automated share cards and optional JSON-LD.
 */
import { useEffect } from 'react'

const SITE = 'https://playfooty.com.au'

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function removeMeta(attr: 'name' | 'property', key: string) {
  document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)?.remove()
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export interface Seo {
  title: string
  description?: string
  path?: string
  image?: string
  shareLabel?: string
  type?: 'website' | 'article' | 'profile' | 'video.other'
  noIndex?: boolean
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
}

const JSONLD_ID = 'playfooty-jsonld'

export function shareCardUrl(title: string, description?: string, label = 'PLAYFOOTY') {
  const params = new URLSearchParams({ title, subtitle: description ?? 'Australia’s home of community football', label })
  return `${SITE}/api/share-card?${params.toString()}`
}

export function useSeo({ title, description, path, image, shareLabel, type = 'website', noIndex = false, jsonLd }: Seo) {
  useEffect(() => {
    document.title = title
    const cleanPath = path ?? window.location.pathname
    const url = cleanPath.startsWith('http') ? cleanPath : SITE + cleanPath
    const card = image ?? shareCardUrl(title.replace(/\s*\|\s*PlayFooty.*$/i, ''), description, shareLabel)

    if (description) {
      upsertMeta('name', 'description', description)
      upsertMeta('property', 'og:description', description)
      upsertMeta('name', 'twitter:description', description)
    } else {
      removeMeta('name', 'description')
      removeMeta('property', 'og:description')
      removeMeta('name', 'twitter:description')
    }

    upsertMeta('name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large')
    upsertMeta('property', 'og:site_name', 'PlayFooty')
    upsertMeta('property', 'og:locale', 'en_AU')
    upsertMeta('property', 'og:title', title)
    upsertMeta('property', 'og:type', type)
    upsertMeta('property', 'og:url', url)
    upsertMeta('property', 'og:image', card)
    upsertMeta('property', 'og:image:secure_url', card)
    upsertMeta('property', 'og:image:width', '1200')
    upsertMeta('property', 'og:image:height', '630')
    upsertMeta('property', 'og:image:alt', `${title} share card`)
    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', title)
    upsertMeta('name', 'twitter:image', card)
    upsertLink('canonical', url)

    document.getElementById(JSONLD_ID)?.remove()
    if (jsonLd) {
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.id = JSONLD_ID
      script.textContent = JSON.stringify(jsonLd)
      document.head.appendChild(script)
    }
    return () => { document.getElementById(JSONLD_ID)?.remove() }
  }, [title, description, path, image, shareLabel, type, noIndex, JSON.stringify(jsonLd)])
}

export const canonicalUrl = (path: string) => SITE + path
