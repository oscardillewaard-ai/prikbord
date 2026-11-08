// Maakt van het icoon (SVG) de PNG-maten die iOS en het manifest nodig hebben.
// Draaien: npm run icons
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

const src = fileURLToPath(new URL('./prikbord-icon.svg', import.meta.url))
const out = fileURLToPath(new URL('../public/icons/', import.meta.url))

for (const [naam, maat] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  // Palet-PNG: de kurkruis comprimeert slecht, zo blijft het icoon klein.
  await sharp(src, { density: 300 }).resize(maat, maat).png({ palette: true, colors: 160, compressionLevel: 9 }).toFile(out + naam)
}
