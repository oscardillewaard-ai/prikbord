// Rekenwerk voor foto's (§6.4), puur: geen DOM, geen opslag. Het verkleinen
// zelf (canvas) en IndexedDB staan in photos.js.

import { ID_RE, MAX_FOTO, fotoSoort } from './validate.js'

export const MAX_ZIJDE = 1600 // px, de langste zijde
export const DOEL_BYTES = 400 * 1024 // liefst kleiner dan dit

// Zo proberen we het, op volgorde: eerst 1600 px met kwaliteit 0,8 (§6.4).
// Is de foto dan nog te groot (veel detail, bijv. gras of een menukaart),
// dan wat lagere kwaliteit, en pas daarna kleiner.
export const POGINGEN = [
  { zijde: 1600, kwaliteit: 0.8 },
  { zijde: 1600, kwaliteit: 0.7 },
  { zijde: 1280, kwaliteit: 0.72 },
  { zijde: 1024, kwaliteit: 0.7 },
  { zijde: 800, kwaliteit: 0.68 },
]

// De nieuwe maat: de langste zijde hooguit `max`, nooit groter dan het
// origineel, verhoudingen gelijk, hele pixels.
export function doelMaat(breedte, hoogte, max = MAX_ZIJDE) {
  const w = Math.max(1, Math.round(breedte) || 1)
  const h = Math.max(1, Math.round(hoogte) || 1)
  const f = Math.min(1, max / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * f)), h: Math.max(1, Math.round(h * f)) }
}

// ---------- Duimnagels voor het bord (M5, prestaties) ----------
// Op het bord en in de Gedaan-doos is een polaroidje hooguit ~130 px breed
// (± 400 echte pixels op een iPhone) en altijd vierkant (object-fit: cover).
// Een foto van 1600 × 1200 uitpakken kost daar 1,9 miljoen beeldpunten
// geheugen; een vierkant van 480 × 480 maar 0,23 miljoen. Groot geopend
// zie je gewoon de hele foto.
export const DUIM = 480 // px, de zijde van het vierkantje
export const DUIM_KWALITEIT = 0.8

// Het vierkant uit het midden van de foto (zoals object-fit: cover het
// toont), en hoe groot het wordt: hooguit DUIM, nooit groter dan de foto.
export function duimVak(breedte, hoogte, zijde = DUIM) {
  const w = Math.max(1, Math.round(breedte) || 1)
  const h = Math.max(1, Math.round(hoogte) || 1)
  const s = Math.min(w, h)
  return { sx: Math.floor((w - s) / 2), sy: Math.floor((h - s) / 2), s, uit: Math.min(zijde, s) }
}

// Van alle pogingen: de eerste die onder het doel blijft, anders de kleinste.
// `uitkomsten` is een lijst met { bytes } in de volgorde van POGINGEN.
export function besteUitkomst(uitkomsten) {
  return uitkomsten.find((u) => u.bytes <= DOEL_BYTES) || [...uitkomsten].sort((a, b) => a.bytes - b.bytes)[0] || null
}

// ---------- Back-up met foto's ----------
// In de JSON als base64. In stukjes omzetten, anders loopt
// String.fromCharCode(...grote lijst) vast.

export function naarBase64(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let bin = ''
  for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000))
  return btoa(bin)
}

export function vanBase64(tekst) {
  const bin = atob(tekst)
  const b = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i)
  return b
}

// De foto's uit een back-up: { id: { type, data } }. Alleen echte jpeg, png
// of webp (gecontroleerd aan de bytes) en niet groter dan de worker toestaat.
// Geeft { id: { type, bytes } } terug; wat niet klopt, valt weg.
export function schoonFotos(raw) {
  const uit = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return uit
  for (const id of Object.keys(raw).sort()) {
    const f = raw[id]
    if (!ID_RE.test(id) || !f || typeof f.data !== 'string' || f.data.length > Math.ceil((MAX_FOTO * 4) / 3) + 4) continue
    let bytes
    try {
      bytes = vanBase64(f.data)
    } catch {
      continue
    }
    const type = fotoSoort(bytes)
    if (type && bytes.length <= MAX_FOTO) uit[id] = { type, bytes }
  }
  return uit
}

// Welke foto's horen bij deze borden (op een briefje of bij "Gedaan")?
export function fotosVan(borden) {
  const ids = new Set()
  for (const bord of Object.values(borden || {})) {
    for (const b of Object.values(bord.briefjes || {})) {
      if (b.weg) continue
      const f = b.v?.foto?.w
      const g = b.v?.gedaan?.w?.foto
      if (f) ids.add(f)
      if (g) ids.add(g)
    }
  }
  return ids
}
