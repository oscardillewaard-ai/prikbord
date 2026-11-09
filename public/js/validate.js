// Controleren en netjes maken van opgeslagen of binnengekomen gegevens (puur).
// Alles wat de app inleest (localStorage, back-up, later de sync) gaat hier
// doorheen. Wat niet klopt, valt weg in plaats van de app te laten vastlopen.
// De schoonmakers bouwen elk object opnieuw op in een vaste volgorde, zodat
// twee telefoons met dezelfde gegevens ook exact dezelfde JSON hebben.

export const ID_RE = /^[A-Za-z0-9_-]{4,40}$/
// Groepscode van een gedeeld bord (M3): lang en willekeurig, het enige wachtwoord.
export const GROEP_RE = /^[A-Za-z0-9_-]{16,64}$/
export const MAX_TEKST = 500
export const MAX_NOTITIE = 1000
export const BORD_BREEDTE = 1000 // vrije plek in bordcoördinaten (M2)

// Velden van een briefje die elk een eigen tijdstempel hebben (§6.2).
export const VELDEN = ['tekst', 'cat', 'link', 'foto', 'plek', 'vrij', 'stapel', 'gedaan']

// Papierkleuren als naam, niet als kleurcode: de stijl bepaalt de tint, zodat
// de inkt op elke kleur leesbaar blijft.
export const PAPIER = ['zon', 'perzik', 'koraal', 'roze', 'lila', 'lucht', 'mint', 'salie', 'zand', 'wit']
// Kleuren van de punaise (wie het prikte).
export const PUNAISE = ['rood', 'blauw', 'groen', 'geel', 'paars', 'oranje', 'roze', 'turkoois']

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

export function schoonLink(w) {
  if (typeof w !== 'string' || w.length > 2000) return undefined
  try {
    const u = new URL(w.trim())
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : undefined
  } catch {
    return undefined
  }
}

// ---------- Foto's (§6.4) ----------
// Ook gebruikt door de worker (die krijgt dit bestand mee, zie A5), zodat app
// en worker dezelfde grens en dezelfde soorten aanhouden.
export const MAX_FOTO = 1.5 * 1024 * 1024 // bytes per foto (1,5 MB)
export const FOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// De soort van een foto aan de eerste bytes, niet aan wat de afzender zegt.
// Geeft 'image/jpeg', 'image/png', 'image/webp' of null.
export function fotoSoort(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0)
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x)) return 'image/png'
  const ascii = (van, tot) => String.fromCharCode(...b.subarray(van, tot))
  if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  return null
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
export const CAT_SCHOON = {
  naam: tekstTot(40, 1),
  emoji: (w) => (typeof w === 'string' && tekens(w) <= 2 && w.length <= 16 ? w : undefined),
  kleur: (w) => (PAPIER.includes(w) ? w : undefined),
  volg: (w) => (isGetal(w) ? w : undefined),
  verborgen: (w) => (typeof w === 'boolean' ? w : undefined),
}
export const LID_SCHOON = {
  naam: tekstTot(40, 1),
  kleur: (w) => (PUNAISE.includes(w) ? w : undefined),
}
export const INFO_SCHOON = {
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

export function schoonBriefje(raw, id = raw?.id) {
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

export function schoonBord(raw) {
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
    // Link, foto en plek (M4). Ontbreekt een veld, dan geldt wat er al op
    // het briefje stond; null = weggehaald op het schrijfvel.
    for (const k of ['link', 'foto', 'plek']) {
      if (!(k in a.concept)) continue
      const w = VELD_SCHOON[k](a.concept[k])
      if (w !== undefined) concept[k] = w
    }
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
export function schoonStaat(raw) {
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
export function schoonAdres(w) {
  const url = String(w ?? '').trim().replace(/\/+$/, '')
  if (url.length > 300) return ''
  return /^https:\/\/[^\s/?#]+(\/[^\s?#]*)?$/.test(url) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(url) ? url : ''
}

// { url, borden: { bordId: { u, r } } }: u = adres van de sync-server, r = groepscode.
export function schoonSync(raw) {
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
