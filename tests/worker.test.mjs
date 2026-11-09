// De sync-worker in Node (§9): het echte bestand dat Oscar in Cloudflare
// plakt, met een nep-KV (Map) en echte Request-objecten.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import worker from '../proxy/prikbord-sync-worker.js'
import { bouwWorker, UIT } from '../scripts/bouw-worker.mjs'
import { nepKv } from '../scripts/nep-kv.mjs'
import { beginStaat, nieuwBriefje, zetHart, zetVeld, verwijder } from '../public/js/model.js'
import { schoonBord } from '../public/js/validate.js'
import { mergeBord } from '../public/js/merge.js'

const NU = 1_762_600_000_000
const CODE = 'Abc123_-Abc123_-Abc123_-'
const SITE = 'https://oscardillewaard-ai.github.io'
const J = JSON.stringify

function vraag(env, pad, { methode = 'GET', body, origin = SITE } = {}) {
  const headers = { Origin: origin }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return worker.fetch(new Request(`https://prikbord.test${pad}`, { method: methode, headers, body }), env)
}
const put = (env, bord, code = CODE) => vraag(env, `/bord/${code}`, { methode: 'PUT', body: J({ bord }) })

function bordMet(n = 2) {
  const s = beginStaat(NU)
  const bord = s.borden[s.bord]
  const ik = s.apparaat.ik[s.bord]
  for (let i = 0; i < n; i++) nieuwBriefje(bord, { id: `brief${i}xx`, door: ik, tekst: `Briefje ${i}`, cat: 'todo', now: NU + i })
  return { bord, ik }
}

test('proxy/prikbord-sync-worker.js past bij de bronnen (anders: npm run worker)', async () => {
  assert.equal(await readFile(UIT, 'utf8'), await bouwWorker())
})

test('statuspagina: zonder opslag de stappen, met opslag alleen lezen (A2)', async () => {
  let res = await vraag({}, '/')
  let tekst = await res.text()
  assert.equal(res.status, 200)
  assert.match(tekst, /nog geen opslag/)
  assert.match(tekst, /PRIKBORD/)
  const kv = nepKv()
  tekst = await (await vraag({ PRIKBORD: kv }, '/')).text()
  assert.match(tekst, /gekoppeld \(PRIKBORD\) en lezen lukt/)
  assert.equal(kv.tel.schrijf, 0, 'een gewoon bezoek schrijft niet')
  tekst = await (await vraag({ PRIKBORD: kv }, '/?schrijftest=1')).text()
  assert.match(tekst, /Schrijven lukt ook/)
  assert.equal(kv.tel.schrijf, 1)
  // Een andere naam voor de koppeling werkt ook, met een waarschuwing.
  tekst = await (await vraag({ ANDERS: nepKv() }, '/')).text()
  assert.match(tekst, /heet ANDERS in plaats van PRIKBORD/)
})

test('CORS: alleen de app zelf en localhost', async () => {
  const kv = nepKv()
  for (const origin of [SITE, 'http://localhost:4173', 'http://127.0.0.1:8080']) {
    const res = await vraag({ PRIKBORD: kv }, `/bord/${CODE}`, { methode: 'OPTIONS', origin })
    assert.equal(res.status, 204)
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), origin)
    assert.match(res.headers.get('Access-Control-Allow-Methods'), /PUT/)
  }
  for (const origin of ['https://kwaadwillig.example', 'http://localhost.evil.nl', 'https://oscardillewaard-ai.github.io.evil.nl']) {
    const res = await vraag({ PRIKBORD: kv }, `/bord/${CODE}`, { origin })
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), null, origin)
  }
})

test('onbekende paden, te korte groepscode en andere methodes', async () => {
  const env = { PRIKBORD: nepKv() }
  assert.equal((await vraag(env, '/room/' + CODE)).status, 404)
  assert.equal((await vraag(env, '/bord/kort')).status, 404)
  assert.equal((await vraag(env, `/bord/${CODE}/x`)).status, 404)
  assert.equal((await vraag(env, `/bord/${CODE}`, { methode: 'DELETE' })).status, 405)
  assert.equal((await vraag({}, `/bord/${CODE}`)).status, 500)
})

