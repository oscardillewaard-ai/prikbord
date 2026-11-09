// Sync-server (Cloudflare Worker + KV) voor het Prikbord.
//
// Iedereen op een gedeeld bord heeft dezelfde groepscode. De app stuurt met
// PUT alleen de briefjes die veranderd zijn; de worker voegt ze per veld
// samen met wat er al lag (de jongste wijziging wint), bewaart het resultaat
// en stuurt de volledige stand terug, met `rev` (een hash van de opgeslagen
// stand). Met GET /bord/<code>?sinds=<rev> peilt de app: is er niets
// veranderd, dan antwoordt de worker kort { rev, ongewijzigd: true }.
//
// Foto's (M4): PUT en GET /bord/<code>/foto/<id>, één KV-sleutel per foto
// (niet in de bordstand). Hooguit 1,5 MB, alleen jpeg, png of webp. Een
// foto-id wordt nooit hergebruikt, dus de browser mag hem een jaar bewaren.
//
// Plekken zoeken (M4): GET /zoek?q=… vraagt het aan Nominatim, de zoekdienst
// van OpenStreetMap, met een eigen User-Agent, hooguit één keer per seconde,
// en onthoudt de antwoorden (Cache API, niet in KV: schrijfacties zijn
// schaars). Uitzetten zonder app-update: zie "Zoeken uitzetten" hieronder.
//
// Neerzetten (gratis, ± 10 minuten; knoppen nagelezen in de docs van
// Cloudflare op 9 nov 2026):
// 1. Ga naar dash.cloudflare.com en log in (of maak gratis een account).
// 2. Opslag maken: ga naar Workers KV
//    (https://dash.cloudflare.com/?to=/:account/workers/kv/namespaces)
//    -> Create instance, noem hem "prikbord" -> Create. Gebruik
//    NIET die van Parkenjacht: zo werkt de een gewoon door als de ander stuk
//    gaat. (Kies geen "KV Instant", dat is een bèta die we niet nodig hebben.)
// 3. Worker maken: Workers & Pages -> Create application -> Start with Hello
//    World! -> Get started, noem hem "prikbord" en klik Deploy. Open daarna
//    de code-editor ("Edit code"), haal alles weg, plak dit hele bestand erin
//    en klik Deploy.
// 4. Opslag koppelen: open de worker -> tabblad Bindings -> Add binding ->
//    KV namespace -> Add binding. Variable name: PRIKBORD, kies de namespace
//    "prikbord" van stap 2 en klik Add binding.
// 5. Controleren: open het adres van de worker in je browser (bijv.
//    https://prikbord.<jouw-naam>.workers.dev). Daar staat in gewone taal of
//    alles klopt. Wil je ook zien dat schrijven lukt? Zet ?schrijftest=1
//    achter het adres (dat kost één van de 1.000 schrijfacties per dag).
// 6. Klaar: geef het adres van de worker door, dan komt het als
//    DEFAULT_SYNC_URL in public/js/app.js. Tot die tijd kun je het adres in
//    de app invullen als je een bord deelt.
//
// Later bijwerken: open de worker -> Edit code, plak de nieuwe versie van dit
// bestand en Deploy. De briefjes in KV blijven gewoon staan.
//
// Zoeken uitzetten (bijv. als Nominatim erom vraagt): open de worker ->
// Settings -> Variables and Secrets -> Add. Type: Text, Variable name:
// ZOEKEN, Value: uit -> Deploy. In de app zoek je dan niet meer op naam;
// tikken op de kaart, "Mijn locatie" en een link plakken werken gewoon.
// Weer aanzetten: de variabele weghalen (of op "aan" zetten) en Deploy.
//
// De groepscode is het enige "wachtwoord": wie de koppel-link heeft, kan
// meekijken en prikken. De app maakt er per bord een lange, willekeurige van.
//
// Limieten van het gratis plan (per account, dus samen met Parkenjacht):
// 100.000 leesacties en 1.000 schrijfacties per dag, max. 1 schrijfactie per
// seconde op hetzelfde bord. De app bundelt wijzigingen 1,5 seconde en de
// worker schrijft alleen als er echt iets veranderd is. Elke foto kost één
// schrijfactie.

