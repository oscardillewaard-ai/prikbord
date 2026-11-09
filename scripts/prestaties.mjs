// Prestaties meten (M5): een bord met 300 briefjes, waarvan een deel met
// foto, link, plek en hartjes, op een telefoonscherm (390 × 844, 3× scherp).
// De CPU wordt vertraagd (standaard 4×, zoals Lighthouse een gewone
// telefoon nabootst) en daarna scrollen we met een echt aanraakgebaar.
//
// Gebruik: npm run prestaties  (of: node scripts/prestaties.mjs [opties])
//   --briefjes 300  --fotos 60  --cpu 4   het bord en hoeveel trager de CPU is
//   --tweede        meet de tweede keer scrollen (de duimnagels liggen dan klaar)
//   --css '…'       extra CSS, om een variant te vergelijken (bijv. '.briefje-plek{filter:none}')
//   --trace         schrijft een Chrome-trace van het scrollen (pad staat in de uitvoer)
//
// Let op: dit is een nabootsing op een cloudcomputer zonder grafische kaart
// (Chromium tekent dan zonder GPU). Een echte telefoon tekent anders: sneller
// met de GPU, maar met minder geheugen. Gebruik de getallen om varianten met
// elkaar te vergelijken, niet als belofte voor één bepaalde telefoon.
import { chromium } from 'playwright'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { start } from './serve.mjs'
import { volBord, ruisFoto } from './vol-bord.mjs'

const arg = (naam, standaard) => {
  const i = process.argv.indexOf(`--${naam}`)
  return i > 0 ? Number(process.argv[i + 1]) : standaard
}
const AANTAL = arg('briefjes', 300)
const FOTOS = arg('fotos', 60)
const CPU = arg('cpu', 4)
// Om varianten te vergelijken: extra CSS (bijv. --css '.briefje-plek{filter:none}').
const EXTRA_CSS = process.argv.includes('--css') ? process.argv[process.argv.indexOf('--css') + 1] : ''
const POORT = 4340

// ---------- Meten ----------

