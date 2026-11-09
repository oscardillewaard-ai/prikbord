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
//
// ⚠️ Dit bestand is gemaakt met "npm run worker" uit proxy/prikbord-worker-kern.js,
// public/js/validate.js en public/js/merge.js. Pas die aan, niet dit bestand.

// De geplakte modules bevatten ook wat alleen de app gebruikt (bijv. importeer).
/* eslint-disable no-unused-vars */

// ---------- public/js/validate.js ----------
// Controleren en netjes maken van opgeslagen of binnengekomen gegevens (puur).
// Alles wat de app inleest (localStorage, back-up, later de sync) gaat hier
// doorheen. Wat niet klopt, valt weg in plaats van de app te laten vastlopen.
// De schoonmakers bouwen elk object opnieuw op in een vaste volgorde, zodat
// twee telefoons met dezelfde gegevens ook exact dezelfde JSON hebben.

const ID_RE = /^[A-Za-z0-9_-]{4,40}$/
// Groepscode van een gedeeld bord (M3): lang en willekeurig, het enige wachtwoord.
const GROEP_RE = /^[A-Za-z0-9_-]{16,64}$/
const MAX_TEKST = 500
const MAX_NOTITIE = 1000
const BORD_BREEDTE = 1000 // vrije plek in bordcoördinaten (M2)

// Velden van een briefje die elk een eigen tijdstempel hebben (§6.2).
const VELDEN = ['tekst', 'cat', 'link', 'foto', 'plek', 'vrij', 'stapel', 'gedaan']

// Papierkleuren als naam, niet als kleurcode: de stijl bepaalt de tint, zodat
// de inkt op elke kleur leesbaar blijft.
const PAPIER = ['zon', 'perzik', 'koraal', 'roze', 'lila', 'lucht', 'mint', 'salie', 'zand', 'wit']
// Kleuren van de punaise (wie het prikte).
const PUNAISE = ['rood', 'blauw', 'groen', 'geel', 'paars', 'oranje', 'roze', 'turkoois']

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x)
const isT = (t) => Number.isFinite(t) && t > 0 && t < 1e14
const isGetal = (x) => typeof x === 'number' && Number.isFinite(x)
const tekstTot = (max, min = 0) => (w) => (typeof w === 'string' && w.trim().length >= min ? w.slice(0, max) : undefined)
const binnen = (x, min, max) => isGetal(x) && x >= min && x <= max

// Telt echte tekens (een emoji met huidskleur is één teken).
function tekens(s) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) return [...new Intl.Segmenter('nl', { granularity: 'grapheme' }).segment(s)].length
  return [...s].length
}

function schoonLink(w) {
  if (typeof w !== 'string' || w.length > 2000) return undefined
  try {
    const u = new URL(w.trim())
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : undefined
  } catch {
    return undefined
  }
}

const datumRe = /^\d{4}-\d{2}-\d{2}$/
const ofNull = (f) => (w) => (w === null ? null : f(w))

// Per veld: geeft de schone waarde terug, of undefined als hij niet klopt.
// null betekent "leeggemaakt" en telt als geldige waarde (met tijdstempel).
const VELD_SCHOON = {
  tekst: tekstTot(MAX_TEKST),
  cat: (w) => (typeof w === 'string' && ID_RE.test(w) ? w : undefined),
  link: ofNull(schoonLink),
  foto: ofNull((w) => (typeof w === 'string' && ID_RE.test(w) ? w : undefined)),
  plek: ofNull((w) => {
    if (!isObj(w) || !binnen(w.lat, -90, 90) || !binnen(w.lng, -180, 180)) return undefined
    const p = { lat: w.lat, lng: w.lng }
    if (typeof w.naam === 'string' && w.naam) p.naam = w.naam.slice(0, 120)
    return p
  }),
  vrij: ofNull((w) => (isObj(w) && binnen(w.x, 0, BORD_BREEDTE) && binnen(w.y, 0, 100 * BORD_BREEDTE) ? { x: w.x, y: w.y } : undefined)),
  stapel: (w) => (isGetal(w) ? w : undefined),
  gedaan: ofNull((w) => {
    if (!isObj(w) || typeof w.datum !== 'string' || !datumRe.test(w.datum)) return undefined
    const g = { datum: w.datum }
    if (typeof w.notitie === 'string' && w.notitie) g.notitie = w.notitie.slice(0, MAX_NOTITIE)
    if (typeof w.foto === 'string' && ID_RE.test(w.foto)) g.foto = w.foto
    return g
  }),
}

