// De foto-endpoints en het zoeken van de sync-worker (M4, §6.4, §6.5, §9):
// het echte bestand dat Oscar in Cloudflare plakt, met een nep-KV, echte
// Request-objecten en een nep-Nominatim (globalThis.fetch).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import worker from '../proxy/prikbord-sync-worker.js'
import { nepKv } from '../scripts/nep-kv.mjs'
import { MAX_FOTO } from '../public/js/validate.js'

const CODE = 'Abc123_-Abc123_-Abc123_-'
const SITE = 'https://oscardillewaard-ai.github.io'
const FOTO_ID = 'fotoAbcdEfgh1234'
const JPEG_KOP = [0xff, 0xd8, 0xff, 0xe0]
const PNG_KOP = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const maakFoto = (n, kop = JPEG_KOP) => Uint8Array.from({ length: n }, (_, i) => (i < kop.length ? kop[i] : (i * 31) % 256))
const WEBP = new TextEncoder().encode('RIFF\x10\x00\x00\x00WEBPVP8 rest')

function vraag(env, pad, { methode = 'GET', body, type, origin = SITE, headers = {}, ctx } = {}) {
  const h = { ...headers }
  if (origin) h.Origin = origin
  if (type) h['Content-Type'] = type
  return worker.fetch(new Request(`https://prikbord.test${pad}`, { method: methode, headers: h, body }), env, ctx)
}
const fotoPad = (id = FOTO_ID, code = CODE) => `/bord/${code}/foto/${id}`
const zetFoto = (env, bytes, type = 'image/jpeg', id = FOTO_ID) => vraag(env, fotoPad(id), { methode: 'PUT', body: bytes, type })

// ---------- Foto's ----------

test('foto: PUT bewaart hem onder één eigen KV-sleutel, GET geeft precies dezelfde bytes', async () => {
  const kv = nepKv()
  const env = { PRIKBORD: kv }
  const foto = maakFoto(300_000)
  const res = await zetFoto(env, foto)
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { ok: true })
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), SITE)
  assert.equal(kv.tel.schrijf, 1, 'één schrijfactie per foto')
  assert.deepEqual([...kv.data.keys()], [`foto:${CODE}:${FOTO_ID}`])
  assert.deepEqual(kv.data.get(`foto:${CODE}:${FOTO_ID}`).metadata, { type: 'image/jpeg' })
  // Niet in de bordstand.
  assert.deepEqual(await (await vraag(env, `/bord/${CODE}`)).json(), { rev: null, bord: null })

  const terug = await vraag(env, fotoPad())
  assert.equal(terug.status, 200)
  assert.equal(terug.headers.get('Content-Type'), 'image/jpeg')
  assert.equal(terug.headers.get('Cache-Control'), 'public, max-age=31536000, immutable')
  assert.equal(terug.headers.get('Access-Control-Allow-Origin'), SITE)
  assert.equal(terug.headers.get('X-Content-Type-Options'), 'nosniff')
  assert.deepEqual(new Uint8Array(await terug.arrayBuffer()), foto)
})

test('foto: nog een keer dezelfde foto sturen kost geen tweede schrijfactie', async () => {
  const kv = nepKv()
  const env = { PRIKBORD: kv }
  await zetFoto(env, maakFoto(1000))
  const res = await zetFoto(env, maakFoto(1000))
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { ok: true, al: true })
  assert.equal(kv.tel.schrijf, 1)
})

test('foto: bestaat (nog) niet → 404 dat de browser niet onthoudt', async () => {
  const res = await vraag({ PRIKBORD: nepKv() }, fotoPad('nogNietErFoto1'))
  assert.equal(res.status, 404)
  assert.equal(res.headers.get('Cache-Control'), 'no-store')
})

test('foto: max. 1,5 MB, precies 1,5 MB mag nog', async () => {
  const kv = nepKv()
  const env = { PRIKBORD: kv }
  assert.equal((await zetFoto(env, maakFoto(MAX_FOTO), 'image/jpeg', 'precies15MB1')).status, 200)
  const teGroot = await zetFoto(env, maakFoto(MAX_FOTO + 1), 'image/jpeg', 'teGroot15MB1')
  assert.equal(teGroot.status, 413)
  assert.match((await teGroot.json()).fout, /1,5 MB/)
  // Een Content-Length die al te groot is, wordt geweigerd zonder te lezen.
  const kop = await vraag(env, fotoPad('teGrootKop12'), { methode: 'PUT', body: maakFoto(10), type: 'image/jpeg', headers: { 'Content-Length': String(MAX_FOTO + 1) } })
  assert.equal(kop.status, 413)
  assert.equal(kv.tel.schrijf, 1)
})

