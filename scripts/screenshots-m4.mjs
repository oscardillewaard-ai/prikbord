// Screenshots van M4 (link, foto en kaart) op 390 px met het demobord.
// Gebruik: npm run screenshots:m4  (of: node scripts/screenshots-m4.mjs [uitmap])
// Standaard in docs/m4-kaart/. Chromium via CHROMIUM_PATH of /opt/pw-browsers/chromium.
// Let op: de kaarttegels zijn nep (deze computer haalt niets bij OpenStreetMap);
// op de telefoon staat daar de echte kaart.
import { chromium } from 'playwright'
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { start } from './serve.mjs'
import { startWorker, nepNominatim } from './nep-worker.mjs'
import { demoStaatM2, DEMO_NU } from './demo.mjs'
import { zetVeld } from '../public/js/model.js'

const UIT = process.argv[2] || fileURLToPath(new URL('../docs/m4-kaart/', import.meta.url))
const POORT = 4330
const WPOORT = 4331
const jpg = { type: 'jpeg', quality: 70 }
const fouten = []

// Drie "foto's" als tekening (geen echte foto's van mensen).
async function tekening(achter, voor) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900">${achter}${voor}</svg>`
  return (await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer()).toString('base64')
}
const FOTOS = {
  fotoSushi000001: await tekening(
    '<rect width="900" height="900" fill="#2d3b45"/><rect y="560" width="900" height="340" fill="#8a5a3b"/>',
    '<ellipse cx="450" cy="600" rx="330" ry="120" fill="#f4f1ea"/><g fill="#fff"><rect x="230" y="470" width="120" height="90" rx="20"/><rect x="390" y="470" width="120" height="90" rx="20"/><rect x="550" y="470" width="120" height="90" rx="20"/></g><g fill="#f26b4a"><rect x="230" y="455" width="120" height="40" rx="18"/><rect x="390" y="455" width="120" height="40" rx="18"/></g><rect x="550" y="455" width="120" height="40" rx="18" fill="#1f2d1f"/>',
  ),
  fotoStrand00001: await tekening(
    '<rect width="900" height="520" fill="#8fd0f0"/><rect y="460" width="900" height="200" fill="#3d8fc2"/><rect y="640" width="900" height="260" fill="#f1d9a4"/>',
    '<circle cx="700" cy="160" r="80" fill="#ffd54a"/><path d="M150 760 l60 -200 l60 200 z" fill="#e8463a"/><rect x="205" y="560" width="10" height="220" fill="#7a5130"/>',
  ),
  fotoKasteel0001: await tekening(
    '<rect width="900" height="900" fill="#cfe6f5"/><rect y="640" width="900" height="260" fill="#6aa84f"/>',
    '<g fill="#b9a68a"><rect x="250" y="360" width="400" height="300"/><rect x="200" y="260" width="110" height="400"/><rect x="590" y="260" width="110" height="400"/></g><g fill="#8b3a2b"><path d="M190 260 l65 -110 l65 110z"/><path d="M580 260 l65 -110 l65 110z"/></g><rect x="410" y="520" width="80" height="140" rx="40" fill="#5b4632"/>',
  ),
}

function staat() {
  const s = demoStaatM2()
  const bord = s.borden[s.bord]
  const t = DEMO_NU
  const zet = (id, veld, w) => zetVeld(bord.briefjes[id], veld, w, t)
  zet('demo02', 'foto', 'fotoSushi000001')
  zet('demo02', 'plek', { lat: 52.0786, lng: 4.3103, naam: 'Sushi in Den Haag' })
  zet('demo02', 'link', 'https://www.example.nl/sushi-den-haag')
  zet('demo07', 'plek', { lat: 51.6503, lng: 5.0436, naam: 'Efteling' })
  zet('demo08', 'plek', { lat: 52.3665, lng: 4.9443, naam: 'De Kas' })
  zet('demo08', 'link', 'https://www.example.nl/de-kas/reserveren')
  zet('demo12', 'plek', { lat: 52.9894, lng: 5.1047, naam: 'Afsluitdijk' })
  zet('demo05', 'plek', { lat: 51.0543, lng: 3.7174, naam: 'Gent' })
  zet('demo03', 'link', 'https://www.example.nl/recepten/shakshuka')
  zet('demo06', 'foto', 'fotoStrand00001')
  zet('klaar02', 'plek', { lat: 50.8584, lng: 5.8326, naam: 'Valkenburg' })
  bord.briefjes.klaar02.v.gedaan.w.foto = 'fotoKasteel0001'
  return s
}

