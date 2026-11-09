// Samen synchroniseren (§6.3). Geen DOM en geen opslag: fetch, de opslag en
// de tijd komen van buiten (app.js), zodat precies deze code ook in Node
// draait, in de convergentietest (tests/convergentie.test.mjs).
//
// Zo werkt het, per bord:
// - De motor onthoudt de laatste stand die hij van de server kreeg (`cache`).
// - Wat de telefoon nieuwer heeft dan die stand, is "gewijzigd" (`verschil`).
//   Er is dus geen vlag die kwijt kan raken: na elk antwoord wordt het
//   verschil opnieuw uitgerekend, ook na een herstart (dan eerst de volledige
//   stand ophalen).
// - Iets gewijzigd: PUT met alleen de gewijzigde briefjes (in delen onder de
//   256 KB). De worker voegt samen en geeft de volledige stand plus `rev`.
// - Niets gewijzigd: peilen met GET ?sinds=<rev>. De worker zegt kort
//   "ongewijzigd", of geeft de volledige stand.
// - Na elk antwoord: samenvoegen met de eigen stand. Heeft de telefoon dan
//   nog steeds iets nieuwers dan de server (KV raakte een gelijktijdige
//   schrijfactie kwijt), dan opnieuw sturen, max. 3 keer per ronde.
// `rev` is een hash van de opgeslagen stand, geen teller: is de schrijfactie
// van deze telefoon overschreven, dan klopt de hash niet meer en komt bij het
// volgende peilen de volledige stand terug, zonder die wijziging. Dan gaat
// hij vanzelf opnieuw mee.

import { mergeBord, mergeBriefje, mergeVelden } from './merge.js'
import { schoonBord, schoonAdres, GROEP_RE } from './validate.js'

export const BUNDEL_MS = 1500 // wijzigingen zo lang bundelen voor ze vertrekken
export const BUNDEL_MAX_MS = 6000 // maar nooit langer wachten dan dit
export const PEIL_SNEL_MS = 10_000 // peilen als er de laatste 5 minuten iets gebeurde
export const PEIL_RUSTIG_MS = 30_000 // en anders
export const ACTIEF_MS = 5 * 60_000
export const OPNIEUW_MAX = 3 // zo vaak opnieuw sturen per ronde (zoals Parkenjacht)
export const MAX_PUT = 200 * 1024 // bytes per PUT; de worker weigert boven de 256 KB
export const PUT_PAUZE_MS = 1100 // KV: max. 1 schrijfactie per seconde op dezelfde sleutel

const J = JSON.stringify
const bytes = (s) => new TextEncoder().encode(s).length
const REV_RE = /^[A-Za-z0-9_-]{1,64}$/

// Hoe lang tot de volgende peiling van het actieve bord.
export const peilInterval = (nu, laatsteActiviteit) => (nu - laatsteActiviteit < ACTIEF_MS ? PEIL_SNEL_MS : PEIL_RUSTIG_MS)

// ---------- Wat moet er naar de server? ----------

const leegDeel = (bord) => ({ id: bord.id, gemaakt: bord.gemaakt, info: {}, cats: {}, leden: {}, briefjes: {} })

// Alles wat `lokaal` nieuwer heeft dan `server` (null = de server heeft nog
// niets), als deel-bord met hele briefjes, categorieën en leden. De worker
// voegt per veld samen, dus een heel briefje sturen is veilig. Geeft null
// terug als de server alles al heeft.
export function verschil(lokaal, server) {
  if (!lokaal) return null
  const s = server || { info: {}, cats: {}, leden: {}, briefjes: {}, gemaakt: Infinity }
  const deel = leegDeel(lokaal)
  let iets = !server || lokaal.gemaakt < s.gemaakt
  if (J(mergeVelden(lokaal.info, s.info)) !== J(s.info)) {
    deel.info = lokaal.info
    iets = true
  }
  for (const soort of ['cats', 'leden']) {
    for (const [id, velden] of Object.entries(lokaal[soort])) {
      const daar = s[soort][id]
      if (!daar || J(mergeVelden(velden, daar)) !== J(daar)) {
        deel[soort][id] = velden
        iets = true
      }
    }
  }
  for (const [id, b] of Object.entries(lokaal.briefjes)) {
    const daar = s.briefjes[id]
    if (!daar || J(mergeBriefje(b, daar)) !== J(daar)) {
      deel.briefjes[id] = b
      iets = true
    }
  }
  return iets ? deel : null
}

