// Zet de screenshots van de stijlvoorstellen naast elkaar in één plaatje.
// Gebruik: node scripts/contactvel.mjs [map]   (standaard docs/m1-stijlen)
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

const MAP = process.argv[2] || fileURLToPath(new URL('../docs/m1-stijlen/', import.meta.url))
const STIJLEN = [
  ['a', 'A · Klassiek kurk'],
  ['b', 'B · Licht & luchtig'],
  ['c', 'C · Schoolschrift'],
]
const W = 390
const H = 844
const KOP = 70
const GAT = 24

for (const scherm of ['bord', 'open', 'vel']) {
  const breedte = STIJLEN.length * W + (STIJLEN.length + 1) * GAT
  const lagen = []
  for (const [i, [id, naam]] of STIJLEN.entries()) {
    const x = GAT + i * (W + GAT)
    lagen.push({ input: await sharp(`${MAP}/stijl-${id}-${scherm}.jpg`).resize(W, H).toBuffer(), left: x, top: KOP })
    const label = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${KOP}"><text x="${W / 2}" y="44" font-family="DejaVu Sans, sans-serif" font-size="26" font-weight="700" text-anchor="middle" fill="#3a2a1b">${naam.replace('&', '&amp;')}</text></svg>`
    lagen.push({ input: Buffer.from(label), left: x, top: 0 })
  }
  await sharp({ create: { width: breedte, height: KOP + H + GAT, channels: 3, background: '#f6efe3' } })
    .composite(lagen)
    .jpeg({ quality: 85 })
    .toFile(`${MAP}/vergelijk-${scherm}.jpg`)
}
console.log('Contactvellen klaar')
