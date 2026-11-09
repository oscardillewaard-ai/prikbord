// Rooktest in de browser (Playwright), zoals scripts/audit.mjs in Tezt.
// Draait tegen een lokale server; controleert de regels uit §4.1 die je
// alleen in een echte browser kunt zien.
// Gebruik: node scripts/rooktest.mjs
import { chromium } from 'playwright'
import { readFile, writeFile, mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { start } from './serve.mjs'
import { startWorker, nepNominatim } from './nep-worker.mjs'
import { beginStaat, nieuwBriefje, zetVeld } from '../public/js/model.js'
import { demoStaatM2, DEMO_NU } from './demo.mjs'
import { axeScan } from './axe.mjs'
import sharp from 'sharp'

// De versie uit app.js, zodat het release-ritueel (APP_VERSION en CACHE
// ophogen) de rooktest niet hoeft aan te passen.
const APP_VERSION = (await readFile(new URL('../public/js/app.js', import.meta.url), 'utf8')).match(/APP_VERSION = '(\d+)'/)[1]

const POORT = 4320
const URL_APP = `http://localhost:${POORT}/`
const server = await start(POORT)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' })
const uitslag = []
const ok = (naam, gelukt, extra = '') => uitslag.push(`${gelukt ? 'PASS' : 'FAIL'}  ${naam}${extra ? `  — ${extra}` : ''}`)
const tmp = await mkdtemp(join(tmpdir(), 'prikbord-'))

// Kaarttegels (M4) niet echt bij OpenStreetMap ophalen: een effen tegel.
const TEGEL = await sharp({ create: { width: 256, height: 256, channels: 3, background: '#e9e3d3' } }).png().toBuffer()
let tegelVragen = 0

async function nieuwePagina(opties = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'nl-NL', acceptDownloads: true, ...opties })
  // Tel hoe vaak er een AudioContext gemaakt wordt (geluid aan of uit).
  await ctx.addInitScript(() => {
    window.__geluid = 0
    const Echt = window.AudioContext
    if (Echt)
      window.AudioContext = class extends Echt {
        constructor(...a) {
          super(...a)
          window.__geluid++
        }
      }
  })
  await ctx.route('https://tile.openstreetmap.org/**', (r) => {
    tegelVragen++
    return r.fulfill({ status: 200, contentType: 'image/png', body: TEGEL })
  })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => uitslag.push(`FAIL  fout in de pagina — ${String(e).slice(0, 140)}`))
  p.on('dialog', (d) => d.accept())
  return { ctx, p }
}
const opslag = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('prikbord.v1')))

// Eerste start: "Wie ben jij?" (M3).
async function welkom(p, naam) {
  await p.waitForSelector('.laag[open] #welkom-form')
  await p.fill('#welkom-form [name="naam"]', naam)
  await p.click('#welkom-form [type="submit"]')
  await p.waitForSelector('.laag:not([open])', { state: 'attached' })
}
const briefjesOpBord = (p) => p.locator('.bord-binnen .briefje-plek').count()

async function prikBriefje(p, tekst, cat) {
  await p.click('#blok')
  await p.waitForSelector('#vel-tekst')
  if (cat) await p.click(`.tabje[data-cat="${cat}"]`)
  await p.fill('#vel-tekst', tekst)
  await p.click('.prik')
  await p.waitForSelector('.laag:not([open])', { state: 'attached' })
  await p.waitForTimeout(500) // de punaise prikt nog even na
}

// 1. Eerste start
let { ctx, p } = await nieuwePagina()
await p.goto(URL_APP)
await p.waitForSelector('.bord-leeg')
ok('eerste start: leeg bord met uitleg', (await p.locator('.bord-leeg').count()) === 1)
ok('kop toont het bord "Thuis"', (await p.locator('#kop-titel').innerText()).includes('Thuis'))
let s = await opslag(p)
ok('opslag onder prikbord.v1 met één bord en 8 categorieën', s && Object.keys(s.borden).length === 1 && Object.keys(Object.values(s.borden)[0].cats).length === 8)
ok('eerste start: "Wie ben jij?" staat open', await p.locator('.laag[open] #welkom-form').isVisible())
await welkom(p, 'Oscar')
s = await opslag(p)
ok('je naam staat op de telefoon én als lid op het bord', s.apparaat.naam === 'Oscar' && Object.values(Object.values(s.borden)[0].leden)[0].naam.w === 'Oscar')

// 2. Briefje prikken, blijft na herladen
await prikBriefje(p, 'Sushi in Den Haag 🍣', 'uiteten')
await prikBriefje(p, 'Shakshuka met véél koriander', 'recepten')
ok('twee briefjes op het bord', (await briefjesOpBord(p)) === 2)
await p.reload()
await p.waitForSelector('.bord-binnen.klaar')
ok('briefjes blijven na herladen', (await briefjesOpBord(p)) === 2)
const eerste = p.locator('.bord-binnen .briefje-plek').first()
ok('nieuwste briefje staat bovenaan', (await eerste.innerText()).includes('Shakshuka'))
ok('papierkleur volgt de categorie (Recepten = salie)', (await eerste.locator('.briefje').getAttribute('class')).includes('papier-salie'))
s = await opslag(p)
const bord = Object.values(s.borden)[0]
const br = Object.values(bord.briefjes)[0]
ok('briefje heeft per veld een tijdstempel', typeof br.v.tekst.t === 'number' && typeof br.v.cat.t === 'number' && br.door && br.gemaakt)

// 3. Tekst bewerken via het geopende briefje
await eerste.locator('.briefje').click()
await p.waitForSelector('.laag[open] .groot')
ok('geopend briefje toont wie het prikte', (await p.locator('.groot-meta').innerText()).includes('Geprikt door Oscar'))
await p.click('[data-laag="bewerk"]')
await p.fill('#vel-tekst', 'Shakshuka met feta en véél koriander')
await p.click('.prik')
await p.waitForSelector('.laag:not([open])', { state: 'attached' })
ok('bewerken past de tekst aan', (await p.locator('.bord-binnen').innerText()).includes('met feta en véél'))

// 3b. Het scheur-en-prik-moment
ok('blokje heeft de kleur van de laatst gebruikte categorie (Recepten = salie)', (await p.locator('#blok .blok-vel').getAttribute('class')).includes('papier-salie'))
const geluidVoor = await p.evaluate(() => window.__geluid)
await p.click('#blok')
ok('scheuren: er dwarrelen snippers, in beeld', (await p.locator('.laag .snipper').count()) > 0 && (await p.evaluate(() => {
  const r = document.querySelector('.laag .snipper')?.getBoundingClientRect()
  return !!r && getComputedStyle(document.querySelector('.laag .snipper')).position === 'fixed' && r.top > 0 && r.top < innerHeight
})))
ok('scheuren: geluid gaat aan na de tik (AudioContext)', (await p.evaluate(() => window.__geluid)) >= Math.max(1, geluidVoor))
ok('scheuren: het vel krijgt de kleur van het blokje', (await p.locator('#vel-papier').getAttribute('class')).includes('papier-salie'))
ok('scheuren: het tekstvak heeft meteen focus', await p.evaluate(() => document.activeElement?.id === 'vel-tekst'))
await p.fill('#vel-tekst', 'Pompoensoep met gember')
await p.click('.prik')
await p.waitForSelector('.laag .vlieger', { state: 'attached', timeout: 2000 })
const vliegt = await p.evaluate(() => {
  const v = document.querySelector('.laag .vlieger')
  const r = v.getBoundingClientRect()
  return getComputedStyle(v).position === 'fixed' && r.bottom > 0 && r.top < innerHeight && r.width > 20
})
ok('prikken: het briefje vliegt zichtbaar naar het bord', vliegt)
await p.waitForSelector('.laag:not([open])', { state: 'attached' })
const geland = p.locator('.bord-binnen .briefje-plek', { hasText: 'Pompoensoep' })
ok('prikken: na het landen hangt het briefje zichtbaar op het bord', (await geland.count()) === 1 && !(await geland.getAttribute('class')).includes('verstopt'))
ok('prikken: geen losse vlieger of snippers achtergebleven', (await p.locator('.vlieger, .snipper').count()) === 0)
// Openen en met Esc terughangen
await geland.locator('.briefje').click()
await p.waitForSelector('.laag[open] .groot')
ok('openen: het briefje is van het bord gehaald (verstopt)', (await geland.getAttribute('class')).includes('verstopt'))
await p.waitForTimeout(500)
await p.keyboard.press('Escape')
await p.waitForSelector('.laag:not([open])', { state: 'attached' })
ok('Esc: het briefje hangt weer op het bord', !(await geland.getAttribute('class')).includes('verstopt'))

// 4. Concept: half geschreven briefje komt terug na herladen (regel 12)
await p.click('#blok')
await p.fill('#vel-tekst', 'Half geschreven idee')
await p.waitForTimeout(600) // concept wordt na 400 ms bewaard
await p.reload()
await p.waitForSelector('.laag[open] #vel-tekst')
ok('concept gaat na herladen meteen weer open', (await p.inputValue('#vel-tekst')) === 'Half geschreven idee')
await p.click('[data-laag="weggooien"]')
await p.waitForTimeout(100)
ok('weggooien wist het concept', (await opslag(p)).apparaat.concept === null)

// 5. Weghalen met ongedaan maken, en de grafsteen na 5 tellen
await p.locator('.bord-binnen .briefje-plek').first().locator('.briefje').click()
await p.click('[data-laag="weg"]')
await p.waitForTimeout(150)
ok('weghalen: briefje meteen van het bord', (await briefjesOpBord(p)) === 2)
await p.click('.toast-actie')
await p.waitForTimeout(150)
ok('ongedaan maken: briefje is terug', (await briefjesOpBord(p)) === 3)
await p.locator('.bord-binnen .briefje-plek').first().locator('.briefje').click()
await p.click('[data-laag="weg"]')
// De 5 tellen lopen vanaf het moment dat "Ongedaan maken" verschijnt (na de val).
await p.waitForTimeout(6000)
s = await opslag(p)
const graf = Object.values(Object.values(s.borden)[0].briefjes).filter((b) => b.weg)
ok('na 5 tellen staat er een grafsteen (zonder tekst)', graf.length === 1 && !graf[0].v)

// 6. Meer: geluid, opslagstatus, versie
await p.click('[data-tab="meer"]')
await p.waitForSelector('.meer')
ok('Meer toont de versie', new RegExp(`versie ${APP_VERSION}\\b`).test(await p.locator('.versie').innerText()))
await p.click('.schakelaar')
ok('geluid uitzetten wordt bewaard', (await opslag(p)).apparaat.geluid === false)
ok('scheurblokje alleen op het bord', await p.locator('#blok').isHidden())

// 7. Back-up exporteren (download; het deelmenu bestaat niet in deze browser)
const [download] = await Promise.all([p.waitForEvent('download'), p.click('[data-action="export"]')])
const pad = join(tmp, download.suggestedFilename())
await download.saveAs(pad)
const backup = JSON.parse(await readFile(pad, 'utf8'))
ok('back-up heeft de naam prikbord-backup-<datum>.json', /^prikbord-backup-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()))
ok('back-up bevat geen sync-geheimen', !JSON.stringify(backup).includes('prikbord.sync'))

// 8. Importeren voegt samen
const bordId = Object.keys(backup.borden)[0]
const ik = backup.apparaat.ik[bordId]
backup.borden[bordId].briefjes.uitdebackup1 = { id: 'uitdebackup1', door: ik, gemaakt: Date.now(), v: { cat: { w: 'todo', t: Date.now() }, tekst: { w: 'Uit de back-up', t: Date.now() } }, hart: {} }
await writeFile(pad, JSON.stringify(backup))
await p.setInputFiles('#import-bestand', pad)
await p.waitForTimeout(300)
await p.click('[data-tab="bord"]')
ok('importeren voegt samen: 1 nieuw briefje erbij, niets kwijt', (await briefjesOpBord(p)) === 3 && (await p.locator('.bord-binnen').innerText()).includes('Uit de back-up'))
await ctx.close()

// 9. Kapotte opslag: geen crash, opnieuw beginnen, oude tekst bewaard
;({ ctx, p } = await nieuwePagina())
await ctx.addInitScript(() => {
  if (!sessionStorage.getItem('x')) {
    localStorage.setItem('prikbord.v1', '{kapot')
    sessionStorage.setItem('x', '1')
  }
})
await p.goto(URL_APP)
await p.waitForSelector('.bord-leeg')
ok('kapotte opslag: app start met een vers bord', (await p.locator('.bord-leeg').count()) === 1)
ok('kapotte opslag: oude tekst bewaard onder prikbord.v1.kapot', (await p.evaluate(() => localStorage.getItem('prikbord.v1.kapot'))) === '{kapot')
await ctx.close()

