import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const tour = JSON.parse(fs.readFileSync(path.join(root, 'scripts/screenshot-tour.json'), 'utf-8'))
const shotsDir = path.join(root, 'docs/screenshots')
const thumbsDir = path.join(shotsDir, 'thumbs')

fs.mkdirSync(thumbsDir, { recursive: true })

const gifWidth = tour.gif?.width ?? 960
const frameDelayMs = tour.gif?.frameDelayMs ?? 2200
const gifFrames = []

for (const frame of tour.frames) {
  const src = path.join(shotsDir, `${frame.file}.png`)
  if (!fs.existsSync(src)) {
    console.warn(`Skip missing screenshot: ${frame.file}.png`)
    continue
  }

  const thumbOut = path.join(thumbsDir, `${frame.file}.jpg`)
  await sharp(src)
    .resize(480, null, { withoutEnlargement: true })
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(thumbOut)
  console.log(`Wrote ${path.relative(root, thumbOut)}`)

  const resized = await sharp(src)
    .resize(gifWidth, null, { withoutEnlargement: true })
    .png()
    .toBuffer()
  gifFrames.push(resized)
}

if (gifFrames.length >= 2 && tour.gif?.file) {
  const gifOut = path.join(shotsDir, tour.gif.file)
  const delays = Array(gifFrames.length).fill(frameDelayMs)
  await sharp(gifFrames, { join: { animated: true } })
    .gif({ loop: 0, delay: delays, keepDuplicateFrames: true })
    .toFile(gifOut)
  console.log(`Wrote ${path.relative(root, gifOut)} (${gifFrames.length} frames, ${frameDelayMs}ms each)`)
} else {
  console.warn('Skipped GIF — need at least 2 frames')
}