import { schoonBord, ID_RE, MAX_FOTO, FOTO_TYPES, fotoSoort } from '../public/js/validate.js'
import { mergeBord } from '../public/js/merge.js'

const ORIGINS = ['https://oscardillewaard-ai.github.io']
const LOKAAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/
const MAX_PUT = 256 * 1024
const GROEP = /^[A-Za-z0-9_-]{16,64}$/
const REV = /^[A-Za-z0-9_-]{1,64}$/
const toegestaan = (origin) => ORIGINS.includes(origin) || LOKAAL.test(origin)

// Nominatim (§6.5): de gebruiksregels staan op
// https://operations.osmfoundation.org/policies/nominatim/
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'Prikbord/1.0 (+https://github.com/oscardillewaard-ai/prikbord)'
const ZOEK_PAUZE_MS = 1000 // minstens zo lang tussen twee vragen aan Nominatim
const ZOEK_MAX_RIJ = 4 // zoveel zoekopdrachten mogen wachten; daarna "even druk"
const ZOEK_BEWAAR_S = 7 * 24 * 3600 // zo lang onthouden we een antwoord

// CORS alleen voor de app zelf en voor localhost (om te testen). Andere sites
// krijgen geen toestemming, dus hun browser laat ze het antwoord niet lezen.
function cors(request) {
  const origin = request.headers.get('Origin') || ''
  const h = {
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
  if (toegestaan(origin)) h['Access-Control-Allow-Origin'] = origin
  return h
}

// De opslag zoeken: bij voorkeur de binding PRIKBORD, anders de eerste
// KV-binding die er is (scheelt gedoe als de naam net anders is getypt).
function vindKv(env) {
  if (env?.PRIKBORD) return { kv: env.PRIKBORD, naam: 'PRIKBORD' }
  const gevonden = Object.entries(env || {}).find(([, v]) => v && ['get', 'put', 'getWithMetadata'].every((f) => typeof v[f] === 'function'))
  return gevonden ? { kv: gevonden[1], naam: gevonden[0] } : { kv: null, naam: '' }
}

const json = (data, status, headers, extra = {}) =>
  new Response(typeof data === 'string' ? data : JSON.stringify(data), {
    status,
    headers: { ...headers, ...extra, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })

// rev = hash van de opgeslagen stand (geen teller, zie public/js/sync.js).
async function hash(tekst) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tekst))
  return btoa(String.fromCharCode(...new Uint8Array(buf)).slice(0, 16))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// De opgeslagen stand als tekst, met de rev uit de metadata (die wordt in
// dezelfde schrijfactie bewaard, dus hij hoort altijd bij precies deze tekst).
async function leesBord(kv, sleutel) {
  const { value, metadata } = await kv.getWithMetadata(sleutel, 'text')
  if (!value) return { tekst: null, rev: null }
  const rev = typeof metadata?.rev === 'string' && REV.test(metadata.rev) ? metadata.rev : await hash(value)
  return { tekst: value, rev }
}

const druk = (headers) => json({ fout: 'Even druk, probeer het zo opnieuw', opnieuw: true }, 503, headers, { 'Retry-After': '1' })
const zoekenUit = (env) => String(env?.ZOEKEN ?? '').trim().toLowerCase() === 'uit'

// ---------- Foto's (§6.4) ----------