// 9b. Minder beweging en geluid uit: geen snippers, geen vlieger, geen AudioContext
;({ ctx, p } = await nieuwePagina({ reducedMotion: 'reduce' }))
await p.goto(URL_APP)
await p.waitForSelector('.bord-leeg')
await welkom(p, 'Rustig')
await p.click('[data-tab="meer"]')
await p.click('.schakelaar')
await p.click('[data-tab="bord"]')
await p.click('#blok')
await p.waitForSelector('#vel-tekst')
ok('minder beweging: geen snippers', (await p.locator('.snipper').count()) === 0)
await p.fill('#vel-tekst', 'Rustig aan')
await p.click('.prik')
await p.waitForTimeout(80)
ok('minder beweging: geen vliegend briefje', (await p.locator('.vlieger').count()) === 0)
await p.waitForSelector('.laag:not([open])', { state: 'attached' })
ok('minder beweging: het briefje hangt gewoon op het bord', (await briefjesOpBord(p)) === 1)
ok('geluid uit: er wordt geen geluid aangemaakt', (await p.evaluate(() => window.__geluid)) === 0)
await ctx.close()

// ---------- M2: het bord ----------

// Een bord met zes briefjes van één lid (zoals in M2: één lokaal lid).
function m2Staat() {
  const nu = Date.now() - 3600e3
  const s = beginStaat(nu - 864e5)
  const bd = s.borden[s.bord]
  const ik = s.apparaat.ik[s.bord]
  const lijst = [
    ['m2sushi1', 'uiteten', 'Sushi in Den Haag'],
    ['m2soep01', 'recepten', 'Pompoensoep met gember'],
    ['m2taart1', 'recepten', 'Appeltaart van oma'],
    ['m2fiets1', 'todo', 'Fietsband plakken'],
    ['m2kas001', 'restaurants', 'De Kas in Amsterdam'],
    ['m2noord1', 'bucketlist', 'Noorderlicht zien'],
  ]
  lijst.forEach(([id, cat, tekst], i) => nieuwBriefje(bd, { id, door: ik, tekst, cat, now: nu + i * 1000 }))
  s.apparaat.seenVersion = 999
  return { s, bordId: s.bord, ik }
}
const m2 = m2Staat()
async function m2Pagina(opties = {}) {
  const r = await nieuwePagina(opties)
  await r.ctx.addInitScript((json) => {
    if (!sessionStorage.getItem('m2')) {
      localStorage.setItem('prikbord.v1', json)
      sessionStorage.setItem('m2', '1')
    }
  }, JSON.stringify(m2.s))
  await r.p.goto(URL_APP)
  await r.p.waitForSelector('.bord-binnen.klaar')
  await r.p.evaluate(() => document.fonts.ready)
  return r
}
const bordVan = async (p) => (await opslag(p)).borden[m2.bordId]
const zichtbaar = (p) => p.locator('.bord-binnen .briefje-plek:not(.uit)')
const transformVan = (p, id) => p.evaluate((i) => document.querySelector(`.briefje-plek[data-id="${i}"]`)?.style.transform, id)
const dicht = (p) => p.waitForSelector('.laag:not([open])', { state: 'attached' })
const rustig = (p) => p.waitForSelector('.laag[open]:not(.bezig)')

// 11. Filters en sorteren (netjes)
;({ ctx, p } = await m2Pagina())
ok('M2 filterbalk: "Alles" staat aan', (await p.getAttribute('[data-filter="alles"]', 'aria-pressed')) === 'true')
const soepVoor = await transformVan(p, 'm2soep01')
await p.click('[data-filter="cat"][data-cat="recepten"]')
await p.waitForTimeout(650)
ok('filter Recepten: alleen de 2 recepten zichtbaar', (await zichtbaar(p).count()) === 2 && (await zichtbaar(p).allInnerTexts()).every((t) => /soep|taart/i.test(t)))
ok('filter: de briefjes schuiven naar hun nieuwe plek', (await transformVan(p, 'm2soep01')) !== soepVoor)
ok('filter: de andere briefjes zijn uit beeld (niet weggehaald)', (await p.locator('.bord-binnen .briefje-plek.uit').count()) === 4)
await p.click('[data-filter="cat"][data-cat="uiteten"]')
ok('meerdere categorieën tegelijk: Recepten + Uit eten = 3', (await zichtbaar(p).count()) === 3)
ok('"Alles" staat uit zolang er een filter aan staat', (await p.getAttribute('[data-filter="alles"]', 'aria-pressed')) === 'false')
await p.click('[data-filter="alles"]')
await p.waitForTimeout(300)
ok('"Alles" laat weer alles zien', (await zichtbaar(p).count()) === 6)
await p.click('[data-filter="samen"]')
await p.waitForTimeout(300)
ok('💞 Iedereen zin zonder hartjes: vriendelijke "niks gevonden"', await p.locator('#filter-leeg').isVisible())
await p.click('#filter-leeg [data-filter="alles"]')
ok('"Alles laten zien" zet het filter uit', (await zichtbaar(p).count()) === 6 && (await p.locator('#filter-leeg').isHidden()))

// 12. Hartjes
await p.locator('[data-id="m2fiets1"] .briefje').dblclick()
await p.waitForTimeout(450)
let bd = await bordVan(p)
ok('dubbeltik geeft een hartje (per lid, met tijdstempel)', bd.briefjes.m2fiets1.hart[m2.ik]?.w === true && typeof bd.briefjes.m2fiets1.hart[m2.ik].t === 'number')
ok('dubbeltik opent het briefje niet', (await p.locator('.laag[open]').count()) === 0)
ok('het hartje staat klein onderaan het briefje, in de kleur van wie het gaf', (await p.locator('[data-id="m2fiets1"] .hartjes .hart.pin-rood').count()) === 1)
await p.click('[data-filter="samen"]')
await p.waitForTimeout(300)
ok('💞 Iedereen zin: alleen het briefje met een hartje (één lid)', (await zichtbaar(p).count()) === 1 && (await zichtbaar(p).innerText()).includes('Fietsband'))
await p.click('[data-filter="alles"]')
await p.click('[data-action="sorteer"]')
await p.waitForTimeout(900)
const eersteNaSorteren = await p.evaluate(() => {
  const els = [...document.querySelectorAll('.bord-binnen .briefje-plek')]
  els.sort((a, b) => a.dataset.y - b.dataset.y || a.dataset.x - b.dataset.x)
  return { visueel: els[0].dataset.id, dom: document.querySelector('.bord-binnen .briefje-plek').dataset.id }
})
ok('sorteren op meeste hartjes: dat briefje hangt linksboven', eersteNaSorteren.visueel === 'm2fiets1', JSON.stringify(eersteNaSorteren))
ok('sorteren: ook de volgorde in de pagina (tabvolgorde) klopt', eersteNaSorteren.dom === 'm2fiets1')
ok('sorteren wordt per bord onthouden', (await opslag(p)).apparaat.sorteer[m2.bordId] === 'hartjes')
await p.click('[data-action="sorteer"]')
await p.locator('[data-id="m2soep01"] .briefje').click()
await rustig(p)
ok('geopend briefje: hartje-knop staat uit', (await p.getAttribute('.hart-knop', 'aria-pressed')) === 'false')
await p.click('.hart-knop')
ok('hartje-knop zet het hartje aan', (await p.getAttribute('.hart-knop', 'aria-pressed')) === 'true' && (await bordVan(p)).briefjes.m2soep01.hart[m2.ik].w === true)
await p.click('.hart-knop')
ok('en weer uit (blijft bewaard als "uit", met tijdstempel)', (await bordVan(p)).briefjes.m2soep01.hart[m2.ik].w === false)

// 13. Gedaan-doos
await p.click('[data-laag="gedaan"]')
const vandaag = await p.evaluate(() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})
ok('Gedaan!: vraagt een datum, standaard vandaag', (await p.inputValue('[name="datum"]')) === vandaag)
await p.fill('[name="notitie"]', 'Heerlijk met room 😋')
await p.click('#gedaan-form [type="submit"]')
await p.waitForSelector('.confetti', { state: 'attached', timeout: 3000 })
ok('in de doos: er komt confetti', true)
await dicht(p)
await p.waitForTimeout(200)
bd = await bordVan(p)
ok('in de doos: datum en "hoe was het" bewaard', bd.briefjes.m2soep01.v.gedaan.w.datum === vandaag && bd.briefjes.m2soep01.v.gedaan.w.notitie === 'Heerlijk met room 😋')
ok('in de doos: het briefje is van het bord', (await briefjesOpBord(p)) === 5)
await p.click('.toast-actie')
await p.waitForTimeout(700)
ok('"Ongedaan maken" hangt het meteen terug', (await briefjesOpBord(p)) === 6 && (await bordVan(p)).briefjes.m2soep01.v.gedaan.w === null)
await p.locator('[data-id="m2soep01"] .briefje').click()
await rustig(p)
await p.click('[data-laag="gedaan"]')
await p.fill('[name="datum"]', '2026-10-12')
await p.click('#gedaan-form [type="submit"]')
await dicht(p)
await p.locator('[data-id="m2kas001"] .briefje').click()
await rustig(p)
await p.click('[data-laag="gedaan"]')
await p.click('#gedaan-form [type="submit"]')
await dicht(p)
await p.click('[data-tab="gedaan"]')
await p.waitForSelector('.doos')
ok('Gedaan-doos: teller "2 dingen samen gedaan"', (await p.locator('#doos-teller').innerText()).includes('2 dingen samen gedaan'))
const maanden = await p.locator('.maand').allInnerTexts()
ok('Gedaan-doos: per maand, nieuwste eerst', maanden.length === 2 && /oktober/i.test(maanden[1]), maanden.join(' | '))
await p.click('[data-filter="cat"][data-cat="recepten"]')
ok('Gedaan-doos: filters werken hier ook', (await p.locator('.geplakt').count()) === 1 && (await p.locator('#doos-teller').innerText()).startsWith('1 van de 2'))
await p.click('[data-filter="alles"]')
await p.click('.geplakt[data-id="m2soep01"]')
await rustig(p)
await p.click('[data-laag="gedaan"]')
await p.fill('[name="notitie"]', 'Nog lekkerder met gember')
await p.click('#gedaan-form [type="submit"]')
await p.waitForTimeout(300)
ok('Gedaan-doos: "hoe was het" achteraf aanpassen', (await bordVan(p)).briefjes.m2soep01.v.gedaan.w.notitie === 'Nog lekkerder met gember')
await p.click('[data-laag="terug-op-bord"]')
await p.waitForSelector('[data-tab="bord"][aria-current="page"]')
await p.waitForTimeout(700)
ok('"Terughangen" uit de doos: terug op het bord', (await p.locator('.bord-binnen .briefje-plek[data-id="m2soep01"]:not(.verstopt)').count()) === 1 && (await bordVan(p)).briefjes.m2soep01.v.gedaan.w === null)

// 14. Trek een briefje
await p.click('[data-filter="cat"][data-cat="recepten"]')
await p.click('[data-action="trek"]')
await p.waitForSelector('.laag[open] .groot[data-soort="trek"]')
const getrokken1 = await p.locator('.groot-tekst').innerText()
ok('🎲 trekt een briefje binnen het filter', /soep|taart/i.test(getrokken1), getrokken1)
await rustig(p)
await p.click('[data-laag="nog-eens"]')
await p.waitForSelector('.laag[open] .groot[data-soort="trek"]')
await rustig(p)
const getrokken2 = await p.locator('.groot-tekst').innerText()
ok('"Nog eens" trekt een ander briefje', /soep|taart/i.test(getrokken2) && getrokken2 !== getrokken1, `${getrokken1} → ${getrokken2}`)
await p.click('[data-laag="sluit"]')
await dicht(p)
ok('"Sluiten" hangt het terug', (await p.locator('.briefje-plek.verstopt').count()) === 0)
await p.click('[data-filter="alles"]')