// Ook gebruikt door de categorie-editor (model.js: zetCat).
const CAT_SCHOON = {
  naam: tekstTot(40, 1),
  emoji: (w) => (typeof w === 'string' && tekens(w) <= 2 && w.length <= 16 ? w : undefined),
  kleur: (w) => (PAPIER.includes(w) ? w : undefined),
  volg: (w) => (isGetal(w) ? w : undefined),
  verborgen: (w) => (typeof w === 'boolean' ? w : undefined),
}
const LID_SCHOON = {
  naam: tekstTot(40, 1),
  kleur: (w) => (PUNAISE.includes(w) ? w : undefined),
}
const INFO_SCHOON = {
  naam: tekstTot(60, 1),
  emoji: CAT_SCHOON.emoji,
}
const HART_SCHOON = (w) => (typeof w === 'boolean' ? w : undefined)

// Eén waarde met tijdstempel: { w, t }.
function schoonRegister(r, schoon) {
  if (!isObj(r) || !isT(r.t) || !('w' in r)) return null
  const w = schoon(r.w)
  return w === undefined ? null : { w, t: r.t }
}

// Een groepje registers met vaste veldnamen, gesorteerd op naam.
function schoonVelden(raw, schoners) {
  const uit = {}
  if (!isObj(raw)) return uit
  for (const k of Object.keys(schoners).sort()) {
    const r = schoonRegister(raw[k], schoners[k])
    if (r) uit[k] = r
  }
  return uit
}

// Een map van id → velden (categorieën, leden) of id → register (hartjes).
function schoonMap(raw, f) {
  const uit = {}
  if (!isObj(raw)) return uit
  for (const id of Object.keys(raw).sort()) {
    if (!ID_RE.test(id)) continue
    const v = f(raw[id])
    if (v) uit[id] = v
  }
  return uit
}

function schoonBriefje(raw, id = raw?.id) {
  if (!isObj(raw) || typeof id !== 'string' || !ID_RE.test(id) || raw.id !== id) return null
  if (typeof raw.door !== 'string' || !ID_RE.test(raw.door) || !isT(raw.gemaakt)) return null
  // Een grafsteen is definitief: dan bewaren we alleen nog wanneer.
  if (raw.weg !== undefined) return isT(raw.weg) ? { id, door: raw.door, gemaakt: raw.gemaakt, weg: raw.weg } : null
  return {
    id,
    door: raw.door,
    gemaakt: raw.gemaakt,
    v: schoonVelden(raw.v, VELD_SCHOON),
    hart: schoonMap(raw.hart, (r) => schoonRegister(r, HART_SCHOON)),
  }
}

function schoonBord(raw) {
  if (!isObj(raw) || typeof raw.id !== 'string' || !ID_RE.test(raw.id) || !isT(raw.gemaakt)) return null
  const briefjes = {}
  if (isObj(raw.briefjes)) {
    for (const id of Object.keys(raw.briefjes).sort()) {
      const b = schoonBriefje(raw.briefjes[id], id)
      if (b) briefjes[id] = b
    }
  }
  return {
    id: raw.id,
    gemaakt: raw.gemaakt,
    info: schoonVelden(raw.info, INFO_SCHOON),
    cats: schoonMap(raw.cats, (c) => schoonVelden(c, CAT_SCHOON)),
    leden: schoonMap(raw.leden, (l) => schoonVelden(l, LID_SCHOON)),
    briefjes,
  }
}