test('leeg bord, PUT, en peilen met ?sinds (ongewijzigd)', async () => {
  const kv = nepKv()
  const env = { PRIKBORD: kv }
  let data = await (await vraag(env, `/bord/${CODE}`)).json()
  assert.deepEqual(data, { rev: null, bord: null })
  const { bord } = bordMet(2)
  const res = await put(env, bord)
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('Cache-Control'), 'no-store')
  data = await res.json()
  assert.match(data.rev, /^[A-Za-z0-9_-]{22}$/)
  assert.equal(J(data.bord), J(bord))
  assert.equal(kv.tel.schrijf, 1)
  // Peilen met de juiste rev: kort antwoord.
  const kort = await (await vraag(env, `/bord/${CODE}?sinds=${data.rev}`)).json()
  assert.deepEqual(kort, { rev: data.rev, ongewijzigd: true })
  // Met een oude of onzin-rev: de volledige stand.
  const vol = await (await vraag(env, `/bord/${CODE}?sinds=ietsanders`)).json()
  assert.equal(vol.rev, data.rev)
  assert.equal(J(vol.bord), J(bord))
  // Hetzelfde nog eens sturen: geen schrijfactie, dezelfde rev.
  const nogEens = await (await put(env, bord)).json()
  assert.equal(nogEens.rev, data.rev)
  assert.equal(kv.tel.schrijf, 1)
})

test('samenvoegen per veld: tekst van de een en hartje van de ander blijven allebei', async () => {
  const env = { PRIKBORD: nepKv() }
  const { bord, ik } = bordMet(1)
  await put(env, bord)
  const oscar = structuredClone(bord)
  zetVeld(oscar.briefjes.brief0xx, 'tekst', 'Sushi in Den Haag', NU + 100)
  const tara = structuredClone(bord)
  zetHart(tara.briefjes.brief0xx, 'taraTARA1', true, NU + 101)
  // Elk stuurt alleen het eigen briefje.
  await put(env, { id: bord.id, gemaakt: bord.gemaakt, briefjes: { brief0xx: oscar.briefjes.brief0xx } })
  const data = await (await put(env, { id: bord.id, gemaakt: bord.gemaakt, briefjes: { brief0xx: tara.briefjes.brief0xx } })).json()
  const b = data.bord.briefjes.brief0xx
  assert.equal(b.v.tekst.w, 'Sushi in Den Haag')
  assert.equal(b.hart.taraTARA1.w, true)
  assert.equal(b.door, ik)
  // Het tweede briefje (niet meegestuurd) is er ook nog.
  assert.equal(J(data.bord), J(mergeBord(oscar, tara)))
})

test('een grafsteen wint, ook van een latere bewerking', async () => {
  const env = { PRIKBORD: nepKv() }
  const { bord } = bordMet(1)
  await put(env, bord)
  const weg = structuredClone(bord)
  verwijder(weg, 'brief0xx', NU + 10)
  const later = structuredClone(bord)
  zetVeld(later.briefjes.brief0xx, 'tekst', 'nog later', NU + 999)
  await put(env, weg)
  const data = await (await put(env, later)).json()
  assert.ok(data.bord.briefjes.brief0xx.weg)
  assert.equal(data.bord.briefjes.brief0xx.v, undefined)
})

test('validatie: onbekende velden, foute links, coördinaten en id\'s vallen weg', async () => {
  const env = { PRIKBORD: nepKv() }
  const { bord, ik } = bordMet(0)
  const t = NU + 5
  bord.hack = 'weg ermee'
  bord.briefjes = {
    goedgoed1: { id: 'goedgoed1', door: ik, gemaakt: t, v: { tekst: { w: 'x'.repeat(900), t }, link: { w: 'javascript:alert(1)', t }, plek: { w: { lat: 200, lng: 5 }, t }, geheim: { w: 1, t } }, hart: { 'fout id!': { w: true, t } }, extra: 1 },
    'fout id!': { id: 'fout id!', door: ik, gemaakt: t, v: { tekst: { w: 'nee', t } }, hart: {} },
    goedlink1: { id: 'goedlink1', door: ik, gemaakt: t, v: { tekst: { w: 'ok', t }, link: { w: 'https://ah.nl/recept', t }, plek: { w: { lat: 52.01, lng: 4.36 }, t } }, hart: {} },
  }
  const data = await (await put(env, bord)).json()
  assert.equal(data.bord.hack, undefined)
  assert.deepEqual(Object.keys(data.bord.briefjes), ['goedgoed1', 'goedlink1'])
  const g = data.bord.briefjes.goedgoed1
  assert.equal(g.v.tekst.w.length, 500)
  assert.equal(g.v.link, undefined)
  assert.equal(g.v.plek, undefined)
  assert.equal(g.v.geheim, undefined)
  assert.equal(g.extra, undefined)
  assert.deepEqual(g.hart, {})
  assert.equal(data.bord.briefjes.goedlink1.v.link.w, 'https://ah.nl/recept')
  assert.deepEqual(data.bord.briefjes.goedlink1.v.plek.w, { lat: 52.01, lng: 4.36 })
  // Wat bewaard is, is zelf schoon.
  assert.equal(J(schoonBord(data.bord)), J(data.bord))
  // Geen bord of kapotte JSON: 400.
  assert.equal((await vraag(env, `/bord/${CODE}`, { methode: 'PUT', body: '{kapot' })).status, 400)
  assert.equal((await vraag(env, `/bord/${CODE}`, { methode: 'PUT', body: J({ bord: { id: 'x' } }) })).status, 400)
})

