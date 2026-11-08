// Screenshots op 390 px met een demobord, plus een filmstrip van het
// scheur-en-prik-moment (in slow motion vastgelegd).
// Gebruik: node scripts/screenshots.mjs [uitmap]   (standaard docs/m1-stijl)
// Chromium via CHROMIUM_PATH of /opt/pw-browsers/chromium, zoals scripts/audit.mjs in Tezt.
import { chromium } from 'playwright'
import sharp from 'sharp'
import { mkdir, mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { start } from './serve.mjs'
import { beginStaat, nieuwBriefje, voegLidToe } from '../public/js/model.js'

const UIT = process.argv[2] || fileURLToPath(new URL('../docs/m1-stijl/', import.meta.url))
const POORT = 4319
const TRAAG = 10 // slow motion voor de filmstrip

// Een demobord met briefjes van drie mensen (alleen voor de plaatjes).
function demoStaat() {
  const nu = Date.parse('2026-11-08T12:00:00+01:00')
  const s = beginStaat(nu - 30 * 864e5)
  const bord = s.borden[s.bord]
  const ik = s.apparaat.ik[s.bord]
  bord.leden[ik].naam = { w: 'Oscar', t: nu }
  const tara = voegLidToe(bord, { id: 'lidtara1', naam: 'Tara', kleur: 'blauw', now: nu })
  const sam = voegLidToe(bord, { id: 'lidsam01', naam: 'Sam', kleur: 'groen', now: nu })
  const briefjes = [
    [ik, 'vakantie', 'Met de trein door Italië: Milaan, Bologna voor de pasta, Florence voor het ijs en dan een week aan zee bij Positano 🍦🚂 En onderweg nog even naar Napels voor de echte pizza'],
    [tara, 'uiteten', 'Sushi in Den Haag 🍣'],
    [ik, 'recepten', 'Shakshuka met feta en véél koriander'],
    [sam, 'bucketlist', 'Noorderlicht zien ✨'],
    [tara, 'weekend', 'Weekendje België: Gent, frietjes en een ruïne bezoeken'],
    [ik, 'todo', 'Fietsband plakken 🚲'],
    [sam, 'dagjeuit', 'Efteling in de winter ❄️'],
    [tara, 'restaurants', 'De Kas in Amsterdam (reserveren!)'],
    [ik, 'todo', 'Dakgoot schoonmaken voor de herfst 🍂'],
    [tara, 'recepten', 'Pompoensoep met gember'],
    [sam, 'bucketlist', 'Ooit een marathon lopen 🏃'],
    [ik, 'dagjeuit', 'Fietsen over de Afsluitdijk'],
  ]
  briefjes.forEach(([door, cat, tekst], i) => {
    nieuwBriefje(bord, { id: `demo${String(i + 1).padStart(2, '0')}`, door, tekst, cat, now: nu - (i + 1) * 3600e3 })
  })
  s.apparaat.seenVersion = 1
  s.apparaat.laatsteCat[s.bord] = 'weekend'
  return s
}

async function pagina(browser, staat, { traag = 1, schaal = 2 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: schaal, locale: 'nl-NL', timezoneId: 'Europe/Amsterdam', serviceWorkers: 'block' })
  await ctx.addInitScript(
    ([s, f]) => {
      if (!sessionStorage.getItem('demo')) {
        localStorage.setItem('prikbord.v1', s)
        sessionStorage.setItem('demo', '1')
      }
      if (f > 1) {
        // Slow motion: alle Web Animations f keer langzamer.
        const echt = Element.prototype.animate
        Element.prototype.animate = function (kf, o) {
          const opt = typeof o === 'number' ? { duration: o } : { ...o }
          opt.duration = (opt.duration || 0) * f
          opt.delay = (opt.delay || 0) * f
          return echt.call(this, kf, opt)
        }
      }
    },
    [staat, traag],
  )
  const p = await ctx.newPage()
  p.on('pageerror', (e) => fouten.push(e.message))
  p.on('console', (m) => m.type() === 'error' && fouten.push(m.text()))
  await p.goto(`http://localhost:${POORT}/`)
  await p.waitForSelector('.bord-binnen.klaar')
  await p.evaluate(() => document.fonts.ready)
  await p.waitForTimeout(600)
  return { ctx, p }
}

await mkdir(UIT, { recursive: true })
const server = await start(POORT)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' })
const fouten = []
const staat = JSON.stringify(demoStaat())
const jpg = { type: 'jpeg', quality: 85 }