test('foto: alleen jpeg, png en webp, en de bytes moeten kloppen met het type', async () => {
  const kv = nepKv()
  const env = { PRIKBORD: kv }
  assert.equal((await zetFoto(env, maakFoto(500, PNG_KOP), 'image/png', 'eenPngFoto12')).status, 200)
  assert.equal((await zetFoto(env, WEBP, 'image/webp', 'eenWebpFoto1')).status, 200)
  assert.equal((await zetFoto(env, maakFoto(500), 'image/jpeg; charset=binary', 'jpegMetExtra')).status, 200)
  const slecht = [
    [maakFoto(500), 'image/gif'],
    [maakFoto(500), 'image/heic'],
    [maakFoto(500), 'text/html'],
    [maakFoto(500), ''], // zonder Content-Type
    [maakFoto(500, PNG_KOP), 'image/jpeg'], // png die zegt dat hij jpeg is
    [new TextEncoder().encode('<svg onload="alert(1)"/>'), 'image/png'],
    [new Uint8Array(0), 'image/jpeg'],
  ]
  for (const [i, [bytes, type]] of slecht.entries()) {
    const res = await zetFoto(env, bytes, type, `slechteFoto${i}`)
    assert.equal(res.status, 415, `${type} #${i}`)
  }
  assert.equal(kv.tel.schrijf, 3)
  const png = await vraag(env, fotoPad('eenPngFoto12'))
  assert.equal(png.headers.get('Content-Type'), 'image/png')
})

test('foto: slechte id of groepscode → 404, andere methodes → 405, OPTIONS mag', async () => {
  const env = { PRIKBORD: nepKv() }
  for (const pad of [fotoPad('kor'), fotoPad('mag%2Fniet'), fotoPad('x'.repeat(41)), fotoPad(FOTO_ID, 'kortecode'), `/bord/${CODE}/foto/`, `/bord/${CODE}/foto/${FOTO_ID}/meer`]) {
    assert.equal((await vraag(env, pad, { methode: 'PUT', body: maakFoto(10), type: 'image/jpeg' })).status, 404, pad)
  }
  assert.equal((await vraag(env, fotoPad(), { methode: 'DELETE' })).status, 405)
  const opties = await vraag(env, fotoPad(), { methode: 'OPTIONS' })
  assert.equal(opties.status, 204)
  assert.match(opties.headers.get('Access-Control-Allow-Methods'), /PUT/)
  assert.equal((await vraag({}, fotoPad())).status, 500, 'zonder opslag')
})

test('foto: andere sites krijgen geen CORS-toestemming', async () => {
  const env = { PRIKBORD: nepKv() }
  await zetFoto(env, maakFoto(100))
  const res = await vraag(env, fotoPad(), { origin: 'https://kwaadwillig.example' })
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null)
})

test('foto: mislukt KV even, dan 503 waarop de app het later opnieuw probeert', async () => {
  const kv = nepKv()
  kv.put = async () => {
    throw new Error('KV PUT failed: 429 Too Many Requests')
  }
  const res = await zetFoto({ PRIKBORD: kv }, maakFoto(100))
  assert.equal(res.status, 503)
  assert.equal(res.headers.get('Retry-After'), '1')
  assert.equal((await res.json()).opnieuw, true)
  const kv2 = nepKv()
  kv2.getWithMetadata = async () => {
    throw new Error('KV GET failed')
  }
  assert.equal((await vraag({ PRIKBORD: kv2 }, fotoPad())).status, 503)
})

// ---------- Zoeken via Nominatim ----------

