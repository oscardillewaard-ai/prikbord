// Sync-server (Cloudflare Worker + KV) voor het Prikbord.
//
// Iedereen op een gedeeld bord heeft dezelfde groepscode. De app stuurt met
// PUT alleen de briefjes die veranderd zijn; de worker voegt ze per veld
// samen met wat er al lag (de jongste wijziging wint), bewaart het resultaat
// en stuurt de volledige stand terug, met `rev` (een hash van de opgeslagen
// stand). Met GET /bord/<code>?sinds=<rev> peilt de app: is er niets
// veranderd, dan antwoordt de worker kort { rev, ongewijzigd: true }.
//
// Neerzetten (gratis, ± 10 minuten):
// 1. Ga naar dash.cloudflare.com en log in (of maak gratis een account).
// 2. Opslag maken: Storage & Databases -> KV -> Create (namespace), noem hem
//    "prikbord". Gebruik NIET die van Parkenjacht: zo werkt de een gewoon
//    door als de ander stuk gaat.
// 3. Worker maken: Workers & Pages -> Create -> Worker (begin met "Hello
//    World"), noem hem "prikbord" en klik Deploy. Klik daarna "Edit code",
//    haal alles weg, plak dit hele bestand erin en klik Deploy.
// 4. Opslag koppelen: ga naar de worker -> Settings -> Bindings -> Add ->
//    KV namespace. Variable name: PRIKBORD, kies de namespace "prikbord" van
//    stap 2 en klik Deploy (of Save).
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
// De groepscode is het enige "wachtwoord": wie de koppel-link heeft, kan
// meekijken en prikken. De app maakt er per bord een lange, willekeurige van.
//
// Limieten van het gratis plan (per account, dus samen met Parkenjacht):
// 100.000 leesacties en 1.000 schrijfacties per dag, max. 1 schrijfactie per
// seconde op hetzelfde bord. De app bundelt wijzigingen 1,5 seconde en de
// worker schrijft alleen als er echt iets veranderd is.

import { schoonBord } from '../public/js/validate.js'
import { mergeBord } from '../public/js/merge.js'

const ORIGINS = ['https://oscardillewaard-ai.github.io']
const LOKAAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/
const MAX_PUT = 256 * 1024
const GROEP = /^[A-Za-z0-9_-]{16,64}$/
const REV = /^[A-Za-z0-9_-]{1,64}$/

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
  if (ORIGINS.includes(origin) || LOKAAL.test(origin)) h['Access-Control-Allow-Origin'] = origin
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
      '1. Maak een KV namespace (Storage & Databases -> KV -> Create), bijv. "prikbord".',
      '2. Ga naar deze worker -> Settings -> Bindings -> Add -> KV namespace.',
      '3. Variable name: PRIKBORD, kies de namespace van stap 1 en klik Deploy.',
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
      regels.push('', 'Klaar! Dit adres hoort in het Prikbord als adres van de sync-server.')
    } catch (err) {
      regels.push(`❌ Opslag gekoppeld, maar lezen lukt niet: ${err?.message || err}`)
    }
  }
  return new Response(regels.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
}

export default {
  async fetch(request, env) {
    const headers = cors(request)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    const url = new URL(request.url)
    if (url.pathname === '/' && request.method === 'GET') return statusPagina(env, url)
    const m = url.pathname.match(/^\/bord\/([^/]+)$/)
    if (!m || !GROEP.test(m[1])) return json({ fout: 'niet gevonden' }, 404, headers)
    const { kv } = vindKv(env)
    if (!kv) return json({ fout: 'Geen opslag gekoppeld aan de sync-server' }, 500, headers)
    const sleutel = `bord:${m[1]}`

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
