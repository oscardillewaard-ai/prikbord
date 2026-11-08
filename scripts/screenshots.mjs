// Screenshots van de stijlvoorstellen op 390 px (M1), met een demobord.
// Gebruik: node scripts/screenshots.mjs [uitmap]   (standaard docs/m1-stijlen)
// Chromium via CHROMIUM_PATH of /opt/pw-browsers/chromium, zoals scripts/audit.mjs in Tezt.
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { start } from './serve.mjs'
import { beginStaat, nieuwBriefje, voegLidToe, zetVeld } from '../public/js/model.js'

const UIT = process.argv[2] || fileURLToPath(new URL('../docs/m1-stijlen/', import.meta.url))
const POORT = 4319
const STIJLEN = (process.env.STIJLEN || 'a,b,c').split(',')

// Een demobord met een paar briefjes van drie mensen (alleen voor de plaatjes).
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
    const b = nieuwBriefje(bord, { id: `demo${String(i + 1).padStart(2, '0')}`, door, tekst, cat, now: nu - (i + 1) * 3600e3 })
    if (i === 2) zetVeld(b, 'tekst', tekst, nu)
  })
  s.apparaat.seenVersion = 1
  return s
}

await mkdir(UIT, { recursive: true })
const server = await start(POORT)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' })
const fouten = []
const staat = JSON.stringify(demoStaat())

for (const stijl of STIJLEN) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'nl-NL', timezoneId: 'Europe/Amsterdam', serviceWorkers: 'block' })
  await ctx.addInitScript((s) => {
    if (!sessionStorage.getItem('demo')) {
      localStorage.setItem('prikbord.v1', s)
      sessionStorage.setItem('demo', '1')
    }
  }, staat)
  const p = await ctx.newPage()
  p.on('pageerror', (e) => fouten.push(`${stijl}: ${e.message}`))
  p.on('console', (m) => m.type() === 'error' && fouten.push(`${stijl}: ${m.text()}`))
  await p.goto(`http://localhost:${POORT}/?stijl=${stijl}`)
  await p.waitForSelector('.bord-binnen.klaar')
  await p.evaluate(() => document.fonts.ready)
  await p.waitForTimeout(700)
  await p.screenshot({ path: `${UIT}/stijl-${stijl}-bord.jpg`, type: 'jpeg', quality: 85 })

  // Een briefje openen.
  await p.click('[data-id="demo03"] .briefje')
  await p.waitForSelector('.laag[open] .groot')
  await p.waitForTimeout(300)
  await p.screenshot({ path: `${UIT}/stijl-${stijl}-open.jpg`, type: 'jpeg', quality: 85 })
  await p.click('[data-laag="sluit"]')

  // Het schrijfvel (zonder toetsenbord; dat tekent Chromium niet).
  await p.click('#blok')
  await p.waitForSelector('#vel-tekst')
  await p.click('.tabje[data-cat="weekend"]')
  await p.fill('#vel-tekst', 'Huisje op de Veluwe met de hele club 🌲🏡')
  await p.locator('#vel-tekst').blur()
  await p.waitForTimeout(300)
  await p.screenshot({ path: `${UIT}/stijl-${stijl}-vel.jpg`, type: 'jpeg', quality: 85 })
  await ctx.close()
}

await browser.close()
server.close()
if (fouten.length) {
  console.error('Fouten in de browser:\n' + fouten.join('\n'))
  process.exit(1)
}
console.log(`Klaar: screenshots in ${UIT}`)