// Nep-tegels: een rustige kaartachtige achtergrond met wat "straten".
async function tegel(url) {
  const [z, x, y] = url.match(/(\d+)\/(\d+)\/(\d+)\.png/).slice(1).map(Number)
  let h = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791)
  const r = () => ((h = (h * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  const lijnen = Array.from({ length: 5 }, () => `<line x1="${r() * 256}" y1="0" x2="${r() * 256}" y2="256" stroke="#fff" stroke-width="${2 + r() * 4}"/>`).join('')
  const dwars = Array.from({ length: 4 }, () => `<line x1="0" y1="${r() * 256}" x2="256" y2="${r() * 256}" stroke="#fff" stroke-width="${2 + r() * 3}"/>`).join('')
  const groen = r() < 0.35 ? `<circle cx="${r() * 256}" cy="${r() * 256}" r="${30 + r() * 50}" fill="#cfe3bf"/>` : ''
  const water = r() < 0.2 ? `<rect x="0" y="${r() * 200}" width="256" height="${20 + r() * 40}" fill="#b9d8ea"/>` : ''
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#efe9dc"/>${groen}${water}${lijnen}${dwars}</svg>`)).png().toBuffer()
}

await mkdir(UIT, { recursive: true })
const server = await start(POORT)
const nep = nepNominatim()
const { server: ws } = await startWorker(WPOORT)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'nl-NL', timezoneId: 'Europe/Amsterdam', serviceWorkers: 'block' })
await ctx.route('https://tile.openstreetmap.org/**', async (r) => r.fulfill({ status: 200, contentType: 'image/png', body: await tegel(r.request().url()) }))
const s = staat()
await ctx.addInitScript(
  ([json, sync]) => {
    if (!sessionStorage.getItem('demo')) {
      localStorage.setItem('prikbord.v1', json)
      localStorage.setItem('prikbord.sync', sync)
      sessionStorage.setItem('demo', '1')
    }
  },
  [JSON.stringify(s), JSON.stringify({ url: `http://localhost:${WPOORT}`, borden: { [s.bord]: { u: `http://localhost:${WPOORT}`, r: 'Demo_groepscode_1234567' } } })],
)
const p = await ctx.newPage()
p.on('pageerror', (e) => fouten.push(String(e)))
p.on('dialog', (d) => d.accept())
await p.goto(`http://localhost:${POORT}/`)
// De foto's in IndexedDB zetten, zoals de app dat doet, en opnieuw laden.
await p.evaluate(async (fotos) => {
  const db = await new Promise((ok) => {
    const r = indexedDB.open('prikbord', 1)
    r.onupgradeneeded = () => {
      r.result.createObjectStore('fotos')
      r.result.createObjectStore('wachtrij')
    }
    r.onsuccess = () => ok(r.result)
  })
  const tx = db.transaction('fotos', 'readwrite')
  for (const [id, b64] of Object.entries(fotos)) tx.objectStore('fotos').put({ blob: new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: 'image/jpeg' }), t: Date.now() }, id)
  await new Promise((ok) => (tx.oncomplete = ok))
  db.close()
}, FOTOS)
await p.reload()
await p.waitForSelector('.bord-binnen.klaar')
await p.evaluate(() => document.fonts.ready)
await p.waitForSelector('.polaroid:not(.leeg) img[src^="blob:"]')
await p.waitForTimeout(900)
await p.screenshot({ path: join(UIT, 'bord.jpg'), ...jpg })

