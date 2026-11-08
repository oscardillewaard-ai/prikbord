// Filteren, sorteren, een briefje trekken en de Gedaan-doos ordenen (puur:
// geen DOM, geen opslag). Zie §5.6, §5.7 en §5.8 van de spec.
//
// Een filter is { cats: [catId, …], samen: true/false }:
// - cats: alleen briefjes in één van deze categorieën (leeg = alle);
// - samen: alleen briefjes waar iedereen op het bord een hartje gaf ("💞 Iedereen zin").
// Beide leeg = "Alles".

import { waarde, hartjesVan } from './model.js'

export const ALLES = Object.freeze({ cats: Object.freeze([]), samen: false })
export const isAlles = (f) => !f.cats.length && !f.samen

// Een categorie-chip aan- of uitzetten (meerdere tegelijk mogen).
export function wisselCat(f, catId) {
  const cats = f.cats.includes(catId) ? f.cats.filter((c) => c !== catId) : [...f.cats, catId]
  return { ...f, cats }
}

// "💞 Iedereen zin": elk lid van het bord gaf een hartje.
export function iedereenZin(bord, b) {
  const leden = Object.keys(bord.leden)
  if (b.weg || !leden.length) return false
  const gaven = new Set(hartjesVan(b))
  return leden.every((l) => gaven.has(l))
}

export function past(bord, b, f) {
  if (f.cats.length && !f.cats.includes(waarde(b.v, 'cat'))) return false
  if (f.samen && !iedereenZin(bord, b)) return false
  return true
}

const nieuwsteEerst = (a, b) => b.gemaakt - a.gemaakt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

// Sorteren in de netjes-weergave: 'nieuw' (standaard) of 'hartjes' (meeste
// eerst; bij evenveel het nieuwste eerst). Geeft een nieuwe lijst terug.
export function sorteer(lijst, wijze = 'nieuw') {
  if (wijze !== 'hartjes') return [...lijst].sort(nieuwsteEerst)
  const n = new Map(lijst.map((b) => [b.id, hartjesVan(b).length]))
  return [...lijst].sort((a, b) => n.get(b.id) - n.get(a.id) || nieuwsteEerst(a, b))
}

// Trek een briefje 🎲 (§5.7): willekeurig uit de zichtbare briefjes. "Nog
// eens" geeft een ander briefje dan het vorige, zolang er meer dan één is.
// `r` is een functie die een getal in [0, 1) geeft (in de app Math.random).
export function trek(ids, r, vorige = null) {
  const kandidaten = ids.length > 1 ? ids.filter((id) => id !== vorige) : ids
  if (!kandidaten.length) return null
  return kandidaten[Math.min(kandidaten.length - 1, Math.floor(r() * kandidaten.length))]
}

// De Gedaan-doos (§5.8): gedane briefjes, nieuwste eerst (op de datum
// waarop het gedaan is, dan op wanneer het in de doos ging).
export function inDeDoos(bord) {
  return Object.values(bord.briefjes)
    .filter((b) => !b.weg && waarde(b.v, 'gedaan'))
    .sort((a, b) => {
      const ga = a.v.gedaan
      const gb = b.v.gedaan
      return gb.w.datum.localeCompare(ga.w.datum) || gb.t - ga.t || (a.id < b.id ? -1 : 1)
    })
}

// Per maand gegroepeerd, in de volgorde van de lijst: [{ maand: 'JJJJ-MM', briefjes }].
export function perMaand(lijst) {
  const uit = []
  for (const b of lijst) {
    const maand = b.v.gedaan.w.datum.slice(0, 7)
    if (uit.at(-1)?.maand !== maand) uit.push({ maand, briefjes: [] })
    uit.at(-1).briefjes.push(b)
  }
  return uit
}