// 15. Categorie-editor
await p.click('[data-tab="meer"]')
await p.click('[data-action="cats"]')
await p.waitForSelector('.laag[open] .paneel')
ok('categorieën: de 8 van het bord Thuis', (await p.locator('.cat-rij').count()) === 8)
await p.click('[data-cats="nieuw"]')
await p.fill('[name="naam"]', 'Films')
await p.click('[data-emoji="🎬"]')
await p.click('.kleur.papier-lila')
await p.click('#cat-form [type="submit"]')
await p.waitForSelector('.cat-rij >> nth=8')
let cats = (await bordVan(p)).cats
const filmsId = Object.keys(cats).find((k) => cats[k].naam.w === 'Films')
ok('nieuwe categorie: naam, emoji en kleur bewaard (per veld)', filmsId && cats[filmsId].emoji.w === '🎬' && cats[filmsId].kleur.w === 'lila' && typeof cats[filmsId].naam.t === 'number')
await p.click(`[data-cats="op"][data-cat="${filmsId}"]`)
cats = (await bordVan(p)).cats
ok('volgorde: Films één omhoog', cats[filmsId].volg.w === 7 && cats.bucketlist.volg.w === 8)
await p.click('[data-cats="bewerk"][data-cat="restaurants"]')
await p.fill('[name="naam"]', 'Restaurantjes')
await p.click('#cat-form [type="submit"]')
await p.click('[data-cats="bewerk"][data-cat="restaurants"]')
await p.click('[data-cats="verberg"]')
await p.waitForSelector('.groep-kop:has-text("Verborgen")')
cats = (await bordVan(p)).cats
ok('hernoemen en verbergen: niet gewist, alleen verborgen', cats.restaurants.naam.w === 'Restaurantjes' && cats.restaurants.verborgen.w === true)
await p.click('[data-laag="sluit"]')
await dicht(p)
await p.click('[data-tab="bord"]')
ok('filterbalk: de nieuwe categorie staat erbij', (await p.locator(`[data-filter="cat"][data-cat="${filmsId}"]`).count()) === 1)
await p.click('#blok')
await p.waitForSelector('#vel-tekst')
const tabjes = await p.locator('.tabje').allInnerTexts()
ok('schrijfvel: Films wel, de verborgen categorie niet', tabjes.some((t) => t.includes('Films')) && !tabjes.some((t) => t.includes('Restaurant')))
await p.fill('#vel-tekst', 'Dune deel 2 🎬')
await p.click(`.tabje[data-cat="${filmsId}"]`)
await p.click('.prik')
await dicht(p)
await p.waitForTimeout(500)
ok('briefje in de nieuwe categorie: lila papier', (await p.locator('.bord-binnen .briefje-plek', { hasText: 'Dune' }).locator('.briefje').getAttribute('class')).includes('papier-lila'))
await p.locator('[data-id="m2kas001"]').count() // (staat in de doos)
await p.click('[data-tab="gedaan"]')
await p.click('.geplakt[data-id="m2kas001"]')
await rustig(p)
await p.click('[data-laag="terug-op-bord"]')
await p.waitForTimeout(800)
const kas = p.locator('.bord-binnen [data-id="m2kas001"] .briefje')
ok('briefje in een verborgen categorie houdt zijn kleur', (await kas.getAttribute('class')).includes('papier-perzik'))
await kas.click()
await rustig(p)
await p.click('[data-laag="bewerk"]')
ok('bewerken: de verborgen categorie blijft gekozen', (await p.getAttribute('.tabje[aria-checked="true"]', 'data-cat')) === 'restaurants')
await p.click('.prik')
await dicht(p)
ok('na bewerken: categorie ongewijzigd', (await bordVan(p)).briefjes.m2kas001.v.cat.w === 'restaurants')

// 16. Back-up met alles van M2 erin, en terugzetten op een nieuwe telefoon
await p.click('[data-tab="meer"]')
const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('[data-action="export"]')])
const pad2 = join(tmp, `m2-${dl2.suggestedFilename()}`)
await dl2.saveAs(pad2)
ok('Meer: "Laatste back-up" staat erbij', (await p.locator('#laatste-backup').innerText()).startsWith('Laatste back-up'))
const backup2 = JSON.parse(await readFile(pad2, 'utf8'))
const bb = backup2.borden[m2.bordId]
ok('back-up bevat hartjes, gedaan en categorieën', bb.briefjes.m2fiets1.hart[m2.ik].w === true && !!bb.briefjes.m2kas001.v.gedaan && bb.cats[filmsId].naam.w === 'Films')
await ctx.close()
;({ ctx, p } = await nieuwePagina())
await p.goto(URL_APP)
await p.waitForSelector('.bord-leeg')
await p.setInputFiles('#import-bestand', pad2)
await p.waitForTimeout(400)
const na = await opslag(p)
const terug = na.borden[m2.bordId]
ok('terugzetten op een nieuwe telefoon: het bord met hartjes, doos en categorieën is er', !!terug && terug.briefjes.m2fiets1.hart[m2.ik].w === true && terug.cats[filmsId].naam.w === 'Films' && terug.cats.restaurants.verborgen.w === true)
await ctx.close()

// 17. Vrij: slepen, zoomen en knijpen (muis én echte vingers via CDP)
;({ ctx, p } = await m2Pagina({ hasTouch: true }))
await p.click('[data-weergave="vrij"]')
await p.waitForSelector('#vrij-wereld .briefje-plek')
await p.waitForTimeout(400)
ok('vrij: het bord staat in een venster met zoomknoppen', (await p.locator('#vrij .zoomknoppen').isVisible()) && (await p.locator('#vrij-wereld .briefje-plek').count()) === 6)
ok('vrij: de keuze wordt per bord onthouden', (await opslag(p)).apparaat.weergave[m2.bordId] === 'vrij')
ok('vrij: geen sorteerknop (de plek ligt vast)', (await p.locator('[data-action="sorteer"]').count()) === 0)
const schaal = () => p.evaluate(() => Number(document.querySelector('#vrij-wereld').dataset.schaal))
const doos = (id) => p.locator(`#vrij-wereld [data-id="${id}"] .briefje`).boundingBox()
const s0 = await schaal()
// Lang drukken en slepen met de muis.
let b0 = await doos('m2sushi1')
await p.mouse.move(b0.x + b0.width / 2, b0.y + b0.height / 2)
await p.mouse.down()
await p.waitForTimeout(420)
ok('lang drukken tilt het briefje op', (await p.locator('#vrij-wereld [data-id="m2sushi1"].opgetild').count()) === 1)
await p.mouse.move(b0.x + b0.width / 2 + 70, b0.y + b0.height / 2 + 160, { steps: 10 })
await p.mouse.up()
await p.waitForTimeout(700)
let b1 = await doos('m2sushi1')
ok('slepen verplaatst het briefje (zoals je vinger ging)', Math.abs(b1.x - b0.x - 70) < 6 && Math.abs(b1.y - b0.y - 160) < 6, `dx ${Math.round(b1.x - b0.x)}, dy ${Math.round(b1.y - b0.y)}`)
bd = await bordVan(p)
const vrijen = Object.values(bd.briefjes).filter((b) => b.v.vrij)
ok('de vrije plek staat in bordcoördinaten, en de rest staat vast (niets verspringt)', vrijen.length === 6 && bd.briefjes.m2sushi1.v.vrij.w.x >= 0 && bd.briefjes.m2sushi1.v.vrij.w.x <= 1000)
ok('het neergezette briefje ligt bovenop de stapel', bd.briefjes.m2sushi1.v.stapel.w > Math.max(...Object.values(bd.briefjes).filter((b) => b.id !== 'm2sushi1').map((b) => b.v.stapel?.w ?? 0)))
ok('na het slepen opent er niets', (await p.locator('.laag[open]').count()) === 0)
// Kort tikken opent wel.
await p.locator('#vrij-wereld [data-id="m2taart1"] .briefje').click()
await rustig(p)
ok('vrij: kort tikken opent het briefje', (await p.locator('.groot-tekst').innerText()).includes('Appeltaart'))
await p.keyboard.press('Escape')
await dicht(p)
// Zoomknoppen
await p.click('[data-zoom="in"]')
await p.waitForTimeout(400)
const s1 = await schaal()
ok('zoomknop + zoomt in', Math.abs(s1 / s0 - 1.4) < 0.01, `${s0.toFixed(3)} → ${s1.toFixed(3)}`)
// Met één vinger over het kurk schuiven (muis op een leeg stuk).
const t0 = await p.evaluate(() => document.querySelector('#vrij-wereld').style.transform)
const vp = await p.locator('#vrij').boundingBox()
await p.mouse.move(vp.x + vp.width - 30, vp.y + vp.height - 120)
await p.mouse.down()
await p.mouse.move(vp.x + vp.width - 130, vp.y + vp.height - 220, { steps: 6 })
await p.mouse.up()
ok('schuiven over het kurk verschuift het bord', (await p.evaluate(() => document.querySelector('#vrij-wereld').style.transform)) !== t0)
await p.click('[data-zoom="passend"]')
await p.waitForTimeout(400)
ok('⤢ laat het hele bord zien', Math.abs((await schaal()) - s0) < 0.001)
// Knijpen met twee echte vingers (CDP-aanraakpunten).
const cdp = await ctx.newCDPSession(p)
const midY = Math.round(vp.y + vp.height * 0.75)
const vinger = (x1, x2) => [
  { x: x1, y: midY, id: 1 },
  { x: x2, y: midY, id: 2 },
]
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: vinger(150, 230) })
for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: vinger(150 - i * 10, 230 + i * 10) })
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
await p.waitForTimeout(200)
const s2 = await schaal()
// De vingers gaan van 80 naar 240 px uit elkaar: drie keer zo groot.
ok('knijpen met twee vingers zoomt in', Math.abs(s2 / s0 - 3) < 0.15, `${s0.toFixed(3)} → ${s2.toFixed(3)} (verwacht ×3)`)
await p.click('[data-zoom="passend"]')
await p.waitForTimeout(400)
// Lang drukken en slepen met een vinger.
b0 = await doos('m2noord1')
const cx = Math.round(b0.x + b0.width / 2)
const cy = Math.round(b0.y + b0.height / 2)
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 3 }] })
await p.waitForTimeout(420)
for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx - i * 8, y: cy + i * 12, id: 3 }] })
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
await p.waitForTimeout(700)
b1 = await doos('m2noord1')
ok('lang drukken en slepen met een vinger', Math.abs(b1.x - b0.x + 64) < 6 && Math.abs(b1.y - b0.y - 96) < 6, `dx ${Math.round(b1.x - b0.x)}, dy ${Math.round(b1.y - b0.y)}`)
ok('na slepen met een vinger opent er niets', (await p.locator('.laag[open]').count()) === 0)
// Filters dimmen in plaats van te verschuiven.
const voorFilter = await p.evaluate(() => document.querySelector('#vrij-wereld [data-id="m2fiets1"]').style.transform)
await p.click('[data-filter="cat"][data-cat="recepten"]')
await p.waitForTimeout(300)
ok('vrij: filters dimmen de andere briefjes', (await p.locator('#vrij-wereld .briefje-plek.gedimd').count()) === 4)
ok('vrij: en verschuiven ze niet', (await p.evaluate(() => document.querySelector('#vrij-wereld [data-id="m2fiets1"]').style.transform)) === voorFilter)
await p.click('[data-filter="alles"]')
// Nieuw briefje in vrij: de eerste lege plek bovenaan.
await p.click('#blok')
await p.waitForSelector('#vel-tekst')
await p.fill('#vel-tekst', 'Nieuw in vrij')
await p.click('.prik')
await dicht(p)
await p.waitForTimeout(600)
const nieuwVrij = await p.evaluate(() => {
  const el = [...document.querySelectorAll('#vrij-wereld .briefje-plek')].find((e) => e.innerText.includes('Nieuw in vrij'))
  return el && { uy: Number(el.dataset.uy), zichtbaar: !el.classList.contains('verstopt') }
})
ok('nieuw briefje in vrij: krijgt een plek bovenaan en landt zichtbaar', nieuwVrij && nieuwVrij.zichtbaar && nieuwVrij.uy < 600, JSON.stringify(nieuwVrij))
// Na herladen: zelfde weergave, zelfde plek.
const plekVoor = await p.evaluate(() => document.querySelector('#vrij-wereld [data-id="m2sushi1"]').dataset.ux + ',' + document.querySelector('#vrij-wereld [data-id="m2sushi1"]').dataset.uy)
await p.reload()
await p.waitForSelector('#vrij-wereld .briefje-plek')
const plekNa = await p.evaluate(() => document.querySelector('#vrij-wereld [data-id="m2sushi1"]').dataset.ux + ',' + document.querySelector('#vrij-wereld [data-id="m2sushi1"]').dataset.uy)
ok('na herladen: nog steeds vrij, briefje op dezelfde plek', plekVoor === plekNa, `${plekVoor} / ${plekNa}`)
await p.click('[data-weergave="netjes"]')
await p.waitForSelector('.bord-binnen.klaar')
ok('terug naar netjes', (await briefjesOpBord(p)) === 7)
await ctx.close()