// Geopend briefje met foto, link en plek
await p.locator('.briefje-plek[data-id="demo02"] .briefje').click()
await p.waitForSelector('.laag[open] .groot')
await p.waitForTimeout(900)
await p.screenshot({ path: join(UIT, 'open.jpg'), ...jpg })
await p.click('[data-laag="op-kaart"]')
await p.waitForSelector('#kaart .kaart-pin')
await p.waitForTimeout(1200)
await p.screenshot({ path: join(UIT, 'op-de-kaart.jpg'), ...jpg })

// De kaart-tab met alles in beeld, en met "Gedaan ook"
await p.click('[data-tab="bord"]')
await p.waitForTimeout(300)
await p.evaluate(() => {
  // Vergeet de kaartpositie, zodat de kaart alles in beeld zet.
  sessionStorage.setItem('demo', '1')
})
await p.reload()
await p.waitForSelector('.bord-binnen.klaar')
await p.click('[data-tab="kaart"]')
await p.waitForSelector('#kaart .kaart-pin')
await p.click('[data-action="kaart-gedaan"]')
// Eén stapje uitzoomen: dan staat ook het gedane briefje (grijs, Valkenburg) in beeld.
await p.click('#kaart .leaflet-control-zoom-out')
await p.waitForTimeout(1200)
await p.screenshot({ path: join(UIT, 'kaart.jpg'), ...jpg })

// Het schrijfvel met link, foto en plek
await p.click('[data-tab="bord"]')
await p.click('#blok')
await p.waitForSelector('#vel-tekst')
await p.waitForTimeout(700)
await p.click('.tabje[data-cat="weekend"]')
await p.fill('#vel-tekst', 'Weekendje Porto: port proeven en de boekwinkel van Harry Potter 📚')
await p.click('[data-vel="link"]')
await p.fill('#vel-link', 'www.example.nl/porto-tips')
await p.click('[data-vel="link-ok"]')
await p.evaluate(() => document.activeElement?.blur())
await p.click('[data-vel="plek"]')
await p.waitForSelector('#kies-kaart.leaflet-container')
await p.fill('#plek-zoek', 'Porto')
await p.click('[data-plek="zoek"]')
await p.waitForSelector('.zoek-uitkomst')
await p.waitForTimeout(900)
await p.screenshot({ path: join(UIT, 'plek-zoeken.jpg'), ...jpg })
await p.locator('.zoek-uitkomst').first().click()
await p.waitForTimeout(900)
await p.screenshot({ path: join(UIT, 'plek-gekozen.jpg'), ...jpg })
await p.click('[data-plek="klaar"]')
await p.waitForSelector('#vel-tekst')
await p.evaluate(() => document.activeElement?.blur())
await p.waitForTimeout(400)
await p.screenshot({ path: join(UIT, 'vel.jpg'), ...jpg })
await p.click('[data-laag="weggooien"]')
await p.waitForTimeout(800)

// Gedaan-doos met een foto bij "gedaan"
await p.click('[data-tab="gedaan"]')
await p.waitForSelector('.geplakt .polaroid:not(.leeg) img[src^="blob:"]')
await p.waitForTimeout(500)
await p.screenshot({ path: join(UIT, 'doos.jpg'), ...jpg })

// Back-up met of zonder foto's
await p.click('[data-tab="meer"]')
await p.click('[data-action="export"]')
await p.waitForSelector('#backup-keus [data-backup="met"]:not([disabled])')
await p.waitForTimeout(300)
await p.screenshot({ path: join(UIT, 'backup.jpg'), ...jpg })

await browser.close()
server.close()
ws.close()
nep.terug()
if (fouten.length) {
  console.error('Fouten in de pagina:', fouten)
  process.exit(1)
}
console.log(`Screenshots in ${UIT}`)
