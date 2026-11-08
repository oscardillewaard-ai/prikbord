// Rooktest in de browser (Playwright), zoals scripts/audit.mjs in Tezt.
// Draait tegen een lokale server; controleert de regels uit §4.1 die je
// alleen in een echte browser kunt zien.
// Gebruik: node scripts/rooktest.mjs
import { chromium } from 'playwright'
import { readFile, writeFile, mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { start } from './serve.mjs'
import { beginStaat, nieuwBriefje } from '../public/js/model.js'

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
  const p = await ctx.newPage()
  p.on('pageerror', (e) => uitslag.push(`FAIL  fout in de pagina — ${String(e).slice(0, 140)}`))
  p.on('dialog', (d) => d.accept())
  return { ctx, p }
}
const opslag = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('prikbord.v1')))
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
ok('geopend briefje toont wie het prikte', (await p.locator('.groot-meta').innerText()).includes('Geprikt door Ik'))
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
await p.click('[data-tab="meer"]')
await Promise.all([p.waitForEvent('load'), p.click('[data-action="force-update"]')])
const naUpdate = await p.evaluate(() => caches.keys())
ok('"Nu bijwerken" laat de cache van Tarapp staan', naUpdate.includes('sportagenda-v34'), naUpdate.join(', '))
ok('"Nu bijwerken" laat de briefjes staan', (await p.evaluate(() => !!localStorage.getItem('prikbord.v1'))))
await ctx.close()

await browser.close()
server.close()
console.log(uitslag.join('\n'))
const fout = uitslag.filter((r) => r.startsWith('FAIL')).length
console.log(`\n${uitslag.length - fout} geslaagd, ${fout} mislukt`)
process.exit(fout ? 1 : 0)