// 18. Minder beweging: Gedaan zonder vallen en confetti
;({ ctx, p } = await m2Pagina({ reducedMotion: 'reduce' }))
await p.locator('[data-id="m2taart1"] .briefje').click()
await p.waitForSelector('.laag[open] .groot')
await p.click('[data-laag="gedaan"]')
await p.click('#gedaan-form [type="submit"]')
await dicht(p)
ok('minder beweging: Gedaan werkt, zonder confetti', (await p.locator('.confetti').count()) === 0 && (await briefjesOpBord(p)) === 5)
await ctx.close()

// ---------- M3: samen ----------
// Twee (en drie) browsers op hetzelfde bord, via de echte worker op deze
// computer (scripts/nep-worker.mjs) met een nep-KV in het geheugen (§9).
const WPOORT = 4321
const WURL = `http://localhost:${WPOORT}`
const { server: nepWorker, kv: nepKvM3 } = await startWorker(WPOORT)
const syncVan = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('prikbord.sync')))
const bolletje = (p) => p.getAttribute('#sync-dot', 'data-status')
const wachtOpBolletje = (p, status, timeout = 8000) => p.waitForFunction((s) => document.querySelector('#sync-dot')?.dataset.status === s, status, { timeout })
// Meteen synchroniseren, zoals de app doet als je weer online komt.
const nuSync = (p) => p.evaluate(() => dispatchEvent(new Event('online')))
const briefjeOp = (p, tekst) => p.locator('.bord-binnen .briefje-plek', { hasText: tekst })