const { s, fotoIds } = volBord({ aantal: AANTAL, fotos: FOTOS })
s.apparaat.seenVersion = 999
s.apparaat.naam = 'Oscar'
const varianten = await Promise.all([0, 1, 2, 3, 4, 5].map(async (n) => (await ruisFoto(n)).toString('base64')))
const server = await start(POORT)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: 'nl-NL',
  serviceWorkers: 'block',
})
await ctx.addInitScript(([json, css]) => {
  if (css) document.addEventListener('DOMContentLoaded', () => document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`))
  if (!sessionStorage.getItem('klaar')) {
    localStorage.setItem('prikbord.v1', json)
    sessionStorage.setItem('klaar', '1')
  }
  // Lange taken (> 50 ms) en frames tellen.
  window.__lang = []
  try {
    new PerformanceObserver((l) => window.__lang.push(...l.getEntries().map((e) => ({ t: e.startTime, d: e.duration })))).observe({ type: 'longtask', buffered: true })
  } catch {
    // geen longtask in deze browser
  }
}, [JSON.stringify(s), EXTRA_CSS])
const p = await ctx.newPage()
const fouten = []
p.on('pageerror', (e) => fouten.push(String(e)))
await p.goto(`http://localhost:${POORT}/`)
// De foto's in IndexedDB zetten (zoals de app ze bewaart), dan opnieuw starten.
await p.evaluate(
  async ([ids, varianten]) => {
    const db = await new Promise((ok) => {
      const r = indexedDB.open('prikbord')
      r.onsuccess = () => ok(r.result)
    })
    const blobs = varianten.map((b64) => new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: 'image/jpeg' }))
    const tx = db.transaction('fotos', 'readwrite')
    ids.forEach((id, i) => tx.objectStore('fotos').put({ blob: blobs[i % blobs.length], t: Date.now() }, id))
    await new Promise((ok) => (tx.oncomplete = ok))
    db.close()
  },
  [fotoIds, varianten],
)

const cdp = await ctx.newCDPSession(p)
const veeg = (y) => cdp.send('Input.synthesizeScrollGesture', { x: 195, y: 500, yDistance: y, speed: 1500, gestureSourceType: 'default', preventFling: true })
// --tweede: de tweede keer scrollen meten. Eerst één keer het hele bord langs
// (dan staan alle duimnagels klaar in IndexedDB), daarna herladen.
if (process.argv.includes('--tweede')) {
  await p.reload()
  await p.waitForSelector('.bord-binnen.klaar')
  for (let i = 0; i < 6; i++) await veeg(-3000)
  await p.waitForTimeout(4000)
}
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
const t0 = Date.now()
await p.reload()
await p.waitForSelector('.bord-binnen.klaar')
const startMs = Date.now() - t0
await p.evaluate(() => document.fonts.ready)
await p.waitForTimeout(3000) // foto's die meteen laden, krijgen even de tijd

// Hoeveel beeldpunten de browser aan foto's heeft moeten uitpakken
// (breedte × hoogte × 4 bytes = geheugen voor de uitgepakte foto).
const fotoStand = () =>
  p.evaluate(() => {
    const imgs = [...document.querySelectorAll('.polaroid img')]
    const geladen = imgs.filter((i) => i.getAttribute('src'))
    return {
      polaroids: imgs.length,
      geladen: geladen.length,
      megapixels: Math.round(geladen.reduce((n, i) => n + (i.naturalWidth * i.naturalHeight || 0), 0) / 1e5) / 10,
    }
  })
const naStart = await fotoStand()
const langBijStart = await p.evaluate(() => window.__lang.filter((l) => l.d > 50))

// Scrollen met de vinger: een paar vegen naar beneden en weer terug.
await p.evaluate(() => {
  window.__lang = []
  window.__frames = []
  window.__meet = true
  let vorige = performance.now()
  const f = (t) => {
    window.__frames.push(t - vorige)
    vorige = t
    if (window.__meet) requestAnimationFrame(f)
  }
  requestAnimationFrame(f)
})
const hoogte = await p.evaluate(() => document.documentElement.scrollHeight)
const afstand = Math.min(hoogte - 844, 12000)
const TRACE = process.argv.includes('--trace') && join(tmpdir(), `prikbord-trace-${Date.now()}.json`)
if (TRACE) await browser.startTracing(p, { path: TRACE, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink', 'v8', 'disabled-by-default-v8.cpu_profiler'] })
for (let i = 0; i < 4; i++) await veeg(-afstand / 4)
const onderaan = await p.evaluate(() => scrollY)
for (let i = 0; i < 2; i++) await veeg(afstand / 2)
await p.waitForTimeout(300)
if (TRACE) await browser.stopTracing()
const scroll = await p.evaluate(() => {
  window.__meet = false
  const fr = window.__frames.slice(2).sort((a, b) => a - b)
  const pct = (q) => Math.round(fr[Math.min(fr.length - 1, Math.floor(q * fr.length))] * 10) / 10
  return {
    frames: fr.length,
    haperend: fr.filter((d) => d > 25).length,
    p50: pct(0.5),
    p95: pct(0.95),
    p99: pct(0.99),
    max: Math.round(fr[fr.length - 1]),
    langeTaken: window.__lang.length,
    langsteTaak: Math.round(Math.max(0, ...window.__lang.map((l) => l.d))),
  }
})
const naScroll = await fotoStand()

const uit = {
  briefjes: AANTAL,
  fotos: fotoIds.length,
  cpu: `${CPU}× trager`,
  bordHoogte: hoogte,
  gescrold: `${onderaan} px omlaag en terug`,
  startMs,
  langeTakenBijStart: langBijStart.length,
  langsteTaakBijStart: Math.round(Math.max(0, ...langBijStart.map((l) => l.d))),
  fotosNaStart: naStart,
  scroll,
  fotosNaScroll: naScroll,
  ...(TRACE ? { trace: TRACE } : {}),
  fouten,
}
console.log(JSON.stringify(uit, null, 2))
await browser.close()
server.close()
