// Rooktest in de browser (Playwright), zoals scripts/audit.mjs in Tezt.
// Draait tegen een lokale server; controleert de regels uit §4.1 die je
// alleen in een echte browser kunt zien.
// Gebruik: node scripts/rooktest.mjs
import { chromium } from 'playwright'
import { readFile, writeFile, mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { start } from './serve.mjs'

const POORT = 4320
const URL_APP = `http://localhost:${POORT}/`
const server = await start(POORT)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' })
const uitslag = []
const ok = (naam, gelukt, extra = '') => uitslag.push(`${gelukt ? 'PASS' : 'FAIL'}  ${naam}${extra ? `  — ${extra}` : ''}`)
const tmp = await mkdtemp(join(tmpdir(), 'prikbord-'))

async function nieuwePagina(opties = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'nl-NL', acceptDownloads: true, ...opties })
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
  await p.waitForTimeout(150)
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
await p.waitForTimeout(200)
ok('bewerken past de tekst aan', (await p.locator('.bord-binnen').innerText()).includes('met feta en véél'))

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
ok('weghalen: briefje meteen van het bord', (await briefjesOpBord(p)) === 1)
await p.click('.toast-actie')
await p.waitForTimeout(150)
ok('ongedaan maken: briefje is terug', (await briefjesOpBord(p)) === 2)
await p.locator('.bord-binnen .briefje-plek').first().locator('.briefje').click()
await p.click('[data-laag="weg"]')
await p.waitForTimeout(5400)
s = await opslag(p)
const graf = Object.values(Object.values(s.borden)[0].briefjes).filter((b) => b.weg)
ok('na 5 tellen staat er een grafsteen (zonder tekst)', graf.length === 1 && !graf[0].v)

// 6. Meer: geluid, opslagstatus, versie
await p.click('[data-tab="meer"]')
await p.waitForSelector('.meer')
ok('Meer toont de versie', /versie 1/.test(await p.locator('.versie').innerText()))
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
ok('importeren voegt samen: 1 nieuw briefje erbij, niets kwijt', (await briefjesOpBord(p)) === 2 && (await p.locator('.bord-binnen').innerText()).includes('Uit de back-up'))
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

// 10. Service worker: registreert en de app opent offline
;({ ctx, p } = await nieuwePagina())
await p.goto(URL_APP)
await p.waitForFunction(() => navigator.serviceWorker.controller || navigator.serviceWorker.ready.then(() => true))
await p.evaluate(() => navigator.serviceWorker.ready)
await p.reload()
await p.waitForFunction(() => !!navigator.serviceWorker.controller)
const caches = await p.evaluate(() => caches.keys())
ok('service worker cachet onder prikbord-v1', caches.includes('prikbord-v1'), caches.join(', '))
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
