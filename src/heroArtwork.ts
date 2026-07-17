import heroPlayer from './assets/heroPlayer'

const style = document.createElement('style')
style.dataset.playfootyHeroArtwork = 'true'
style.textContent = `
  .pf-hero-art {
    isolation: isolate;
    background: #fff;
  }

  .pf-hero-art .pf-speed-lines,
  .pf-hero-art .pf-player-shape {
    display: none !important;
  }

  .pf-hero-art::before {
    content: '';
    position: absolute;
    inset: 0 0 76px -6%;
    z-index: 0;
    background-image: url("${heroPlayer}");
    background-repeat: no-repeat;
    background-position: right bottom;
    background-size: contain;
    pointer-events: none;
  }

  .pf-hero-art .pf-number-one {
    z-index: 2;
  }

  @media (max-width: 980px) {
    .pf-hero-art::before {
      inset: 0 0 74px 0;
      background-position: center bottom;
    }
  }

  @media (max-width: 620px) {
    .pf-hero-art {
      min-height: 460px !important;
    }

    .pf-hero-art::before {
      inset: 0 -15% 76px -15%;
      background-position: center bottom;
      background-size: contain;
    }
  }
`

document.head.appendChild(style)
