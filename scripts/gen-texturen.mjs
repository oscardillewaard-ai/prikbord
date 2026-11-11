// Maakt de texturen van het bord: kurk, hout en papier (public/img/*.webp).
// Draaien: npm run texturen
//
// Waarom een script en geen SVG-ruis meer (zie docs/prikbord-afwijkingen.md,
// A7): ruis uit een SVG-filter is overal even korrelig en ziet er daardoor
// goedkoop uit, en elke browser tekent hem net anders. Hier bouwen we de
// structuur zelf op: kurk uit korrels met kieren en putjes, hout uit
// jaarringen en vezels, papier uit een zachte wolk met een paar vezeltjes.
// Elk plaatje sluit naadloos op zichzelf aan (alles rekent "rond": wat er
// rechts af gaat, komt er links weer bij) en is twee keer zo groot als op het
// scherm, zodat het ook op een scherpe telefoon strak blijft.
// De uitkomst is altijd hetzelfde (vast zaadje) en staat in de repo: de app
// zelf heeft geen buildstap.
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { prng } from '../public/js/seed.js'

const UIT = fileURLToPath(new URL('../public/img/', import.meta.url))
const klem = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const meng = (a, b, t) => a + (b - a) * t
const glad = (a, b, x) => {
  const t = klem((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const mod = (n, m) => ((n % m) + m) % m

// Ruis die rondloopt: een rooster van px × py toevalsgetallen, vloeiend
// ertussen. x en y lopen van 0 tot 1 over het hele plaatje.
function ruis(px, py, zaad) {
  const r = prng(zaad)
  const g = Float32Array.from({ length: px * py }, () => r())
  return (x, y) => {
    const fx = x * px
    const fy = y * py
    const x0 = Math.floor(fx)
    const y0 = Math.floor(fy)
    const tx = fx - x0
    const ty = fy - y0
    const sx = tx * tx * (3 - 2 * tx)
    const sy = ty * ty * (3 - 2 * ty)
    const a = g[mod(y0, py) * px + mod(x0, px)]
    const b = g[mod(y0, py) * px + mod(x0 + 1, px)]
    const c = g[mod(y0 + 1, py) * px + mod(x0, px)]
    const d = g[mod(y0 + 1, py) * px + mod(x0 + 1, px)]
    return meng(meng(a, b, sx), meng(c, d, sx), sy)
  }
}
// Een paar lagen ruis op elkaar, elke laag fijner en zwakker (uitkomst 0..1).
function wolk(px, py, lagen, zaad) {
  const ls = Array.from({ length: lagen }, (_, i) => ruis(px * 2 ** i, py * 2 ** i, zaad + i * 101))
  const som = 2 - 2 ** (1 - lagen)
  return (x, y) => ls.reduce((s, l, i) => s + l(x, y) / 2 ** i, 0) / som
}

// Licht van linksboven op een hoogtekaart (rondlopend): geeft per beeldpunt
// hoeveel lichter of donkerder (rond 0).
function licht(hoogte, B, H, sterkte) {
  const uit = new Float32Array(B * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < B; x++) {
      const dx = hoogte[y * B + mod(x + 1, B)] - hoogte[y * B + mod(x - 1, B)]
      const dy = hoogte[mod(y + 1, H) * B + x] - hoogte[mod(y - 1, H) * B + x]
      uit[y * B + x] = (-dx * 0.7 - dy * 0.7) * sterkte
    }
  }
  return uit
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
function kleurVan(stops, t) {
  const n = stops.length - 1
  const f = klem(t) * n
  const i = Math.min(n - 1, Math.floor(f))
  return stops[i].map((c, k) => meng(c, stops[i + 1][k], f - i))
}

// ---------- Kurk: geperste korrels ----------
// Elke korrel is een vakje rond een willekeurig punt (het dichtstbijzijnde
// punt wint, grote korrels winnen van kleine). De randen zijn verbogen, zodat
// het geen tegeltjes worden. Korrels verschillen een beetje van tint, tussen
// korrels van verschillende tint zit een zachte kier, en overal zitten
// donkere spikkels en lichte vlekjes, zoals in echt geperst kurk.
async function kurk() {
  const M = 512
  const CEL = 16 // px: een korrel is op het scherm 4 tot 12 px
  const N = M / CEL
  const r = prng(4201)
  const punten = []
  for (let cy = 0; cy < N; cy++) {
    for (let cx = 0; cx < N; cx++) {
      punten.push({
        x: (cx + r()) * CEL,
        y: (cy + r()) * CEL,
        maat: 0.55 + r() ** 1.6 * 1.1, // veel kleine, een paar grote
        tint: r(),
        put: r() < 0.03,
      })
    }
  }
  const buigX = wolk(14, 14, 2, 301)
  const buigY = wolk(14, 14, 2, 302)
  const fijn = wolk(110, 110, 2, 77)
  const spikkel = wolk(170, 170, 1, 88)
  const breuk = wolk(40, 40, 2, 99)
  const vlek = wolk(3, 3, 3, 12)
  const hoogte = new Float32Array(M * M)
  const basis = new Float32Array(M * M * 3)
  const TINTEN = ['#9a6433', '#ab743f', '#b98349', '#c59153', '#d0a064'].map(hex)
  for (let y = 0; y < M; y++) {
    for (let x = 0; x < M; x++) {
      const u = x / M
      const v = y / M
      // De plek een beetje verbuigen: zo krijgen de korrels grillige randen.
      const wx = x + (buigX(u, v) - 0.5) * 16
      const wy = y + (buigY(u, v) - 0.5) * 16
      const cx = Math.floor(wx / CEL)
      const cy = Math.floor(wy / CEL)
      let d1 = 1e9
      let d2 = 1e9
      let wie = null
      let buur = null
      for (let j = -2; j <= 2; j++) {
        for (let i = -2; i <= 2; i++) {
          const p = punten[mod(cy + j, N) * N + mod(cx + i, N)]
          // Rond: het punt kan ook aan de andere kant van het plaatje liggen.
          let ddx = Math.abs(p.x - mod(wx, M))
          let ddy = Math.abs(p.y - mod(wy, M))
          if (ddx > M / 2) ddx = M - ddx
          if (ddy > M / 2) ddy = M - ddy
          const d = Math.hypot(ddx, ddy) / p.maat
          if (d < d1) {
            d2 = d1
            buur = wie
            d1 = d
            wie = p
          } else if (d < d2) {
            d2 = d
            buur = p
          }
        }
      }
      const korrel = fijn(u, v)
      // De kier: alleen tussen korrels die van tint verschillen, en niet overal even diep.
      const verschil = buur ? Math.abs(wie.tint - buur.tint) : 0
      const diepte = glad(0.12, 0.5, verschil) * glad(0.3, 0.62, breuk(u, v))
      const kier = 1 - (1 - glad(0, 2.2, d2 - d1)) * diepte
      const h = (wie.put ? 0.45 : 0.75 + wie.tint * 0.25) * kier + (korrel - 0.5) * 0.5
      hoogte[y * M + x] = h
      let t = 0.3 + wie.tint * 0.42 + (vlek(u, v) - 0.5) * 0.16 + (korrel - 0.5) * 0.3
      if (wie.put) t -= 0.3
      const k = kleurVan(TINTEN, t)
      // Donkere spikkels en lichte vlekjes door alles heen.
      const sp = spikkel(u, v)
      const donker = (0.74 + 0.26 * kier) * (1 - glad(0.8, 0.93, sp) * 0.34) * (1 + glad(0.82, 0.95, 1 - sp) * 0.12)
      for (let c = 0; c < 3; c++) basis[(y * M + x) * 3 + c] = k[c] * donker
    }
  }
  const L = licht(hoogte, M, M, 0.42)
  const px = Buffer.alloc(M * M * 3)
  const som = [0, 0, 0]
  for (let i = 0; i < M * M; i++) {
    for (let c = 0; c < 3; c++) {
      const w = klem(basis[i * 3 + c] * (1 + L[i]), 0, 255)
      px[i * 3 + c] = w
      som[c] += w
    }
  }
  await sharp(px, { raw: { width: M, height: M, channels: 3 } }).webp({ quality: 84 }).toFile(`${UIT}kurk.webp`)
  return `#${som.map((s) => Math.round(s / (M * M)).toString(16).padStart(2, '0')).join('')}`
}

// ---------- Hout: jaarringen en vezels (liggend) ----------
async function hout() {
  const B = 1024
  const H = 256
  const golf = wolk(3, 2, 3, 31)
  const vezel = wolk(6, 96, 3, 57)
  const porie = wolk(40, 128, 1, 93)
  const tint = wolk(2, 3, 2, 5)
  const hoogte = new Float32Array(B * H)
  const basis = new Float32Array(B * H * 3)
  const TINTEN = ['#4a2c15', '#5e391b', '#734826', '#875832', '#9a6a40'].map(hex)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < B; x++) {
      const u = x / B
      const v = y / H
      // Zeven jaarringen over de hoogte, verbogen door een trage golf.
      const ring = 0.5 + 0.5 * Math.sin(2 * Math.PI * (v * 7 + golf(u, v) * 2.4))
      const ringScherp = ring ** 1.8
      const vz = vezel(u, v)
      const p = glad(0.78, 0.9, porie(u, v)) // korte donkere streepjes (poriën)
      const t = 0.3 + ringScherp * 0.36 + (vz - 0.5) * 0.5 + (tint(u, v) - 0.5) * 0.3 - p * 0.22
      hoogte[y * B + x] = vz * 0.6 + ringScherp * 0.25 - p * 0.5
      const k = kleurVan(TINTEN, t)
      for (let c = 0; c < 3; c++) basis[(y * B + x) * 3 + c] = k[c]
    }
  }
  const L = licht(hoogte, B, H, 0.55)
  const px = Buffer.alloc(B * H * 3)
  for (let i = 0; i < B * H; i++) for (let c = 0; c < 3; c++) px[i * 3 + c] = klem(basis[i * 3 + c] * (1 + L[i]), 0, 255)
  await sharp(px, { raw: { width: B, height: H, channels: 3 } }).webp({ quality: 84 }).toFile(`${UIT}hout.webp`)
}

// ---------- Papier: een zachte wolk en een paar vezeltjes ----------
// Doorzichtig: wit waar het papier iets lichter is, bruin waar het iets
// donkerder is. De kleur van het papier zelf komt uit de CSS eronder.
async function papier() {
  const M = 320
  const zacht = wolk(5, 5, 3, 21)
  const fijn = wolk(80, 80, 2, 63)
  const vezels = new Float32Array(M * M)
  const r = prng(909)
  for (let n = 0; n < 150; n++) {
    let x = r() * M
    let y = r() * M
    let hoek = r() * Math.PI * 2
    const lengte = 6 + r() * 16
    const kracht = (r() < 0.5 ? -1 : 1) * (0.25 + r() * 0.5)
    for (let s = 0; s < lengte; s++) {
      vezels[mod(Math.round(y), M) * M + mod(Math.round(x), M)] += kracht
      x += Math.cos(hoek)
      y += Math.sin(hoek)
      hoek += (r() - 0.5) * 0.5
    }
  }
  const px = Buffer.alloc(M * M * 4)
  for (let y = 0; y < M; y++) {
    for (let x = 0; x < M; x++) {
      const i = y * M + x
      const w = (zacht(x / M, y / M) - 0.5) * 0.7 + (fijn(x / M, y / M) - 0.5) * 0.8 + vezels[i] * 0.55
      const wit = w > 0
      px[i * 4] = wit ? 255 : 70
      px[i * 4 + 1] = wit ? 255 : 46
      px[i * 4 + 2] = wit ? 255 : 22
      px[i * 4 + 3] = klem(Math.abs(w) * (wit ? 54 : 30), 0, 255)
    }
  }
  await sharp(px, { raw: { width: M, height: M, channels: 4 } }).webp({ quality: 82, alphaQuality: 80 }).toFile(`${UIT}papier.webp`)
}

const gemiddeld = await kurk()
await hout()
await papier()
console.log(`Texturen gemaakt in public/img/. Gemiddelde kleur van het kurk: ${gemiddeld} (zet die als --kurk-kleur in styles.css).`)
