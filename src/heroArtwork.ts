import heroPlayer from './assets/heroPlayer'

const style = document.createElement('style')
style.dataset.playfootyHeroArtwork = 'true'
style.textContent = `
  .pf-hero-art {
    isolation: isolate;
    background: #fff;
    overflow: hidden;
  }

  .pf-hero-art .pf-speed-lines,
  .pf-hero-art .pf-player-shape {
    display: none !important;
  }

  .pf-hero-player-image {
    position: absolute;
    inset: 0 0 76px -6%;
    z-index: 0;
    width: 106%;
    height: calc(100% - 76px);
    object-fit: contain;
    object-position: right bottom;
    pointer-events: none;
    user-select: none;
  }

  .pf-hero-art .pf-number-one {
    z-index: 2;
  }

  @media (max-width: 980px) {
    .pf-hero-player-image {
      inset: 0 0 74px 0;
      width: 100%;
      height: calc(100% - 74px);
      object-position: center bottom;
    }
  }

  @media (max-width: 620px) {
    .pf-hero-art {
      min-height: 520px !important;
    }

    .pf-hero-player-image {
      inset: auto auto 60px 52%;
      width: 175%;
      height: auto;
      max-width: none;
      transform: translateX(-50%);
      object-fit: contain;
      object-position: center bottom;
    }
  }
`
document.head.appendChild(style)

function mountHeroArtwork() {
  const hero = document.querySelector<HTMLElement>('.pf-hero-art')
  if (!hero || hero.querySelector('.pf-hero-player-image')) return Boolean(hero)

  const image = document.createElement('img')
  image.src = heroPlayer
  image.alt = ''
  image.setAttribute('aria-hidden', 'true')
  image.className = 'pf-hero-player-image'
  image.decoding = 'async'
  image.fetchPriority = 'high'
  hero.prepend(image)
  return true
}

if (!mountHeroArtwork()) {
  const observer = new MutationObserver(() => {
    if (mountHeroArtwork()) observer.disconnect()
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
}