test('één groepscode hoort bij één bord: een ander bord krijgt 409', async () => {
  const env = { PRIKBORD: nepKv() }
  await put(env, bordMet(1).bord)
  const res = await put(env, bordMet(1).bord)
  assert.equal(res.status, 409)
})

test('max. 256 KB per PUT', async () => {
  const env = { PRIKBORD: nepKv() }
  const { bord, ik } = bordMet(0)
  for (let i = 0; i < 700; i++) nieuwBriefje(bord, { id: `groot${String(i).padStart(4, '0')}`, door: ik, tekst: 'é'.repeat(250), cat: 'todo', now: NU + i })
  const body = J({ bord })
  assert.ok(new TextEncoder().encode(body).length > 256 * 1024)
  const res = await vraag(env, `/bord/${CODE}`, { methode: 'PUT', body })
  assert.equal(res.status, 413)
  assert.equal(env.PRIKBORD.tel.schrijf, 0)
})

test('mislukte KV-put (bijv. 2 schrijfacties in 1 seconde): 503 met "opnieuw", niets kwijt', async () => {
  const kv = nepKv()
  const env = { PRIKBORD: kv }
  const { bord } = bordMet(1)
  const echtePut = kv.put
  kv.put = async () => {
    throw new Error('KV PUT failed: 429 Too Many Requests')
  }
  const res = await put(env, bord)
  assert.equal(res.status, 503)
  assert.equal(res.headers.get('Retry-After'), '1')
  assert.deepEqual(await res.json(), { fout: 'Even druk, probeer het zo opnieuw', opnieuw: true })
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), SITE, 'ook een fout mag de app lezen')
  kv.put = echtePut
  const data = await (await put(env, bord)).json()
  assert.equal(J(data.bord), J(bord))
  // Lezen mislukt: ook 503.
  kv.getWithMetadata = async () => {
    throw new Error('KV GET failed')
  }
  assert.equal((await vraag(env, `/bord/${CODE}`)).status, 503)
})

test('rev is een hash van de opgeslagen stand: een overschreven schrijfactie valt op', async () => {
  const kv = nepKv()
  const env = { PRIKBORD: kv }
  const { bord, ik } = bordMet(1)
  const basis = await (await put(env, bord)).json()
  // Oscar stuurt een nieuw briefje en krijgt een rev terug.
  const oscar = structuredClone(bord)
  nieuwBriefje(oscar, { id: 'oscar001', door: ik, tekst: 'Van Oscar', cat: 'todo', now: NU + 50 })
  const naOscar = await (await put(env, oscar)).json()
  // Tara's schrijfactie las nog de oude stand (KV is niet atomair) en
  // overschrijft die van Oscar. Dat bootsen we na door haar stand rechtstreeks
  // te bewaren, zoals de worker dat zou doen.
  const tara = structuredClone(bord)
  nieuwBriefje(tara, { id: 'tara0001', door: ik, tekst: 'Van Tara', cat: 'todo', now: NU + 51 })
  const env2 = { PRIKBORD: nepKv() }
  const naTara = await (await put(env2, tara)).json()
  kv.data.set(`bord:${CODE}`, env2.PRIKBORD.data.get(`bord:${CODE}`))
  // Met een teller hadden ze allebei "revisie 2" gehad. Met de hash ziet
  // Oscar bij het peilen dat de stand niet meer de zijne is.
  assert.notEqual(naOscar.rev, naTara.rev)
  assert.notEqual(naOscar.rev, basis.rev)
  const peil = await (await vraag(env, `/bord/${CODE}?sinds=${naOscar.rev}`)).json()
  assert.equal(peil.ongewijzigd, undefined)
  assert.equal(peil.bord.briefjes.oscar001, undefined, 'Oscars briefje is op de server kwijt…')
  // …en zijn app stuurt het daarom opnieuw (zie de convergentietest).
  const hersteld = await (await put(env, oscar)).json()
  assert.ok(hersteld.bord.briefjes.oscar001 && hersteld.bord.briefjes.tara0001)
})
