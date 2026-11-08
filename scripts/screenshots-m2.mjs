// Screenshots van M2 (het bord) op 390 px met een demobord, plus een
// filmstrip van "Gedaan!" (in slow motion vastgelegd).
// Gebruik: node scripts/screenshots-m2.mjs [uitmap]   (standaard docs/m2-bord)
// Chromium via CHROMIUM_PATH of /opt/pw-browsers/chromium.
import { chromium } from 'playwright'
import sharp from 'sharp'
import { mkdir, mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { start } from './serve.mjs'
import { demoStaatM2 } from './demo.mjs'

const UIT = process.argv[2] || fileURLToPath(new URL('../docs/m2-bord/', import.meta.url))
const POORT = 4318
const TRAAG = 8
const fouten = []
const jpg = { type: 'jpeg', quality: 85 }

async function pagina(browser, staat, { traag = 1, schaal = 2 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: schaal, locale: 'nl-NL', timezoneId: 'Europe/Amsterdam', serviceWorkers: 'block' })
  await ctx.addInitScript(
    ([s, f]) => {
      if (!sessionStorage.getItem('demo')) {
        localStorage.setItem('prikbord.v1', s)
        sessionStorage.setItem('demo', '1')
      }
      // Vaste "toevalligheden", zodat de plaatjes elke keer hetzelfde zijn.
      let zaad = 7
      Math.random = () => ((zaad = (zaad * 16807) % 2147483647) - 1) / 2147483646
      if (f > 1) {
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
const rustig = (p) => p.waitForSelector('.laag:not(.bezig)', { state: 'attached', timeout: 20000 })
const dicht = (p) => p.waitForSelector('.laag:not([open])', { state: 'attached', timeout: 20000 })

await mkdir(UIT, { recursive: true })
const server = await start(POORT)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' })
const staat = JSON.stringify(demoStaatM2())

{
  const { ctx, p } = await pagina(browser, staat)
  await p.screenshot({ path: `${UIT}/1-bord.jpg`, ...jpg })
  // Filter: Recepten en Uit eten
  await p.click('[data-filter="cat"][data-cat="recepten"]')
  await p.click('[data-filter="cat"][data-cat="uiteten"]')
  await p.waitForTimeout(800)
  await p.screenshot({ path: `${UIT}/2-filter.jpg`, ...jpg })
  await p.click('[data-filter="alles"]')
  // Sorteren op hartjes
  await p.click('[data-action="sorteer"]')
  await p.waitForTimeout(800)
  await p.screenshot({ path: `${UIT}/3-meeste-hartjes.jpg`, ...jpg })
  await p.click('[data-action="sorteer"]')
  await p.waitForTimeout(700)
  // Dubbeltik: het hart klopt
  await p.dblclick('[data-id="demo03"] .briefje')
  await p.waitForTimeout(230)
  await p.screenshot({ path: `${UIT}/4-dubbeltik.jpg`, ...jpg })
  await p.waitForTimeout(800)
  // Geopend briefje
  await p.click('[data-id="demo02"] .briefje')
  await p.waitForSelector('.laag[open] .groot')
  await rustig(p)
  await p.screenshot({ path: `${UIT}/5-open.jpg`, ...jpg })
  await p.click('[data-laag="gedaan"]')
  await p.fill('[name="notitie"]', 'Beste sushi ooit! Volgende keer weer 🍣')
  await p.locator('[name="notitie"]').blur()
  await p.waitForTimeout(200)
  await p.screenshot({ path: `${UIT}/6-gedaan.jpg`, ...jpg })
  await p.click('#gedaan-form [type="submit"]')
  await dicht(p)
  await p.waitForTimeout(1600)
  // De Gedaan-doos
  await p.click('[data-tab="gedaan"]')
  await p.waitForSelector('.doos')
  await p.waitForTimeout(300)
  await p.screenshot({ path: `${UIT}/7-doos.jpg`, ...jpg })
  await p.click('[data-tab="bord"]')
  // Trek een briefje
  await p.click('[data-action="trek"]')
  await p.waitForSelector('.laag[open] .groot[data-soort="trek"]')
  await rustig(p)
  await p.waitForTimeout(300)
  await p.screenshot({ path: `${UIT}/8-trek.jpg`, ...jpg })
  await p.click('[data-laag="sluit"]')
  await dicht(p)
  // Vrij
  await p.click('[data-weergave="vrij"]')
  await p.waitForSelector('#vrij-wereld .briefje-plek')
  await p.waitForTimeout(5000) // de uitleg verdwijnt
  await p.screenshot({ path: `${UIT}/9-vrij.jpg`, ...jpg })
  // Optillen en slepen (muis: lang drukken, dan schuiven)
  const r = await p.locator('#vrij-wereld [data-id="demo05"] .briefje').boundingBox()
  await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2)
  await p.mouse.down()
  await p.waitForTimeout(420)
  await p.mouse.move(r.x + r.width / 2 + 60, r.y + r.height / 2 + 140, { steps: 8 })
  await p.waitForTimeout(250)
  await p.screenshot({ path: `${UIT}/10-vrij-slepen.jpg`, ...jpg })
  await p.mouse.up()
  await p.waitForTimeout(900)
  await p.click('[data-zoom="in"]')
  await p.click('[data-zoom="in"]')
  await p.waitForTimeout(500)
  await p.screenshot({ path: `${UIT}/11-vrij-zoom.jpg`, ...jpg })
  await p.click('[data-weergave="netjes"]')
  // Categorieën
  await p.click('[data-tab="meer"]')
  await p.screenshot({ path: `${UIT}/12-meer.jpg`, ...jpg })
  await p.click('[data-action="cats"]')
  await p.waitForSelector('.laag[open] .paneel')
  await p.waitForTimeout(300)
  await p.screenshot({ path: `${UIT}/13-categorieen.jpg`, ...jpg })
  await p.click('[data-cats="nieuw"]')
  await p.fill('[name="naam"]', 'Films kijken')
  await p.click('[data-emoji="🎬"]')
  await p.click('.kleur.papier-lila')
  await p.locator('[name="naam"]').blur()
  await p.waitForTimeout(200)
  await p.screenshot({ path: `${UIT}/14-categorie-nieuw.jpg`, ...jpg })
  await ctx.close()
}

// Filmstrip: Gedaan! → plop → het briefje valt in de doos → confetti
const tmp = await mkdtemp(join(tmpdir(), 'prikbord-film-'))
const beelden = []
{
  const { ctx, p } = await pagina(browser, staat, { traag: TRAAG, schaal: 1 })
  const foto = async (label) => {
    const pad = join(tmp, `${beelden.length}.png`)
    await p.screenshot({ path: pad })
    beelden.push({ pad, label })
  }
  await p.click('[data-id="demo04"] .briefje')
  await p.waitForSelector('.laag[open] .groot')
  await rustig(p)
  await p.click('[data-laag="gedaan"]')
  await p.fill('[name="notitie"]', 'Eindelijk! In Tromsø 🌌')
  await p.locator('[name="notitie"]').blur()
  await foto('1 · Gedaan! 🎉')
  const t1 = Date.now()
  await p.click('#gedaan-form [type="submit"]')
  const na = (ms) => p.waitForTimeout(Math.max(0, ms * TRAAG - (Date.now() - t1)))
  for (const [ms, label] of [
    [180, '2 · plop! de punaise springt eruit'],
    [420, '3 · het briefje valt'],
    [700, '4 · in de doos'],
  ]) {
    await na(ms)
    await foto(label)
  }
  await dicht(p)
  const t2 = Date.now()
  await p.waitForTimeout(Math.max(0, 380 * TRAAG - (Date.now() - t2)))
  await foto('5 · confetti! 🎊')
  await ctx.close()
}

const B = 390 * 0.62
const H = 844 * 0.62
const KOP = 34
const GAT = 14
const lagen = []
for (const [i, { pad, label }] of beelden.entries()) {
  const x = GAT + i * (B + GAT)
  lagen.push({ input: await sharp(pad).resize(Math.round(B), Math.round(H)).toBuffer(), left: Math.round(x), top: Math.round(GAT + KOP) })
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(B)}" height="${KOP}"><text x="0" y="23" font-family="DejaVu Sans, sans-serif" font-size="15" font-weight="700" fill="#3a2a1b">${label.replace('&', '&amp;')}</text></svg>`
  lagen.push({ input: Buffer.from(svg), left: Math.round(x), top: GAT })
}
await sharp({ create: { width: Math.round(GAT + beelden.length * (B + GAT)), height: Math.round(GAT * 2 + H + KOP), channels: 3, background: '#f6efe3' } })
  .composite(lagen)
  .jpeg({ quality: 85 })
  .toFile(`${UIT}/gedaan-filmstrip.jpg`)

await browser.close()
server.close()
if (fouten.length) {
  console.error('Fouten in de browser:\n' + fouten.join('\n'))
  process.exit(1)
}
console.log(`Klaar: screenshots in ${UIT}`)