// 1. Gewone schermen
{
  const { ctx, p } = await pagina(browser, staat)
  await p.screenshot({ path: `${UIT}/bord.jpg`, ...jpg })
  await p.click('[data-id="demo03"] .briefje')
  await p.waitForSelector('.laag[open] .groot')
  await p.waitForTimeout(700)
  await p.screenshot({ path: `${UIT}/open.jpg`, ...jpg })
  await p.click('[data-laag="sluit"]')
  await p.waitForSelector('.laag:not([open])', { state: 'attached' })
  await p.click('#blok')
  await p.waitForSelector('#vel-tekst')
  await p.waitForTimeout(800)
  await p.fill('#vel-tekst', 'Huisje op de Veluwe met de hele club 🌲🏡')
  await p.locator('#vel-tekst').blur()
  await p.waitForTimeout(200)
  await p.screenshot({ path: `${UIT}/vel.jpg`, ...jpg })
  await ctx.close()
}

// 2. Filmstrip: scheuren, vliegen, prikken (slow motion, tijden in echte ms × TRAAG)
const tmp = await mkdtemp(join(tmpdir(), 'prikbord-film-'))
const beelden = []
{
  const { ctx, p } = await pagina(browser, staat, { traag: TRAAG, schaal: 1 })
  const foto = async (label) => {
    const pad = join(tmp, `${beelden.length}.png`)
    await p.screenshot({ path: pad })
    beelden.push({ pad, label })
  }
  const t0 = Date.now()
  const tot = (ms) => p.waitForTimeout(Math.max(0, ms - (Date.now() - t0)))
  await p.click('#blok')
  const tStart = Date.now() - t0
  for (const [ms, label] of [
    [90, '1 · tik: rrrits!'],
    [190, '2 · het vel scheurt eraf'],
    [380, '3 · en groeit'],
  ]) {
    await tot(tStart + ms * TRAAG)
    await foto(label)
  }
  await p.waitForSelector('.laag:not(.bezig)', { timeout: 20000 })
  await p.fill('#vel-tekst', 'Huisje op de Veluwe 🌲')
  await p.locator('#vel-tekst').blur()
  await foto('4 · schrijven')
  const t1 = Date.now()
  await p.click('.prik')
  const na = (ms) => p.waitForTimeout(Math.max(0, ms * TRAAG - (Date.now() - t1)))
  for (const [ms, label] of [
    [150, '5 · Prikken! krimpen'],
    [330, '6 · vliegen'],
    [560, '7 · landen'],
  ]) {
    await na(ms)
    await foto(label)
  }
  await p.waitForSelector('.laag:not([open])', { state: 'attached', timeout: 20000 })
  const t2 = Date.now()
  const pin = (ms) => p.waitForTimeout(Math.max(0, ms * TRAAG - (Date.now() - t2)))
  await pin(150)
  await foto('8 · de punaise komt')
  await pin(380)
  await foto('9 · tok! buren wiebelen')
  await ctx.close()
}

// Filmstrip in twee rijen, met onderschriften.
const B = 390 * 0.62
const H = 844 * 0.62
const KOP = 34
const GAT = 14
const perRij = 5
const rijen = Math.ceil(beelden.length / perRij)
const lagen = []
for (const [i, { pad, label }] of beelden.entries()) {
  const x = GAT + (i % perRij) * (B + GAT)
  const y = GAT + Math.floor(i / perRij) * (H + KOP + GAT)
  lagen.push({ input: await sharp(pad).resize(Math.round(B), Math.round(H)).toBuffer(), left: Math.round(x), top: Math.round(y + KOP) })
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(B)}" height="${KOP}"><text x="0" y="23" font-family="DejaVu Sans, sans-serif" font-size="16" font-weight="700" fill="#3a2a1b">${label.replace('&', '&amp;')}</text></svg>`
  lagen.push({ input: Buffer.from(svg), left: Math.round(x), top: Math.round(y) })
}
await sharp({ create: { width: Math.round(GAT + perRij * (B + GAT)), height: Math.round(GAT + rijen * (H + KOP + GAT)), channels: 3, background: '#f6efe3' } })
  .composite(lagen)
  .jpeg({ quality: 85 })
  .toFile(`${UIT}/scheur-en-prik.jpg`)

await browser.close()
server.close()
if (fouten.length) {
  console.error('Fouten in de browser:\n' + fouten.join('\n'))
  process.exit(1)
}
console.log(`Klaar: screenshots in ${UIT}`)
