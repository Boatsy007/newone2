import { Router } from 'express'

const image = Buffer.from(
  `PLACEHOLDER`,
  'base64',
)

const router = Router()

router.get('/social-preview-v2.jpg', (_req, res) => {
  res.set({
    'Content-Type': 'image/jpeg',
    'Content-Length': String(image.length),
    'Cache-Control': 'public, max-age=31536000, immutable',
  })
  res.send(image)
})

export { router as socialPreviewRouter }
