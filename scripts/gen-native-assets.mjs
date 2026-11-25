// Regenerates the native app icons + splash screens from public/brand/finora-mark.svg.
// Run: node scripts/gen-native-assets.mjs   (needs the dev dependency `sharp`)
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const MARK = readFileSync('public/brand/finora-mark.svg')
const BG = '#F4F7FC'
const WHITE = '#FFFFFF'

const mark = (size) => sharp(MARK, { density: 384 }).resize(size, size, { fit: 'contain' }).png().toBuffer()

/** logo centred on a solid (or transparent) square canvas, logo = `ratio` of the canvas */
async function square(size, ratio, background) {
  const m = await mark(Math.round(size * ratio))
  const base = sharp({
    create: { width: size, height: size, channels: 4, background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } },
  })
  return base.composite([{ input: m, gravity: 'centre' }]).png()
}

async function splash(w, h, file) {
  const m = await mark(Math.round(Math.min(w, h) * 0.3))
  await sharp({ create: { width: w, height: h, channels: 3, background: BG } })
    .composite([{ input: m, gravity: 'centre' }])
    .png()
    .toFile(file)
}

// ---- Android --------------------------------------------------------------------------------
const res = 'android/app/src/main/res'
const dens = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }
for (const [d, px] of Object.entries(dens)) {
  const dir = join(res, `mipmap-${d}`)
  await (await square(px, 0.72, WHITE)).toFile(join(dir, 'ic_launcher.png'))
  // round: white disc
  const disc = Buffer.from(`<svg width="${px}" height="${px}"><circle cx="${px / 2}" cy="${px / 2}" r="${px / 2}" fill="#fff"/></svg>`)
  const round = await (await square(px, 0.64, null)).toBuffer()
  await sharp(disc).composite([{ input: round }]).png().toFile(join(dir, 'ic_launcher_round.png'))
  // adaptive foreground: 108dp canvas, logo inside the 66% safe zone
  const fg = Math.round((px / 48) * 108)
  await (await square(fg, 0.5, null)).toFile(join(dir, 'ic_launcher_foreground.png'))
}
for (const dir of readdirSync(res).filter((d) => d.startsWith('drawable'))) {
  const f = join(res, dir, 'splash.png')
  try {
    statSync(f)
  } catch {
    continue
  }
  const { width, height } = await sharp(f).metadata()
  await splash(width, height, f)
}

// ---- iOS ------------------------------------------------------------------------------------
const assets = 'ios/App/App/Assets.xcassets'
await (await square(1024, 0.7, WHITE)).flatten({ background: WHITE }).toFile(join(assets, 'AppIcon.appiconset/AppIcon-512@2x.png'))
for (const f of readdirSync(join(assets, 'Splash.imageset')).filter((x) => x.endsWith('.png'))) {
  await splash(2732, 2732, join(assets, 'Splash.imageset', f))
}
console.log('native assets regenerated')