async function foto(request, kv, code, id, headers) {
  const sleutel = `foto:${code}:${id}`
  if (request.method === 'GET') {
    let gevonden
    try {
      gevonden = await kv.getWithMetadata(sleutel, { type: 'arrayBuffer' })
    } catch {
      return druk(headers)
    }
    if (!gevonden?.value) return json({ fout: 'foto niet gevonden' }, 404, headers)
    const bytes = new Uint8Array(gevonden.value)
    const type = FOTO_TYPES.includes(gevonden.metadata?.type) ? gevonden.metadata.type : fotoSoort(bytes) || 'application/octet-stream'
    return new Response(bytes, {
      headers: {
        ...headers,
        'Content-Type': type,
        // Een foto-id wordt nooit hergebruikt: de foto verandert nooit meer.
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }
  if (request.method !== 'PUT') return json({ fout: 'methode niet toegestaan' }, 405, headers)
  const type = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase()
  if (!FOTO_TYPES.includes(type)) return json({ fout: 'alleen foto’s in jpeg, png of webp' }, 415, headers)
  if (Number(request.headers.get('Content-Length')) > MAX_FOTO) return json({ fout: 'foto te groot (max. 1,5 MB)' }, 413, headers)
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.length > MAX_FOTO) return json({ fout: 'foto te groot (max. 1,5 MB)' }, 413, headers)
  // Wat de afzender zegt, moet kloppen met de bytes zelf.
  if (fotoSoort(bytes) !== type) return json({ fout: 'dit bestand is geen foto in jpeg, png of webp' }, 415, headers)
  try {
    // Stond hij er al (een upload die opnieuw kwam na een time-out)? Dan
    // niet nog eens schrijven: schrijfacties zijn schaars.
    const al = await kv.getWithMetadata(sleutel, { type: 'arrayBuffer' })
    if (al?.value) return json({ ok: true, al: true }, 200, headers)
    await kv.put(sleutel, bytes, { metadata: { type } })
  } catch {
    return druk(headers)
  }
  return json({ ok: true }, 200, headers)
}

// ---------- Plekken zoeken (§6.5) ----------
// Nooit terwijl je typt (de app vraagt alleen na een tik op de zoekknop),
// hooguit één vraag per seconde aan Nominatim, en elk antwoord onthouden.
// Let op: de rij en het geheugen hieronder gelden per worker-exemplaar.
// Cloudflare kan op verschillende plekken in de wereld tegelijk een exemplaar
// draaien; voor een paar mensen die af en toe zoeken maakt dat niets uit.

const geheugen = new Map() // zoekterm → { t, tekst }
let laatsteVraag = 0
let rij = Promise.resolve()
let inRij = 0

// Op je beurt wachten: minstens ZOEK_PAUZE_MS na de vorige vraag. Staan er
// al ZOEK_MAX_RIJ te wachten, dan meteen "even druk" (hooguit ± 4 s wachten).
function beurt() {
  if (inRij >= ZOEK_MAX_RIJ) return Promise.reject(new Error('te druk'))
  inRij++
  const mijn = rij
    .then(async () => {
      const wacht = laatsteVraag + ZOEK_PAUZE_MS - Date.now()
      if (wacht > 0) await new Promise((ok) => setTimeout(ok, wacht))
      laatsteVraag = Date.now()
    })
    .finally(() => inRij--)
  rij = mijn.catch(() => {})
  return mijn
}

const cacheSleutel = (term) => `https://prikbord-zoek.invalid/zoek?q=${encodeURIComponent(term)}`
const cacheApi = () => (typeof caches !== 'undefined' && caches.default ? caches.default : null)

// Alleen wat de app nodig heeft: naam, adres en coördinaten (hooguit 5).
function netjes(data) {
  const plekken = []
  for (const r of Array.isArray(data) ? data.slice(0, 5) : []) {
    const lat = Number(r?.lat)
    const lng = Number(r?.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue
    plekken.push({
      naam: typeof r.name === 'string' ? r.name.slice(0, 120) : '',
      adres: typeof r.display_name === 'string' ? r.display_name.slice(0, 250) : '',
      lat,
      lng,
    })
  }
  return { plekken, bron: 'Data © OpenStreetMap-bijdragers (ODbL), via Nominatim' }
}

async function zoek(request, env, ctx, url, headers) {
  if (request.method !== 'GET') return json({ fout: 'methode niet toegestaan' }, 405, headers)
  // Alleen voor de app zelf: anders kan elke site zijn bezoekers via deze
  // worker bij Nominatim laten zoeken (CORS houdt alleen het lezen tegen).
  if (!toegestaan(request.headers.get('Origin') || '')) return json({ fout: 'alleen voor het Prikbord' }, 403, headers)
  if (zoekenUit(env)) return json({ fout: 'Zoeken staat even uit', uit: true }, 503, headers)
  const q = (url.searchParams.get('q') || '').replace(/\s+/g, ' ').trim()
  if (q.length < 2 || q.length > 200) return json({ fout: 'zoek op 2 tot 200 tekens' }, 400, headers)
  const term = q.toLowerCase()
  const klaar = (tekst, bron) => json(tekst, 200, headers, { 'X-Prikbord-Zoek': bron })

  // 1. In het geheugen van dit exemplaar.
  const onthouden = geheugen.get(term)
  if (onthouden && Date.now() - onthouden.t < ZOEK_BEWAAR_S * 1000) return klaar(onthouden.tekst, 'geheugen')
  // 2. In de cache van Cloudflare (werkt niet in de editor van het dashboard).
  const cache = cacheApi()
  try {
    const hit = cache && (await cache.match(cacheSleutel(term)))
    if (hit) {
      const tekst = await hit.text()
      geheugen.set(term, { t: Date.now(), tekst })
      return klaar(tekst, 'cache')
    }
  } catch {
    // Geen cache: dan gewoon vragen.
  }
  // 3. Aan Nominatim, op onze beurt.
  try {
    await beurt()
  } catch {
    return json({ fout: 'Even druk, probeer het zo opnieuw', opnieuw: true }, 503, headers, { 'Retry-After': '2' })
  }
  let res
  try {
    const vraag = `${NOMINATIM}?format=jsonv2&limit=5&accept-language=nl&q=${encodeURIComponent(q)}`
    res = await fetch(vraag, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } })
  } catch {
    return json({ fout: 'De zoekdienst is niet bereikbaar' }, 502, headers)
  }
  if (res.status === 429 || res.status === 503) return json({ fout: 'De zoekdienst is even druk', opnieuw: true }, 503, headers, { 'Retry-After': '5' })
  if (!res.ok) return json({ fout: `De zoekdienst gaf fout ${res.status}` }, 502, headers)
  let data
  try {
    data = await res.json()
  } catch {
    return json({ fout: 'Onverwacht antwoord van de zoekdienst' }, 502, headers)
  }
  const tekst = JSON.stringify(netjes(data))
  if (geheugen.size >= 200) geheugen.delete(geheugen.keys().next().value)
  geheugen.set(term, { t: Date.now(), tekst })
  if (cache) {
    const bewaar = cache
      .put(cacheSleutel(term), new Response(tekst, { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${ZOEK_BEWAAR_S}` } }))
      .catch(() => {})
    if (ctx?.waitUntil) ctx.waitUntil(bewaar)
    else await bewaar
  }
  return klaar(tekst, 'nominatim')
}

// Statuspagina op het hoofdadres, in gewone taal. Controleert de opslag met
// een leesactie; schrijven alleen op ?schrijftest=1 (schrijfacties zijn
// schaars, zie docs/prikbord-afwijkingen.md, A2).
async function statusPagina(env, url) {
  const { kv, naam } = vindKv(env)
  const regels = ['Prikbord sync-server 📌', '', '✅ De worker draait.']
  if (!kv) {
    regels.push(
      '❌ Er is nog geen opslag gekoppeld.',
      '',
      'Zo los je het op:',
      '1. Maak opslag: Workers KV -> Create instance, noem hem "prikbord" -> Create.',
      '2. Open deze worker -> tabblad Bindings -> Add binding -> KV namespace -> Add binding.',
      '3. Variable name: PRIKBORD, kies de namespace "prikbord" van stap 1 en klik Add binding.',
      '4. Ververs deze pagina.',
    )
  } else {
    try {
      await kv.get('gezondheid')
      regels.push(`✅ De opslag is gekoppeld (${naam}) en lezen lukt.`)
      if (naam !== 'PRIKBORD') regels.push(`⚠️ De koppeling heet ${naam} in plaats van PRIKBORD. Dat werkt ook, als het maar de namespace van het Prikbord is en niet die van Parkenjacht.`)
      if (url.searchParams.has('schrijftest')) {
        try {
          await kv.put('gezondheid', String(Date.now()))
          regels.push('✅ Schrijven lukt ook.')
        } catch (err) {
          regels.push(`❌ Schrijven lukt niet: ${err?.message || err}`)
        }
      } else regels.push('   Schrijven testen? Zet ?schrijftest=1 achter dit adres.')
      regels.push(
        zoekenUit(env)
          ? '⏸️ Plekken zoeken staat uit (ZOEKEN = uit). Tikken op de kaart, "Mijn locatie" en een link plakken werken gewoon.'
          : '✅ Plekken zoeken (via Nominatim van OpenStreetMap) staat aan. Uitzetten: Settings -> Variables and Secrets -> ZOEKEN = uit.',
      )
      regels.push('', 'Klaar! Dit adres hoort in het Prikbord als adres van de sync-server.')
    } catch (err) {
      regels.push(`❌ Opslag gekoppeld, maar lezen lukt niet: ${err?.message || err}`)
    }
  }
  return new Response(regels.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
}

export default {
  async fetch(request, env, ctx) {
    const headers = cors(request)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    const url = new URL(request.url)
    if (url.pathname === '/' && request.method === 'GET') return statusPagina(env, url)
    if (url.pathname === '/zoek') return zoek(request, env, ctx, url, headers)
    const f = url.pathname.match(/^\/bord\/([^/]+)\/foto\/([^/]+)$/)
    const m = url.pathname.match(/^\/bord\/([^/]+)$/)
    const code = (f || m)?.[1]
    if (!code || !GROEP.test(code) || (f && !ID_RE.test(f[2]))) return json({ fout: 'niet gevonden' }, 404, headers)
    const { kv } = vindKv(env)
    if (!kv) return json({ fout: 'Geen opslag gekoppeld aan de sync-server' }, 500, headers)
    if (f) return foto(request, kv, code, f[2], headers)
    const sleutel = `bord:${code}`

    if (request.method === 'GET') {
      let opgeslagen
      try {
        opgeslagen = await leesBord(kv, sleutel)
      } catch {
        return druk(headers)
      }
      const { tekst, rev } = opgeslagen
      if (!tekst) return json({ rev: null, bord: null }, 200, headers)
      const sinds = url.searchParams.get('sinds')
      if (sinds && REV.test(sinds) && sinds === rev) return json({ rev, ongewijzigd: true }, 200, headers)
      // De stand is bij het schrijven al gecontroleerd: zonder uitpakken terugsturen.
      return json(`{"rev":${JSON.stringify(rev)},"bord":${tekst}}`, 200, headers)
    }

    if (request.method === 'PUT') {
      const body = await request.text()
      if (new TextEncoder().encode(body).length > MAX_PUT) return json({ fout: 'te groot (max. 256 KB)' }, 413, headers)
      let binnen
      try {
        binnen = schoonBord(JSON.parse(body)?.bord)
      } catch {
        binnen = null
      }
      if (!binnen) return json({ fout: 'ongeldig bord' }, 400, headers)
      let opgeslagen
      try {
        opgeslagen = await leesBord(kv, sleutel)
      } catch {
        return druk(headers)
      }
      let oud = null
      try {
        oud = opgeslagen.tekst ? schoonBord(JSON.parse(opgeslagen.tekst)) : null
      } catch {
        oud = null
      }
      // Eén groepscode hoort bij precies één bord.
      if (oud && oud.id !== binnen.id) return json({ fout: 'deze groepscode hoort bij een ander bord' }, 409, headers)
      const tekst = JSON.stringify(mergeBord(oud, binnen))
      // Niets nieuws? Dan ook niet schrijven (schrijfacties zijn schaars).
      if (tekst === opgeslagen.tekst) return json(`{"rev":${JSON.stringify(opgeslagen.rev)},"bord":${tekst}}`, 200, headers)
      const rev = await hash(tekst)
      try {
        await kv.put(sleutel, tekst, { metadata: { rev } })
      } catch {
        // Bijv. twee schrijfacties binnen een seconde op hetzelfde bord. De
        // app probeert het na een korte, willekeurige pauze opnieuw.
        return druk(headers)
      }
      return json(`{"rev":${JSON.stringify(rev)},"bord":${tekst}}`, 200, headers)
    }

    return json({ fout: 'methode niet toegestaan' }, 405, headers)
  },
}