// Een groot deel-bord opknippen in stukken van hooguit `max` bytes (als
// {"bord": …}). Bijvoorbeeld de eerste keer delen, of de eerste sleepbeweging
// op een vol bord (dan krijgt elk briefje een vaste plek).
export function inDelen(deel, max = MAX_PUT) {
  if (bytes(J({ bord: deel })) <= max) return [deel]
  const delen = []
  let stuk = { ...leegDeel(deel), info: deel.info, cats: deel.cats, leden: deel.leden }
  let grootte = bytes(J({ bord: stuk }))
  for (const [id, b] of Object.entries(deel.briefjes)) {
    const erbij = bytes(J(b)) + bytes(J(id)) + 2
    if (grootte + erbij > max && Object.keys(stuk.briefjes).length) {
      delen.push(stuk)
      stuk = leegDeel(deel)
      grootte = bytes(J({ bord: stuk }))
    }
    stuk.briefjes[id] = b
    grootte += erbij
  }
  delen.push(stuk)
  return delen
}

// ---------- Groepscode en koppel-link (§5.1) ----------

const naarB64url = (str) => {
  let bin = ''
  for (const b of new TextEncoder().encode(str)) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const vanB64url = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)))

// Lange, willekeurige groepscode (zoals Parkenjacht): 18 bytes = 24 tekens.
export function nieuweCode() {
  const b = globalThis.crypto.getRandomValues(new Uint8Array(18))
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// …/prikbord/#koppel=<base64url van { u, r, n }>: adres van de sync-server,
// groepscode en bordnaam.
export function maakKoppel(basis, { u, r, n }) {
  return `${basis}#koppel=${naarB64url(J({ u, r, n: String(n ?? '').slice(0, 60) }))}`
}

// Leest een koppel-link, ook als hij midden in een bericht staat ("Doe je
// mee? https://…#koppel=…"). Geeft { u, r, n } terug, of null als hij niet klopt.
export function leesKoppel(tekst) {
  const m = String(tekst ?? '').match(/koppel=([A-Za-z0-9_-]+)/)
  if (!m) return null
  let data
  try {
    data = JSON.parse(vanB64url(m[1]))
  } catch {
    return null
  }
  const u = schoonAdres(data?.u)
  if (!u || typeof data.r !== 'string' || !GROEP_RE.test(data.r)) return null
  const n = typeof data.n === 'string' && data.n.trim() ? data.n.trim().slice(0, 60) : 'Prikbord'
  return { u, r: data.r, n }
}

// ---------- De sync-motor ----------
// lees(bordId) → het bord zoals het nu op de telefoon staat (of undefined)
// schrijf(bordId, samen, oud) → de samengevoegde stand bewaren (alleen als er iets veranderde)
// adres(bordId) → { u, r } of null (niet gedeeld)
// opStatus(bordId, { status, fout }) → 'bezig' | 'ok' | 'offline' | 'fout'

class SyncFout extends Error {
  constructor(bericht, { opnieuw = false } = {}) {
    super(bericht)
    this.opnieuw = opnieuw
  }
}

export function maakSync({ fetch, lees, schrijf, adres, wacht = (ms) => new Promise((ok) => setTimeout(ok, ms)), willekeurig = Math.random, online = () => true, opStatus = () => {}, nu = Date.now }) {
  const cache = new Map() // bordId → { rev, bord }: de laatste stand van de server
  const bezig = new Map() // bordId → lopende ronde (Promise)
  const nogEens = new Set()
  const laatstePut = new Map()

  async function vraag(a, methode, achter = '', body) {
    let res
    try {
      res = await fetch(`${a.u}/bord/${encodeURIComponent(a.r)}${achter}`, {
        method: methode,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body,
        cache: 'no-store',
      })
    } catch {
      throw new SyncFout(online() ? 'Sync-server niet bereikbaar' : 'offline')
    }
    let data = null
    try {
      data = await res.json()
    } catch {
      data = null
    }
    if (res.status === 503 && data?.opnieuw) throw new SyncFout('Even druk op de sync-server', { opnieuw: true })
    if (res.status === 404) throw new SyncFout('Sync-adres klopt niet')
    if (res.status === 409) throw new SyncFout('Deze koppeling hoort bij een ander bord')
    if (!res.ok) throw new SyncFout(`Sync-server gaf fout ${res.status}`)
    if (!data || typeof data !== 'object') throw new SyncFout('Onverwacht antwoord van de sync-server')
    return data
  }

  // Een antwoord verwerken: de cache bijwerken en samenvoegen met de eigen stand.
  function verwerk(bordId, data) {
    const rev = typeof data.rev === 'string' && REV_RE.test(data.rev) ? data.rev : null
    if (data.ongewijzigd) {
      if (rev && cache.get(bordId)?.rev === rev) return
      throw new SyncFout('Onverwacht antwoord van de sync-server')
    }
    if (data.bord === null || data.bord === undefined) {
      // Nog niets op de server (een nieuw gedeeld bord).
      cache.set(bordId, { rev, bord: null })
      return
    }
    const bord = schoonBord(data.bord)
    if (!bord || bord.id !== bordId) throw new SyncFout('Deze koppeling hoort bij een ander bord')
    cache.set(bordId, { rev, bord })
    const oud = lees(bordId)
    if (!oud) return
    // Een eigen kopie voor de telefoon: de cache mag niet meeveranderen als
    // de app straks een briefje aanpast.
    const samen = mergeBord(oud, schoonBord(data.bord))
    if (J(samen) !== J(oud)) schrijf(bordId, samen, oud)
  }

  async function eenRonde(bordId) {
    const a = adres(bordId)
    if (!a || !lees(bordId)) return { status: 'uit' }
    opStatus(bordId, { status: 'bezig' })
    let puts = 0
    try {
      for (;;) {
        const lokaal = lees(bordId)
        if (!lokaal || !adres(bordId)) return { status: 'uit' }
        const c = cache.get(bordId)
        const deel = c ? verschil(lokaal, c.bord) : null
        if (!c) verwerk(bordId, await vraag(a, 'GET'))
        else if (deel) {
          if (puts > OPNIEUW_MAX) break
          puts++
          try {
            for (const stuk of inDelen(deel)) {
              const sinds = nu() - (laatstePut.get(bordId) || 0)
              if (sinds < PUT_PAUZE_MS) await wacht(PUT_PAUZE_MS - sinds)
              laatstePut.set(bordId, nu())
              verwerk(bordId, await vraag(a, 'PUT', '', J({ bord: stuk })))
            }
          } catch (err) {
            // KV even druk (max. 1 schrijfactie per seconde): na een
            // willekeurige korte pauze opnieuw. Wat niet aankwam, staat nog
            // steeds in het verschil.
            if (!err.opnieuw || puts > OPNIEUW_MAX) throw err
            await wacht(1000 + Math.floor(willekeurig() * 1500))
            continue
          }
        } else verwerk(bordId, await vraag(a, 'GET', c.rev ? `?sinds=${encodeURIComponent(c.rev)}` : ''))
        // Heeft de telefoon nog iets nieuwers dan de server? Dan nog een keer.
        const na = cache.get(bordId)
        if (!verschil(lees(bordId), na.bord)) break
      }
      opStatus(bordId, { status: 'ok' })
      return { status: 'ok' }
    } catch (err) {
      if (!(err instanceof SyncFout)) throw err
      const status = err.message === 'offline' ? 'offline' : 'fout'
      opStatus(bordId, { status, fout: status === 'fout' ? err.message : '' })
      return { status, fout: err.message }
    }
  }

  // Eén ronde per bord tegelijk. Komt er tijdens een ronde een nieuwe
  // aanvraag, dan volgt er direct na afloop nog één.
  function ronde(bordId) {
    if (bezig.has(bordId)) {
      nogEens.add(bordId)
      return bezig.get(bordId)
    }
    const p = (async () => {
      let uit
      do {
        nogEens.delete(bordId)
        uit = await eenRonde(bordId)
      } while (nogEens.has(bordId))
      return uit
    })().finally(() => bezig.delete(bordId))
    bezig.set(bordId, p)
    return p
  }

  return {
    ronde,
    // Heeft dit bord iets te versturen? (Zonder cache: weten we nog niet, dus ja.)
    heeftIets: (bordId) => {
      const c = cache.get(bordId)
      return !c || !!verschil(lees(bordId), c.bord)
    },
    bezig: (bordId) => bezig.has(bordId),
    // Bord verlaten of opnieuw koppelen: de onthouden serverstand weg.
    vergeet: (bordId) => {
      cache.delete(bordId)
      laatstePut.delete(bordId)
    },
    // Een stand die de app zelf net ophaalde (bij het koppelen).
    onthoud: (bordId, rev, bord) => cache.set(bordId, { rev, bord: bord ? schoonBord(bord) : null }),
    cacheVan: (bordId) => cache.get(bordId),
  }
}

// Eenmalig een bord ophalen (bij het openen van een koppel-link, vóór het
// bord op de telefoon staat). Geeft { rev, bord } of gooit een Error met een
// bericht voor de gebruiker.
export async function haalBord(fetch, { u, r }) {
  let res
  try {
    res = await fetch(`${u}/bord/${encodeURIComponent(r)}`, { cache: 'no-store' })
  } catch {
    throw new Error('Geen verbinding met de sync-server. Heb je internet?')
  }
  if (res.status === 404) throw new Error('Dit adres is geen Prikbord-sync-server.')
  if (!res.ok) throw new Error(`De sync-server gaf fout ${res.status}.`)
  const data = await res.json().catch(() => null)
  if (!data || typeof data !== 'object') throw new Error('Onverwacht antwoord van de sync-server.')
  if (data.bord === null) return { rev: null, bord: null }
  const bord = schoonBord(data.bord)
  if (!bord) throw new Error('Onverwacht antwoord van de sync-server.')
  return { rev: typeof data.rev === 'string' && REV_RE.test(data.rev) ? data.rev : null, bord }
}