const NOMINATIM_ANTWOORD = [
  { name: 'Mauritshuis', display_name: 'Mauritshuis, 8, Plein, Centrum, Den Haag, Zuid-Holland, Nederland', lat: '52.0804049', lon: '4.3143911', osm_id: 1, extra: 'x'.repeat(50) },
  { name: '', display_name: 'Plein, Den Haag, Nederland', lat: '52.0796', lon: '4.3128' },
  { name: 'Kapot', display_name: 'Kapot', lat: 'abc', lon: '4' },
  { name: 'Buiten bereik', display_name: 'Nergens', lat: '95', lon: '4' },
  ...Array.from({ length: 5 }, (_, i) => ({ name: `Plek ${i}`, display_name: `Plek ${i}`, lat: String(50 + i), lon: '4' })),
]

// Vervangt fetch naar Nominatim; houdt bij wanneer en hoe er gevraagd werd.
function nepNominatim(maak = () => Response.json(NOMINATIM_ANTWOORD)) {
  const vragen = []
  const echt = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    vragen.push({ url: String(url), init, t: Date.now() })
    return maak(String(url))
  }
  return { vragen, terug: () => (globalThis.fetch = echt) }
}

test('zoeken: vraagt Nominatim netjes (jsonv2, Nederlands, max. 5, eigen User-Agent) en geeft alleen wat nodig is', async () => {
  const nep = nepNominatim()
  try {
    const res = await vraag({}, '/zoek?q=Mauritshuis%20Den%20Haag')
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), SITE)
    assert.equal(res.headers.get('X-Prikbord-Zoek'), 'nominatim')
    const data = await res.json()
    assert.equal(nep.vragen.length, 1)
    const u = new URL(nep.vragen[0].url)
    assert.equal(u.origin + u.pathname, 'https://nominatim.openstreetmap.org/search')
    assert.equal(u.searchParams.get('format'), 'jsonv2')
    assert.equal(u.searchParams.get('limit'), '5')
    assert.equal(u.searchParams.get('accept-language'), 'nl')
    assert.equal(u.searchParams.get('q'), 'Mauritshuis Den Haag')
    assert.equal(nep.vragen[0].init.headers['User-Agent'], 'Prikbord/1.0 (+https://github.com/oscardillewaard-ai/prikbord)')
    assert.match(data.bron, /OpenStreetMap/)
    // De eerste vijf, zonder de kapotte; alleen naam, adres en coördinaten (getallen).
    assert.deepEqual(data.plekken, [
      { naam: 'Mauritshuis', adres: 'Mauritshuis, 8, Plein, Centrum, Den Haag, Zuid-Holland, Nederland', lat: 52.0804049, lng: 4.3143911 },
      { naam: '', adres: 'Plein, Den Haag, Nederland', lat: 52.0796, lng: 4.3128 },
      { naam: 'Plek 0', adres: 'Plek 0', lat: 50, lng: 4 },
    ])
    // Dezelfde vraag (andere hoofdletters en spaties): uit het geheugen, Nominatim hoort niets.
    const nogEens = await vraag({}, '/zoek?q=%20mauritshuis%20%20den%20HAAG')
    assert.equal(nogEens.headers.get('X-Prikbord-Zoek'), 'geheugen')
    assert.deepEqual((await nogEens.json()).plekken, data.plekken)
    assert.equal(nep.vragen.length, 1)
  } finally {
    nep.terug()
  }
})

test('zoeken: ZOEKEN=uit zet het uit zonder app-update; Nominatim hoort niets', async () => {
  const nep = nepNominatim()
  try {
    for (const w of ['uit', 'UIT', ' uit ']) {
      const res = await vraag({ ZOEKEN: w }, '/zoek?q=Porto')
      assert.equal(res.status, 503)
      assert.deepEqual(await res.json(), { fout: 'Zoeken staat even uit', uit: true })
    }
    assert.equal(nep.vragen.length, 0)
    // De statuspagina zegt het ook.
    const kv = nepKv()
    assert.match(await (await vraag({ PRIKBORD: kv, ZOEKEN: 'uit' }, '/')).text(), /zoeken staat uit/i)
    assert.match(await (await vraag({ PRIKBORD: kv }, '/')).text(), /zoeken \(via Nominatim van OpenStreetMap\) staat aan/i)
  } finally {
    nep.terug()
  }
})

