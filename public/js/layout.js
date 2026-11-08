// "Netjes rommelig" (§5.2): de app prikt de briefjes zelf in kolommen, elk
// een paar graden scheef, met een kleine verschuiving uit het id (seed.js).
// Puur: de hoogtes komen van buiten (gemeten in de browser), de uitkomst is
// voor dezelfde invoer altijd hetzelfde.

import { uiterlijk } from './seed.js'

export const KOLOM_OPTIES = { rand: 14, tussen: 10, boven: 22, onder: 120, afstand: 14 }

// 2 kolommen op een telefoon, meer op bredere schermen.
export function kolomAantal(breedte) {
  if (breedte < 560) return 2
  if (breedte < 820) return 3
  if (breedte < 1100) return 4
  return 5
}

export function kolomBreedte(breedte, opties = KOLOM_OPTIES) {
  const k = kolomAantal(breedte)
  return Math.floor((breedte - 2 * opties.rand - (k - 1) * opties.tussen) / k)
}

const rond = (x) => Math.round(x * 10) / 10

// ids: op volgorde (bijv. nieuwste eerst). hoogtes: { id: px }.
// Elk briefje gaat in de kolom die nu het kortst is (bij gelijk: de linkse).
// Geeft { plek: { id: { x, y, w, draai, z } }, hoogte, kolommen, breedte }.
export function legNetjes(ids, hoogtes, breedte, opties = KOLOM_OPTIES) {
  const k = kolomAantal(breedte)
  const w = kolomBreedte(breedte, opties)
  // Wat er over is, verdelen we over beide kanten, zodat het bord in het midden staat.
  const links = Math.floor((breedte - (k * w + (k - 1) * opties.tussen)) / 2)
  const kolY = Array(k).fill(opties.boven)
  const plek = {}
  ids.forEach((id, i) => {
    const u = uiterlijk(id)
    let c = 0
    for (let j = 1; j < k; j++) if (kolY[j] < kolY[c] - 0.5) c = j
    const y = kolY[c] + u.dy
    plek[id] = { x: rond(links + c * (w + opties.tussen) + u.dx), y: rond(y), w, draai: u.draai, z: i + 1 }
    kolY[c] = y + (hoogtes[id] || 0) + opties.afstand
  })
  return { plek, hoogte: Math.ceil(Math.max(...kolY) + opties.onder), kolommen: k, breedte: w }
}
