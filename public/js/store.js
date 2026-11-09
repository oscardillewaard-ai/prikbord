// Opslag in localStorage (§4.1, regel 2). Eén vaste sleutel die nooit meer
// verandert: zo houden geïnstalleerde apps hun briefjes bij elke update.
// Foto's komen later in IndexedDB (M4), niet hier: alle apps op dit domein
// delen één localStorage van een paar MB.

import { schoonStaat, schoonSync } from './validate.js'
import { beginStaat } from './model.js'

export const KEY = 'prikbord.v1'
// Groepscodes en het worker-adres staan apart, buiten de back-up (regel 11).
export const SYNC_KEY = 'prikbord.sync'

// Inlezen, controleren en netjes maken. Kapotte opslag: met een vers bord
// beginnen in plaats van te crashen. De oude tekst blijft dan staan onder een
// reservesleutel, zodat er nog iets te redden valt.
export function laad(now = Date.now()) {
  let raw = null
  try {
    raw = localStorage.getItem(KEY)
    if (raw) {
      const schoon = schoonStaat(JSON.parse(raw))
      if (schoon) return { staat: schoon, nieuw: false }
    }
  } catch {
    // Kapotte JSON of geblokkeerde opslag: hieronder opnieuw beginnen.
  }
  if (raw) {
    try {
      localStorage.setItem(`${KEY}.kapot`, raw)
    } catch {
      // Geen ruimte: dan maar niet.
    }
  }
  return { staat: beginStaat(now), nieuw: true }
}

let wachtend = null
let laatsteFout = 0

// Meteen opslaan. Lukt het niet (opslag vol of geblokkeerd), dan krijgt
// `opFout` een seintje om een back-up voor te stellen (hooguit eens per minuut).
export function bewaar(staat, opFout) {
  clearTimeout(wachtend)
  wachtend = null
  try {
    localStorage.setItem(KEY, JSON.stringify(staat))
    return true
  } catch {
    if (Date.now() - laatsteFout > 60_000) {
      laatsteFout = Date.now()
      opFout?.()
    }
    return false
  }
}

// Opslaan na een korte pauze, voor tijdens het typen (concept, regel 12).
export function bewaarStraks(staat, opFout, ms = 400) {
  clearTimeout(wachtend)
  wachtend = setTimeout(() => bewaar(staat, opFout), ms)
}

// Wat nog in de wachtrij staat meteen wegschrijven (bijv. als de app naar de
// achtergrond gaat; iOS kan hem daarna zonder waarschuwing afsluiten).
export function bewaarNu(staat, opFout) {
  if (wachtend) bewaar(staat, opFout)
}

// De koppelingen (M3): groepscode en adres per gedeeld bord.
export function laadSync() {
  try {
    return schoonSync(JSON.parse(localStorage.getItem(SYNC_KEY)))
  } catch {
    return schoonSync(null)
  }
}

export function bewaarSync(sync) {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(sync))
    return true
  } catch {
    return false
  }
}