test('zoeken: alleen voor de app zelf, en 2 tot 200 tekens', async () => {
  const nep = nepNominatim()
  try {
    for (const origin of [null, 'https://kwaadwillig.example', 'https://oscardillewaard-ai.github.io.evil.nl']) {
      assert.equal((await vraag({}, '/zoek?q=Porto', { origin })).status, 403, String(origin))
    }
    for (const q of ['', 'a', '%20%20b%20', 'x'.repeat(201)]) assert.equal((await vraag({}, `/zoek?q=${q}`)).status, 400, q)
    assert.equal((await vraag({}, '/zoek?q=Porto', { methode: 'PUT', body: 'x' })).status, 405)
    assert.equal(nep.vragen.length, 0)
  } finally {
    nep.terug()
  }
})

test('zoeken: antwoorden gaan de Cache API in, en komen daar ook weer uit', async () => {
  const opgeslagen = new Map()
  globalThis.caches = {
    default: {
      match: async (sleutel) => opgeslagen.get(String(sleutel))?.clone(),
      put: async (sleutel, res) => void opgeslagen.set(String(sleutel), res),
    },
  }
  opgeslagen.set('https://prikbord-zoek.invalid/zoek?q=ribeira%20porto', Response.json({ plekken: [{ naam: 'Ribeira', adres: 'Ribeira, Porto', lat: 41.14, lng: -8.61 }] }))
  const nep = nepNominatim()
  try {
    const uitCache = await vraag({}, '/zoek?q=Ribeira%20Porto')
    assert.equal(uitCache.headers.get('X-Prikbord-Zoek'), 'cache')
    assert.equal((await uitCache.json()).plekken[0].naam, 'Ribeira')
    assert.equal(nep.vragen.length, 0)
    // Iets nieuws: naar Nominatim, en daarna in de cache (via waitUntil), een week lang.
    const wachten = []
    const res = await vraag({}, '/zoek?q=Livraria%20Lello', { ctx: { waitUntil: (p) => wachten.push(p) } })
    assert.equal(res.headers.get('X-Prikbord-Zoek'), 'nominatim')
    await Promise.all(wachten)
    const bewaard = opgeslagen.get('https://prikbord-zoek.invalid/zoek?q=livraria%20lello')
    assert.ok(bewaard, 'in de cache gezet')
    assert.equal(bewaard.headers.get('Cache-Control'), 'public, max-age=604800')
    assert.equal(nep.vragen.length, 1)
  } finally {
    nep.terug()
    delete globalThis.caches
  }
})

test('zoeken: minstens 1 seconde tussen twee vragen aan Nominatim; een lange rij krijgt "even druk"', async () => {
  const nep = nepNominatim()
  try {
    // Zes verschillende zoekopdrachten tegelijk: vier wachten netjes op hun beurt.
    const antwoorden = await Promise.all(['Delft', 'Leiden', 'Gouda', 'Utrecht', 'Breda', 'Zwolle'].map((q) => vraag({}, `/zoek?q=${q}`)))
    const statussen = antwoorden.map((r) => r.status)
    assert.deepEqual(statussen, [200, 200, 200, 200, 503, 503])
    assert.equal((await antwoorden[5].json()).opnieuw, true)
    assert.equal(nep.vragen.length, 4)
    for (let i = 1; i < nep.vragen.length; i++) {
      const tussen = nep.vragen[i].t - nep.vragen[i - 1].t
      assert.ok(tussen >= 990, `vraag ${i}: maar ${tussen} ms na de vorige`)
    }
  } finally {
    nep.terug()
  }
})

test('zoeken: Nominatim druk, onbereikbaar of onzin → een nette fout', async () => {
  let n = 0
  const nep = nepNominatim(() => {
    n++
    if (n === 1) return new Response('Too Many Requests', { status: 429 })
    if (n === 2) throw new TypeError('fetch failed')
    return new Response('<html>oeps</html>', { status: 200 })
  })
  try {
    const druk = await vraag({}, '/zoek?q=Eindhoven')
    assert.equal(druk.status, 503)
    assert.equal((await druk.json()).opnieuw, true)
    assert.equal((await vraag({}, '/zoek?q=Tilburg')).status, 502)
    assert.equal((await vraag({}, '/zoek?q=Arnhem')).status, 502)
    // Een fout wordt niet onthouden: de volgende keer gewoon opnieuw vragen.
    await vraag({}, '/zoek?q=Eindhoven')
    assert.equal(nep.vragen.length, 4)
  } finally {
    nep.terug()
  }
})
