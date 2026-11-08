// "Netjes rommelig" (§5.2): de app prikt de briefjes zelf in kolommen, elk
// een paar graden scheef, met een kleine verschuiving uit het id (seed.js).
// Puur: de hoogtes komen van buiten (gemeten in de browser), de uitkomst is
// voor dezelfde invoer altijd hetzelfde.

import { uiterlijk } from './seed.js'
import { BORD_BREEDTE } from './validate.js'

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

// ---------- Vrij (§5.2): de echte-prikbordmodus ----------
// De vrije plek staat in bordcoördinaten: het bord is BORD_BREEDTE (1000)
// eenheden breed, een briefje `briefje` eenheden. Zo ziet een telefoon
// precies dezelfde indeling als een tablet; alleen de zoom verschilt.
// Een briefje zonder vrije plek krijgt de eerste lege plek bovenaan, in een
// raster van vakjes (4 per rij). Daarvoor rekenen we met de vaste maat van een
// vakje, niet met de gemeten hoogte: zo komt elke telefoon op dezelfde plek uit.

export const VRIJ = { breedte: BORD_BREEDTE, briefje: 230, vakB: 245, vakH: 235, rand: 10, boven: 30, overlap: 0.7 }

const klem = (x, min, max) => Math.min(max, Math.max(min, x))

// Is dit vakje vrij? Een briefje telt als "in de weg" als het er voor een
// flink deel (`overlap`) overheen hangt; een randje erover mag.
function vrijVak(x, y, bezet, o) {
  const h = o.vakH - 20
  return bezet.every((b) => Math.abs(b.x - x) >= o.briefje * o.overlap || Math.abs(b.y - y) >= h * o.overlap)
}

// De eerste lege plek, rij voor rij van boven, van links naar rechts.
export function eersteLegePlek(bezet, o = VRIJ) {
  const kolommen = Math.max(1, Math.floor((o.breedte - 2 * o.rand + (o.vakB - o.briefje)) / o.vakB))
  for (let rij = 0; rij < 5000; rij++) {
    for (let k = 0; k < kolommen; k++) {
      const x = o.rand + k * o.vakB
      const y = o.boven + rij * o.vakH
      if (vrijVak(x, y, bezet, o)) return { x, y }
    }
  }
  return { x: o.rand, y: o.boven + 5000 * o.vakH }
}

// lijst: [{ id, gemaakt, vrij: { x, y } | null }].
// Geeft { id: { x, y, draai, auto } }; auto = nog geen eigen vrije plek.
// De briefjes zonder plek gaan op volgorde van maken (oudste eerst), zodat een
// nieuw briefje de oudere niet laat verspringen.
export function legVrij(lijst, o = VRIJ) {
  const plek = {}
  const bezet = []
  for (const b of lijst) {
    if (!b.vrij) continue
    plek[b.id] = { x: b.vrij.x, y: b.vrij.y, draai: uiterlijk(b.id).draai, auto: false }
    bezet.push(b.vrij)
  }
  const los = lijst.filter((b) => !b.vrij).sort((a, b) => a.gemaakt - b.gemaakt || (a.id < b.id ? -1 : 1))
  for (const b of los) {
    const vak = eersteLegePlek(bezet, o)
    bezet.push(vak)
    // Een klein beetje rommelig, net als netjes (zelfde seed, dus overal gelijk).
    const u = uiterlijk(b.id)
    plek[b.id] = { x: rond(klem(vak.x + u.dx * 1.5, 0, o.breedte - o.briefje)), y: rond(Math.max(0, vak.y + u.dy * 2)), draai: u.draai, auto: true }
  }
  return plek
}

// ---------- De camera in vrij: schuiven en zoomen ----------
// cam = { s: schaal, tx, ty: verschuiving in px }. maten = { vw, vh: het
// venster, ww, wh: het bord in px bij schaal 1 }. Puur, zodat het te testen is.

export const ZOOM_MAX = 2.5

export function passendeSchaal({ vw, ww }) {
  return vw / ww
}

// Binnen de grenzen houden: niet verder inzoomen dan ZOOM_MAX, niet verder
// uit dan het hele bord (of 40% van de breedte bij een heel lang bord). Is het
// bord smaller dan het venster, dan staat het in het midden; anders mag je er
// tot `marge` px voorbij schuiven.
export function pasCamera(cam, { vw, vh, ww, wh }, marge = 40) {
  const pas = passendeSchaal({ vw, ww })
  const min = Math.min(pas, Math.max(vh / wh, pas * 0.4))
  const s = klem(Number.isFinite(cam.s) ? cam.s : pas, min, ZOOM_MAX)
  const W = ww * s
  const H = wh * s
  const tx = W <= vw ? (vw - W) / 2 : klem(cam.tx || 0, vw - W - marge, marge)
  const ty = H <= vh ? (vh - H) / 2 : klem(cam.ty || 0, vh - H - marge, marge)
  return { s, tx, ty }
}

// Zoomen rond een punt op het scherm (px, py): dat punt blijft onder je vingers.
export function zoomRond(cam, s, px, py) {
  const f = s / cam.s
  return { s, tx: px - (px - cam.tx) * f, ty: py - (py - cam.ty) * f }
}