// Instellingen die alleen bij deze telefoon horen (niet gesynchroniseerd).
function schoonApparaat(raw, borden) {
  const a = isObj(raw) ? raw : {}
  const perBord = (m, f) => {
    const uit = {}
    if (isObj(m)) for (const id of Object.keys(m).sort()) if (borden[id] && f(m[id])) uit[id] = m[id]
    return uit
  }
  let concept = null
  if (isObj(a.concept) && typeof a.concept.tekst === 'string' && borden[a.concept.bord]) {
    concept = { bord: a.concept.bord, tekst: a.concept.tekst.slice(0, MAX_TEKST) }
    if (typeof a.concept.cat === 'string' && ID_RE.test(a.concept.cat)) concept.cat = a.concept.cat
    if (typeof a.concept.id === 'string' && ID_RE.test(a.concept.id)) concept.id = a.concept.id
    concept.nieuw = a.concept.nieuw !== false
  }
  return {
    geluid: typeof a.geluid === 'boolean' ? a.geluid : true,
    seenVersion: isGetal(a.seenVersion) ? a.seenVersion : 0,
    ik: perBord(a.ik, (v) => typeof v === 'string' && ID_RE.test(v)),
    weergave: perBord(a.weergave, (v) => v === 'netjes' || v === 'vrij'),
    sorteer: perBord(a.sorteer, (v) => v === 'nieuw' || v === 'hartjes'),
    laatsteCat: perBord(a.laatsteCat, (v) => typeof v === 'string' && ID_RE.test(v)),
    // Briefjes van anderen die deze telefoon nog niet zag (het nieuw-stickertje, M3).
    nieuw: perBordLijst(a.nieuw, borden),
    concept,
    laatsteBackup: isT(a.laatsteBackup) ? a.laatsteBackup : 0,
    // De naam die je bij de eerste start koos ("Wie ben jij?"); '' = nog niet gekozen.
    naam: typeof a.naam === 'string' ? a.naam.trim().slice(0, 40) : '',
  }
}

// Per bord een lijstje briefje-id's (zonder dubbele, hooguit 500).
function perBordLijst(m, borden) {
  const uit = {}
  if (!isObj(m)) return uit
  for (const id of Object.keys(m).sort()) {
    if (!borden[id] || !Array.isArray(m[id])) continue
    const ids = [...new Set(m[id].filter((x) => typeof x === 'string' && ID_RE.test(x)))].slice(0, 500)
    if (ids.length) uit[id] = ids
  }
  return uit
}

// De hele opgeslagen stand. Geeft null terug als er niets bruikbaars in zit;
// de app begint dan met een vers bord.
function schoonStaat(raw) {
  if (!isObj(raw) || raw.v !== 1 || !isObj(raw.borden)) return null
  const borden = {}
  for (const id of Object.keys(raw.borden).sort()) {
    const b = schoonBord(raw.borden[id])
    if (b && b.id === id) borden[id] = b
  }
  const ids = Object.keys(borden)
  if (!ids.length) return null
  return {
    v: 1,
    bord: borden[raw.bord] ? raw.bord : ids[0],
    borden,
    apparaat: schoonApparaat(raw.apparaat, borden),
  }
}

// ---------- Samen (M3) ----------
// De koppelingen staan onder een eigen sleutel (prikbord.sync), buiten de
// back-up (§4.1, regel 11): de groepscode is het wachtwoord van een bord.