// 20. Oscar deelt zijn bord
const A = await nieuwePagina()
await A.p.goto(URL_APP)
await welkom(A.p, 'Oscar')
await prikBriefje(A.p, 'Sushi in Den Haag 🍣', 'uiteten')
ok('M3: een bord dat niet gedeeld is, heeft geen statusbolletje', await A.p.locator('#sync-dot').isHidden())
await A.p.click('[data-tab="meer"]')
await A.p.click('[data-action="delen"]')
await A.p.waitForSelector('#delen-form')
ok('delen: "Iedereen met deze link kan meekijken en prikken"', (await A.p.locator('.laag').innerText()).includes('Iedereen met deze link kan meekijken en prikken'))
await A.p.fill('#delen-form [name="url"]', 'http://kwaad.example')
await A.p.click('#delen-form [type="submit"]')
ok('delen: een adres zonder https (behalve localhost) wordt geweigerd', (await A.p.locator('#delen-fout').innerText()).includes('https'))
await A.p.fill('#delen-form [name="url"]', WURL)
await A.p.click('#delen-form [type="submit"]')
await A.p.waitForSelector('#koppel-link')
const koppelLinkM3 = await A.p.inputValue('#koppel-link')
const bordM3 = (await opslag(A.p)).bord
const codeM3 = (await syncVan(A.p)).borden[bordM3]?.r
ok('delen: een koppel-link met #koppel=', /^http:\/\/localhost:4320\/#koppel=[\w-]+$/.test(koppelLinkM3), koppelLinkM3)
ok('delen: lange, willekeurige groepscode in prikbord.sync', /^[\w-]{24}$/.test(codeM3 || ''))
ok('delen: de groepscode staat niet in prikbord.v1 (dus niet in de back-up)', !JSON.stringify(await opslag(A.p)).includes(codeM3))
await wachtOpBolletje(A.p, 'ok')
ok('statusbolletje: groen na de eerste sync', (await bolletje(A.p)) === 'ok')
ok('delen: "✅ Gesynchroniseerd om …"', (await A.p.locator('.laag [data-sync-status]').innerText()).startsWith('✅ Gesynchroniseerd om'))
ok('worker: het bord staat in de KV onder de groepscode', nepKvM3.data.has(`bord:${codeM3}`))
await A.p.keyboard.press('Escape')
await dicht(A.p)
await A.p.click('[data-tab="bord"]')

// 21. Tara opent de koppel-link (haar eerste keer in de app)
const B = await nieuwePagina()
await B.p.goto(koppelLinkM3)
await B.p.waitForSelector('.laag[open] #koppel-ja')
ok("koppel-link: \"Bord 'Thuis' toevoegen?\"", (await B.p.locator('#laag-titel').innerText()).includes("Bord 'Thuis' toevoegen?"))
ok('koppel-link: weg uit de adresbalk', (await B.p.evaluate(() => location.hash)) === '')
await B.p.click('[data-koppel="ja"]')
await B.p.waitForSelector('#wie-form')
ok('wie ben jij: Oscar staat erbij, met "Dit ben ik al"', (await B.p.locator('.wie-rij').innerText()).includes('Oscar'))
await B.p.fill('#wie-form [name="naam"]', 'Tara')
await B.p.click('#wie-form [type="submit"]')
await dicht(B.p)
await B.p.waitForSelector('.bord-binnen .briefje-plek')
ok('Tara ziet het briefje van Oscar', (await B.p.locator('.bord-binnen').innerText()).includes('Sushi in Den Haag'))
let sB = await opslag(B.p)
const ledenB = Object.values(sB.borden[bordM3].leden)
ok('Tara heeft één bord: haar lege beginbord is opgeruimd', Object.keys(sB.borden).length === 1 && sB.bord === bordM3)
ok('Tara is lid, met een andere kleur dan Oscar', ledenB.length === 2 && new Set(ledenB.map((l) => l.kleur.w)).size === 2 && sB.apparaat.naam === 'Tara')
await wachtOpBolletje(B.p, 'ok')

// 22. Een briefje van Tara verschijnt bij Oscar (gewoon peilen, elke 10 s)
await prikBriefje(B.p, 'Appeltaart van oma', 'recepten')
const t22 = Date.now()
await A.p.waitForSelector('.bord-binnen .briefje-plek:has-text("Appeltaart")', { timeout: 15000 })
ok('Oscar ziet het briefje van Tara binnen 15 s, zonder iets te doen', true, `${Date.now() - t22} ms`)
await A.p.waitForTimeout(300)
ok("melding: \"📌 Tara prikte 'Appeltaart van oma'\"", (await A.p.locator('#toast').innerText()).includes("Tara prikte 'Appeltaart van oma'"))
const kleurTara = ledenB.find((l) => l.naam.w === 'Tara').kleur.w
ok('nieuw-stickertje op het briefje van Tara, niet op je eigen', (await briefjeOp(A.p, 'Appeltaart').locator('.nieuw-sticker').count()) === 1 && (await briefjeOp(A.p, 'Sushi').locator('.nieuw-sticker').count()) === 0)
ok("de punaise heeft Tara's kleur", (await briefjeOp(A.p, 'Appeltaart').locator('.punaise').getAttribute('class')).includes(`pin-${kleurTara}`))
await briefjeOp(A.p, 'Appeltaart').locator('.briefje').click()
await rustig(A.p)
ok('geopend: "Geprikt door Tara"', (await A.p.locator('.groot-meta').innerText()).includes('Geprikt door Tara'))
await A.p.keyboard.press('Escape')
await dicht(A.p)
ok('na het openen is het stickertje weg', (await briefjeOp(A.p, 'Appeltaart').locator('.nieuw-sticker').count()) === 0)

// 23. Hartjes van allebei, en tegelijk tekst en hartje op hetzelfde briefje
await briefjeOp(A.p, 'Appeltaart').locator('.briefje').dblclick()
await briefjeOp(B.p, 'Appeltaart').locator('.briefje').dblclick()
await briefjeOp(A.p, 'Sushi').locator('.briefje').click()
await rustig(A.p)
await A.p.click('[data-laag="bewerk"]')
await A.p.fill('#vel-tekst', 'Sushi in Den Haag, bij Okura')
await A.p.click('.prik')
await dicht(A.p)
await briefjeOp(B.p, 'Sushi').locator('.briefje').dblclick()
await A.p.waitForTimeout(2500) // 1,5 s bundelen, dan versturen
await nuSync(A.p)
await nuSync(B.p)
await A.p.waitForTimeout(1500)
await nuSync(A.p)
await A.p.waitForTimeout(1000)
const bA = (await opslag(A.p)).borden[bordM3]
sB = await opslag(B.p)
const bB = sB.borden[bordM3]
const appelId = Object.values(bA.briefjes).find((b) => b.v?.tekst?.w === 'Appeltaart van oma').id
const sushiId = Object.values(bA.briefjes).find((b) => b.v?.tekst?.w.startsWith('Sushi')).id
ok('hartjes: Appeltaart heeft bij allebei 2 hartjes', [bA, bB].every((b) => Object.values(b.briefjes[appelId].hart).filter((h) => h.w).length === 2))
ok('per veld: Oscars nieuwe tekst én Tara\'s hartje staan allebei op Sushi, bij allebei', [bA, bB].every((b) => b.briefjes[sushiId].v.tekst.w === 'Sushi in Den Haag, bij Okura' && Object.values(b.briefjes[sushiId].hart).filter((h) => h.w).length === 1))
ok('Oscar en Tara hebben exact dezelfde stand', JSON.stringify(bA) === JSON.stringify(bB))
await A.p.click('[data-filter="samen"]')
await A.p.waitForTimeout(400)
ok('💞 Iedereen zin: alleen het briefje met hartjes van Oscar én Tara', (await A.p.locator('.bord-binnen .briefje-plek:not(.uit)').count()) === 1 && (await A.p.locator('.bord-binnen .briefje-plek:not(.uit)').innerText()).includes('Appeltaart'))
await A.p.click('[data-filter="alles"]')

// 24. Offline geprikt gaat mee zodra je weer online bent
await B.ctx.setOffline(true)
await prikBriefje(B.p, 'In de trein bedacht 🚆', 'todo')
await wachtOpBolletje(B.p, 'offline')
ok('offline: het bolletje wordt grijs', (await bolletje(B.p)) === 'offline')
await B.p.click('#kop-titel')
await B.p.waitForSelector('.laag[data-soort="borden"]')
ok('offline: "wijzigingen gaan mee zodra het weer lukt"', (await B.p.locator('.laag [data-sync-status]').innerText()).includes('gaan mee zodra het weer lukt'))
await B.p.keyboard.press('Escape')
await dicht(B.p)
await nuSync(A.p)
await A.p.waitForTimeout(1200)
ok('offline: Oscar heeft het nog niet', (await briefjeOp(A.p, 'In de trein').count()) === 0)
await B.ctx.setOffline(false)
await nuSync(B.p)
await A.p.waitForSelector('.bord-binnen .briefje-plek:has-text("In de trein")', { timeout: 15000 })
ok('weer online: het offline geprikte briefje komt bij Oscar aan', true)
await wachtOpBolletje(B.p, 'ok')
ok('weer online: het bolletje is weer groen', (await bolletje(B.p)) === 'ok')

// 25. Een tablet: koppel-link plakken en "Dit ben ik al"
const C = await nieuwePagina()
await C.p.goto(URL_APP)
await welkom(C.p, 'Oscar')
await C.p.click('#kop-titel')
await C.p.waitForSelector('.laag[data-soort="borden"]')
await C.p.click('[data-borden="koppel"]')
await C.p.fill('#koppel-form [name="link"]', 'Doe je mee? https://example.com/geen-koppel')
await C.p.click('#koppel-form [type="submit"]')
ok('plakken: geen koppel-link → een vriendelijke fout', (await C.p.locator('#koppel-fout').innerText()).includes('geen koppel-link'))
await C.p.fill('#koppel-form [name="link"]', `Doe je mee op ons prikbord? ${koppelLinkM3} 😄`)
await C.p.click('#koppel-form [type="submit"]')
await C.p.waitForSelector('#koppel-ja')
await C.p.click('[data-koppel="ja"]')
await C.p.waitForSelector('#wie-form')
await C.p.locator('.wie-rij', { hasText: 'Oscar' }).click()
await dicht(C.p)
await C.p.waitForSelector('.bord-binnen .briefje-plek:has-text("Appeltaart")')
const sC = await opslag(C.p)
ok('Dit ben ik al: de tablet is hetzelfde lid als Oscars telefoon', sC.apparaat.ik[bordM3] === (await opslag(A.p)).apparaat.ik[bordM3])
ok('Dit ben ik al: er komt geen derde lid bij', Object.keys(sC.borden[bordM3].leden).length === 2)
await briefjeOp(C.p, 'Appeltaart').locator('.briefje').dblclick()
await C.p.waitForTimeout(400)
ok('hartjes tellen niet dubbel (nog steeds 2)', (await briefjeOp(C.p, 'Appeltaart').locator('.hartjes .hart').count()) === 2)
await C.ctx.close()

// 26. Meer borden: een nieuw bord en terug wisselen
await A.p.click('#kop-titel')
await A.p.waitForSelector('.laag[data-soort="borden"]')
ok('alle borden: "Thuis", samen met Tara', (await A.p.locator('.bord-rij').innerText()).includes('Samen met Tara'))
await A.p.click('[data-borden="nieuw"]')
await A.p.fill('#bord-nieuw-form [name="naam"]', 'Groepsreis Porto')
await A.p.click('#bord-nieuw-form [data-emoji="✈️"]')
await A.p.click('#bord-nieuw-form [type="submit"]')
await A.p.waitForSelector('.bord-leeg')
ok('nieuw bord: leeg, met de naam en emoji bovenin', (await A.p.locator('#kop-titel').innerText()).includes('Groepsreis Porto') && (await A.p.locator('#kop-titel').innerText()).includes('✈️'))
ok('nieuw bord: niet gedeeld, dus geen bolletje', await A.p.locator('#sync-dot').isHidden())
let sA = await opslag(A.p)
ok('nieuw bord: jij staat erop als Oscar', Object.values(sA.borden[sA.bord].leden).map((l) => l.naam.w).join() === 'Oscar')
await A.p.click('#kop-titel')
await A.p.locator('.bord-rij', { hasText: 'Thuis' }).click()
await A.p.waitForSelector('.bord-binnen .briefje-plek')
ok('terug naar Thuis: alle briefjes zijn er nog', (await briefjesOpBord(A.p)) === 3)

// 27. Tara verlaat het bord; Oscar houdt alles
await B.p.click('[data-tab="meer"]')
await B.p.click('[data-action="bord-instel"]')
await B.p.click('[data-borden="verlaat"]')
await B.p.waitForSelector('.bord-leeg')
sB = await opslag(B.p)
ok('verlaten: Tara heeft weer een eigen, leeg bord', !sB.borden[bordM3] && Object.keys(sB.borden).length === 1)
ok('verlaten: de koppeling is weg van haar telefoon', !(await syncVan(B.p)).borden[bordM3])
await nuSync(A.p)
await A.p.waitForTimeout(1000)
sA = await opslag(A.p)
ok('verlaten: Oscar houdt alle briefjes, en Tara blijft als lid bestaan', (await briefjesOpBord(A.p)) === 3 && Object.keys(sA.borden[bordM3].leden).length === 2)
await A.ctx.close()
await B.ctx.close()

// 28. Een kapotte koppel-link
const D = await nieuwePagina()
await D.p.goto(`${URL_APP}#koppel=kapot`)
await D.p.waitForTimeout(400)
ok('kapotte koppel-link: een vriendelijke melding, verder niets', (await D.p.locator('#toast').innerText()).includes('kapot') && (await D.p.locator('#koppel-ja').count()) === 0)
await D.ctx.close()
nepWorker.close()


// ---------- M4: link, foto en kaart ----------
// Testfoto's: een staande iPhone-foto (liggende pixels met EXIF-oriëntatie 6,
// zoals een iPhone hem opslaat), een foto vol detail, en een HEIC-bestand.
// Een echte HEIC kan Chromium niet lezen; dit bestand heeft alleen de kop
// ervan. De app reageert in Chromium op beide hetzelfde.
const FOTO_STAAND = join(tmp, 'iphone-staand.jpg')
const FOTO_RUIS = join(tmp, 'veel-detail.jpg')
const FOTO_HEIC = join(tmp, 'foto.heic')
{
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="4032" height="3024"><defs><linearGradient id="g"><stop offset="0" stop-color="#3a7"/><stop offset="1" stop-color="#ec5"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/><circle cx="2400" cy="1500" r="700" fill="#258"/></svg>`
  await sharp(Buffer.from(svg)).jpeg({ quality: 95 }).withMetadata({ orientation: 6 }).toFile(FOTO_STAAND)
  const ruis = Buffer.alloc(3000 * 2250 * 3)
  let x = 12345
  for (let i = 0; i < ruis.length; i++) ruis[i] = (x = (x * 1103515245 + 12345) & 0x7fffffff) >> 23
  await sharp(ruis, { raw: { width: 3000, height: 2250, channels: 3 } }).jpeg({ quality: 92 }).toFile(FOTO_RUIS)
  await writeFile(FOTO_HEIC, Buffer.from('\x00\x00\x00\x18ftypheic\x00\x00\x00\x00mif1heic', 'binary'))
}
const W4POORT = 4322
const W4URL = `http://localhost:${W4POORT}`
const nep = nepNominatim() // de vragen van de worker aan Nominatim, afgevangen
const w4 = await startWorker(W4POORT, undefined, { env: {} })
const fotoSleutels = () => [...w4.kv.data.keys()].filter((k) => k.startsWith('foto:'))
const idbFoto = (p, id) =>
  p.evaluate(
    (id) =>
      new Promise((ok) => {
        const r = indexedDB.open('prikbord')
        r.onsuccess = () => {
          const q = r.result.transaction('fotos').objectStore('fotos').get(id)
          q.onsuccess = async () => {
            const rec = q.result
            if (!rec) return ok(null)
            const bm = await createImageBitmap(rec.blob)
            ok({ size: rec.blob.size, type: rec.blob.type, w: bm.width, h: bm.height })
          }
        }
      }),
    id,
  )
const idbWachtrij = (p) =>
  p.evaluate(
    () =>
      new Promise((ok) => {
        const r = indexedDB.open('prikbord')
        r.onsuccess = () => {
          const q = r.result.transaction('wachtrij').objectStore('wachtrij').getAllKeys()
          q.onsuccess = () => ok(q.result)
        }
      }),
  )
async function kiesFotoOp(p, knop, bestand) {
  const [kiezer] = await Promise.all([p.waitForEvent('filechooser'), p.click(knop)])
  await kiezer.setFiles(bestand)
}
async function briefjeVan(p, tekst) {
  const s = await opslag(p)
  return Object.values(s.borden[s.bord].briefjes).find((b) => b.v?.tekst?.w === tekst)
}
async function nieuwVel(p, tekst, cat) {
  await p.click('#blok')
  await p.waitForSelector('#vel-tekst')
  if (cat) await p.click(`.tabje[data-cat="${cat}"]`)
  await p.fill('#vel-tekst', tekst)
}
async function prikNu(p) {
  await p.click('.prik')
  await dicht(p)
  await p.waitForTimeout(450)
}
async function openPlek(p) {
  await p.click('[data-vel="plek"]')
  await p.waitForSelector('#kies-kaart.leaflet-container')
}

// 29. Een link op een briefje (§5.5)
const L = await nieuwePagina({ permissions: ['geolocation'], geolocation: { latitude: 52.0116, longitude: 4.3571 } })
await L.p.goto(URL_APP)
await welkom(L.p, 'Oscar')
await nieuwVel(L.p, 'Lasagne van Allerhande', 'recepten')
await L.p.click('[data-vel="link"]')
ok('M4 link: de paperclip opent een linkveld met focus', await L.p.evaluate(() => document.activeElement?.id === 'vel-link'))
await L.p.fill('#vel-link', 'javascript:alert(1)')
await L.p.click('[data-vel="link-ok"]')
ok('link: javascript: wordt geweigerd, met uitleg', (await L.p.locator('#vel-fout').innerText()).includes('http') && (await L.p.locator('#vel-bijlagen .bijlage').count()) === 0)
await L.p.fill('#vel-link', 'ah.nl/allerhande/recept/lasagne')
await L.p.keyboard.press('Enter')
ok('link: Enter bewaart de link en prikt nog niet', (await L.p.locator('#vel-bijlagen').innerText()).includes('ah.nl') && (await L.p.locator('.laag[open] #vel-form').count()) === 1)
await L.p.waitForTimeout(600) // concept na 400 ms bewaard
await L.p.reload()
await L.p.waitForSelector('#vel-tekst')
ok('link: een half geschreven briefje met link komt terug na herladen', (await L.p.inputValue('#vel-tekst')) === 'Lasagne van Allerhande' && (await L.p.locator('#vel-bijlagen').innerText()).includes('ah.nl'))
await prikNu(L.p)
const lasagne = briefjeOp(L.p, 'Lasagne')
ok('link: op het briefje staat "🔗 ah.nl"', (await lasagne.locator('.bijlage').innerText()).includes('ah.nl'))
let br4 = await briefjeVan(L.p, 'Lasagne van Allerhande')
ok('link: bewaard als https-link met een eigen tijdstempel', br4.v.link.w === 'https://ah.nl/allerhande/recept/lasagne' && typeof br4.v.link.t === 'number')
await lasagne.locator('.briefje').click()
await L.p.waitForSelector('.laag[open] .groot')
const linkA = L.p.locator('.groot-link a')
ok('link: het geopende briefje heeft een link die in een nieuw tabblad opent', (await linkA.getAttribute('href')) === 'https://ah.nl/allerhande/recept/lasagne' && (await linkA.getAttribute('target')) === '_blank' && (await linkA.getAttribute('rel')).includes('noopener'))
await rustig(L.p)
await L.p.click('[data-laag="bewerk"]')
await L.p.click('[data-vel="link-weg"]')
await prikNu(L.p)
br4 = await briefjeVan(L.p, 'Lasagne van Allerhande')
ok('link: weghalen met het kruisje (leeg, met tijdstempel)', br4.v.link.w === null && (await lasagne.locator('.bijlage').count()) === 0)

// 30. Foto's (§6.4)
await nieuwVel(L.p, 'Picknick in het Haagse Bos', 'dagjeuit')
await kiesFotoOp(L.p, '[data-vel="foto"]', FOTO_STAAND)
await L.p.waitForSelector('#vel-bijlagen .polaroid:not(.leeg) img[src^="blob:"]')
ok('foto: een polaroidje op het schrijfvel', (await L.p.locator('#vel-bijlagen .polaroid-band').count()) === 1)
await prikNu(L.p)
br4 = await briefjeVan(L.p, 'Picknick in het Haagse Bos')
const fotoPicknick = br4.v.foto?.w
let f4 = await idbFoto(L.p, fotoPicknick)
ok('foto: als JPEG in IndexedDB (database prikbord, store fotos)', f4?.type === 'image/jpeg')
ok('foto: de staande iPhone-foto staat rechtop en is verkleind tot 1200 × 1600', f4?.w === 1200 && f4?.h === 1600, `${f4?.w} × ${f4?.h}`)
ok('foto: kleiner dan 400 KB', f4?.size < 400 * 1024, `${Math.round(f4?.size / 1024)} KB`)
const lsLengte = await L.p.evaluate(() => localStorage.getItem('prikbord.v1').length)
ok('foto: niet in localStorage, alleen het id', lsLengte < 30_000 && /^[\w-]{16}$/.test(fotoPicknick || ''), `${lsLengte} tekens`)
const picknick = briefjeOp(L.p, 'Picknick')
ok('foto: een polaroidje met plakband op het bord', (await picknick.locator('.polaroid:not(.leeg) img[src^="blob:"]').count()) === 1 && (await picknick.locator('.polaroid-band').count()) === 1)
await nieuwVel(L.p, 'Grasveld vol detail', 'dagjeuit')
await kiesFotoOp(L.p, '[data-vel="foto"]', FOTO_RUIS)
await L.p.waitForSelector('#vel-bijlagen .polaroid:not(.leeg):not(.bezig) img[src^="blob:"]', { timeout: 30000 })
await prikNu(L.p)
br4 = await briefjeVan(L.p, 'Grasveld vol detail')
const fotoGras = br4.v.foto?.w
f4 = await idbFoto(L.p, fotoGras)
ok('foto: ook een foto vol detail wordt kleiner dan 400 KB (langste zijde ≤ 1600 px)', f4?.size <= 400 * 1024 && Math.max(f4.w, f4.h) <= 1600, `${f4?.w} × ${f4?.h}, ${Math.round(f4?.size / 1024)} KB`)
await nieuwVel(L.p, 'HEIC-proef')
await kiesFotoOp(L.p, '[data-vel="foto"]', FOTO_HEIC)
await L.p.waitForFunction(() => document.querySelector('#vel-fout')?.textContent.includes('niet lezen'))
ok('foto: een HEIC die de browser niet kan lezen geeft een vriendelijke melding', (await L.p.locator('#vel-bijlagen .polaroid').count()) === 0 && (await L.p.locator('#vel-fout').innerText()).includes('HEIC'))
await L.p.click('[data-laag="weggooien"]')
await dicht(L.p)
// Gedaan met een foto (§5.8)
await picknick.locator('.briefje').click()
await L.p.waitForSelector('.laag[open] .groot')
await rustig(L.p)
await L.p.click('[data-laag="gedaan"]')
await kiesFotoOp(L.p, '[data-gedaan-foto="kies"]', FOTO_STAAND)
await L.p.waitForSelector('#gedaan-foto-rij .polaroid:not(.leeg) img[src^="blob:"]')
await L.p.click('#gedaan-form [type="submit"]')
await dicht(L.p)
await L.p.waitForTimeout(1300)
br4 = await briefjeVan(L.p, 'Picknick in het Haagse Bos')
const fotoGedaan = br4.v.gedaan?.w?.foto
ok('Gedaan met foto: de foto hoort bij "gedaan", naast de foto van het briefje', /^[\w-]{16}$/.test(fotoGedaan || '') && fotoGedaan !== fotoPicknick && br4.v.foto.w === fotoPicknick)
await L.p.click('[data-tab="gedaan"]')
ok('Gedaan-doos: het plakboek toont de foto van "gedaan"', (await L.p.locator(`.geplakt .polaroid[data-foto="${fotoGedaan}"] img[src^="blob:"]`).count()) === 1)
// Back-up met of zonder foto's
await L.p.click('[data-tab="meer"]')
await L.p.click('[data-action="export"]')
await L.p.waitForSelector('#backup-keus [data-backup="met"]:not([disabled])')
ok("back-up: kiezen met of zonder foto's, met de grootte erbij", /\d+(,\d)? (KB|MB) · 3 foto's/.test(await L.p.locator('#backup-met').innerText()), await L.p.locator('#backup-met').innerText())
const [dlMet] = await Promise.all([L.p.waitForEvent('download'), L.p.click('[data-backup="met"]')])
const padMet = join(tmp, dlMet.suggestedFilename())
await dlMet.saveAs(padMet)
const bMet = JSON.parse(await readFile(padMet, 'utf8'))
ok("back-up met foto's: de drie foto's als base64-JPEG erin", Object.keys(bMet.fotos || {}).length === 3 && Object.values(bMet.fotos).every((x) => Buffer.from(x.data, 'base64')[0] === 0xff && x.type === 'image/jpeg'))
await L.p.click('[data-action="export"]')
const [dlZonder] = await Promise.all([L.p.waitForEvent('download'), L.p.click('[data-backup="zonder"]')])
const padZonder = join(tmp, dlZonder.suggestedFilename())
await dlZonder.saveAs(padZonder)
const bZonder = JSON.parse(await readFile(padZonder, 'utf8'))
ok("back-up zonder foto's: alleen de briefjes (met de foto-id's)", !('fotos' in bZonder) && JSON.stringify(bZonder).includes(fotoPicknick) && padZonder.length < padMet.length + 10)
const N4 = await nieuwePagina()
await N4.p.goto(URL_APP)
await welkom(N4.p, 'Oscar')
await N4.p.setInputFiles('#import-bestand', padMet)
await N4.p.waitForFunction(() => document.querySelector('#toast')?.textContent.includes('Samengevoegd'))
ok("terugzetten met foto's: \"3 foto's erbij\"", (await N4.p.locator('#toast').innerText()).includes("3 foto's"))
// Het geïmporteerde bord staat naast het (lege) beginbord van deze telefoon.
await N4.p.click('#kop-titel')
await N4.p.click('[data-borden="kies"]:not([aria-current])')
await N4.p.waitForSelector('.bord-binnen .polaroid:not(.leeg) img[src^="blob:"]')
ok('terugzetten: de foto staat op de nieuwe telefoon, rechtop', (await idbFoto(N4.p, fotoPicknick))?.h === 1600)
await N4.ctx.close()
await L.p.click('[data-tab="bord"]')

// 31. Een plek kiezen op vier manieren (§5.9)
// 1. Tikken op de kaart en de punaise verslepen
await nieuwVel(L.p, 'Strand Scheveningen', 'dagjeuit')
await openPlek(L.p)
ok('plek kiezen: de kaart toont "© OpenStreetMap-bijdragers"', (await L.p.locator('#kies-kaart .leaflet-control-attribution').innerText()).includes('© OpenStreetMap-bijdragers'))
await L.p.click('[data-plek="klaar"]')
ok('plek kiezen: zonder plek zegt "Klaar" wat je moet doen', (await L.p.locator('#plek-fout').innerText()).includes('tik op de kaart'))
const kies = await L.p.locator('#kies-kaart').boundingBox()
await L.p.mouse.click(kies.x + kies.width * 0.3, kies.y + kies.height * 0.4)
await L.p.waitForSelector('#kies-kaart .kaart-pin.kies')
const getikt = await L.p.locator('#plek-status').innerText()
ok('1. tikken op de kaart zet de punaise neer', /° N, .*° O/.test(getikt), getikt)
const pin4 = await L.p.locator('#kies-kaart .leaflet-marker-icon').boundingBox()
await L.p.mouse.move(pin4.x + pin4.width / 2, pin4.y + pin4.height / 2)
await L.p.mouse.down()
await L.p.mouse.move(pin4.x + 90, pin4.y + 50, { steps: 10 })
await L.p.mouse.up()
await L.p.waitForTimeout(250)
const gesleept = await L.p.locator('#plek-status').innerText()
ok('1. de punaise verslepen verandert de plek', gesleept !== getikt && /° N/.test(gesleept), `${getikt} → ${gesleept}`)
await L.p.fill('#plek-naam', 'Strand')
await L.p.click('[data-plek="klaar"]')
await L.p.waitForSelector('#vel-tekst')
ok('plek: "📍 Strand" op het schrijfvel, met wat je al typte', (await L.p.locator('#vel-bijlagen').innerText()).includes('Strand') && (await L.p.inputValue('#vel-tekst')) === 'Strand Scheveningen')
await prikNu(L.p)
br4 = await briefjeVan(L.p, 'Strand Scheveningen')
ok('plek: bewaard met coördinaten, naam en tijdstempel', br4.v.plek.w.naam === 'Strand' && Math.abs(br4.v.plek.w.lat) <= 90 && Math.abs(br4.v.plek.w.lng) <= 180 && typeof br4.v.plek.t === 'number')
ok('plek: "📍 Strand" op het briefje', (await briefjeOp(L.p, 'Strand Scheveningen').locator('.bijlage').innerText()).includes('Strand'))
// 2. Mijn locatie
await nieuwVel(L.p, 'Koffie bij de TU', 'todo')
await openPlek(L.p)
await L.p.click('[data-plek="locatie"]')
await L.p.waitForFunction(() => document.querySelector('#plek-status')?.textContent.includes('52,0116'))
await L.p.click('[data-plek="klaar"]')
await L.p.waitForSelector('#vel-tekst')
await prikNu(L.p)
br4 = await briefjeVan(L.p, 'Koffie bij de TU')
ok('2. "Mijn locatie" zet de punaise op je plek (52.0116, 4.3571)', br4.v.plek.w.lat === 52.0116 && br4.v.plek.w.lng === 4.3571)
// 3. Een link plakken
const vragenVoorLink = nep.vragen.length
await nieuwVel(L.p, 'Mauritshuis bezoeken', 'dagjeuit')
await openPlek(L.p)
await L.p.fill('#plek-zoek', 'Kijk: https://maps.app.goo.gl/AbCd123')
ok('3. een verkorte Google-link: uitleg wat je wel kunt doen', (await L.p.locator('#plek-fout').innerText()).includes('verkorte link'))
await L.p.fill('#plek-zoek', 'https://www.google.com/maps/place/Mauritshuis/@52.0804,4.3121,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d52.0804049!4d4.3143911')
await L.p.waitForFunction(() => document.querySelector('#plek-status')?.textContent.includes('52,0804'))
ok('3. een Google Maps-link plakken: punaise op de plek, met naam, zonder zoekdienst', (await L.p.inputValue('#plek-naam')) === 'Mauritshuis' && nep.vragen.length === vragenVoorLink)
await L.p.click('[data-plek="klaar"]')
await L.p.waitForSelector('#vel-tekst')
await prikNu(L.p)
br4 = await briefjeVan(L.p, 'Mauritshuis bezoeken')
ok('3. bewaard: de punaise van de plek zelf (!3d/!4d), niet het midden van de kaart', br4.v.plek.w.lat === 52.080405 && br4.v.plek.w.lng === 4.314391)
// 4. Zoeken via de worker (Nominatim, §6.5). Eerst zonder sync-server.
await nieuwVel(L.p, 'Boekwinkel in Porto', 'vakantie')
await openPlek(L.p)
await L.p.fill('#plek-zoek', 'Livraria')
await L.p.click('[data-plek="zoek"]')
ok('4. zoeken zonder sync-server: vriendelijke uitleg (de andere drie manieren werken)', (await L.p.locator('#plek-fout').innerText()).includes('sync-server'))
await L.p.click('[data-plek="terug"]')
await L.p.waitForSelector('#vel-tekst')
await L.p.click('.laag-knoppen [data-laag="weggooien"]')
await dicht(L.p)
// Het bord delen met de worker van M4.
await L.p.click('[data-tab="meer"]')
await L.p.click('[data-action="delen"]')
await L.p.fill('#delen-form [name="url"]', W4URL)
await L.p.click('#delen-form [type="submit"]')
await L.p.waitForSelector('#koppel-link')
const koppel4 = await L.p.inputValue('#koppel-link')
await wachtOpBolletje(L.p, 'ok')
await L.p.keyboard.press('Escape')
await dicht(L.p)
await L.p.click('[data-tab="bord"]')
const zoekVragen = []
L.p.on('request', (r) => r.url().includes('/zoek?') && zoekVragen.push(Date.now()))
await nieuwVel(L.p, 'Boekwinkel in Porto', 'vakantie')
await openPlek(L.p)
const voorTypen = nep.vragen.length
await L.p.type('#plek-zoek', 'Porto', { delay: 60 })
await L.p.waitForTimeout(400)
ok('4. typen zoekt niet: geen autocomplete', nep.vragen.length === voorTypen && zoekVragen.length === 0)
await L.p.click('[data-plek="zoek"]')
await L.p.waitForSelector('#zoek-uitkomsten:not([hidden]) .zoek-uitkomst')
ok('4. pas na een tik op Zoek: uitkomsten met naam en adres', (await L.p.locator('.zoek-uitkomst').count()) === 2 && (await L.p.locator('.zoek-uitkomst').first().innerText()).includes('Livraria Lello'))
ok('4. de worker vroeg het Nominatim, met de eigen User-Agent', nep.vragen.at(-1)?.q === 'Porto' && nep.vragen.at(-1)?.ua === 'Prikbord/1.0 (+https://github.com/oscardillewaard-ai/prikbord)')
ok('4. bronvermelding bij het zoeken', (await L.p.locator('.plek-uitleg').innerText()).includes('© OpenStreetMap-bijdragers, via Nominatim'))
await L.p.locator('.zoek-uitkomst').first().click()
ok('4. een uitkomst kiezen: punaise en naam', (await L.p.inputValue('#plek-naam')) === 'Livraria Lello' && (await L.p.locator('#plek-status').innerText()).includes('41,1468'))
await L.p.fill('#plek-zoek', 'Ribeira')
await L.p.click('[data-plek="zoek"]')
await L.p.waitForFunction(() => document.querySelector('#plek-status')?.textContent.includes('41,1408'))
const tussen4 = zoekVragen[1] - zoekVragen[0]
ok('4. twee zoekopdrachten vlak na elkaar: de app wacht minstens 1 seconde', zoekVragen.length === 2 && tussen4 >= 990, `${tussen4} ms`)
ok('4. één uitkomst wordt meteen gekozen', (await L.p.inputValue('#plek-naam')) === 'Ribeira')
w4.env.ZOEKEN = 'uit'
await L.p.fill('#plek-zoek', 'Mauritshuis')
await L.p.click('[data-plek="zoek"]')
await L.p.waitForFunction(() => document.querySelector('#plek-fout')?.textContent.includes('staat even uit'))
ok('4. ZOEKEN=uit: "Zoeken staat even uit", en de gekozen plek blijft staan', (await L.p.inputValue('#plek-naam')) === 'Ribeira')
delete w4.env.ZOEKEN
await L.p.click('[data-plek="klaar"]')
await L.p.waitForSelector('#vel-tekst')
await prikNu(L.p)

// 32. De kaart-tab (§5.9)
const tegelsVoor = tegelVragen
await L.p.click('[data-tab="kaart"]')
await L.p.waitForSelector('#kaart.leaflet-container .kaart-pin')
const pins = L.p.locator('#kaart .kaart-pin')
ok('kaart: een punaise per briefje met een plek', (await pins.count()) === 4)
ok('kaart: de punaise heeft de kleur van de categorie (Dagje uit = zon)', (await L.p.locator('#kaart .kaart-pin.papier-zon').count()) === 2 && (await L.p.locator('#kaart .kaart-pin.papier-wit').count()) === 1)
ok('kaart: bronvermelding "© OpenStreetMap-bijdragers" zichtbaar', await L.p.locator('#kaart .leaflet-control-attribution').isVisible() && (await L.p.locator('#kaart .leaflet-control-attribution').innerText()).includes('© OpenStreetMap-bijdragers'))
ok('kaart: tegels van tile.openstreetmap.org', tegelVragen > tegelsVoor)
ok('kaart: zoomknoppen met Nederlandse uitleg', (await L.p.getAttribute('#kaart .leaflet-control-zoom-in', 'title')) === 'Inzoomen' && (await L.p.getAttribute('#kaart .leaflet-control-zoom-out', 'title')) === 'Uitzoomen')
ok('kaart: alle punaises in beeld', await L.p.evaluate(() => [...document.querySelectorAll('#kaart .kaart-pin')].every((el) => {
  const r = el.getBoundingClientRect()
  const k = document.querySelector('#kaart').getBoundingClientRect()
  return r.left >= k.left && r.right <= k.right && r.top >= k.top && r.bottom <= k.bottom
})))
// Uitgezoomd (Porto én Den Haag in beeld) liggen de punaises bij Den Haag op
// elkaar; daarom met het toetsenbord: focus op de punaise en Enter.
await L.p.locator('#kaart .leaflet-marker-icon[title*="Strand"]').focus()
await L.p.keyboard.press('Enter')
await L.p.waitForSelector('.laag[open] .groot')
ok('kaart: een punaise opent het briefje (ook met het toetsenbord)', (await L.p.locator('.groot-tekst').innerText()).includes('Strand Scheveningen'))
await rustig(L.p)
await L.p.click('[data-laag="gedaan"]')
await L.p.click('#gedaan-form [type="submit"]')
await dicht(L.p)
await L.p.waitForTimeout(1300)
ok('kaart: een gedaan briefje verdwijnt van de kaart', (await pins.count()) === 3)
await L.p.click('[data-action="kaart-gedaan"]')
ok('kaart: "Gedaan ook" laat gedane briefjes grijs zien', (await pins.count()) === 4 && (await L.p.locator('#kaart .kaart-pin.grijs').count()) === 1)
await L.p.click('[data-filter="cat"][data-cat="vakantie"]')
ok('kaart: filters werken hier ook', (await pins.count()) === 1)
await L.p.click('[data-filter="cat"][data-cat="recepten"]')
await L.p.click('[data-filter="cat"][data-cat="vakantie"]')
ok('kaart: niks gevonden → uitleg met "Alles laten zien"', (await pins.count()) === 0 && (await L.p.locator('#kaart-leeg').isVisible()) && (await L.p.locator('#kaart-leeg [data-filter="alles"]').count()) === 1)
await L.p.click('#kaart-leeg [data-filter="alles"]')
ok('kaart: "Alles laten zien" zet ze terug', (await pins.count()) === 4)
// "Op de kaart" vanaf een geopend briefje
await L.p.click('[data-tab="bord"]')
await briefjeOp(L.p, 'Mauritshuis bezoeken').locator('.briefje').click()
await L.p.waitForSelector('.laag[open] .groot')
await rustig(L.p)
await L.p.click('[data-laag="op-kaart"]')
await L.p.waitForSelector('#kaart .leaflet-marker-icon[title*="Mauritshuis"]')
await L.p.waitForTimeout(300)
const midden = await L.p.evaluate(() => {
  const k = document.querySelector('#kaart').getBoundingClientRect()
  const m = document.querySelector('#kaart .leaflet-marker-icon[title*="Mauritshuis"]').getBoundingClientRect()
  return { dx: Math.abs(m.left + m.width / 2 - (k.left + k.width / 2)), dy: Math.abs(m.bottom - (k.top + k.height / 2)) }
})
ok('"Op de kaart": naar de kaart-tab, met dat briefje in het midden', midden.dx < 30 && midden.dy < 30, JSON.stringify(midden))

// 33. Samen: foto's gaan mee naar de anderen
await L.p.click('[data-tab="bord"]')
await L.p.waitForFunction(() => true)
for (let i = 0; i < 40 && fotoSleutels().length < 3; i++) await L.p.waitForTimeout(250)
ok("samen: bij het delen gaan de foto's van het bord naar de worker (één sleutel per foto)", fotoSleutels().length === 3, fotoSleutels().length)
const T4 = await nieuwePagina()
await T4.p.goto(koppel4)
await T4.p.click('[data-koppel="ja"]')
await T4.p.waitForSelector('#wie-form')
await T4.p.fill('#wie-form [name="naam"]', 'Tara')
await T4.p.click('#wie-form [type="submit"]')
await dicht(T4.p)
await T4.p.waitForSelector(`.bord-binnen .polaroid[data-foto="${fotoGras}"]:not(.leeg) img[src^="blob:"]`, { timeout: 15000 })
ok('samen: Tara ziet de foto van Oscar (opgehaald bij de worker)', true)
ok('samen: en bewaart hem zelf in IndexedDB', (await idbFoto(T4.p, fotoGras))?.size === (await idbFoto(L.p, fotoGras))?.size)
await T4.ctx.setOffline(true)
await T4.p.reload()
await T4.p.waitForSelector('.bord-binnen.klaar')
await T4.p.waitForSelector(`.bord-binnen .polaroid[data-foto="${fotoGras}"]:not(.leeg) img[src^="blob:"]`, { timeout: 5000 })
ok('samen: offline blijft de foto zichtbaar (uit IndexedDB)', true)
await T4.ctx.setOffline(false)
await nuSync(T4.p)
// Offline een foto toevoegen: hij wacht in de wachtrij en gaat later alsnog.
await L.ctx.setOffline(true)
await nieuwVel(L.p, 'Bitterballen op het terras', 'uiteten')
await kiesFotoOp(L.p, '[data-vel="foto"]', FOTO_STAAND)
await L.p.waitForSelector('#vel-bijlagen .polaroid:not(.leeg) img[src^="blob:"]')
await prikNu(L.p)
const fotoBitter = (await briefjeVan(L.p, 'Bitterballen op het terras')).v.foto.w
await L.p.waitForTimeout(500)
ok('offline: de foto wacht in de uploadwachtrij (IndexedDB)', (await idbWachtrij(L.p)).includes(fotoBitter) && fotoSleutels().length === 3)
await L.p.reload()
await L.p.waitForSelector('.bord-binnen.klaar')
ok('offline: na herladen staat hij nog in de wachtrij', (await idbWachtrij(L.p)).includes(fotoBitter))
await L.ctx.setOffline(false)
await nuSync(L.p)
for (let i = 0; i < 40 && fotoSleutels().length < 4; i++) await L.p.waitForTimeout(250)
ok('weer online: de foto vertrekt alsnog en de wachtrij is leeg', fotoSleutels().includes(`foto:${(await syncVan(L.p)).borden[(await opslag(L.p)).bord].r}:${fotoBitter}`) && (await idbWachtrij(L.p)).length === 0)
await nuSync(T4.p)
await T4.p.waitForSelector(`.polaroid[data-foto="${fotoBitter}"]:not(.leeg) img[src^="blob:"]`, { timeout: 20000 })
ok('Tara ziet de offline gemaakte foto', true)
// Een foto die (nog) niet op de server staat: eerst een leeg polaroidje, later de foto.
await L.ctx.route('**/foto/**', (r) => (r.request().method() === 'PUT' ? r.abort() : r.continue()))
await nieuwVel(L.p, 'Poffertjes op de markt', 'uiteten')
await kiesFotoOp(L.p, '[data-vel="foto"]', FOTO_STAAND)
await L.p.waitForSelector('#vel-bijlagen .polaroid:not(.leeg) img[src^="blob:"]')
await prikNu(L.p)
const fotoPof = (await briefjeVan(L.p, 'Poffertjes op de markt')).v.foto.w
await L.p.waitForTimeout(2000)
await nuSync(T4.p)
await T4.p.waitForSelector(`.polaroid.leeg[data-foto="${fotoPof}"]`, { timeout: 20000 })
ok('nog niet geüpload: Tara ziet een vriendelijk leeg polaroidje', (await T4.p.locator(`.polaroid.leeg[data-foto="${fotoPof}"] img:not([src])`).count()) === 1)
await L.ctx.unroute('**/foto/**')
await nuSync(L.p)
for (let i = 0; i < 40 && fotoSleutels().length < 5; i++) await L.p.waitForTimeout(250)
await nuSync(T4.p)
await T4.p.waitForSelector(`.polaroid[data-foto="${fotoPof}"]:not(.leeg) img[src^="blob:"]`, { timeout: 20000 })
ok('…en zodra hij er is, verschijnt de foto alsnog', true)
await T4.ctx.close()
await L.ctx.close()
w4.server.close()
nep.terug()

// ---------- M5: prestaties en toegankelijkheid ----------

// Een bord klaarzetten (localStorage) en openen.
async function paginaMet(staatJson, sleutel) {
  const r = await nieuwePagina()
  await r.ctx.addInitScript(
    ([json, k]) => {
      if (!sessionStorage.getItem(k)) {
        localStorage.setItem('prikbord.v1', json)
        sessionStorage.setItem(k, '1')
      }
    },
    [staatJson, sleutel],
  )
  await r.p.goto(URL_APP)
  await r.p.waitForSelector('.bord-binnen.klaar')
  await r.p.evaluate(() => document.fonts.ready)
  return r
}
const idbDuimen = (p) =>
  p.evaluate(
    () =>
      new Promise((ok) => {
        const r = indexedDB.open('prikbord')
        r.onsuccess = () => {
          const q = r.result.transaction('duimen').objectStore('duimen').getAllKeys()
          q.onsuccess = () => ok(q.result)
        }
      }),
  )
const imgMaat = (p, sel) => p.evaluate((s) => [document.querySelector(s)?.naturalWidth, document.querySelector(s)?.naturalHeight], sel)

// 34. Prestaties: foto's pas laden als ze in beeld komen, en op het bord een duimnagel
{
  const nu = Date.now() - 3600e3
  const s5 = beginStaat(nu - 864e5, 'Oscar')
  const bd5 = s5.borden[s5.bord]
  const ik5 = s5.apparaat.ik[s5.bord]
  for (let i = 0; i < 80; i++) {
    const b = nieuwBriefje(bd5, { id: `m5brief${String(i).padStart(3, '0')}`, door: ik5, tekst: `Briefje ${i}: iets leuks om te doen`, cat: 'todo', now: nu - i * 60e3 })
    if (i === 0) zetVeld(b, 'foto', 'm5fotoBoven1', nu)
    if (i === 79) zetVeld(b, 'foto', 'm5fotoOnder1', nu)
  }
  s5.apparaat.seenVersion = 999
  s5.apparaat.naam = 'Oscar'
  const heel = (await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#4a7fb5' } }).jpeg({ quality: 80 }).toBuffer()).toString('base64')
  const r = await paginaMet(JSON.stringify(s5), 'm5')
  // De foto's in IndexedDB, zoals de app ze bewaart, en opnieuw starten.
  await r.p.evaluate(
    ([ids, b64]) =>
      new Promise((klaar) => {
        const o = indexedDB.open('prikbord')
        o.onupgradeneeded = () => {
          for (const n of ['fotos', 'wachtrij', 'duimen']) if (!o.result.objectStoreNames.contains(n)) o.result.createObjectStore(n)
        }
        o.onsuccess = () => {
          const tx = o.result.transaction('fotos', 'readwrite')
          for (const id of ids) tx.objectStore('fotos').put({ blob: new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: 'image/jpeg' }), t: Date.now() }, id)
          tx.oncomplete = () => {
            o.result.close()
            klaar()
          }
        }
      }),
    [['m5fotoBoven1', 'm5fotoOnder1'], heel],
  )
  await r.p.reload()
  await r.p.waitForSelector('.bord-binnen.klaar')
  const boven = '.bord-binnen .polaroid[data-foto="m5fotoBoven1"]'
  const onder = '.bord-binnen .polaroid[data-foto="m5fotoOnder1"]'
  await r.p.waitForSelector(`${boven}:not(.leeg) img[src^="blob:"]`, { timeout: 10000 })
  ok('prestaties: de foto bovenaan het bord laadt meteen', true)
  const duimMaat = await imgMaat(r.p, `${boven} img`)
  ok('prestaties: op het bord staat een duimnagel van 480 × 480, niet de hele foto van 1600 × 1200', duimMaat[0] === 480 && duimMaat[1] === 480, duimMaat.join(' × '))
  await r.p.waitForTimeout(1500)
  const afstand = await r.p.evaluate((sel) => Math.round(document.querySelector(sel).getBoundingClientRect().top - innerHeight), onder)
  const nogLeeg = await r.p.evaluate((sel) => document.querySelector(sel).classList.contains('leeg') && !document.querySelector(`${sel} img`).getAttribute('src'), onder)
  ok('prestaties: een foto ver onder in beeld (meer dan 1200 px) laadt nog niet', afstand > 1200 && nogLeeg, `${afstand} px onder het scherm`)
  ok('prestaties: de duimnagel is bewaard in IndexedDB; die van onderaan nog niet', JSON.stringify(await idbDuimen(r.p)) === '["m5fotoBoven1"]', JSON.stringify(await idbDuimen(r.p)))
  await r.p.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: 'center' }), onder)
  await r.p.waitForSelector(`${onder}:not(.leeg) img[src^="blob:"]`, { timeout: 10000 })
  ok('prestaties: …en laadt zodra hij in beeld komt', true)
  await r.p.evaluate(() => scrollTo(0, 0))
  await r.p.waitForTimeout(300)
  await r.p.locator('.briefje-plek[data-id="m5brief000"] .briefje').click()
  await r.p.waitForSelector('.laag[open] .groot-foto:not(.leeg) img[src^="blob:"]', { timeout: 10000 })
  const heleMaat = await imgMaat(r.p, '.laag .groot-foto img')
  ok('prestaties: groot geopend zie je de hele foto (1600 × 1200)', heleMaat[0] === 1600 && heleMaat[1] === 1200, heleMaat.join(' × '))
  await r.p.waitForSelector('.laag[open]:not(.bezig)')
  await r.p.keyboard.press('Escape')
  await r.p.waitForSelector('.laag:not([open])', { state: 'attached' })
  ok(
    'prestaties: de maat van het toetsenbord (--vvh) staat op het venster, niet op <html> (anders rekent de browser bij elke scrollbeweging alle briefjes opnieuw door)',
    await r.p.evaluate(() => !document.documentElement.style.getPropertyValue('--vvh') && !!document.querySelector('#laag').style.getPropertyValue('--vvh')),
  )
  await r.ctx.close()
}

