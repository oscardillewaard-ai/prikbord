// Het datamodel van Prikbord (puur: geen DOM, geen opslag; de tijd komt mee
// als `now`). Vanaf het begin gebouwd voor samenwerken (§6.2): elk veld heeft
// een eigen tijdstempel, verwijderen zet een grafsteen.
//
// Stand (sleutel prikbord.v1):
//   { v: 1, bord: <actief bord-id>, borden: { id: Bord }, apparaat: {...} }
// Bord:
//   { id, gemaakt, info: { naam, emoji }, cats: { id: { naam, emoji, kleur, volg, verborgen } },
//     leden: { id: { naam, kleur } }, briefjes: { id: Briefje } }
// Briefje:
//   { id, door, gemaakt, v: { tekst, cat, link, foto, plek, vrij, stapel, gedaan }, hart: { lidId } }
//   of na verwijderen: { id, door, gemaakt, weg }
// Elk veld (naam, tekst, hartje …) is een register { w: waarde, t: tijdstip }.

import { PUNAISE, VELDEN } from './validate.js'

// Lange, willekeurige id (base64url). Wordt nooit hergebruikt.
export function maakId(bytes = 12) {
  const b = globalThis.crypto.getRandomValues(new Uint8Array(bytes))
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Tijdstempel van een wijziging: nooit ouder dan de vorige van hetzelfde veld,
// ook niet als de klok van de telefoon even terugspringt (zoals Parkenjacht).
export const stempel = (vorige, now) => Math.max(now, (vorige?.t || 0) + 1)
export const reg = (w, t) => ({ w, t })
export const waarde = (velden, k, standaard = null) => (velden?.[k] ? velden[k].w : standaard)

// Begin-categorieën van een "Thuis"-bord (§5.6). Vaste id's, zodat twee
// back-ups van hetzelfde bord dezelfde categorieën hebben.
export const THUIS_CATS = [
  { id: 'vakantie', naam: 'Lange vakantie', emoji: '🏝️', kleur: 'lucht' },
  { id: 'weekend', naam: 'Weekendje weg', emoji: '🧳', kleur: 'lila' },
  { id: 'dagjeuit', naam: 'Dagje uit', emoji: '🎡', kleur: 'zon' },
  { id: 'uiteten', naam: 'Uit eten', emoji: '🍝', kleur: 'koraal' },
  { id: 'restaurants', naam: 'Restaurants', emoji: '🍽️', kleur: 'perzik' },
  { id: 'recepten', naam: 'Recepten', emoji: '🥘', kleur: 'salie' },
  { id: 'todo', naam: 'To do', emoji: '✅', kleur: 'wit' },
  { id: 'bucketlist', naam: 'Bucketlist', emoji: '⭐', kleur: 'roze' },
]
const LEEG_CATS = [{ id: 'ideetjes', naam: 'Ideetjes', emoji: '💡', kleur: 'zon' }]

function catVelden(c, i, now) {
  return { emoji: reg(c.emoji, now), kleur: reg(c.kleur, now), naam: reg(c.naam, now), verborgen: reg(false, now), volg: reg(i, now) }
}

export function nieuwBord({ id = maakId(), naam, emoji, sjabloon = 'thuis', now }) {
  const cats = {}
  ;(sjabloon === 'thuis' ? THUIS_CATS : LEEG_CATS).forEach((c, i) => {
    cats[c.id] = catVelden(c, i, now)
  })
  return {
    id,
    gemaakt: now,
    info: { emoji: reg(emoji, now), naam: reg(naam, now) },
    cats: Object.fromEntries(Object.keys(cats).sort().map((k) => [k, cats[k]])),
    leden: {},
    briefjes: {},
  }
}

// Een nieuw lid op een bord. Kleur: de eerste die nog niet gebruikt wordt.
export function voegLidToe(bord, { id = maakId(), naam, kleur, now }) {
  const bezet = new Set(Object.values(bord.leden).map((l) => waarde(l, 'kleur')))
  const k = kleur || PUNAISE.find((p) => !bezet.has(p)) || PUNAISE[Object.keys(bord.leden).length % PUNAISE.length]
  bord.leden[id] = { kleur: reg(k, now), naam: reg(naam, now) }
  bord.leden = Object.fromEntries(Object.keys(bord.leden).sort().map((x) => [x, bord.leden[x]]))
  return id
}

// De eerste stand op een nieuwe telefoon: één bord "Thuis" met jou erop.
export function beginStaat(now) {
  const bord = nieuwBord({ naam: 'Thuis', emoji: '🏠', sjabloon: 'thuis', now })
  const ik = voegLidToe(bord, { naam: 'Ik', kleur: 'rood', now })
  return {
    v: 1,
    bord: bord.id,
    borden: { [bord.id]: bord },
    apparaat: { geluid: true, seenVersion: 0, ik: { [bord.id]: ik }, weergave: {}, gezien: {}, concept: null },
  }
}

export function nieuwBriefje(bord, { id = maakId(), door, tekst, cat, now }) {
  const b = { id, door, gemaakt: now, v: { cat: reg(cat, now), tekst: reg(tekst, now) }, hart: {} }
  bord.briefjes[id] = b
  return b
}

// Eén veld van een briefje wijzigen. Geeft false terug als er niets verandert
// (dan krijgt het veld ook geen nieuwe tijdstempel).
export function zetVeld(briefje, veld, w, now) {
  if (!VELDEN.includes(veld)) throw new Error(`Onbekend veld: ${veld}`)
  if (briefje.weg) return false
  const oud = briefje.v[veld]
  if (oud && JSON.stringify(oud.w) === JSON.stringify(w)) return false
  briefje.v[veld] = reg(w, stempel(oud, now))
  briefje.v = Object.fromEntries(Object.keys(briefje.v).sort().map((k) => [k, briefje.v[k]]))
  return true
}

// Verwijderen = grafsteen. Alle velden gaan weg; de grafsteen blijft bestaan
// zodat andere telefoons het briefje ook weghalen.
export function verwijder(bord, id, now) {
  const b = bord.briefjes[id]
  if (!b || b.weg) return
  const laatste = Math.max(b.gemaakt, ...Object.values(b.v).map((r) => r.t), ...Object.values(b.hart).map((r) => r.t))
  bord.briefjes[id] = { id, door: b.door, gemaakt: b.gemaakt, weg: Math.max(now, laatste + 1) }
}

// Categorieën op volgorde (verborgen alleen als je daarom vraagt).
export function categorieen(bord, { metVerborgen = false } = {}) {
  return Object.entries(bord.cats)
    .map(([id, c]) => ({ id, naam: waarde(c, 'naam', '?'), emoji: waarde(c, 'emoji', ''), kleur: waarde(c, 'kleur', 'wit'), volg: waarde(c, 'volg', 0), verborgen: waarde(c, 'verborgen', false) }))
    .filter((c) => metVerborgen || !c.verborgen)
    .sort((a, b) => a.volg - b.volg || a.id.localeCompare(b.id))
}

export function catVan(bord, catId) {
  const c = bord.cats[catId]
  if (!c) return { id: catId, naam: 'Zonder categorie', emoji: '📝', kleur: 'wit' }
  return { id: catId, naam: waarde(c, 'naam', '?'), emoji: waarde(c, 'emoji', ''), kleur: waarde(c, 'kleur', 'wit') }
}

export function lidVan(bord, lidId) {
  const l = bord.leden[lidId]
  return { id: lidId, naam: waarde(l, 'naam', 'Iemand'), kleur: waarde(l, 'kleur', 'rood') }
}

// Briefjes die op het bord hangen: niet verwijderd, niet gedaan. Nieuwste eerst.
export function opHetBord(bord) {
  return Object.values(bord.briefjes)
    .filter((b) => !b.weg && !waarde(b.v, 'gedaan'))
    .sort((a, b) => b.gemaakt - a.gemaakt || (a.id < b.id ? -1 : 1))
}