// Adres van een sync-server: https, of http op deze computer (om te testen).
function schoonAdres(w) {
  const url = String(w ?? '').trim().replace(/\/+$/, '')
  if (url.length > 300) return ''
  return /^https:\/\/[^\s/?#]+(\/[^\s?#]*)?$/.test(url) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(url) ? url : ''
}

// { url, borden: { bordId: { u, r } } }: u = adres van de sync-server, r = groepscode.
function schoonSync(raw) {
  const s = isObj(raw) ? raw : {}
  const borden = {}
  if (isObj(s.borden)) {
    for (const id of Object.keys(s.borden).sort()) {
      const k = s.borden[id]
      if (!ID_RE.test(id) || !isObj(k)) continue
      const u = schoonAdres(k.u)
      if (u && typeof k.r === 'string' && GROEP_RE.test(k.r)) borden[id] = { u, r: k.r }
    }
  }
  return { url: schoonAdres(s.url), borden }
}

// ---------- public/js/merge.js ----------
// Samenvoegen van twee standen van een bord (puur).
// Per veld wint de jongste wijziging (§6.3), niet per briefje: geeft de een
// een hartje terwijl de ander de tekst aanpast, dan blijven beide bewaard.
// Bij een gelijk tijdstip kiezen we vast op de JSON van de waarde, zodat elke
// telefoon hetzelfde kiest. Daardoor is samenvoegen commutatief, associatief
// en idempotent (zie tests/merge.test.mjs).
//
// Verwacht schone invoer (validate.js): objecten in vaste volgorde.

const sleutel = (w) => JSON.stringify(w) ?? ''

function mergeRegister(a, b) {
  if (!a) return b || null
  if (!b) return a
  if (a.t !== b.t) return a.t > b.t ? a : b
  return sleutel(a.w) >= sleutel(b.w) ? a : b
}

// Twee objecten met registers ({ veld: { w, t } }), sleutels op volgorde.
function mergeVelden(a = {}, b = {}) {
  const uit = {}
  for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    const r = mergeRegister(a[k], b[k])
    if (r) uit[k] = r
  }
  return uit
}

function mergeMap(a = {}, b = {}, f) {
  const uit = {}
  for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    uit[k] = a[k] && b[k] ? f(a[k], b[k]) : a[k] || b[k]
  }
  return uit
}

// Maker en tijdstip veranderen nooit. Mochten ze toch verschillen (dat hoort
// niet), dan kiezen we vast het vroegste.
const eerste = (a, b) => (a.gemaakt !== b.gemaakt ? (a.gemaakt < b.gemaakt ? a : b) : a.door <= b.door ? a : b)

function mergeBriefje(a, b) {
  if (!a) return b || null
  if (!b) return a
  const { id } = a
  const { door, gemaakt } = eerste(a, b)
  // Een grafsteen wint van elke bewerking (§6.2).
  const weg = Math.max(a.weg || 0, b.weg || 0)
  if (weg) return { id, door, gemaakt, weg }
  return { id, door, gemaakt, v: mergeVelden(a.v, b.v), hart: mergeVelden(a.hart, b.hart) }
}

function mergeBord(a, b) {
  if (!a) return b || null
  if (!b) return a
  return {
    id: a.id,
    gemaakt: Math.min(a.gemaakt, b.gemaakt),
    info: mergeVelden(a.info, b.info),
    cats: mergeMap(a.cats, b.cats, mergeVelden),
    leden: mergeMap(a.leden, b.leden, mergeVelden),
    briefjes: mergeMap(a.briefjes, b.briefjes, mergeBriefje),
  }
}

// Een back-up samenvoegen met de eigen stand (§4.2: importeren voegt samen).
// Borden met hetzelfde id worden samengevoegd, nieuwe borden komen erbij.
// Instellingen van de telefoon zelf (apparaat) blijven van deze telefoon,
// behalve "wie ben ik" op een bord dat hier nog niet stond.
// Geeft { staat, nieuweBorden, nieuweBriefjes } terug.
function importeer(staat, backup) {
  const borden = { ...staat.borden }
  const ik = { ...staat.apparaat.ik }
  let nieuweBorden = 0
  let nieuweBriefjes = 0
  for (const [id, bord] of Object.entries(backup.borden)) {
    const eigen = borden[id]
    if (!eigen) {
      nieuweBorden++
      if (backup.apparaat?.ik?.[id]) ik[id] = backup.apparaat.ik[id]
    }
    const samen = mergeBord(eigen, bord)
    for (const bid of Object.keys(samen.briefjes)) {
      if (!eigen?.briefjes[bid] && !samen.briefjes[bid].weg) nieuweBriefjes++
    }
    borden[id] = samen
  }
  const gesorteerd = Object.fromEntries(Object.keys(borden).sort().map((k) => [k, borden[k]]))
  return { staat: { ...staat, borden: gesorteerd, apparaat: { ...staat.apparaat, ik } }, nieuweBorden, nieuweBriefjes }
}

/* eslint-enable no-unused-vars */

// ---------- de worker ----------
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