// 35. Toegankelijkheid: axe-core op elk scherm, de focus, en vrij en de kaart met het toetsenbord
{
  const s6 = demoStaatM2()
  s6.apparaat.naam = 'Oscar'
  zetVeld(s6.borden[s6.bord].briefjes.demo02, 'plek', { lat: 52.0786, lng: 4.3103, naam: 'Den Haag' }, DEMO_NU)
  zetVeld(s6.borden[s6.bord].briefjes.demo02, 'link', 'https://www.example.nl/sushi', DEMO_NU)
  const bid = s6.bord
  const r = await paginaMet(JSON.stringify(s6), 'm5a11y')
  const q = r.p
  const scan = async (naam) => {
    await q.waitForTimeout(600)
    const v = await axeScan(q)
    ok(`toegankelijk (axe, WCAG 2.2 AA): ${naam}`, v.length === 0, v.slice(0, 3).join(' | '))
  }
  const sluitAlles = async () => {
    for (let i = 0; i < 4 && (await q.locator('.laag[open]').count()); i++) {
      await q.keyboard.press('Escape')
      await q.waitForTimeout(500)
    }
  }
  const focusOp = () => q.evaluate(() => document.activeElement?.dataset?.id || document.activeElement?.dataset?.action || document.activeElement?.id || document.activeElement?.tagName)
  await scan('het bord')
  // Een briefje openen met Enter en sluiten met Esc: de focus komt terug.
  await q.locator('.briefje-plek[data-id="demo02"] .briefje').focus()
  await q.keyboard.press('Enter')
  await q.waitForSelector('.laag[open] .groot')
  await scan('een geopend briefje (met link en plek)')
  await q.waitForSelector('.laag[open]:not(.bezig)')
  await q.keyboard.press('Escape')
  await q.waitForSelector('.laag:not([open])', { state: 'attached' })
  await q.waitForTimeout(300)
  ok('focus: na het sluiten staat de focus weer op hetzelfde briefje', (await focusOp()) === 'demo02')
  await q.locator('.briefje-plek[data-id="demo02"] .briefje').click()
  await q.waitForSelector('.laag[open] .groot')
  await q.waitForTimeout(400)
  ok('hartje-knop: vaste naam met het aantal erin ("Mijn hartje, 3 in totaal")', (await q.locator('.laag .hart-knop').evaluate((el) => el.textContent.replace(/\s+/g, ' ').trim())) === 'Mijn hartje , 3 in totaal')
  await q.click('[data-laag="gedaan"]')
  await scan('het formulier "Gedaan!"')
  await sluitAlles()
  await q.click('#blok')
  await q.waitForSelector('#vel-tekst')
  await scan('het schrijfvel')
  await q.click('[data-vel="link"]')
  await scan('het schrijfvel met het linkveld')
  await q.click('[data-vel="plek"]')
  await q.waitForSelector('#kies-kaart.leaflet-container')
  await scan('een plek kiezen')
  // De punaise met het toetsenbord in het midden zetten.
  await q.locator('#kies-kaart.leaflet-container').focus()
  await q.keyboard.press('Enter')
  await q.waitForTimeout(300)
  ok('plek kiezen met het toetsenbord: Enter op de kaart zet de punaise in het midden', (await q.locator('#kies-kaart .leaflet-marker-icon').count()) === 1 && (await q.locator('#plek-status').innerText()).trim().length > 0)
  await sluitAlles()
  await q.evaluate(() => document.querySelector('.laag[open]') && document.querySelector('.laag').close())
  await q.waitForTimeout(400)
  await q.click('[data-action="trek"]')
  await q.waitForSelector('.laag[open]:not(.bezig)')
  await scan('trek een briefje')
  await sluitAlles()
  await q.click('[data-tab="kaart"]')
  await q.waitForSelector('#kaart .kaart-pin')
  await scan('de kaart')
  await q.click('[data-tab="gedaan"]')
  await scan('de Gedaan-doos')
  await q.click('[data-tab="meer"]')
  await scan('Meer')
  await q.locator('[data-action="cats"]').focus()
  await q.keyboard.press('Enter')
  await q.waitForSelector('.laag[open]')
  await scan('de categorieën')
  await q.waitForSelector('.laag[open]:not(.bezig)')
  await q.keyboard.press('Escape')
  await q.waitForSelector('.laag:not([open])', { state: 'attached' })
  await q.waitForTimeout(300)
  ok('focus: na de categorieën staat de focus weer op de knop Categorieën (niet kwijt na het opnieuw tekenen)', (await focusOp()) === 'cats', await focusOp())
  for (const [actie, naam] of [
    ['ik', 'wie ben ik'],
    ['delen', 'bord delen'],
    ['changelog', 'wat is er nieuw'],
    ['borden', 'alle borden'],
  ]) {
    await q.click(`[data-action="${actie}"]`)
    await q.waitForSelector('.laag[open]')
    await scan(naam)
    await sluitAlles()
  }
  // Vrij met het toetsenbord: pijltjes verplaatsen het briefje met focus.
  await q.click('[data-tab="bord"]')
  await q.click('[data-weergave="vrij"]')
  await q.waitForSelector('#vrij-wereld .briefje-plek')
  await q.waitForTimeout(600)
  await scan('vrij')
  const briefje = q.locator('#vrij-wereld .briefje-plek[data-id="demo03"] .briefje')
  ok('vrij met het toetsenbord: het briefje zegt hoe het werkt (aria-describedby)', (await briefje.getAttribute('aria-describedby')) === 'vrij-uitleg')
  await briefje.focus()
  const voor = await q.evaluate(() => {
    const el = document.querySelector('#vrij-wereld .briefje-plek[data-id="demo03"]')
    return { x: Number(el.dataset.ux), y: Number(el.dataset.uy) }
  })
  for (const k of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown']) await q.keyboard.press(k)
  await q.keyboard.press('Shift+ArrowLeft')
  await q.waitForTimeout(400)
  const na = (await opslag(q)).borden[bid].briefjes.demo03.v.vrij.w
  ok('vrij met het toetsenbord: 3× rechts, 1× omlaag en Shift+links = 20 eenheden per stap, 80 met Shift', na.x === Math.round(voor.x) + 60 - 80 && na.y === Math.round(voor.y) + 20, `${JSON.stringify(voor)} → ${JSON.stringify(na)}`)
  ok('vrij met het toetsenbord: het briefje houdt de focus', (await focusOp()) === 'demo03')
  ok('vrij met het toetsenbord: het verplaatste briefje ligt bovenop de stapel', (await opslag(q)).borden[bid].briefjes.demo03.v.stapel.w >= 1)
  await r.ctx.close()
  // De eerste start: "Wie ben jij?"
  const w = await nieuwePagina()
  await w.p.goto(URL_APP)
  await w.p.waitForSelector('.laag[open] #welkom-form')
  await w.p.waitForTimeout(600)
  const vw = await axeScan(w.p)
  ok('toegankelijk (axe, WCAG 2.2 AA): de eerste start ("Wie ben jij?")', vw.length === 0, vw.slice(0, 3).join(' | '))
  await w.ctx.close()
}

// 10. Service worker: registreert en de app opent offline
;({ ctx, p } = await nieuwePagina())
await p.goto(URL_APP)
await p.waitForFunction(() => navigator.serviceWorker.controller || navigator.serviceWorker.ready.then(() => true))
await p.evaluate(() => navigator.serviceWorker.ready)
await p.reload()
await p.waitForFunction(() => !!navigator.serviceWorker.controller)
const caches = await p.evaluate(() => caches.keys())
ok(`service worker cachet onder prikbord-v${APP_VERSION}`, caches.includes(`prikbord-v${APP_VERSION}`), caches.join(', '))
await ctx.setOffline(true)
await p.reload()
await p.waitForSelector('.kop')
ok('app opent offline uit de cache', (await p.locator('#kop-titel').innerText()).includes('Thuis'))
await ctx.setOffline(false)
// "Nu bijwerken" laat caches van andere apps staan (A1).
await p.evaluate(() => caches.open('sportagenda-v34').then((c) => c.put('/x', new Response('tarapp'))))
// En een foto in IndexedDB, zoals de app hem bewaart.
await p.evaluate(
  () =>
    new Promise((ok) => {
      const r = indexedDB.open('prikbord')
      r.onupgradeneeded = () => {
        // Nieuwe database (de app maakte hem nog niet): dezelfde stores als de app.
        for (const n of ['fotos', 'wachtrij', 'duimen']) if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n)
      }
      r.onsuccess = () => {
        const tx = r.result.transaction('fotos', 'readwrite')
        tx.objectStore('fotos').put({ blob: new Blob(['x'], { type: 'image/jpeg' }), t: Date.now() }, 'blijftStaan1')
        tx.oncomplete = () => {
          r.result.close()
          ok()
        }
      }
    }),
)
await p.click('[data-tab="meer"]')
await Promise.all([p.waitForEvent('load'), p.click('[data-action="force-update"]')])
const naUpdate = await p.evaluate(() => caches.keys())
ok('"Nu bijwerken" laat de cache van Tarapp staan', naUpdate.includes('sportagenda-v34'), naUpdate.join(', '))
ok('"Nu bijwerken" laat de briefjes staan', (await p.evaluate(() => !!localStorage.getItem('prikbord.v1'))))
ok('"Nu bijwerken" laat de foto\'s in IndexedDB staan', await p.evaluate(
  () =>
    new Promise((ok) => {
      const r = indexedDB.open('prikbord')
      r.onsuccess = () => {
        const q = r.result.transaction('fotos').objectStore('fotos').getKey('blijftStaan1')
        q.onsuccess = () => ok(q.result === 'blijftStaan1')
      }
    }),
))
await ctx.close()

await browser.close()
server.close()
console.log(uitslag.join('\n'))
const fout = uitslag.filter((r) => r.startsWith('FAIL')).length
console.log(`\n${uitslag.length - fout} geslaagd, ${fout} mislukt`)
process.exit(fout ? 1 : 0)
